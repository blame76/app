// Actual helper and IndexedDB: upcoming → due → done/rescheduled, without context rules.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 800 }, timezoneId: 'Europe/Berlin' });
  const app = await context.newPage();
  const results = [], errors = [], requests = [];
  app.on('pageerror', error => errors.push(error.message));
  app.on('request', request => requests.push(request.url()));
  const check = (ok, label) => { if (!ok) throw new Error(label); results.push(label); };
  const card = app.locator('#nowRows [data-helper="warte-auf"]');
  const text = ('<img src="https://external.test/leak"> Antwort ' + 'der Versicherung '.repeat(10)).trim();
  async function ready() { await app.waitForSelector('#warteAufCreateForm'); }
  async function home() {
    await app.evaluate(() => { window.previousListChild = document.querySelector('#allHelperList').firstElementChild; });
    await app.locator('#backButton').click();
    await app.waitForFunction(() => !document.querySelector('#view-dashboard').hidden && document.querySelector('#allHelperList').firstElementChild !== window.previousListChild);
  }
  async function primary(value) {
    await app.waitForFunction(value => document.querySelector('#nowRows [data-helper="warte-auf"] .now-primary')?.textContent === value, value);
  }
  async function absent() { await app.waitForFunction(() => !document.querySelector('#nowRows [data-helper="warte-auf"]')); }
  try {
    await app.clock.install({ time: new Date('2026-10-07T23:59:58+02:00') });
    await app.clock.pauseAt(new Date('2026-10-07T23:59:58+02:00'));
    await app.goto('http://127.0.0.1:8080/');
    await app.waitForSelector('#allHelperList [data-helper="warte-auf"]', { state: 'attached' });
    await app.evaluate(async text => {
      const db = await import('/src/db.js');
      const { createWaitingEntry, completeWaitingEntry } = await import('/src/helpers/warte-auf/model.js');
      await db.put('entries', { ...createWaitingEntry({ text, expectedDate: '2026-10-08' }), id: 'tomorrow' });
      await db.put('entries', { ...createWaitingEntry({ text: 'Ohne Datum' }), id: 'undated' });
      await db.put('entries', { ...completeWaitingEntry(createWaitingEntry({ text: 'Erledigt', expectedDate: '2026-10-07' })), id: 'done' });
      window.beforeNow = JSON.stringify(await db.list('entries', { prune: false }));
    }, text);
    await app.evaluate(() => { window.previousListChild = document.querySelector('#allHelperList').firstElementChild; });
    await app.locator('#brandButton').click();
    await app.waitForFunction(() => document.querySelector('#allHelperList').firstElementChild !== window.previousListChild);
    await absent();
    check(true, 'Future, undated and completed entries do not show a Now card');
    await app.clock.fastForward(2000);
    await primary(text);
    check(await card.locator('[data-context="active"]').count() === 1, 'An initially inactive card appears at local midnight without reload or context rules');
    check(await app.evaluate(async () => {
      const db = await import('/src/db.js');
      return JSON.stringify(await db.list('entries', { prune: false })) === window.beforeNow && !(await db.get('settings', 'usage:warte-auf'));
    }), 'Projection and automatic resurfacing do not write entries or record use');
    await app.keyboard.press('Tab'); await card.focus();
    check(await card.evaluate(el => getComputedStyle(el).outlineStyle === 'solid'), 'Now card has visible keyboard focus');
    await app.keyboard.press('Enter'); await ready();
    await home(); await primary(text);
    check(true, 'Opening with the keyboard and returning keeps the entry due');
    for (const theme of ['light', 'dark', 'signature']) {
      await app.evaluate(theme => { document.documentElement.dataset.theme = theme; document.documentElement.style.fontSize = '200%'; }, theme);
      check(await card.evaluate(el => el.getBoundingClientRect().height >= 48 && el.scrollWidth <= el.clientWidth + 2)
        && await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth && !document.querySelector('#nowRows img')), `${theme}: long untrusted text fits 320px / 200%, with a 48px control`);
    }
    await app.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await app.screenshot({ path: '/tmp/0815-warte-auf-now-320.png', fullPage: true });
    await card.click(); await ready();
    await app.locator('#warteAufCreateForm [name="text"]').fill('Ältere Rückmeldung');
    await app.locator('#warteAufCreateForm [name="expectedDate"]').fill('2026-10-07');
    await app.locator('#warteAufCreateForm button[type="submit"]').click();
    await app.waitForFunction(() => !document.querySelector('#helperHost [aria-busy="true"]'));
    await home(); await primary('2 Wiedervorlagen fällig');
    check(await card.locator('.now-secondary').textContent() === 'Ältere Rückmeldung', 'Multiple due entries show their count and the earliest due content');
    await card.click(); await ready();
    await app.locator('.warte-auf-item').filter({ hasText: 'Ältere Rückmeldung' }).click();
    await app.locator('.warte-auf-detail-actions button').filter({ hasText: 'Erledigt' }).click();
    await ready(); await home(); await primary(text);
    check(true, 'Completing one entry keeps the remaining due entry visible');
    await card.click(); await ready();
    await app.locator('.warte-auf-item').filter({ hasText: text }).click();
    await app.locator('.warte-auf-detail-actions button').filter({ hasText: 'Weiter warten' }).click();
    await app.locator('#warteAufWaitForm [name="expectedDate"]').fill('2026-10-09');
    await app.locator('#warteAufWaitForm button[type="submit"]').click();
    await ready(); await home(); await absent();
    check(true, 'Moving the last due entry into the future removes its Now card immediately on return');
    await app.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await app.clock.fastForward(86400000);
    await absent();
    check(true, 'Background time does not display or acknowledge a due entry');
    await app.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await primary(text);
    check(true, 'Returning to the foreground recomputes the rescheduled due date');
    await app.reload(); await primary(text);
    check(true, 'Reload restores the still-open due state');
    await card.click(); await ready();
    await app.locator('.warte-auf-item').filter({ hasText: text }).click();
    await app.locator('.warte-auf-detail-actions button').filter({ hasText: 'Erledigt' }).click();
    await ready(); await home(); await absent();
    check(true, 'Completing the last due entry removes the card, despite an undated open entry');
    await app.evaluate(async () => {
      const db = await import('/src/db.js');
      const entry = await db.get('entries', 'tomorrow');
      delete entry.completedAt;
      await db.put('entries', { ...entry, status: 'waiting' });
      await db.put('helperRules', { id: 'warte-auf', visible: false });
    });
    await app.reload();
    await app.waitForSelector('#allHelperList [data-helper="drink"]', { state: 'attached' });
    check(await app.locator('[data-helper="warte-auf"]').count() === 0, 'Visibility settings still hide due waiting cards without deleting their entries');
    check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
    check(requests.every(url => url.startsWith('http://127.0.0.1:8080/')), 'No external requests, including from imported markup');
    return results;
  } catch (error) { throw new Error(`${error.message}\nLast check: ${results.at(-1)}\n${(await app.locator('main').innerText()).slice(0,2000)}`); } finally { await context.close(); }
}

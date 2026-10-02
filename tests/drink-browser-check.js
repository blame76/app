// Real helper, real IndexedDB, controlled local time; no timer waits or new dependency.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 700 }, timezoneId: 'Europe/Berlin' });
  const app = await context.newPage();
  const results = [];
  const errors = [];
  const requests = [];
  app.on('pageerror', error => errors.push(error.message));
  app.on('request', request => requests.push(request.url()));
  function check(condition, label) { if (!condition) throw new Error(label); results.push(label); }
  async function data() { return app.evaluate(async () => (await (await import('/src/db.js')).list('entries')).filter(entry => entry.helperId === 'drink')); }
  async function usage() { return app.evaluate(async () => (await (await import('/src/db.js')).get('settings', 'usage:drink'))?.lastUsedAt); }
  async function open() {
    await app.locator('.home-accordion').last().evaluate(element => { element.open = true; });
    await app.locator('#allHelperList [data-helper="drink"]').click();
    await app.waitForSelector('#drinkRecord');
  }
  async function setTime(time) { await app.evaluate(time => { window.testNow = time; sessionStorage.setItem('testNow', String(time)); }, time); }
  async function reason(time, expected) {
    await setTime(time);
    // Require a newly rendered dashboard, even when the expected reason is unchanged.
    await app.locator('#nowRows').evaluate(element => element.replaceChildren());
    await app.locator('#brandButton').click();
    await app.waitForFunction(expected => document.querySelector('#nowRows [data-helper="drink"] span')?.textContent === expected, expected);
  }
  async function saveSettings() { await app.locator('#helperSettingsForm button').click(); await app.waitForFunction(() => !document.querySelector('#helperSettingsForm').dataset.saving); }
  async function reflow(label) { check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label); }
  await app.addInitScript(() => {
    const NativeDate = Date;
    window.testNow = Number(sessionStorage.getItem('testNow')) || new NativeDate('2026-10-02T10:00:00Z').getTime();
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [window.testNow])); }
      static now() { return window.testNow; }
    };
    window.geoCalls = 0;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition() { window.geoCalls++; throw new Error('Unexpected location query'); } } });
  });
  try {
    await app.goto('http://127.0.0.1:8080/');
    await app.waitForSelector('#allHelperList [data-helper="drink"]', { state: 'attached' });
    check(await app.locator('#nowRows [data-helper="drink"]').count() === 0, 'Unused drink has no interval candidate before its first real use');
    await open();
    check(!await app.locator('#view-dashboard').isVisible() && await app.locator('#drinkQuestion').isVisible(), 'Drink opens its single-question focus view');
    check(await usage() === undefined && (await data()).length === 0, 'Opening drink does not store an event or record use');
    check((await app.locator('.drink').ariaSnapshot()).includes('heading "Gerade etwas getrunken?"') && await app.locator('#drinkRecord').getAttribute('aria-describedby') === 'drinkQuestion', 'First-use button is connected to its accessible question');
    check(await app.locator('#drinkQuestion').evaluate(element => element === document.activeElement), 'First-use focus lands on the question');
    await app.keyboard.press('Tab');
    check(await app.locator('#drinkRecord').evaluate(element => element === document.activeElement && getComputedStyle(element).outlineStyle === 'solid'), 'Tab reaches the drink action with visible focus');
    const toastBefore = await app.locator('#toast').textContent();
    await app.keyboard.press('Space');
    await app.waitForFunction(() => !document.querySelector('.drink-last').hidden && !document.querySelector('#drinkRecord').disabled);
    check(await app.locator('#view-helper').isVisible() && await app.locator('#drinkLast').textContent() === 'gerade eben' && await app.locator('#drinkRecord').textContent() === 'Ja, gerade', 'Drink stays open and confirms through its updated state');
    check(await app.locator('#toast').textContent() === toastBefore, 'Successful drink save adds no duplicate toast');
    check(await app.locator('#drinkLast').evaluate(element => element === document.activeElement), 'Focus follows successful documentation to its timestamp');
    const first = (await data())[0];
    check(first.recordedAt === first.createdAt && first.entryVersion === 1 && Object.keys(first).sort().join(',') === 'createdAt,entryVersion,helperId,id,recordedAt', 'Stored drink contains only identity, version and timestamps');
    check(await usage() === first.recordedAt && await app.locator('.drink-history li').count() === 1, 'Committed event records real use and appears in today history');
    check(await app.locator('#drinkLast').getAttribute('datetime') === new Date(first.recordedAt).toISOString() && !!await app.locator('#drinkLast').getAttribute('title'), 'Last documentation exposes its absolute timestamp');
    await reflow('Drink question, timestamp, action and history fit 320 CSS px');
    await app.screenshot({ path: '/tmp/0815-drink-320.png', fullPage: true });
    await setTime(first.recordedAt + 60000);
    await app.evaluate(() => {
      window.originalPut = IDBObjectStore.prototype.put;
      window.drinkWrites = 0;
      IDBObjectStore.prototype.put = function(value, ...args) {
        if (this.name === 'entries' && value.helperId === 'drink') window.drinkWrites++;
        return window.originalPut.call(this, value, ...args);
      };
      const button = document.querySelector('#drinkRecord');
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await app.waitForFunction(() => !document.querySelector('#drinkRecord').disabled);
    check((await data()).length === 2 && await app.evaluate(() => window.drinkWrites === 1), 'Repeated pending drink action stores one distinct event');
    await app.evaluate(() => { IDBObjectStore.prototype.put = window.originalPut; });
    const usedAt = await usage();
    await app.locator('#backButton').click();
    for (const [elapsed, expected] of [[0, 'zuletzt verwendet'], [45 * 60000 - 1, 'zuletzt verwendet'], [45 * 60000, 'Intervall · 60 Min.'], [60 * 60000, 'Intervall · 60 Min.']]) {
      await reason(usedAt + elapsed, expected);
      check(await app.locator('#nowRows [data-helper="drink"] span').textContent() === expected, `Default interval at ${elapsed} ms: ${expected}`);
    }
    await open();
    await app.locator('#helperSettingsButton').click();
    await app.waitForSelector('#helperSettingsForm');
    check(await app.locator('input[name="place"], input[name="time"], input[name="guidance"]').count() === 0 && await app.locator('[name="trackingWindow"]').inputValue() === 'always', 'Drink settings expose interval and unlimited retention, without unrelated capabilities');
    check(await app.locator('input[name="interval"]').inputValue() === '60' && await app.locator('input[name="tolerance"]').inputValue() === '15', 'Shared settings show the declared 60/15 defaults');
    await app.locator('input[name="interval"]').fill('90');
    await saveSettings();
    await app.locator('#backButton').click();
    for (const [elapsed, expected] of [[60 * 60000, 'zuletzt verwendet'], [75 * 60000 - 1, 'zuletzt verwendet'], [75 * 60000, 'Intervall · 90 Min.']]) {
      await reason(usedAt + elapsed, expected);
      check(await app.locator('#nowRows [data-helper="drink"] span').textContent() === expected, `Changed interval at ${elapsed} ms: ${expected}`);
    }
    check(await usage() === usedAt, 'Changing interval and rendering context never records use');
    await app.evaluate(async usedAt => {
      const db = await import('/src/db.js');
      const { createDrink } = await import('/src/helpers/drink/model.js');
      const start = new Date(usedAt); start.setHours(0, 0, 0, 0);
      await db.put('entries', { ...createDrink(start.getTime() - 1), id: 'drink-yesterday' });
      await db.put('entries', { ...createDrink(start.getTime()), id: 'drink-midnight' });
    }, usedAt);
    await open();
    check(await app.locator('#drinkLast').getAttribute('datetime') === new Date(usedAt).toISOString() && await app.locator('#drinkLast').textContent() === 'vor 1 Stunde', 'Returning view uses the latest documented event and elapsed time');
    check(await app.locator('.drink-history li').count() === 3 && !await app.locator('.drink-history time').evaluateAll(elements => elements.some(element => new Date(element.dateTime).getDate() === 1)), 'Today history excludes yesterday without deleting its stored event');
    check(await app.locator('.drink-history time').evaluateAll(elements => elements.every((element, index) => index === 0 || elements[index - 1].dateTime >= element.dateTime)), 'Today history is descending');
    const enlargedText = await app.addStyleTag({ content: ':root { font-size: 200%; }' });
    await reflow('Drink reflows with 200% text at 320 CSS px');
    check(await app.locator('#drinkRecord').evaluate(element => element.getBoundingClientRect().height >= 48), 'Drink action retains at least 48 px height with enlarged text');
    await enlargedText.evaluate(element => element.remove());
    await app.emulateMedia({ reducedMotion: 'reduce' });
    check(await app.locator('#drinkRecord').evaluate(element => parseFloat(getComputedStyle(element).transitionDuration) === 0), 'Drink respects Reduced Motion');
    const beforeFailure = JSON.stringify(await data());
    const useBeforeFailure = await usage();
    await app.evaluate(() => {
      IDBObjectStore.prototype.put = function(value, ...args) {
        if (this.name === 'entries' && value.helperId === 'drink') throw new DOMException('Quota', 'QuotaExceededError');
        return window.originalPut.call(this, value, ...args);
      };
    });
    await app.locator('#drinkRecord').click();
    await app.waitForFunction(() => document.querySelector('#toast').textContent.includes('Getränk konnte nicht dokumentiert werden.'));
    check(JSON.stringify(await data()) === beforeFailure && await usage() === useBeforeFailure && await app.locator('#drinkLast').textContent() === 'vor 1 Stunde', 'Failed drink save preserves events, use metadata and the last documented state');
    await app.evaluate(() => { IDBObjectStore.prototype.put = window.originalPut; });
    await app.locator('#drinkRecord').click();
    await app.waitForFunction(() => document.querySelector('#drinkLast').textContent === 'gerade eben' && !document.querySelector('#drinkRecord').disabled);
    check((await data()).length === 5, 'Drink save can be retried after storage failure');
    const useBeforeMetadataFailure = await usage();
    await setTime(useBeforeMetadataFailure + 5 * 60000);
    await app.evaluate(() => {
      IDBObjectStore.prototype.put = function(value, ...args) {
        if (this.name === 'settings' && value.id === 'usage:drink') throw new Error('INTERNAL usage failure');
        return window.originalPut.call(this, value, ...args);
      };
    });
    await app.locator('#drinkRecord').click();
    await app.waitForFunction(() => document.querySelector('#toast').textContent === 'Getränk dokumentiert. Der Intervallzeitpunkt konnte nicht aktualisiert werden.');
    check((await data()).length === 6 && await usage() === useBeforeMetadataFailure && await app.locator('#drinkLast').textContent() === 'gerade eben', 'Metadata failure keeps the committed drink and reports only the stale interval point');
    await app.evaluate(() => { IDBObjectStore.prototype.put = window.originalPut; });
    await app.reload();
    await app.waitForSelector('#allHelperList [data-helper="drink"]', { state: 'attached' });
    await open();
    check(await app.locator('.drink-history li').count() === 5 && await app.locator('#drinkLast').textContent() === 'gerade eben', 'Reload restores committed drinks even after a metadata failure');
    await app.evaluate(async () => {
      const db = await import('/src/db.js');
      const old = Date.now() - 8 * 86400000;
      const { createDrink } = await import('/src/helpers/drink/model.js');
      const { createObservation } = await import('/src/helpers/pain/model.js');
      await db.put('entries', { ...createDrink(old), id: 'drink-expired' });
      await db.put('entries', { ...createObservation('Bauch', 4, old), id: 'pain-kept' });
      await db.put('entries', { id: 'note-kept', type: 'note', text: 'Bleibt', createdAt: old });
    });
    await app.locator('#helperSettingsButton').click();
    await app.waitForSelector('#helperSettingsForm');
    await app.locator('[name="trackingWindow"]').selectOption('7d');
    await app.locator('input[name="favorite"]').check();
    await saveSettings();
    check(!(await data()).some(entry => entry.id === 'drink-expired') && (await data()).some(entry => entry.id === 'drink-yesterday'), 'Finite retention prunes expired drinks while retaining recent older-day events');
    check(await app.evaluate(async () => {
      const db = await import('/src/db.js');
      const entries = await db.list('entries');
      const rule = await db.get('helperRules', 'drink');
      return entries.some(entry => entry.id === 'pain-kept') && entries.some(entry => entry.id === 'note-kept') && rule.intervalMinutes === 90 && rule.toleranceMinutes === 15 && rule.favorite && rule.trackingWindow === '7d';
    }), 'Drink retention preserves pain, core data, favorite and interval settings');
    const retained = JSON.stringify(await data());
    await app.locator('input[name="visible"]').uncheck();
    await saveSettings();
    await app.locator('#backButton').click();
    await app.waitForFunction(() => !document.querySelector('[data-helper="drink"]'));
    check(JSON.stringify(await data()) === retained, 'Hiding drink removes all dashboard links without deleting events');
    check(await app.evaluate(() => window.geoCalls === 0), 'Drink never causes a location query');
    check(requests.every(url => url.startsWith('http://127.0.0.1:8080/')), 'Drink never requests external resources');
    check(await app.evaluate(() => [...document.querySelectorAll('[hidden]')].every(element => getComputedStyle(element).display === 'none')), 'Drink hidden states stay outside layout');
    check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
    return results;
  } finally { await context.close(); }
}

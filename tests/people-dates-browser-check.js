// Actual UI/IndexedDB, calendar timer, rollback, keyboard, three themes and real SW offline.
async (page) => {
  const results = [];
  for (const offline of [false, true]) {
    const context = await page.context().browser().newContext({ timezoneId: 'Europe/Berlin', serviceWorkers: offline ? 'allow' : 'block', viewport: { width: 390, height: 844 } });
    const app = await context.newPage();
    const errors = [], requests = [];
    app.on('pageerror', error => errors.push(error.message));
    app.on('request', request => requests.push(request.url()));
    const check = (ok, message) => { if (!ok) throw new Error(`${offline ? 'offline' : 'online'}: ${message}`); results.push(`${offline ? 'offline' : 'online'}: ${message}`); };
    const ready = () => app.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
    const back = async () => { await app.locator('#backButton').click(); await ready(); };
    const home = async () => { while (!await app.locator('#view-dashboard').isVisible()) await back(); await app.locator('#brandButton').click(); await ready(); };
    const person = async () => {
      await home(); await app.locator('#menuButton').click(); await app.locator('[data-view="people"]').click();
      await app.locator('[data-person="p"]').click(); await app.locator('#personEdit').waitFor();
    };
    const stored = () => app.evaluate(async () => (await (await import('/src/db.js')).exportAll()).stores);
    const saveDate = async () => { await app.locator('#personDateForm button[type="submit"]').click(); await app.locator('#personDateEdit').waitFor(); await ready(); };
    try {
      await app.clock.install({ time: new Date('2026-03-06T23:59:58+01:00') });
      await app.clock.pauseAt(new Date('2026-03-06T23:59:59+01:00'));
      await app.goto('http://127.0.0.1:8080/');
      await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
      if (offline) {
        await app.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })); });
        await context.setOffline(true); await app.reload();
        await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
      }
      await app.evaluate(async () => {
        const db = await import('/src/db.js');
        await db.put('people', { id: 'p', name: 'Vincent', createdAt: 1 });
        await db.put('people', { id: 'other', name: 'Anna', createdAt: 2 });
        for (let i = 0; i < 6; i++) await db.put('entries', { id: `n${i}`, type: 'person-note', personId: 'p', kind: i < 4 ? 'reference' : 'gift', text: `Text ${i}`, createdAt: i });
        await db.put('entries', { id: 'other-note', type: 'person-note', personId: 'other', kind: 'reference', text: 'Behalten', createdAt: 1 });
        await db.put('entries', { id: 'd', type: 'person-date', personId: 'p', label: 'Geburtstag', recurrence: 'yearly', month: 3, day: 14, showBeforeDays: 7, createdAt: 3 });
      });
      const before = await stored();
      await app.evaluate(() => {
        const schedule = window.setTimeout;
        window.setTimeout = (callback, delay, ...args) => {
          if (delay > 0) window.peopleTimerAt = Date.now() + delay;
          return schedule(callback, delay, ...args);
        };
      });
      await home();
      await app.waitForFunction(() => window.peopleTimerAt === new Date(2026, 2, 7).getTime());
      check(await app.locator('#nowRows [data-person-date]').count() === 0, 'March 6 has no early date card');
      await app.clock.runFor(2000);
      await app.waitForSelector('#nowRows [data-person-date="d"]');
      check(await app.locator('#nowRows [data-person-date="d"] .now-primary').textContent() === 'Geburtstag in 7 Tagen', 'existing timer reveals card at local midnight without reload');
      check(await app.locator('#nowRows [data-person-date="d"] .now-heading').textContent() === 'Vincent', 'Now names the person and concrete occasion');
      await app.locator('[data-person-date="d"]').click(); await app.locator('#personDateEdit').waitFor();
      check(await app.locator('#backButton').getAttribute('aria-label') === 'Zurück zu Vincent', 'Now opens date with Person parent');
      await back(); await app.locator('#personEdit').waitFor(); await back();
      check(await app.locator('#view-dashboard').isVisible(), 'date → Person → dashboard has no dead end');
      await person(); await app.locator('#personEdit').click();
      await app.locator('#personEditForm input').fill(' '); await app.locator('#personEditForm button[type="submit"]').click();
      check((await stored()).people.find(p => p.id === 'p').name === 'Vincent', 'blank name keeps original');
      await app.locator('#personEditForm input').fill(' Benjamin '); await app.locator('#personEditForm button[type="submit"]').click();
      await app.locator('#personEdit').waitFor();
      const renamed = await stored();
      check(JSON.stringify(renamed.entries) === JSON.stringify(before.entries) && renamed.people.find(p => p.id === 'p').createdAt === 1, 'rename preserves all notes, gifts, dates, identity and createdAt');
      check(await app.locator('#focusTitle').textContent() === 'Benjamin' && await app.locator('#personEdit').evaluate(node => node === document.activeElement), 'new name renders and save restores focus');
      await app.locator('#personDateAdd').click();
      await app.getByLabel('Anlass', { exact: true }).fill('<img src="/leak"> Einladung');
      await app.getByLabel('Einmal', { exact: true }).check(); await app.getByLabel('Datum', { exact: true }).fill('2026-03-14');
      await app.getByLabel('Vorher zeigen (Tage)').fill('7'); await saveDate();
      check(await app.locator('#noteHost img').count() === 0, 'occasion is literal safe text');
      const created = (await stored()).entries.find(e => e.label?.includes('Einladung'));
      check(created.date === '2026-03-14' && !('month' in created), 'once saves a complete date');
      await app.locator('#personDateEdit').click(); await app.getByLabel('Jährlich', { exact: true }).check();
      await app.getByLabel('Tag', { exact: true }).fill('31'); await app.getByLabel('Monat', { exact: true }).selectOption('4');
      await app.locator('#personDateForm button[type="submit"]').click();
      await app.waitForSelector('.note-context-error');
      check((await stored()).entries.find(e => e.id === created.id).recurrence === 'once', 'April 31 cannot overwrite a saved date');
      await app.getByLabel('Tag', { exact: true }).fill('29'); await app.getByLabel('Monat', { exact: true }).selectOption('2'); await saveDate();
      const leap = (await stored()).entries.find(e => e.id === created.id);
      check(leap.month === 2 && leap.day === 29 && !('date' in leap) && leap.createdAt === created.createdAt, 'February 29 needs no year and edit preserves identity');
      await app.locator('#personDateEdit').click(); await app.getByLabel('Einmal', { exact: true }).check();
      await app.getByLabel('Datum', { exact: true }).fill('2026-03-14'); await saveDate();
      await home(); await app.waitForFunction(() => document.querySelectorAll('#nowRows [data-person-date]').length === 2);
      check(await app.locator('#nowRows [data-person-date]').count() === 2, 'two occasions remain two concrete cards');
      await app.clock.fastForward(6 * 86400000); await app.waitForFunction(() => document.querySelector('[data-person-date="d"] .now-primary')?.textContent === 'Geburtstag morgen');
      await app.clock.fastForward(86400000); await app.waitForFunction(() => document.querySelector('[data-person-date="d"] .now-primary')?.textContent === 'Geburtstag heute');
      await app.clock.fastForward(86400000); await app.waitForFunction(() => document.querySelectorAll('#nowRows [data-person-date]').length === 0);
      check(true, 'open dashboard changes tomorrow → today → expired at midnight');
      if (offline) {
        await app.reload(); await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
        check((await stored()).entries.some(e => e.id === created.id), 'edited date survives a real offline reload');
      }
      await person(); await app.locator(`[data-person-date="${created.id}"]`).click(); await app.locator('#personDateEdit').click();
      await app.locator('#personDateDelete').click(); await app.locator('#noteDeleteCancel').click();
      check((await stored()).entries.some(e => e.id === created.id), 'cancel single deletion retains entry');
      await app.locator('#personDateDelete').click(); await app.locator('#noteDeleteConfirm').click(); await app.locator('#personEdit').waitFor();
      check(!(await stored()).entries.some(e => e.id === created.id) && (await stored()).entries.length === 8, 'single deletion from editor returns to Person and preserves other entries');
      await app.locator('#personDateAdd').click();
      await app.getByLabel('Anlass', { exact: true }).fill('Jahrestag');
      await app.getByLabel('Tag', { exact: true }).fill('14');
      await app.getByLabel('Monat', { exact: true }).selectOption('3');
      await saveDate();
      const annual = (await stored()).entries.find(e => e.label === 'Jahrestag');
      check(annual.recurrence === 'yearly' && annual.day === 14 && annual.month === 3 && annual.showBeforeDays === 7 && !('date' in annual), 'create annual occasion without entering a year');
      await app.evaluate(async () => {
        const db = await import('/src/db.js'); const p = await db.get('people', 'p');
        await db.put('people', { ...p, name: 'LangerPersonenname'.repeat(20) });
      });
      await back(); await app.locator(`[data-person-date="${annual.id}"]`).click();
      await app.setViewportSize({ width: 320, height: 800 });
      await app.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'date detail wraps long person names at 320px and 200% text');
      await app.evaluate(async () => {
        document.documentElement.style.fontSize = '';
        const db = await import('/src/db.js'); const p = await db.get('people', 'p');
        await db.put('people', { ...p, name: 'Benjamin' });
      });
      await app.locator('#personDateDelete').click(); await app.locator('#noteDeleteConfirm').click(); await app.locator('#personEdit').waitFor();
      check(!(await stored()).entries.some(e => e.id === annual.id), 'single deletion from detail returns to Person');
      for (const theme of ['light', 'dark', 'signature']) {
        await app.evaluate(theme => { document.documentElement.dataset.theme = theme; document.documentElement.style.fontSize = '200%'; }, theme);
        await app.setViewportSize({ width: 320, height: 800 });
        for (const screen of ['person', 'name', 'date', 'delete']) {
          if (screen === 'name') await app.locator('#personEdit').click();
          if (screen === 'date') await app.locator('#personDateAdd').click();
          if (screen === 'delete') { await app.locator('#personDelete').click(); await app.locator('#noteDeleteDialog').waitFor(); }
          check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth && (!document.querySelector('dialog[open]') || document.querySelector('dialog[open]').scrollWidth <= document.querySelector('dialog[open]').clientWidth)), `${theme}: ${screen} fits 320px at 200% text`);
          if (screen === 'name' || screen === 'date') await back();
          if (screen === 'delete') await app.keyboard.press('Escape');
        }
      }
      await app.evaluate(() => { document.documentElement.style.fontSize = ''; });
      await app.locator('#personDelete').click(); await app.locator('#noteDeleteDialog').waitFor();
      check((await app.locator('#noteDeleteDescription').textContent()).includes('4 Notizen, 2 Geschenkideen, 1 wichtiges Datum'), 'delete dialog shows exact counts');
      check(await app.locator('#noteDeleteCancel').evaluate(node => node === document.activeElement), 'safe cancel action receives initial dialog focus');
      await app.keyboard.press('Escape');
      check((await stored()).entries.length === 8 && await app.locator('#personDelete').evaluate(node => node === document.activeElement), 'Escape preserves all data and restores focus');
      await app.evaluate(async () => {
        const db = await import('/src/db.js');
        await db.put('entries', { id: 'future', type: 'future-kind', personId: 'p', createdAt: 1 });
        const original = IDBCursor.prototype.delete;
        window.restoreDelete = () => { IDBCursor.prototype.delete = original; };
        IDBCursor.prototype.delete = function () { original.call(this); throw new Error('Simulated delete failure'); };
      });
      const preDelete = await stored();
      await app.locator('#personDelete').click(); await app.locator('#noteDeleteConfirm').click();
      await app.waitForFunction(() => document.querySelector('#noteDeleteError').textContent.includes('nicht gelöscht'));
      check(JSON.stringify(await stored()) === JSON.stringify(preDelete), 'aborted cascade rolls back person and every linked entry');
      await app.evaluate(() => window.restoreDelete());
      await app.locator('#noteDeleteConfirm').focus(); await app.keyboard.press('Enter');
      await app.waitForFunction(() => document.querySelector('#focusTitle').textContent === 'Personen'); await ready();
      const deleted = await stored();
      check(!deleted.people.some(p => p.id === 'p') && !deleted.entries.some(e => e.personId === 'p') && deleted.entries.length === 1, 'keyboard-confirmed cascade removes all known and future linked entries, keeps Anna');
      check(await app.locator('[data-person="p"]').count() === 0, 'people overview refreshes after deletion');
      check(await app.evaluate(async () => {
        const db = await import('/src/db.js');
        try { await db.put('entries', { id: 'orphan', type: 'person-note', personId: 'p', kind: 'gift', text: 'late save', createdAt: 1 }); return false; } catch { return !(await db.get('entries', 'orphan')); }
      }), 'late writes cannot recreate orphaned person entries');
      check(await app.evaluate(async stores => {
        const db = await import('/src/db.js'); await db.importAll({ schemaVersion: 2, stores });
        return JSON.stringify((await db.exportAll()).stores) === JSON.stringify(stores);
      }, before), 'real export/import roundtrip retains dates and older notes');
      check(errors.length === 0, `no browser errors: ${errors.join(', ')}`);
      check(requests.every(url => url.startsWith('http://127.0.0.1:8080/')) && !requests.some(url => url.includes('/leak')), 'no external or text-derived requests');
    } finally { await context.close(); }
  }
  return results;
}

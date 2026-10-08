// Person notes share the actual Notes UI and storage, with isolated test data only.
async (page) => {
  const results = [];
  for (const mode of ['light', 'dark']) {
    const context = await page.context().browser().newContext({ serviceWorkers: 'block', colorScheme: mode, timezoneId: 'Europe/Berlin', viewport: { width: 390, height: 844 } });
    const app = await context.newPage();
    const errors = [], requests = [];
    app.on('pageerror', error => errors.push(error.message));
    app.on('request', request => requests.push(request.url()));
    function check(condition, label) { if (!condition) throw new Error(`${mode}: ${label}`); results.push(`${mode}: ${label}`); }
    async function ready() { await app.waitForFunction(() => ['note', 'read'].every(name => document.querySelector(`#view-${name}`).hidden || !document.querySelector(name === 'note' ? '#noteHost' : '#readHost').hasAttribute('aria-busy')) && (document.querySelector('#quickComposer').hidden || !document.querySelector('#quickComposerBody').hasAttribute('aria-busy'))); }
    async function back() { await app.locator('#backButton').click(); await ready(); }
    async function home() { while (!await app.locator('#view-dashboard').isVisible()) await back(); }
    async function people() { await app.locator('#menuButton').click(); await app.locator('[data-view="people"]').click(); await ready(); }
    async function mama() { await people(); await app.locator('[data-person="mama"]').click(); await ready(); }
    async function stored(id) { return app.evaluate(async id => (await import('/src/db.js')).get('entries', id), id); }
    async function open(id) { await app.locator(`[data-note="${id}"]:visible`).click(); await app.waitForSelector('#noteEdit'); await ready(); }
    async function links(kind, ids, quick = false) {
      const prefix = quick ? '#quickNote' : '#note';
      await app.locator(prefix + (kind === 'placeIds' ? 'ChoosePlace' : 'ChooseTime')).click();
      const form = app.locator(prefix + 'ContextForm'); await form.waitFor(); await ready();
      for (const input of await form.locator('input').all()) if (ids.includes(await input.inputValue())) await input.check(); else await input.uncheck();
      await form.locator('button[type="submit"]').click(); await app.locator(prefix + 'ContextDone').waitFor(); await ready();
    }
    async function fits(label) { check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label); }
    async function shot(name) { await app.screenshot({ path: `/tmp/0815-person-notes-${mode}-${name}.png`, fullPage: true, animations: 'disabled' }); }
    await app.addInitScript(() => {
      const NativeDate = Date;
      window.personNow = NativeDate.parse('2026-10-04T17:30:00+02:00');
      window.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [window.personNow])); }
        static now() { return window.personNow; }
      };
      window.personGeoCalls = 0;
      Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition(success, failure) {
        window.personGeoCalls++;
        if (window.personGeoFail) failure({ message: 'test denied' });
        else success({ coords: { latitude: 50, longitude: 8, accuracy: 10 } });
      } } });
    });
    await app.route('**/src/db.js', async route => {
      const response = await route.fetch();
      const body = (await response.text())
        .replace('export function put(storeName, value) {', 'export function put(storeName, value) { if (storeName === "entries" && value.type === "person-note" && globalThis.personSaveFail) throw new Error("private test failure");')
        .replace('export function remove(storeName, id) {', 'export function remove(storeName, id) { if (globalThis.personDeleteFail) throw new Error("private test failure");')
        .replace('async function transaction(stores, mode, enqueue) {', 'async function transaction(stores, mode, enqueue) { if (mode === "readwrite" && globalThis.personSaveGate) await globalThis.personSaveGate;');
      await route.fulfill({ response, body });
    });
    try {
      await app.goto('http://127.0.0.1:8080/'); await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
      await app.evaluate(async () => {
        const db = await import('/src/db.js');
        for (const [id, name] of [['mama', 'Mama'], ['papa', 'Papa']]) await db.put('people', { id, name, createdAt: 1 });
        for (const [id, name, lat, lon] of [['mama-home', 'Bei Mama', 50, 8], ['office', 'Büro', 51, 9]]) await db.put('places', { id, name, lat, lon, radius: 250, createdAt: 1 });
        for (const [id, personId, kind, text] of [['old', 'mama', 'reference', 'Wie geht es deinem Garten?'], ['gift', 'mama', 'gift', 'Ein Buch'], ['papa-note', 'papa', 'reference', 'Fahrrad fragen']]) await db.put('entries', { id, type: 'person-note', personId, kind, text, createdAt: 1 });
        await db.put('entries', { id: 'plain', type: 'note', text: 'Ein freier Gedanke', createdAt: 1 });
      });
      const original = await stored('old'), papa = JSON.stringify(await stored('papa-note')), plain = JSON.stringify(await stored('plain'));
      await mama();
      check((await app.locator('#readHost h2').allTextContents()).join('|') === 'Wichtige Daten|Notizen|Geschenkideen', 'person page has clear, separate note and gift chapters');
      check(await app.locator('#readHost [data-note]').count() === 2 && await app.locator('#readHost [data-note="old"] .read-text').textContent() === original.text, 'old notes without context remain readable and openable');
      await app.locator('#readHost [data-note="old"]').focus(); await app.keyboard.press('Enter'); await app.waitForSelector('#noteEdit'); await ready();
      check(await app.locator('.note-detail .note-person-name').textContent() === 'Mama' && await app.locator('.note-text').textContent() === original.text, 'keyboard opens the shared detail with the person and question');
      check(await app.locator('#backButton').getAttribute('aria-label') === 'Zurück zu Mama', 'person-note detail keeps Mama as its parent');
      await app.locator('#noteEdit').click(); await ready(); await app.locator('#noteEditText').fill('Verwerfen'); await app.locator('#noteEditCancel').click(); await ready();
      check(JSON.stringify(await stored('old')) === JSON.stringify(original) && await app.locator('#noteEdit').evaluate(node => node === document.activeElement), 'Cancel preserves old data and restores edit action focus');
      await app.locator('#noteEdit').click(); await ready(); await app.locator('#noteEditText').fill(' '); await app.locator('#noteEditForm button[type="submit"]').click();
      check((await stored('old')).text === original.text && await app.locator('#noteEditText').isVisible(), 'blank person notes cannot be saved');
      await app.locator('#noteEditText').fill('Wie geht es deinen Rosen?');
      await app.evaluate(() => { window.personSaveFail = true; }); await app.locator('#noteEditForm button[type="submit"]').click();
      await app.waitForFunction(() => document.querySelector('#toast').textContent.includes('Deine Eingabe bleibt erhalten'));
      check((await stored('old')).text === original.text && await app.locator('#noteEditText').inputValue() === 'Wie geht es deinen Rosen?', 'failed text edits retain input and the original note');
      await app.evaluate(() => { window.personSaveFail = false; }); await app.locator('#noteEditForm button[type="submit"]').click(); await app.waitForSelector('#noteEdit'); await ready();
      const edited = await stored('old');
      check(edited.id === original.id && edited.personId === 'mama' && edited.kind === 'reference' && edited.createdAt === original.createdAt && edited.updatedAt === Date.parse('2026-10-04T17:30:00+02:00'), 'editing retains ID, person, kind and creation date and sets updatedAt');
      await app.locator('#noteContext').click(); await ready();
      await links('placeIds', ['office']); await links('placeIds', ['mama-home']);
      await links('timeBuckets', ['midday']); await links('timeBuckets', ['evening']);
      check(JSON.stringify((await stored('old')).context) === JSON.stringify({ placeIds: ['mama-home'], timeBuckets: ['evening'] }), 'place and time can both be added and replaced');
      await app.getByRole('button', { name: 'Bei Mama entfernen', exact: true }).click();
      await app.waitForFunction(async () => !(await (await import('/src/db.js')).get('entries', 'old')).context.placeIds.length); await ready();
      check((await stored('old')).context.timeBuckets.join() === 'evening', 'removing a place keeps the independent evening context');
      await app.getByRole('button', { name: 'abends · 15–22 Uhr entfernen', exact: true }).click();
      await app.waitForFunction(async () => !(await (await import('/src/db.js')).get('entries', 'old')).context.timeBuckets.length); await ready();
      check((await stored('old')).text === edited.text && (await stored('old')).updatedAt === edited.updatedAt, 'unlinking everything retains content and timestamps');
      await links('placeIds', ['mama-home']); await links('timeBuckets', ['evening']); await back();
      await app.locator('#noteEdit').click(); await ready(); await app.locator('#noteEditText').fill('Wie geht es deinen Rosen und Tomaten?'); await app.locator('#noteEditForm button[type="submit"]').click(); await app.waitForSelector('#noteEdit'); await ready();
      check((await stored('old')).context.placeIds.join() === 'mama-home' && (await stored('old')).context.timeBuckets.join() === 'evening', 'later editing preserves person-note context');
      await shot('detail'); await back();
      check(await app.locator('#readHost [data-note="old"]').evaluate(node => node === document.activeElement), 'detail Back restores Mama and focuses the selected entry');
      await shot('person'); await home(); await app.waitForFunction(() => document.querySelector('#nowRows [data-note="old"] .now-indicator')?.textContent === 'Bei Mama');
      check(await app.locator('#nowRows [data-note="old"] .note-person-name').textContent() === 'Mama' && await app.locator('#nowRows [data-note="old"] .now-indicator').textContent() === 'Bei Mama', 'a glance at Now shows Mama, her question and the matching place');
      const beforeOpen = JSON.stringify(await stored('old')); await open('old'); await back();
      check(JSON.stringify(await stored('old')) === beforeOpen && await app.locator('#view-dashboard').isVisible(), 'Now opening changes no data and Back returns to dashboard');
      await app.reload(); await app.waitForSelector('#nowRows [data-note="old"]');
      check(await app.evaluate(() => window.personGeoCalls === 1), 'person-only place context uses one existing shell geolocation query');
      await app.evaluate(() => { window.personGeoFail = true; }); await people(); await back();
      await app.waitForFunction(() => document.querySelector('#nowRows [data-note="old"] .now-indicator')?.textContent === 'abends · 15–22 Uhr');
      check(await app.locator('#nowRows [data-note="old"]').count() === 1, 'evening still matches when location is denied');
      await app.evaluate(() => { window.personNow = Date.parse('2026-10-04T09:00:00+02:00'); }); await people(); await back();
      await app.waitForFunction(() => !document.querySelector('#nowRows [data-note="old"]'));
      check(await app.locator('#nowRows [data-note="old"]').count() === 0, 'no place or time match hides the person note');
      await app.evaluate(() => { window.personGeoFail = false; }); await people(); await back(); await app.waitForSelector('#nowRows [data-note="old"]');
      check(await app.locator('#nowRows [data-note="old"] .now-indicator').textContent() === 'Bei Mama', 'being at Mama matches independently of time');
      await shot('now');

      await app.locator('[data-composer="person"]').click(); await app.locator('#personForm select').selectOption('mama'); await app.locator('#personForm textarea').fill('Was brauchst du vom Markt?');
      await app.evaluate(() => { window.personSaveGate = new Promise(resolve => { window.personReleaseSave = resolve; }); });
      await app.locator('#personForm button[type="submit"]').click();
      await app.waitForFunction(() => document.querySelector('#personForm')?.getAttribute('aria-busy') === 'true');
      check(await app.locator('#quickNoteContextDone').count() === 0 && await app.locator('#personForm button').isDisabled(), 'person capture waits for commit before offering context');
      await app.evaluate(() => { window.personSaveGate = null; window.personReleaseSave(); }); await app.waitForSelector('#quickNoteContextDone'); await ready();
      const quick = await app.evaluate(async () => (await (await import('/src/db.js')).list('entries', { prune: false })).find(note => note.text === 'Was brauchst du vom Markt?'));
      check(quick.personId === 'mama' && !quick.context, 'person capture fully saves the associated note first');
      await app.locator('#quickNoteChoosePlace').click(); await ready(); await app.locator('#quickNoteContextForm input[value="mama-home"]').check();
      await app.evaluate(() => { window.personSaveFail = true; }); await app.locator('#quickNoteContextForm button[type="submit"]').click();
      await app.waitForFunction(() => document.querySelector('#quickComposer .note-context-error')?.textContent.includes('Notiz gespeichert.'));
      check((await stored(quick.id)).text === quick.text && !(await stored(quick.id)).context && await app.locator('#quickNoteContextForm input[value="mama-home"]').isChecked(), 'failed capture context keeps the saved person note and retry selection');
      await app.evaluate(() => { window.personSaveFail = false; }); await app.locator('#quickNoteContextForm button[type="submit"]').click(); await app.waitForSelector('#quickNoteContextDone'); await ready();
      await links('timeBuckets', ['evening'], true); await app.locator('#quickNoteContextDone').click();
      check((await stored(quick.id)).context.placeIds.join() === 'mama-home' && (await stored(quick.id)).context.timeBuckets.join() === 'evening', 'capture uses the same place and time context UI');

      await mama(); await app.locator('[data-composer="person"]').click();
      check(await app.locator('#personForm select').inputValue() === 'mama' && await app.locator('#newPersonField').isHidden(), 'capture from Mama preselects her without asking for a new name');
      await app.locator('#personForm textarea').fill('Ein freier Gedanke zu Mama'); await app.locator('#personForm button').click(); await app.waitForSelector('#quickNoteContextDone'); await ready(); await app.locator('#quickNoteContextDone').click();
      check((await app.locator('#readHost .read-text').allTextContents()).includes('Ein freier Gedanke zu Mama'), 'capture on an open person page refreshes its notes without changing the parent');
      await open('gift');
      check(await app.locator('#focusTitle').textContent() === 'Geschenkidee', 'gift detail preserves its user-facing kind');
      await app.locator('#noteEdit').click(); await ready(); await app.locator('#noteEditText').fill('Ein Gartenbuch'); await app.locator('#noteEditForm button[type="submit"]').click(); await app.waitForSelector('#noteEdit'); await ready();
      check((await stored('gift')).kind === 'gift' && (await stored('gift')).personId === 'mama' && await app.locator('#noteDelete').textContent() === 'Geschenkidee löschen', 'gift edits keep association and use appropriate action labels');
      await back(); await home();
      await app.locator('[data-composer="person"]').click(); await app.locator('#personForm input[name="newName"]').fill('Tante'); await app.locator('#personForm textarea').fill('Wie war die Reise?'); await app.evaluate(() => { window.personSaveFail = true; }); await app.locator('#personForm button').click();
      await app.waitForFunction(() => document.querySelector('#toast').textContent.includes('Deine Eingabe bleibt erhalten'));
      await app.evaluate(() => { window.personSaveFail = false; }); await app.locator('#personForm button').click(); await app.waitForSelector('#quickNoteContextDone'); await ready(); await app.locator('#quickNoteContextDone').click();
      check(await app.evaluate(async () => (await (await import('/src/db.js')).list('people')).filter(person => person.name === 'Tante').length === 1), 'retrying new-person capture does not duplicate the saved person');

      await mama(); await open('old'); await app.locator('#noteDelete').click(); await app.locator('#noteDeleteCancel').click();
      check(!!(await stored('old')) && await app.locator('#noteDelete').evaluate(node => node === document.activeElement), 'Cancel retains a person note and restores detail focus');
      await app.locator('#noteDelete').click(); await app.evaluate(() => { window.personDeleteFail = true; }); await app.locator('#noteDeleteConfirm').click();
      await app.waitForFunction(() => document.querySelector('#noteDeleteError').textContent.includes('nicht gelöscht'));
      check(!!(await stored('old')) && await app.locator('#noteDeleteDialog').isVisible(), 'delete failure retains the person note and confirmation');
      await app.evaluate(() => { window.personDeleteFail = false; }); await app.locator('#noteDeleteConfirm').click(); await app.waitForSelector('#view-read'); await ready();
      check(!(await stored('old')) && await app.locator('#readHost [data-note="old"]').count() === 0 && await app.locator('#focusTitle').textContent() === 'Mama', 'confirmed deletion returns to Mama and removes the note from her page');
      await home(); await app.waitForSelector(`#nowRows [data-note="${quick.id}"]`); await open(quick.id); await app.locator('#noteDelete').click(); await app.locator('#noteDeleteConfirm').click(); await app.waitForSelector('#view-dashboard');
      await app.waitForFunction(id => !document.querySelector(`#nowRows [data-note="${id}"]`), quick.id);
      check(!(await stored(quick.id)) && await app.evaluate(async () => !!(await (await import('/src/db.js')).get('people', 'mama'))), 'Now deletion removes the entire contextual note while keeping Mama and dashboard parent');
      check(JSON.stringify(await stored('papa-note')) === papa && JSON.stringify(await stored('plain')) === plain, 'other people and plain notes remain unchanged');
      check(await app.evaluate(async () => {
        const db = await import('/src/db.js'); const payload = await db.exportAll(); const before = JSON.stringify(payload.stores);
        await db.importAll(payload); const after = await db.exportAll(); return JSON.stringify(after.stores) === before;
      }), 'real import/export preserves person notes and optional fields');
      await app.evaluate(async () => {
        const db = await import('/src/db.js'); await db.put('people', { id: 'long', name: '<img src="/leak">' + 'LangerPersonenname'.repeat(20), createdAt: 1 });
        await db.put('entries', { id: 'long-note', type: 'person-note', personId: 'long', kind: 'reference', text: '<script>window.xss=true</script>\n' + 'LangeFrage'.repeat(100), createdAt: Date.now(), context: { placeIds: ['mama-home'], timeBuckets: ['evening'] } });
      });
      await people(); await app.locator('[data-person="long"]').click(); await ready();
      await app.setViewportSize({ width: 1280, height: 900 }); await fits('person reading view fits desktop'); await shot('person-desktop');
      await app.setViewportSize({ width: 320, height: 700 }); const zoom = await app.addStyleTag({ content: ':root { font-size: 200%; }' }); await fits('long person names and notes fit 320 CSS px at 200% text');
      await open('long-note'); await fits('person-note detail fits 320 CSS px at 200% text'); await app.locator('#noteEdit').click(); await ready(); await fits('person-note editor fits enlarged text'); await back();
      await app.locator('#noteContext').click(); await ready(); await fits('person-note context fits enlarged text'); await back(); await app.locator('#noteDelete').click(); await fits('person-note delete dialog fits enlarged text'); await app.locator('#noteDeleteCancel').click(); await home(); await fits('person tiles fit enlarged text');
      await zoom.evaluate(node => node.remove()); await app.emulateMedia({ reducedMotion: 'reduce' }); await open('long-note');
      check(await app.locator('#noteHost').evaluate(node => getComputedStyle(node).animationName === 'none'), 'person notes honor Reduced Motion');
      check(await app.locator('#noteHost img, #noteHost script').count() === 0 && !await app.evaluate(() => window.xss), 'person names and notes are safe literal text');
      check(requests.every(url => url.startsWith('http://127.0.0.1:8080/')) && !requests.some(url => url.includes('/leak')), 'person notes request no external or unsafe resources');
      check(errors.length === 0, `no browser errors: ${errors.join(', ')}`);
    } finally { await context.close(); }
  }
  return results;
}

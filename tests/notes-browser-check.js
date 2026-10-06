// Real shell and IndexedDB; controlled time, geolocation and failures in isolated contexts.
async (page) => {
  const results = [];
  const check = (condition, label) => { if (!condition) throw new Error(label); results.push(label); };
  for (const mode of ['light', 'dark']) {
    const context = await page.context().browser().newContext({ serviceWorkers: 'block', colorScheme: mode, timezoneId: 'Europe/Berlin', viewport: { width: 390, height: 844 } });
    const app = await context.newPage();
    const errors = [], requests = [];
    app.on('pageerror', error => errors.push(error.message));
    app.on('request', request => requests.push(request.url()));
    const assert = (condition, label) => check(condition, `${mode}: ${label}`);
    async function ready() { await app.waitForFunction(() => (document.querySelector('#view-note').hidden || !document.querySelector('#noteHost').hasAttribute('aria-busy')) && (document.querySelector('#view-read').hidden || !document.querySelector('#readHost').hasAttribute('aria-busy')) && (document.querySelector('#quickComposer').hidden || !document.querySelector('#quickComposerBody').hasAttribute('aria-busy'))); }
    async function menu() { await app.locator('#menuButton').click(); await app.locator('[data-view="notes"]').click(); await ready(); }
    async function back() { await app.locator('#backButton').click(); await ready(); }
    async function home() { while (!await app.locator('#view-dashboard').isVisible()) await back(); }
    async function stored(id) { return app.evaluate(async id => (await import('/src/db.js')).get('entries', id), id); }
    async function entries() { return app.evaluate(async () => (await import('/src/db.js')).list('entries', { prune: false })); }
    async function open(id) { await app.locator(`[data-note="${id}"]:visible`).click(); await app.waitForSelector('#noteEdit'); await ready(); }
    async function link(kind, ids) {
      const prefix = await app.locator('#quickComposer').isVisible() ? '#quickNote' : '#note';
      await app.locator(prefix + (kind === 'placeIds' ? 'ChoosePlace' : 'ChooseTime')).click();
      const form = app.locator(prefix + 'ContextForm');
      await form.waitFor(); await ready();
      for (const input of await form.locator('input').all()) {
        if (ids.includes(await input.inputValue())) await input.check(); else await input.uncheck();
      }
      await form.locator('button[type="submit"]').click();
      await app.locator(prefix + 'ContextDone').waitFor(); await ready();
    }
    async function fits(label) { assert(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label); }
    async function shot(name) { await app.screenshot({ path: `/tmp/0815-notes-${mode}-${name}.png`, fullPage: true, animations: 'disabled' }); }
    await app.addInitScript(() => {
      const NativeDate = Date;
      window.notesNow = NativeDate.parse('2026-10-03T12:00:00+02:00');
      window.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [window.notesNow])); }
        static now() { return window.notesNow; }
      };
      window.notesGeo = { latitude: 50, longitude: 8, accuracy: 10 };
      window.notesGeoCalls = 0;
      Object.defineProperty(navigator, 'geolocation', { value: {
        getCurrentPosition(success, failure) {
          window.notesGeoCalls++;
          if (window.notesGeoFail) failure({ message: 'test denied' });
          else success({ coords: window.notesGeo });
        }
      } });
    });
    await app.route('**/src/db.js', async route => {
      const response = await route.fetch();
      const body = (await response.text())
        .replace('async function transaction(stores, mode, enqueue) {', 'async function transaction(stores, mode, enqueue) { if (mode === "readwrite" && globalThis.notesSaveGate) await globalThis.notesSaveGate;')
        .replace('export function put(storeName, value) {', 'export function put(storeName, value) { if (storeName === "entries" && value.type === "note" && globalThis.notesPutFailure) throw new Error("Private test failure");')
        .replace('export function remove(storeName, id) {', 'export function remove(storeName, id) { if (globalThis.notesDeleteFailure) throw new Error("Private test failure");')
        .replace('export async function get(storeName, id) {', 'export async function get(storeName, id) { if (globalThis.notesReadGate && storeName === "entries") await globalThis.notesReadGate;');
      await route.fulfill({ response, body });
    });
    try {
      await app.goto('http://127.0.0.1:8080/');
      await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
      assert(await app.evaluate(() => window.notesGeoCalls === 0), 'plain notes and helpers without place rules request no location');
      await app.evaluate(async () => {
        const db = await import('/src/db.js');
        await db.put('places', { id: 'office', name: 'Büro', lat: 50, lon: 8, radius: 250, createdAt: 1 });
        await db.put('places', { id: 'shop', name: 'Supermarkt', lat: 51, lon: 9, radius: 250, createdAt: 1 });
        await db.put('entries', { id: 'legacy', type: 'note', text: 'Ein alter Gedanke.\nZweite Zeile.', createdAt: Date.now() - 86400000 });
        await db.put('entries', { id: 'other', type: 'note', text: 'Bleibt unverändert.', createdAt: 1 });
      });
      const other = JSON.stringify(await stored('other'));
      const legacy = await stored('legacy');

      await app.locator('[data-composer="note"]').click();
      await app.locator('#noteText').fill('Schnell festgehalten.');
      await app.evaluate(() => { window.notesSaveGate = new Promise(resolve => { window.notesReleaseSave = resolve; }); });
      await app.locator('#noteForm button').click();
      await app.waitForFunction(() => document.querySelector('#noteForm')?.getAttribute('aria-busy') === 'true');
      assert(await app.locator('#noteForm button').isDisabled() && await app.locator('#quickNoteContextDone').count() === 0 && (await entries()).length === 2, 'follow-up waits for commit and repeated capture is locked');
      await app.evaluate(() => { window.notesSaveGate = null; window.notesReleaseSave(); });
      await app.waitForSelector('#quickNoteContextDone'); await ready();
      const captured = (await entries()).find(note => note.text === 'Schnell festgehalten.');
      assert(!!captured && !captured.context && await app.locator('#quickComposerTitle').textContent() === 'Gespeichert', 'capture is completely saved before optional context');
      assert(await app.locator('#noteFollowupTitle').evaluate(node => node === document.activeElement), 'saved follow-up receives focus');
      await shot('capture');
      await app.locator('#quickNoteContextDone').click();
      assert(await app.locator('#quickComposer').isHidden() && await app.locator('[data-composer="note"]').evaluate(node => node === document.activeElement) && !(await stored(captured.id)).context, 'Done finishes immediately without context and restores footer focus');

      await app.locator('[data-composer="note"]').click();
      await app.locator('#noteText').fill('Peter zurückrufen.'); await app.locator('#noteForm button').click();
      await app.waitForSelector('#quickNoteContextDone'); await ready();
      const quick = (await entries()).find(note => note.text === 'Peter zurückrufen.');
      await app.locator('#quickNoteChoosePlace').click(); await ready();
      await app.locator('#quickNoteContextForm input[value="office"]').check();
      await app.evaluate(() => { window.notesPutFailure = true; });
      await app.locator('#quickNoteContextForm button[type="submit"]').click();
      await app.waitForFunction(() => document.querySelector('#quickComposer .note-context-error')?.textContent === 'Notiz gespeichert. Verknüpfung konnte nicht gespeichert werden.');
      assert((await stored(quick.id)).text === quick.text && !(await stored(quick.id)).context && await app.locator('#quickNoteContextForm input[value="office"]').isChecked(), 'context failure retains saved note, selected context and retry');
      await app.evaluate(() => { window.notesPutFailure = false; });
      await app.locator('#quickNoteContextForm button[type="submit"]').click();
      await app.waitForSelector('#quickNoteContextDone'); await ready();
      await link('timeBuckets', ['midday']);
      assert(JSON.stringify((await stored(quick.id)).context) === JSON.stringify({ placeIds: ['office'], timeBuckets: ['midday'] }), 'both context types can be set directly after capture');
      await app.locator('#quickNoteContextDone').click();

      await menu();
      assert(await app.locator('[data-note="legacy"] .read-text').textContent() === legacy.text, 'old note without optional fields is displayed');
      await app.locator('[data-note="legacy"]').focus(); await app.keyboard.press('Enter');
      await app.waitForSelector('#noteEdit'); await ready();
      assert(await app.locator('.note-text').textContent() === legacy.text && await app.locator('#focusTitle').evaluate(node => node === document.activeElement), 'keyboard opens legacy detail and focuses its heading');
      assert(await app.locator('#backButton').getAttribute('aria-label') === 'Zurück zu Notizen', 'detail preserves the notes parent');
      await app.locator('#noteEdit').click(); await app.waitForSelector('#noteEditText'); await ready();
      assert(await app.locator('#noteEditText').evaluate(node => node === document.activeElement), 'editing focuses its text field');
      await app.locator('#noteEditText').fill('Nicht speichern.'); await app.locator('#noteEditCancel').click();
      await app.waitForSelector('#noteEdit'); await ready();
      assert(JSON.stringify(await stored('legacy')) === JSON.stringify(legacy) && await app.locator('#noteEdit').evaluate(node => node === document.activeElement), 'Cancel discards edits and restores the detail action focus');
      await app.locator('#noteEdit').click(); await ready();
      await app.locator('#noteEditText').fill('Zurück verwirft.'); await back();
      assert(JSON.stringify(await stored('legacy')) === JSON.stringify(legacy), 'header Back from Edit returns to unchanged detail');
      await app.locator('#noteEdit').click(); await ready();
      await app.locator('#noteEditText').fill('   '); await app.locator('#noteEditForm button[type="submit"]').click();
      assert((await stored('legacy')).text === legacy.text && await app.locator('#noteEditText').isVisible(), 'blank edits cannot be saved');
      await app.locator('#noteEditText').fill('Geschenk für Anna ansehen.');
      await app.evaluate(() => { window.notesPutFailure = true; });
      await app.locator('#noteEditForm button[type="submit"]').click();
      await app.waitForFunction(() => document.querySelector('#toast').textContent.includes('Deine Eingabe bleibt erhalten'));
      assert((await stored('legacy')).text === legacy.text && await app.locator('#noteEditText').inputValue() === 'Geschenk für Anna ansehen.', 'failed edits preserve original data and entered text');
      await app.evaluate(() => { window.notesPutFailure = false; });
      await app.locator('#noteEditForm button[type="submit"]').click(); await app.waitForSelector('#noteEdit'); await ready();
      const edited = await stored('legacy');
      assert(edited.id === legacy.id && edited.createdAt === legacy.createdAt && edited.updatedAt === Date.parse('2026-10-03T12:00:00+02:00') && edited.text === 'Geschenk für Anna ansehen.', 'text edit updates the same legacy note and preserves creation time');
      assert((await app.locator('.note-dates').textContent()).includes('Bearbeitet'), 'editing timestamp is secondary and visible');

      await app.locator('#noteContext').click(); await ready();
      await link('placeIds', ['office']);
      await link('placeIds', ['shop']);
      assert((await stored('legacy')).context.placeIds.join() === 'shop', 'existing place can be replaced');
      await link('timeBuckets', ['midday']);
      await link('timeBuckets', ['evening']);
      assert((await stored('legacy')).context.timeBuckets.join() === 'evening', 'existing time can be replaced');
      await app.getByRole('button', { name: 'Supermarkt entfernen', exact: true }).click(); await ready();
      await app.waitForFunction(async () => !(await (await import('/src/db.js')).get('entries', 'legacy')).context.placeIds.length);
      assert((await stored('legacy')).context.timeBuckets.join() === 'evening', 'unlinking place retains the independent time context');
      await app.getByRole('button', { name: 'abends · 15–22 Uhr entfernen', exact: true }).click();
      await app.waitForFunction(async () => !(await (await import('/src/db.js')).get('entries', 'legacy')).context.timeBuckets.length); await ready();
      assert((await stored('legacy')).createdAt === legacy.createdAt && (await stored('legacy')).updatedAt === edited.updatedAt && (await stored('legacy')).text === edited.text, 'unlinking both contexts retains text and both timestamps');
      await link('placeIds', ['office']); await link('timeBuckets', ['midday']);
      await app.locator('#noteChoosePlace').click(); await ready(); await back();
      assert(await app.locator('#noteContextDone').isVisible(), 'Back from a context choice returns to context overview');
      await app.locator('[data-composer="note"]').click();
      await app.locator('#noteText').fill('Nebenbei festgehalten.');
      await app.locator('#noteForm button').click(); await app.waitForSelector('#quickNoteContextDone'); await ready();
      const uniqueIds = await app.evaluate(() => {
        const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
        return ids.length === new Set(ids).size;
      });
      await app.locator('#quickNoteContextDone').click();
      assert(uniqueIds && await app.locator('#noteContextDone').isVisible(), 'capture on an existing context view uses unique IDs and preserves its parent');
      await back();
      assert(await app.locator('#noteContext').evaluate(node => node === document.activeElement), 'Back from context returns to detail and restores action focus');
      await app.locator('#noteEdit').click(); await ready(); await app.locator('#noteEditText').fill('Geschenk für Anna prüfen.');
      await app.locator('#noteEditForm button[type="submit"]').click(); await app.waitForSelector('#noteEdit'); await ready();
      assert(JSON.stringify((await stored('legacy')).context) === JSON.stringify({ placeIds: ['office'], timeBuckets: ['midday'] }), 'later text editing keeps both context kinds');
      await shot('detail');
      await back();
      assert(await app.locator('[data-note="legacy"]:visible').evaluate(node => node === document.activeElement), 'detail Back restores its list item focus');
      await shot('read');
      await home();
      await app.waitForSelector('#nowRows [data-note="legacy"]');
      await open('legacy');
      assert(await app.locator('#backButton').getAttribute('aria-label') === 'Zurück zur Startseite', 'Now detail uses the dashboard parent');
      const viewed = JSON.stringify(await stored('legacy')); await back();
      assert(JSON.stringify(await stored('legacy')) === viewed, 'opening a resurfaced note changes no data or context');

      // Isolate matching and ordering without changing helpers or their contract.
      await app.evaluate(async () => {
        const db = await import('/src/db.js');
        for (const note of await db.list('entries', { prune: false })) if (note.type === 'note' && note.context) await db.put('entries', { ...note, context: { placeIds: [], timeBuckets: [] } });
        for (const [id, age, context] of [
          ['now-place', 100, { placeIds: ['office'] }],
          ['now-time', 1, { timeBuckets: ['midday'] }],
          ['now-or', 2, { placeIds: ['shop'], timeBuckets: ['midday'] }],
          ['now-neither', 0, { placeIds: ['shop'], timeBuckets: ['night'] }]
        ]) await db.put('entries', { id, type: 'note', text: id, createdAt: Date.now() - age * 1000, context });
      });
      await menu(); await back();
      await app.waitForFunction(() => [...document.querySelectorAll('#nowRows [data-note]')].map(node => node.dataset.note).join() === 'now-place,now-time,now-or');
      assert((await app.locator('#nowRows [data-note]').first().getAttribute('class')) === 'note-tile', 'notes have a separate editorial tile style');
      assert(await app.locator('#nowRows [data-note="now-place"] .note-tile-context').textContent() === 'Büro', 'matched place is the note tile context');
      await shot('now');
      await app.evaluate(() => { window.notesGeoFail = true; }); await menu(); await back();
      await app.waitForFunction(() => [...document.querySelectorAll('#nowRows [data-note]')].map(node => node.dataset.note).join() === 'now-time,now-or');
      assert(await app.locator('#nowRows [data-note="now-or"]').count() === 1, 'denied location still allows matching time through OR');
      await app.evaluate(() => { window.notesNow = Date.parse('2026-10-03T08:00:00+02:00'); }); await menu(); await back();
      await app.waitForFunction(() => !document.querySelector('#nowRows [data-note]'));
      assert(await app.locator('#nowRows [data-note]').count() === 0, 'neither matching location nor matching time shows no note');
      await app.evaluate(() => { window.notesGeoFail = false; }); await menu(); await back();
      await app.waitForFunction(() => [...document.querySelectorAll('#nowRows [data-note]')].map(node => node.dataset.note).join() === 'now-place');
      assert(await app.locator('#nowRows [data-note="now-place"]').count() === 1, 'matching location works without matching time');
      await open('now-place'); await app.locator('#noteContext').click(); await ready();
      await app.getByRole('button', { name: 'Büro entfernen', exact: true }).click();
      await app.waitForFunction(async () => !(await (await import('/src/db.js')).get('entries', 'now-place')).context.placeIds.length); await ready();
      await home(); await app.waitForFunction(() => !document.querySelector('#nowRows [data-note]'));
      assert(await app.locator('#nowRows [data-note]').count() === 0, 'unlink immediately removes context relevance');

      await app.evaluate(async () => {
        const db = await import('/src/db.js');
        window.notesNow = Date.parse('2026-10-03T12:00:00+02:00');
        for (const helper of ['pain', 'drink', 'discount']) await db.put('helperRules', { id: helper, visible: false });
        for (let index = 0; index < 12; index++) await db.put('entries', { id: `cap-${index}`, type: 'note', text: `Gedanke ${index}`, createdAt: Date.now() + index, context: { timeBuckets: ['midday'] } });
      });
      await menu(); await back(); await app.waitForFunction(() => document.querySelectorAll('#nowRows [data-note^="cap-"]').length === 12);
      assert((await app.locator('#nowRows [data-note^="cap-"]').evaluateAll(nodes => nodes.map(node => node.dataset.note))).join() === 'cap-11,cap-10,cap-9,cap-8,cap-7,cap-6,cap-5,cap-4,cap-3,cap-2,cap-1,cap-0', 'Now works without visible helpers, newest first, without silently truncating relevant notes');

      await open('cap-11'); await app.locator('#noteDelete').click();
      assert(await app.locator('#noteDeleteDialog').isVisible() && !!(await stored('cap-11')) && await app.locator('#noteDeleteCancel').evaluate(node => node === document.activeElement), 'delete requires a semantic modal and focuses Cancel');
      await app.keyboard.press('Tab');
      assert(await app.locator('#noteDeleteConfirm').evaluate(node => node === document.activeElement), 'Tab stays within dialog actions');
      await app.keyboard.press('Shift+Tab');
      assert(await app.locator('#noteDeleteCancel').evaluate(node => node === document.activeElement), 'Shift+Tab returns to Cancel within the native modal');
      await app.keyboard.press('Escape');
      assert(!!(await stored('cap-11')) && await app.locator('#noteDelete').evaluate(node => node === document.activeElement), 'Escape cancels deletion and restores detail focus');
      await app.locator('#noteDelete').click(); await app.locator('#noteDeleteCancel').click();
      assert(!!(await stored('cap-11')), 'explicit Cancel preserves the note');
      await app.locator('#noteDelete').click(); await app.evaluate(() => { window.notesDeleteFailure = true; });
      await app.locator('#noteDeleteConfirm').click();
      await app.waitForFunction(() => document.querySelector('#noteDeleteError').textContent.includes('nicht gelöscht'));
      assert(!!(await stored('cap-11')) && await app.locator('#noteDeleteDialog').isVisible() && await app.locator('#noteDeleteConfirm').isEnabled(), 'delete failure retains data and detail with retry');
      await app.evaluate(() => { window.notesDeleteFailure = false; }); await app.locator('#noteDeleteConfirm').click();
      await app.waitForSelector('#view-dashboard');
      await app.waitForFunction(() => !document.querySelector('#nowRows [data-note="cap-11"]'));
      assert(!(await stored('cap-11')) && await app.locator('#noteDeleteDialog').isHidden(), 'confirmed Now deletion removes context together with note and returns to dashboard');
      await menu(); await open('legacy'); await app.locator('#noteDelete').click(); await app.locator('#noteDeleteConfirm').click();
      await app.waitForSelector('#view-read'); await ready();
      assert(!(await stored('legacy')) && await app.locator('#readHost [data-note="legacy"]').count() === 0 && await app.locator('#focusTitle').textContent() === 'Notizen', 'deleting from READ returns to notes and removes the entry');
      assert(JSON.stringify(await stored('other')) === other, 'editing, context and deleting leave other notes unchanged');

      // The generic local export/import keeps optional fields, including old notes.
      assert(await app.evaluate(async () => {
        const db = await import('/src/db.js');
        const note = { ...(await db.get('entries', 'cap-10')), updatedAt: Date.now() };
        await db.put('entries', note);
        const exported = await db.exportAll();
        await db.importAll(exported);
        return JSON.stringify(await db.get('entries', note.id)) === JSON.stringify(note) && !(await db.get('entries', 'other')).context?.placeIds.length;
      }), 'real export/import retains updatedAt, contexts and old records');

      await app.evaluate(async () => {
        const db = await import('/src/db.js');
        await db.put('places', { id: 'long-place', name: '<img src="/leak">' + 'LangerOrtsname'.repeat(20), lat: 50, lon: 8, radius: 250, createdAt: 1 });
        await db.put('entries', { id: 'long-note', type: 'note', text: '<script>window.xss=true</script>\n' + 'LangerNotiztext'.repeat(100), createdAt: Date.now() + 100, context: { placeIds: ['long-place'], timeBuckets: ['midday'] } });
      });
      await home(); await menu();
      await app.setViewportSize({ width: 1280, height: 900 }); await fits('notes reading measure fits desktop'); await shot('read-desktop');
      await app.setViewportSize({ width: 320, height: 700 });
      const zoom = await app.addStyleTag({ content: ':root { font-size: 200%; }' });
      await fits('long notes and context fit 320 CSS px at 200% text');
      await open('long-note'); await fits('long detail fits 320 CSS px at 200% text');
      await app.locator('#noteEdit').click(); await ready(); await fits('edit fits 320 CSS px at 200% text'); await back();
      await app.locator('#noteContext').click(); await ready(); await fits('context fits 320 CSS px at 200% text');
      await app.locator('#noteChoosePlace').click(); await ready(); await fits('long context selection fits 320 CSS px at 200% text'); await back(); await back();
      await app.locator('#noteDelete').click(); await fits('delete modal fits 320 CSS px at 200% text');
      await app.locator('#noteDeleteCancel').click(); await home(); await fits('Now fits 320 CSS px at 200% text');
      await app.locator('[data-composer="note"]').click(); await app.locator('#noteText').fill('Vergrößert gespeichert.'); await app.locator('#noteForm button').click();
      await app.waitForSelector('#quickNoteContextDone'); await ready(); await app.setViewportSize({ width: 320, height: 480 });
      await app.locator('#quickNoteContextDone').focus(); await fits('follow-up fits short viewport with enlarged text');
      assert(await app.locator('#quickNoteContextDone').evaluate(node => node.getBoundingClientRect().bottom <= document.querySelector('.action-footer').getBoundingClientRect().top), 'follow-up Done remains reachable above the footer');
      await app.locator('#quickNoteContextDone').click(); await zoom.evaluate(node => node.remove());
      await app.setViewportSize({ width: 390, height: 844 });
      await app.emulateMedia({ reducedMotion: 'reduce' }); await menu(); await open('long-note');
      assert(await app.locator('#noteHost').evaluate(node => getComputedStyle(node).animationName === 'none'), 'Reduced Motion removes note view animation');
      assert(await app.locator('#noteHost img, #noteHost script').count() === 0 && !await app.evaluate(() => window.xss), 'note text and context remain literal text');
      await home(); await menu();
      await app.evaluate(() => { window.notesReadGate = new Promise(resolve => { window.notesReleaseRead = resolve; }); });
      await app.locator('[data-note="long-note"]:visible').click();
      await app.waitForFunction(() => document.querySelector('#noteHost').hasAttribute('aria-busy'));
      await back(); await app.evaluate(() => { window.notesReadGate = null; window.notesReleaseRead(); });
      assert(await app.locator('#view-read').isVisible() && await app.locator('#focusTitle').textContent() === 'Notizen', 'late detail reads cannot replace their parent after Back');
      assert(requests.every(url => url.startsWith('http://127.0.0.1:8080/')) && !requests.some(url => url.includes('/leak')), 'notes make no external or unsafe content requests');
      assert(errors.length === 0, `no browser errors: ${errors.join(', ')}`);
    } finally { await context.close(); }
  }
  return results;
}

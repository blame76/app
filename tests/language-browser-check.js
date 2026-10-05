// UI feedback and context labels; real IndexedDB, isolated registry fixtures.
// Run through the supplied browser tool, without adding a project dependency.
// newContext() starts with empty, nonpersistent storage; no user profile or storageState
// is supplied. All writes/import replacements affect this test's own seeded records.
// The context is closed in finally, including on failure. No existing app data is used.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 700 } });
  const app = await context.newPage();
  const results = [];
  const errors = [];
  const requests = [];
  app.on('pageerror', error => errors.push(error.message));
  app.on('request', request => requests.push(request.url()));
  app.on('dialog', dialog => dialog.accept());
  function check(condition, label) { if (!condition) throw new Error(label); results.push(label); }
  async function entries() { return app.evaluate(async () => (await import('/src/db.js')).list('entries')); }
  async function feedback(text) { await app.waitForFunction(text => document.querySelector('#toast').textContent === text, text); }
  async function reflow(label) { check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label); }
  async function tileText(label) {
    check(await app.locator('.helper-tile:visible').evaluateAll(elements => elements.every(element => {
      const bounds = element.getBoundingClientRect();
      return [...element.children].every(child => {
        const text = child.getBoundingClientRect();
        return text.left >= bounds.left && text.right <= bounds.right && text.top >= bounds.top && text.bottom <= bounds.bottom;
      });
    })), label);
  }
  await app.route('**/src/helpers/registry.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    export const HELPERS = [
      ['place', 'Ortshelfer'], ['interval', 'EineLangeHelferanwendung'], ['time', 'Tageszeit'], ['used', 'Letzte Nutzung']
    ].map(([id, label]) => ({ id, label, category: 'Test', contexts: ['place', 'time', 'interval'], mount({ root }) { root.textContent = 'Testansicht'; } }));
  ` }));
  await app.addInitScript(() => {
    window.geoCalls = 0;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition(success, failure, options) {
        window.geoCalls++;
        window.geoOptions = options;
        if (window.geoFail) failure({ message: 'INTERNAL geolocation exception' });
        else success({ coords: { latitude: 50, longitude: 8, accuracy: 10 } });
      }
    } });
  });
  try {
    await app.goto('http://127.0.0.1:8080/');
    await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
    check(await app.locator('#nowRows').textContent() === '' && await app.locator('#favoriteTiles').textContent() === '', 'Empty Jetzt and Favoriten remain silent');
    check((await app.locator('#view-dashboard').ariaSnapshot()).includes('heading "Startseite"'), 'Dashboard retains its accessible page heading');
    await app.evaluate(async () => {
      const db = await import('/src/db.js');
      await db.put('places', { id: 'waterfront', name: 'Waterfront', lat: 50, lon: 8, radius: 250, createdAt: 1 });
      await db.put('helperRules', { id: 'place', favorite: true, placeIds: ['waterfront'] });
      await db.put('helperRules', { id: 'interval', intervalMinutes: 60, toleranceMinutes: 15 });
      await db.put('helperRules', { id: 'time', timeBuckets: ['morning', 'midday', 'evening', 'night'] });
      await db.put('settings', { id: 'usage:interval', lastUsedAt: Date.now() - 50 * 60000 });
      await db.put('settings', { id: 'usage:used', lastUsedAt: Date.now() - 60000 });
    });
    await app.reload();
    await app.waitForSelector('#nowRows [data-helper="used"]');
    check((await app.locator('#nowRows [data-helper]').evaluateAll(elements => elements.map(element => element.dataset.helper))).join(',') === 'place,interval,time,used', 'Place, interval, time and usage keep their existing priority');
    check(await app.locator('#nowRows [data-helper="place"] span').textContent() === 'Waterfront', 'Location reason names the matched stored place');
    check(await app.locator('#nowRows [data-helper="interval"] span').textContent() === 'Intervall · 60 Min.', 'Interval reason stays factual while the existing tolerance makes it due');
    check(await app.locator('#nowRows [data-helper="time"] span').textContent() === await app.evaluate(async () => { const ctx = await import('/src/context.js'); return ctx.timeBucketLabel(ctx.timeBucket()); }), 'Time reason still names the current time bucket');
    check(await app.locator('#nowRows [data-helper="used"] span').textContent() === 'zuletzt verwendet', 'Usage reason describes recorded use');
    check(await app.evaluate(() => window.geoCalls === 1 && window.geoOptions.maximumAge === 0), 'Context uses one fresh location query to avoid stale place matches');
    check(await app.locator('#nowRows [data-helper="place"]').evaluate(element => {
      const box = element.getBoundingClientRect();
      return box.width < 160 && box.height / box.width < 1.6 && box.height >= 48;
    }), 'Jetzt uses compact object proportions at 320 CSS px');
    check(await app.locator('#nowRows [data-helper="place"]').evaluate(element => parseFloat(getComputedStyle(element.querySelector('strong')).fontSize) > parseFloat(getComputedStyle(element.querySelector('span')).fontSize)), 'Helper name takes priority over its reason');
    await reflow('Several helpers and a long name fit 320 CSS px');
    await tileText('Long helper names and reasons stay inside their own tile');
    await app.getByText('Favoriten', { exact: true }).click();
    check(await app.locator('#favoriteTiles [data-helper="place"]').isVisible() && await app.locator('#favoriteTiles span').count() === 0, 'Favorites keep the object form without inventing a reason');
    await app.screenshot({ path: '/tmp/0815-language-dashboard-320.png', fullPage: true });
    await app.setViewportSize({ width: 1280, height: 900 });
    await app.screenshot({ path: '/tmp/0815-language-dashboard-1280.png', fullPage: true });
    await app.setViewportSize({ width: 320, height: 700 });
    await app.getByText('Alle Helfer', { exact: true }).click();
    await app.locator('#helperSearch').fill('kein Treffer');
    await app.waitForFunction(() => document.querySelector('#allHelperList').textContent === 'Keine Helfer gefunden.');
    check(await app.locator('#helperToolbar').isVisible(), 'No search result leaves filters available');
    await app.locator('#helperSearch').fill('');
    await app.waitForSelector('#allHelperList [data-helper="place"]');
    await app.evaluate(async () => {
      const db = await import('/src/db.js');
      await db.put('places', { ...(await db.get('places', 'waterfront')), name: '<img src="/leak" onerror="window.xss=true">' });
    });
    await app.reload();
    await app.waitForSelector('#nowRows [data-helper="place"]');
    check((await app.locator('#nowRows [data-helper="place"] span').textContent()).startsWith('<img') && await app.locator('#nowRows img').count() === 0 && !requests.some(url => url.includes('/leak')), 'Stored context names remain literal text without resource requests');
    await reflow('Long stored context reason fits 320 CSS px');
    const enlargedText = await app.addStyleTag({ content: ':root { font-size: 200%; }' });
    await reflow('Long helper names and reasons reflow with 200% text at 320 CSS px');
    await tileText('Enlarged long names and reasons stay inside their own tile');
    await enlargedText.evaluate(element => element.remove());

    await app.locator('[data-composer="place"]').click();
    await app.waitForFunction(() => document.querySelector('#placeStatus').textContent.startsWith('Standort bereit. Gemeldete Genauigkeit:'));
    check(await app.evaluate(() => window.geoOptions.maximumAge === 0), 'Place composer keeps its fresh location query');
    await app.locator('#placeForm input').fill('Neuer Ort');
    await app.locator('#placeForm button').click();
    await feedback('Ort gespeichert.');
    check(await app.evaluate(async () => (await (await import('/src/db.js')).list('places')).some(place => place.name === 'Neuer Ort' && place.lat === 50 && place.lon === 8 && place.radius === 250)), 'Place success corresponds to stored coordinates and name');
    await app.evaluate(() => { window.geoFail = true; });
    await app.locator('[data-composer="place"]').click();
    await app.waitForFunction(() => document.querySelector('#placeStatus').textContent.includes('Standort nicht verfügbar.'));
    check(!(await app.locator('#placeStatus').textContent()).includes('INTERNAL') && await app.locator('#placeForm button').isDisabled(), 'Location failure gives a usable message and keeps save disabled');
    await app.locator('#quickComposerClose').click();

    await app.locator('[data-composer="note"]').click();
    await app.locator('#noteText').fill('Eingabe bleibt');
    await app.evaluate(() => { window.originalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function() { throw new Error('INTERNAL helperId entryVersion transaction'); }; });
    await app.locator('#noteForm button').click();
    await feedback('Konnte nicht gespeichert werden. Deine Eingabe bleibt erhalten. Bitte erneut versuchen.');
    check(await app.locator('#noteText').inputValue() === 'Eingabe bleibt' && (await entries()).length === 0, 'Storage exception is hidden, with unchanged data and retained input');
    await app.evaluate(() => { IDBObjectStore.prototype.put = window.originalPut; });
    await app.locator('#noteForm button').click();
    await app.waitForSelector('#quickNoteContextDone');
    check(await app.locator('#quickComposerTitle').textContent() === 'Gespeichert', 'Committed capture reports success in its follow-up');
    check((await entries()).some(entry => entry.type === 'note' && entry.text === 'Eingabe bleibt'), 'Retry saves the retained note');

    await app.locator('[data-composer="person"]').click();
    await app.waitForSelector('#personForm');
    await app.locator('#personForm textarea').fill('Eine Notiz');
    await app.locator('#personForm button').click();
    await feedback('Bitte einen Namen angeben.');
    check(await app.locator('#personForm textarea').inputValue() === 'Eine Notiz', 'Missing person name preserves the entered note');
    await app.locator('input[name="newName"]').fill('Ada');
    await app.locator('#personForm button').click();
    await app.waitForSelector('#quickNoteContextDone');
    check(await app.locator('#quickComposerTitle').textContent() === 'Gespeichert', 'Person capture reports success before optional context');
    const note = (await entries()).find(entry => entry.type === 'person-note');
    check(note.kind === 'reference' && note.text === 'Eine Notiz', 'User label Notiz preserves the stored reference kind');
    await app.locator('[data-composer="person"]').click();
    await app.waitForSelector('#personForm');
    await app.locator('select[name="personId"]').selectOption(note.personId);
    check(!await app.locator('#newPersonField').isVisible(), 'Existing person hides the new-name field');
    await app.locator('input[name="kind"][value="gift"]').check();
    await app.locator('#personForm textarea').fill('Ein Buch');
    await app.locator('#personForm button').click();
    await app.waitForSelector('#quickNoteContextDone');
    check(await app.locator('#quickComposerTitle').textContent() === 'Gespeichert', 'Gift capture offers the same optional context');
    await app.locator('#quickNoteContextDone').click();
    check((await entries()).some(entry => entry.kind === 'gift' && entry.personId === note.personId && entry.text === 'Ein Buch'), 'Gift confirmation corresponds to its stored kind and person');

    await app.locator('#menuButton').click();
    await app.getByRole('button', { name: 'Daten', exact: true }).click();
    await app.evaluate(() => { window.persistAllowed = false; Object.defineProperty(navigator, 'storage', { configurable: true, value: { persisted: async () => window.persistAllowed, persist: async () => window.persistAllowed } }); });
    await app.locator('#persistStorageButton').click();
    await feedback('Browser hat den Speicherschutz nicht freigegeben.');
    check(await app.locator('#storageStatus').textContent() === 'Browser kann Daten bei Speichermangel löschen.', 'Denied persistence does not claim protected data');
    await app.evaluate(() => { window.persistAllowed = true; });
    await app.locator('#persistStorageButton').click();
    await feedback('Schutz vor automatischem Löschen aktiv.');
    check(await app.locator('#storageStatus').textContent() === 'Schutz vor automatischem Löschen aktiv.', 'Persistence success describes the actual browser permission');
    const baseline = JSON.stringify(await entries());
    await app.locator('#importInput').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{not json') });
    await feedback('Import fehlgeschlagen. Bitte einen 0815-Export wählen. Vorhandene Daten bleiben erhalten.');
    check(JSON.stringify(await entries()) === baseline && await app.locator('#importInput').inputValue() === '', 'Rejected import preserves data and resets the file control');
    const replacement = await app.evaluate(async () => {
      const payload = await (await import('/src/db.js')).exportAll();
      payload.stores.entries = [{ id: 'imported-note', type: 'note', text: 'Importiert', createdAt: Date.now() }];
      return payload;
    });
    await app.evaluate(() => Object.defineProperty(document.querySelector('#nowRows'), 'innerHTML', { configurable: true, set() { throw new Error('INTERNAL render exception'); } }));
    await app.locator('#importInput').setInputFiles({ name: '0815.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) });
    await feedback('Daten importiert. Die Ansicht konnte nicht aktualisiert werden. Bitte neu laden.');
    check((await entries()).length === 1 && (await entries())[0].id === 'imported-note', 'An error after committed import never claims unchanged data');
    await app.evaluate(() => { delete document.querySelector('#nowRows').innerHTML; window.geoFail = false; });
    await app.locator('#backButton').click();
    await app.waitForSelector('#nowRows [data-helper="place"]');
    await app.evaluate(async () => {
      const db = await import('/src/db.js');
      for (const id of ['place', 'interval', 'time', 'used']) await db.put('helperRules', { ...(await db.get('helperRules', id)), id, visible: false });
    });
    await app.reload();
    await app.waitForFunction(() => document.querySelector('#allHelperList').textContent === 'Keine sichtbaren Helfer.');
    check(await app.locator('#nowRows').textContent() === '' && await app.locator('#favoriteTiles').textContent() === '' && !await app.locator('#helperToolbar').isVisible(), 'Hidden helpers leave silent sections and the accurate all-helpers state');
    check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
    return results;
  } finally { await context.close(); }
}

// Real shell/IndexedDB; device positions and failures are controlled in an isolated profile.
async (page) => {
  const results = [];
  for (const theme of ['light', 'dark', 'signature']) {
    const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 700 } });
    const app = await context.newPage();
    const errors = [], requests = [];
    app.on('pageerror', error => errors.push(error.message));
    app.on('request', request => requests.push(request.url()));
    const check = (ok, label) => { if (!ok) throw Error(`${theme}: ${label}`); results.push(`${theme}: ${label}`); };
    const entries = () => app.evaluate(async () => (await import('/src/db.js')).list('entries', { prune: false }));
    const stored = () => app.evaluate(async () => (await import('/src/db.js')).get('entries', 'parking-position'));
    let manualPlaceId;
    async function openParking() {
      await app.locator('.home-accordion').last().evaluate(node => { node.open = true; });
      await app.locator('#allHelperList [data-helper="parking"]').click();
      await app.waitForSelector('#parkingForm');
    }
    async function settings() {
      await app.locator('#menuButton').click();
      await app.getByRole('button', { name: 'Verknüpfungen & Orte' }).click();
      await app.locator('summary', { hasText: /^Orte$/ }).click();
      await app.waitForSelector('#placesList form');
    }
    await app.addInitScript(() => {
      window.geo = { latitude: 50, longitude: 8, accuracy: 10 };
      window.geoCalls = 0; window.watchCalls = 0; window.clearCalls = 0;
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
        getCurrentPosition(success, failure, options) {
          window.geoCalls++;
          window.geoOptions = options;
          window.resolveGeo = () => success({ coords: window.geo });
          if (window.geoHold) return;
          if (window.geoFail) failure({ message: 'denied' }); else window.resolveGeo();
        },
        watchPosition(success, failure) { window.watchCalls++; window.watchSuccess = success; window.watchFailure = failure; return window.watchCalls; },
        clearWatch() { window.clearCalls++; }
      } });
    });
    await app.route('**/src/db.js', async route => {
      const response = await route.fetch();
      const body = (await response.text())
        .replace('async function transaction(stores, mode, enqueue) {', 'async function transaction(stores, mode, enqueue) { if (mode === "readwrite" && globalThis.saveGate) await globalThis.saveGate;')
        .replace('export function put(storeName, value) {', 'export function put(storeName, value) { if (value.helperId === "parking" && globalThis.saveFail) throw Error("test quota");')
        .replace('export function remove(storeName, id) {', 'export function remove(storeName, id) { if (id === "parking-position" && globalThis.deleteFail) throw Error("test delete");');
      await route.fulfill({ response, body });
    });
    try {
      await app.goto('http://127.0.0.1:8080/');
      await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
      await app.evaluate(async theme => {
        await (await import('/src/theme.js')).saveTheme(theme);
      }, theme);
      await openParking();
      check(await app.evaluate(() => geoCalls === 0 && watchCalls === 0), 'Opening parking does not locate or observe');
      check(!(await app.evaluate(async () => (await import('/src/db.js')).get('settings', 'usage:parking'))), 'Opening does not count use');
      await app.locator('#parkingForm textarea').fill('Ebene 3 · <img src="/leak">');
      await app.evaluate(() => { window.saveGate = new Promise(resolve => { window.releaseSave = resolve; }); });
      await app.locator('#parkingForm button').focus(); await app.keyboard.press('Enter');
      await app.waitForFunction(() => document.querySelector('#helperHost [aria-busy="true"]'));
      check(await app.locator('#parkingForm button').isDisabled() && !(await stored()), 'Busy state waits for commit and prevents duplicate saves');
      await app.evaluate(() => { window.saveGate = null; window.releaseSave(); });
      await app.waitForSelector('#parkingShow');
      const first = await stored();
      check(first.note.includes('<img') && await app.locator('#parkingNote img').count() === 0, 'Saved optional note is safe text');
      check(await app.evaluate(async () => (await (await import('/src/db.js')).list('places')).length === 0 && geoCalls === 1 && geoOptions.maximumAge === 0), 'Explicit fresh location saved only in entries');
      await app.locator('#parkingShow').click();
      check((await app.locator('#parkingPosition').textContent()).includes('50.000000'), 'Show parking displays locally stored coordinates');
      await app.locator('#parkingEdit').click();
      await app.locator('#helperHost textarea').fill('Aufzug B');
      await app.locator('#helperHost button[type="submit"]').click();
      await app.waitForSelector('#parkingShow');
      check((await stored()).createdAt === first.createdAt && (await stored()).note === 'Aufzug B' && await app.evaluate(() => geoCalls === 1), 'Editing retains position/time and does not locate');
      await app.evaluate(() => { window.geoFail = true; });
      await app.locator('#parkingForm button').click();
      await app.waitForFunction(() => !document.querySelector('#helperHost [aria-busy="true"]'));
      check((await stored()).note === 'Aufzug B', 'Geolocation failure preserves existing parking');
      await app.evaluate(() => { window.geoFail = false; window.saveFail = true; window.geo.latitude = 51; });
      await app.locator('#parkingForm button').click();
      await app.waitForFunction(() => !document.querySelector('#helperHost [aria-busy="true"]'));
      check((await stored()).lat === 50, 'Save failure preserves existing parking');
      await app.evaluate(() => { window.saveFail = false; });
      await app.locator('#parkingForm button').click();
      await app.waitForFunction(async () => (await (await import('/src/db.js')).get('entries', 'parking-position')).lat === 51);
      check((await entries()).filter(entry => entry.helperId === 'parking').length === 1, 'Second position replaces the only active state');
      await app.reload(); await openParking();
      check(await app.locator('#parkingShow').isVisible(), 'Reload restores parking');
      await app.evaluate(() => { window.deleteFail = true; });
      await app.locator('#parkingDelete').click();
      await app.waitForFunction(() => !document.querySelector('#helperHost [aria-busy="true"]'));
      check(!!(await stored()), 'Delete failure preserves active state');
      await app.evaluate(() => { window.deleteFail = false; });
      await app.locator('#parkingDelete').click();
      await app.waitForSelector('#parkingForm textarea');
      check(!(await stored()), 'Deletion removes the active entry');
      await app.evaluate(() => { window.geoHold = true; });
      await app.locator('#parkingForm button').click();
      await app.locator('#backButton').click();
      await app.evaluate(() => { window.resolveGeo(); window.geoHold = false; });
      check(!(await stored()), 'Late position after leaving parking is not saved');

      await app.evaluate(async () => {
        const db = await import('/src/db.js');
        await db.put('places', { id: 'old', name: 'Alter Ort', lat: 50, lon: 8, radius: 75, createdAt: 1 });
      });
      const beforePlaceGeo = await app.evaluate(() => window.geoCalls);
      await app.locator('[data-composer="place"]').click();
      check(await app.evaluate(before => window.geoCalls === before, beforePlaceGeo), 'Opening Ort hinzufügen does not locate before a source is chosen');
      check(await app.locator('#placeForm button[type="submit"]').isDisabled(), 'Place save waits for an explicit position source');
      await app.locator('#placeForm [name="positionSource"][value="current"]').check();
      await app.waitForFunction(before => window.geoCalls === before + 1 && !document.querySelector('#placeForm button[type="submit"]').disabled, beforePlaceGeo);
      await app.locator('#placeForm [name="name"]').fill('Buchhandlung');
      await app.locator('#placeForm [name="category"]').selectOption('Einkaufen');
      await app.locator('#placeForm [name="radius"]').selectOption('20');
      await app.locator('#placeForm button[type="submit"]').click();
      await app.waitForSelector('#quickComposer', { state: 'hidden' });

      const beforeManualGeo = await app.evaluate(() => window.geoCalls);
      await app.locator('[data-composer="place"]').click();
      await app.locator('#placeForm [name="positionSource"][value="manual"]').check();
      await app.locator('#placeForm [name="name"]').fill('Manueller Ort');
      await app.locator('#placeForm [name="radius"]').selectOption('20');
      await app.locator('#placeForm [name="coordinates"]').fill('91, 8');
      check(await app.locator('#placeForm button[type="submit"]').isDisabled()
        && (await app.locator('#placeCoordinateStatus').textContent()).includes('nicht erkannt'), 'Invalid manual coordinates remain local and cannot be saved');
      await app.locator('#placeCoordinateHelp summary').click();
      check((await app.locator('#placeCoordinateHelp').textContent()).includes('Google Maps')
        && (await app.locator('#placeCoordinateHelp').textContent()).includes('Apple Karten'), 'Inline help explains where coordinates can be copied');
      await app.locator('#placeForm [name="coordinates"]').fill('50.000000, 8.000000');
      await app.waitForFunction(() => !document.querySelector('#placeForm button[type="submit"]').disabled);
      await app.locator('#placeForm button[type="submit"]').click();
      await app.waitForSelector('#quickComposer', { state: 'hidden' });
      manualPlaceId = await app.evaluate(async () => (await (await import('/src/db.js')).list('places')).find(place => place.name === 'Manueller Ort')?.id);
      check(!!manualPlaceId && await app.evaluate(before => window.geoCalls === before, beforeManualGeo), 'Manual place stores through the existing place model without geolocation');
      check(await app.evaluate(async id => {
        const place = await (await import('/src/db.js')).get('places', id);
        return place?.lat === 50 && place?.lon === 8 && place?.radius === 20;
      }, manualPlaceId), 'Manual coordinates persist unchanged in the existing place schema');

      await settings();
      check((await app.locator('#placesList h3').allTextContents()).join('|') === 'Einkaufen|Ohne Kategorie', 'Only occupied categories render; legacy place remains uncategorized');
      check(await app.locator('[data-place-form="old"] [name="radius"]').inputValue() === '75', 'Legacy custom radius is preserved');
      await app.locator('[data-place-form="old"] [name="radius"]').selectOption('50');
      await app.locator('[data-place-form="old"] [name="category"]').selectOption('Freizeit');
      await app.locator('[data-place-form="old"] button[type="submit"]').click();
      await app.waitForFunction(() => document.querySelector('#placesList').textContent.includes('Ort gespeichert.'));
      check((await app.locator('#placesList h3').allTextContents()).join('|') === 'Einkaufen|Freizeit', 'Existing place radius/category can be changed and regrouped');
      await app.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Grouped places fit 320px with 200% text');
      await app.evaluate(() => { document.documentElement.style.fontSize = ''; });
      await app.locator('#backButton').click();
      await app.evaluate(async id => {
        const db = await import('/src/db.js');
        const { timeBucket } = await import('/src/context.js');
        await db.put('entries', { id: 'location-note', type: 'note', text: 'Nur hier', createdAt: 1, context: { placeIds: [id] } });
        await db.put('entries', { id: 'time-note', type: 'note', text: 'Auch zur Tageszeit', createdAt: 2, context: { placeIds: [id], timeBuckets: [timeBucket()] } });
        window.geo.latitude = 50;
        window.geo.longitude = 8;
      }, manualPlaceId);
      await app.reload();
      await app.waitForSelector('#nowRows [data-note="location-note"]');
      await app.waitForFunction(() => window.watchCalls === 1);
      await app.locator('#nowRows [data-note="location-note"]').focus();
      await app.evaluate(() => window.watchSuccess({ coords: { latitude: 50.001, longitude: 8, accuracy: 500 } }));
      await app.waitForSelector('#nowRows [data-note="location-note"]', { state: 'detached' });
      check(await app.locator('#nowRows [data-note="time-note"]').count() === 1, 'Exit hides place-only note despite inaccurate fix; explicit time reason remains');
      check(await app.evaluate(() => document.activeElement.id === 'main'), 'Removed focused note returns focus to main');
      await app.evaluate(() => window.watchSuccess({ coords: window.geo }));
      await app.waitForSelector('#nowRows [data-note="location-note"]');
      check(true, 'Reentry restores place-linked note without navigation');
      await app.evaluate(() => window.watchFailure());
      await app.waitForSelector('#nowRows [data-note="location-note"]', { state: 'detached' });
      check(true, 'Location error clears stale place-only matches');
      await app.evaluate(() => window.watchSuccess({ coords: window.geo }));
      await app.waitForSelector('#nowRows [data-note="location-note"]');
      await app.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
        window.watchSuccess({ coords: window.geo });
      });
      check(await app.evaluate(() => clearCalls === 1 && !document.querySelector('#nowRows [data-note]')), 'Background stops observer and ignores its late callback');
      await app.evaluate(() => {
        window.geo.latitude = 51;
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await app.waitForFunction(() => window.watchCalls === 2);
      check(await app.locator('#nowRows [data-note="location-note"]').count() === 0, 'Resume uses fresh location rather than old match');
      await openParking();
      check(await app.evaluate(() => clearCalls === 2), 'Leaving dashboard stops observation');
      await app.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Parking fits 320px with 200% text');
      check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
      check(requests.every(url => url.startsWith('http://127.0.0.1:8080/')), 'No external requests');
    } finally { await context.close(); }
  }
  return results;
}

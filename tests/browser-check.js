// Run this function with a Playwright page against `python3 -m http.server 8080`.
// Playwright is supplied by the browser tool, not a project dependency.
async (page) => {
  const base = 'http://127.0.0.1:8080';
  const results = [];
  function check(condition, message) {
    if (!condition) throw new Error(message);
    results.push(message);
  }
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 700 } });
  const app = await context.newPage();
  const errors = [];
  const requests = [];
  app.on('pageerror', error => errors.push(error.message));
  app.on('request', request => requests.push(request.url()));
  await app.route('**/src/helpers/registry.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    export const HELPERS = [
      { id: 'example', label: 'Beispiel', category: 'Test', contexts: ['place', 'time', 'interval'],
        mount({root, api, signal}) { window.fixtureAPI = api; window.fixtureSignal = signal; root.textContent = 'Fachinhalt'; return () => { window.cleanupCount = (window.cleanupCount || 0) + 1; }; } },
      { id: 'hidden', label: 'Versteckt', category: 'Test', defaultVisible: false, mount() { throw Error('Hidden helper mounted'); } },
      { id: 'slow', label: 'Langsam', category: 'Test',
        async mount({root, api, signal}) { window.slowAPI = api; window.slowSignal = signal; await new Promise(resolve => { window.finishMount = resolve; }); root.textContent = 'Veralteter Inhalt'; return () => { window.slowCleanup = (window.slowCleanup || 0) + 1; }; } }
    ];
  ` }));
  try {
    await app.goto(base);
    await app.waitForFunction(() => document.querySelector('#allHelperList').textContent.includes('Beispiel'));
    const initialUse = Date.now() - 2 * 3600000;
    await app.evaluate(async initialUse => {
      const db = await import('/src/db.js');
      await db.put('helperRules', { id: 'example', favorite: true, visible: true, placeIds: [], timeBuckets: [], intervalMinutes: 60, toleranceMinutes: 15 });
      await db.put('helperRules', { id: 'hidden', favorite: true, visible: false });
      await db.put('settings', { id: 'usage:example', lastUsedAt: initialUse });
      await db.put('settings', { id: 'usage:hidden', lastUsedAt: initialUse });
    }, initialUse);
    await app.reload();
    await app.waitForFunction(() => document.querySelector('#favoriteTiles').textContent.includes('Beispiel'));
    check(await app.locator('[data-helper="hidden"]').count() === 0, 'Hidden helpers excluded from Jetzt, Favoriten and Alle Helfer');
    check(await app.locator('#favoriteTiles [data-helper="example"]').count() === 1, 'Visible favorite restored from IndexedDB');
    await app.locator('#nowRows [data-helper="example"]').click();
    await app.waitForFunction(() => !!window.fixtureAPI);
    check(await app.evaluate(async () => (await (await import('/src/db.js')).get('settings', 'usage:example')).lastUsedAt) === initialUse, 'Opening helper does not record use');
    check(await app.locator('#view-dashboard').isVisible() === false, 'Focus view hides entire dashboard');
    await app.evaluate(() => window.fixtureAPI.recordUse());
    check(await app.evaluate(async initialUse => (await (await import('/src/db.js')).get('settings', 'usage:example')).lastUsedAt > initialUse, initialUse), 'Explicit recordUse persists actual use');
    await app.locator('#helperSettingsButton').click();
    await app.waitForSelector('#helperSettingsForm');
    check(await app.evaluate(() => window.fixtureSignal.aborted && window.cleanupCount === 1), 'Opening settings aborts and cleans up helper');
    check(await app.locator('[name="trackingWindow"]').count() === 0, 'No ineffective retention setting');
    await app.locator('input[name="interval"]').fill('60');
    await app.locator('input[name="tolerance"]').fill('60');
    await app.locator('#helperSettingsForm button[type="submit"]').click();
    await app.waitForFunction(() => document.querySelector('#toast').textContent.includes('kleiner'));
    check(await app.evaluate(async () => (await (await import('/src/db.js')).get('helperRules', 'example')).toleranceMinutes) === 15, 'Invalid tolerance is rejected without saving');
    await app.locator('#backButton').click();
    await app.getByText('Alle Helfer', { exact: true }).click();
    await app.locator('#allHelperList [data-helper="slow"]').click();
    await app.waitForFunction(() => !!window.finishMount);
    await app.locator('#backButton').click();
    await app.evaluate(() => window.finishMount());
    await app.waitForFunction(() => window.slowCleanup === 1);
    check(await app.evaluate(() => window.slowSignal.aborted && !document.body.textContent.includes('Veralteter Inhalt')), 'Stale mount is detached, aborted and cleaned exactly once');
    check(await app.evaluate(() => { try { window.slowAPI.recordUse(); return false; } catch (error) { return error.name === 'AbortError'; } }), 'Stale helper API rejects writes');

    await app.evaluate(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(success) { window.resolveGeo = success; } } }));
    await app.locator('[data-composer="place"]').click();
    await app.locator('#placeForm input[name="name"]').fill('Privater Ortsname');
    check(await app.locator('#placeForm button').isDisabled(), 'Place save disabled while geolocation is pending');
    const url = app.url();
    await app.evaluate(() => document.querySelector('#placeForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    check(app.url() === url && !requests.some(url => url.includes('name=')), 'Early place submit causes no navigation or query transmission');
    await app.locator('#quickComposerClose').click();
    await app.locator('[data-composer="note"]').click();
    await app.evaluate(() => window.resolveGeo({ coords: { latitude: 50, longitude: 8, accuracy: 10 } }));
    check(await app.locator('#noteForm').isVisible(), 'Late geolocation result leaves the new composer intact');
    await app.locator('#quickComposerClose').click();

    await app.evaluate(() => {
      window.originalPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function() { throw new DOMException('Quota full', 'QuotaExceededError'); };
    });
    await app.locator('[data-composer="note"]').click();
    await app.locator('#noteText').fill('Nicht gespeichert');
    await app.locator('#noteForm button').click();
    await app.waitForFunction(() => document.querySelector('#toast').textContent.includes('Speicher voll'));
    check(await app.locator('#noteForm').isVisible() && await app.locator('#noteText').inputValue() === 'Nicht gespeichert', 'Quota failure keeps the form and entered text');
    await app.evaluate(() => { IDBObjectStore.prototype.put = window.originalPut; });
    await app.locator('#noteForm button').click();
    await app.waitForFunction(() => document.querySelector('#toast').textContent === 'Notiz gespeichert.');
    check(await app.locator('#noteForm').count() === 0, 'Saving can be retried after a storage error');

    const storageChecks = await app.evaluate(async () => {
      const db = await import('/src/db.js');
      const baseline = JSON.stringify((await db.exportAll()).stores);
      const payload = await db.exportAll();
      payload.stores.entries.push({ type: 'note', text: 'invalid', createdAt: 1 });
      try { await db.importAll(payload); } catch {}
      const invalidPreserved = JSON.stringify((await db.exportAll()).stores) === baseline;
      const replacement = await db.exportAll();
      replacement.stores.people = [{ id: 'new-person', name: 'New', createdAt: 1 }];
      const originalPut = IDBObjectStore.prototype.put;
      let puts = 0;
      IDBObjectStore.prototype.put = function(...args) {
        if (++puts === 2) throw new DOMException('Simulated storage failure', 'QuotaExceededError');
        return originalPut.apply(this, args);
      };
      let failed = false;
      try { await db.importAll(replacement); } catch { failed = true; }
      finally { IDBObjectStore.prototype.put = originalPut; }
      const rolledBack = JSON.stringify((await db.exportAll()).stores) === baseline;
      await db.importAll(replacement);
      const replaced = (await db.list('people')).length === 1;
      const malicious = await db.exportAll();
      malicious.stores.places.push({ id: 'evil', name: '<img src="/leak" onerror="window.xss=true">', lat: 50, lon: 8, radius: 250, createdAt: 1 });
      await db.importAll(malicious);
      return { invalidPreserved, failed, rolledBack, replaced };
    });
    for (const [key, value] of Object.entries(storageChecks)) check(value, `IndexedDB: ${key}`);
    await app.locator('#menuButton').click();
    await app.getByRole('button', { name: 'Verknüpfungen & Orte' }).click();
    await app.waitForFunction(() => document.querySelector('#placesList').textContent.includes('<img'));
    check(await app.locator('#placesList img').count() === 0 && !await app.evaluate(() => !!window.xss), 'Imported markup is displayed as literal text, never interpreted as HTML');
    check(!requests.some(url => url.includes('/leak')), 'Imported markup causes no resource request');
    await app.locator('#backButton').click();
    await app.locator('#menuButton').click();
    await app.getByRole('button', { name: 'Daten', exact: true }).click();
    await app.locator('#importInput').focus();
    check(await app.locator('.import-control').evaluate(element => getComputedStyle(element.querySelector('label')).outlineStyle === 'solid'), 'Import has visible keyboard focus');
    check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Shell reflows at 320 CSS pixels');
    check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
    return results;
  } finally { await context.close(); }
}

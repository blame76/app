// Context Core lifecycle with controlled foreground time and geolocation.
// Run through the supplied Playwright browser tool; no project dependency is required.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Berlin' });
  const app = await context.newPage();
  const results = [];
  const errors = [];
  const requests = [];
  app.on('pageerror', error => errors.push(error.message));
  app.on('request', request => requests.push(request.url()));
  function check(condition, label) { if (!condition) throw new Error(label); results.push(label); }

  await app.route('**/src/helpers/registry.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    const helper = (id, label, contexts = []) => ({ id, label, category: 'Test', contexts, mount({ root }) { root.textContent = 'Testansicht'; } });
    export const HELPERS = [
      ...Array.from({ length: 10 }, (_, index) => helper('midday-' + index, 'Mittag ' + index, ['time'])),
      helper('evening', 'Abend', ['time']),
      helper('interval', 'Intervall', ['interval']),
      helper('place', 'Ort', ['place']),
      helper('or-rule', 'Ort oder Zeit', ['place', 'time']),
      helper('recent-only', 'Nur benutzt'),
      helper('no-context', 'Ohne Context'),
      helper('deleted-place', 'Gelöschter Ort', ['place']),
      helper('background', 'Rückkehr', ['interval'])
    ];
  ` }));
  await app.addInitScript(() => {
    const NativeDate = Date;
    const realStartedAt = NativeDate.now();
    const localStart = new NativeDate('2026-10-06T14:59:58+02:00').getTime();
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [localStart + NativeDate.now() - realStartedAt])); }
      static now() { return localStart + NativeDate.now() - realStartedAt; }
    };
    window.geoCurrentCalls = 0;
    window.geoWatchCalls = 0;
    window.geoClearCalls = 0;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition(success, failure, options) {
        window.geoCurrentCalls++;
        window.geoCurrentSuccess = success;
        window.geoCurrentFailure = failure;
        window.geoCurrentOptions = options;
      },
      watchPosition(success, failure, options) {
        window.geoWatchCalls++;
        window.geoWatchSuccess = success;
        window.geoWatchFailure = failure;
        window.geoWatchOptions = options;
        return window.geoWatchCalls;
      },
      clearWatch() { window.geoClearCalls++; }
    } });
  });

  try {
    await app.goto('http://127.0.0.1:8080/');
    await app.waitForSelector('#allHelperList [data-helper="interval"]', { state: 'attached' });
    await app.evaluate(async () => {
      const db = await import('/src/db.js');
      for (let index = 0; index < 10; index++) await db.put('helperRules', { id: `midday-${index}`, timeBuckets: ['midday'] });
      await db.put('helperRules', { id: 'evening', timeBuckets: ['evening'] });
      await db.put('helperRules', { id: 'interval', interval: { value: 60, unit: 'minute' }, earlyBy: null });
      await db.put('helperRules', { id: 'place', placeIds: ['market'] });
      await db.put('helperRules', { id: 'or-rule', placeIds: ['market'], timeBuckets: ['midday'] });
      await db.put('helperRules', { id: 'deleted-place', placeIds: ['missing'] });
      await db.put('helperRules', { id: 'background', interval: { value: 1, unit: 'minute' }, earlyBy: null });
      await db.put('places', { id: 'market', name: 'Supermarkt', lat: 50, lon: 8, radius: 100, createdAt: 1 });
      await db.put('settings', { id: 'usage:interval', lastUsedAt: Date.now() - 60 * 60000 + 2000 });
      await db.put('settings', { id: 'usage:recent-only', lastUsedAt: Date.now() });
      await db.put('settings', { id: 'usage:no-context', lastUsedAt: Date.now() });
    });
    await app.reload();
    await app.waitForSelector('#nowRows [data-helper="midday-0"]');

    check(await app.locator('#nowRows [data-helper]').count() === 11, 'More than nine relevant candidates are rendered without truncation');
    check(await app.locator('#nowRows [data-helper="or-rule"] span').textContent() === 'mittags · 11–15 Uhr', 'A non-location OR reason is available while geolocation is pending');
    check(await app.locator('#nowRows [data-helper="recent-only"], #nowRows [data-helper="no-context"], #nowRows [data-helper="deleted-place"]').count() === 0, 'Recent use, no context and a deleted place ID create no Jetzt candidate');
    check(await app.evaluate(() => window.geoCurrentCalls === 1 && window.geoWatchCalls === 1 && window.geoCurrentOptions.maximumAge === 0 && window.geoWatchOptions.maximumAge === 0), 'Foreground location starts fresh without delaying safe content');

    await app.waitForSelector('#nowRows [data-helper="evening"]', { timeout: 5000 });
    await app.waitForSelector('#nowRows [data-helper="interval"]', { timeout: 5000 });
    check(await app.locator('#nowRows [data-helper="midday-0"]').count() === 0, 'Open dashboard updates itself when the local time bucket changes');
    check(await app.locator('#nowRows [data-helper="evening"] span').textContent() === 'abends · 15–22 Uhr', 'Time boundary uses the visible canonical range');
    check(await app.locator('#nowRows [data-helper="interval"] span').textContent() === 'wieder im Blick · nach 60 Minuten', 'Open dashboard updates itself when an interval becomes due');

    await app.evaluate(() => {
      window.geoCurrentFailure({ message: 'denied' });
      window.geoWatchFailure({ message: 'denied' });
    });
    await app.waitForFunction(() => !document.querySelector('#nowRows [data-helper="place"]'));
    check(await app.locator('#nowRows [data-helper="evening"], #nowRows [data-helper="interval"]').count() === 2, 'Denied location removes only place reasons and keeps safe reasons usable');

    await app.evaluate(() => window.geoWatchSuccess({ coords: { latitude: 50, longitude: 8, accuracy: 20 } }));
    await app.waitForSelector('#nowRows [data-helper="place"]');
    check(await app.locator('#nowRows [data-helper="place"] span').textContent() === 'Supermarkt'
      && await app.locator('#nowRows [data-helper="or-rule"] span').textContent() === 'Supermarkt · mittags (11–15 Uhr)', 'Entering a place explains every matching OR reason while place keeps priority');
    await app.evaluate(() => window.geoWatchSuccess({ coords: { latitude: 51, longitude: 9, accuracy: 20 } }));
    await app.waitForFunction(() => !document.querySelector('#nowRows [data-helper="place"]') && !document.querySelector('#nowRows [data-helper="or-rule"]'));
    check(true, 'Leaving a place removes candidates without reinitializing the app');

    const beforeBackground = await app.evaluate(() => ({ current: window.geoCurrentCalls, watch: window.geoWatchCalls, clear: window.geoClearCalls }));
    await app.evaluate(async () => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      const db = await import('/src/db.js');
      await db.put('settings', { id: 'usage:background', lastUsedAt: Date.now() - 2 * 60000 });
    });
    check(await app.locator('#nowRows').textContent() === '' && await app.evaluate(value => window.geoClearCalls > value, beforeBackground.clear), 'Backgrounding clears Jetzt and stops the location observer');
    await app.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await app.waitForSelector('#nowRows [data-helper="background"]');
    check(await app.locator('#nowRows [data-helper="background"] span').textContent() === 'wieder im Blick · nach 1 Minute', 'Returning to the foreground recomputes local reasons immediately');
    check(await app.evaluate(value => window.geoCurrentCalls > value.current && window.geoWatchCalls > value.watch, beforeBackground), 'Foreground return starts a fresh location request and observer');

    await app.locator('.home-accordion').last().evaluate(element => { element.open = true; });
    await app.locator('#allHelperList [data-helper="or-rule"]').click();
    await app.locator('#helperSettingsButton').click();
    await app.waitForSelector('#helperSettingsForm');
    check(await app.getByRole('heading', { name: 'Wann soll dieser Helfer unter „Jetzt“ erscheinen?' }).isVisible(), 'Context settings lead with the product question');
    check(await app.getByText('Eine passende Bedingung reicht.', { exact: true }).isVisible()
      && await app.getByText('Abends · 15–22 Uhr', { exact: true }).isVisible(), 'Settings explain OR and canonical time ranges before selection');
    check(requests.every(url => url.startsWith('http://127.0.0.1:8080/')), 'Context Core makes no external requests');
    check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
    return results;
  } finally {
    await context.close();
  }
}

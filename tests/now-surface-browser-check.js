// Real entries, actual commits and the single foreground clock; no project dependency.
async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 320, height: 800 }, timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
  const app = await context.newPage();
  const results = [], errors = [], requests = [];
  app.on('pageerror', error => errors.push(error.message));
  app.on('request', request => requests.push(request.url()));
  const check = (ok, label) => { if (!ok) throw new Error(label); results.push(label); };
  const card = id => app.locator(`#nowRows [data-helper="${id}"]`);
  async function home() {
    if (await app.locator('#view-dashboard').isVisible()) await app.locator('#brandButton').click();
    else await app.locator('#backButton').click();
    await app.waitForFunction(() => !document.querySelector('#view-dashboard').hidden);
  }
  async function open(id) {
    await app.locator('.home-accordion').last().evaluate(el => { el.open = true; });
    await app.locator(`#allHelperList [data-helper="${id}"]`).click();
  }
  async function primary(id, value) {
    await app.waitForFunction(({ id, value }) => document.querySelector(`#nowRows [data-helper="${id}"] .now-primary`)?.textContent === value, { id, value });
  }
  async function absent(id) { await app.waitForFunction(id => !document.querySelector(`#nowRows [data-helper="${id}"]`), id); }
  await app.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition(success) { success({ coords: { latitude: 50, longitude: 8, accuracy: 10 } }); },
      watchPosition(success) { success({ coords: { latitude: 50, longitude: 8, accuracy: 10 } }); return 1; }, clearWatch() {}
    } });
  });
  try {
    await app.clock.install({ time: new Date('2026-10-06T19:00:00+02:00') });
    await app.clock.pauseAt(new Date('2026-10-06T19:00:00+02:00'));
    await app.goto('http://127.0.0.1:8080/');
    await app.waitForSelector('#allHelperList [data-helper="drink"]', { state: 'attached' });
    await app.evaluate(async () => {
      const db = await import('/src/db.js');
      const { createDrink } = await import('/src/helpers/drink/model.js');
      const { createObservation } = await import('/src/helpers/pain/model.js');
      const { createTraining } = await import('/src/helpers/training/model.js');
      const now = Date.now(), endedAt = now - 4 * 86400000;
      await db.put('entries', { id: 'parking-position', helperId: 'parking', entryVersion: 1, createdAt: now - 18 * 60000, lat: 50, lon: 8, accuracy: 10, note: 'B7' });
      await db.put('entries', { ...createDrink(now - 2 * 3600000), id: 'drink-fixture' });
      await db.put('settings', { id: 'usage:drink', lastUsedAt: now - 2 * 3600000 });
      await db.put('entries', { ...createObservation('Kopf', 6, now - 60000), id: 'pain-fixture' });
      await db.put('entries', { ...createTraining(endedAt - 60000), id: 'training-fixture', status: 'ended', endedAt,
        activities: [{ id: 'a1', name: 'Laufen', mode: 'duration', durationSeconds: 600, recordedAt: endedAt }] });
      await db.put('settings', { id: 'usage:training', lastUsedAt: endedAt });
      await db.put('places', { id: 'home', name: 'Zuhause', lat: 50, lon: 8, radius: 100, createdAt: now });
      await db.put('entries', { id: 'now-note', type: 'note', text: 'Paket für Anna mitnehmen', createdAt: now, context: { placeIds: ['home'] } });
    });
    await home();
    await primary('parking', 'Du parkst · B7');
    await primary('pain', 'Kopf · 6/10');
    await primary('drink', '2 Trinkgelegenheiten verpasst');
    await primary('training', 'Letztes Training vor 4 Tagen');
    await app.waitForSelector('#nowRows [data-note="now-note"]');
    check(await app.locator('#nowRows .now-card').count() === 5, 'All five relevant cards coexist, with domain content');
    check(await app.locator('#nowRows .now-card').evaluateAll(cards => cards.slice(0, 2).every(el => el.querySelector('[data-context="active"]'))), 'Active domain states precede explicit context matches');
    check(await app.locator('#nowRows [data-note="now-note"] .now-primary').textContent() === 'Paket für Anna mitnehmen', 'The note itself is visible on Now');
    check(await card('drink').locator('.now-badge').getAttribute('aria-label') === '2 Trinkgelegenheiten verpasst', 'Badge has a textual accessible label');
    check((await app.locator('#nowRows').ariaSnapshot()).includes('Ort: Zuhause'), 'Place icon has a text alternative');
    for (const theme of ['light', 'dark', 'signature']) {
      await app.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      const contrast = await app.locator('#nowRows').evaluate(root => {
        const lum = rgb => rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
        const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
        const cards = [...root.children];
        return {
          sameSurface: new Set(cards.map(el => getComputedStyle(el).backgroundColor)).size === 1,
          text: Math.min(...cards.flatMap(card => [...card.querySelectorAll('.now-heading, .now-primary, .now-secondary, .now-indicator, .now-badge')].map(el => ratio(getComputedStyle(el).color, getComputedStyle(card).backgroundColor)))),
          border: Math.min(...cards.map(el => ratio(getComputedStyle(el).borderTopColor, getComputedStyle(el).backgroundColor)))
        };
      });
      check(contrast.sameSurface, `${theme}: notes and helpers use the same card surface`);
      check(contrast.text >= 4.5 && contrast.border >= 3, `${theme}: actual card text and control borders meet AA (${contrast.text.toFixed(2)} / ${contrast.border.toFixed(2)})`);
      for (const width of [320, 1280]) {
        await app.setViewportSize({ width, height: 900 });
        for (const zoom of [1, 2]) {
          await app.evaluate(zoom => { document.documentElement.style.fontSize = `${zoom * 100}%`; }, zoom);
          check(await app.locator('#nowRows').evaluate((el, width) => getComputedStyle(el).gridTemplateColumns.split(' ').length === (width === 320 ? 1 : 3), width), `${width}px: mobile single column or wide three-column grid`);
          check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme}: ${width}px / ${zoom * 100}% text has no horizontal overflow`);
          check(await app.locator('#nowRows .now-card').evaluateAll(cards => cards.every(el => el.getBoundingClientRect().height >= 48 && el.scrollWidth <= el.clientWidth + 2)), `${theme}: cards preserve touch targets and content widths`);
          check(await app.locator('#nowRows .now-primary').evaluateAll(nodes => nodes.every(el => getComputedStyle(el).overflow !== 'hidden' && getComputedStyle(el).webkitLineClamp === 'none')), `${theme}: primary text is not clipped`);
        }
        await app.evaluate(() => { document.documentElement.style.fontSize = ''; });
        await app.screenshot({ path: `/tmp/0815-now-${theme}-${width}.png`, fullPage: true });
      }
    }
    // Long untrusted note and parking text use the same safe, unclipped surface.
    await app.evaluate(async () => {
      const db = await import('/src/db.js');
      await db.put('entries', { ...(await db.get('entries', 'parking-position')), note: '<img src="https://external.test/leak"> ' + 'Ebene 3 · Aufzug B '.repeat(20) });
      await db.put('entries', { ...(await db.get('entries', 'now-note')), text: 'Paket für Anna mitnehmen\n' + 'LangerNotiztext'.repeat(100) });
    });
    await home();
    await app.waitForFunction(() => document.querySelector('#nowRows [data-note="now-note"] .now-primary')?.textContent.length > 1000);
    await app.setViewportSize({ width: 320, height: 800 });
    await app.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth && !document.querySelector('#nowRows img')), 'Long note and imported markup reflow at 320px / 200% as literal text');
    await app.evaluate(() => { document.documentElement.style.fontSize = ''; });
    const ids = await app.locator('#nowRows .now-card').evaluateAll(cards => cards.map(el => el.dataset.helper || el.dataset.note));
    await app.keyboard.press('Tab');
    await app.locator('#nowRows .now-card').first().focus();
    for (const id of ids) {
      check(await app.evaluate(id => (document.activeElement.dataset.helper || document.activeElement.dataset.note) === id && getComputedStyle(document.activeElement).outlineStyle === 'solid', id), `Keyboard follows DOM reading order with visible focus: ${id}`);
      await app.keyboard.press('Tab');
    }
    // Count updates without reopening or introducing background work.
    await app.clock.fastForward(3600000);
    await primary('drink', '3 Trinkgelegenheiten verpasst');
    check(true, 'Nominal interval count updates on the already visible dashboard');
    await card('parking').click();
    await app.locator('#parkingDelete').click();
    await app.waitForSelector('#parkingForm textarea');
    await home(); await absent('parking');
    check(true, 'Deleting the parking entry removes active relevance immediately on return');
    await open('parking');
    await app.locator('#parkingForm textarea').fill('Ebene 3 · Aufzug B');
    await app.locator('#parkingForm button').click();
    await app.waitForSelector('#parkingDelete');
    await home(); await primary('parking', 'Du parkst · Ebene 3 · Aufzug B');
    await card('parking').click();
    await app.locator('#parkingForm button').click();
    await app.waitForFunction(() => document.querySelector('#parkingNote').textContent === '');
    await home(); await primary('parking', 'Auto geparkt');
    check(true, 'Saving and replacing parking refresh the Now card without inventing a location');
    await card('pain').click();
    await app.locator('[data-pain="resolved"]').click();
    await app.locator('[data-pain="done"]').click(); await absent('pain');
    check(true, 'Schmerz weg for the last open area ends active relevance');
    await app.clock.fastForward(1000);
    await open('pain');
    await app.locator('[data-pain="same-area"]').click();
    await app.locator('input[name="intensity"][value="5"]').check();
    await app.locator('#painEntryForm button[type="submit"]').click();
    await app.locator('[data-pain="done"]').click(); await primary('pain', 'Kopf · 5/10');
    check(true, 'A new pain observation becomes the current card on Fertig');
    await app.evaluate(async () => {
      const db = await import('/src/db.js');
      await db.put('helperRules', { id: 'pain', timeBuckets: ['evening'] });
      await db.put('helperRules', { id: 'training', interval: null, earlyBy: null });
    });
    await app.clock.fastForward(1000);
    await card('pain').click();
    await app.locator('[data-pain="resolved"]').click();
    await app.locator('[data-pain="done"]').click(); await primary('pain', 'Kein Schmerz offen dokumentiert');
    check(await card('pain').locator('[data-context="active"]').count() === 0 && await card('pain').locator('[data-context="time"]').count() === 1, 'Resolved pain remains only through its matching explicit context');
    await absent('training');
    await open('training');
    await app.locator('#trainingStart').click();
    await app.waitForSelector('#trainingActivityForm, .training-reference');
    await app.locator('#backButton').click();
    // Training Back may first return to its internal home.
    if (await app.locator('#view-helper').isVisible()) await app.locator('#backButton').click();
    await primary('training', 'Training läuft');
    check(true, 'An active training is visible even with its interval disabled');
    await card('training').click();
    await app.locator('[data-training="finish"]').click();
    await app.waitForSelector('#trainingStart');
    await home(); await absent('training');
    check(true, 'Ending an empty active training removes active relevance');
    await open('training');
    await app.locator('#trainingStart').click();
    await app.waitForSelector('.training-reference');
    await app.locator('[data-training="repeat"]').click();
    await app.locator('[data-activity-form="a1"] input[name="duration"]').fill('10');
    await app.locator('[data-activity-form="a1"] button').click();
    await app.waitForFunction(() => document.querySelector('.training-today')?.textContent.includes('10 Min.'));
    await app.locator('[data-training="finish"]').click();
    await app.waitForSelector('.training-complete-title');
    await app.locator('[data-training="home"]').click();
    await home(); await absent('training');
    check(true, 'A completed nonempty training also ends active relevance after its commit');
    await app.evaluate(async () => {
      const db = await import('/src/db.js');
      await db.put('helperRules', { id: 'training', placeIds: ['home'], interval: null, earlyBy: null });
    });
    await home(); await primary('training', 'Letztes Training heute');
    check(await card('training').locator('[data-context="active"]').count() === 0, 'Completed training remains visible only when an explicit place context matches');
    await card('drink').click();
    await app.locator('#drinkRecord').click();
    await app.waitForFunction(() => document.querySelector('#drinkLast').textContent === 'gerade eben' && !document.querySelector('#drinkRecord').disabled);
    await home(); await absent('drink');
    check(true, 'Successful drink commit and recordUse reset count and interval relevance');
    await app.clock.fastForward(45 * 60000);
    await primary('drink', 'Bald wieder dran');
    check(await card('drink').locator('.now-badge').count() === 0, 'earlyBy shows the card without counting a missed opportunity');
    await app.clock.fastForward(15 * 60000);
    await primary('drink', '1 Trinkgelegenheit verpasst');
    check(true, 'The first missed opportunity starts exactly at the nominal hour');
    await app.evaluate(async () => {
      const db = await import('/src/db.js');
      await db.put('helperRules', { id: 'drink', intervalMinutes: 60, toleranceMinutes: 15, visible: true, favorite: true, trackingWindow: 'always' });
      window.beforeDisable = JSON.stringify(await db.exportAll());
    });
    await card('drink').click();
    await app.evaluate(() => {
      window.originalPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(...args) { if (this.name === 'helperRules') throw new Error('Test write failure'); return window.originalPut.apply(this, args); };
    });
    await app.locator('#drinkDisableReminder').click();
    await app.waitForFunction(() => document.querySelector('#toast').textContent.startsWith('Erinnerung konnte nicht'));
    check(await app.evaluate(async () => JSON.stringify(await (await import('/src/db.js')).exportAll()) === window.beforeDisable), 'Failed disable keeps all stored data and permits retry');
    await app.evaluate(() => { IDBObjectStore.prototype.put = window.originalPut; });
    await app.clock.fastForward(3000);
    await app.locator('#drinkDisableReminder').click();
    await app.waitForFunction(() => !document.querySelector('#view-dashboard').hidden);
    await absent('drink');
    await app.waitForSelector('#favoriteTiles [data-helper="drink"]', { state: 'attached' });
    check(await app.evaluate(async () => {
      const db = await import('/src/db.js');
      const before = JSON.parse(window.beforeDisable), after = await db.exportAll();
      const rule = await db.get('helperRules', 'drink');
      const strip = value => { value.stores.helperRules = value.stores.helperRules.filter(rule => rule.id !== 'drink'); delete value.exportedAt; return JSON.stringify(value); };
      return rule.interval === null && rule.earlyBy === null && rule.favorite && rule.visible && rule.trackingWindow === 'always'
        && !Object.hasOwn(rule, 'intervalMinutes') && strip(before) === strip(after);
    }), 'Disable migrates legacy interval, preserves entries, usage, favorites and other helper rules');
    check(await app.locator('#allHelperList [data-helper="drink"]').count() === 1 && await app.locator('#favoriteTiles [data-helper="drink"]').count() === 1, 'Disabled reminder leaves Drink available in all helpers and favorites');
    await app.clock.fastForward(24 * 3600000); await absent('drink');
    await app.reload(); await absent('drink');
    check(true, 'Disabled reminder stays disabled across later time and reload');
    check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
    check(requests.every(url => url.startsWith('http://127.0.0.1:8080/')), 'No external requests or imported markup resources');
    return results;
  } catch (error) { throw new Error(`${error.message}\nLast successful check: ${results.at(-1)}\nView: ${await app.locator('main').innerText()}`); } finally { await context.close(); }
}

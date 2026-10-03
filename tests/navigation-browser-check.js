// Real shell/helpers and IndexedDB; supplied Playwright, no test dependency.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 700 } });
  const app = await context.newPage();
  const results = [], errors = [];
  app.on('pageerror', error => errors.push(error.message));
  function check(condition, label) { if (!condition) throw new Error(label); results.push(label); }
  async function focused(selector, label) {
    await app.waitForFunction(selector => document.activeElement === document.querySelector(selector), selector);
    check(await app.locator(selector).isVisible(), label);
  }
  async function snapshot() {
    return app.evaluate(async () => {
      const db = await import('/src/db.js');
      return JSON.stringify(await Promise.all(['entries', 'people', 'settings', 'helperRules', 'places'].map(store => db.list(store, { prune: false }))));
    });
  }
  async function home() { await app.waitForSelector('#view-dashboard'); }
  async function open(id, ready) {
    await app.locator('.home-accordion').last().evaluate(element => { element.open = true; });
    await app.locator(`#allHelperList [data-helper="${id}"]`).click();
    await app.waitForSelector(ready);
  }
  async function back() { await app.locator('#backButton').click(); }
  async function history() {
    await app.locator('.pain-history-picker summary').click();
    await app.locator('#painHistoryForm select').selectOption('Bauch');
    await app.locator('#painHistoryForm button').click();
    await app.waitForSelector('.pain-history');
  }
  // Exercise navigation while a mount/settings read is suspended.
  await app.route('**/src/db.js', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('export async function get(storeName, id) {',
      'export async function get(storeName, id) { if (globalThis.navigationReadGate && storeName === "helperRules") await globalThis.navigationReadGate;');
    await route.fulfill({ response, body });
  });
  try {
    await app.goto('http://127.0.0.1:8080/');
    await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
    await app.evaluate(async () => {
      const db = await import('/src/db.js');
      const { createObservation } = await import('/src/helpers/pain/model.js');
      await db.put('entries', { ...createObservation('Bauch', 4), id: 'pain-existing' });
      await db.put('people', { id: 'anna', name: 'Anna', createdAt: 1 });
      const original = IDBDatabase.prototype.transaction;
      window.navigationWrites = 0;
      IDBDatabase.prototype.transaction = function(stores, mode, ...args) {
        if (mode === 'readwrite') window.navigationWrites++;
        return original.call(this, stores, mode, ...args);
      };
    });
    const before = await snapshot();
    const historyLength = await app.evaluate(() => window.history.length);
    for (const [id, ready] of [['pain', '.pain-last-value'], ['discount', '#discountForm'], ['drink', '#drinkRecord']]) {
      await open(id, ready);
      await app.locator('#helperSettingsButton').click();
      await app.waitForSelector('#helperSettingsForm');
      check(await app.locator('#backButton').getAttribute('aria-label') === `Zurück zu ${id === 'pain' ? 'Schmerz' : id === 'discount' ? 'Rabatt' : 'Trinken'}`, `${id}: Settings Back names its parent`);
      await back();
      await app.waitForSelector(ready);
      await focused('#helperSettingsButton', `${id}: Settings Back restores helper and settings-trigger focus`);
      await back(); await home();
      await focused(`#allHelperList [data-helper="${id}"]`, `${id}: Helper Back restores the original dashboard tile`);
    }
    // Repeated settings trips must not leave duplicate parents.
    await open('pain', '.pain-last-value');
    for (let i = 0; i < 2; i++) {
      await app.locator('#helperSettingsButton').click(); await app.waitForSelector('#helperSettingsForm');
      await back(); await focused('#helperSettingsButton', `Repeated Settings Back ${i + 1} keeps one parent`);
    }
    await history();
    await app.locator('[data-entry]').click();
    await app.waitForSelector('#painDetailsForm');
    await back(); await app.waitForSelector('.pain-history');
    await focused('.pain-content h2', 'Global Details Back restores history heading');
    await app.locator('[data-entry]').click();
    await app.locator('[data-pain="cancel"]').click(); await app.waitForSelector('.pain-history');
    await focused('.pain-content h2', 'Local Details Back uses the same history parent');
    await back(); await app.waitForSelector('.pain-last-value');
    await focused('.pain-content h2', 'History Back restores helper heading');
    await app.locator('[data-pain="same-area"]').click();
    await app.locator('input[name="intensity"][value="5"]').check();
    await back(); await app.waitForSelector('.pain-last-value');
    await focused('.pain-content h2', 'Unsaved intensity Back restores summary without saving');
    await app.locator('[data-pain="another"]').click();
    await app.locator('input[name="bodyArea"][value="Kopf"]').check();
    await app.locator('#painAreaForm button').click(); await app.waitForSelector('#painEntryForm');
    await app.locator('input[name="intensity"][value="6"]').check();
    for (let i = 0; i < 2; i++) {
      await app.locator('[data-pain="change-area"]').click();
      await app.waitForSelector('#painAreaForm');
      await app.locator('#painAreaForm button').click();
      await app.waitForSelector('#painEntryForm');
    }
    check(await app.locator('input[name="intensity"][value="6"]').isChecked(), 'Repeated area changes preserve intensity without accumulating parents');
    await back(); await app.waitForSelector('#painAreaForm');
    check(await app.locator('input[name="bodyArea"][value="Kopf"]').isChecked(), 'Global Back retains the selected body area');
    await focused('.pain-content legend', 'Question Back focuses the parent question');
    await back(); await app.waitForSelector('.pain-last-value');
    await back(); await home();
    await app.locator('#menuButton').click(); await app.locator('[data-view="people"]').click();
    await app.locator('[data-person="anna"]').click();
    await app.waitForFunction(() => document.querySelector('#focusTitle').textContent === 'Anna' && !document.querySelector('#readHost').hasAttribute('aria-busy'));
    await back();
    await focused('[data-person="anna"]', 'Person Back restores People and the selected-person trigger');
    await back(); await home();
    // Helper-specific back handlers must be discarded on unmount.
    await open('pain', '.pain-last-value'); await history();
    await app.locator('#helperSettingsButton').click(); await app.waitForSelector('#helperSettingsForm');
    await back(); await app.waitForSelector('.pain-last-value');
    await back(); await home();
    check(await app.locator('#backButton').isHidden(), 'Returning from settings clears old helper-internal parents');
    // Late settings and mount work cannot overwrite a newer view or steal its focus.
    await open('pain', '.pain-last-value');
    await app.evaluate(() => { window.navigationReadGate = new Promise(resolve => { window.releaseNavigationRead = resolve; }); });
    await app.locator('#helperSettingsButton').click();
    await back();
    await app.waitForSelector('#view-helper');
    await back(); await home();
    await app.locator('#menuButton').click(); await app.locator('[data-view="data"]').click();
    await app.evaluate(() => { window.navigationReadGate = null; window.releaseNavigationRead(); });
    await focused('#main', 'Aborted remount does not steal focus from the newer view');
    check(await app.locator('#view-data').isVisible() && await app.locator('#helperHost').textContent() === '', 'Late settings/mount work remains detached');
    await back(); await home();
    check(await snapshot() === before && await app.evaluate(() => window.navigationWrites === 0), 'Every Back path preserves all data, usage metadata and opens no write transactions');
    check(await app.evaluate(() => window.history.length) === historyLength, 'Internal Back does not add browser-history entries');
    // Browser Back remains ordinary document navigation; there is no SPA router.
    await app.goto('http://127.0.0.1:8080/README.md');
    await app.goto('http://127.0.0.1:8080/');
    await open('discount', '#discountForm');
    await app.goBack();
    check(app.url().endsWith('/README.md'), 'Browser Back leaves the app for the previous document');
    check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
    return results;
  } finally { await context.close(); }
}

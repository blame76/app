// Boundary checks for the narrow interval opt-out API, using isolated helper fixtures.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block' });
  const app = await context.newPage();
  const results = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); results.push(label); };
  await app.route('**/src/helpers/registry.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    export const HELPERS = [
      { id: 'interval-test', label: 'Intervalltest', category: 'Test', contexts: ['interval'], retention: { defaultWindow: 'always' }, mount({ root, api }) { window.intervalApi = api; root.textContent = 'Intervalltest geöffnet'; } },
      { id: 'plain-test', label: 'Ohne Intervall', category: 'Test', mount({ root, api }) { window.plainApi = api; root.textContent = 'Ohne Intervall geöffnet'; } }
    ];
  ` }));
  async function open(id) {
    await app.locator('.home-accordion').last().evaluate(el => { el.open = true; });
    await app.locator(`#allHelperList [data-helper="${id}"]`).click();
  }
  try {
    await app.goto('http://127.0.0.1:8080/');
    await app.waitForSelector('#allHelperList [data-helper="interval-test"]', { state: 'attached' });
    await open('plain-test');
    await app.waitForFunction(() => !!window.plainApi);
    check(await app.evaluate(async () => {
      try { await window.plainApi.disableContext('interval'); return false; } catch { return true; }
    }), 'A helper without the declared interval capability cannot disable it');
    await app.locator('#backButton').click();
    await open('interval-test');
    await app.waitForFunction(() => !!window.intervalApi);
    check(await app.evaluate(async () => {
      for (const value of ['place', 'time', 'active', 'foreign-helper', { interval: null }]) {
        let rejected = false;
        try { await window.intervalApi.disableContext(value); } catch { rejected = true; }
        if (!rejected) return false;
      }
      return (await (await import('/src/db.js')).list('helperRules')).length === 0;
    }), 'The API rejects all other context types and general mutation inputs without writes');
    check(await app.evaluate(async () => {
      const db = await import('/src/db.js');
      await db.put('helperRules', { id: 'interval-test', intervalMinutes: 60, toleranceMinutes: 15, trackingWindow: '7d', favorite: true });
      await db.put('entries', { id: 'old-entry', helperId: 'interval-test', createdAt: Date.now() - 8 * 86400000 });
      const before = JSON.stringify(await db.list('entries', { prune: false }));
      await window.intervalApi.disableContext('interval');
      const rule = await db.get('helperRules', 'interval-test');
      return JSON.stringify(await db.list('entries', { prune: false })) === before
        && rule.interval === null && rule.earlyBy === null && rule.trackingWindow === '7d' && rule.favorite
        && !Object.hasOwn(rule, 'intervalMinutes');
    }), 'Opt-out preserves even expired entries under finite retention and keeps all unrelated rules');
    await app.locator('#backButton').click();
    check(await app.evaluate(async () => {
      try { await window.intervalApi.disableContext('interval'); return false; }
      catch (error) { return error.name === 'AbortError'; }
    }), 'An unmounted helper cannot change its interval through a stale API');
    return results;
  } finally { await context.close(); }
}

// A real module-worker deployment test. Use a disposable server on :8081 with
// three built releases at /app/ and /__release?version=one|two|three to switch.
// No mocks of Service Worker, CacheStorage, IndexedDB or network/offline behavior.
async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 } });
  const app = await context.newPage();
  const results = [], errors = [];
  let navigations = 0;
  const check = (condition, label) => { if (!condition) throw new Error(label); results.push(label); };
  app.on('pageerror', error => errors.push(error.message));
  app.on('framenavigated', frame => { if (frame === app.mainFrame()) navigations++; });
  await context.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = query => query === '(display-mode: standalone)' ? { matches: true } : original(query);
  });
  const deploy = async version => {
    const response = await context.request.get(`http://127.0.0.1:8081/__release?version=${version}`);
    check(response.ok(), `Deploy ${version}`);
  };
  async function record() {
    return app.evaluate(async () => (await import('/app/src/db.js')).get('entries', 'update-note'));
  }
  try {
    await deploy('one');
    await app.goto('http://127.0.0.1:8081/app/');
    await app.evaluate(() => caches.open('foreign-cache'));
    await app.waitForFunction(() => navigator.serviceWorker.controller);
    await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
    check(navigations === 1, 'First installation claims the page without a reload');
    check(await app.locator('#installButton').isHidden(), 'Standalone window hides installation action');
    await app.locator('#menuButton').click();
    await app.locator('[data-view="settings"]').click();
    await app.locator('input[name="theme"][value="signature"]').check();
    await app.waitForFunction(() => document.documentElement.dataset.theme === 'signature' && !document.querySelector('#themeChoice').disabled);
    await app.locator('#backButton').click();
    await app.evaluate(async () => {
      const db = await import('/app/src/db.js');
      await db.put('entries', { id: 'update-note', type: 'note', text: 'Bleibt lokal.', createdAt: Date.now() });
    });
    const firstCache = await app.evaluate(async () => (await caches.keys()).find(key => key.startsWith('0815-')));
    await deploy('two');
    await app.evaluate(() => window.dispatchEvent(new Event('focus')));
    await app.waitForFunction(() => document.documentElement.dataset.release === 'two');
    await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
    check(navigations === 2, 'Foreground update automatically reloads the dashboard once');
    check(await app.getAttribute('html', 'data-theme') === 'signature', 'Deployment preserves the locally selected Signature mode');
    check((await record()).text === 'Bleibt lokal.', 'Update preserves IndexedDB content');
    await app.locator('#menuButton').click();
    await app.locator('[data-view="notes"]').click();
    await app.locator('[data-note="update-note"]').click();
    await app.locator('#noteEdit').click();
    await app.locator('#noteEditText').fill('Entwurf während des Deployments.');
    await app.evaluate(() => { window.beforeUpdate = navigator.serviceWorker.controller; });
    await deploy('three');
    await app.evaluate(() => window.dispatchEvent(new Event('online')));
    await app.waitForFunction(() => navigator.serviceWorker.controller !== window.beforeUpdate);
    check(await app.locator('#noteEditText').inputValue() === 'Entwurf während des Deployments.' && navigations === 2, 'Worker activation does not discard an unsaved edit');
    check((await record()).text === 'Bleibt lokal.', 'Update does not write the unsaved draft to storage');
    check(await app.locator('#toast').textContent().then(text => text.includes('Neue Version bereit.')), 'Deferred update announces itself through the existing status');
    await app.locator('#noteEditForm button[type="submit"]').click();
    await app.waitForSelector('#noteEdit');
    check((await record()).text === 'Entwurf während des Deployments.', 'Existing save commits the complete edit before reload');
    await app.locator('#backButton').click();
    await app.waitForSelector('[data-note="update-note"]');
    check(navigations === 2, 'Reading view remains open until the user returns home');
    await app.locator('#backButton').click();
    await app.waitForFunction(() => document.documentElement.dataset.release === 'three');
    await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
    check(navigations === 3, 'Returning home applies the deferred release once');
    const keys = await app.evaluate(() => caches.keys());
    check(keys.includes('foreign-cache') && keys.filter(key => key.startsWith('0815-')).length === 1 && !keys.includes(firstCache), 'Latest worker removes old app caches and preserves foreign caches');
    await context.setOffline(true);
    await app.reload();
    await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
    check(await app.getAttribute('html', 'data-release') === 'three' && (await record()).text === 'Entwurf während des Deployments.', 'Latest shell and local content survive a real offline reload');
    check(await app.getAttribute('html', 'data-theme') === 'signature' && await app.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()) === '#2447c7', 'Signature settings, module and stylesheet survive the offline reload');
    await app.evaluate(() => window.dispatchEvent(new Event('focus')));
    check(navigations === 4, 'Offline update checks do not reload or break the shell');
    check(errors.length === 0, `No unhandled browser errors: ${errors.join(', ')}`);
    return results;
  } catch (error) { throw new Error(`${error.message}; completed: ${results.join(' | ')}; page errors: ${errors.join(' | ')}`); }
  finally { await context.close(); }
}

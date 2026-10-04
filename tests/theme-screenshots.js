// Capture the same live records before and after theme integration. Compare PNGs
// from .playwright-mcp/theme-before-* / theme-after-* with the baseline pixels.
async (page) => {
  const phase = new URL(page.url()).searchParams.get('phase') === 'after' ? 'after' : 'before';
  const paths = [];
  for (const mode of ['light', 'dark']) {
    const context = await page.context().browser().newContext({ serviceWorkers: 'block', colorScheme: mode, timezoneId: 'Europe/Berlin' });
    const app = await context.newPage();
    try {
      await app.clock.setFixedTime(new Date('2026-10-04T16:00:00Z'));
      await app.goto('http://127.0.0.1:8080/');
      await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
      await app.evaluate(async () => {
        const db = await import('/src/db.js');
        const { HELPERS } = await import('/src/helpers/registry.js');
        const { helperDefaults } = await import('/src/helpers/contract.js');
        for (const helper of HELPERS) await db.put('helperRules', { ...helperDefaults(helper), favorite: true, timeBuckets: ['evening'] });
        for (const [id, text, offset] of [['one', 'Den langen Weg nach Hause nehmen.', 120000], ['two', 'Am Sonntag für alle kochen. Nicht viel planen. Ein großer Tisch reicht.', 3600000], ['three', 'Heute war der Kopf zum ersten Mal seit Tagen still. Vielleicht lag es am Spaziergang.\n\nDas möchte ich öfter machen.', 86400000]]) {
          await db.put('entries', { id, type: 'note', text, createdAt: Date.now() - offset, context: { timeBuckets: ['evening'] } });
        }
      });
      await app.reload();
      await app.waitForSelector('#nowRows [data-note="one"]');
      if (phase === 'after') await app.emulateMedia({ colorScheme: mode === 'dark' ? 'light' : 'dark' });
      for (const width of [390, 1280]) {
        await app.setViewportSize({ width, height: width === 390 ? 844 : 960 });
        async function shot(screen) {
          await app.mouse.move(0, 0);
          await app.evaluate(() => { document.querySelector('#toast').hidden = true; });
          const path = `/home/benjamin-lam/Projekte/blame76/app/.playwright-mcp/theme-${phase}-${mode}-${width}-${screen}.png`;
          await app.screenshot({ path, fullPage: true, animations: 'disabled' }); paths.push(path);
        }
        await shot('dashboard');
        await app.locator('#nowRows [data-helper="pain"]').click();
        await app.locator('input[name="bodyArea"][value="Rücken"]').check();
        await app.locator('#painAreaForm button[type="submit"]').click();
        await app.locator('input[name="intensity"][value="4"]').check();
        await shot('pain');
        while (!await app.locator('#view-dashboard').isVisible()) await app.locator('#backButton').click();
        await app.locator('#menuButton').click();
        await app.locator('[data-view="notes"]').click();
        await app.waitForSelector('#readHost [data-note="one"]');
        await shot('notes');
        await app.locator('#readHost [data-note="one"]').click();
        await app.waitForSelector('#noteEdit');
        await shot('detail');
        while (!await app.locator('#view-dashboard').isVisible()) await app.locator('#backButton').click();
      }
    } finally { await context.close(); }
  }
  return { phase, screenshots: paths.length };
}

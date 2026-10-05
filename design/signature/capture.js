// Run with the supplied Playwright browser tool (filename), no project dependency.
// Navigate to index.html?pass=1 or ?pass=2 before invoking this function.
async (page) => {
  const pass = new URL(page.url()).searchParams.get('pass') === '2' ? 'pass-2' : 'pass-1';
  const browser = page.context().browser();
  const checks = [], errors = [], requests = [];
  const check = (condition, label) => { checks.push({ label, passed: Boolean(condition) }); };
  const context = await browser.newContext({ serviceWorkers: 'block', timezoneId: 'Europe/Berlin', viewport: { width: 390, height: 844 } });
  const study = await context.newPage();
  study.on('pageerror', error => errors.push(error.message));
  study.on('request', request => requests.push(request.url()));
  const base = 'http://127.0.0.1:8080/design/signature/';
  try {
    for (const direction of ['a','b','c']) {
      for (const width of [390, 1280]) {
        await study.setViewportSize({ width, height: width === 390 ? 844 : 960 });
        for (const screen of ['dashboard','pain','notes','detail']) {
          await study.goto(`${base}?direction=${direction}&screen=${screen}&capture=1`);
          await study.locator('#main > section').waitFor();
          await study.screenshot({ path: `/home/benjamin-lam/Projekte/blame76/app/design/signature/screenshots/${pass}/${direction}-${width}-${screen}.png`, fullPage: true, animations: 'disabled' });
          check(await study.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${direction}/${screen}/${width}: no horizontal overflow`);
        }
      }
      for (const width of [320, 768]) {
        await study.setViewportSize({ width, height: 960 });
        for (const screen of ['dashboard','pain','notes','detail']) {
          await study.goto(`${base}?direction=${direction}&screen=${screen}&capture=1`);
          await study.locator('#main > section').waitFor();
          check(await study.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${direction}/${screen}/${width}: reflow`);
        }
      }
      await study.setViewportSize({ width: 320, height: 960 });
      for (const screen of ['dashboard','pain','notes','detail']) {
        await study.goto(`${base}?direction=${direction}&screen=${screen}&capture=1`);
        await study.locator('#main > section').waitFor();
        await study.addStyleTag({ content: ':root { font-size: 32px !important; }' });
        check(await study.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${direction}/${screen}: 200% text at 320px`);
      }
      await study.goto(`${base}?direction=${direction}&screen=pain&capture=1`);
      await study.locator('input[value="4"]').focus();
      await study.keyboard.press('ArrowRight');
      check(await study.locator('input[value="5"]').isChecked() && await study.locator('#painValue').textContent() === '5', `${direction}: keyboard radios update value`);
      check(await study.locator('.pain-choice:has(input:focus-visible)').evaluate(el => getComputedStyle(el).outlineWidth === '3px'), `${direction}: clear keyboard focus`);
      check(await study.locator('.pain-choice').evaluateAll(els => els.every(el => el.getBoundingClientRect().height >= 44)), `${direction}: radio touch targets`);
      await study.emulateMedia({ reducedMotion: 'reduce' });
      check(await study.locator('button').evaluateAll(els => els.every(el => getComputedStyle(el).transitionDuration === '0s')), `${direction}: reduced motion`);
      await study.emulateMedia({ reducedMotion: 'no-preference' });
      if (direction === 'a') {
        await study.setViewportSize({width:390,height:844});
        await study.goto(`${base}?direction=a&screen=dashboard&capture=1`);
        check(await study.locator('.home-accordion > summary').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 96), 'A: editorial gesture at least 6rem');
      }
    }
    check(errors.length === 0, `No page errors: ${errors.join(', ')}`);
    check(requests.every(url => url.startsWith('http://127.0.0.1:8080/')), 'Only local resources');
    check(!requests.some(url => /sw\.js/.test(url)), 'Studies do not register a service worker');
    return { pass, screenshots: 24, checks };
  } finally { await context.close(); }
}

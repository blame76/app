// Supplied Playwright browser; run from ?pass=1 or ?pass=2. No dependencies.
async (page) => {
  const pass = new URL(page.url()).searchParams.get('pass') === '2' ? 'pass-2' : 'pass-1';
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', timezoneId: 'Europe/Berlin', viewport: { width: 390, height: 844 } });
  const study = await context.newPage();
  const checks = [], errors = [], requests = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
  study.on('pageerror', error => errors.push(error.message));
  study.on('request', request => requests.push(request.url()));
  const base = 'http://127.0.0.1:8080/design/signature-v2/';
  const screens = ['dashboard', 'notes', 'detail', 'pain'];
  const open = async (direction, screen) => {
    await study.goto(`${base}?direction=${direction}&screen=${screen}&capture=1`);
    await study.locator('#main > section').waitFor();
    await study.mouse.move(0, 0);
  };
  async function inspect(label) {
    check(await study.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: reflow`);
    const failures = await study.evaluate(() => {
      const rgb = s => s.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = c => c.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      return [...document.querySelectorAll('body *')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && !['SCRIPT', 'STYLE', 'OPTION'].includes(e.tagName)).map(e => {
        const s = getComputedStyle(e); let a = e, b;
        while (a) { b = getComputedStyle(a).backgroundColor; if (b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') break; a = a.parentElement; }
        const x = lum(rgb(s.color)), y = lum(rgb(b));
        const ratio = (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
        const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
        return { text: e.textContent.slice(0, 40), ratio, min: large ? 3 : 4.5 };
      }).filter(v => v.ratio < v.min);
    });
    check(!failures.length, `${label}: AA text contrast ${JSON.stringify(failures)}`);
  }
  try {
    await study.clock.setFixedTime(new Date('2026-10-04T16:00:00Z'));
    for (const direction of ['a', 'b']) {
      for (const width of [390, 1280, 320, 768]) {
        await study.setViewportSize({ width, height: width === 390 ? 844 : 960 });
        for (const screen of screens) {
          await open(direction, screen); await inspect(`${direction}/${width}/${screen}`);
          if ([390, 1280].includes(width)) {
            await study.screenshot({ path: `/home/benjamin-lam/Projekte/blame76/app/design/signature-v2/screenshots/${pass}/${direction}-${width}-${screen}.png`, fullPage: true, animations: 'disabled' });
          }
        }
      }
      await study.setViewportSize({ width: 320, height: 960 });
      for (const screen of screens) {
        await open(direction, screen);
        await study.addStyleTag({ content: ':root { font-size: 32px !important; }' });
        await inspect(`${direction}/200%/${screen}`);
      }
      await open(direction, 'pain');
      await study.locator('input[value="4"]').focus(); await study.keyboard.press('ArrowRight');
      check(await study.locator('input[value="5"]').isChecked() && await study.locator('.pain-value-number').textContent() === '5', `${direction}: native keyboard radios update the value`);
      check(await study.locator('.pain-choice:has(input:focus-visible)').evaluate(el => getComputedStyle(el).outlineWidth === '3px'), `${direction}: keyboard focus`);
      check(await study.locator('.pain-number').evaluateAll(els => els.every(el => el.getBoundingClientRect().width >= 44 && el.getBoundingClientRect().height >= 44)), `${direction}: 44px number targets`);
      await study.emulateMedia({ reducedMotion: 'reduce' });
      check(await study.locator('button').evaluateAll(els => els.every(el => getComputedStyle(el).transitionDuration === '0s')), `${direction}: Reduced Motion`);
      await study.emulateMedia({ reducedMotion: 'no-preference' });
    }
    check(!errors.length, `No browser errors: ${errors.join(', ')}`);
    check(requests.every(url => url.startsWith('http://127.0.0.1:8080/')), 'Only local resources');
    check(!requests.some(url => /sw\.js|\/assets\/signature\.css|\/src\/app\.js/.test(url)), 'No rejected Signature styles, app bootstrap or worker');
    check(await study.evaluate(() => indexedDB.databases().then(dbs => dbs.length === 0)), 'Studies create no databases');
    return { pass, screenshots: 16, checks };
  } finally { await context.close(); }
}

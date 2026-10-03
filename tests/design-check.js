// Browser-only visual regression gate; use the supplied Playwright browser tool.
// Fixtures replace the registry response in an isolated context, never production files.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 700 } });
  const app = await context.newPage();
  const results = [];
  const errors = [];
  app.on('pageerror', error => errors.push(error.message));
  function check(condition, message) {
    if (!condition) throw new Error(message);
    results.push(message);
  }
  async function reflow(message) {
    check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), message);
  }
  await app.route('**/src/helpers/registry.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    export const HELPERS = [{ id: 'fixture', label: 'Testansicht', category: 'EineKategorieMitSehrLangemNamen', contexts: ['place', 'time', 'interval'], defaults: { timeBuckets: ['morning', 'midday', 'evening', 'night'] },
      mount({ root }) { root.innerHTML = '<label>Testeingabe<input id="fixtureInput"></label><button id="fixtureSave" type="button">Erfassen</button>'; return () => {}; }
    }];
  ` }));
  try {
    await app.goto('http://127.0.0.1:8080/');
    await app.waitForSelector('#nowRows [data-helper="fixture"]');
    await reflow('Dashboard fits 320 CSS px');
    // A visible Tab focus, including the native accordion, not just programmatic focus.
    await app.keyboard.press('Tab');
    check(await app.locator('.skip-link').evaluate(element => element === document.activeElement), 'First Tab reaches the visible skip link');
    await app.keyboard.press('Enter');
    check(await app.locator('#main').evaluate(element => element === document.activeElement), 'Skip link moves focus to main');
    const summary = app.locator('.home-accordion summary').first();
    await summary.focus();
    check(await summary.evaluate(element => getComputedStyle(element).outlineStyle === 'solid'), 'Accordion has a visible keyboard focus');
    await app.keyboard.press('Enter');
    check(await app.locator('.home-accordion').first().getAttribute('open') === null, 'Keyboard closes native accordion');
    check(!await app.locator('#nowRows [data-helper="fixture"]').isVisible(), 'Closed accordion hides helper controls');
    await app.keyboard.press('Space');
    check(await app.locator('#nowRows [data-helper="fixture"]').isVisible(), 'Keyboard reopens native accordion');
    await app.keyboard.press('Tab');
    check(await app.locator('#nowRows [data-helper="fixture"]').evaluate(element => element === document.activeElement), 'Tab reaches the open helper tile');
    await app.keyboard.press('Enter');
    await app.waitForSelector('#fixtureInput');
    check(await app.locator('#main').evaluate(element => element === document.activeElement), 'Navigation places focus on main');
    const accessibilityTree = await app.locator('body').ariaSnapshot();
    check(!accessibilityTree.includes('heading "Startseite"') && !accessibilityTree.includes('Alle Helfer') && !accessibilityTree.includes('Favoriten'), 'Focus view removes dashboard content from accessibility tree');
    check(await app.evaluate(() => [...document.querySelectorAll('[hidden]')].every(element => getComputedStyle(element).display === 'none')), 'All hidden elements respect display:none');
    await app.keyboard.press('Tab');
    check(await app.locator('#fixtureInput').evaluate(element => element === document.activeElement), 'Tab from main enters helper content, skipping hidden dashboard');
    await app.locator('#backButton').focus();
    await app.keyboard.press('Enter');
    await app.waitForSelector('#nowRows [data-helper="fixture"]');
    check(await app.locator('#view-dashboard').isVisible() && (await app.locator('#view-dashboard').ariaSnapshot()).includes('heading "Startseite"'), 'Keyboard Back returns to dashboard with an accessible page heading');
    await app.getByText('Alle Helfer', { exact: true }).click();
    await reflow('Search and long category fit 320 CSS px');
    await app.locator('#allHelperList [data-helper="fixture"]').click();
    await reflow('Helper focus view fits 320 CSS px');
    await app.locator('#helperSettingsButton').click();
    await app.waitForSelector('#helperSettingsForm');
    await reflow('Helper settings fit 320 CSS px');
    await app.locator('#backButton').click();
    await app.locator('[data-composer="person"]').click();
    await app.waitForSelector('#personForm');
    await reflow('Person composer fits 320 CSS px');
    await app.setViewportSize({ width: 320, height: 480 });
    await app.locator('#personForm button[type="submit"]').focus();
    check(await app.locator('#personForm button').evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const footer = document.querySelector('.action-footer').getBoundingClientRect();
      return bounds.top >= 0 && bounds.bottom <= footer.top;
    }), 'Composer scroll keeps submit reachable above footer on a short viewport');
    await app.locator('#quickComposerClose').click();
    await app.locator('#backButton').click();
    await app.setViewportSize({ width: 320, height: 700 });
    await app.locator('#menuButton').click();
    await app.getByRole('button', { name: 'Daten', exact: true }).click();
    await reflow('Data view fits 320 CSS px');
    await app.locator('#importInput').focus();
    check(await app.locator('.import-control label').evaluate(element => getComputedStyle(element).outlineStyle === 'solid'), 'Import control keeps visible focus');
    await app.emulateMedia({ reducedMotion: 'reduce' });
    check(await app.locator('#exportButton').evaluate(element => getComputedStyle(element).transitionDuration.split(',').every(value => parseFloat(value) === 0)), 'Reduced Motion disables transitions');
    check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
    return results;
  } finally { await context.close(); }
}

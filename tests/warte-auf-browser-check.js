// Real helper and IndexedDB; the date is fixed for deterministic resurface tests.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 700 }, timezoneId: 'Europe/Berlin' });
  const app = await context.newPage();
  const results = [];
  const errors = [];
  const check = (condition, label) => { if (!condition) throw new Error(label); results.push(label); };
  const entries = () => app.evaluate(async () => (await (await import('/src/db.js')).list('entries')).filter(entry => entry.helperId === 'warte-auf'));
  const usage = () => app.evaluate(async () => (await (await import('/src/db.js')).get('settings', 'usage:warte-auf'))?.lastUsedAt);
  async function open() {
    await app.locator('.home-accordion').last().evaluate(element => { element.open = true; });
    await app.locator('#allHelperList [data-helper="warte-auf"]').click();
    await app.waitForSelector('#warteAufCreateForm');
  }
  async function create(text, expectedDate = '') {
    const form = app.locator('#warteAufCreateForm');
    await form.locator('[name="text"]').fill(text);
    if (expectedDate) await form.locator('[name="expectedDate"]').fill(expectedDate);
    await form.locator('button[type="submit"]').click();
    await app.waitForFunction(() => !document.querySelector('#helperHost [aria-busy="true"]'));
  }
  app.on('pageerror', error => errors.push(error.message));
  try {
    await app.addInitScript(() => {
      const NativeDate = Date;
      window.testNow = new NativeDate('2026-10-05T10:00:00+02:00').getTime();
      window.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [window.testNow])); }
        static now() { return window.testNow; }
      };
    });
    await app.goto('http://127.0.0.1:8080/');
    await app.waitForSelector('#allHelperList [data-helper="warte-auf"]', { state: 'attached' });
    check(await usage() === undefined && (await entries()).length === 0, 'Opening the helper does not record use or create an entry');
    await open();
    check(await app.locator('#warteAufTitle').evaluate(element => element === document.activeElement), 'Opening focuses the accessible helper heading');
    await create('Versicherung meldet sich');
    const minimal = (await entries())[0];
    check(minimal.text === 'Versicherung meldet sich' && minimal.status === 'waiting' && !minimal.expectedDate, 'The minimum entry needs only text');
    check(await usage() === minimal.createdAt, 'Successful commit records use after saving');
    await app.locator('#warteAufCreateForm [name="text"]').fill('Restaurant-Link von Anna');
    await app.locator('#warteAufCreateForm [name="waitingForText"]').fill('Anna');
    await app.locator('#warteAufCreateForm [name="expectedDate"]').fill('2026-10-05');
    await app.locator('#warteAufCreateForm button[type="submit"]').click();
    await app.waitForSelector('.warte-auf-group h3:text("Wieder im Blick")');
    let dueText = 'Restaurant-Link von Anna';
    const due = (await entries()).find(entry => entry.text === dueText);
    check(due.waitingForText === 'Anna' && due.expectedDate === '2026-10-05', 'Free text and date are stored as local, optional fields');
    check(await app.locator('.warte-auf-group h3').first().textContent() === 'Wieder im Blick', 'The date reached today is immediately relevant');
    await app.locator('.warte-auf-item').filter({ hasText: dueText }).click();
    await app.waitForSelector('.warte-auf-detail-actions');
    check((await app.locator('#helperHost').textContent()).includes('heute, 5. Oktober') || (await app.locator('#helperHost').textContent()).includes('5. Oktober'), 'Detail describes the planned resurfacing date');
    await app.locator('#backButton').click();
    await app.waitForSelector('#warteAufCreateForm');
    check((await entries()).find(entry => entry.id === due.id).status === 'waiting'
      && (await entries()).find(entry => entry.id === due.id).expectedDate === '2026-10-05'
      && await app.locator('.warte-auf-item').filter({ hasText: dueText }).count() === 1,
    'Opening and returning does not acknowledge or reset a reached item');
    await app.locator('#backButton').click();
    await open();
    check(await app.locator('.warte-auf-item').filter({ hasText: dueText }).count() === 1, 'Closing and reopening 0815 keeps the reached item visible');
    await app.locator('.warte-auf-item').filter({ hasText: dueText }).click();
    await app.locator('.warte-auf-detail-actions button').filter({ hasText: 'Bearbeiten' }).click();
    check(await app.locator('#warteAufEditForm [name="expectedDate"]').count() === 0, 'Only Weiter warten can change the resurfacing date');
    dueText = 'Restaurant-Link von Anna (aktualisiert)';
    await app.locator('#warteAufEditForm [name="text"]').fill(dueText);
    await app.locator('#warteAufEditForm button[type="submit"]').click();
    await app.waitForSelector('#warteAufCreateForm');
    check((await entries()).find(entry => entry.id === due.id).expectedDate === '2026-10-05'
      && await app.locator('.warte-auf-item').filter({ hasText: dueText }).count() === 1,
    'Editing descriptive text preserves an active resurfacing date');
    await app.locator('.warte-auf-item').filter({ hasText: dueText }).click();
    await app.locator('.warte-auf-detail-actions button').filter({ hasText: 'Weiter warten' }).click();
    await app.locator('#warteAufWaitForm [name="expectedDate"]').fill('2026-10-09');
    await app.locator('#warteAufWaitForm button[type="submit"]').click();
    await app.waitForSelector('#warteAufCreateForm');
    check((await entries()).find(entry => entry.id === due.id).expectedDate === '2026-10-09'
      && await app.locator('.warte-auf-group h3').first().textContent() !== 'Wieder im Blick',
    'Only the explicit reschedule removes the item from the due group');
    await app.locator('.warte-auf-item').filter({ hasText: dueText }).click();
    await app.locator('.warte-auf-detail-actions button').filter({ hasText: 'Erledigt' }).click();
    await app.waitForSelector('#warteAufCreateForm');
    check((await entries()).find(entry => entry.id === due.id).status === 'done'
      && !!(await entries()).find(entry => entry.id === due.id).completedAt
      && await app.locator('.warte-auf-completed summary').textContent() === 'Erledigt (1)',
    'Done ends only the waiting state without evaluating the person');
    check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Waiting flow fits 320 CSS px');
    check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
    return results;
  } finally {
    await context.close();
  }
}

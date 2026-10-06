// Real product flows with real IndexedDB and place snapshots; run in the supplied Playwright browser.
async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 320, height: 760 } });
  const app = await context.newPage();
  const results = [];
  const errors = [];
  const requests = [];
  app.on('pageerror', error => errors.push(error.message));
  app.on('request', request => requests.push(request.url()));
  function check(condition, label) {
    if (!condition) throw new Error(label);
    results.push(label);
  }
  async function seedPlace(id, name, lon = 8) {
    await app.evaluate(async ({ id, name, lon }) => {
      const db = await import('/src/db.js');
      const { HELPERS } = await import('/src/helpers/registry.js');
      const { helperDefaults } = await import('/src/helpers/contract.js');
      const helper = HELPERS.find(item => item.id === 'training');
      const rule = await db.get('helperRules', 'training') || helperDefaults(helper);
      await db.put('places', { id, name, lat: 50, lon, radius: 250, createdAt: 1 });
      await db.put('helperRules', { ...rule, placeIds: [id] });
    }, { id, name, lon });
    await app.locator('#brandButton').click();
    await app.waitForFunction(id => document.querySelector(`#nowRows [data-helper="training"][data-place-id="${id}"]`), id);
  }
  async function openAtPlace(id, name) {
    await app.locator(`#nowRows [data-helper="training"][data-place-id="${id}"]`).click();
    await app.waitForSelector('#trainingStart, [data-training="continue"]');
    check(await app.locator('.training-place').textContent() === name, `${name} place snapshot reaches the helper`);
  }
  async function addActivity(name, mode) {
    const form = app.locator('#trainingActivityForm');
    await form.locator('input[name="name"]').fill(name);
    await form.locator(`input[name="mode"][value="${mode}"]`).check();
    await form.locator('button[type="submit"]').click();
    await app.waitForSelector(`.training-activity h3:text-is("${name}")`);
  }
  async function sessionData() {
    return app.evaluate(async () => (await (await import('/src/db.js')).list('entries', { prune: false })).filter(entry => entry.helperId === 'training'));
  }
  async function startNew() {
    await app.locator('#trainingStart').click();
    await app.waitForSelector('#trainingActivityForm, .training-reference');
  }
  async function finish() {
    await app.locator('[data-training="finish"]').click();
    await app.waitForSelector('.training-complete-title, #trainingStart');
  }
  async function homeFlow() {
    await seedPlace('home', 'Zuhause');
    await openAtPlace('home', 'Zuhause');
    check(await app.locator('.training-context').textContent() === 'Hier noch kein Training dokumentiert.', 'Home never falls back to a session from another place');
    await app.keyboard.press('Tab');
    check(await app.locator('#trainingStart').evaluate(element => element === document.activeElement && getComputedStyle(element).outlineStyle === 'solid'), 'Keyboard reaches the start action with visible focus at 320 CSS px');
    await app.keyboard.press('Enter');
    await app.waitForSelector('#trainingActivityForm');
    check(await app.locator('.training-status').textContent() === 'Gut, dass du da bist.', 'Training start gives the single quiet welcome');
    await addActivity('Rudermaschine', 'duration');
    await app.locator('[data-activity-form="a1"] input[name="duration"]').fill('45');
    await app.locator('[data-activity-form="a1"] button').click();
    await app.waitForFunction(() => document.querySelector('.training-today')?.textContent.includes('45 Min.'));
    await addActivity('Pilates', 'duration');
    await app.locator('[data-activity-form="a2"] input[name="duration"]').fill('30');
    await app.locator('[data-activity-form="a2"] button').click();
    await app.waitForFunction(() => document.querySelectorAll('.training-today').length === 2);
    check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Home training form fits 320 CSS px');
    await app.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Home training form reflows at 200% text');
    await app.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await finish();
    check((await app.locator('.training-summary-list').textContent()).includes('Rudermaschine') && (await app.locator('.training-summary-list').textContent()).includes('Pilates'), 'Home completion summarizes both recorded activities');
    let stored = await sessionData();
    const homeSession = stored.find(item => item.status === 'ended');
    check(homeSession.place.id === 'home' && homeSession.activities[0].durationSeconds === 2700 && homeSession.activities[1].durationSeconds === 1800, 'Home workout persists place and numeric duration values');
    check(await app.evaluate(async () => !!(await (await import('/src/db.js')).get('settings', 'usage:training'))), 'Successful completion records usage after saving');
    await app.locator('[data-training="home"]').click();
    await app.locator('#backButton').click();
    await app.waitForSelector('#view-dashboard');
    await openAtPlace('home', 'Zuhause');
    check(await app.locator('.training-context').textContent() === 'Letztes Training hier heute', 'Dashboard-launched Home view names its same-place reference');
    await startNew();
    await app.waitForSelector('.training-reference');
    check((await app.locator('.training-summary-list').textContent()).includes('45 Min.') && (await app.locator('.training-summary-list').textContent()).includes('30 Min.'), 'Home reference shows last documented measurements');
    await app.locator('[data-training="repeat"]').click();
    await app.waitForSelector('.training-activity');
    check(await app.locator('.training-activity').count() === 2 && await app.locator('.training-today').count() === 0, 'Repeating Home copies the structure but no current results');
    stored = await sessionData();
    const active = stored.find(item => item.status === 'active');
    check(active.basedOnSessionId === homeSession.id && active.activities.every(activity => activity.durationSeconds === undefined), 'Repeated Home session stores only structure and its source reference');
    await app.reload();
    await app.waitForSelector('#nowRows [data-helper="training"]');
    await app.locator('#nowRows [data-helper="training"]').click();
    await app.waitForSelector('[data-training="continue"]');
    check(await app.locator('.training-open-note').textContent() === 'Training ist noch offen.', 'Active Home session survives reload');
    await app.locator('[data-training="continue"]').click();
    await app.waitForSelector('#trainingActivityForm');
    await finish();
    check((await sessionData()).every(item => item.status !== 'active'), 'Ending an untouched repeated session removes the empty active record');
    await app.locator('#backButton').click();
  }
  async function gymFlow() {
    await seedPlace('gym', 'Gym', 8.001);
    await openAtPlace('gym', 'Gym');
    await startNew();
    await app.locator('#trainingTitleForm input').fill('Arme');
    await app.locator('#trainingTitleForm button').click();
    await app.waitForFunction(() => document.querySelector('.training-title-current')?.textContent === 'Arme');
    await addActivity('Laufband', 'distance');
    await app.locator('[data-activity-form="a1"] input[name="distance"]').fill('3');
    await app.locator('[data-activity-form="a1"] input[name="duration"]').fill('20');
    await app.locator('[data-activity-form="a1"] button').click();
    await app.waitForFunction(() => document.querySelector('.training-today')?.textContent.includes('3 km'));
    await addActivity('Bizepsmaschine', 'sets');
    for (const reps of ['10', '9', '8']) {
      const form = app.locator('[data-activity-form="a2"]');
      await form.locator('input[name="weightKg"]').fill('45');
      await form.locator('input[name="reps"]').fill(reps);
      await form.locator('button').click();
      await app.waitForFunction(value => [...document.querySelectorAll('.training-activity')][1]?.querySelector('.training-today')?.textContent.includes(value), reps);
    }
    await addActivity('Trizepsmaschine', 'sets');
    for (const [index, reps] of ['12', '10', '10'].entries()) {
      const form = app.locator('[data-activity-form="a3"]');
      await form.locator('input[name="weightKg"]').fill('35');
      await form.locator('input[name="reps"]').fill(reps);
      await form.locator('button').click();
      const expected = ['12', '12 / 10', '12 / 10 / 10'][index];
      await app.waitForFunction(value => [...document.querySelectorAll('.training-activity')][2]?.querySelector('.training-today')?.textContent.includes(value), expected);
    }
    check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Gym training form fits 320 CSS px');
    await finish();
    let stored = await sessionData();
    const gymSession = stored.find(item => item.status === 'ended' && item.place?.id === 'gym');
    check(gymSession.title === 'Arme' && gymSession.activities[0].distanceMeters === 3000 && gymSession.activities[1].sets.length === 3, 'Gym training persists title, distance and multiple sets');
    await app.locator('[data-training="home"]').click();
    await app.locator('#backButton').click();
    await app.waitForSelector('#view-dashboard');
    await openAtPlace('gym', 'Gym');
    await startNew();
    await app.waitForSelector('.training-reference');
    check((await app.locator('.training-summary-list').textContent()).includes('3 km') && (await app.locator('.training-summary-list').textContent()).includes('45 kg · 10 / 9 / 8'), 'Gym reference displays the prior mixed activity types');
    await app.locator('[data-training="repeat"]').click();
    await app.waitForSelector('.training-activity');
    check(await app.locator('.training-activity').count() === 3 && await app.locator('.training-today').count() === 0, 'Repeating Gym preserves three activity slots without marking them done');
    await app.locator('[data-activity-form="a1"] input[name="distance"]').fill('3.2');
    await app.locator('[data-activity-form="a1"] input[name="duration"]').fill('21');
    await app.locator('[data-activity-form="a1"] button').click();
    await app.waitForFunction(() => document.querySelector('.training-today')?.textContent.includes('3,2 km'));
    const biceps = app.locator('[data-activity-form="a2"]');
    await biceps.locator('input[name="weightKg"]').fill('45');
    await biceps.locator('input[name="reps"]').fill('10');
    await biceps.locator('button').click();
    await app.waitForFunction(() => document.querySelectorAll('.training-today').length === 2);
    const triceps = app.locator('[data-activity-form="a3"]');
    await triceps.locator('input[name="weightKg"]').fill('35');
    await triceps.locator('input[name="reps"]').fill('12');
    await triceps.locator('button').click();
    await app.waitForFunction(() => document.querySelectorAll('.training-today').length === 3);
    await finish();
    const summary = await app.locator('.training-summary-list').textContent();
    check(summary.includes('3,2 km · 21 Min.') && summary.includes('Letztes Mal') && summary.includes('45 kg · 10 / 9 / 8'), 'Gym completion gives factual Today/Last Time comparisons');
    stored = await sessionData();
    check(stored.filter(item => item.status === 'ended').length === 3 && stored.every(item => item.status !== 'active'), 'Gym completion commits without retaining an active draft');
    check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
    check(requests.every(url => url.startsWith('http://127.0.0.1:8080/')), 'Training makes no external requests');
  }
  await app.addInitScript(() => {
    window.trainingPosition = { lat: 50, lon: 8 };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition(success) { success({ coords: { latitude: window.trainingPosition.lat, longitude: window.trainingPosition.lon, accuracy: 5 } }); },
      watchPosition(success) { success({ coords: { latitude: window.trainingPosition.lat, longitude: window.trainingPosition.lon, accuracy: 5 } }); return 1; },
      clearWatch() {}
    } });
  });
  try {
    await app.goto('http://127.0.0.1:8080/');
    await app.waitForSelector('#allHelperList [data-helper="training"]', { state: 'attached' });
    await homeFlow();
    await gymFlow();
    return results;
  } finally {
    await context.close();
  }
}

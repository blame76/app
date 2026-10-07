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
    const details = app.locator('.training-add');
    if (!await details.evaluate(element => element.open)) await details.locator('summary').click();
    const form = app.locator('#trainingActivityForm');
    await form.locator('input[name="name"]').fill(name);
    await form.locator(`input[name="mode"][value="${mode}"]`).check();
    await form.locator('button[type="submit"]').click();
    await app.waitForSelector(`.training-activity h3:text-is("${name}")`);
  }
  async function sessionData() {
    return app.evaluate(async () => (await (await import('/src/db.js')).list('entries', { prune: false })).filter(entry => entry.helperId === 'training'));
  }
  async function startNew(title = '') {
    await app.locator('#trainingStart').click();
    await app.waitForSelector('#trainingStartForm');
    if (title) {
      await app.locator('#trainingStartForm input').fill(title);
      await app.locator('#trainingStartForm [type="submit"]').click();
    } else await app.locator('[data-training="without-title"]').click();
    await app.waitForSelector('#trainingActivityForm');
  }
  async function showLatestDetails() {
    await app.locator('[data-training="history"]').click();
    await app.locator('.training-quick-choices button').first().click();
    await app.waitForSelector('.training-reference');
  }
  async function checkSaved(id, count, expected) {
    const rows = app.locator(`#${id}-heading`).locator('..').locator('..').locator('.training-saved-list li');
    await app.waitForFunction(({ id, count }) => document.querySelector(`#${id}-heading`)?.closest('.training-activity').querySelectorAll('.training-saved-list li').length === count, { id, count });
    check(await rows.last().isVisible() && (await rows.last().textContent()).includes(expected), `${id}: saved row ${count} is visible with ${expected}`);
    check(await rows.last().evaluate(element => element === document.activeElement), `${id}: focus moves to the saved result, not an input`);
  }
  async function finish() {
    await app.locator('[data-training="finish"]').click();
    await app.waitForSelector('.training-complete-title, #trainingStart');
  }
  async function homeFlow() {
    await seedPlace('home', 'Zuhause');
    await openAtPlace('home', 'Zuhause');
    check(await app.locator('.training-context').textContent() === 'Hier noch kein Training dokumentiert.', 'Home never falls back to a session from another place');
    check(await app.locator('[data-training="history"], [data-training="repeat"]').count() === 0, 'First use has no empty history or repeat controls');
    check((await sessionData()).length === 0, 'Opening training does not create a session');
    await app.keyboard.press('Tab');
    check(await app.locator('#trainingStart').evaluate(element => element === document.activeElement && getComputedStyle(element).outlineStyle === 'solid'), 'Keyboard reaches the start action with visible focus at 320 CSS px');
    await app.keyboard.press('Enter');
    await app.waitForSelector('#trainingStartForm');
    check(await app.locator('.training-status').textContent() === 'Gut, dass du da bist.', 'Training start gives the single quiet welcome');
    check(await app.locator('#trainingActivityForm').count() === 0 && (await app.locator('#trainingTitleHint').textContent()).includes('wiederzufinden'), 'Start explains the optional name before asking for activities');
    await app.locator('[data-training="without-title"]').click();
    await addActivity('Rudermaschine', 'duration');
    await app.locator('[data-activity-form="a1"] input[name="duration"]').fill('45');
    await app.locator('[data-activity-form="a1"] button').click();
    await app.waitForFunction(() => document.querySelector('.training-today')?.textContent.includes('45 Min.'));
    await checkSaved('a1', 1, '45 Min.');
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
    await showLatestDetails();
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
    await app.waitForSelector('.training-editor-title');
    await finish();
    check((await sessionData()).every(item => item.status !== 'active'), 'Ending an untouched repeated session removes the empty active record');
    await app.locator('#backButton').click();
  }
  async function gymFlow() {
    await seedPlace('gym', 'Gym', 8.001);
    await openAtPlace('gym', 'Gym');
    await startNew('Oberkörper');
    check(await app.locator('.training-title-current').textContent() === 'Oberkörper', 'Named training is visible in the editor');
    await addActivity('Laufband', 'distance');
    await app.locator('[data-activity-form="a1"] input[name="distance"]').fill('3');
    await app.locator('[data-activity-form="a1"] input[name="duration"]').fill('20');
    await app.locator('[data-activity-form="a1"] button').click();
    await app.waitForFunction(() => document.querySelector('.training-today')?.textContent.includes('3 km'));
    await checkSaved('a1', 1, '3 km · 20 Min.');
    await addActivity('Bizepsmaschine', 'sets');
    for (const [index, reps] of ['10', '9', '8'].entries()) {
      const form = app.locator('[data-activity-form="a2"]');
      await form.locator('input[name="weightKg"]').fill('45');
      await form.locator('input[name="reps"]').fill(reps);
      await form.locator('button').click();
      await checkSaved('a2', index + 1, `Satz ${index + 1} · 45 kg × ${reps}`);
      check(await form.locator('input[name="weightKg"]').inputValue() === '45' && await form.locator('input[name="reps"]').inputValue() === '', 'Next set keeps weight and clears repetitions');
      check((await app.locator('.training-status').textContent()).includes(`Satz ${index + 1} gespeichert: 45 Kilogramm, ${reps} Wiederholungen`), 'Live status confirms the committed set with its values');
    }
    await addActivity('Trizepsmaschine', 'sets');
    for (const [index, reps] of ['12', '10', '10'].entries()) {
      const form = app.locator('[data-activity-form="a3"]');
      await form.locator('input[name="weightKg"]').fill('35');
      await form.locator('input[name="reps"]').fill(reps);
      await form.locator('button').click();
      await checkSaved('a3', index + 1, `Satz ${index + 1} · 35 kg × ${reps}`);
    }
    await removeRegression();
    check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Gym training form fits 320 CSS px');
    await finish();
    let stored = await sessionData();
    const gymSession = stored.find(item => item.status === 'ended' && item.place?.id === 'gym');
    check(gymSession.title === 'Oberkörper' && gymSession.activities[0].distanceMeters === 3000 && gymSession.activities[1].sets.length === 3, 'Gym training persists title, distance and multiple sets');
    await app.locator('[data-training="home"]').click();
    await app.locator('#backButton').click();
    await app.waitForSelector('#view-dashboard');
    await openAtPlace('gym', 'Gym');
    await showLatestDetails();
    check((await app.locator('.training-summary-list').textContent()).includes('3 km') && (await app.locator('.training-summary-list').textContent()).includes('45 kg · 10 / 9 / 8'), 'Gym reference displays the prior mixed activity types');
    await app.locator('[data-training="repeat"]').click();
    await app.waitForSelector('.training-activity');
    check(await app.locator('.training-title-current').textContent() === 'Oberkörper' && await app.locator('#trainingTitleForm input').inputValue() === 'Oberkörper', 'Repeating selected Oberkörper retains its visible and prefilled title');
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
    await selectionFlow();
    check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
    check(requests.every(url => url.startsWith('http://127.0.0.1:8080/')), 'Training makes no external requests');
  }
  async function usageData() {
    return app.evaluate(async () => (await (await import('/src/db.js')).get('settings', 'usage:training')) || null);
  }
  async function removeRegression() {
    const before = (await sessionData()).find(entry => entry.status === 'active').activities;
    const usageBefore = JSON.stringify(await usageData());
    await addActivity('Falsche Aktivität', 'sets');
    await app.locator('[data-remove-activity="3"]').click();
    await app.waitForFunction(() => document.querySelectorAll('.training-activity').length === 3);
    check(JSON.stringify((await sessionData()).find(entry => entry.status === 'active').activities) === JSON.stringify(before), 'Remove deletes the added activity from UI and persistence while leaving other activities unchanged');
    await addActivity('Entfernen mit Werten', 'duration');
    await app.locator('[data-activity-form="a4"] input').fill('5');
    await app.locator('[data-activity-form="a4"] button').click();
    await checkSaved('a4', 1, '5 Min.');
    app.once('dialog', dialog => dialog.dismiss());
    await app.locator('[data-remove-activity="3"]').click();
    check((await sessionData()).find(entry => entry.status === 'active').activities.length === 4, 'Cancel removal preserves an activity with documented values');
    app.once('dialog', dialog => dialog.accept());
    await app.locator('[data-remove-activity="3"]').click();
    await app.waitForFunction(() => document.querySelectorAll('.training-activity').length === 3);
    check(JSON.stringify((await sessionData()).find(entry => entry.status === 'active').activities) === JSON.stringify(before), 'Confirmed removal deletes only that activity and its values');
    check(JSON.stringify(await usageData()) === usageBefore, 'Adding, recording and removing activities does not record a completed use');
    const rows = await app.locator('#a2-heading').locator('..').locator('..').locator('.training-saved-list li').allTextContents();
    check(rows.length === 3 && rows.every((row, index) => row.includes(`Satz ${index + 1} · 45 kg × ${[10, 9, 8][index]}`)), 'Multiple saved sets remain individually visible in their original order');
  }
  async function selectionFlow() {
    await app.locator('[data-training="home"]').click();
    check(await app.locator('[data-training="repeat"]').textContent() === 'Oberkörper wiederholen', 'Home offers the latest named training as the primary repeat action');
    for (const [title, name, mode, value] of [['Beine', 'Beinpresse', 'sets', '12'], ['Ausdauer', 'Laufband', 'distance', '5']]) {
      await startNew(title);
      await addActivity(name, mode);
      await app.locator(`[data-activity-form="a1"] input[name="${mode === 'sets' ? 'reps' : 'distance'}"]`).fill(value);
      await app.locator('[data-activity-form="a1"] button').click();
      await checkSaved('a1', 1, mode === 'sets' ? '12 Wiederholungen' : '5 km');
      await finish();
      await app.locator('[data-training="home"]').click();
    }
    const usageBefore = JSON.stringify(await usageData());
    await app.locator('[data-training="history"]').click();
    const labels = await app.locator('.training-quick-choices button > strong').allTextContents();
    check(['Oberkörper', 'Beine', 'Ausdauer'].every(label => labels.includes(label)), 'All three named trainings are reachable in the quick history selection');
    check(labels.filter(label => label === 'Oberkörper').length === 1, 'Quick selection shows only the latest Oberkörper session');
    await app.locator('.training-older > summary').click();
    const oldId = await app.locator('.training-older-choices button').first().getAttribute('data-session');
    await app.locator('.training-older-choices button').first().click();
    check((await app.locator('.training-summary-list').textContent()).includes('10 / 9 / 8'), 'Older sessions with the same title remain reachable with their saved values');
    await app.locator('#backButton').click();
    check(await app.locator('.training-older-choices button').first().evaluate(element => element === document.activeElement), 'Back restores focus to the older history choice');
    await app.locator('.training-older-choices button').first().click();
    await app.locator('[data-training="repeat"]').click();
    await app.waitForSelector('.training-editor-title');
    check((await sessionData()).find(entry => entry.status === 'active').basedOnSessionId === oldId, 'An older session can be repeated explicitly');
    check((await app.locator('.training-last').allTextContents()).some(text => text.includes('10 / 9 / 8')), 'The explicitly selected older values remain the reference in the editor');
    await finish();
    for (const title of ['Oberkörper', 'Beine', 'Ausdauer']) {
      await app.locator('[data-training="history"]').click();
      const button = app.locator('.training-quick-choices button').filter({ has: app.locator('strong', { hasText: title }) });
      await button.focus();
      await app.keyboard.press('Enter');
      await app.waitForSelector('.training-reference');
      check(await app.locator('.training .section-title').textContent() === title, `${title} selection is keyboard accessible and shows details`);
      await app.locator('[data-training="repeat"]').click();
      await app.waitForSelector('.training-editor-title');
      const active = (await sessionData()).find(entry => entry.status === 'active');
      check(active.title === title && active.activities.every(a => a.mode === 'sets' ? !a.sets.length : a.durationSeconds === undefined && a.distanceMeters === undefined), `${title} repeats only title, names, order and modes`);
      check(await app.locator('.training-title-current').textContent() === title && await app.locator('#trainingTitleForm input').inputValue() === title && await app.locator('.training-today').count() === 0, `${title} is visible and prefilled without any current results`);
      await finish();
    }
    check(JSON.stringify(await usageData()) === usageBefore, 'Reading history and ending empty repetitions never records use');
    await startNew();
    await app.locator('#trainingActivityForm input[name="name"]').fill('  LAUFBAND  ');
    check(await app.locator('input[name="mode"][value="distance"]').isChecked(), 'Known activity defaults to its latest mode after minimal name normalization');
    await app.locator('input[name="mode"][value="duration"]').focus();
    await app.keyboard.press('Space');
    check(await app.locator('input[name="mode"][value="duration"]').isChecked(), 'Mode cards remain keyboard operable and allow overriding a known activity');
    await app.locator('#trainingActivityForm button').click();
    await app.waitForSelector('[data-activity-form="a1"]');
    await app.locator('[data-activity-form="a1"] input').fill('7');
    await app.locator('[data-activity-form="a1"] button').click();
    await checkSaved('a1', 1, '7 Min.');
    await finish();
    await app.locator('[data-training="home"]').click();
    await startNew();
    await app.locator('#trainingActivityForm input[name="name"]').fill('Laufband');
    check(await app.locator('input[name="mode"][value="duration"]').isChecked(), 'Newest documented mode replaces the older distance default');
    // Fail the real IndexedDB write: the user must keep the form and see no false saved row.
    await app.locator('#trainingActivityForm button').click();
    await app.waitForSelector('[data-activity-form="a1"]');
    await app.evaluate(() => {
      window.trainingOriginalPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(value, ...args) {
        if (this.name === 'entries' && value.helperId === 'training') throw new DOMException('Test quota', 'QuotaExceededError');
        return window.trainingOriginalPut.call(this, value, ...args);
      };
    });
    await app.locator('[data-activity-form="a1"] input').fill('8');
    await app.locator('[data-activity-form="a1"] button').click();
    await app.waitForFunction(() => document.body.textContent.includes('Browser-Speicher voll.'));
    check(await app.locator('[data-activity-form="a1"] input').inputValue() === '8' && await app.locator('.training-today').count() === 0, 'Failed save retains the input and adds no false saved result');
    await app.evaluate(() => { IDBObjectStore.prototype.put = window.trainingOriginalPut; delete window.trainingOriginalPut; });
    await app.locator('[data-activity-form="a1"] button').click();
    await checkSaved('a1', 1, '8 Min.');
    await app.reload();
    await app.locator('#nowRows [data-helper="training"]').click();
    await app.locator('[data-training="continue"]').click();
    await app.waitForSelector('.training-editor-title');
    check((await app.locator('.training-today').textContent()).includes('8 Min.') && await app.locator('[data-training="history"]').count() === 0, 'Reload resumes the recorded working state directly');
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

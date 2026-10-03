// Real records and rendering in both palettes. Run with the supplied Playwright tool.
async (page) => {
  const results = [];
  function check(condition, label) { if (!condition) throw new Error(label); results.push(label); }
  for (const mode of ['light', 'dark']) {
    const context = await page.context().browser().newContext({ serviceWorkers: 'block', colorScheme: mode, timezoneId: 'Europe/Berlin', viewport: { width: 390, height: 844 } });
    const app = await context.newPage();
    const errors = [], requests = [];
    app.on('pageerror', error => errors.push(error.message));
    app.on('request', request => requests.push(request.url()));
    async function fits(label) { check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${mode}: ${label}`); }
    async function ready() { await app.waitForFunction(() => !document.querySelector('#readHost').hasAttribute('aria-busy')); }
    async function menu(view) { await app.locator('#menuButton').click(); await app.locator(`[data-view="${view}"]`).click(); await ready(); }
    async function home() {
      while (!await app.locator('#view-dashboard').isVisible()) await app.locator('#backButton').click();
      await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
    }
    async function open(id, selector) {
      await app.locator('.home-accordion').last().evaluate(element => { element.open = true; });
      await app.locator(`#allHelperList [data-helper="${id}"]`).click();
      await app.waitForSelector(selector);
    }
    async function history(area) {
      await app.locator('.pain-history-picker summary').click();
      await app.locator('#painHistoryForm select').selectOption(area);
      await app.locator('#painHistoryForm button').click();
      await app.waitForSelector('.pain-content > h2');
      await app.waitForFunction(() => !document.querySelector('[data-pain="new"]')?.disabled);
    }
    async function snapshot() {
      return app.evaluate(async () => {
        const db = await import('/src/db.js');
        return JSON.stringify(await Promise.all(['entries', 'people', 'helperRules', 'settings', 'places'].map(store => db.list(store, { prune: false }))));
      });
    }
    async function screenshot(view) { await app.screenshot({ path: `/tmp/0815-editorial-${mode}-${view}.png`, fullPage: true, animations: 'disabled' }); }
    async function pendingSave(trigger, busy, disabled) {
      await app.evaluate(() => { window.editorialSaveGate = new Promise(resolve => { window.releaseEditorialSave = resolve; }); });
      try {
        await app.locator(trigger).click();
        await app.waitForFunction(selector => document.querySelector(selector)?.getAttribute('aria-busy') === 'true', busy);
        check(await app.locator(disabled).isDisabled(), `${mode}: ${trigger} exposes pending storage and prevents a repeated save`);
      } finally {
        await app.evaluate(() => { window.editorialSaveGate = null; window.releaseEditorialSave(); });
      }
    }
    // Delay real commits only in this isolated context; production storage stays unchanged.
    await app.route('**/src/db.js', async route => {
      const response = await route.fetch();
      const source = (await response.text()).replace('async function transaction(stores, mode, enqueue) {',
        'async function transaction(stores, mode, enqueue) { if (mode === "readwrite" && globalThis.editorialSaveGate) await globalThis.editorialSaveGate;');
      await route.fulfill({ response, body: source });
    });
    await app.addInitScript(() => {
      const NativeDate = Date;
      window.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : ['2026-10-03T20:00:00+02:00'])); }
        static now() { return new NativeDate('2026-10-03T20:00:00+02:00').getTime(); }
      };
    });
    try {
      await app.goto('http://127.0.0.1:8080/');
      await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
      await menu('notes');
      check(await app.locator('#readHost').textContent() === 'Noch keine Notizen.', `${mode}: empty notes remain quiet`);
      await home(); await menu('people');
      check(await app.locator('#readHost').textContent() === 'Noch keine Personen.', `${mode}: empty people remain quiet`);
      await home(); await open('pain', '#painAreaForm');
      check(await app.locator('.pain-day, .pain-trend, .pain-history-picker').count() === 0, `${mode}: no recorded pain invents neither overview nor plot`);
      await home();
      await app.evaluate(async () => {
        const db = await import('/src/db.js');
        const { createObservation } = await import('/src/helpers/pain/model.js');
        for (const [i, [at, intensity]] of [['07:40', 3], ['08:10', 5], ['14:30', 2], ['18:20', 6]].entries()) {
          await db.put('entries', { ...createObservation('Kopf', intensity, new Date(`2026-10-03T${at}:00+02:00`).getTime()), id: `today-${i}` });
        }
        const yesterday = new Date('2026-10-02T07:40:00+02:00').getTime();
        await db.put('entries', { ...createObservation('Kopf', 4, yesterday), id: 'yesterday', startedAt: { kind: 'exact', at: yesterday - 70 * 60000 } });
        // Day-qualified onset must stay a date; midnight must never become a claimed onset time.
        await db.put('entries', { ...createObservation('Bauch', 2, yesterday), id: 'day-onset', startedAt: { kind: 'today', at: new Date('2026-10-02T00:00:00+02:00').getTime() } });
        await db.put('entries', { ...createObservation('Bauch', 0, Date.now() - 60000, true), id: 'resolved' });
        for (let i = 0; i < 120; i++) await db.put('entries', { ...createObservation('Kopf', i % 10 + 1, new Date('2026-10-01T08:00:00+02:00').getTime() + i * 60000), id: `dense-${i}` });
        await db.put('entries', { ...createObservation('<img src="/leak">', 3, yesterday), id: 'safe-area', note: '<script>window.xss=true</script>' });
        for (const [id, name] of [['anna', 'Anna'], ['long', 'Anna ' + 'LangerPersonenname'.repeat(15)]]) await db.put('people', { id, name, createdAt: 1 });
        for (const kind of ['reference', 'gift']) await db.put('entries', { id: kind, type: 'person-note', personId: 'anna', kind, text: kind === 'reference' ? 'Schuhgröße 39\nLieblingsparfum' : 'Buch XY', createdAt: Date.now() - 60000 });
        await db.put('entries', { id: 'long-reference', type: 'person-note', personId: 'long', kind: 'reference', text: 'LangeReferenz'.repeat(100), createdAt: Date.now() });
        for (let i = 0; i < 50; i++) await db.put('entries', { id: `note-${i}`, type: 'note', text: i ? `Gedanke ${i}\nEine zweite Zeile.` : '<img src="/leak">\n' + 'LangerNotiztext'.repeat(100), createdAt: Date.now() - i * 3600000 });
        for (const id of ['pain', 'discount', 'drink']) await db.put('settings', { id: `usage:${id}`, lastUsedAt: Date.now() - 10 * 60000 });
        for (const [i, minutes] of [10, 47, 83].entries()) await db.put('entries', { id: `drink-${i}`, helperId: 'drink', entryVersion: 1, recordedAt: Date.now() - minutes * 60000, createdAt: Date.now() - minutes * 60000 });
      });
      await app.reload();
      await app.waitForSelector('#nowRows [data-helper]');
      const before = await snapshot();
      await app.evaluate(() => {
        window.editorialWrites = 0;
        const original = IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction = function(stores, mode, ...rest) {
          if (mode === 'readwrite') window.editorialWrites++;
          return original.call(this, stores, mode, ...rest);
        };
      });
      const contrasts = await app.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        function luminance(name) {
          const hex = style.getPropertyValue(`--${name}`).trim();
          const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
          return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
        }
        const pairs = ['surface-page', 'surface-paper', 'surface-input', 'surface-soft', 'accent-soft'].flatMap(surface => ['text-primary', 'text-muted'].map(text => [text, surface, 4.5]));
        pairs.push(['accent', 'surface-page', 4.5], ['accent', 'surface-paper', 3], ['accent', 'accent-soft', 3], ['border-control', 'surface-input', 3], ['border-control', 'surface-paper', 3], ['border-control', 'surface-page', 3], ['surface-paper', 'text-primary', 4.5], ['surface-paper', 'accent-hover', 4.5], ['surface-paper', 'color-danger', 4.5], ['surface-paper', 'color-danger-hover', 4.5]);
        return pairs.map(([a, b, minimum]) => { const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return { pair: `${a}/${b}`, ratio: (values[0] + .05) / (values[1] + .05), minimum }; });
      });
      for (const { pair, ratio, minimum } of contrasts) check(ratio >= minimum, `${mode}: ${pair} contrast ${ratio.toFixed(2)}:1`);
      check(await app.evaluate(mode => getComputedStyle(document.documentElement).colorScheme === mode, mode), `${mode}: native controls use the matching palette`);
      await screenshot('dashboard-390');
      await app.setViewportSize({ width: 1280, height: 900 }); await fits('dashboard at 1280 px'); await screenshot('dashboard-1280');
      await app.setViewportSize({ width: 390, height: 844 });
      await open('pain', '.pain-last-value'); await history('Kopf');
      const today = app.locator('.pain-day').first();
      check(await app.locator('.pain-day h3').allTextContents().then(labels => labels.join('|') === 'Heute|Gestern|01.10.2026'), `${mode}: local calendar days remain separate`);
      check((await today.locator('.pain-day-overview').textContent()).includes('07:40') && await today.locator('.pain-latest-value').textContent() === '6', `${mode}: overview uses first documentation and latest observed value`);
      check(await today.locator('.pain-day-beginning').count() === 0, `${mode}: missing onset never becomes an assumed start`);
      check(await today.locator('.pain-history-value strong').allTextContents().then(values => values.join(',') === '6,2,5,3'), `${mode}: individual observations remain newest first`);
      const points = await today.locator('.pain-trend circle').evaluateAll(elements => elements.map(element => ({ x: Number(element.getAttribute('cx')), y: Number(element.getAttribute('cy')) })));
      check(points.length === 4 && await today.locator('circle title').allTextContents().then(values => values.join('|') === '07:40 · 3|08:10 · 5|14:30 · 2|18:20 · 6'), `${mode}: plot contains exactly the documented values`);
      check(points[1].y < points[0].y && points[2].y > points[0].y && points[3].y < points[1].y, `${mode}: higher documented intensities appear higher in the plot`);
      check(Math.abs((points[1].x - points[0].x) / (points[3].x - points[0].x) - 30 / 640) < .0001, `${mode}: point spacing follows elapsed documentation time`);
      check(await app.locator('.pain-day').nth(1).locator('.pain-trend circle').count() === 1 && await app.locator('.pain-day').nth(1).locator('polyline').count() === 0, `${mode}: one observation has one point and no fabricated line`);
      check((await app.locator('.pain-day').nth(1).locator('.pain-day-beginning').textContent()).includes('06:30'), `${mode}: exact onset stays explicitly approximate`);
      check(await app.locator('.pain-day').nth(2).locator('.pain-history li').count() === 120 && await app.locator('.pain-day').nth(2).locator('circle').count() === 120, `${mode}: dense history retains every observation`);
      await screenshot('history-390');
      await app.setViewportSize({ width: 1280, height: 900 }); await fits('history at 1280 px'); await screenshot('history-1280');
      await app.setViewportSize({ width: 320, height: 700 });
      const zoom = await app.addStyleTag({ content: ':root { font-size: 200%; }' });
      await fits('overview, plot and dense history at 320 px with 200% text');
      await today.locator('[data-entry]').first().click(); await fits('pain details with 200% text');
      await app.locator('[data-pain="cancel"]').click(); await app.locator('#backButton').click();
      await history('Bauch');
      check(await app.locator('.pain-latest-value').first().textContent() === '0' && (await app.locator('.pain-day-overview').first().textContent()).includes('schmerzfrei'), `${mode}: explicit pain freedom keeps both value and text`);
      const dayOnset = await app.locator('.pain-day-beginning').textContent();
      check(dayOnset.includes('02.10.2026') && !dayOnset.includes('00:00'), `${mode}: day-qualified onset does not invent a midnight start`);
      await app.locator('#backButton').click(); await history('<img src="/leak">');
      check(await app.locator('.pain-content img, .pain-content script').count() === 0, `${mode}: history summaries keep imported markup as text`);
      await app.locator('#backButton').click();
      // Reach the empty-area renderer without changing production navigation or entries.
      await app.locator('#painHistoryForm select').evaluate(element => { element.add(new Option('Nacken', 'Nacken')); });
      await history('Nacken');
      check(await app.locator('.pain-day, .pain-trend').count() === 0 && (await app.locator('.pain-content').textContent()).includes('Noch keine dokumentierten Werte'), `${mode}: empty area history shows no fabricated overview`);
      await home(); await fits('dashboard with 200% text');
      await menu('notes'); await fits('long notes with 200% text');
      check(await app.locator('.read-text').count() === 50 && await app.locator('#readHost img').count() === 0, `${mode}: all notes remain readable safe text`);
      await home(); await menu('people'); await fits('long person names with 200% text');
      await app.locator('[data-person="long"]').click(); await ready(); await fits('long person title and references with 200% text');
      await home(); await menu('people'); await app.locator('[data-person="anna"]').click(); await ready();
      check(await app.locator('#readHost h2').allTextContents().then(labels => labels.join('|') === 'Referenzen|Geschenkideen'), `${mode}: references and gifts retain native headings`);
      check(await app.locator('.read-person-group time').evaluateAll(elements => elements.every(element => element.getAttribute('datetime') && element.title.includes('19:59') && !element.textContent.includes('19:59'))), `${mode}: person dates stay quiet while exact times remain available`);
      check(await app.locator('.read-person-group li').evaluateAll(elements => elements.every(element => element.firstElementChild.classList.contains('read-text'))), `${mode}: person content precedes its metadata in the reading order`);
      await fits('person sections with 200% text');
      await home(); await menu('settings'); await fits('settings with 200% text');
      await home(); await menu('data'); await fits('data actions with 200% text');
      await app.locator('#importInput').focus();
      check(await app.locator('.import-control label').evaluate(element => getComputedStyle(element).outlineStyle === 'solid'), `${mode}: import retains visible keyboard focus`);
      await home(); await open('drink', '#drinkRecord'); await fits('drink state with 200% text');
      await app.keyboard.press('Tab');
      check(await app.locator('#drinkRecord').evaluate(element => element === document.activeElement && getComputedStyle(element).outlineStyle === 'solid' && element.getBoundingClientRect().height >= 48), `${mode}: drink action keeps visible focus and touch height`);
      await home(); await app.locator('[data-composer="person"]').click();
      check(await app.locator('[data-composer="person"]').getAttribute('aria-expanded') === 'true' && await app.locator('[data-composer="note"]').getAttribute('aria-expanded') === 'false', `${mode}: footer exposes the open composer`);
      await app.setViewportSize({ width: 320, height: 480 }); await fits('short composer with 200% text');
      await app.locator('#personForm button[type="submit"]').focus();
      check(await app.locator('#personForm button[type="submit"]').evaluate(element => element.getBoundingClientRect().bottom <= document.querySelector('.action-footer').getBoundingClientRect().top), `${mode}: enlarged composer action is reachable above footer`);
      await app.locator('#quickComposerClose').click();
      check(await app.locator('[data-composer]').evaluateAll(elements => elements.every(element => element.getAttribute('aria-expanded') === 'false')), `${mode}: closing the composer clears its selected state`);
      await zoom.evaluate(element => element.remove());
      await app.setViewportSize({ width: 390, height: 844 });
      await menu('notes'); await screenshot('notes-390'); await home(); await menu('people'); await app.locator('[data-person="anna"]').click(); await ready(); await screenshot('person-390');
      await home(); await open('drink', '#drinkRecord'); await screenshot('drink-390');
      await home();
      check(await snapshot() === before && await app.evaluate(() => window.editorialWrites === 0), `${mode}: all editorial read views leave every store and usage metadata unchanged`);
      await open('discount', '#discountForm');
      await app.locator('[name="price"]').fill('75'); await app.locator('[name="discount"]').fill('30');
      await pendingSave('#discountForm button', '#discountForm', '#discountForm button');
      await app.waitForSelector('.discount-result');
      await app.waitForFunction(() => !document.querySelector('#discountForm').hasAttribute('aria-busy'));
      check(await app.locator('#discountForm button').isEnabled(), `${mode}: committed discount clears its pending state`);
      check(await app.locator('#discountResult').textContent() === '52,50 €' && (await app.locator('#discountSavings').textContent()).includes('22,50'), `${mode}: discount highlights its real result and savings`);
      check(await app.locator('.discount-result').evaluate(element => element.getBoundingClientRect().top < document.querySelector('#discountForm').getBoundingClientRect().top), `${mode}: result precedes the input form`);
      await screenshot('discount-390');
      await app.emulateMedia({ reducedMotion: 'reduce' });
      check(await app.locator('button').evaluateAll(elements => elements.every(element => getComputedStyle(element).transitionDuration.split(',').every(value => parseFloat(value) === 0))), `${mode}: reduced motion removes control transitions`);
      await home(); await open('pain', '.pain-last-value'); await app.locator('[data-pain="same-area"]').click();
      check(await app.locator('#painEntryForm').evaluate(element => getComputedStyle(element).animationName === 'none'), `${mode}: reduced motion removes question arrival`);
      check(await app.locator('.view:not([hidden]) > .focus-host').evaluate(element => getComputedStyle(element).animationName === 'none'), `${mode}: reduced motion removes page continuity`);
      const choice = await app.locator('.pain-choice').first().boundingBox();
      await app.mouse.move(choice.x + choice.width / 2, choice.y + choice.height / 2);
      await app.mouse.down();
      try {
        check(await app.locator('.pain-choice').first().evaluate(element => getComputedStyle(element).transform === 'none'), `${mode}: reduced motion also removes pressed movement`);
      } finally { await app.mouse.up(); }
      await app.locator('input[name="intensity"][value="10"]').check();
      await pendingSave('#painEntryForm button[type="submit"]', '.pain', '#painEntryForm button[type="submit"]');
      await app.waitForFunction(() => document.querySelector('.pain-status')?.textContent === 'Eintrag gespeichert.' && !document.querySelector('.pain').hasAttribute('aria-busy'));
      check(await app.locator('[data-pain="done"]').isEnabled(), `${mode}: committed pain returns to an available success action`);
      await home(); await open('drink', '#drinkRecord');
      await pendingSave('#drinkRecord', '#drinkRecord', '#drinkRecord');
      await app.waitForFunction(() => document.querySelector('#drinkLast')?.textContent === 'gerade eben' && !document.querySelector('#drinkRecord').hasAttribute('aria-busy'));
      check(await app.locator('#drinkRecord').isEnabled(), `${mode}: committed drink clears its pending state`);
      await home(); await app.locator('[data-composer="note"]').click();
      await app.locator('#noteText').fill('Ein festgehaltener Gedanke.');
      await pendingSave('#noteForm button', '#noteForm', '#noteForm button');
      await app.locator('#quickNoteContextDone').click();
      await app.waitForSelector('#quickComposer', { state: 'hidden' });
      check(await app.locator('#quickComposerTitle').textContent() === 'Gespeichert' && await app.locator('[data-composer="note"]').getAttribute('aria-expanded') === 'false', `${mode}: committed note offers optional context; Done closes its composer`);
      check(requests.every(url => url.startsWith('http://127.0.0.1:8080/')) && !requests.some(url => url.includes('/leak')), `${mode}: no external fonts or unsafe resource requests`);
      check(errors.length === 0, `${mode}: no browser errors`);
    } finally { await context.close(); }
  }
  return results;
}

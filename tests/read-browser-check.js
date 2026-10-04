// Actual shell, helpers and IndexedDB. No capture fixtures or runtime dependency.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 700 }, timezoneId: 'Europe/Berlin' });
  const app = await context.newPage();
  const results = [], errors = [], requests = [];
  app.on('pageerror', error => errors.push(error.message));
  app.on('request', request => requests.push(request.url()));
  app.on('dialog', dialog => dialog.accept());
  function check(condition, label) { if (!condition) throw new Error(label); results.push(label); }
  async function ready() { await app.waitForFunction(() => !document.querySelector('#readHost').hasAttribute('aria-busy')); }
  async function menu(name) {
    await app.locator('#menuButton').click();
    await app.locator(`[data-view="${name}"]`).click();
    await ready();
  }
  async function home() { await app.locator('#backButton').click(); await app.waitForSelector('#view-dashboard'); }
  async function snapshot() {
    return app.evaluate(async () => {
      const db = await import('/src/db.js');
      return JSON.stringify(await Promise.all(['entries', 'people', 'settings', 'helperRules', 'places'].map(store => db.list(store, { prune: false }))));
    });
  }
  async function fits(label) { check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label); }
  await app.addInitScript(() => {
    const NativeDate = Date;
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : ['2026-10-02T12:00:00Z'])); }
      static now() { return new NativeDate('2026-10-02T12:00:00Z').getTime(); }
    };
  });
  // Hold a read promise to verify navigation while real storage is still pending.
  await app.route('**/src/db.js', async route => {
    const response = await route.fetch();
    const source = (await response.text())
      .replace('export async function list(storeName, { prune = true } = {}) {',
        'export async function list(storeName, { prune = true } = {}) { const watched = !prune && !document.querySelector("#view-read").hidden && globalThis.readGate; if (watched) await watched;')
      .replace('  return result;\n}\n\nexport async function get',
        '  if (watched) globalThis.finishedRead = true; return result;\n}\n\nexport async function get');
    await route.fulfill({ response, body: source });
  });
  try {
    await app.goto('http://127.0.0.1:8080/');
    await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
    await menu('notes');
    check(await app.locator('#readHost').textContent() === 'Noch keine Notizen.', 'Notes empty state is quiet and exact');
    check(await app.locator('#main').evaluate(element => element === document.activeElement), 'Menu navigation focuses the main view');
    check(!await app.locator('#view-dashboard').isVisible() && !await app.locator('#headerMenuWrap').isVisible(), 'Read view hides dashboard and its menu');
    await home();
    await menu('people');
    check(await app.locator('#readHost').textContent() === 'Noch keine Personen.', 'People empty state');
    await home();
    await app.evaluate(async () => {
      const db = await import('/src/db.js');
      for (const [id, name] of [['vincent', 'Vincent'], ['max', 'Max'], ['anna', 'Anna'], ['empty', 'Ohne Einträge']]) {
        await db.put('people', { id, name, createdAt: 1 });
      }
      const entries = [
        ['old-day', 'note', '2026-09-30T10:00:00Z', 'Ältere Notiz'],
        ['yesterday', 'note', '2026-10-01T16:41:00Z', 'Gestern notiert'],
        ['early', 'note', '2026-10-02T07:02:00Z', 'Frühe Notiz'],
        ['latest', 'note', '2026-10-02T10:14:00Z', 'Milch\nnicht vergessen.'],
        ['ref-old', 'person-note', '2026-09-29T10:00:00Z', 'Schuhgröße 39', 'anna', 'reference'],
        ['ref-new', 'person-note', '2026-10-01T10:00:00Z', 'Lieblingsparfum', 'anna', 'reference'],
        ['gift-old', 'person-note', '2026-09-29T10:00:00Z', 'Buch XY', 'anna', 'gift'],
        ['gift-new', 'person-note', '2026-10-02T10:00:00Z', 'Ein Konzert', 'anna', 'gift'],
        ['other-person', 'person-note', '2026-10-02T11:00:00Z', 'Nur Max', 'max', 'reference'],
        ['orphan', 'person-note', '2026-10-02T11:00:00Z', 'Keine angelegte Person', 'missing', 'gift']
      ];
      for (const [id, type, date, text, personId, kind] of entries) {
        await db.put('entries', { id, type, text, createdAt: Date.parse(date), ...(personId ? { personId, kind } : {}) });
      }
      const original = IDBDatabase.prototype.transaction;
      window.readWriteCalls = 0;
      IDBDatabase.prototype.transaction = function(stores, mode, ...args) {
        if (mode === 'readwrite') window.readWriteCalls++;
        return original.call(this, stores, mode, ...args);
      };
    });
    const before = await snapshot();
    await menu('notes');
    check((await app.locator('#readHost h2').allTextContents()).join('|') === 'Heute|Gestern|30. September 2026', 'Notes group by correct local calendar dates');
    check((await app.locator('#readHost .read-text').allTextContents()).join('|') === 'Milch\nnicht vergessen.|Frühe Notiz|Gestern notiert|Ältere Notiz', 'Only notes appear, newest first');
    check(await app.locator('#readHost time').first().textContent() === '12:14', 'Note time is local and secondary');
    check(await app.locator('#readHost time').first().getAttribute('datetime') === '2026-10-02T10:14:00.000Z', 'Note retains a semantic absolute timestamp');
    check(await app.locator('.read-text').first().evaluate(element => getComputedStyle(element).whiteSpace) === 'pre-wrap', 'Note line breaks remain readable');
    check((await app.locator('#view-read').ariaSnapshot()).includes('heading "Heute" [level=2]'), 'Day grouping has semantic headings');
    await fits('Notes fit 320 CSS px');
    await home();
    await menu('people');
    check((await app.locator('[data-person] > span:first-child').allTextContents()).join('|') === 'Anna|Max|Ohne Einträge|Vincent', 'Only existing people appear alphabetically');
    await app.locator('#main').focus();
    await app.keyboard.press('Tab');
    check(await app.locator('[data-person="anna"]').evaluate(element => element === document.activeElement && getComputedStyle(element).outlineStyle !== 'none'), 'Tab reaches a person with visible focus');
    await app.keyboard.press('Enter');
    await ready();
    check(await app.locator('#focusTitle').textContent() === 'Anna', 'Keyboard opens the selected person');
    check(await app.locator('#main').evaluate(element => element === document.activeElement), 'Person detail focuses the main view');
    check((await app.locator('#readHost h2').allTextContents()).join('|') === 'Notizen|Geschenkideen', 'Reference and gift semantics remain separate');
    check((await app.locator('#read-references + ol .read-text').allTextContents()).join('|') === 'Lieblingsparfum|Schuhgröße 39', 'Only this person’s references appear newest first');
    check((await app.locator('#read-gifts + ol .read-text').allTextContents()).join('|') === 'Ein Konzert|Buch XY', 'Only this person’s gifts appear newest first');
    check(await app.locator('#backButton').getAttribute('aria-label') === 'Zurück zu Personen', 'Back has the correct accessible destination');
    await app.locator('#backButton').click();
    await ready();
    check(await app.locator('#focusTitle').textContent() === 'Personen' && await app.locator('[data-person="anna"]').evaluate(element => element === document.activeElement), 'Person Back restores the people list and selected-person focus');
    await app.locator('[data-person="empty"]').click();
    await ready();
    check(await app.locator('#readHost').textContent() === 'Noch keine Einträge.', 'Existing person without entries is preserved');
    await app.locator('#backButton').click(); await ready();
    await home();
    check(await app.locator('#main').evaluate(element => element === document.activeElement) && await app.locator('#backButton').getAttribute('aria-label') === 'Zurück zur Startseite', 'People Back returns to dashboard and resets the destination');
    check(await snapshot() === before && await app.evaluate(() => window.readWriteCalls === 0), 'READ navigation changes no stores and opens no write transactions');

    await app.evaluate(() => {
      window.originalGetAll = IDBObjectStore.prototype.getAll;
      IDBObjectStore.prototype.getAll = function() { throw new Error('INTERNAL private storage error'); };
    });
    await menu('notes');
    check((await app.locator('#toast').textContent()) === 'Inhalte konnten nicht geladen werden. Bitte erneut versuchen.' && !await app.locator('#readHost .read-text').count(), 'Read failure reports no raw exception or false empty state');
    await app.evaluate(() => { IDBObjectStore.prototype.getAll = window.originalGetAll; });
    check(await snapshot() === before && await app.evaluate(() => window.readWriteCalls === 0), 'Read failure preserves every store');
    await home();
    await menu('notes');
    check(await app.locator('#readHost .read-text').count() === 4, 'Reopening retries a failed read');
    await home();
    await app.evaluate(() => { window.readGate = new Promise(resolve => { window.releaseRead = resolve; }); });
    await app.locator('#menuButton').click(); await app.locator('[data-view="notes"]').click();
    await app.waitForFunction(() => document.querySelector('#readHost').hasAttribute('aria-busy'));
    await home();
    await app.evaluate(() => { window.readGate = null; });
    await menu('people');
    await app.evaluate(() => window.releaseRead());
    await app.waitForFunction(() => window.finishedRead === true);
    await app.waitForFunction(() => !document.querySelector('#readHost').hasAttribute('aria-busy'));
    check(await app.locator('[data-person]').count() === 4 && await app.locator('.read-text').count() === 0 && await app.locator('#focusTitle').textContent() === 'Personen', 'Late note reads cannot replace the newer people view');
    await app.evaluate(() => {
      window.finishedRead = false;
      window.readGate = new Promise(resolve => { window.releaseRead = resolve; });
    });
    await app.locator('[data-person="anna"]').click();
    await app.waitForFunction(() => document.querySelector('#readHost').hasAttribute('aria-busy'));
    await app.evaluate(() => { window.readGate = null; });
    await app.locator('#backButton').click(); await ready();
    await app.evaluate(() => window.releaseRead());
    await app.waitForFunction(() => window.finishedRead === true);
    check(await app.locator('[data-person]').count() === 4 && await app.locator('.read-text').count() === 0 && await app.locator('#focusTitle').textContent() === 'Personen', 'Late person detail reads cannot overwrite Back navigation');
    await home();

    await app.evaluate(async () => {
      const db = await import('/src/db.js');
      await db.put('entries', { id: 'long-note', type: 'note', text: '<img src="/leak" onerror="window.xss=true">\n' + 'LangerNotiztext'.repeat(100), createdAt: Date.now() });
      await db.put('people', { id: 'long-person', name: '<img src="/leak">' + 'LangerPersonenname'.repeat(15), createdAt: 1 });
      await db.put('entries', { id: 'long-reference', type: 'person-note', personId: 'long-person', kind: 'reference', text: '<script>window.xss=true</script>' + 'LangeReferenz'.repeat(100), createdAt: Date.now() });
    });
    await menu('notes');
    check(await app.locator('#readHost img, #readHost script').count() === 0 && (await app.locator('.read-text').first().textContent()).startsWith('<img'), 'Stored note markup remains literal text');
    const zoom = await app.addStyleTag({ content: ':root { font-size: 200%; }' });
    await fits('Long multiline notes reflow at 320 CSS px with 200% text');
    await home(); await menu('people');
    await fits('Long people names reflow at 320 CSS px with 200% text');
    await app.locator('[data-person="long-person"]').click(); await ready();
    await fits('Long person title and reference reflow at 320 CSS px with 200% text');
    check(await app.locator('#readHost img, #readHost script, #focusTitle img').count() === 0 && !await app.evaluate(() => window.xss), 'Person names and references cannot execute markup');
    await zoom.evaluate(element => element.remove());
    await app.locator('#backButton').click(); await ready(); await home();

    await app.locator('[data-composer="note"]').click();
    await app.locator('#noteText').fill('Neu erfasst'); await app.locator('#noteForm button').click();
    await app.locator('#quickNoteContextDone').click();
    await app.waitForSelector('#quickComposer', { state: 'hidden' });
    await menu('notes');
    check((await app.locator('#readHost .read-text').allTextContents()).includes('Neu erfasst'), 'Existing note capture remains readable');
    await home();
    async function capture(name, personId, kind, text) {
      await app.locator('[data-composer="person"]').click(); await app.waitForSelector('#personForm');
      if (personId) await app.locator('select[name="personId"]').selectOption(personId);
      else await app.locator('input[name="newName"]').fill(name);
      await app.locator(`input[name="kind"][value="${kind}"]`).check();
      await app.locator('#personForm textarea').fill(text); await app.locator('#personForm button').click();
      await app.locator('#quickNoteContextDone').click();
      await app.waitForSelector('#quickComposer', { state: 'hidden' });
    }
    await capture('Neue Person', null, 'reference', 'Erste Referenz');
    const personId = await app.evaluate(async () => (await (await import('/src/db.js')).list('people')).find(person => person.name === 'Neue Person').id);
    await capture(null, personId, 'reference', 'Zweite Referenz');
    await capture(null, personId, 'gift', 'Erste Geschenkidee');
    await capture(null, personId, 'gift', 'Zweite Geschenkidee');
    await menu('people'); await app.locator(`[data-person="${personId}"]`).click(); await ready();
    check(await app.locator('#read-references + ol li').count() === 2 && await app.locator('#read-gifts + ol li').count() === 2, 'Person creation and reference/gift capture remain append-only');
    check(!await app.locator('#readHost input, #readHost textarea, #readHost select, #readHost [data-remove]').count(), 'Read detail adds no edit, delete or filter controls');
    await app.emulateMedia({ reducedMotion: 'reduce' });
    check(await app.locator('#backButton').evaluate(element => getComputedStyle(element).transitionDuration) === '0s', 'Read navigation respects Reduced Motion');
    check(!requests.some(url => url.includes('/leak')) && requests.every(url => url.startsWith('http://127.0.0.1:8080/')), 'Read views send no content or external requests');
    check(await app.locator('[hidden]').evaluateAll(elements => elements.every(element => getComputedStyle(element).display === 'none')), 'Read views preserve all hidden states');
    check(errors.length === 0, `No browser errors: ${errors.join(', ')}`);
    return results;
  } finally { await context.close(); }
}

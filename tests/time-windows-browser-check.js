// Real registry, IndexedDB and service worker; isolated profiles, controlled local clock.
// Run with the supplied Playwright browser tool, not with `node`.
async (page) => {
  const results = [];
  for (const mode of ['light', 'dark', 'signature']) {
    const context = await page.context().browser().newContext({ timezoneId: 'Europe/Berlin', viewport: { width: 390, height: 844 } });
    const app = await context.newPage();
    const errors = [], requests = [];
    app.on('pageerror', error => errors.push(error.message));
    context.on('request', request => requests.push(request.url()));
    const check = (value, label) => { if (!value) throw new Error(`${mode}: ${label}`); results.push(`${mode}: ${label}`); };
    const dbGet = (store, id) => app.evaluate(async ([store, id]) => (await import('/src/db.js')).get(store, id), [store, id]);
    const definition = async () => (await dbGet('settings', 'time-windows'))?.value || [];
    const ready = () => app.waitForFunction(() => ['note', 'read'].every(name => document.querySelector(`#view-${name}`).hidden || !document.querySelector(name === 'note' ? '#noteHost' : '#readHost').hasAttribute('aria-busy')) && (document.querySelector('#quickComposer').hidden || !document.querySelector('#quickComposerBody').hasAttribute('aria-busy')));
    async function reload() { await app.reload(); await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' }); }
    async function settings() {
      await app.locator('#menuButton').click(); await app.locator('[data-view="settings"]').click();
      await app.locator('#defaultTimeWindows .list-item').first().waitFor({ state: 'attached' });
      const section = app.locator('.settings-block').filter({ has: app.locator('#timeWindowCreateForm') });
      if (!await section.evaluate(node => node.open)) await section.locator('summary').click();
    }
    async function helperSettings() {
      await app.locator('.home-accordion').last().evaluate(node => { node.open = true; });
      await app.locator('#allHelperList [data-helper="pain"]').click();
      await app.locator('#helperSettingsButton').click(); await app.locator('#helperSettingsForm').waitFor();
    }
    async function chooseTime(id, quick = true) {
      const prefix = quick ? '#quickNote' : '#note';
      await app.locator(prefix + 'ChooseTime').click(); await ready();
      await app.locator(`${prefix}ContextForm input[value="${id}"]`).check();
      await app.locator(`${prefix}ContextForm button[type="submit"]`).click();
      await app.locator(prefix + 'ContextDone').waitFor(); await ready();
    }
    async function fits(label) {
      const overflow = await app.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, nodes: [...document.querySelectorAll('body *')].filter(node => node.getClientRects().length && node.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(node => ({ tag: node.tagName, class: node.className, text: node.textContent.slice(0, 80), right: node.getBoundingClientRect().right })) }));
      check(overflow.width <= overflow.viewport, overflow.width <= overflow.viewport ? label : `${label}: ${JSON.stringify(overflow)}`);
    }
    async function editWindow(id, changes) {
      const form = app.locator(`[data-time-window-form="${id}"]`);
      for (const [name, value] of Object.entries(changes)) await form.locator(`[name="${name}"]`).fill(value);
      await form.locator('button[type="submit"]').click();
      await app.waitForFunction(id => document.querySelector(`[data-time-window-form="${id}"] [role="status"]`)?.textContent === 'Zeitfenster gespeichert.', id);
    }
    try {
      await app.clock.install({ time: new Date('2026-10-06T09:59:00+02:00') });
      await app.clock.pauseAt(new Date('2026-10-06T10:00:00+02:00'));
      await app.goto('http://127.0.0.1:8080/');
      await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
      await app.evaluate(() => navigator.serviceWorker.ready);
      await app.waitForFunction(() => !!navigator.serviceWorker.controller);
      await app.evaluate(async mode => (await import('/src/db.js')).put('settings', { id: 'theme', value: mode }), mode);
      await reload();
      check(await app.locator('html').getAttribute('data-theme') === mode, 'requested theme is active');
      check(!await dbGet('settings', 'time-windows'), 'defaults do not create a settings record');
      await settings();
      check(await app.locator('#defaultTimeWindows .list-item').count() === 4 && await app.locator('#defaultTimeWindows input, #defaultTimeWindows button').count() === 0, 'four standard windows are read-only');
      const create = app.locator('#timeWindowCreateForm');
      await create.locator('[name="label"]').fill('Zweites Frühstück');
      await create.locator('[name="start"]').fill('09:30');
      await create.locator('[name="end"]').fill('09:30');
      await create.locator('button').click();
      await app.waitForFunction(() => document.querySelector('#toast').textContent.includes('unterschiedliche'));
      check((await definition()).length === 0 && await create.locator('[name="label"]').inputValue() === 'Zweites Frühstück', 'equal times reject without losing the draft');
      await create.locator('[name="end"]').fill('10:30');
      await create.locator('button').click();
      await app.locator('[data-time-window-form]').waitFor();
      const [window] = await definition(), id = window.id;
      check(/^time-/.test(id) && window.startMinute === 570 && window.endMinute === 630, 'UI creates a stable custom ID and minute values');
      await reload(); await helperSettings();
      const helperForm = app.locator('#helperSettingsForm');
      for (const input of await helperForm.locator('[name="time"]').all()) await input.uncheck();
      await helperForm.locator('[name="time"][value="morning"]').check();
      await helperForm.locator(`[name="time"][value="${id}"]`).check();
      await helperForm.locator('button[type="submit"]').click();
      await app.waitForFunction(async id => (await (await import('/src/db.js')).get('helperRules', 'pain'))?.timeBuckets.includes(id), id);
      await reload();
      await app.waitForFunction(() => document.querySelector('#nowRows [data-helper="pain"]')?.textContent.includes('Zweites Frühstück'));
      check((await app.locator('#nowRows [data-helper="pain"]').textContent()).includes('morgens (05–11 Uhr) · Zweites Frühstück (09:30–10:30 Uhr)'), 'overlapping selected windows jointly explain Warum jetzt after reload');
      await helperSettings();
      check(await app.locator(`#helperSettingsForm input[value="${id}"]`).isChecked(), 'helper selection survives reload');
      await reload();
      for (const type of ['note', 'person']) {
        await app.locator(`[data-composer="${type}"]`).click();
        if (type === 'note') {
          await app.locator('#noteText').fill('Kaffee bestellen'); await app.locator('#noteForm button').click();
        } else {
          await app.locator('#personForm [name="newName"]').fill('Mama');
          await app.locator('#personForm [name="text"]').fill('Mama zum Frühstück fragen');
          await app.locator('#personForm button').click();
        }
        await app.locator('#quickNoteContextDone').waitFor(); await ready();
        await chooseTime(id); await app.locator('#quickNoteContextDone').click();
      }
      await reload();
      await app.waitForFunction(() => document.querySelectorAll('#nowRows [data-note]').length === 2);
      const references = await app.evaluate(async () => {
        const db = await import('/src/db.js');
        return { entries: await db.list('entries', { prune: false }), rule: await db.get('helperRules', 'pain'), people: await db.list('people') };
      });
      check(references.entries.every(note => note.context.timeBuckets.join() === id) && references.entries.some(note => note.type === 'person-note' && note.personId === references.people[0].id), 'note and person-note links persist and resurface after reload');
      const plain = references.entries.find(note => note.type === 'note');
      await settings(); await editWindow(id, { label: 'Frühstückspause' });
      check((await definition())[0].id === id, 'renaming preserves the ID');
      await reload();
      await app.waitForFunction(() => document.querySelectorAll('#nowRows [data-note]').length === 2);
      check((await app.locator('#nowRows').textContent()).includes('Frühstückspause') && !(await app.locator('#nowRows').textContent()).includes('Zweites Frühstück'), 'all references display the renamed window');
      await settings(); await editWindow(id, { start: '10:15', end: '10:45' });
      check((await definition())[0].id === id, 'moving the time preserves the ID');
      await reload();
      check(await app.locator('#nowRows [data-note]').count() === 0, 'moved window no longer matches its previous time');
      await app.clock.runFor(15 * 60000);
      await app.waitForFunction(() => document.querySelectorAll('#nowRows [data-note]').length === 2);
      check(true, 'existing dashboard timer activates custom start without navigation');
      await app.clock.runFor(30 * 60000);
      await app.waitForFunction(() => !document.querySelector('#nowRows [data-note]'));
      check(await app.locator('#nowRows [data-helper="pain"]').count() === 1 && !(await app.locator('#nowRows').textContent()).includes('Frühstückspause'), 'custom end removes its reasons while the default morning stays active');
      await settings(); await editWindow(id, { start: '09:30', end: '11:00', label: '<img src="/time-leak">' + 'L'.repeat(38) });
      await app.setViewportSize({ width: 320, height: 700 });
      await app.addStyleTag({ content: ':root { font-size: 200%; }' });
      await fits('settings fit 320 CSS px and 200% text');
      check(await app.locator('#timeWindowsList img').count() === 0, 'custom label is escaped in settings');
      // Preserve zoom across navigation within this document.
      await app.locator('#backButton').click();
      await app.waitForFunction(() => document.querySelectorAll('#nowRows [data-note]').length === 2);
      await fits('dashboard labels fit 320 CSS px and 200% text');
      await helperSettings(); await fits('helper choices fit 320 CSS px and 200% text');
      await app.locator(`#helperSettingsForm input[value="${id}"]`).focus();
      check(await app.locator(`#helperSettingsForm input[value="${id}"]`).evaluate(node => node === document.activeElement), 'custom helper checkbox accepts keyboard focus');
      await app.keyboard.press('Space'); await app.keyboard.press('Space');
      await app.locator('#backButton').click(); await app.locator('#backButton').click();
      await app.locator(`#nowRows [data-note="${plain.id}"]`).click(); await ready();
      await fits('note detail fits 320 CSS px and 200% text');
      check((await app.locator('.note-links').textContent()).includes('<img') && await app.locator('#noteHost img').count() === 0, 'untrusted label remains text in note detail');
      await app.locator('#noteContext').click(); await ready(); await fits('note links fit 320 CSS px and 200% text');
      await app.locator('#noteChooseTime').click(); await ready(); await fits('note picker fits 320 CSS px and 200% text');
      check(await app.locator(`#noteContextForm input[value="${id}"]`).isChecked(), 'saved custom selection appears in note picker');
      await app.screenshot({ path: `/tmp/0815-time-windows-${mode}.png`, fullPage: true, animations: 'disabled' });
      await reload(); await settings();
      check(await app.evaluate(async () => !(await (await import('/src/db.js')).list('settings')).some(row => row.id.startsWith('usage:'))), 'configuration and navigation never record helper use');
      const beforeDelete = await app.evaluate(async () => (await import('/src/db.js')).exportAll());
      let dialogText = '';
      app.once('dialog', async dialog => { dialogText = dialog.message(); await dialog.accept(); });
      await app.locator(`[data-remove-time-window="${id}"]`).click();
      await app.waitForFunction(() => !document.querySelector('[data-time-window-form]'));
      check(dialogText.includes('Bestehende Verknüpfungen bleiben gespeichert') && (await definition()).length === 0, 'deletion explains inactive references and removes only the definition');
      const afterDelete = await app.evaluate(async () => (await import('/src/db.js')).exportAll());
      check(['entries', 'people', 'helperRules'].every(store => JSON.stringify(afterDelete.stores[store]) === JSON.stringify(beforeDelete.stores[store])), 'deletion leaves all referencing records unchanged');
      await reload(); await helperSettings();
      check(await app.locator(`#helperSettingsForm input[value="${id}"]`).isChecked() && (await app.locator('#helperSettingsForm').textContent()).includes('Zeitfenster nicht mehr vorhanden'), 'deleted helper reference stays selected with a readable fallback');
      await reload();
      check(await app.locator('#nowRows [data-note]').count() === 0, 'deleted custom windows create no note candidates');
      for (const note of references.entries) {
        await app.locator('#menuButton').click();
        await app.locator(`[data-view="${note.type === 'note' ? 'notes' : 'people'}"]`).click(); await ready();
        if (note.type === 'person-note') { await app.locator(`[data-person="${note.personId}"]`).click(); await ready(); }
        await app.locator(`[data-note="${note.id}"]:visible`).click(); await ready();
        check((await app.locator('.note-links').textContent()).includes('Zeitfenster nicht mehr vorhanden'), `${note.type}: missing definition has readable detail fallback`);
        await app.locator('#noteContext').click(); await ready(); await app.locator('#noteChooseTime').click(); await ready();
        check(await app.locator(`#noteContextForm input[value="${id}"]`).isChecked(), `${note.type}: missing reference remains editable`);
        await reload();
      }
      check(await app.evaluate(async snapshot => {
        const db = await import('/src/db.js');
        await db.clearAll(); await db.importAll(JSON.parse(JSON.stringify(snapshot)));
        return JSON.stringify((await db.exportAll()).stores) === JSON.stringify(snapshot.stores);
      }, beforeDelete), 'real export, clear and import round trip custom windows and references');
      check(await app.evaluate(async () => {
        const db = await import('/src/db.js'); const before = await db.exportAll();
        for (const value of [[{ ...before.stores.settings.find(row => row.id === 'time-windows').value[0], label: '' }], Array(2).fill(before.stores.settings.find(row => row.id === 'time-windows').value[0])]) {
          const bad = structuredClone(before); bad.stores.settings.find(row => row.id === 'time-windows').value = value;
          let rejected = false; try { await db.importAll(bad); } catch { rejected = true; }
          if (!rejected || JSON.stringify((await db.exportAll()).stores) !== JSON.stringify(before.stores)) return false;
        }
        return true;
      }), 'invalid imports reject before modifying any store');
      await reload();
      check(await app.evaluate(async () => {
        const paths = await Promise.all((await caches.keys()).filter(key => key.startsWith('0815-')).map(async key => (await (await caches.open(key)).keys()).map(request => new URL(request.url).pathname)));
        return paths.flat().includes('/src/time-windows.js');
      }), 'actual worker precaches the time-window module');
      await context.setOffline(true); await reload();
      await app.waitForFunction(() => document.querySelectorAll('#nowRows [data-note]').length === 2);
      await settings(); await editWindow(id, { label: 'Offline-Pause' });
      await reload();
      await app.waitForFunction(() => document.querySelector('#nowRows')?.textContent.includes('Offline-Pause'));
      check((await definition())[0].label === 'Offline-Pause', 'offline editing commits and survives offline reload with active links');
      check(await app.evaluate(async () => {
        const db = await import('/src/db.js');
        for (const schemaVersion of [1, 2]) {
          const old = { schemaVersion, stores: { settings: [], entries: [{ id: 'old', type: 'note', text: 'Legacy', createdAt: 1, context: { timeBuckets: ['morning'] } }], people: [], places: [], helperRules: [] } };
          if (schemaVersion === 1) delete old.stores.helperRules;
          await db.importAll(old);
          if (await db.get('settings', 'time-windows') || !(await db.get('entries', 'old'))) return false;
        }
        return true;
      }), 'old v1 and v2 exports import without a custom settings record');
      await reload(); await app.locator('#nowRows [data-note="old"]').waitFor();
      check(true, 'legacy default note still resurfaces offline');
      check(requests.every(url => url.startsWith('http://127.0.0.1:8080/')) && !requests.some(url => url.includes('time-leak')), 'no external or injected resource requests');
      check(errors.length === 0, `no browser errors: ${errors.join(', ')}`);
    } finally { await context.close(); }
  }
  return results;
}

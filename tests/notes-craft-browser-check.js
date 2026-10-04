// Editorial review in isolated contexts; fixtures never touch the user's stores.
async (page) => {
  const results = [];
  for (const mode of ['light', 'dark']) {
    const context = await page.context().browser().newContext({ serviceWorkers: 'block', colorScheme: mode, timezoneId: 'Europe/Berlin', viewport: { width: 390, height: 844 } });
    const app = await context.newPage();
    const errors = [], requests = [];
    app.on('pageerror', error => errors.push(error.message));
    app.on('request', request => requests.push(request.url()));
    const check = (ok, label) => { if (!ok) throw new Error(`${mode}: ${label}`); results.push(`${mode}: ${label}`); };
    async function ready() { await app.waitForFunction(() => !document.querySelector('#readHost').hasAttribute('aria-busy') && !document.querySelector('#noteHost').hasAttribute('aria-busy')); }
    async function home() { while (!await app.locator('#view-dashboard').isVisible()) { await app.locator('#backButton').click(); await ready(); } }
    async function notes() { await home(); await app.locator('#menuButton').click(); await app.locator('[data-view="notes"]').click(); await ready(); }
    async function open(id) { await app.locator(`[data-note="${id}"]:visible`).click(); await app.waitForSelector('#noteEdit'); await ready(); }
    async function back() { await app.locator('#backButton').click(); await ready(); }
    async function shot(name) { await app.screenshot({ path: `/tmp/0815-notes-craft-${mode}-${name}.png`, fullPage: true, animations: 'disabled' }); }
    async function fits(label) { check(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label); }
    async function snapshot() { return app.evaluate(async () => { const db = await import('/src/db.js'); return JSON.stringify(await Promise.all(['entries', 'people', 'places', 'settings', 'helperRules'].map(store => db.list(store, { prune: false })))); }); }
    async function noBox(selector, label) { check(await app.locator(selector).evaluate(node => { const s = getComputedStyle(node); return s.backgroundColor === 'rgba(0, 0, 0, 0)' && s.borderTopWidth === '0px' && s.borderRadius === '0px' && s.boxShadow === 'none'; }), label); }
    await app.addInitScript(() => {
      const NativeDate = Date;
      window.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : ['2026-10-04T18:30:00+02:00'])); }
        static now() { return NativeDate.parse('2026-10-04T18:30:00+02:00'); }
      };
      Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition(success) { success({ coords: { latitude: 50, longitude: 8, accuracy: 10 } }); } } });
    });
    try {
      await app.goto('http://127.0.0.1:8080/');
      await app.waitForSelector('#allHelperList [data-helper]', { state: 'attached' });
      await notes();
      check(await app.locator('#readHost').textContent() === 'Noch keine Notizen.', 'empty state keeps only the existing message');
      await shot('empty');
      await app.evaluate(async () => (await import('/src/db.js')).put('entries', { id: 'brief', type: 'note', text: 'Milch kaufen.', createdAt: Date.parse('2026-10-04T17:42:00+02:00') }));
      await notes();
      check(await app.locator('.notes-day').count() === 1 && await app.locator('.note-read-button').count() === 1, 'one thought forms a single quiet chapter');
      await noBox('.note-read-button', 'single note has no card surface');
      await shot('single');
      await app.evaluate(async () => {
        const db = await import('/src/db.js');
        await db.put('places', { id: 'mama-home', name: 'Bei Mama', lat: 50, lon: 8, radius: 100, createdAt: 1 });
        await db.put('people', { id: 'mama', name: 'Mama', createdAt: 1 });
        const prose = 'Die Idee für den Artikel: Wie kleine Dinge unseren Alltag verändern. Nicht die großen Vorsätze stehen im Mittelpunkt, sondern das, was wir beiläufig festhalten und später wiederfinden.\n\nFür den Einstieg das Gespräch am Küchentisch nehmen. Danach die Beobachtung vom Spaziergang und den Gedanken, dass gute Fragen manchmal erst einen Tag später entstehen. Zum Schluss die offene Frage stehen lassen.';
        for (const [i, text] of ['Geschenk für Anna ansehen.', prose, 'Am Samstag gemeinsam kochen.\nDas Rezept für die Zitronentarte mitnehmen.', 'An den See.', 'Den Gedanken von heute Morgen weiterverfolgen. Vielleicht beginnt die Geschichte mit dem Blick aus dem Zugfenster.', 'Buch zurückgeben.', 'Oliven, Zitronen, Rosmarin.', 'Für den nächsten Besuch: Fotos vom Garten mitnehmen und nach dem alten Familienrezept fragen.', 'Danke sagen.'].entries()) {
          await db.put('entries', { id: `thought-${i}`, type: 'note', text, createdAt: Date.parse('2026-10-04T17:00:00+02:00') - i * 40 * 60000, ...(i === 0 ? { context: { placeIds: [], timeBuckets: ['evening'] } } : {}) });
        }
        await db.put('entries', { id: 'yesterday', type: 'note', text: 'Die erste kühle Luft am Morgen.\nNoch einmal ohne Jacke draußen gesessen.', createdAt: Date.parse('2026-10-03T08:42:00+02:00') });
        await db.put('entries', { id: 'older', type: 'note', text: 'Mehr Zeit lassen.', createdAt: Date.parse('2026-10-01T11:20:00+02:00') });
        await db.put('entries', { id: 'mama-question', type: 'person-note', kind: 'reference', personId: 'mama', text: 'Wie geht es deinen Rosen?', createdAt: Date.parse('2026-10-03T11:20:00+02:00'), updatedAt: Date.parse('2026-10-04T11:20:00+02:00'), context: { placeIds: ['mama-home'], timeBuckets: ['evening'] } });
        await db.put('entries', { id: 'mama-story', type: 'person-note', kind: 'reference', personId: 'mama', text: prose, createdAt: Date.parse('2026-10-02T11:20:00+02:00') });
        await db.put('entries', { id: 'mama-gift', type: 'person-note', kind: 'gift', personId: 'mama', text: 'Ein Buch über alte Rosensorten.', createdAt: Date.parse('2026-10-01T11:20:00+02:00') });
      });
      await app.reload(); await app.waitForSelector('#nowRows [data-note]');
      const before = await snapshot();
      await noBox('.note-tile:first-child', 'Now note has no helper card');
      check(await app.locator('.note-tile').first().evaluate(node => getComputedStyle(node, '::before').width === '32px'), 'Now uses one short 2rem rule');
      await shot('now');
      await notes();
      check(await app.locator('.notes-day').count() === 3 && await app.locator('.notes-day').first().locator('[data-note]').count() === 10, 'ten entries retain three chronological day chapters');
      check((await app.locator('.notes-day h2').allTextContents()).join('|') === 'Heute|Gestern|1. Oktober 2026', 'chapter labels and sorting are unchanged');
      const sizes = await app.evaluate(() => ['#readHost [data-note="brief"] .read-text', '#readHost [data-note="thought-1"] .read-text'].map(selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize)));
      check(sizes[0] > sizes[1], 'brief thoughts and long prose use different reading scales');
      const rhythm = await app.evaluate(() => [...document.querySelector('.notes-day ol').children].map(li => getComputedStyle(li).marginTop));
      check(new Set(rhythm.slice(1)).size >= 3, 'consecutive brief notes, mixed notes and prose have distinct pauses');
      await fits('mixed mobile page fits'); await shot('list-mobile');
      await app.setViewportSize({ width: 1280, height: 960 });
      check(await app.locator('.notes-day').first().evaluate(node => Math.abs(node.querySelector('h2').getBoundingClientRect().left - node.querySelector('.read-text').getBoundingClientRect().left) < 1), 'wide chapter aligns to the first text line');
      check(await app.locator('.note-read-button').first().evaluate(node => getComputedStyle(node.querySelector('time')).fontVariantNumeric === 'tabular-nums' && node.querySelector('time').getBoundingClientRect().right < node.querySelector('.read-text').getBoundingClientRect().left), 'wide time is a tabular margin note');
      await shot('list-wide');
      await app.locator('[data-note="brief"]:visible').hover();
      await noBox('[data-note="brief"]:visible', 'hover keeps the page open');
      await app.locator('[data-note="brief"]:visible').focus();
      check(await app.locator('[data-note="brief"]:visible').evaluate(node => getComputedStyle(node).outlineWidth === '3px'), 'keyboard focus remains visible');
      await app.mouse.move(0, 0);
      await app.keyboard.down('Space'); await app.waitForTimeout(220);
      check(await app.locator('[data-note="brief"]:visible').evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42 === 1), 'pressed note keeps the shell one-pixel movement');
      await app.keyboard.up('Space'); await app.waitForSelector('#noteEdit'); await ready(); await shot('detail-brief');
      check(await app.locator('.note-actions').evaluate(node => parseFloat(getComputedStyle(node).marginTop) >= 56 && getComputedStyle(node).display === 'grid'), 'actions follow a long pause and use separate text lines');
      await app.locator('#noteEdit').click(); await app.waitForSelector('#noteEditText'); await ready();
      const editor = await app.locator('#noteEditText').evaluate(node => { const s = getComputedStyle(node); return { background: s.backgroundColor, top: s.borderTopWidth, bottom: s.borderBottomWidth, focus: s.boxShadow, font: s.fontFamily }; });
      check(editor.background === 'rgba(0, 0, 0, 0)' && editor.top === '0px' && editor.bottom === '1px' && editor.focus !== 'none' && editor.font.includes('serif'), 'editor keeps notebook type with a baseline and visible focus');
      await shot('edit-brief');
      await app.emulateMedia({ forcedColors: 'active' });
      check(await app.locator('#noteEditText').evaluate(node => getComputedStyle(node).outlineWidth === '3px' && getComputedStyle(node).outlineStyle === 'solid' && getComputedStyle(node).boxShadow === 'none'), 'forced colors retain a clear editor outline');
      await app.emulateMedia({ forcedColors: 'none' });
      await app.locator('#noteEditCancel').click(); await ready(); await back();
      await open('thought-1'); await shot('detail-prose');
      check(await app.locator('.note-text').textContent() === await app.evaluate(async () => (await (await import('/src/db.js')).get('entries', 'thought-1')).text), 'prose keeps complete text and paragraph breaks');
      await app.locator('#noteEdit').click(); await app.waitForSelector('#noteEditText'); await ready(); await shot('edit-prose');
      check(await app.locator('#noteEditText').evaluate(node => !CSS.supports('field-sizing', 'content') || node.scrollHeight <= node.clientHeight + 2), 'supported content sizing exposes the complete prose for editing');
      check(await app.locator('#noteEditText').evaluate(node => { node.style.fieldSizing = 'fixed'; const native = node.clientHeight > 0 && getComputedStyle(node).resize === 'vertical'; node.style.fieldSizing = ''; return native; }), 'native resizing remains available without content sizing');
      await app.locator('#noteEditCancel').click(); await ready();
      await app.setViewportSize({ width: 390, height: 844 }); await shot('detail-prose-mobile');
      await app.locator('#noteEdit').click(); await app.waitForSelector('#noteEditText'); await ready(); await shot('edit-prose-mobile');
      await app.locator('#noteEditCancel').click(); await ready(); await home();
      await app.locator('#menuButton').click(); await app.locator('[data-view="people"]').click(); await ready();
      await app.locator('[data-person="mama"]').click(); await ready(); await shot('person');
      check(await app.locator('.person-note-button').count() === 3, 'person notes and gift remain in separate chapters');
      await open('mama-question'); await shot('detail-person');
      check(await app.locator('.note-dates time').count() === 2 && await app.locator('.note-edited').textContent() === 'Bearbeitet 11:20' && await app.locator('.note-edited time').getAttribute('aria-label') === '4. Oktober 2026 um 11:20', 'edited time is quiet and retains its complete accessible date');
      check(await app.locator('.note-links').evaluate(node => { const s = getComputedStyle(node); return s.fontSize === '14px' && s.backgroundColor === 'rgba(0, 0, 0, 0)'; }), 'context is small marginalia');
      await app.locator('#noteContext').click(); await app.waitForSelector('#noteContextDone'); await ready(); await shot('context');
      await app.locator('#noteChooseTime').click(); await app.waitForSelector('#noteContextForm'); await ready(); await shot('context-picker');
      await app.locator('#noteContextCancel').click(); await ready(); await app.locator('#noteContextDone').click(); await ready();
      await app.locator('#noteDelete').click(); await app.waitForSelector('#noteDeleteDialog[open]'); await shot('delete');
      await app.locator('#noteDeleteCancel').click(); await ready(); await back();
      await open('mama-gift'); await shot('detail-gift');
      for (const width of [320, 560, 561, 768, 1280]) {
        await app.setViewportSize({ width, height: 844 });
        await app.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        await fits(`detail at ${width}px and 200% text fits`);
        await app.locator('#noteEdit').click(); await app.waitForSelector('#noteEditText'); await ready(); await fits(`editor at ${width}px and 200% text fits`);
        await app.locator('#noteEditCancel').click(); await ready();
        await notes(); await fits(`list at ${width}px and 200% text fits`); await home(); await fits(`Now at ${width}px and 200% text fits`);
        await open('mama-question'); await app.locator('#noteContext').click(); await app.waitForSelector('#noteContextDone'); await ready(); await fits(`context at ${width}px and 200% text fits`);
        await app.locator('#noteContextDone').click(); await ready();
        await app.evaluate(() => { document.documentElement.style.fontSize = ''; });
      }
      await app.setViewportSize({ width: 390, height: 844 });
      await app.emulateMedia({ reducedMotion: 'reduce' });
      await app.locator('#noteEdit').focus();
      await app.keyboard.down('Space');
      check(await app.locator('#noteEdit').evaluate(node => getComputedStyle(node).transform === 'none' && getComputedStyle(node).transitionDuration === '0s'), 'reduced motion also removes pressed movement');
      await app.keyboard.up('Space'); await app.waitForSelector('#noteEditText'); await app.locator('#noteEditCancel').click(); await ready();
      check(await snapshot() === before, 'all viewing, Cancel and context inspection preserve every store');
      check(errors.length === 0, 'no browser errors');
      check(requests.every(url => new URL(url).origin === 'http://127.0.0.1:8080'), 'no external resources');
    } finally { await context.close(); }
  }
  return results;
}

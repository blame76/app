import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const currentCache = `0815-v${JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version}`;

function worker({ result = new Response('asset'), networkError = false, helpers = [] } = {}) {
  const handlers = {};
  const deleted = [];
  const stored = [];
  const precached = [];
  const cache = { match: async request => String(request).endsWith('index.html') ? new Response('shell') : undefined, put: async (...args) => stored.push(args), addAll: async requests => precached.push(...requests) };
  const source = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
  vm.runInNewContext(source, {
    HELPERS: helpers, URL, Request,
    self: { location: new URL('https://example.test/app/sw.js'), addEventListener: (name, handler) => { handlers[name] = handler; }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { keys: async () => ['other-app', '0815-v0.4.0', currentCache], delete: async key => deleted.push(key), open: async () => cache },
    fetch: async () => { if (networkError) throw new Error('offline'); return result; }
  });
  const dispatch = async (name, request) => {
    const pending = [];
    let response;
    handlers[name]({ request, waitUntil: promise => pending.push(promise), respondWith: promise => { response = promise; pending.push(promise.catch(() => {})); } });
    await Promise.all(pending);
    return response;
  };
  return { deleted, stored, precached, dispatch };
}
test('Activation deletes only old 0815 caches', async () => {
  const w = worker();
  await w.dispatch('activate');
  assert.deepEqual(w.deleted, ['0815-v0.4.0']);
});
test('Install includes registered helper module and its additional assets', async () => {
  const w = worker({ helpers: [{ id: 'example', offlineAssets: ['./src/helpers/example/extra.js'] }] });
  await w.dispatch('install');
  const urls = w.precached.map(request => request.url);
  assert.ok(urls.includes('https://example.test/app/src/helpers/example/index.js'));
  assert.ok(urls.includes('https://example.test/app/src/helpers/example/extra.js'));
  assert.ok(urls.includes('https://example.test/app/assets/notes.css'));
  assert.ok(urls.includes('https://example.test/app/assets/signature.css'));
  for (const file of ['CormorantGaramond.woff2', 'GreatVibes.woff2', 'OFL-CormorantGaramond.txt', 'OFL-GreatVibes.txt']) {
    assert.ok(urls.includes(`https://example.test/app/assets/fonts/${file}`));
  }
  assert.ok(urls.includes('https://example.test/app/src/theme.js'));
  assert.ok(urls.includes('https://example.test/app/src/note-presentation.js'));
  assert.ok(w.precached.every(request => request.cache === 'reload'));
});
test('Successful responses are cached; error responses are not', async () => {
  const request = { method: 'GET', url: 'https://example.test/app/new.js', mode: 'cors' };
  const good = worker();
  await good.dispatch('fetch', request);
  assert.equal(good.stored.length, 1);
  const bad = worker({ result: new Response('missing', { status: 404 }) });
  await bad.dispatch('fetch', request);
  assert.equal(bad.stored.length, 0);
});
test('HTML fallback is for navigation only; queries and external URLs bypass caching', async () => {
  const w = worker({ networkError: true });
  const navigation = await w.dispatch('fetch', { method: 'GET', url: 'https://example.test/app/path', mode: 'navigate' });
  assert.equal(await navigation.text(), 'shell');
  await assert.rejects(w.dispatch('fetch', { method: 'GET', url: 'https://example.test/app/missing.js', mode: 'cors' }), /offline/);
  assert.equal(await w.dispatch('fetch', { method: 'GET', url: 'https://example.test/app/?name=private', mode: 'navigate' }), undefined);
  assert.equal(await w.dispatch('fetch', { method: 'GET', url: 'https://external.test/a', mode: 'cors' }), undefined);
});

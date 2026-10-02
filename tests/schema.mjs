import assert from 'node:assert/strict';
import test from 'node:test';
import { STORES, validateImport, validateInterval } from '../src/schema.js';
import { helperDefaults, validateRegistry } from '../src/helpers/contract.js';
import { importAll } from '../src/db.js';

const payload = () => ({ schemaVersion: 2, stores: Object.fromEntries(STORES.map(name => [name, []])) });
const helper = () => ({ id: 'example', label: 'Beispiel', category: 'Test', mount() {} });

test('Registry supports zero or multiple helpers and rejects duplicates', () => {
  assert.deepEqual(validateRegistry([]), []);
  assert.equal(validateRegistry([helper(), { ...helper(), id: 'second' }]).length, 2);
  assert.throws(() => validateRegistry([helper(), helper()]), /Doppelte/);
});
test('Helper declares supported contexts and validated defaults', () => {
  const declaration = { ...helper(), contexts: ['time', 'interval'], defaults: { timeBuckets: ['morning'], intervalMinutes: 60, toleranceMinutes: 15 } };
  validateRegistry([declaration]);
  const defaults = helperDefaults(declaration);
  assert.equal(defaults.intervalMinutes, 60);
  assert.equal(defaults.toleranceMinutes, 15);
  assert.deepEqual(defaults.timeBuckets, ['morning']);
  assert.equal(defaults.visible, true);
  assert.equal(helperDefaults({ ...helper(), defaultVisible: false }).visible, false);
  assert.throws(() => validateRegistry([{ ...helper(), defaults: { intervalMinutes: 60 } }]), /Kontextart/);
  assert.throws(() => validateRegistry([{ ...helper(), contexts: ['unknown'] }]));
});
test('Invalid interval and tolerance values are rejected in settings and imports', () => {
  for (const [interval, tolerance] of [[0, null], [-1, null], [NaN, null], [Infinity, 0], [60, -1], [60, 60], [60, 61], [null, 15]]) {
    assert.throws(() => validateInterval(interval, tolerance));
    const data = payload();
    data.stores.helperRules = [{ id: 'example', intervalMinutes: interval, toleranceMinutes: tolerance }];
    assert.throws(() => validateImport(data));
  }
  validateInterval(60, 15);
  validateInterval(null, null);
});
test('Guidance is opt-in, defaults on and preserves false in existing exports', () => {
  assert.equal(helperDefaults(helper()).guidance, undefined);
  assert.equal(helperDefaults({ ...helper(), guidance: true }).guidance, true);
  assert.throws(() => validateRegistry([{ ...helper(), guidance: 'true' }]), /guidance/);
  const data = payload();
  data.stores.helperRules = [{ id: 'pain', guidance: false }];
  assert.equal(validateImport(data).helperRules[0].guidance, false);
  for (const guidance of ['false', 0, null]) {
    data.stores.helperRules[0].guidance = guidance;
    assert.throws(() => validateImport(data), /guidance/);
  }
  delete data.stores.helperRules[0].guidance;
  assert.equal(validateImport(data).helperRules[0].guidance, undefined);
});
test('Invalid import cannot open or mutate the database', () => {
  let opens = 0;
  globalThis.indexedDB = { open() { opens++; throw new Error('Unexpected DB access'); } };
  try {
    const cases = [null, {}, { schemaVersion: 2, stores: {} }];
    const missingId = payload();
    missingId.stores.entries = [{ type: 'note', text: 'abc', createdAt: 1 }];
    cases.push(missingId);
    const wrongStore = payload();
    wrongStore.stores.people = {};
    cases.push(wrongStore);
    const duplicates = payload();
    duplicates.stores.people = [{ id: 'p', name: 'A', createdAt: 1 }, { id: 'p', name: 'B', createdAt: 2 }];
    cases.push(duplicates);
    for (const data of cases) assert.throws(() => importAll(data));
    assert.equal(opens, 0);
  } finally { delete globalThis.indexedDB; }
});
test('Import checks coordinates, context enums and numeric HTML injection', () => {
  for (const mutate of [
    data => { data.stores.places = [{ id: 'p', name: 'P', createdAt: 1, lat: 91, lon: 0, radius: 250 }]; },
    data => { data.stores.places = [{ id: 'p', name: 'P', createdAt: 1, lat: 0, lon: 0, radius: '<img src=x onerror=alert(1)>' }]; },
    data => { data.stores.helperRules = [{ id: 'h', timeBuckets: ['<img src=x onerror=alert(1)>'] }]; },
    data => { data.stores.helperRules = [{ id: 'h', intervalMinutes: '<img src=x>' }]; }
  ]) {
    const data = payload();
    mutate(data);
    assert.throws(() => validateImport(data));
  }
});
test('Import preserves literal text and takes an independent snapshot', () => {
  const data = payload();
  data.stores.entries = [{ id: 'n', type: 'note', text: '<img src=x onerror=alert(1)>', createdAt: 1, extra: { value: 'data' } }];
  const result = validateImport(data);
  assert.equal(result.entries[0].text, data.stores.entries[0].text);
  data.stores.entries[0].text = 'changed';
  assert.notEqual(result.entries[0].text, 'changed');
});
test('Only the historical helperRules store may be absent in v1', () => {
  const data = payload();
  data.schemaVersion = 1;
  delete data.stores.helperRules;
  assert.deepEqual(validateImport(data).helperRules, []);
  delete data.stores.entries;
  assert.throws(() => validateImport(data));
});
test('Dangerous object keys and unsupported future stores are rejected', () => {
  const data = payload();
  data.stores.settings = [JSON.parse('{"id":"x","__proto__":{"polluted":true}}')];
  assert.throws(() => validateImport(data));
  const future = payload();
  future.stores.future = [];
  assert.throws(() => validateImport(future));
});

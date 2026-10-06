import assert from 'node:assert/strict';
import test from 'node:test';
import { HELPERS } from '../src/helpers/registry.js';
import { helperDefaults, validateRegistry } from '../src/helpers/contract.js';
import { createObservation, validatePainEntry, saveObservation, historyForArea, documentedAreas, addDetails, approximateStart } from '../src/helpers/pain/model.js';
import { expiredEntryIds, retentionWindow } from '../src/retention.js';
import { importAll } from '../src/db.js';
import { STORES } from '../src/schema.js';

const pain = HELPERS.find(helper => helper.id === 'pain');
const entry = (area = 'Bauch', intensity = 4, time = 1000, id = 'p1') => ({ ...createObservation(area, intensity, time), id });
const payload = () => ({ schemaVersion: 2, stores: Object.fromEntries(STORES.map(name => [name, []])) });

test('Pain is registered, visible and has optional contexts with no medical defaults', () => {
  validateRegistry(HELPERS);
  assert.ok(pain);
  assert.deepEqual(pain.contexts, ['place', 'time', 'interval']);
  assert.deepEqual(helperDefaults(pain), { id: 'pain', visible: true, favorite: false, placeIds: [], timeBuckets: [], interval: null, earlyBy: null, trackingWindow: 'always', guidance: true });
  assert.equal(typeof pain.validateEntry, 'function');
});
test('Minimum event requires one named area, a value 1–10 and automatic recording time', () => {
  for (const area of ['', ' ', null]) assert.throws(() => createObservation(area, 4));
  for (const intensity of [null, undefined, 0, -1, 11, 1.5, NaN]) assert.throws(() => createObservation('Bauch', intensity));
  const before = Date.now();
  const value = createObservation('  Arm/Hand  ', 10);
  assert.equal(value.bodyArea, 'Arm/Hand');
  assert.ok(value.recordedAt >= before && value.recordedAt <= Date.now());
  assert.equal(value.createdAt, value.recordedAt);
  assert.equal(value.startedAt, undefined);
  assert.equal(value.eventType, 'observation');
});
test('Use is recorded after successful save; failed save never records use', async () => {
  const calls = [];
  const api = { saveEntry: async value => { calls.push('save'); return { ...value, id: 'saved' }; }, recordUse: async () => calls.push('use') };
  const saved = await saveObservation(api, 'Bauch', 4, 1000);
  assert.equal(saved.entry.id, 'saved');
  assert.deepEqual(calls, ['save', 'use']);
  calls.length = 0;
  api.saveEntry = async () => { calls.push('failure'); throw new Error('Quota'); };
  await assert.rejects(saveObservation(api, 'Bauch', 4), /Quota/);
  assert.deepEqual(calls, ['failure']);
});
test('Usage metadata failure does not present a committed event as failed', async () => {
  const result = await saveObservation({ saveEntry: async value => ({ ...value, id: 'saved' }), recordUse: async () => { throw new Error('metadata failure'); } }, 'Bauch', 4);
  assert.equal(result.entry.id, 'saved');
  assert.equal(result.usageError.message, 'metadata failure');
});
test('Resolved is a new zero event; original observation stays unchanged', () => {
  const original = entry();
  const resolved = { ...createObservation(original.bodyArea, 0, 2000, true), id: 'p2' };
  assert.equal(resolved.eventType, 'resolved');
  assert.equal(resolved.intensity, 0);
  assert.equal(original.intensity, 4);
  assert.equal(original.eventType, 'observation');
  assert.equal(original.recordedAt, 1000);
});
test('History is per body area, descending, with no fabricated zero or missing points', () => {
  const values = [entry('Bauch', 3, 1000), entry('Rücken', 9, 3000, 'r1'), entry('Bauch', 4, 2000, 'p2')];
  const history = historyForArea(values, 'bauch');
  assert.deepEqual(history.map(value => value.intensity), [4, 3]);
  assert.deepEqual(history.map(value => value.id), ['p2', 'p1']);
  assert.deepEqual(historyForArea(values, 'Kopf'), []);
  assert.equal(values.length, 3);
  assert.deepEqual(documentedAreas(values), ['Rücken', 'Bauch']);
});
test('Simultaneous areas are separate events and do not overwrite each other', () => {
  const values = [entry('Bauch', 4, 1000, 'p1'), entry('Rücken', 6, 1000, 'r1')];
  assert.equal(historyForArea(values, 'Bauch')[0].intensity, 4);
  assert.equal(historyForArea(values, 'Rücken')[0].intensity, 6);
});
test('Optional details preserve the minimum event and can be removed', () => {
  const original = entry();
  const updated = addDetails(original, { quality: ['stechend', 'ziehend'], interference: 0, possibleContext: 'Nach dem Essen', relief: ['Ruhe', 'Medikament'], note: '<img src=x>' });
  for (const key of ['id', 'bodyArea', 'intensity', 'createdAt', 'recordedAt', 'eventType']) assert.equal(updated[key], original[key]);
  assert.equal(updated.interference, 0);
  assert.equal(original.note, undefined);
  assert.equal(addDetails(updated, {}).note, undefined);
  assert.throws(() => addDetails(original, { interference: 11 }));
  assert.throws(() => addDetails(original, { quality: ['diagnosis'] }));
});
test('Onset is optional, approximate day data stays qualified and future onset is rejected', () => {
  const now = new Date(2026, 9, 2, 14).getTime();
  assert.equal(approximateStart('', now), undefined);
  assert.deepEqual(approximateStart('now', now), { kind: 'now', at: now });
  const today = approximateStart('today', now);
  assert.equal(today.kind, 'today');
  assert.equal(new Date(today.at).getHours(), 0);
  assert.equal(new Date(approximateStart('yesterday', now).at).getDate(), 1);
  assert.throws(() => approximateStart('exact', now, 'invalid'));
  assert.throws(() => approximateStart('exact', now, '2026-10-03T10:00'));
});
test('Pain-specific import validation rejects invalid values before database access', () => {
  let opens = 0;
  globalThis.indexedDB = { open() { opens++; throw new Error('Unexpected open'); } };
  try {
    for (const patch of [{ intensity: 20 }, { intensity: 0 }, { recordedAt: 'HTML' }, { bodyArea: '' }, { entryVersion: 99 }, { startedAt: { kind: 'exact', at: 2000 } }]) {
      const data = payload();
      data.stores.entries = [{ ...entry(), ...patch }];
      assert.throws(() => importAll(data));
    }
    assert.equal(opens, 0);
  } finally { delete globalThis.indexedDB; }
});
test('Finite retention expires only helper data, including hidden helpers; metadata is untouched', () => {
  const now = 400 * 86400000;
  const values = [entry('Bauch', 4, now - 8 * 86400000, 'old'), entry('Bauch', 4, now - 6 * 86400000, 'recent'), { id: 'note', type: 'note', createdAt: 0 }, { id: 'other', helperId: 'other', createdAt: 0 }];
  const rules = [{ id: 'pain', visible: false, favorite: true, placeIds: ['gym'], intervalMinutes: 60, trackingWindow: '7d' }];
  const before = structuredClone(rules);
  assert.deepEqual(expiredEntryIds(values, rules, HELPERS, now), ['old']);
  assert.deepEqual(rules, before);
  assert.equal(values.length, 4);
  for (const window of ['30d', '365d']) assert.deepEqual(expiredEntryIds([entry('Bauch', 4, now - Number.parseInt(window, 10) * 86400000, 'boundary')], [{ id: 'pain', trackingWindow: window }], HELPERS, now), ['boundary']);
});
test('Unlimited retains all events; unsupported retention is rejected', () => {
  assert.deepEqual(expiredEntryIds([entry()], [{ id: 'pain', trackingWindow: 'always' }], HELPERS, 1e12), []);
  assert.deepEqual(expiredEntryIds([entry()], [], HELPERS, 1e12), []);
  assert.throws(() => retentionWindow(pain, { trackingWindow: '1d' }));
});
test('Pain validators reject inconsistent freedom and preserve literal free text', () => {
  assert.throws(() => validatePainEntry({ ...entry(), eventType: 'resolved' }));
  const value = addDetails(entry('<img src=x onerror=alert(1)>'), { note: '</textarea><script>x</script>' });
  assert.equal(value.note, '</textarea><script>x</script>');
});

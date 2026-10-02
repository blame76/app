import assert from 'node:assert/strict';
import test from 'node:test';
import { HELPERS } from '../src/helpers/registry.js';
import { helperDefaults } from '../src/helpers/contract.js';
import { createDrink, validateDrinkEntry, orderedEntries, todayEntries, relativeTime, saveDrink } from '../src/helpers/drink/model.js';
import { expiredEntryIds } from '../src/retention.js';
import { importAll } from '../src/db.js';
import { STORES } from '../src/schema.js';

const entry = (time, id = 'd1') => ({ ...createDrink(time), id });

test('Drink is visible with only interval context, 60/15 defaults and unlimited retention', () => {
  const helper = HELPERS.find(helper => helper.id === 'drink');
  assert.equal(helper.label, 'Trinken');
  assert.equal(helper.category, 'Wohlbefinden');
  assert.deepEqual(helper.contexts, ['interval']);
  assert.deepEqual(helperDefaults(helper), { id: 'drink', visible: true, favorite: false, placeIds: [], timeBuckets: [], intervalMinutes: 60, toleranceMinutes: 15, trackingWindow: 'always' });
});
test('Drink event stores only its identity/version and automatic identical timestamps', () => {
  const before = Date.now();
  const value = createDrink();
  assert.deepEqual(Object.keys(value).sort(), ['createdAt', 'entryVersion', 'helperId', 'recordedAt']);
  assert.ok(value.recordedAt >= before && value.recordedAt <= Date.now());
  assert.equal(value.createdAt, value.recordedAt);
  for (const time of [-1, NaN, Infinity, 'today']) assert.throws(() => createDrink(time));
  assert.throws(() => validateDrinkEntry({ ...value, amount: 250 }));
});
test('Successful drink save precedes recordUse; save failure never records use', async () => {
  const calls = [];
  const api = { saveEntry: async value => { calls.push('save'); return { ...value, id: 'saved' }; }, recordUse: async () => calls.push('use') };
  const result = await saveDrink(api, 1000);
  assert.equal(result.entry.id, 'saved');
  assert.deepEqual(calls, ['save', 'use']);
  calls.length = 0;
  api.saveEntry = async () => { calls.push('failed'); throw new Error('storage failed'); };
  await assert.rejects(saveDrink(api, 2000), /storage failed/);
  assert.deepEqual(calls, ['failed']);
});
test('Usage failure returns the committed drink instead of suggesting a duplicate retry', async () => {
  const result = await saveDrink({ saveEntry: async value => ({ ...value, id: 'saved' }), recordUse: async () => { throw new Error('usage failed'); } }, 1000);
  assert.equal(result.entry.recordedAt, 1000);
  assert.equal(result.usageError.message, 'usage failed');
});
test('Latest ordering and local-day history preserve data and exclude yesterday and tomorrow', () => {
  const now = new Date(2026, 9, 2, 12).getTime();
  const start = new Date(2026, 9, 2).getTime();
  const end = new Date(2026, 9, 3).getTime();
  const values = [entry(start - 1, 'yesterday'), entry(start, 'midnight'), entry(now, 'noon'), entry(end - 1, 'last'), entry(end, 'tomorrow')];
  const before = structuredClone(values);
  assert.deepEqual(todayEntries(values, now).map(value => value.id), ['last', 'noon', 'midnight']);
  assert.equal(orderedEntries(values)[0].id, 'tomorrow');
  assert.deepEqual(values, before);
  // Calendar-day construction also works when local days are not 24 hours long.
  for (const [month, day] of [[2, 29], [9, 25]]) {
    const noon = new Date(2026, month, day, 12).getTime();
    const next = new Date(2026, month, day + 1).getTime();
    assert.deepEqual(todayEntries([entry(next - 1, 'last'), entry(next, 'next')], noon).map(value => value.id), ['last']);
  }
});
test('Relative time describes elapsed documentation time, including singular values', () => {
  const now = 4 * 86400000;
  assert.equal(relativeTime(now, now), 'gerade eben');
  assert.equal(relativeTime(now - 60000, now), 'vor 1 Minute');
  assert.equal(relativeTime(now - 45 * 60000, now), 'vor 45 Minuten');
  assert.equal(relativeTime(now - 3600000, now), 'vor 1 Stunde');
  assert.equal(relativeTime(now - 86400000, now), 'vor 1 Tag');
  assert.ok(!relativeTime(now + 60000, now).startsWith('vor -'));
});
test('Drink retention deletes only dated drink entries at the cutoff and keeps other data', () => {
  const now = 20 * 86400000;
  const values = [entry(now - 7 * 86400000, 'old'), entry(now - 6 * 86400000, 'recent'), { ...entry(1, 'pain'), helperId: 'pain' }, { id: 'note', type: 'note', createdAt: 1 }];
  assert.deepEqual(expiredEntryIds(values, [{ id: 'drink', visible: false, trackingWindow: '7d' }], HELPERS, now), ['old']);
  assert.deepEqual(expiredEntryIds(values, [], HELPERS, now), []);
});
test('Drink-specific import validation rejects malformed events before database access', () => {
  let opens = 0;
  globalThis.indexedDB = { open() { opens++; throw new Error('Unexpected database access'); } };
  try {
    for (const patch of [{ entryVersion: 2 }, { recordedAt: 'HTML' }, { recordedAt: -1 }, { createdAt: 2000 }, { amount: 250 }]) {
      const data = { schemaVersion: 2, stores: Object.fromEntries(STORES.map(name => [name, []])) };
      data.stores.entries = [{ ...entry(1000), ...patch }];
      assert.throws(() => importAll(data));
    }
    assert.equal(opens, 0);
  } finally { delete globalThis.indexedDB; }
});

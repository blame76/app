import test from 'node:test';
import assert from 'node:assert/strict';
import { saveParking, validateParkingEntry, POSITION_ID } from '../src/helpers/parking/model.js';
import { HELPERS } from '../src/helpers/registry.js';
import { importAll } from '../src/db.js';
import { STORES } from '../src/schema.js';

const position = { lat: 50, lon: 8, accuracy: 12 };
const entry = { ...position, id: POSITION_ID, helperId: 'parking', entryVersion: 1, createdAt: 10 };
test('Parking has one bounded state, no context defaults or retention', () => {
  const helper = HELPERS.find(item => item.id === 'parking');
  assert.equal(helper.category, 'Mobilität');
  assert.equal(helper.contexts, undefined);
  assert.equal(helper.retention, undefined);
  assert.equal(helper.validateEntry(entry), entry);
});
test('Saving/replacing commits to the same ID before recording use', async () => {
  const calls = [], stored = new Map();
  const api = {
    async saveEntry(value) { calls.push('commit'); stored.set(value.id, value); return value; },
    async recordUse() { calls.push('use'); }
  };
  await saveParking(api, position, ' Ebene 3 ', 10);
  const result = await saveParking(api, { ...position, lat: 51 }, '', 20);
  assert.deepEqual(calls, ['commit', 'use', 'commit', 'use']);
  assert.equal(stored.size, 1);
  assert.equal(result.entry.createdAt, 20);
  assert.equal(result.entry.lat, 51);
  assert.equal(result.entry.note, undefined);
});
test('Storage failure does not count use; metadata failure does not discard committed parking', async () => {
  let used = false;
  await assert.rejects(saveParking({ saveEntry() { throw Error('full'); }, recordUse() { used = true; } }, position, 'Note'));
  assert.equal(used, false);
  const result = await saveParking({ async saveEntry(value) { return value; }, recordUse() { throw Error('metadata'); } }, position, 'Note');
  assert.equal(result.entry.note, 'Note');
  assert.equal(result.usageError.message, 'metadata');
});
test('Invalid parking data is rejected before import opens the database', () => {
  for (const changes of [{ id: 'second' }, { entryVersion: 2 }, { lat: 91 }, { lon: -181 }, { accuracy: -1 }, { createdAt: -1 }, { note: {} }, { note: 'a'.repeat(501) }]) {
    const invalid = { ...entry, ...changes };
    assert.throws(() => validateParkingEntry(invalid));
    assert.throws(() => importAll({ schemaVersion: 2, stores: Object.fromEntries(STORES.map(store => [store, store === 'entries' ? [invalid] : []])) }));
  }
});

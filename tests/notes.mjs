import assert from 'node:assert/strict';
import test from 'node:test';
import { editNote, changeNoteContext, noteContext, noteLinks, relevantNotes } from '../src/notes.js';
import { STORES, TIME_BUCKETS, validateImport, validateRecord } from '../src/schema.js';
import { timeBucket, matchingPlaces } from '../src/context.js';

const legacy = { id: 'old', type: 'note', text: 'Ein Gedanke', createdAt: 1 };
const note = (id, createdAt, context) => ({ ...legacy, id, createdAt, ...(context ? { context } : {}) });

test('Old notes need no migration; editing preserves identity and sets only the text timestamp', () => {
  assert.equal(validateRecord('entries', legacy), legacy);
  assert.deepEqual(noteContext(legacy), { placeIds: [], timeBuckets: [] });
  const edited = editNote(legacy, ' Neuer Gedanke ', 200);
  assert.deepEqual(edited, { ...legacy, text: 'Neuer Gedanke', updatedAt: 200 });
  assert.equal(legacy.text, 'Ein Gedanke');
  assert.deepEqual(editNote(legacy, 'Ein Gedanke', 200), legacy);
  const importedWhitespace = { ...legacy, text: ' Ein Gedanke\n ' };
  assert.deepEqual(editNote(importedWhitespace, importedWhitespace.text, 200), importedWhitespace);
  for (const text of ['', ' ', '\n\t']) assert.throws(() => editNote(legacy, text), /Notiztext/);
});

test('Text editing retains both contexts, existing metadata and createdAt', () => {
  const original = { ...legacy, context: { placeIds: ['office'], timeBuckets: ['midday'], extra: 'preserved' }, extra: { value: 7 }, updatedAt: 50 };
  const edited = editNote(original, 'Geändert', 200);
  assert.equal(edited.id, original.id);
  assert.equal(edited.createdAt, original.createdAt);
  assert.deepEqual(edited.context, original.context);
  assert.deepEqual(edited.extra, original.extra);
  assert.equal(edited.updatedAt, 200);
  assert.equal(editNote(edited, 'Geändert', 300).updatedAt, 200);
});

test('Context can be added, replaced and removed independently without touching text or dates', () => {
  let value = changeNoteContext(legacy, { placeIds: ['office'] });
  value = changeNoteContext(value, { timeBuckets: ['midday'] });
  assert.deepEqual(value.context, { placeIds: ['office'], timeBuckets: ['midday'] });
  value = changeNoteContext(value, { placeIds: ['shop'], timeBuckets: ['evening'] });
  assert.deepEqual(value.context, { placeIds: ['shop'], timeBuckets: ['evening'] });
  value = changeNoteContext(value, { placeIds: [] });
  assert.deepEqual(value.context, { placeIds: [], timeBuckets: ['evening'] });
  value = changeNoteContext(value, { timeBuckets: [] });
  assert.deepEqual(value, { ...legacy, context: { placeIds: [], timeBuckets: [] } });
  assert.equal(value.updatedAt, undefined);
  assert.equal(changeNoteContext({ ...legacy, updatedAt: 20 }, { placeIds: ['office'] }).updatedAt, 20);
});

test('Now uses explicit place OR time, prioritizes places, then creation date and caps in the shell', () => {
  const places = [{ id: 'office', name: 'Büro', lat: 50, lon: 8, radius: 250 }];
  const active = matchingPlaces({ lat: 50, lon: 8, accuracy: 10 }, places);
  const values = [
    legacy,
    note('time-new', 400, { timeBuckets: ['midday'] }),
    note('place-old', 10, { placeIds: ['office'] }),
    note('place-new', 20, { placeIds: ['office'] }),
    note('both-place', 15, { placeIds: ['office'], timeBuckets: ['night'] }),
    note('both-time', 300, { placeIds: ['missing'], timeBuckets: ['midday'] }),
    note('neither', 500, { placeIds: ['missing'], timeBuckets: ['night'] }),
    { ...legacy, id: 'person', type: 'person-note', context: { timeBuckets: ['midday'] } }
  ];
  assert.deepEqual(relevantNotes(values, active, 'midday').map(item => item.note.id), ['place-new', 'both-place', 'place-old', 'time-new', 'both-time']);
  assert.equal(relevantNotes(values, active, 'midday')[0].reason, 'Büro');
  assert.deepEqual(relevantNotes(values, [], 'midday').map(item => item.note.id), ['time-new', 'both-time']);
  assert.equal(relevantNotes([changeNoteContext(values[1], { timeBuckets: [] })], active, 'midday').length, 0);
  assert.equal(relevantNotes(values, [], 'morning').length, 0);
  assert.equal(relevantNotes(values, active, 'morning').length, 3);
  assert.deepEqual(relevantNotes([note('b', 1, { timeBuckets: ['midday'] }), note('a', 1, { timeBuckets: ['midday'] })], [], 'midday').map(item => item.note.id), ['a', 'b']);
});

test('Notes share all central time buckets and safely label deleted places', () => {
  const hours = [8, 12, 17, 22];
  assert.deepEqual(hours.map(hour => timeBucket(new Date(2026, 9, 3, hour))), TIME_BUCKETS);
  const value = note('context', 1, { placeIds: ['missing', 'office'], timeBuckets: TIME_BUCKETS });
  assert.deepEqual(noteLinks(value, [{ id: 'office', name: '<img src=x>' }]).map(link => link.label), ['Ort nicht mehr gespeichert', '<img src=x>', 'morgens', 'mittags', 'abends', 'nachts']);
});

test('Import accepts old and new notes unchanged; optional fields are validated before any write', () => {
  const modern = { ...legacy, id: 'new', updatedAt: 10, context: { placeIds: ['office', 'shop'], timeBuckets: ['midday'] } };
  const payload = { schemaVersion: 2, stores: Object.fromEntries(STORES.map(store => [store, store === 'entries' ? [legacy, modern] : []])) };
  assert.deepEqual(validateImport(payload).entries, [legacy, modern]);
  for (const changes of [
    { updatedAt: null }, { updatedAt: '10' }, { updatedAt: -1 }, { updatedAt: Infinity },
    { context: null }, { context: [] }, { context: { placeIds: 'office' } },
    { context: { placeIds: ['office', 'office'] } }, { context: { placeIds: [''] } },
    { context: { timeBuckets: ['unknown'] } }, { context: { timeBuckets: ['midday', 'midday'] } }
  ]) {
    assert.throws(() => validateRecord('entries', { ...legacy, ...changes }));
    assert.throws(() => validateImport({ ...payload, stores: { ...payload.stores, entries: [{ ...legacy, ...changes }] } }));
  }
  validateRecord('entries', { ...legacy, context: {} });
});

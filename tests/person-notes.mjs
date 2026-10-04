import assert from 'node:assert/strict';
import test from 'node:test';
import { isNote, noteLabel, editNote, changeNoteContext, relevantNotes } from '../src/notes.js';
import { noteDays, personEntries } from '../src/read-views.js';
import { STORES, validateImport, validateRecord } from '../src/schema.js';

const old = { id: 'mama-note', type: 'person-note', personId: 'mama', kind: 'reference', text: 'Wie geht es dem Garten?', createdAt: 1 };
const context = { placeIds: ['mama-home'], timeBuckets: ['evening'] };
const place = { id: 'mama-home', name: 'Bei Mama' };

test('Old person notes use the same lifecycle without migration and preserve association and kind', () => {
  assert.equal(validateRecord('entries', old), old);
  assert.equal(isNote(old), true);
  assert.equal(noteLabel(old), 'Notiz');
  const linked = changeNoteContext(old, context);
  assert.deepEqual(linked, { ...old, context });
  assert.equal(linked.updatedAt, undefined);
  assert.deepEqual(editNote(linked, 'Und wie geht es den Rosen?', 200), { ...linked, text: 'Und wie geht es den Rosen?', updatedAt: 200 });
  assert.deepEqual(old, { id: 'mama-note', type: 'person-note', personId: 'mama', kind: 'reference', text: 'Wie geht es dem Garten?', createdAt: 1 });
  assert.throws(() => editNote(linked, '  '));
});

test('Gift ideas retain their type and person when edited or unlinked', () => {
  const gift = { ...old, kind: 'gift', context, updatedAt: 2 };
  assert.equal(noteLabel(gift), 'Geschenkidee');
  const edited = editNote(gift, 'Ein Buch für Mama', 3);
  const unlinked = changeNoteContext(edited, { placeIds: [], timeBuckets: [] });
  assert.equal(unlinked.kind, 'gift');
  assert.equal(unlinked.personId, 'mama');
  assert.equal(unlinked.id, old.id);
  assert.equal(unlinked.createdAt, old.createdAt);
  assert.equal(unlinked.updatedAt, 3);
  assert.deepEqual(gift.context, context);
});

test('At Mama OR in the evening, the same person note resurfaces exactly once', () => {
  const linked = { ...old, context };
  assert.equal(relevantNotes([old], [place], 'evening').length, 0);
  const atMama = relevantNotes([linked], [place], 'morning');
  assert.equal(atMama[0].reason, 'Bei Mama');
  assert.equal(atMama[0].rank, 400);
  const evening = relevantNotes([linked], [], 'evening');
  assert.equal(evening[0].reason, 'abends');
  assert.equal(evening[0].rank, 200);
  assert.equal(relevantNotes([linked], [place], 'evening').length, 1);
  assert.equal(relevantNotes([linked], [], 'morning').length, 0);
  assert.equal(relevantNotes([changeNoteContext(linked, { placeIds: [], timeBuckets: [] })], [place], 'evening').length, 0);
});

test('Person and plain notes share priority while person lists and plain note days stay separate', () => {
  const values = [
    { ...old, context },
    { id: 'plain', type: 'note', text: 'Gedanke', createdAt: 4, context: { timeBuckets: ['evening'] } },
    { ...old, id: 'other', personId: 'papa', createdAt: 2, context: { timeBuckets: ['evening'] } },
    { ...old, id: 'gift', kind: 'gift', createdAt: 3, context: { timeBuckets: ['evening'] } }
  ];
  assert.deepEqual(relevantNotes(values, [place], 'evening').map(item => item.note.id), ['mama-note', 'plain', 'gift', 'other']);
  assert.deepEqual(personEntries(values, 'mama', 'reference').map(item => item.id), ['mama-note']);
  assert.deepEqual(personEntries(values, 'mama', 'gift').map(item => item.id), ['gift']);
  assert.deepEqual(noteDays(values).flatMap(day => day.entries.map(item => item.id)), ['plain']);
});

test('Person-note imports preserve old and new fields; malformed context is rejected', () => {
  const modern = { ...old, id: 'modern', updatedAt: 3, context };
  const payload = { schemaVersion: 2, stores: Object.fromEntries(STORES.map(store => [store, store === 'entries' ? [old, modern] : []])) };
  assert.deepEqual(validateImport(payload).entries, [old, modern]);
  for (const fields of [{ updatedAt: -1 }, { updatedAt: 'now' }, { context: null }, { context: { timeBuckets: ['tomorrow'] } }, { context: { placeIds: ['x', 'x'] } }]) {
    assert.throws(() => validateRecord('entries', { ...old, ...fields }));
    assert.throws(() => validateImport({ ...payload, stores: { ...payload.stores, entries: [{ ...old, ...fields }] } }));
  }
});

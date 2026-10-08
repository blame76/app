import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecord, validateImport, STORES, CONTEXT_TYPES } from '../src/schema.js';
import { editPersonDate, relevantPersonDates, personDateLabel } from '../src/person-dates.js';
import { editPerson, personDeleteDescription } from '../src/people.js';
import { importAll } from '../src/db.js';

const person = { id: 'p', name: 'Vincent', createdAt: 1 };
const yearly = { id: 'd', type: 'person-date', personId: 'p', label: 'Geburtstag', recurrence: 'yearly', month: 3, day: 14, showBeforeDays: 7, createdAt: 2 };
const once = { id: 'o', type: 'person-date', personId: 'p', label: 'Einladung', recurrence: 'once', date: '2026-03-14', showBeforeDays: 7, createdAt: 3 };
const local = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const projection = (entry, at) => relevantPersonDates([entry], [person], at);

test('Strict person-date schema accepts only actual dates and bounded integer lead times', () => {
  for (const entry of [yearly, once, { ...once, showBeforeDays: 0 }, { ...yearly, month: 2, day: 29 }, { ...once, date: '2000-02-29', showBeforeDays: 365 }]) assert.equal(validateRecord('entries', entry), entry);
  for (const fields of [{ date: '2026-02-29' }, { date: '2026-04-31' }, { date: '2026-3-14' }, { date: '0000-01-01' }, { month: 3 }, { day: 14 }]) assert.throws(() => validateRecord('entries', { ...once, ...fields }));
  for (const fields of [{ month: 4, day: 31 }, { month: 0 }, { day: 0 }, { day: 1.5 }, { month: '3' }, { date: '2026-03-14' }]) assert.throws(() => validateRecord('entries', { ...yearly, ...fields }));
  for (const fields of [{ personId: '' }, { personId: ' ' }, { label: '' }, { label: ' ' }, { label: 'x'.repeat(101) }, { recurrence: 'monthly' }, { showBeforeDays: -1 }, { showBeforeDays: 366 }, { showBeforeDays: 1.5 }, { showBeforeDays: '7' }, { helperId: 'x' }, { surprise: true }]) assert.throws(() => validateRecord('entries', { ...yearly, ...fields }));
});
test('Renaming preserves identity and creation time; linked entries remain untouched', () => {
  const entries = [{ id: 'n', type: 'person-note', kind: 'reference', personId: 'p' }, { id: 'g', type: 'person-note', kind: 'gift', personId: 'p' }, yearly];
  const before = structuredClone(entries);
  assert.deepEqual(editPerson(person, ' Benjamin '), { ...person, name: 'Benjamin' });
  assert.deepEqual(entries, before);
  assert.equal(person.name, 'Vincent');
  assert.throws(() => editPerson(person, ' '));
});
test('Deletion counts exact kinds, singular/plural and future linked entries', () => {
  const notes = Array.from({ length: 4 }, () => ({ type: 'person-note', kind: 'reference', personId: 'p' }));
  const gifts = Array.from({ length: 2 }, () => ({ type: 'person-note', kind: 'gift', personId: 'p' }));
  assert.match(personDeleteDescription(person, [...notes, ...gifts, yearly]), /4 Notizen, 2 Geschenkideen, 1 wichtiges Datum/);
  assert.match(personDeleteDescription(person, [notes[0], gifts[0], yearly, { ...yearly, id: 'd2' }, { type: 'future', personId: 'p' }]), /1 Notiz, 1 Geschenkidee, 2 wichtige Daten, 1 weiterer Eintrag/);
  assert.match(personDeleteDescription(person, [yearly]), /gehört 1 wichtiges Datum/);
  assert.equal(personDeleteDescription(person, [{ ...yearly, personId: 'other' }]), 'Vincent wird dauerhaft gelöscht.');
});
test('Once and yearly include the complete lead window and the event day only', () => {
  for (const entry of [yearly, once]) {
    assert.equal(projection(entry, local(2026, 3, 6)).items.length, 0);
    for (const [day, text] of [[7, 'in 7 Tagen'], [13, 'morgen'], [14, 'heute']]) assert.equal(projection(entry, local(2026, 3, day)).items[0].primary, `${entry.label} ${text}`);
    assert.equal(projection(entry, local(2026, 3, 15)).items.length, 0);
    assert.equal(projection({ ...entry, showBeforeDays: 0 }, local(2026, 3, 13)).items.length, 0);
    assert.equal(projection({ ...entry, showBeforeDays: 0 }, local(2026, 3, 14)).items[0].primary, `${entry.label} heute`);
  }
  assert.equal(projection(once, local(2027, 3, 14)).nextChangeAt, null);
  assert.equal(projection(yearly, local(2027, 3, 14)).items.length, 1);
});
test('Next boundaries cover lead start, daily copy updates, event end and next annual cycle', () => {
  for (const entry of [yearly, once]) {
    assert.equal(projection(entry, local(2026, 3, 5)).nextChangeAt, local(2026, 3, 7, 0));
    assert.equal(projection(entry, local(2026, 3, 7)).nextChangeAt, local(2026, 3, 8, 0));
    assert.equal(projection(entry, local(2026, 3, 13)).nextChangeAt, local(2026, 3, 14, 0));
    assert.equal(projection(entry, local(2026, 3, 14)).nextChangeAt, local(2026, 3, 15, 0));
  }
  assert.equal(projection(yearly, local(2026, 3, 15)).nextChangeAt, local(2027, 3, 7, 0));
});
test('Year transition, DST changes and leap-only February 29 use calendar days', () => {
  const january = { ...yearly, month: 1, day: 2 };
  assert.equal(projection(january, local(2026, 12, 26)).items[0].primary, 'Geburtstag in 7 Tagen');
  assert.equal(projection(january, local(2026, 12, 25)).nextChangeAt, local(2026, 12, 26, 0));
  for (const [month, day] of [[3, 30], [10, 26]]) {
    const entry = { ...yearly, month, day };
    assert.equal(projection(entry, local(2026, month, day - 2)).items[0].primary, 'Geburtstag in 2 Tagen');
    assert.equal(projection(entry, local(2026, month, day - 1)).nextChangeAt, local(2026, month, day, 0));
  }
  const leap = { ...yearly, month: 2, day: 29, showBeforeDays: 0 };
  assert.equal(projection(leap, local(2027, 2, 28)).items.length, 0);
  assert.equal(projection(leap, local(2027, 3, 1)).nextChangeAt, local(2028, 2, 29, 0));
  assert.equal(projection(leap, local(2028, 2, 29)).items[0].primary, 'Geburtstag heute');
  assert.equal(projection(leap, local(2096, 3, 1)).nextChangeAt, local(2104, 2, 29, 0));
  assert.equal(personDateLabel(leap), '29. Februar');
});
test('Each relevant entry has its own pure projection; missing people do not produce cards', () => {
  const entries = [yearly, once]; const before = structuredClone(entries);
  assert.equal(relevantPersonDates(entries, [person], local(2026, 3, 7)).items.length, 2);
  assert.equal(relevantPersonDates(entries, [], local(2026, 3, 7)).nextChangeAt, null);
  assert.deepEqual(entries, before);
  assert.deepEqual(CONTEXT_TYPES, ['place', 'time', 'interval']);
});
test('Editing recurrence replaces its date representation while preserving identity', () => {
  const edited = editPersonDate(yearly, { label: ' Einladung ', recurrence: 'once', date: '2026-10-18', showBeforeDays: 3 });
  assert.deepEqual(edited, { id: 'd', type: 'person-date', personId: 'p', label: 'Einladung', recurrence: 'once', date: '2026-10-18', showBeforeDays: 3, createdAt: 2 });
  assert.deepEqual(editPersonDate(edited, yearly), yearly);
});
test('Existing export versions support dates; invalid imports fail before DB access', () => {
  const payload = { schemaVersion: 2, stores: Object.fromEntries(STORES.map(store => [store, []])) };
  payload.stores.people = [person]; payload.stores.entries = [yearly, once];
  assert.deepEqual(validateImport(payload).entries, [yearly, once]);
  payload.schemaVersion = 1; delete payload.stores.helperRules;
  assert.deepEqual(validateImport(payload).entries, [yearly, once]);
  let opens = 0; globalThis.indexedDB = { open() { opens++; } };
  try {
    payload.stores.entries = [{ ...once, date: '2026-02-29' }]; assert.throws(() => importAll(payload));
    payload.stores.entries = [yearly]; payload.stores.people = []; assert.throws(() => importAll(payload));
    assert.equal(opens, 0);
  } finally { delete globalThis.indexedDB; }
});

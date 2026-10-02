import assert from 'node:assert/strict';
import test from 'node:test';
import { noteDays, sortedPeople, personEntries } from '../src/read-views.js';

const note = (id, date, text = id) => ({ id, type: 'note', text, createdAt: date.getTime() });
test('Notes select only note records and group newest first by local calendar day', () => {
  const now = new Date(2026, 9, 2, 12);
  const entries = [
    note('yesterday', new Date(2026, 9, 1, 23, 59)),
    note('early', new Date(2026, 9, 2, 0, 1)),
    { id: 'person', type: 'person-note', createdAt: now.getTime() },
    { id: 'helper', helperId: 'pain', createdAt: now.getTime() },
    note('old', new Date(2026, 8, 30, 18)),
    note('latest', new Date(2026, 9, 2, 11))
  ];
  const before = structuredClone(entries);
  const days = noteDays(entries, now);
  assert.deepEqual(days.map(day => day.key), ['2026-10-02', '2026-10-01', '2026-09-30']);
  assert.deepEqual(days.slice(0, 2).map(day => day.label), ['Heute', 'Gestern']);
  assert.equal(days[2].label, '30. September 2026');
  assert.deepEqual(days.map(day => day.entries.map(entry => entry.id)), [['latest', 'early'], ['yesterday'], ['old']]);
  assert.deepEqual(entries, before);
});

test('Yesterday crosses month/year and summer-time boundaries using calendar arithmetic', () => {
  for (const [now, previous] of [
    [new Date(2026, 0, 1, 0, 1), new Date(2025, 11, 31, 23, 59)],
    [new Date(2026, 2, 29, 23), new Date(2026, 2, 28, 23, 59)],
    [new Date(2026, 9, 25, 23), new Date(2026, 9, 24, 23, 59)]
  ]) assert.equal(noteDays([note('previous', previous)], now)[0].label, 'Gestern');
});

test('No notes means no day groups', () => {
  assert.deepEqual(noteDays([]), []);
  assert.deepEqual(noteDays([{ type: 'person-note' }, { helperId: 'drink' }]), []);
});

test('People sort by German names without mutating existing records', () => {
  const people = ['Vincent', 'Max', 'Änne', 'Anna'].map(name => ({ id: name, name }));
  assert.deepEqual(sortedPeople(people).map(person => person.name), ['Anna', 'Änne', 'Max', 'Vincent']);
  assert.equal(people[0].name, 'Vincent');
});

test('Person groups retain type, ownership and kind, with each newest first', () => {
  const entries = [
    { id: 'old', type: 'person-note', personId: 'anna', kind: 'reference', createdAt: 1 },
    { id: 'other', type: 'person-note', personId: 'max', kind: 'reference', createdAt: 20 },
    { id: 'gift', type: 'person-note', personId: 'anna', kind: 'gift', createdAt: 3 },
    { id: 'note', type: 'note', personId: 'anna', kind: 'reference', createdAt: 20 },
    { id: 'new', type: 'person-note', personId: 'anna', kind: 'reference', createdAt: 2 },
    { id: 'gift-new', type: 'person-note', personId: 'anna', kind: 'gift', createdAt: 4 }
  ];
  assert.deepEqual(personEntries(entries, 'anna', 'reference').map(entry => entry.id), ['new', 'old']);
  assert.deepEqual(personEntries(entries, 'anna', 'gift').map(entry => entry.id), ['gift-new', 'gift']);
  assert.deepEqual(personEntries(entries, 'empty', 'reference'), []);
  assert.equal(entries[0].id, 'old');
});

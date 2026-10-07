import assert from 'node:assert/strict';
import test from 'node:test';
import { HELPERS } from '../src/helpers/registry.js';
import { importAll } from '../src/db.js';
import { STORES } from '../src/schema.js';
import {
  completeWaitingEntry, createWaitingEntry, isDateOnly, localDateKey,
  saveWaitingEntry, updateWaitingEntry, validateWaitingEntry, waitingDateLabel, waitingGroups
} from '../src/helpers/warte-auf/model.js';

const helper = HELPERS.find(item => item.id === 'warte-auf');
const entry = (id, values = {}) => ({ ...createWaitingEntry({ text: 'Rückmeldung' }, 1000), id, ...values });
const payload = entries => ({
  schemaVersion: 2,
  stores: Object.fromEntries(STORES.map(store => [store, store === 'entries' ? entries : []]))
});

test('Warte auf is registered without platform contexts or retention', () => {
  assert.ok(helper);
  assert.equal(helper.label, 'Warte auf');
  assert.equal(helper.contexts, undefined);
  assert.equal(helper.retention, undefined);
  assert.equal(helper.validateEntry, validateWaitingEntry);
});

test('Minimum entry needs only text and stores optional free text and a date-only value', () => {
  const minimal = createWaitingEntry({ text: '  Versicherung meldet sich  ' }, 1000);
  assert.equal(minimal.text, 'Versicherung meldet sich');
  assert.equal(minimal.status, 'waiting');
  assert.equal(minimal.expectedDate, undefined);
  assert.equal(minimal.waitingForText, undefined);
  const detailed = createWaitingEntry({ text: 'Angebot', waitingForText: ' Werkstatt ', expectedDate: '2026-10-09' }, 2000);
  assert.equal(detailed.waitingForText, 'Werkstatt');
  assert.equal(detailed.expectedDate, '2026-10-09');
  assert.equal(isDateOnly('2026-02-29'), false);
  assert.equal(isDateOnly('2024-02-29'), true);
  assert.equal(isDateOnly('2026-13-01'), false);
  assert.throws(() => createWaitingEntry({ text: '  ' }));
});

test('A reached date stays due when entries are listed or opened; no seen state exists', () => {
  const due = entry('due', { expectedDate: '2026-10-02' });
  const groups = waitingGroups([due], '2026-10-05');
  assert.deepEqual(groups.due.map(item => item.id), ['due']);
  assert.equal(waitingGroups([due], '2026-10-05').due[0].expectedDate, '2026-10-02');
  assert.equal(waitingDateLabel(due.expectedDate, '2026-10-05').startsWith('seit '), true);
  assert.throws(() => validateWaitingEntry({ ...due, seen: true }));
});

test('Waiting items are grouped and ordered by their date, with undated entries last', () => {
  const values = [
    entry('late', { expectedDate: '2026-10-10' }),
    entry('old', { expectedDate: '2026-10-01' }),
    entry('today', { expectedDate: '2026-10-05' }),
    entry('none'),
    { ...entry('done'), status: 'done', completedAt: 3000 }
  ];
  const groups = waitingGroups(values, '2026-10-05');
  assert.deepEqual(groups.due.map(item => item.id), ['old', 'today']);
  assert.deepEqual(groups.later.map(item => item.id), ['late']);
  assert.deepEqual(groups.undated.map(item => item.id), ['none']);
  assert.deepEqual(groups.done.map(item => item.id), ['done']);
  assert.equal(localDateKey(new Date(2026, 9, 5, 12).getTime()), `${new Date(2026, 9, 5, 12).getFullYear()}-10-05`);
});

test('Editing preserves identity and creation time; changing or removing the date is explicit', () => {
  const original = entry('same-id', { expectedDate: '2026-10-09' });
  const edited = updateWaitingEntry(original, { text: 'Neuer Text', waitingForText: 'HUK', expectedDate: '' });
  assert.equal(edited.id, original.id);
  assert.equal(edited.createdAt, original.createdAt);
  assert.equal(edited.text, 'Neuer Text');
  assert.equal(edited.waitingForText, 'HUK');
  assert.equal(edited.expectedDate, undefined);
  assert.equal(updateWaitingEntry(original, { text: original.text, expectedDate: original.expectedDate }).expectedDate, original.expectedDate);
});

test('Completion ends waiting for any reason without a person rating or close reason', () => {
  const original = entry('done-id', { expectedDate: '2026-10-09' });
  const completed = completeWaitingEntry(original, 5000);
  assert.equal(completed.status, 'done');
  assert.equal(completed.completedAt, 5000);
  assert.equal(completed.expectedDate, original.expectedDate);
  assert.deepEqual(waitingGroups([completed], '2026-10-10').due, []);
  assert.throws(() => validateWaitingEntry({ ...completed, closeReason: 'person did it' }));
});

test('Persistence records use only after commit, and a metadata failure keeps the committed entry', async () => {
  const calls = [];
  const api = {
    async saveEntry(value) { calls.push('commit'); return { ...value, id: 'stored' }; },
    async recordUse() { calls.push('use'); }
  };
  const saved = await saveWaitingEntry(api, createWaitingEntry({ text: 'Antwort' }, 1000));
  assert.equal(saved.entry.id, 'stored');
  assert.deepEqual(calls, ['commit', 'use']);
  await assert.rejects(saveWaitingEntry({
    async saveEntry() { calls.push('failed'); throw new Error('storage'); },
    async recordUse() { calls.push('incorrect use'); }
  }, createWaitingEntry({ text: 'Antwort' }, 2000)));
  assert.deepEqual(calls, ['commit', 'use', 'failed']);
  const result = await saveWaitingEntry({
    async saveEntry(value) { return value; },
    async recordUse() { throw new Error('metadata'); }
  }, createWaitingEntry({ text: 'Antwort' }, 3000));
  assert.equal(result.entry.text, 'Antwort');
  assert.equal(result.usageError.message, 'metadata');
});

test('Import rejects invalid waiting entries before opening IndexedDB', () => {
  let opens = 0;
  globalThis.indexedDB = { open() { opens++; throw new Error('Unexpected database access'); } };
  try {
    for (const patch of [
      { text: ' ' }, { expectedDate: '2026-02-30' }, { status: 'seen' }, { status: 'done' },
      { status: 'waiting', completedAt: 1 }, { status: 'done', completedAt: 'yesterday' },
      { waitingForText: 'x'.repeat(121) }, { entryVersion: 2 }, { seen: true }
    ]) {
      const invalid = { ...entry('invalid'), ...patch };
      assert.throws(() => importAll(payload([invalid])));
    }
    assert.equal(opens, 0);
  } finally {
    delete globalThis.indexedDB;
  }
});

test('Now card includes only reached, open entries and ends after completion or rescheduling', () => {
  const now = new Date(2026, 9, 7, 12).getTime();
  const due = entry('due', { text: 'Angebot der Werkstatt', waitingForText: 'Werkstatt', expectedDate: '2026-10-07' });
  const later = entry('later', { expectedDate: '2026-10-09' });
  const undated = entry('undated');
  const done = completeWaitingEntry(entry('done', { expectedDate: '2026-10-06' }), 2000);
  assert.deepEqual(helper.nowCard({ entries: [undated, done], now }), { active: false });
  assert.equal(helper.nowCard({ entries: [], now }).active, false);
  const card = helper.nowCard({ entries: [due, later, undated, done], now });
  assert.equal(card.active, true);
  assert.equal(card.primary, due.text);
  assert.equal(card.secondary, 'Werkstatt · heute wieder im Blick');
  assert.equal(card.nextChangeAt, new Date(2026, 9, 8).getTime());
  assert.equal(helper.nowCard({ entries: [completeWaitingEntry(due, now)], now }).active, false);
  assert.equal(helper.nowCard({ entries: [updateWaitingEntry(due, { text: due.text, expectedDate: '2026-10-09' })], now }).active, false);
});

test('Multiple due entries show their count and the earliest due content in stable order', () => {
  const now = new Date(2026, 9, 7, 12).getTime();
  const old = entry('old', { expectedDate: '2026-10-06', text: '<img src=x> Antwort' });
  const today = entry('today', { expectedDate: '2026-10-07' });
  const entries = Object.freeze([Object.freeze(today), Object.freeze(old)]);
  const card = helper.nowCard({ entries, now });
  assert.equal(card.primary, '2 Wiedervorlagen fällig');
  assert.equal(card.secondary, old.text);
  assert.equal(card.density, 'standard');
  assert.equal(card.nextChangeAt, undefined);
  assert.equal(helper.nowCard({ entries: [completeWaitingEntry(today, now), old], now }).primary, old.text);
  assert.equal(helper.nowCard({ entries: [{ ...old, text: 'x'.repeat(300) }], now }).density, 'standard');
});

test('Upcoming entries schedule their earliest local midnight, including DST dates', () => {
  for (const [year, month, day] of [[2026, 9, 7], [2026, 2, 29], [2026, 9, 25]]) {
    const start = new Date(year, month, day);
    const tomorrow = new Date(year, month, day + 1);
    const expectedDate = localDateKey(tomorrow.getTime());
    const upcoming = entry('future', { expectedDate });
    const card = helper.nowCard({ entries: [upcoming], now: start.getTime() });
    assert.equal(card.active, false);
    assert.equal(card.nextChangeAt, tomorrow.getTime());
    assert.equal(helper.nowCard({ entries: [upcoming], now: tomorrow.getTime() - 1 }).active, false);
    assert.equal(helper.nowCard({ entries: [upcoming], now: tomorrow.getTime() }).active, true);
    if (process.env.TZ === 'Europe/Berlin' && month === 2) assert.equal(card.nextChangeAt - start.getTime(), 23 * 3600000);
    if (process.env.TZ === 'Europe/Berlin' && month === 9 && day === 25) assert.equal(card.nextChangeAt - start.getTime(), 25 * 3600000);
  }
  const now = new Date(2026, 9, 7, 12).getTime();
  const future = entry('future', { expectedDate: '2026-11-01' });
  assert.equal(helper.nowCard({ entries: [future, entry('soon', { expectedDate: '2026-10-10' })], now }).nextChangeAt, new Date(2026, 9, 10).getTime());
  const expired = entry('old', { expectedDate: '2026-10-01' });
  assert.equal(helper.nowCard({ entries: [expired], now }).nextChangeAt, undefined);
});

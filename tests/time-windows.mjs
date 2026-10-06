import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_TIME_WINDOWS, DEFAULT_TIME_WINDOW_IDS, TIME_WINDOW_SETTING_ID,
  allTimeWindows, findTimeWindow, isTimeWindowId, minutesToTime, timeToMinutes,
  timeWindowLabel, validateCustomTimeWindow, validateCustomTimeWindows
} from '../src/time-windows.js';
import { matchingTimeWindows, nextTimeBoundary, evaluateHelperContext, timeBucket, timeBucketLabel, TIME_BUCKETS } from '../src/context.js';
import { changeNoteContext, noteLinks, relevantNotes } from '../src/notes.js';
import { STORES, validateImport, validateRecord } from '../src/schema.js';

const breakfast = { id: 'time-breakfast', label: 'Zweites Frühstück', startMinute: 570, endMinute: 630 };
const night = { id: 'time-shift', label: 'Nachtschicht', startMinute: 1320, endMinute: 360 };
const windows = allTimeWindows([breakfast, night]);
const at = (hour, minute = 0, second = 0) => new Date(2026, 9, 6, hour, minute, second);
const ids = date => matchingTimeWindows(date, windows).map(window => window.id);
const rule = { id: 'pain', placeIds: [], timeBuckets: ['morning', breakfast.id], interval: null };

// Exhaust all minutes, rather than reproducing the new window predicate.
test('All 1440 legacy minutes and labels retain their old bucket contract', () => {
  const expected = [
    ...Array(300).fill('night'), ...Array(360).fill('morning'),
    ...Array(240).fill('midday'), ...Array(420).fill('evening'), ...Array(120).fill('night')
  ];
  expected.forEach((id, minute) => {
    const date = at(Math.floor(minute / 60), minute % 60, 59);
    assert.equal(timeBucket(date), id);
    assert.deepEqual(matchingTimeWindows(date).map(window => window.id), [id]);
  });
  assert.deepEqual(TIME_BUCKETS.map(window => [window.id, window.startHour, window.endHour]), [
    ['morning', 5, 11], ['midday', 11, 15], ['evening', 15, 22], ['night', 22, 5]
  ]);
  assert.deepEqual(DEFAULT_TIME_WINDOW_IDS.map(id => timeBucketLabel(id)), [
    'morgens · 05–11 Uhr', 'mittags · 11–15 Uhr', 'abends · 15–22 Uhr', 'nachts · 22–05 Uhr'
  ]);
});

test('Overlapping windows include their start and exclude their end, including seconds', () => {
  assert.deepEqual(ids(at(9, 29, 59)), ['morning']);
  assert.deepEqual(ids(at(9, 30)), ['morning', breakfast.id]);
  assert.deepEqual(ids(at(10)), ['morning', breakfast.id]);
  assert.deepEqual(ids(at(10, 29, 59)), ['morning', breakfast.id]);
  assert.deepEqual(ids(at(10, 30)), ['morning']);
  const overlapping = allTimeWindows([breakfast, { ...breakfast, id: 'time-overlap' }]);
  assert.equal(matchingTimeWindows(at(10), overlapping).length, 3);
});

test('Overnight and midnight-ending windows obey exclusive end boundaries', () => {
  for (const [hour, minute, expected] of [[21, 59, false], [22, 0, true], [4, 0, true], [5, 59, true], [6, 0, false]]) {
    assert.equal(ids(at(hour, minute)).includes(night.id), expected, `${hour}:${minute}`);
  }
  const midnight = [{ ...night, endMinute: 0 }];
  assert.equal(matchingTimeWindows(at(23, 59, 59), midnight).length, 1);
  assert.equal(matchingTimeWindows(at(0), midnight).length, 0);
});

test('One next boundary includes custom starts, custom ends and the following local day', () => {
  for (const [now, next] of [
    [at(9, 29, 59), at(9, 30)], [at(9, 30), at(10, 30)],
    [at(10), at(10, 30)], [at(10, 30), at(11)],
    [at(5, 59), at(6)], [at(23, 59), new Date(2026, 9, 7, 5)]
  ]) assert.equal(nextTimeBoundary(now, windows), next.getTime());
  assert.equal(nextTimeBoundary(at(23), [breakfast]), new Date(2026, 9, 7, 9, 30).getTime());
  assert.equal(nextTimeBoundary(at(10), []), null);
});

test('Selected overlapping helper windows explain Warum jetzt while preserving context priority', () => {
  const time = evaluateHelperContext(rule, [], 0, at(10), windows).match;
  assert.equal(time.rank, 200);
  assert.equal(time.reason, 'morgens · 05–11 Uhr');
  assert.equal(time.why, 'morgens (05–11 Uhr) · Zweites Frühstück (09:30–10:30 Uhr)');
  const selected = { ...rule, timeBuckets: [breakfast.id] };
  assert.equal(evaluateHelperContext(selected, [], 0, at(10), windows).match.reason, 'Zweites Frühstück · 09:30–10:30 Uhr');
  assert.equal(evaluateHelperContext(selected, [], 0, at(10, 30), windows).match, null);
  const interval = { ...rule, placeIds: ['office'], interval: { value: 1, unit: 'hour' } };
  assert.equal(evaluateHelperContext(interval, [], at(8).getTime(), at(10), windows).match.rank, 300);
  const place = evaluateHelperContext(interval, [{ id: 'office', name: 'Büro' }], at(8).getTime(), at(10), windows).match;
  assert.equal(place.rank, 400);
  assert.deepEqual(place.launchPlace, { id: 'office', name: 'Büro' });
  assert.match(place.why, /Zweites Frühstück/);
});

for (const type of ['note', 'person-note']) test(`${type}: rename, move and delete preserve references and use current definitions`, () => {
  const original = { id: type, type, text: 'Kaffee bestellen', createdAt: 1, ...(type === 'person-note' ? { personId: 'mama', kind: 'reference' } : {}) };
  const note = changeNoteContext(original, { timeBuckets: [breakfast.id] });
  const before = structuredClone(note);
  const renamed = allTimeWindows([{ ...breakfast, label: 'Pause' }]);
  const moved = allTimeWindows([{ ...breakfast, label: 'Pause', startMinute: 660, endMinute: 720 }]);
  const relevant = (date, definitions) => relevantNotes([note], [], matchingTimeWindows(date, definitions).map(window => window.id), definitions);
  assert.equal(relevant(at(10), windows)[0].rank, 200);
  assert.equal(relevant(at(10), renamed)[0].reason, 'Pause · 09:30–10:30 Uhr');
  assert.equal(noteLinks(note, [], renamed)[0].label, 'Pause · 09:30–10:30 Uhr');
  assert.equal(relevant(at(10), moved).length, 0);
  assert.equal(relevant(at(11), moved).length, 1);
  assert.equal(relevant(at(10), DEFAULT_TIME_WINDOWS).length, 0);
  assert.equal(noteLinks(note, [])[0].label, 'Zeitfenster nicht mehr vorhanden');
  assert.deepEqual(note, before);
  assert.equal(note.personId, original.personId);
  const withPlace = changeNoteContext(note, { placeIds: ['office'] });
  assert.equal(relevantNotes([withPlace], [{ id: 'office', name: 'Büro' }], ids(at(10)), windows)[0].rank, 400);
  assert.equal(relevantNotes([{ ...note, context: { timeBuckets: ['morning'] } }], [], 'morning').length, 1, 'legacy scalar API');
});

test('Missing helper windows remain valid IDs without matching or mutating the rule', () => {
  const missing = { ...rule, timeBuckets: ['time-deleted'] };
  assert.doesNotThrow(() => validateRecord('helperRules', missing));
  assert.equal(evaluateHelperContext(missing, [], 0, at(10), windows).match, null);
  assert.deepEqual(missing.timeBuckets, ['time-deleted']);
});

test('Clock parsing and formatting round trip every minute and reject malformed UI times', () => {
  for (let minute = 0; minute < 1440; minute++) assert.equal(timeToMinutes(minutesToTime(minute)), minute);
  for (const input of ['', null, undefined, '24:00', '23:60', '9:30', '09:3', '09:30:00', ' 09:30', '-1:00', 'xx:yy']) {
    assert.equal(timeToMinutes(input), null, String(input));
  }
  assert.equal(timeWindowLabel(breakfast), 'Zweites Frühstück · 09:30–10:30 Uhr');
  assert.equal(timeWindowLabel(breakfast, { compact: true }), 'Zweites Frühstück (09:30–10:30 Uhr)');
  assert.equal(findTimeWindow(breakfast.id, windows), breakfast);
});

const invalidWindows = [
  null, [], {}, { ...breakfast, label: '' }, { ...breakfast, label: '   ' },
  { ...breakfast, label: 'x'.repeat(61) }, { ...breakfast, startMinute: 630 },
  ...[-1, 1440, 570.5, '570', null, NaN, Infinity].flatMap(value => [
    { ...breakfast, startMinute: value }, { ...breakfast, endMinute: value }
  ]),
  ...['morning', 'time-', 'time-a/b', 'unknown', 'time-<img>', 'time-' + 'x'.repeat(81)].map(id => ({ ...breakfast, id }))
];

test('Invalid definitions and duplicate IDs fail both model and settings validation', () => {
  for (const window of invalidWindows) {
    assert.throws(() => validateCustomTimeWindow(window));
    assert.throws(() => validateRecord('settings', { id: TIME_WINDOW_SETTING_ID, value: [window] }));
  }
  for (const value of [null, {}, [breakfast, { ...breakfast, label: 'Duplicate' }]]) {
    assert.throws(() => validateCustomTimeWindows(value));
  }
  assert.doesNotThrow(() => validateCustomTimeWindows([breakfast, night, { ...breakfast, id: 'time-other', label: 'x'.repeat(60) }]));
  for (const id of ['time-', 'time-a/b', 'unknown', '', null]) {
    assert.equal(isTimeWindowId(id), false);
    assert.throws(() => validateRecord('helperRules', { id: 'pain', timeBuckets: [id] }));
    for (const type of ['note', 'person-note']) assert.throws(() => validateRecord('entries', { id: 'note', type, text: 'x', createdAt: 1, context: { timeBuckets: [id] } }));
  }
});

function payload() {
  return { schemaVersion: 2, stores: Object.fromEntries(STORES.map(store => [store, []])) };
}

test('Import snapshot preserves custom definitions and all references; old v1/v2 exports still validate', () => {
  const data = payload();
  data.stores.settings.push({ id: TIME_WINDOW_SETTING_ID, value: [breakfast, night] });
  data.stores.helperRules.push(rule);
  data.stores.entries.push(...['note', 'person-note'].map(type => ({ id: type, type, text: 'Test', createdAt: 1, context: { timeBuckets: [breakfast.id, 'time-deleted'] } })));
  const snapshot = validateImport(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(snapshot, data.stores);
  snapshot.settings[0].value[0].label = 'Changed';
  assert.equal(data.stores.settings[0].value[0].label, breakfast.label);
  for (const schemaVersion of [1, 2]) {
    const old = payload(); old.schemaVersion = schemaVersion;
    old.stores.entries = [{ id: 'legacy', type: 'note', text: 'Old', createdAt: 1, context: { timeBuckets: ['morning'] } }];
    if (schemaVersion === 1) delete old.stores.helperRules;
    assert.deepEqual(validateImport(old).settings, []);
  }
  for (const value of [[{ ...breakfast, label: '' }], [breakfast, breakfast]]) {
    const bad = payload(); bad.stores.settings.push({ id: TIME_WINDOW_SETTING_ID, value });
    assert.throws(() => validateImport(bad));
  }
});

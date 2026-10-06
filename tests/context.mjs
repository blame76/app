import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TIME_BUCKET_IDS,
  evaluateHelperContext,
  nextTimeBoundary,
  timeBucket,
  timeBucketLabel
} from '../src/context.js';

test('Local time buckets use the canonical human boundaries', () => {
  const at = (hour, minute) => new Date(2026, 9, 6, hour, minute);
  for (const [hour, minute, expected] of [
    [4, 59, 'night'], [5, 0, 'morning'],
    [10, 59, 'morning'], [11, 0, 'midday'],
    [14, 59, 'midday'], [15, 0, 'evening'],
    [21, 59, 'evening'], [22, 0, 'night'],
    [23, 59, 'night'], [0, 0, 'night']
  ]) assert.equal(timeBucket(at(hour, minute)), expected, `${hour}:${minute}`);
  assert.deepEqual(TIME_BUCKET_IDS, ['morning', 'midday', 'evening', 'night']);
});

test('Time labels and the next local boundary come from the same definition', () => {
  assert.deepEqual(TIME_BUCKET_IDS.map(id => timeBucketLabel(id)), [
    'morgens · 05–11 Uhr',
    'mittags · 11–15 Uhr',
    'abends · 15–22 Uhr',
    'nachts · 22–05 Uhr'
  ]);
  assert.equal(timeBucketLabel('evening', { capitalize: true }), 'Abends · 15–22 Uhr');
  assert.equal(nextTimeBoundary(new Date(2026, 9, 6, 4, 59)), new Date(2026, 9, 6, 5).getTime());
  assert.equal(nextTimeBoundary(new Date(2026, 9, 6, 5)), new Date(2026, 9, 6, 11).getTime());
  assert.equal(nextTimeBoundary(new Date(2026, 9, 6, 23, 59)), new Date(2026, 9, 7, 5).getTime());
});

test('Only configured current reasons match; recorded use is never its own fallback', () => {
  const monday = new Date(2026, 9, 5, 10).getTime();
  const rule = {
    placeIds: ['gym'],
    timeBuckets: [],
    interval: { value: 3, unit: 'day' },
    earlyBy: null,
    legacyIntervalMinutes: null,
    legacyToleranceMinutes: null
  };
  const home = [];
  const gym = [{ id: 'gym', name: 'Gym' }];
  assert.equal(evaluateHelperContext(rule, home, monday, new Date(2026, 9, 5, 20)).match, null);
  assert.equal(evaluateHelperContext(rule, gym, monday, new Date(2026, 9, 7, 10)).match.reason, 'Gym');
  assert.equal(evaluateHelperContext(rule, home, monday, new Date(2026, 9, 8, 10)).match.reason, 'wieder im Blick · nach 3 Tagen');
  assert.equal(evaluateHelperContext({ ...rule, placeIds: [], interval: null }, home, monday, new Date(2026, 9, 5, 20)).match, null);
  assert.equal(evaluateHelperContext(rule, home, 0, new Date(2026, 9, 8, 10)).match, null);
});

test('Place OR interval OR time keeps place-first priority and explains every current match', () => {
  const usedAt = new Date(2026, 9, 1, 10).getTime();
  const rule = {
    placeIds: ['gym'],
    timeBuckets: ['evening'],
    interval: { value: 1, unit: 'day' },
    earlyBy: null,
    legacyIntervalMinutes: null,
    legacyToleranceMinutes: null
  };
  const date = new Date(2026, 9, 6, 18);

  const all = evaluateHelperContext(rule, [{ id: 'gym', name: 'Gym' }], usedAt, date).match;
  assert.equal(all.reason, 'Gym');
  assert.equal(all.rank, 400);
  assert.equal(all.why, 'Gym · Intervall 1 Tag · abends (15–22 Uhr)');

  const intervalAndTime = evaluateHelperContext(rule, [], usedAt, date).match;
  assert.equal(intervalAndTime.reason, 'wieder im Blick · nach 1 Tag');
  assert.equal(intervalAndTime.rank, 300);
  assert.equal(intervalAndTime.why, 'Intervall 1 Tag · abends (15–22 Uhr)');

  const timeOnly = evaluateHelperContext({ ...rule, interval: null }, [], usedAt, date).match;
  assert.equal(timeOnly.reason, 'abends · 15–22 Uhr');
  assert.equal(timeOnly.why, timeOnly.reason);

  assert.equal(evaluateHelperContext({ ...rule, interval: null }, [{ id: 'deleted', name: 'Gelöscht' }], usedAt, date).match.reason, 'abends · 15–22 Uhr');
});

test('Future interval due time is exposed once and disappears after becoming due', () => {
  const usedAt = new Date(2026, 9, 6, 12).getTime();
  const rule = {
    placeIds: [], timeBuckets: [], interval: { value: 60, unit: 'minute' },
    earlyBy: { value: 15, unit: 'minute' }, legacyIntervalMinutes: null, legacyToleranceMinutes: null
  };
  const before = evaluateHelperContext(rule, [], usedAt, new Date(usedAt + 44 * 60000));
  assert.equal(before.match, null);
  assert.equal(before.nextIntervalAt, usedAt + 45 * 60000);
  const due = evaluateHelperContext(rule, [], usedAt, new Date(usedAt + 45 * 60000));
  assert.equal(due.match.reason, 'wieder im Blick · nach 60 Minuten');
  assert.equal(due.nextIntervalAt, null);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { fromLegacyMinutes, intervalDueAt, intervalLabel } from '../src/intervals.js';

test('Legacy minute intervals convert to the largest exact familiar unit', () => {
  assert.deepEqual(fromLegacyMinutes(60), { value: 1, unit: 'hour' });
  assert.deepEqual(fromLegacyMinutes(720), { value: 12, unit: 'hour' });
  assert.deepEqual(fromLegacyMinutes(4320), { value: 3, unit: 'day' });
  assert.deepEqual(fromLegacyMinutes(10080), { value: 1, unit: 'week' });
  assert.deepEqual(fromLegacyMinutes(90), { value: 90, unit: 'minute' });
  assert.deepEqual(fromLegacyMinutes(0, { allowZero: true }), { value: 0, unit: 'minute' });
  assert.equal(fromLegacyMinutes(null), null);
});

test('Interval labels use readable German singular and plural forms', () => {
  assert.equal(intervalLabel({ value: 1, unit: 'year' }), '1 Jahr');
  assert.equal(intervalLabel({ value: 3, unit: 'day' }), '3 Tage');
  assert.equal(intervalLabel({ value: 2, unit: 'week' }), '2 Wochen');
});

test('Due time subtracts the earlier-display duration from the interval date', () => {
  const start = new Date(2026, 5, 10, 10).getTime();
  assert.equal(intervalDueAt(start, { value: 1, unit: 'hour' }, { value: 15, unit: 'minute' }), start + 45 * 60000);
  assert.equal(intervalDueAt(start, { value: 3, unit: 'day' }, { value: 12, unit: 'hour' }), start + 60 * 3600000);
  assert.equal(intervalDueAt(start, null), null);
  assert.throws(() => intervalDueAt(start, { value: 1, unit: 'day' }, { value: 1, unit: 'day' }));
});

test('Calendar months and years clamp an unavailable target day to month end', () => {
  const january31 = new Date(2025, 0, 31, 9).getTime();
  assert.equal(intervalDueAt(january31, { value: 1, unit: 'month' }), new Date(2025, 1, 28, 9).getTime());
  const leapFebruary = new Date(2024, 1, 29, 9).getTime();
  assert.equal(intervalDueAt(leapFebruary, { value: 1, unit: 'year' }), new Date(2025, 1, 28, 9).getTime());
  assert.equal(intervalDueAt(leapFebruary, { value: 4, unit: 'year' }), new Date(2028, 1, 29, 9).getTime());
});

test('Calendar days preserve local wall time across daylight-saving changes', () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = 'Europe/Berlin';
  try {
    assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'Europe/Berlin');
    const beforeSpringChange = new Date(2026, 2, 28, 9).getTime();
    const nextDay = new Date(2026, 2, 29, 9).getTime();
    assert.equal(intervalDueAt(beforeSpringChange, { value: 1, unit: 'day' }), nextDay);
    assert.equal(nextDay - beforeSpringChange, 23 * 3600000);
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

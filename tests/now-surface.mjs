import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHelper, validateNowCard, projectNowCard, helperDefaults } from '../src/helpers/contract.js';
import { evaluateHelperContext } from '../src/context.js';
import { CONTEXT_TYPES } from '../src/schema.js';
import parking from '../src/helpers/parking/index.js';
import pain from '../src/helpers/pain/index.js';
import training from '../src/helpers/training/index.js';
import drink from '../src/helpers/drink/index.js';
import { createObservation } from '../src/helpers/pain/model.js';
import { createTraining } from '../src/helpers/training/model.js';
import { createDrink } from '../src/helpers/drink/model.js';

const now = new Date(2026, 9, 6, 19).getTime();
const project = (helper, entries = [], overrides = {}) => projectNowCard(helper, entries, { now, interval: null, lastUsedAt: 0, ...overrides });
const event = (id, area, value, at, resolved = false) => ({ ...createObservation(area, value, at, resolved), id });
const minimal = { id: 'minimal', label: 'Minimal', category: 'Test', mount() {} };

test('Optional projection: old helpers, pure snapshots and validated data-only result', () => {
  assert.equal(validateHelper(minimal), minimal);
  assert.deepEqual(project(minimal), { active: false });
  assert.throws(() => validateHelper({ ...minimal, nowCard: {} }));
  const own = { id: 'a', helperId: 'minimal', nested: { value: 1 } };
  const other = { id: 'b', helperId: 'other' };
  const helper = { ...minimal, nowCard(input) {
    assert.deepEqual(input.entries, [own]);
    assert.ok(Object.isFrozen(input) && Object.isFrozen(input.entries[0].nested) && Object.isFrozen(input.interval));
    assert.throws(() => { input.entries[0].nested.value = 2; });
    return { active: true, primary: 'Text', secondary: 'Details', badge: { value: '2', label: 'Zwei Einträge' }, tone: 'attention', density: 'standard', nextChangeAt: now + 1 };
  } };
  assert.equal(project(helper, [own, other], { interval: { value: 1, unit: 'hour' } }).active, true);
  assert.equal(own.nested.value, 1);
  assert.equal(Object.isFrozen(own), false);
  for (const invalid of [null, [], true, {}, Promise.resolve({ active: true }), { active: 1 }, { active: true, html: '<b>x</b>' },
    { active: true, primary: 3 }, { active: true, primary: '' }, { active: true, tone: 'danger' }, { active: true, density: 'large' },
    { active: true, badge: { value: '2' } }, { active: true, badge: { value: '2', label: 'Two', score: 3 } },
    { active: true, nextChangeAt: NaN }, { active: true, nextChangeAt: -1 }]) assert.throws(() => validateNowCard(invalid));
  assert.deepEqual(CONTEXT_TYPES, ['place', 'time', 'interval']);
});

test('Parking exists until its single state is removed; actual note and time remain data', () => {
  const entry = { id: 'parking-position', helperId: 'parking', createdAt: now, note: 'Ebene 3 · Aufzug B' };
  assert.equal(project(parking).active, false);
  assert.equal(project(parking, [entry]).primary, 'Du parkst · Ebene 3 · Aufzug B');
  assert.equal(project(parking, [entry]).active, true);
  assert.equal(project(parking, [{ ...entry, note: '' }]).primary, 'Auto geparkt');
  assert.equal(project(parking, [{ ...entry, note: '<img src=x>' }]).primary, 'Du parkst · <img src=x>');
  assert.equal(project(parking, []).active, false);
});

test('Pain tracks the latest event independently for each normalized area', () => {
  const entries = [event('1', 'Kopf', 6, now - 5), event('2', 'kopf', 4, now - 4), event('3', 'Rücken', 3, now - 3)];
  assert.equal(project(pain, entries.slice(0, 1)).primary, 'Kopf · 6/10');
  assert.equal(project(pain, entries.slice(0, 2)).primary, 'kopf · 4/10');
  assert.equal(project(pain, entries).primary, '2 Schmerzorte aktiv');
  entries.push(event('4', 'Kopf', 0, now - 2, true));
  assert.equal(project(pain, entries).primary, 'Rücken · 3/10');
  entries.push(event('5', 'Rücken', 0, now - 1, true));
  assert.equal(project(pain, entries).active, false);
  const context = evaluateHelperContext({ ...helperDefaults(pain), placeIds: ['home'] }, [{ id: 'home', name: 'Zuhause' }], 0, new Date(now));
  assert.ok(context.match || project(pain, entries).active);
  // Same timestamps use exactly the existing history tie-breaker.
  assert.equal(project(pain, [event('a', 'Kopf', 6, now), event('z', 'Kopf', 0, now, true)]).active, false);
});

test('Training is active independent of rules, otherwise summarizes the last completed session', () => {
  const active = { ...createTraining(now - 60000), id: 'active' };
  const endedAt = now - 4 * 86400000;
  const ended = { ...createTraining(endedAt - 60000), id: 'ended', status: 'ended', endedAt, activities: [] };
  assert.equal(project(training).active, false);
  assert.equal(project(training).primary, 'Noch kein Training dokumentiert');
  assert.equal(project(training, [active, ended]).primary, 'Training läuft');
  assert.equal(project(training, [active, ended]).active, true);
  assert.equal(project(training, [ended]).primary, 'Letztes Training vor 4 Tagen');
  assert.equal(project(training, [ended]).active, false);
  assert.ok(project(training, [ended]).nextChangeAt > now);
  const rule = helperDefaults(training);
  assert.equal(evaluateHelperContext(rule, [], now, new Date(now)).match, null);
  assert.ok(evaluateHelperContext(rule, [], endedAt, new Date(now)).match);
});

test('Drink counts complete nominal intervals, never earlyBy or use metadata', () => {
  const entry = { ...createDrink(now), id: 'drink-1' };
  const interval = { value: 1, unit: 'hour' };
  for (const [minutes, missed] of [[45, 0], [59, 0], [60, 1], [119, 1], [120, 2], [179, 2], [180, 3]]) {
    const card = project(drink, [entry], { now: now + minutes * 60000, interval, lastUsedAt: now - 10 * 86400000 });
    assert.equal(card.active, false);
    assert.equal(card.badge?.value ?? '0', String(missed), `${minutes} minutes`);
    assert.equal(card.tone, missed >= 2 ? 'attention' : 'normal');
    assert.ok(card.nextChangeAt > now + minutes * 60000);
    if (!missed) assert.equal(card.primary, 'Bald wieder dran');
  }
  const rule = helperDefaults(drink);
  for (const minutes of [45, 59]) {
    assert.ok(evaluateHelperContext(rule, [], now, new Date(now + minutes * 60000)).match);
    assert.equal(project(drink, [entry], { now: now + minutes * 60000, interval }).badge, undefined);
  }
  const logged = now + 180 * 60000;
  assert.equal(project(drink, [entry, { ...createDrink(logged), id: 'new' }], { now: logged, interval }).badge, undefined);
  assert.equal(evaluateHelperContext(rule, [], logged, new Date(logged)).match, null);
  assert.equal(project(drink, [entry], { now: now + 1799999, interval: { value: 30, unit: 'minute' } }).badge, undefined);
  assert.equal(project(drink, [entry], { now: now + 1800000, interval: { value: 30, unit: 'minute' } }).badge.value, '1');
});

test('Calendar intervals, future entries, absent history and disabled reminders stay defensive', () => {
  const entry = { ...createDrink(now), id: 'drink-1' };
  for (const unit of ['day', 'week', 'month', 'year']) {
    const card = project(drink, [entry], { now: now + 400 * 86400000, interval: { value: 1, unit } });
    assert.equal(card.badge, undefined);
    assert.equal(card.primary, 'Trinken wieder dokumentieren');
  }
  assert.equal(project(drink, [entry], { now: now - 60000, interval: { value: 1, unit: 'hour' } }).badge, undefined);
  assert.equal(project(drink, []).active, false);
  assert.equal(project(drink, [{ ...createDrink(8640000000000000), id: 'future' }], { interval: { value: 1, unit: 'hour' } }).badge, undefined);
  assert.equal(project(drink, [entry]).badge, undefined);
  assert.equal(evaluateHelperContext({ ...helperDefaults(drink), interval: null, earlyBy: null }, [], now, new Date(now + 1e9)).match, null);
});

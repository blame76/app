import assert from 'node:assert/strict';
import test from 'node:test';
import { HELPERS } from '../src/helpers/registry.js';
import { helperDefaults } from '../src/helpers/contract.js';
import {
  createTraining, finishTraining, formatActivity, formatDistance, formatDuration, formatSets,
  latestActivityReference, latestSession, latestSessionAtPlace, normalizeActivityName,
  normalizeDisplayName, repeatStructure, sessionReference, validateTrainingEntry
} from '../src/helpers/training/model.js';
import { importAll } from '../src/db.js';
import { STORES } from '../src/schema.js';

const start = 1000;
const session = (id, patch = {}) => ({
  ...createTraining(start, { id: 'home', name: 'Zuhause' }),
  id,
  status: 'ended',
  endedAt: start + 100,
  activities: [{ id: 'a1', name: 'Rudermaschine', mode: 'duration', durationSeconds: 2700, recordedAt: start + 50 }],
  ...patch
});
const setActivity = (name, sets) => ({ id: 'a1', name, mode: 'sets', sets });
const distanceActivity = (name, distanceMeters, durationSeconds) => ({
  id: 'a1', name, mode: 'distance', distanceMeters, ...(durationSeconds === undefined ? {} : { durationSeconds }), recordedAt: start + 50
});

test('Training is registered once with place and a tolerant three-day interval', () => {
  const helper = HELPERS.filter(item => item.id === 'training');
  assert.equal(helper.length, 1);
  assert.equal(helper[0].label, 'Training');
  assert.equal(helper[0].category, 'Wohlbefinden');
  assert.deepEqual(helper[0].contexts, ['place', 'interval']);
  assert.deepEqual(helperDefaults(helper[0]), {
    id: 'training', visible: true, favorite: false, placeIds: [], timeBuckets: [],
    interval: { value: 3, unit: 'day' }, earlyBy: { value: 12, unit: 'hour' }, trackingWindow: 'always'
  });
});

test('Activity validation accepts exactly sets, duration and distance shapes', () => {
  const base = createTraining(start, { id: 'gym', name: 'Gym' });
  validateTrainingEntry({ ...base, activities: [
    setActivity('Bizepsmaschine', [{ weightKg: 45, reps: 10, recordedAt: start + 1 }]),
    { id: 'a2', name: 'Pilates', mode: 'duration', durationSeconds: 1800, recordedAt: start + 2 },
    { id: 'a3', name: 'Laufband', mode: 'distance', distanceMeters: 3000, durationSeconds: 1200, recordedAt: start + 3 }
  ] });
  assert.throws(() => validateTrainingEntry({ ...base, unknown: true }), /Unbekanntes Trainingsfeld/);
  assert.throws(() => validateTrainingEntry({ ...base, activities: [{ id: 'a1', name: '   ', mode: 'sets', sets: [] }] }), /Aktivitätsname/);
  assert.throws(() => validateTrainingEntry({ ...base, activities: [{ id: 'a1', name: 'Pilates', mode: 'duration', durationSeconds: 0, recordedAt: start }] }), /Dauer/);
  assert.throws(() => validateTrainingEntry({ ...base, activities: [{ id: 'a1', name: 'Laufen', mode: 'distance', distanceMeters: 0, recordedAt: start }] }), /Strecke/);
  assert.throws(() => validateTrainingEntry({ ...base, activities: [{ id: 'a1', name: 'Laufen', mode: 'distance', durationSeconds: 1200, recordedAt: start }] }), /Strecke/);
  assert.throws(() => validateTrainingEntry({ ...base, activities: [{ ...setActivity('Liegestütze', [{ reps: 10, recordedAt: start }]), extra: true }] }), /Satzfeld/);
  assert.throws(() => validateTrainingEntry({ ...base, activities: [{ ...setActivity('Liegestütze', [{ reps: 10, recordedAt: start }]), sets: [{ reps: 0, recordedAt: start }] }] }), /Wiederholungszahl/);
});

test('Active and ended session constraints distinguish empty sessions', () => {
  const active = createTraining(start);
  validateTrainingEntry(active);
  validateTrainingEntry({ ...active, activities: [{ id: 'a1', name: 'Laufen', mode: 'distance' }] });
  assert.throws(() => validateTrainingEntry({ ...active, status: 'active', endedAt: start }), /Trainingsabschluss/);
  assert.throws(() => validateTrainingEntry({ ...active, status: 'ended', endedAt: start }), /dokumentierte Aktivität/);
  assert.throws(() => validateTrainingEntry({
    ...active, status: 'ended', endedAt: start,
    activities: [{ id: 'a1', name: 'Bizepsmaschine', mode: 'sets', sets: [] }]
  }), /leeren Satzaktivitäten/);
  assert.throws(() => validateTrainingEntry({ ...active, status: 'ended', endedAt: start - 1, activities: [setActivity('Kniebeugen', [{ reps: 1, recordedAt: start }])] }), /Trainingsabschluss/);
});

test('Activity names normalize minimally while preserving their display spelling', () => {
  assert.equal(normalizeDisplayName('  Brustpresse\tmit  Gewicht  '), 'Brustpresse mit Gewicht');
  assert.equal(normalizeActivityName('  BRÜSTPRESSE  '), normalizeActivityName('Brüstpresse'));
  assert.equal(normalizeActivityName('Brustpresse'), normalizeActivityName(' Brustpresse '));
  assert.notEqual(normalizeActivityName('Brustpresse'), normalizeActivityName('Brust-Presse'));
});

test('Last session selection is global without a place and exact-place only with one', () => {
  const home = session('home-session', { endedAt: 2000 });
  const gym = session('gym-session', { endedAt: 3000, place: { id: 'gym', name: 'Gym' } });
  const entries = [home, gym, { ...createTraining(4000), id: 'active-session' }];
  assert.equal(latestSession(entries).id, 'gym-session');
  assert.equal(latestSessionAtPlace(entries, 'home').id, 'home-session');
  assert.equal(latestSessionAtPlace(entries, 'unknown'), null);
  assert.equal(sessionReference(entries, { id: 'unknown', name: 'Other' }), null);
  assert.equal(sessionReference(entries, null).id, 'gym-session');
});

test('Activity reference prefers same place then falls back globally', () => {
  const global = session('global', { endedAt: 5000, place: { id: 'gym', name: 'Gym' }, activities: [
    setActivity('Bizepsmaschine', [{ weightKg: 40, reps: 8, recordedAt: 4900 }])
  ] });
  const local = session('local', { endedAt: 3000, place: { id: 'home', name: 'Zuhause' }, activities: [
    setActivity('Bizepsmaschine', [{ weightKg: 45, reps: 10, recordedAt: 2900 }])
  ] });
  assert.equal(latestActivityReference([global, local], ' BIZEPSMASCHINE ', 'home').session.id, 'local');
  assert.equal(latestActivityReference([global], 'Bizepsmaschine', 'home').session.id, 'global');
  assert.equal(latestActivityReference([global], 'Brust-Presse', 'home'), null);
});

test('Repeating a training retains structure but never copies completed values', () => {
  const reference = session('reference', {
    title: 'Arme',
    activities: [
      setActivity('Bizepsmaschine', [{ weightKg: 45, reps: 10, recordedAt: 1100 }, { weightKg: 45, reps: 9, recordedAt: 1200 }]),
      { id: 'a2', name: 'Pilates', mode: 'duration', durationSeconds: 1800, recordedAt: 1200 },
      distanceActivity('Laufband', 3000, 1200)
    ]
  });
  const repeated = repeatStructure(reference);
  assert.equal(repeated.title, 'Arme');
  assert.equal(repeated.basedOnSessionId, 'reference');
  assert.deepEqual(repeated.activities, [
    { id: 'a1', name: 'Bizepsmaschine', mode: 'sets', sets: [] },
    { id: 'a2', name: 'Pilates', mode: 'duration' },
    { id: 'a3', name: 'Laufband', mode: 'distance' }
  ]);
  validateTrainingEntry({ ...createTraining(2000), ...repeated });
});

test('Formatting shows only measurements without derived pace or assessment', () => {
  assert.equal(formatSets(setActivity('Bizeps', [
    { weightKg: 45, reps: 10, recordedAt: start },
    { weightKg: 45, reps: 9, recordedAt: start + 1 }
  ])), '45 kg · 10 / 9');
  assert.equal(formatSets(setActivity('Liegestütze', [{ reps: 12, recordedAt: start }, { reps: 10, recordedAt: start + 1 }])), '12 / 10');
  assert.equal(formatDuration(1800), '30 Min.');
  assert.equal(formatDistance(3000), '3 km');
  assert.equal(formatActivity(distanceActivity('Laufband', 3000, 1200)), '3 km · 20 Min.');
  assert.equal(formatActivity(distanceActivity('Laufband', 5000)), '5 km');
});

test('Ending a documented training commits first, then records use once', async () => {
  const calls = [];
  const active = { ...createTraining(start), id: 'active', activities: [setActivity('Kniebeugen', [{ reps: 10, recordedAt: 2000 }])] };
  const result = await finishTraining({
    saveEntry: async value => { calls.push(['save', value]); return { ...value, id: 'active' }; },
    recordUse: async () => { calls.push(['use']); }
  }, active, 3000);
  assert.deepEqual(calls.map(call => call[0]), ['save', 'use']);
  assert.equal(result.entry.status, 'ended');
  assert.equal(result.entry.endedAt, 3000);
  assert.equal(result.usageError, null);

  calls.length = 0;
  const failedSave = await assert.rejects(finishTraining({
    saveEntry: async () => { calls.push(['save']); throw new Error('storage failed'); },
    recordUse: async () => { calls.push(['use']); }
  }, active, 3000), /storage failed/);
  assert.equal(failedSave, undefined);
  assert.deepEqual(calls.map(call => call[0]), ['save']);
});

test('recordUse failure keeps the finished training committed without retry', async () => {
  const calls = [];
  const active = { ...createTraining(start), id: 'active', activities: [distanceActivity('Laufen', 5000)] };
  const result = await finishTraining({
    saveEntry: async value => { calls.push('save'); return { ...value, id: 'active' }; },
    recordUse: async () => { calls.push('use'); throw new Error('metadata failed'); }
  }, active, 3000);
  assert.equal(result.entry.status, 'ended');
  assert.match(result.usageError.message, /metadata failed/);
  assert.deepEqual(calls, ['save', 'use']);
});

test('Finishing an empty session deletes it without recording use', async () => {
  const calls = [];
  const result = await finishTraining({
    deleteEntry: async id => { calls.push(['delete', id]); },
    saveEntry: async () => { calls.push(['save']); },
    recordUse: async () => { calls.push(['use']); }
  }, { ...createTraining(start), id: 'empty-active', activities: [{ id: 'a1', name: 'Yoga', mode: 'duration' }] });
  assert.equal(result.entry, null);
  assert.deepEqual(calls, [['delete', 'empty-active']]);
});

test('Training import validation rejects unknown fields before database access', () => {
  let opens = 0;
  globalThis.indexedDB = { open() { opens++; throw new Error('Unexpected database access'); } };
  try {
    const invalid = { ...session('import'), injected: '<img>' };
    const data = { schemaVersion: 2, stores: Object.fromEntries(STORES.map(name => [name, []])) };
    data.stores.entries = [invalid];
    assert.throws(() => importAll(data), /Unbekanntes Trainingsfeld/);
    assert.equal(opens, 0);
  } finally {
    delete globalThis.indexedDB;
  }
});

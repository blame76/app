import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPlaces, PLACE_RADII, radiusLabel } from '../src/places.js';
import { PLACE_CATEGORIES, validateRecord, validateImport, STORES } from '../src/schema.js';
import { matchingPlaces, distanceMeters, watchPosition } from '../src/context.js';
import { relevantNotes } from '../src/notes.js';

const old = { id: 'old', name: 'Alter Ort', lat: 0, lon: 0, radius: 75, createdAt: 1 };
test('Legacy/custom radii remain unchanged; categories are optional validated organization only', () => {
  assert.equal(validateRecord('places', old), old);
  for (const category of PLACE_CATEGORIES) validateRecord('places', { ...old, category });
  for (const category of [null, '', [], 'Custom', '<img src=x>']) assert.throws(() => validateRecord('places', { ...old, category }));
  const stores = Object.fromEntries(STORES.map(store => [store, store === 'places' ? [old, { ...old, id: 'new', category: 'Arbeit' }] : []]));
  assert.deepEqual(validateImport({ schemaVersion: 2, stores }).places, stores.places);
  assert.equal(old.category, undefined);
});
test('Groups omit empty categories, sort names, and keep uncategorized places', () => {
  assert.deepEqual(groupPlaces([]), []);
  const groups = groupPlaces([old, { ...old, id: 'b', name: 'B', category: 'Einkaufen' }, { ...old, id: 'a', name: 'A', category: 'Einkaufen' }]);
  assert.deepEqual(groups.map(group => group.label), ['Einkaufen', 'Ohne Kategorie']);
  assert.deepEqual(groups[0].places.map(place => place.id), ['a', 'b']);
});
test('Radius labels describe scope without promising accuracy', () => {
  assert.deepEqual(PLACE_RADII.map(radiusLabel), ['20 Meter · sehr eng', '50 Meter · eng', '100 Meter · nah', '250 Meter · Umgebung']);
});
test('Every radius uses measured distance without silently adding accuracy; exit hides and reentry shows notes', () => {
  for (const radius of PLACE_RADII) {
    const place = { ...old, radius, category: 'Einkaufen' };
    const position = meters => ({ lat: meters / 6371000 * 180 / Math.PI, lon: 0, accuracy: 500 });
    assert.ok(Math.abs(distanceMeters(old, position(radius)) - radius) < 0.00001);
    const notes = [{ id: 'n', type: 'note', text: 'Test', createdAt: 1, context: { placeIds: ['old'] } }];
    assert.equal(relevantNotes(notes, matchingPlaces(position(radius - .01), [place]), 'morning').length, 1);
    assert.equal(relevantNotes(notes, matchingPlaces(position(radius + .01), [place]), 'morning').length, 0);
    assert.equal(relevantNotes(notes, matchingPlaces(position(0), [place]), 'morning').length, 1);
    assert.deepEqual(matchingPlaces(null, [place]), []);
    assert.equal(relevantNotes([{ ...notes[0], context: { placeIds: ['Einkaufen'] } }], [place], 'morning').length, 0);
  }
});
test('Observer forwards failures as no match and ignores late callbacks after stopping', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const secure = Object.getOwnPropertyDescriptor(globalThis, 'isSecureContext');
  let success, failure, cleared;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
    watchPosition(ok, fail, options) { success = ok; failure = fail; assert.equal(options.maximumAge, 0); return 42; },
    clearWatch(id) { cleared = id; }
  } } });
  Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: true });
  try {
    const values = [];
    const stop = watchPosition(value => values.push(value));
    const coords = { latitude: 50, longitude: 8, accuracy: 10 };
    success({ coords }); failure(); stop(); success({ coords }); failure();
    assert.deepEqual(values, [{ lat: 50, lon: 8, accuracy: 10 }, null]);
    assert.equal(cleared, 42);
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator;
    if (secure) Object.defineProperty(globalThis, 'isSecureContext', secure); else delete globalThis.isSecureContext;
  }
});

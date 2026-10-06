import { intervalAfterLabel, intervalDueAt } from './intervals.js';

export const TIME_BUCKETS = Object.freeze([
  Object.freeze({ id: 'morning', label: 'morgens', startHour: 5, endHour: 11 }),
  Object.freeze({ id: 'midday', label: 'mittags', startHour: 11, endHour: 15 }),
  Object.freeze({ id: 'evening', label: 'abends', startHour: 15, endHour: 22 }),
  Object.freeze({ id: 'night', label: 'nachts', startHour: 22, endHour: 5 })
]);

export const TIME_BUCKET_IDS = Object.freeze(TIME_BUCKETS.map(bucket => bucket.id));

function timeDefinition(id) {
  return TIME_BUCKETS.find(bucket => bucket.id === id);
}

export function timeBucket(date = new Date()) {
  const hour = date.getHours();
  return TIME_BUCKETS.find(bucket => bucket.startHour < bucket.endHour
    ? hour >= bucket.startHour && hour < bucket.endHour
    : hour >= bucket.startHour || hour < bucket.endHour)?.id;
}

export function timeBucketLabel(id, { capitalize = false } = {}) {
  const bucket = timeDefinition(id);
  if (!bucket) return id;
  const label = capitalize ? bucket.label[0].toLocaleUpperCase('de') + bucket.label.slice(1) : bucket.label;
  return `${label} · ${String(bucket.startHour).padStart(2, '0')}–${String(bucket.endHour).padStart(2, '0')} Uhr`;
}

export function nextTimeBoundary(date = new Date()) {
  const now = date.getTime();
  const candidates = [];
  for (const dayOffset of [0, 1]) {
    for (const bucket of TIME_BUCKETS) {
      const boundary = new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayOffset, bucket.startHour);
      if (boundary.getTime() > now) candidates.push(boundary.getTime());
    }
  }
  return Math.min(...candidates);
}

function ruleIntervalDueAt(rule, lastUsedAt) {
  if (!rule.interval || !lastUsedAt) return null;
  if (rule.legacyIntervalMinutes !== null && rule.legacyIntervalMinutes !== undefined) {
    return lastUsedAt + Math.max(0, rule.legacyIntervalMinutes - (rule.legacyToleranceMinutes || 0)) * 60000;
  }
  return intervalDueAt(lastUsedAt, rule.interval, rule.earlyBy);
}

export function evaluateHelperContext(rule, activePlaces, lastUsedAt, date = new Date()) {
  const now = date.getTime();
  const dueAt = ruleIntervalDueAt(rule, lastUsedAt);
  const matchedPlace = activePlaces.find(place => rule.placeIds.includes(place.id));
  let match = null;
  if (matchedPlace) {
    match = { reason: matchedPlace.name || 'Ort', rank: 400, launchPlace: { id: matchedPlace.id, name: matchedPlace.name } };
  } else if (dueAt !== null && now >= dueAt) {
    match = { reason: `wieder im Blick · nach ${intervalAfterLabel(rule.interval)}`, rank: 300 };
  } else {
    const bucket = timeBucket(date);
    if (rule.timeBuckets.includes(bucket)) match = { reason: timeBucketLabel(bucket), rank: 200 };
  }
  return { match, nextIntervalAt: dueAt !== null && dueAt > now ? dueAt : null };
}

export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function getPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!globalThis.isSecureContext) {
      reject(new Error('Standort benötigt HTTPS oder localhost.'));
      return;
    }
    if (!('geolocation' in navigator)) {
      reject(new Error('Ortung wird von diesem Browser nicht unterstützt.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy
      }),
      error => reject(new Error(error.message || 'Standort konnte nicht gelesen werden.')),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: options.maximumAge ?? 0 }
    );
  });
}

export function matchingPlaces(position, places) {
  if (!position) return [];
  return places
    .map(place => ({ ...place, distance: distanceMeters(position, place) }))
    .filter(place => place.distance <= place.radius)
    .sort((a, b) => a.distance - b.distance);
}

// Only the visible dashboard owns this observer. No position is persisted here.
export function watchPosition(onPosition) {
  if (!globalThis.isSecureContext || !navigator.geolocation?.watchPosition) return () => {};
  let active = true;
  const id = navigator.geolocation.watchPosition(
    ({ coords }) => { if (active) onPosition({ lat: coords.latitude, lon: coords.longitude, accuracy: coords.accuracy }); },
    () => { if (active) onPosition(null); },
    { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
  );
  return () => { active = false; navigator.geolocation.clearWatch(id); };
}

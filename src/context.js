import { intervalAfterLabel, intervalDueAt, intervalLabel } from './intervals.js';
import { DEFAULT_TIME_WINDOWS, DEFAULT_TIME_WINDOW_IDS, findTimeWindow, timeWindowLabel } from './time-windows.js';

export const TIME_BUCKETS = Object.freeze(DEFAULT_TIME_WINDOWS.map(window => Object.freeze({
  id: window.id,
  label: window.label,
  startHour: window.startMinute / 60,
  endHour: window.endMinute / 60
})));

export const TIME_BUCKET_IDS = DEFAULT_TIME_WINDOW_IDS;

function minuteOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function matchesTimeWindow(window, minute) {
  return window.startMinute < window.endMinute
    ? minute >= window.startMinute && minute < window.endMinute
    : minute >= window.startMinute || minute < window.endMinute;
}

export function matchingTimeWindows(date = new Date(), timeWindows = DEFAULT_TIME_WINDOWS) {
  const minute = minuteOfDay(date);
  return timeWindows.filter(window => matchesTimeWindow(window, minute));
}

export function timeBucket(date = new Date()) {
  return matchingTimeWindows(date, DEFAULT_TIME_WINDOWS)[0]?.id;
}

export function timeBucketLabel(id, { capitalize = false, timeWindows = DEFAULT_TIME_WINDOWS } = {}) {
  const window = findTimeWindow(id, timeWindows);
  return window ? timeWindowLabel(window, { capitalize }) : id;
}

function compactTimeBucketLabel(id, timeWindows) {
  const window = findTimeWindow(id, timeWindows);
  return window ? timeWindowLabel(window, { compact: true }) : id;
}

function boundaryOn(date, dayOffset, minute) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + dayOffset,
    Math.floor(minute / 60),
    minute % 60
  ).getTime();
}

export function nextTimeBoundary(date = new Date(), timeWindows = DEFAULT_TIME_WINDOWS) {
  const now = date.getTime();
  const candidates = [];
  for (const dayOffset of [0, 1]) {
    for (const window of timeWindows) {
      for (const minute of [window.startMinute, window.endMinute]) {
        const boundary = boundaryOn(date, dayOffset, minute);
        if (boundary > now) candidates.push(boundary);
      }
    }
  }
  return candidates.length ? Math.min(...candidates) : null;
}

function ruleIntervalDueAt(rule, lastUsedAt) {
  if (!rule.interval || !lastUsedAt) return null;
  if (rule.legacyIntervalMinutes !== null && rule.legacyIntervalMinutes !== undefined) {
    return lastUsedAt + Math.max(0, rule.legacyIntervalMinutes - (rule.legacyToleranceMinutes || 0)) * 60000;
  }
  return intervalDueAt(lastUsedAt, rule.interval, rule.earlyBy);
}

export function evaluateHelperContext(rule, activePlaces, lastUsedAt, date = new Date(), timeWindows = DEFAULT_TIME_WINDOWS) {
  const now = date.getTime();
  const dueAt = ruleIntervalDueAt(rule, lastUsedAt);
  const matches = [];
  const matchedPlace = activePlaces.find(place => rule.placeIds.includes(place.id));

  if (matchedPlace) {
    matches.push({
      reason: matchedPlace.name || 'Ort',
      why: matchedPlace.name || 'Ort',
      rank: 400,
      launchPlace: { id: matchedPlace.id, name: matchedPlace.name }
    });
  }
  if (dueAt !== null && now >= dueAt) {
    matches.push({
      reason: `wieder im Blick · nach ${intervalAfterLabel(rule.interval)}`,
      why: `Intervall ${intervalLabel(rule.interval)}`,
      rank: 300
    });
  }
  for (const window of matchingTimeWindows(date, timeWindows).filter(window => rule.timeBuckets.includes(window.id))) {
    matches.push({
      reason: timeBucketLabel(window.id, { timeWindows }),
      why: compactTimeBucketLabel(window.id, timeWindows),
      rank: 200
    });
  }

  const primary = matches[0] || null;
  const match = primary
    ? { ...primary, why: matches.length === 1 ? primary.reason : matches.map(item => item.why).join(' · ') }
    : null;
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

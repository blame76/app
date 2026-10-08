import { validatePersonDate } from './person-dates.js';
import { validateIntervalPair } from './intervals.js';
import { DEFAULT_TIME_WINDOW_IDS, isTimeWindowId, TIME_WINDOW_SETTING_ID, validateCustomTimeWindows } from './time-windows.js';

// Shared validation for settings, imports and helper declarations. No HTML belongs here.
export const STORES = ['entries', 'people', 'places', 'helperRules', 'settings'];
export const TIME_BUCKETS = DEFAULT_TIME_WINDOW_IDS;
export const CONTEXT_TYPES = ['place', 'time', 'interval'];

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function timestamp(value) { return Number.isFinite(value) && value >= 0 && value <= 8640000000000000; }
function strings(value) {
  return Array.isArray(value) && value.every(text) && new Set(value).size === value.length;
}

export function validateInterval(interval, tolerance) {
  requireValue(interval === null || (Number.isFinite(interval) && interval >= 1), 'Intervall muss mindestens eine Minute betragen.');
  requireValue(tolerance === null || (Number.isFinite(tolerance) && tolerance >= 0), 'Toleranz muss eine nichtnegative Zahl sein.');
  requireValue(tolerance === null || (interval !== null && tolerance < interval), 'Toleranz benötigt ein Intervall und muss kleiner als dieses sein.');
}

export function validateRule(rule) {
  requireValue(object(rule) && text(rule.id), 'Ungültige Helfer-Regel.');
  for (const key of ['visible', 'favorite', 'guidance']) {
    requireValue(rule[key] === undefined || typeof rule[key] === 'boolean', `Ungültiger Wert für ${key}.`);
  }
  requireValue(rule.placeIds === undefined || strings(rule.placeIds), 'Ungültige Ortsverknüpfungen.');
  requireValue(rule.timeBuckets === undefined || (strings(rule.timeBuckets) && rule.timeBuckets.every(isTimeWindowId)), 'Ungültige Zeitfenster.');
  const hasStructuredInterval = Object.hasOwn(rule, 'interval') || Object.hasOwn(rule, 'earlyBy');
  if (hasStructuredInterval) {
    validateIntervalPair(rule.interval ?? null, rule.earlyBy ?? null);
    requireValue(rule.intervalMinutes === undefined && rule.toleranceMinutes === undefined, 'Minutenwerte und strukturierte Intervalle dürfen nicht gemischt werden.');
  } else {
    validateInterval(rule.intervalMinutes ?? null, rule.toleranceMinutes ?? null);
  }
  // Preserve older exports; registered helpers validate the retention windows they support.
  requireValue(rule.trackingWindow === undefined || ['1d', '7d', '30d', '365d', 'always'].includes(rule.trackingWindow), 'Ungültige Trackingdauer.');
  return rule;
}

function validateJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  requireValue(Array.isArray(value) || (object(value) && Object.getPrototypeOf(value) === Object.prototype), 'Nur JSON-Daten sind erlaubt.');
  for (const key of Object.keys(value)) {
    requireValue(!['__proto__', 'prototype', 'constructor'].includes(key), 'Unzulässiger Objektschlüssel.');
    validateJson(value[key]);
  }
}

export const PLACE_CATEGORIES = ['Zuhause', 'Arbeit', 'Einkaufen', 'Mobilität', 'Freizeit', 'Sonstiges'];

export function validateRecord(store, item) {
  requireValue(STORES.includes(store) && object(item) && text(item.id), `Ungültiger Datensatz in ${store}.`);
  validateJson(item);
  if (store === 'helperRules') validateRule(item);
  if (store === 'entries') {
    requireValue(timestamp(item.createdAt), 'Eintrag benötigt einen gültigen Zeitstempel.');
    requireValue(text(item.helperId) || text(item.type), 'Eintrag benötigt helperId oder type.');
    for (const key of ['helperId', 'type', 'personId', 'text', 'kind']) {
      requireValue(item[key] === undefined || typeof item[key] === 'string', `Ungültiges Eintragsfeld ${key}.`);
    }
    if (item.type === 'person-date') validatePersonDate(item);
    if (item.type === 'note' || item.type === 'person-note') {
      requireValue(item.updatedAt === undefined || timestamp(item.updatedAt), 'Ungültiger Bearbeitungszeitpunkt.');
      if (item.context !== undefined) {
        requireValue(object(item.context), 'Ungültige Notizverknüpfung.');
        requireValue(item.context.placeIds === undefined || strings(item.context.placeIds), 'Ungültige Ortsverknüpfungen.');
        requireValue(item.context.timeBuckets === undefined || (strings(item.context.timeBuckets) && item.context.timeBuckets.every(isTimeWindowId)), 'Ungültige Zeitfenster.');
      }
    }
  }
  if (store === 'people' || store === 'places') {
    requireValue(text(item.name) && timestamp(item.createdAt), `Ungültiger Name/Zeitstempel in ${store}.`);
  }
  if (store === 'places') {
    requireValue(item.category === undefined || PLACE_CATEGORIES.includes(item.category), 'Ungültige Ortskategorie.');
    requireValue(Number.isFinite(item.lat) && Math.abs(item.lat) <= 90 && Number.isFinite(item.lon) && Math.abs(item.lon) <= 180, 'Ungültige Koordinaten.');
    requireValue(Number.isFinite(item.radius) && item.radius > 0, 'Ungültiger Ortsradius.');
  }
  if (store === 'settings' && item.id.startsWith('usage:')) {
    requireValue(timestamp(item.lastUsedAt), 'Ungültiger Nutzungszeitpunkt.');
  }
  if (store === 'settings' && item.id === TIME_WINDOW_SETTING_ID) {
    validateCustomTimeWindows(item.value);
  }
  return item;
}

export function validateImport(payload) {
  requireValue(object(payload) && [1, 2].includes(payload.schemaVersion) && object(payload.stores), 'Unbekanntes Exportformat.');
  validateJson(payload);
  requireValue(Object.keys(payload.stores).every(name => STORES.includes(name)), 'Export enthält unbekannte Datenspeicher.');
  const stores = {};
  for (const name of STORES) {
    // Compatibility: v1 may omit helperRules. All other stores are required.
    const records = payload.stores[name] ?? (payload.schemaVersion === 1 && name === 'helperRules' ? [] : undefined);
    requireValue(Array.isArray(records), `Datenspeicher ${name} fehlt oder ist ungültig.`);
    const ids = new Set();
    for (const item of records) {
      validateRecord(name, item);
      requireValue(!ids.has(item.id), `Doppelte ID in ${name}.`);
      ids.add(item.id);
    }
    stores[name] = records;
  }
  for (const entry of stores.entries) {
    if (entry.type === 'person-date') requireValue(stores.people.some(person => person.id === entry.personId), 'Person für wichtiges Datum fehlt.');
  }
  // Validation and writes must see the same immutable snapshot.
  return structuredClone(stores);
}

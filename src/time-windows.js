export const TIME_WINDOW_SETTING_ID = 'time-windows';

export const DEFAULT_TIME_WINDOWS = Object.freeze([
  Object.freeze({ id: 'morning', label: 'morgens', startMinute: 5 * 60, endMinute: 11 * 60 }),
  Object.freeze({ id: 'midday', label: 'mittags', startMinute: 11 * 60, endMinute: 15 * 60 }),
  Object.freeze({ id: 'evening', label: 'abends', startMinute: 15 * 60, endMinute: 22 * 60 }),
  Object.freeze({ id: 'night', label: 'nachts', startMinute: 22 * 60, endMinute: 5 * 60 })
]);

export const DEFAULT_TIME_WINDOW_IDS = Object.freeze(DEFAULT_TIME_WINDOWS.map(window => window.id));

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isTimeWindowId(value) {
  return DEFAULT_TIME_WINDOW_IDS.includes(value)
    || (typeof value === 'string' && /^time-[a-z0-9-]{1,80}$/i.test(value));
}

export function validateCustomTimeWindow(window) {
  if (!isObject(window)
    || typeof window.id !== 'string'
    || !/^time-[a-z0-9-]{1,80}$/i.test(window.id)
    || typeof window.label !== 'string'
    || !window.label.trim()
    || window.label.trim().length > 60
    || !Number.isInteger(window.startMinute)
    || !Number.isInteger(window.endMinute)
    || window.startMinute < 0 || window.startMinute >= 24 * 60
    || window.endMinute < 0 || window.endMinute >= 24 * 60
    || window.startMinute === window.endMinute) {
    throw new Error('Ungültiges Zeitfenster.');
  }
  return window;
}

export function validateCustomTimeWindows(windows) {
  if (!Array.isArray(windows)) throw new Error('Ungültige Zeitfenster.');
  const ids = new Set();
  for (const window of windows) {
    validateCustomTimeWindow(window);
    if (ids.has(window.id)) throw new Error('Doppelte Zeitfenster-ID.');
    ids.add(window.id);
  }
  return windows;
}

export function allTimeWindows(custom = []) {
  validateCustomTimeWindows(custom);
  return [...DEFAULT_TIME_WINDOWS, ...custom];
}

export function findTimeWindow(id, windows = DEFAULT_TIME_WINDOWS) {
  return windows.find(window => window.id === id);
}

export function minutesToTime(value) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function timeToMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function compactClock(value) {
  const full = minutesToTime(value);
  return full.endsWith(':00') ? full.slice(0, 2) : full;
}

export function timeWindowLabel(window, { capitalize = false, compact = false } = {}) {
  if (!window) return '';
  const raw = window.label.trim();
  const label = capitalize && raw ? raw[0].toLocaleUpperCase('de') + raw.slice(1) : raw;
  const range = `${compactClock(window.startMinute)}–${compactClock(window.endMinute)} Uhr`;
  return compact ? `${label} (${range})` : `${label} · ${range}`;
}

import { intervalDueAt } from '../../intervals.js';

function requireValue(condition, message) { if (!condition) throw new Error(message); }

export function drinkNowCard({ entries, now, interval }) {
  const latest = orderedEntries(entries)[0];
  if (!latest) return { active: false, primary: 'Noch kein Getränk dokumentiert', density: 'compact' };
  const elapsed = Math.max(0, now - latest.recordedAt);
  const duration = interval && ({ minute: 60000, hour: 3600000 })[interval.unit] * interval.value;
  const missed = duration ? Math.floor(elapsed / duration) : 0;
  let nominal = null;
  // Valid imported dates can already be at the end of the supported date range.
  try { nominal = interval ? intervalDueAt(latest.recordedAt, interval) : null; } catch { /* No representable next interval. */ }
  const primary = missed ? `${missed} ${missed === 1 ? 'Trinkgelegenheit' : 'Trinkgelegenheiten'} verpasst`
    : nominal !== null ? (now < nominal ? 'Bald wieder dran' : 'Trinken wieder dokumentieren') : 'Zuletzt dokumentiert';
  // Schedule actual copy/count boundaries, using the shell's single foreground timer.
  const step = elapsed < 3600000 ? 60000 : elapsed < 86400000 ? 3600000 : 86400000;
  const nextText = latest.recordedAt + (Math.floor(elapsed / step) + 1) * step;
  const nextCount = duration ? latest.recordedAt + (missed + 1) * duration : nominal > now ? nominal : Infinity;
  const nextChangeAt = latest.recordedAt > now ? latest.recordedAt : Math.min(nextText, nextCount);
  return {
    active: false, primary, secondary: `zuletzt ${relativeTime(latest.recordedAt, now)} dokumentiert`,
    ...(missed ? { badge: { value: String(missed), label: primary } } : {}),
    tone: missed >= 2 ? 'attention' : 'normal', density: 'standard',
    ...(nextChangeAt <= 8640000000000000 ? { nextChangeAt } : {})
  };
}

export function validateDrinkEntry(entry) {
  requireValue(entry.helperId === 'drink' && entry.entryVersion === 1, 'Unbekanntes Trinkformat.');
  requireValue(Number.isFinite(entry.recordedAt) && entry.recordedAt >= 0 && entry.recordedAt <= 8640000000000000 && entry.createdAt === entry.recordedAt, 'Ungültiger Dokumentationszeitpunkt.');
  requireValue(Object.keys(entry).every(key => ['id', 'helperId', 'entryVersion', 'recordedAt', 'createdAt'].includes(key)), 'Unbekanntes Trinkfeld.');
  return entry;
}

export function createDrink(recordedAt = Date.now()) {
  return validateDrinkEntry({ helperId: 'drink', entryVersion: 1, recordedAt, createdAt: recordedAt });
}

export function orderedEntries(entries) {
  return [...entries].sort((a, b) => b.recordedAt - a.recordedAt || b.id.localeCompare(a.id));
}

export function todayEntries(entries, now = Date.now()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return orderedEntries(entries.filter(entry => entry.recordedAt >= start.getTime() && entry.recordedAt < end.getTime()));
}

export function relativeTime(recordedAt, now = Date.now()) {
  const minutes = Math.floor((now - recordedAt) / 60000);
  if (minutes < 0) return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(recordedAt);
  if (minutes === 0) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`;
  const days = Math.floor(hours / 24);
  return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
}

export async function saveDrink(api, recordedAt = Date.now()) {
  const entry = await api.saveEntry(createDrink(recordedAt));
  let usageError = null;
  try { await api.recordUse(); } catch (error) { usageError = error; }
  return { entry, usageError };
}

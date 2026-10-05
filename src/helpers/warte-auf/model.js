function requireValue(condition, message) { if (!condition) throw new Error(message); }
function timestamp(value) { return Number.isFinite(value) && value >= 0 && value <= 8640000000000000; }

export function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1) return false;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateWaitingEntry(entry) {
  requireValue(entry.helperId === 'warte-auf' && entry.entryVersion === 1, 'Unbekanntes „Warte auf“-Format.');
  requireValue(typeof entry.text === 'string' && entry.text.trim().length > 0 && entry.text.length <= 300, 'Bitte beschreiben, worauf du wartest.');
  requireValue(entry.waitingForText === undefined || (typeof entry.waitingForText === 'string' && entry.waitingForText.trim().length > 0 && entry.waitingForText.length <= 120), 'Ungültige Angabe zu „Von wem?“.');
  requireValue(entry.expectedDate === undefined || isDateOnly(entry.expectedDate), 'Ungültiges Wiedervorlagedatum.');
  requireValue(['waiting', 'done'].includes(entry.status), 'Ungültiger Wartezustand.');
  requireValue(timestamp(entry.createdAt), 'Ungültiger Erfassungszeitpunkt.');
  requireValue(entry.status === 'waiting'
    ? entry.completedAt === undefined
    : (timestamp(entry.completedAt) && entry.completedAt >= entry.createdAt), 'Ungültiger Abschlusszeitpunkt.');
  requireValue(Object.keys(entry).every(key => ['id', 'helperId', 'entryVersion', 'text', 'waitingForText', 'expectedDate', 'status', 'createdAt', 'completedAt'].includes(key)), 'Unbekanntes „Warte auf“-Feld.');
  return entry;
}

export function createWaitingEntry({ text, waitingForText, expectedDate }, createdAt = Date.now()) {
  return validateWaitingEntry({
    helperId: 'warte-auf',
    entryVersion: 1,
    text: typeof text === 'string' ? text.trim() : '',
    ...(typeof waitingForText === 'string' && waitingForText.trim() ? { waitingForText: waitingForText.trim() } : {}),
    ...(expectedDate ? { expectedDate } : {}),
    status: 'waiting',
    createdAt
  });
}

export function localDateKey(now = Date.now()) {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dateLabel(value) {
  if (!isDateOnly(value)) throw new Error('Ungültiges Wiedervorlagedatum.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(date);
}

export function waitingGroups(entries, today = localDateKey()) {
  const waiting = entries.filter(entry => entry.status === 'waiting');
  return {
    due: waiting.filter(entry => entry.expectedDate && entry.expectedDate <= today)
      .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate) || a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
    later: waiting.filter(entry => entry.expectedDate && entry.expectedDate > today)
      .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate) || a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
    undated: waiting.filter(entry => !entry.expectedDate)
      .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)),
    done: entries.filter(entry => entry.status === 'done')
      .sort((a, b) => b.completedAt - a.completedAt || a.id.localeCompare(b.id))
  };
}

export function waitingDateLabel(value, today = localDateKey()) {
  if (!value) return '';
  const label = dateLabel(value);
  if (value === today) return 'heute wieder im Blick';
  if (value < today) return `seit ${label} wieder im Blick`;
  return `wieder ab ${label} im Blick`;
}

export function updateWaitingEntry(entry, values) {
  const updated = {
    ...entry,
    text: typeof values.text === 'string' ? values.text.trim() : '',
    status: 'waiting'
  };
  delete updated.waitingForText;
  delete updated.expectedDate;
  if (typeof values.waitingForText === 'string' && values.waitingForText.trim()) updated.waitingForText = values.waitingForText.trim();
  if (values.expectedDate) updated.expectedDate = values.expectedDate;
  return validateWaitingEntry(updated);
}

export function completeWaitingEntry(entry, completedAt = Date.now()) {
  return validateWaitingEntry({ ...entry, status: 'done', completedAt });
}

export async function saveWaitingEntry(api, entry) {
  const saved = await api.saveEntry(entry);
  let usageError = null;
  try { await api.recordUse(); } catch (error) { usageError = error; }
  return { entry: saved, usageError };
}

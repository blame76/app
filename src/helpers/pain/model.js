export const BODY_AREAS = ['Kopf', 'Nacken', 'Rücken', 'Bauch', 'Arm/Hand', 'Bein/Fuß'];
export const QUALITIES = ['stechend', 'dumpf', 'brennend', 'ziehend', 'pochend', 'anderes'];
export const RELIEF = ['Wärme', 'Ruhe', 'Bewegung', 'Medikament', 'anderes'];
const normalizeArea = value => value.trim().replace(/\s+/g, ' ');
export const areaKey = value => normalizeArea(value).normalize('NFKC').toLocaleLowerCase('de');
function requireValue(condition, message) { if (!condition) throw new Error(message); }
function dateValue(value) { return Number.isFinite(value) && value >= 0 && value <= 8640000000000000; }
function optionalText(entry, key, length) {
  requireValue(entry[key] === undefined || (typeof entry[key] === 'string' && entry[key].length <= length), `Ungültige Angabe: ${key}.`);
}
function selections(value, allowed) { return Array.isArray(value) && new Set(value).size === value.length && value.every(item => allowed.includes(item)); }

export function validatePainEntry(entry) {
  requireValue(entry.helperId === 'pain' && entry.entryVersion === 1, 'Unbekanntes Schmerzformat.');
  requireValue(typeof entry.bodyArea === 'string' && normalizeArea(entry.bodyArea).length > 0 && entry.bodyArea.length <= 60, 'Bitte einen Schmerzort wählen oder benennen.');
  requireValue(Number.isInteger(entry.intensity) && entry.intensity >= 0 && entry.intensity <= 10, 'Bitte eine Intensität von 1 bis 10 wählen.');
  requireValue(['observation', 'resolved'].includes(entry.eventType) && (entry.intensity === 0) === (entry.eventType === 'resolved'), 'Schmerzfreiheit muss bewusst als „Schmerz weg“ dokumentiert werden.');
  requireValue(dateValue(entry.recordedAt) && entry.createdAt === entry.recordedAt, 'Ungültiger Erfassungszeitpunkt.');
  if (entry.startedAt !== undefined) {
    requireValue(entry.startedAt && ['now', 'today', 'yesterday', 'exact'].includes(entry.startedAt.kind), 'Ungültige Angabe zum Beginn.');
    requireValue(dateValue(entry.startedAt.at) && entry.startedAt.at <= entry.recordedAt, 'Beginn darf nicht nach der Dokumentation liegen.');
    requireValue(Object.keys(entry.startedAt).every(key => ['kind', 'at'].includes(key)), 'Ungültige Angabe zum Beginn.');
  }
  requireValue(entry.quality === undefined || selections(entry.quality, QUALITIES), 'Ungültige Schmerzart.');
  requireValue(entry.relief === undefined || selections(entry.relief, RELIEF), 'Ungültige Maßnahme.');
  requireValue(entry.interference === undefined || (Number.isInteger(entry.interference) && entry.interference >= 0 && entry.interference <= 10), 'Beeinträchtigung muss zwischen 0 und 10 liegen.');
  optionalText(entry, 'possibleContext', 300);
  optionalText(entry, 'note', 2000);
  return entry;
}

export function createObservation(bodyArea, intensity, recordedAt = Date.now(), resolved = false) {
  return validatePainEntry({
    helperId: 'pain', entryVersion: 1, bodyArea: typeof bodyArea === 'string' ? normalizeArea(bodyArea) : '',
    intensity, recordedAt, createdAt: recordedAt, eventType: resolved ? 'resolved' : 'observation'
  });
}

export function historyForArea(entries, bodyArea) {
  return entries.filter(entry => areaKey(entry.bodyArea) === areaKey(bodyArea))
    .sort((a, b) => b.recordedAt - a.recordedAt || b.id.localeCompare(a.id));
}

export function documentedAreas(entries) {
  const areas = new Map();
  for (const entry of [...entries].sort((a, b) => b.recordedAt - a.recordedAt)) {
    if (!areas.has(areaKey(entry.bodyArea))) areas.set(areaKey(entry.bodyArea), entry.bodyArea);
  }
  return [...areas.values()];
}

export function addDetails(entry, values) {
  const updated = { ...entry };
  for (const key of ['startedAt', 'quality', 'interference', 'possibleContext', 'relief', 'note']) {
    delete updated[key];
    if (values[key] !== undefined) updated[key] = values[key];
  }
  return validatePainEntry(updated);
}

export function approximateStart(kind, recordedAt, exact) {
  if (!kind) return undefined;
  let at;
  if (kind === 'now') at = recordedAt;
  else if (kind === 'exact') at = new Date(exact).getTime();
  else {
    const date = new Date(recordedAt);
    date.setHours(0, 0, 0, 0);
    if (kind === 'yesterday') date.setDate(date.getDate() - 1);
    at = date.getTime();
  }
  requireValue(['now', 'today', 'yesterday', 'exact'].includes(kind) && dateValue(at) && at <= recordedAt, 'Bitte einen Beginn vor dem Erfassungszeitpunkt angeben.');
  return { kind, at }; // today/yesterday describe a day, not a precise onset time.
}

// A successful event is never offered for retry merely because the usage metadata failed.
export async function saveObservation(api, bodyArea, intensity, recordedAt = Date.now(), resolved = false) {
  const entry = await api.saveEntry(createObservation(bodyArea, intensity, recordedAt, resolved));
  let usageError = null;
  try { await api.recordUse(); } catch (error) { usageError = error; }
  return { entry, usageError };
}

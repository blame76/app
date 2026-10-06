const MAX_DATE = 8640000000000000;
const MAX_ACTIVITIES = 200;
const MAX_SETS = 1000;
const MAX_TITLE = 100;
const MAX_NAME = 120;
const MAX_PLACE_NAME = 120;
const MAX_NUMBER = 1000000000;

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function dateValue(value) {
  return Number.isFinite(value) && value >= 0 && value <= MAX_DATE;
}

function exactKeys(value, allowed, message) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(key => allowed.includes(key)), message);
}

function optionalText(entry, key, maxLength) {
  requireValue(entry[key] === undefined
    || (typeof entry[key] === 'string' && entry[key].length <= maxLength && entry[key].trim().length > 0),
  `Ungültige Angabe: ${key}.`);
}

function measured(activity) {
  if (activity.mode === 'sets') return activity.sets.length > 0;
  if (activity.mode === 'duration') return Number.isInteger(activity.durationSeconds);
  return Number.isInteger(activity.distanceMeters);
}

function validateActivity(activity, status) {
  requireValue(activity && typeof activity === 'object' && !Array.isArray(activity), 'Ungültige Aktivität.');
  requireValue(typeof activity.id === 'string' && /^a[1-9]\d{0,5}$/.test(activity.id), 'Ungültige Aktivitäts-ID.');
  requireValue(typeof activity.name === 'string' && normalizeActivityName(activity.name).length > 0
    && activity.name.length <= MAX_NAME && activity.name === activity.name.trim().replace(/\s+/gu, ' ').normalize('NFC'),
  'Ungültiger Aktivitätsname.');
  requireValue(['sets', 'duration', 'distance'].includes(activity.mode), 'Ungültige Messart.');
  if (activity.mode === 'sets') {
    exactKeys(activity, ['id', 'name', 'mode', 'sets'], 'Unbekanntes Satzfeld.');
    requireValue(Array.isArray(activity.sets) && activity.sets.length <= MAX_SETS, 'Ungültige Sätze.');
    for (const set of activity.sets) {
      exactKeys(set, ['weightKg', 'reps', 'recordedAt'], 'Unbekanntes Feld in einem Satz.');
      requireValue(Number.isInteger(set.reps) && set.reps > 0 && set.reps <= MAX_NUMBER, 'Ungültige Wiederholungszahl.');
      requireValue(set.weightKg === undefined || (Number.isFinite(set.weightKg) && set.weightKg >= 0 && set.weightKg <= MAX_NUMBER), 'Ungültiges Gewicht.');
      requireValue(dateValue(set.recordedAt), 'Ungültiger Erfassungszeitpunkt des Satzes.');
    }
    requireValue(status !== 'ended' || activity.sets.length > 0, 'Abgeschlossene Trainings enthalten keine leeren Satzaktivitäten.');
  } else if (activity.mode === 'duration') {
    exactKeys(activity, ['id', 'name', 'mode', 'durationSeconds', 'recordedAt'], 'Unbekanntes Dauerfeld.');
    requireValue(activity.durationSeconds === undefined || (Number.isInteger(activity.durationSeconds) && activity.durationSeconds > 0 && activity.durationSeconds <= MAX_NUMBER), 'Ungültige Dauer.');
    requireValue(activity.recordedAt === undefined || dateValue(activity.recordedAt), 'Ungültiger Erfassungszeitpunkt.');
    requireValue(status !== 'ended' || measured(activity), 'Abgeschlossene Trainings enthalten keine leeren Daueraktivitäten.');
    requireValue((activity.durationSeconds === undefined) === (activity.recordedAt === undefined), 'Dauer und Erfassungszeitpunkt müssen zusammen angegeben werden.');
  } else {
    exactKeys(activity, ['id', 'name', 'mode', 'distanceMeters', 'durationSeconds', 'recordedAt'], 'Unbekanntes Streckenfeld.');
    requireValue(activity.distanceMeters === undefined || (Number.isInteger(activity.distanceMeters) && activity.distanceMeters > 0 && activity.distanceMeters <= MAX_NUMBER), 'Ungültige Strecke.');
    requireValue(activity.durationSeconds === undefined || (Number.isInteger(activity.durationSeconds) && activity.durationSeconds > 0 && activity.durationSeconds <= MAX_NUMBER), 'Ungültige Dauer.');
    requireValue(activity.recordedAt === undefined || dateValue(activity.recordedAt), 'Ungültiger Erfassungszeitpunkt.');
    requireValue(status !== 'ended' || measured(activity), 'Abgeschlossene Trainings enthalten keine leeren Streckenaktivitäten.');
    requireValue((activity.distanceMeters === undefined) === (activity.recordedAt === undefined), 'Strecke und Erfassungszeitpunkt müssen zusammen angegeben werden.');
    requireValue(activity.distanceMeters !== undefined || activity.durationSeconds === undefined, 'Eine Dauer benötigt eine dokumentierte Strecke.');
  }
  return activity;
}

export function normalizeActivityName(value) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/gu, ' ').normalize('NFC').toLocaleLowerCase('de')
    : '';
}

export function normalizeDisplayName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ').normalize('NFC') : '';
}

export function validateTrainingEntry(entry) {
  requireValue(entry?.helperId === 'training' && entry.entryVersion === 1, 'Unbekanntes Trainingsformat.');
  requireValue(['active', 'ended'].includes(entry.status), 'Ungültiger Trainingsstatus.');
  requireValue(dateValue(entry.startedAt) && dateValue(entry.createdAt) && entry.createdAt === entry.startedAt, 'Ungültiger Trainingsbeginn.');
  requireValue(entry.status === 'active'
    ? entry.endedAt === undefined
    : dateValue(entry.endedAt) && entry.endedAt >= entry.startedAt,
  'Ungültiger Trainingsabschluss.');
  optionalText(entry, 'title', MAX_TITLE);
  requireValue(entry.basedOnSessionId === undefined
    || (typeof entry.basedOnSessionId === 'string' && entry.basedOnSessionId.length > 0 && entry.basedOnSessionId.length <= 100),
  'Ungültige Referenz auf ein Training.');
  if (entry.place !== undefined) {
    exactKeys(entry.place, ['id', 'name'], 'Unbekanntes Ortsfeld.');
    requireValue(typeof entry.place.id === 'string' && entry.place.id.length > 0 && entry.place.id.length <= 100
      && typeof entry.place.name === 'string' && entry.place.name.trim().length > 0 && entry.place.name.length <= MAX_PLACE_NAME,
    'Ungültiger Trainingsort.');
  }
  exactKeys(entry, ['id', 'helperId', 'entryVersion', 'status', 'startedAt', 'endedAt', 'title', 'place', 'basedOnSessionId', 'awaitingChoice', 'activities', 'createdAt'], 'Unbekanntes Trainingsfeld.');
  requireValue(entry.awaitingChoice === undefined || (entry.status === 'active' && entry.awaitingChoice === true), 'Ungültiger Trainingsschritt.');
  requireValue(Array.isArray(entry.activities) && entry.activities.length <= MAX_ACTIVITIES, 'Ungültige Aktivitätenliste.');
  requireValue(new Set(entry.activities.map(activity => activity?.id)).size === entry.activities.length, 'Aktivitäts-IDs müssen eindeutig sein.');
  entry.activities.forEach(activity => validateActivity(activity, entry.status));
  requireValue(entry.status !== 'ended' || entry.activities.length > 0, 'Ein abgeschlossenes Training benötigt eine dokumentierte Aktivität.');
  return entry;
}

export function createTraining(startedAt = Date.now(), place) {
  const entry = { helperId: 'training', entryVersion: 1, status: 'active', startedAt, activities: [], createdAt: startedAt };
  if (place) entry.place = { id: place.id, name: place.name };
  return validateTrainingEntry(entry);
}

export function orderedSessions(entries) {
  return entries.filter(entry => entry.status === 'ended')
    .sort((a, b) => b.endedAt - a.endedAt || String(b.id).localeCompare(String(a.id)));
}

export function latestSession(entries) {
  return orderedSessions(entries)[0] || null;
}

export function latestSessionAtPlace(entries, placeId) {
  if (!placeId) return null;
  return orderedSessions(entries).find(entry => entry.place?.id === placeId) || null;
}

export function sessionReference(entries, place) {
  return place ? latestSessionAtPlace(entries, place.id) : latestSession(entries);
}

export function documentedActivity(activity) {
  return !!activity && measured(activity);
}

export function nextActivityId(session) {
  const used = new Set(session.activities.map(activity => activity.id));
  let index = 1;
  while (used.has(`a${index}`)) index++;
  return `a${index}`;
}

export function repeatStructure(reference) {
  return {
    ...(reference.title ? { title: reference.title } : {}),
    basedOnSessionId: reference.id,
    activities: reference.activities.map((activity, index) => ({
      id: `a${index + 1}`,
      name: activity.name,
      mode: activity.mode,
      ...(activity.mode === 'sets' ? { sets: [] } : {})
    }))
  };
}

export function latestActivityReference(entries, name, placeId, excludeSessionId) {
  const key = normalizeActivityName(name);
  const candidates = orderedSessions(entries).filter(session => session.id !== excludeSessionId)
    .flatMap(session => session.activities.filter(activity => documentedActivity(activity)
      && normalizeActivityName(activity.name) === key).map(activity => ({ session, activity })));
  if (placeId) {
    const samePlace = candidates.find(item => item.session.place?.id === placeId);
    if (samePlace) return samePlace;
  }
  return candidates[0] || null;
}

export function formatDuration(seconds) {
  const minutes = seconds / 60;
  if (seconds < 60) return `${seconds} Sek.`;
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(minutes)} Min.`;
}

export function formatDistance(meters) {
  const kilometers = meters / 1000;
  if (meters < 1000) return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(meters)} m`;
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(kilometers)} km`;
}

export function formatSets(activity) {
  if (!activity?.sets?.length) return '';
  const weights = activity.sets.map(set => set.weightKg);
  const sameWeight = weights.every(weight => weight === weights[0]);
  const reps = activity.sets.map(set => set.reps).join(' / ');
  if (sameWeight && weights[0] !== undefined) return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(weights[0])} kg · ${reps}`;
  return activity.sets.map(set => `${set.weightKg === undefined ? '' : `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(set.weightKg)} kg · `}${set.reps}`).join(' / ');
}

export function formatActivity(activity) {
  if (activity.mode === 'sets') return formatSets(activity);
  if (activity.mode === 'duration') return formatDuration(activity.durationSeconds);
  return `${formatDistance(activity.distanceMeters)}${activity.durationSeconds === undefined ? '' : ` · ${formatDuration(activity.durationSeconds)}`}`;
}

export async function finishTraining(api, session, endedAt = Date.now()) {
  const activities = session.activities.filter(documentedActivity);
  if (!activities.length) {
    await api.deleteEntry(session.id);
    return { entry: null, usageError: null };
  }
  const entry = validateTrainingEntry({ ...session, status: 'ended', endedAt, activities });
  const committed = await api.saveEntry(entry);
  let usageError = null;
  try {
    await api.recordUse();
  } catch (error) {
    usageError = error;
  }
  return { entry: committed, usageError };
}

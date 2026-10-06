import { timeBucketLabel } from './context.js';
import { validateRecord } from './schema.js';
import { DEFAULT_TIME_WINDOWS, findTimeWindow } from './time-windows.js';

export function isNote(entry) {
  return entry?.type === 'note' || entry?.type === 'person-note';
}

export function noteLabel(entry) {
  return entry.type === 'person-note' && entry.kind === 'gift' ? 'Geschenkidee' : 'Notiz';
}

export function noteContext(note) {
  return { placeIds: note.context?.placeIds || [], timeBuckets: note.context?.timeBuckets || [] };
}

export function editNote(note, text, now = Date.now()) {
  const unchanged = text === note.text;
  text = text.trim();
  if (!text) throw new Error('Bitte einen Notiztext eingeben.');
  const next = unchanged || text === note.text ? { ...note } : { ...note, text, updatedAt: now };
  return validateRecord('entries', next);
}

export function changeNoteContext(note, changes) {
  return validateRecord('entries', { ...note, context: { ...note.context, ...noteContext(note), ...changes } });
}

export function noteLinks(note, places, timeWindows = DEFAULT_TIME_WINDOWS) {
  const context = noteContext(note);
  return [
    ...context.placeIds.map(id => ({ kind: 'placeIds', id, label: places.find(place => place.id === id)?.name || 'Ort nicht mehr gespeichert' })),
    ...context.timeBuckets.map(id => ({
      kind: 'timeBuckets',
      id,
      label: findTimeWindow(id, timeWindows) ? timeBucketLabel(id, { timeWindows }) : 'Zeitfenster nicht mehr vorhanden'
    }))
  ];
}

// Explicit context only. Place OR time; a place match takes priority, then newest first.
// Matching uses the shell's existing active places, never a second location request.
export function relevantNotes(entries, activePlaces, activeTimeIds, timeWindows = DEFAULT_TIME_WINDOWS) {
  const active = Array.isArray(activeTimeIds) ? activeTimeIds : [activeTimeIds].filter(Boolean);
  return entries.filter(isNote).flatMap(note => {
    const context = noteContext(note);
    const place = activePlaces.find(place => context.placeIds.includes(place.id));
    if (place) return [{ note, reason: place.name, rank: 400 }];
    const matchedTime = context.timeBuckets.find(id => active.includes(id));
    if (matchedTime) return [{ note, reason: timeBucketLabel(matchedTime, { timeWindows }), rank: 200 }];
    return [];
  }).sort((a, b) => b.rank - a.rank || b.note.createdAt - a.note.createdAt || a.note.id.localeCompare(b.note.id));
}

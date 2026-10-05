export const POSITION_ID = 'parking-position';

export function validateParkingEntry(entry) {
  if (entry.helperId !== 'parking' || entry.id !== POSITION_ID || entry.entryVersion !== 1
    || !Number.isFinite(entry.createdAt) || entry.createdAt < 0 || entry.createdAt > 8640000000000000
    || !Number.isFinite(entry.lat) || Math.abs(entry.lat) > 90
    || !Number.isFinite(entry.lon) || Math.abs(entry.lon) > 180
    || !Number.isFinite(entry.accuracy) || entry.accuracy < 0
    || (entry.note !== undefined && (typeof entry.note !== 'string' || entry.note.length > 500))) {
    throw new Error('Ungültige Parkposition.');
  }
  return entry;
}

export async function saveParking(api, position, note, createdAt = Date.now()) {
  const entry = await api.saveEntry(validateParkingEntry({
    id: POSITION_ID, helperId: 'parking', entryVersion: 1,
    lat: position.lat, lon: position.lon, accuracy: position.accuracy,
    createdAt, ...(note.trim() ? { note: note.trim() } : {})
  }));
  let usageError;
  try { await api.recordUse(); } catch (error) { usageError = error; }
  return { entry, usageError };
}

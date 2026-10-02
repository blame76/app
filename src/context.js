export function timeBucket(date = new Date()) {
  const hour = date.getHours();
  if (hour < 11) return 'morning';
  if (hour < 15) return 'midday';
  if (hour < 19) return 'evening';
  return 'night';
}

export function timeBucketLabel(bucket) {
  return ({ morning: 'morgens', midday: 'mittags', evening: 'abends', night: 'nachts' })[bucket] || bucket;
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
      { enableHighAccuracy: false, timeout: 7000, maximumAge: options.maximumAge ?? 300000 }
    );
  });
}

export function matchingPlaces(position, places) {
  if (!position) return [];
  return places
    .map(place => ({ ...place, distance: distanceMeters(position, place) }))
    .filter(place => place.distance <= place.radius + Math.min(position.accuracy || 0, 250))
    .sort((a, b) => a.distance - b.distance);
}

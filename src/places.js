import { PLACE_CATEGORIES } from './schema.js';

export const PLACE_RADII = [20, 50, 100, 250];
export const LOCATION_EXPLANATION = '0815 fragt deinen Browser nach deinem Standort. Je nach Browser und Betriebssystem kann dafür ein Standortdienst des Herstellers verwendet werden. 0815 sendet deinen Standort nicht an einen eigenen Server. Die Position wird lokal verwendet, um gespeicherte Orte zu erkennen.';
export const RADIUS_EXPLANATION = 'Die Ortung kann besonders in Gebäuden ungenau sein. Ein kleiner Radius kann dazu führen, dass ein Ort nicht erkannt wird.';

export function groupPlaces(places) {
  return [...PLACE_CATEGORIES, undefined].map(category => ({
    label: category || 'Ohne Kategorie',
    places: places.filter(place => place.category === category).sort((a, b) => a.name.localeCompare(b.name, 'de'))
  })).filter(group => group.places.length);
}

export function radiusLabel(radius) {
  return ({
    20: '20 Meter · sehr eng',
    50: '50 Meter · eng',
    100: '100 Meter · nah',
    250: '250 Meter · Umgebung'
  })[radius] || `${radius} Meter`;
}

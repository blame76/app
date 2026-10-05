import { PLACE_CATEGORIES } from './schema.js';

export const PLACE_RADII = [20, 50, 100, 250];
export const LOCATION_EXPLANATION = '0815 fragt deinen Browser nach deinem Standort. Je nach Browser und Betriebssystem kann dafür ein Standortdienst des Herstellers verwendet werden. 0815 sendet deinen Standort nicht an einen eigenen Server. Die Position wird lokal verwendet, um gespeicherte Orte zu erkennen.';
export const RADIUS_EXPLANATION = 'Der Radius gilt für die gemeldete Position. Die Ortung kann ungenau sein, besonders in Gebäuden; einzelne Läden lassen sich damit nicht zuverlässig unterscheiden.';

export function groupPlaces(places) {
  return [...PLACE_CATEGORIES, undefined].map(category => ({
    label: category || 'Ohne Kategorie',
    places: places.filter(place => place.category === category).sort((a, b) => a.name.localeCompare(b.name, 'de'))
  })).filter(group => group.places.length);
}

export function radiusLabel(radius) { return radius === 20 ? 'Genau · 20 Meter' : `${radius} Meter`; }

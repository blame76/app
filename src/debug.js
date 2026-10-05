// Debug utilities for diagnostics (location, etc.)
import { distanceMeters } from './context.js';

/**
 * Format distance in human-readable units.
 * Returns approximate values: meters for <1km, kilometers for >=1km
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance (e.g. "ca. 250 m" or "ca. 12.5 km")
 */
export function formatDistance(meters) {
  if (meters === null || meters === undefined) return '—';
  if (meters < 1000) {
    // Round to nearest 50m for values under 1000m
    const rounded = Math.round(meters / 50) * 50;
    return `ca. ${rounded} m`;
  }
  // Convert to km, round to 1 decimal place
  const km = (meters / 1000).toFixed(1);
  return `ca. ${km} km`;
}

/**
 * Calculate location debug info for a note with place context
 * @param {object} position - Current position {lat, lon, accuracy}
 * @param {array} places - Available places
 * @param {object} noteContext - Note context {placeIds, timeBuckets}
 * @returns {object} {distance, status, place} - distance in meters, status message if any
 */
export function getLocationDebugInfo(position, places, noteContext) {
  // No position available
  if (!position) return { distance: null, status: 'GPS unklar' };
  
  // Note has no place links
  if (!noteContext.placeIds || noteContext.placeIds.length === 0) {
    return { distance: null, status: null };
  }
  
  // Get first linked place (primary place for display)
  const primaryPlaceId = noteContext.placeIds[0];
  const place = places.find(p => p.id === primaryPlaceId);
  
  if (!place) {
    return { distance: null, status: 'Ort nicht mehr gespeichert' };
  }
  
  // Calculate distance
  const distance = distanceMeters(position, place);
  
  // Check if within radius
  if (distance > place.radius) {
    return { distance, status: 'Radius überschritten', place };
  }
  
  return { distance, status: null, place };
}

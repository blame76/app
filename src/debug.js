// Debug utilities for location and other diagnostics
import { distanceMeters } from './context.js';

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

export async function getDebugMode() {
  // This function would typically fetch from database/storage
  // For now it's a placeholder - the actual implementation will be in app.js
  return false;
}

/**
 * ============================================================================
 * ANNAYOG — Haversine Distance Calculator
 * ============================================================================
 * Calculates the great-circle distance between two geographic points
 * using the Haversine formula. This is the core distance metric used
 * by the AI matching engine to rank NGOs and delivery partners by
 * proximity to a food listing's pickup location.
 *
 * Formula accuracy: ~0.5% error for distances under 1000 km, which
 * is more than sufficient for intra-city food rescue matching.
 * ============================================================================
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians.
 * @param {number} deg - Angle in degrees
 * @returns {number} Angle in radians
 */
function toRadians(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Calculate the distance in kilometres between two lat/lng points.
 *
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in kilometres (rounded to 2 decimal places)
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_KM * c * 100) / 100; // 2 decimal places
}

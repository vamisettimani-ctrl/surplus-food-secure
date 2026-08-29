/**
 * AI Matching Engine - core algorithm for matching food listings to NGOs.
 */
import { haversineDistance } from '../utils/haversine.js';
import { listings, ngoProfiles, matchAttempts, users, newId, findAll, conditionalUpdate } from '../store/index.js';
import { logAudit } from './audit.js';

let broadcast = () => {};
try {
  import('../websocket/index.js').then(ws => {
    broadcast = ws.broadcast || broadcast;
  }).catch(() => {});
} catch (e) {
  // Ignore missing websocket module
}

/**
 * Triggers the AI matching process for a food listing.
 * @param {Object} listing 
 * @param {Array<string>} excludeNgoIds 
 */
export async function triggerMatching(listing, excludeNgoIds = []) {
  const now = new Date();
  
  // 1. Eligibility Filter
  const eligibleNgos = findAll(ngoProfiles, (profile) => {
    if (!profile.auto_match_enabled) return false;
    if (excludeNgoIds.includes(profile.user_id)) return false;
    
    const user = users.get(profile.user_id);
    if (!user || user.verification_status !== 'APPROVED' || user.suspended) return false;
    
    const distance = haversineDistance(
      listing.latitude, listing.longitude,
      profile.latitude, profile.longitude
    );
    
    let maxRadius = profile.service_radius_km;
    
    // Relax radius for highly perishable with < 60 min left
    const minutesLeft = (new Date(listing.best_before_at) - now) / 60000;
    if (listing.perishability === 'HIGHLY_PERISHABLE' && minutesLeft < 60) {
      maxRadius *= 1.5;
    }
    
    if (distance > maxRadius) return false;
    
    if ((profile.daily_capacity - profile.claimed_today) < listing.quantity_meals) return false;
    
    // Time check
    const currentHourStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    if (currentHourStr < profile.operating_hours_open || currentHourStr > profile.operating_hours_close) return false;
    
    return true;
  });

  logAudit('MATCHING_TRIGGERED', listing.created_by, { listing_id: listing.id });

  if (eligibleNgos.length === 0) {
    logAudit('NO_ELIGIBLE_NGO', 'system', { listing_id: listing.id });
    return null;
  }

  // 2 & 3. Distance Scoring and Urgency Weighting
  const scoredNgos = eligibleNgos.map(profile => {
    const distance = haversineDistance(
      listing.latitude, listing.longitude,
      profile.latitude, profile.longitude
    );
    
    const minutesLeft = (new Date(listing.best_before_at) - now) / 60000;
    let urgencyWeight = minutesLeft;
    
    if (listing.perishability === 'HIGHLY_PERISHABLE') urgencyWeight *= 3;
    else if (listing.perishability === 'MODERATE') urgencyWeight *= 2;
    else urgencyWeight *= 1; // PACKAGED_SHELF_STABLE
    
    const score = distance + urgencyWeight;
    
    return { profile, distance, score };
  });

  scoredNgos.sort((a, b) => a.score - b.score);
  const bestMatch = scoredNgos[0];

  // 5. Assignment
  const matchAttemptId = newId();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  
  const matchAttempt = {
    id: matchAttemptId,
    listing_id: listing.id,
    ngo_id: bestMatch.profile.user_id,
    offered_at: now.toISOString(),
    expires_at: expiresAt,
    responded_at: null,
    outcome: 'PENDING',
    distance_km: bestMatch.distance
  };
  
  matchAttempts.set(matchAttemptId, matchAttempt);

  // 6. Update listing status
  conditionalUpdate(listings, listing.id, { status: 'MATCHED_PENDING_NGO_ACCEPT' }, { status: 'LISTED' });

  // 7. Try to broadcast
  try {
    broadcast(bestMatch.profile.user_id, 'MATCH_OFFER', {
      match_id: matchAttemptId,
      food_type: listing.food_type,
      quantity_meals: listing.quantity_meals,
      best_before_at: listing.best_before_at,
      expires_at: expiresAt,
      distance_km: bestMatch.distance,
      status: 'MATCHED_PENDING_NGO_ACCEPT'
    });
  } catch (err) {
    // ignore
  }

  logAudit('MATCH_OFFERED', 'system', { listing_id: listing.id, ngo_id: bestMatch.profile.user_id, match_id: matchAttemptId });
  return matchAttempt;
}

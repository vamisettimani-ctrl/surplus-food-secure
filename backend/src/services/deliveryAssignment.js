/**
 * Delivery Assignment Service - matching listings to delivery partners.
 */
import { haversineDistance } from '../utils/haversine.js';
import { deliveryPartnerProfiles, deliveryAssignments, listings, users, newId, findAll, conditionalUpdate } from '../store/index.js';
import { logAudit } from './audit.js';

let broadcast = () => {};
try {
  import('../websocket/index.js').then(ws => {
    broadcast = ws.broadcast || broadcast;
  }).catch(() => {});
} catch (e) {
  // Ignore
}

/**
 * Triggers delivery assignment for a given listing.
 * @param {Object} listing 
 * @param {string} ngoUserId 
 * @param {Array<string>} excludePartnerIds 
 */
export async function triggerDeliveryAssignment(listing, ngoUserId, excludePartnerIds = []) {
  const now = new Date();
  
  // 1 & 2. Find eligible partners
  const eligiblePartners = findAll(deliveryPartnerProfiles, (profile) => {
    if (excludePartnerIds.includes(profile.user_id)) return false;
    if (profile.status !== 'ONLINE') return false;
    
    const user = users.get(profile.user_id);
    if (!user || user.verification_status !== 'APPROVED' || user.suspended) return false;
    
    const distance = haversineDistance(
      listing.latitude, listing.longitude,
      profile.latitude, profile.longitude
    );
    
    if (distance > 15) return false;
    return true;
  });

  logAudit('DELIVERY_ASSIGNMENT_TRIGGERED', 'system', { listing_id: listing.id, ngo_id: ngoUserId });

  if (eligiblePartners.length === 0) {
    return null; // NGO can self-arrange
  }

  // 3. Sort by distance
  const scoredPartners = eligiblePartners.map(profile => {
    const distance = haversineDistance(
      listing.latitude, listing.longitude,
      profile.latitude, profile.longitude
    );
    return { profile, distance };
  });

  scoredPartners.sort((a, b) => a.distance - b.distance);
  const bestPartner = scoredPartners[0];

  // 4. Create DeliveryAssignment
  const assignmentId = newId();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  
  const assignment = {
    id: assignmentId,
    listing_id: listing.id,
    match_ngo_id: ngoUserId,
    partner_id: bestPartner.profile.user_id,
    offered_at: now.toISOString(),
    expires_at: expiresAt,
    status: 'PENDING',
    pickup_photo_url: null,
    dropoff_photo_url: null
  };
  
  deliveryAssignments.set(assignmentId, assignment);

  // 5. Update listing status
  conditionalUpdate(listings, listing.id, { status: 'DELIVERY_ASSIGNED' }, { status: 'NGO_ACCEPTED' });

  // 6. Broadcast
  try {
    broadcast(bestPartner.profile.user_id, 'DELIVERY_OFFER', {
      id: assignmentId,
      listing_id: listing.id,
      food_type: listing.food_type,
      quantity_meals: listing.quantity_meals,
      distance_km: bestPartner.distance,
      expires_at: expiresAt
    });
  } catch (e) {
    // ignore
  }

  return assignment;
}

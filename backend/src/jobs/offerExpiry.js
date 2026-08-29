/**
 * ============================================================================
 * ANNAYOG — Offer Expiry Background Job
 * ============================================================================
 * Runs every 30 seconds. Checks for expired match offers and delivery
 * offers, auto-declines them, and cascades to the next eligible
 * candidate. This ensures food doesn't stay stuck waiting for a
 * response that never comes.
 *
 * Match offers expire after 10 minutes (set in matchingEngine.js).
 * Delivery offers expire after 5 minutes (set in deliveryAssignment.js).
 * ============================================================================
 */

import cron from 'node-cron';
import {
  matchAttempts,
  deliveryAssignments,
  listings,
  conditionalUpdate,
} from '../store/index.js';
import { logAudit } from '../services/audit.js';

// These will be dynamically imported to avoid circular dependency issues
let triggerMatching = null;
let triggerDeliveryAssignment = null;

async function loadDependencies() {
  try {
    const matchingMod = await import('../services/matchingEngine.js');
    triggerMatching = matchingMod.triggerMatching;
  } catch (e) {
    console.warn('[OfferExpiry] Could not load matchingEngine:', e.message);
  }
  try {
    const deliveryMod = await import('../services/deliveryAssignment.js');
    triggerDeliveryAssignment = deliveryMod.triggerDeliveryAssignment;
  } catch (e) {
    console.warn('[OfferExpiry] Could not load deliveryAssignment:', e.message);
  }
}

function checkExpiredOffers() {
  const now = new Date();

  // ── Check expired match offers ──────────────────────────────────────────
  for (const [id, match] of matchAttempts) {
    if (match.outcome !== 'PENDING') continue;
    if (!match.expires_at) continue;
    if (new Date(match.expires_at) > now) continue;

    // Expire this match offer
    match.outcome = 'EXPIRED';
    match.responded_at = now.toISOString();
    matchAttempts.set(id, match);

    logAudit('SYSTEM', 'MATCH_OFFER_EXPIRED', 'MatchAttempt', id, {
      listing_id: match.listing_id,
      ngo_id: match.ngo_id,
    });

    console.log(`[OfferExpiry] Match ${id} expired for NGO ${match.ngo_id}`);

    // Cascade: re-trigger matching excluding all NGOs that already declined/expired
    if (triggerMatching) {
      const listing = listings.get(match.listing_id);
      if (listing && listing.status === 'MATCHED_PENDING_NGO_ACCEPT') {
        // Reset listing to LISTED so matching can re-run
        listing.status = 'LISTED';
        listings.set(listing.id, listing);

        // Collect all NGOs that have been offered this listing
        const excludedNgos = [];
        for (const m of matchAttempts.values()) {
          if (m.listing_id === match.listing_id && m.outcome !== 'PENDING') {
            excludedNgos.push(m.ngo_id);
          }
        }
        triggerMatching(listing, excludedNgos);
      }
    }
  }

  // ── Check expired delivery offers ──────────────────────────────────────
  for (const [id, assignment] of deliveryAssignments) {
    if (assignment.status !== 'PENDING') continue;
    if (!assignment.expires_at) continue;
    if (new Date(assignment.expires_at) > now) continue;

    // Expire this delivery offer
    assignment.status = 'EXPIRED';
    deliveryAssignments.set(id, assignment);

    logAudit('SYSTEM', 'DELIVERY_OFFER_EXPIRED', 'DeliveryAssignment', id, {
      listing_id: assignment.listing_id,
      partner_id: assignment.partner_id,
    });

    console.log(`[OfferExpiry] Delivery ${id} expired for partner ${assignment.partner_id}`);

    // Cascade: re-trigger delivery assignment excluding expired partners
    if (triggerDeliveryAssignment) {
      const listing = listings.get(assignment.listing_id);
      if (listing) {
        const excludedPartners = [];
        for (const a of deliveryAssignments.values()) {
          if (a.listing_id === assignment.listing_id && a.status !== 'PENDING') {
            excludedPartners.push(a.partner_id);
          }
        }
        triggerDeliveryAssignment(listing, assignment.match_ngo_id, excludedPartners);
      }
    }
  }
}

export function startOfferExpiryJob() {
  loadDependencies().then(() => {
    // Run every 30 seconds
    cron.schedule('*/30 * * * * *', checkExpiredOffers);
    console.log('[Jobs] Offer expiry checker started (every 30 seconds)');
  });
}

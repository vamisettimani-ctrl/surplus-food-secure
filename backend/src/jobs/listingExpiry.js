/**
 * ============================================================================
 * ANNAYOG — Listing Expiry Background Job
 * ============================================================================
 * Runs every minute. Auto-expires listings whose best_before_at
 * timestamp has passed without being delivered. Expired listings
 * are removed from all queues and the donor is notified.
 * ============================================================================
 */

import cron from 'node-cron';
import { listings, matchAttempts, deliveryAssignments } from '../store/index.js';
import { logAudit } from '../services/audit.js';

let broadcast = () => {};

async function loadBroadcast() {
  try {
    const ws = await import('../websocket/index.js');
    broadcast = ws.broadcast || broadcast;
  } catch { /* WebSocket not yet initialised */ }
}

function checkExpiredListings() {
  const now = new Date();

  for (const [id, listing] of listings) {
    // Skip already terminal states
    if (['DELIVERED', 'EXPIRED', 'CANCELLED'].includes(listing.status)) continue;

    // Check if best_before has passed
    if (!listing.best_before_at) continue;
    if (new Date(listing.best_before_at) > now) continue;

    // Expire the listing
    listing.status = 'EXPIRED';
    listings.set(id, listing);

    // Cancel any pending match attempts for this listing
    for (const [matchId, match] of matchAttempts) {
      if (match.listing_id === id && match.outcome === 'PENDING') {
        match.outcome = 'EXPIRED';
        match.responded_at = now.toISOString();
        matchAttempts.set(matchId, match);
      }
    }

    // Cancel any pending delivery assignments
    for (const [assignId, assignment] of deliveryAssignments) {
      if (assignment.listing_id === id && assignment.status === 'PENDING') {
        assignment.status = 'EXPIRED';
        deliveryAssignments.set(assignId, assignment);
      }
    }

    logAudit('SYSTEM', 'LISTING_EXPIRED', 'Listing', id, {
      donor_id: listing.donor_id,
      best_before_at: listing.best_before_at,
    });

    // Notify donor
    try {
      broadcast(listing.donor_id, 'LISTING_STATUS_CHANGED', {
        listing_id: id,
        status: 'EXPIRED',
      });
    } catch { /* ignore */ }

    console.log(`[ListingExpiry] Listing ${id} expired (best_before: ${listing.best_before_at})`);
  }
}

export function startListingExpiryJob() {
  loadBroadcast();
  // Run every minute
  cron.schedule('* * * * *', checkExpiredListings);
  console.log('[Jobs] Listing expiry checker started (every 60 seconds)');
}

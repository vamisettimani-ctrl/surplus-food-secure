/**
 * ============================================================================
 * ANNAYOG — Radius Auto-Widen Background Job
 * ============================================================================
 * Runs every 2 minutes. For listings that have been in 'LISTED' status
 * (unmatched) for more than 5 minutes, automatically widens the search
 * radius and re-triggers the matching engine.
 *
 * Radius widen schedule:
 *   - After 5 min:  +2 km beyond original max radius
 *   - After 10 min: +4 km
 *   - After 15 min: +6 km (max cap, stops widening)
 * ============================================================================
 */

import cron from 'node-cron';
import { listings, matchAttempts } from '../store/index.js';
import { logAudit } from '../services/audit.js';

let triggerMatching = null;

async function loadDependencies() {
  try {
    const mod = await import('../services/matchingEngine.js');
    triggerMatching = mod.triggerMatching;
  } catch (e) {
    console.warn('[RadiusWiden] Could not load matchingEngine:', e.message);
  }
}

function checkUnmatchedListings() {
  if (!triggerMatching) return;

  const now = Date.now();
  const FIVE_MIN = 5 * 60 * 1000;

  for (const [id, listing] of listings) {
    if (listing.status !== 'LISTED') continue;

    const age = now - new Date(listing.created_at).getTime();
    if (age < FIVE_MIN) continue;

    // Calculate how many widen steps (each 5 min)
    const steps = Math.min(Math.floor(age / FIVE_MIN), 3); // max 3 steps = +6km
    const radiusBoost = steps * 2; // +2km per step

    // Collect all NGOs already attempted
    const excludedNgos = [];
    for (const m of matchAttempts.values()) {
      if (m.listing_id === id) {
        excludedNgos.push(m.ngo_id);
      }
    }

    // Store the radius boost on the listing for the matching engine to use
    listing._radius_boost_km = radiusBoost;
    listings.set(id, listing);

    console.log(`[RadiusWiden] Listing ${id} unmatched for ${Math.floor(age/60000)}m, widening by +${radiusBoost}km`);

    triggerMatching(listing, excludedNgos);

    logAudit('SYSTEM', 'RADIUS_WIDENED', 'Listing', id, {
      age_minutes: Math.floor(age / 60000),
      radius_boost_km: radiusBoost,
    });
  }
}

export function startRadiusWidenJob() {
  loadDependencies().then(() => {
    // Run every 2 minutes
    cron.schedule('*/2 * * * *', checkUnmatchedListings);
    console.log('[Jobs] Radius auto-widen started (every 2 minutes)');
  });
}

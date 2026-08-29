import express from 'express';
import { listings as storeListings, matchAttempts as storeMatches } from '../store/index.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { success } from '../utils/envelope.js';

const router = express.Router();

// GET /stats/impact (authenticate)
router.get('/stats/impact', authenticate, (req, res) => {
  let listings = Array.from(storeListings.values());
  const { user_id } = req.query;

  if (user_id) {
    listings = listings.filter(l => l.donor_id === user_id);
  }

  let meals_rescued = 0;
  let listings_delivered = 0;
  let listings_expired = 0;

  for (const listing of listings) {
    if (listing.status === 'DELIVERED') {
      meals_rescued += listing.quantity_meals || 0;
      listings_delivered++;
    } else if (listing.status === 'EXPIRED') {
      listings_expired++;
    }
  }

  const kg_saved = meals_rescued * 0.5;
  const co2e_kg_estimate = kg_saved * 2.5;

  return success(res, {
    meals_rescued,
    kg_saved,
    co2e_kg_estimate,
    listings_delivered,
    listings_expired
  });
});

// GET /admin/dashboard (authenticate, authorize('ADMIN'))
router.get('/admin/dashboard', authenticate, authorize('ADMIN'), (req, res) => {
  const listings = Array.from(storeListings.values());
  const total_listings = listings.length;
  
  if (total_listings === 0) {
    return success(res, {
      listings_today: 0,
      total_listings: 0,
      matched_pct: 0,
      delivered_pct: 0,
      expired_pct: 0,
      avg_time_to_match_seconds: 0
    });
  }

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  let listings_today = 0;
  let matched_count = 0;
  let delivered_count = 0;
  let expired_count = 0;
  let total_match_time = 0;
  let matches_with_time = 0;

  for (const listing of listings) {
    if (now - new Date(listing.created_at).getTime() < oneDay) {
      listings_today++;
    }
    
    // Status can be MATCHED, DELIVERY_ASSIGNED, PARTNER_ARRIVED_PICKUP, PICKED_UP, DELIVERED
    const matchedStatuses = ['MATCHED', 'DELIVERY_ASSIGNED', 'PARTNER_ARRIVED_PICKUP', 'PICKED_UP', 'DELIVERED'];
    if (matchedStatuses.includes(listing.status)) {
      matched_count++;
      
      const match = Array.from(storeMatches.values()).find(m => m.listing_id === listing.id);
      if (match && match.offered_at && listing.created_at) { // used offered_at and created_at
        total_match_time += (new Date(match.offered_at).getTime() - new Date(listing.created_at).getTime()) / 1000;
        matches_with_time++;
      }
    }

    if (listing.status === 'DELIVERED') {
      delivered_count++;
    }

    if (listing.status === 'EXPIRED') {
      expired_count++;
    }
  }

  const matched_pct = (matched_count / total_listings) * 100;
  const delivered_pct = (delivered_count / total_listings) * 100;
  const expired_pct = (expired_count / total_listings) * 100;
  const avg_time_to_match_seconds = matches_with_time > 0 ? total_match_time / matches_with_time : 0;

  return success(res, {
    listings_today,
    total_listings,
    matched_pct,
    delivered_pct,
    expired_pct,
    avg_time_to_match_seconds
  });
});

export default router;

/**
 * API Routes for managing food listings
 * Handles creating, updating, retrieving, cancelling, and claiming listings.
 */
import express from 'express';
import { z } from 'zod';
import { listings, matchAttempts as storeMatchAttempts, ngoProfiles, newId, conditionalUpdate } from '../store/index.js';
import { success, badRequest, notFound, forbidden, serverError } from '../utils/envelope.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { logAudit } from '../services/audit.js';
import { haversineDistance } from '../utils/haversine.js';
import { triggerMatching } from '../services/matchingEngine.js';
import { triggerDeliveryAssignment } from '../services/deliveryAssignment.js';

const router = express.Router();

const createListingSchema = z.object({
  food_type: z.string().min(1),
  quantity_meals: z.number().int().min(1).max(500),
  perishability: z.enum(['HIGHLY_PERISHABLE', 'MODERATE', 'PACKAGED_SHELF_STABLE']),
  best_before_at: z.string().datetime(),
  pickup_window: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  photo_url: z.string().url().or(z.literal('')).optional().nullable(),
  lat: z.number(),
  lng: z.number(),
  safety_ack: z.boolean().optional(),
});

// POST /listings
router.post('/listings', authenticate, requireVerified, authorize('RESTAURANT', 'INDIVIDUAL_DONOR'), async (req, res) => {
  try {
    const validated = createListingSchema.parse(req.body);

    if (req.user.role === 'INDIVIDUAL_DONOR' && validated.safety_ack !== true) {
      return badRequest(res, 'Safety acknowledgement is required for individual donors.');
    }

    const newListing = {
      id: newId(),
      donor_id: req.user.id,
      food_type: validated.food_type,
      quantity_meals: validated.quantity_meals,
      perishability: validated.perishability,
      best_before_at: validated.best_before_at,
      pickup_window_start: validated.pickup_window.start,
      pickup_window_end: validated.pickup_window.end,
      photo_url: validated.photo_url || null,
      lat: validated.lat,
      lng: validated.lng,
      status: 'LISTED',
      safety_ack: validated.safety_ack || false,
      cancel_reason: null,
      created_at: new Date().toISOString()
    };

    listings.set(newListing.id, newListing);

    try {
      logAudit(req.user.id, 'LISTING_CREATED', 'Listing', newListing.id, { listing_id: newListing.id });
      if (triggerMatching) triggerMatching(newListing);
    } catch (err) {
      console.error('Post-creation hooks failed:', err);
    }

    res.status(201);
    return success(res, { listing_id: newListing.id, ...newListing });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return badRequest(res, `Validation failed: ${issues}`);
    }
    return serverError(res, err.message);
  }
});

// GET /listings/mine
router.get('/listings/mine', authenticate, authorize('RESTAURANT', 'INDIVIDUAL_DONOR', 'ADMIN'), (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const statusFilter = req.query.status;
  
  let listingsArr = Array.from(listings.values());
  
  if (req.user.role !== 'ADMIN') {
    listingsArr = listingsArr.filter(l => l.donor_id === req.user.id);
  }
  
  if (statusFilter) {
    listingsArr = listingsArr.filter(l => l.status === statusFilter);
  }
  
  listingsArr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  return success(res, listingsArr.slice(0, limit));
});

// GET /listings/board
router.get('/listings/board', authenticate, requireVerified, authorize('NGO', 'ADMIN'), (req, res) => {
  const queryLat = parseFloat(req.query.lat);
  const queryLng = parseFloat(req.query.lng);
  const radiusKm = parseFloat(req.query.radius_km) || 50;

  const ngoProfile = Array.from(ngoProfiles.values()).find(p => p.user_id === req.user.id);
  const baseLat = !isNaN(queryLat) ? queryLat : ngoProfile?.lat;
  const baseLng = !isNaN(queryLng) ? queryLng : ngoProfile?.lng;

  const attempts = Array.from(storeMatchAttempts.values());
  const activeMatchAttemptListings = new Set(
    attempts.filter(m => m.outcome === 'PENDING').map(m => m.listing_id)
  );

  let available = Array.from(listings.values()).filter(l => {
    if (l.status === 'LISTED') return true;
    if (l.status === 'MATCHED_PENDING_NGO_ACCEPT' && !activeMatchAttemptListings.has(l.id)) return true;
    return false;
  });

  const enriched = available.map(l => {
    let dist = null;
    if (baseLat != null && baseLng != null) {
      dist = haversineDistance(baseLat, baseLng, l.lat, l.lng);
    }
    return { ...l, distance_km: dist };
  });

  const filtered = enriched.filter(l => l.distance_km === null || l.distance_km <= radiusKm);
  filtered.sort((a, b) => new Date(a.best_before_at) - new Date(b.best_before_at));

  return success(res, filtered);
});

// GET /listings/:id
router.get('/listings/:id', authenticate, (req, res) => {
  const listing = listings.get(req.params.id);
  if (!listing) {
    return notFound(res, 'Listing not found');
  }
  return success(res, { ...listing });
});

// POST /listings/:id/cancel
router.post('/listings/:id/cancel', authenticate, (req, res) => {
  const { reason } = req.body;
  const listing = listings.get(req.params.id);
  
  if (!listing) {
    return notFound(res, 'Listing not found');
  }
  if (req.user.role !== 'ADMIN' && listing.donor_id !== req.user.id) {
    return forbidden(res, 'Not authorized to cancel this listing');
  }

  const isSuccess = conditionalUpdate(listings, req.params.id, 
    (l) => ['LISTED', 'MATCHED_PENDING_NGO_ACCEPT'].includes(l.status),
    (l) => {
      l.status = 'CANCELLED';
      l.cancel_reason = reason || null;
      return l;
    }
  );

  if (!isSuccess) {
    return badRequest(res, 'Listing cannot be cancelled in its current state');
  }

  logAudit(req.user.id, 'LISTING_CANCELLED', 'Listing', req.params.id, { reason });

  return success(res, { listing_id: req.params.id, status: 'CANCELLED' });
});

// POST /listings/:id/claim
router.post('/listings/:id/claim', authenticate, authorize('NGO'), requireVerified, (req, res) => {
  const listingId = req.params.id;
  const listing = listings.get(listingId);
  
  if (!listing) {
    return notFound(res, 'Listing not found');
  }

  const isSuccess = conditionalUpdate(listings, listingId,
    (l) => l.status === 'LISTED',
    (l) => {
      l.status = 'NGO_ACCEPTED';
      return l;
    }
  );

  if (!isSuccess) {
    return badRequest(res, 'Listing is no longer available');
  }

  const ngoProfile = Array.from(ngoProfiles.values()).find(p => p.user_id === req.user.id);
  let dist = null;
  if (ngoProfile?.lat != null && ngoProfile?.lng != null) {
    dist = haversineDistance(listing.lat, listing.lng, ngoProfile.lat, ngoProfile.lng);
  }

  const matchAttemptId = newId();
  const now = new Date().toISOString();
  
  storeMatchAttempts.set(matchAttemptId, {
    id: matchAttemptId,
    listing_id: listingId,
    ngo_id: req.user.id,
    offered_at: now,
    expires_at: null,
    responded_at: now,
    outcome: 'ACCEPTED',
    distance_km: dist
  });

  try {
    if (triggerDeliveryAssignment) triggerDeliveryAssignment(listing, req.user.id);
    logAudit(req.user.id, 'LISTING_CLAIMED_MANUAL', 'MatchAttempt', matchAttemptId, { listing_id: listingId });
  } catch (err) {
    console.error('Post-claim hooks failed:', err);
  }

  return success(res, { success: true, listing_id: listingId });
});

// POST /listings/:id/confirm-receipt
router.post('/listings/:id/confirm-receipt', authenticate, authorize('NGO'), (req, res) => {
  const listingId = req.params.id;
  
  const isSuccess = conditionalUpdate(listings, listingId,
    (l) => ['DELIVERED', 'PICKED_UP'].includes(l.status),
    (l) => {
      l.status = 'DELIVERED';
      return l;
    }
  );

  if (!isSuccess) {
    return badRequest(res, 'Listing not in a valid state for receipt confirmation');
  }

  logAudit(req.user.id, 'RECEIPT_CONFIRMED', 'Listing', listingId, {});

  return success(res, { success: true });
});

export default router;

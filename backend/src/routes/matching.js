/**
 * API Routes for matching operations
 * Handles retrieving match attempts, accepting/declining, and configuring auto-match.
 */
import express from 'express';
import { listings, matchAttempts, ngoProfiles, conditionalUpdate } from '../store/index.js';
import { success, badRequest, notFound, forbidden } from '../utils/envelope.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { idempotency } from '../middleware/idempotency.js';
import { matchActionLimiter } from '../middleware/rateLimiter.js';
import { logAudit } from '../services/audit.js';
import { triggerDeliveryAssignment } from '../services/deliveryAssignment.js';
import { triggerMatching } from '../services/matchingEngine.js';
import { broadcast } from '../websocket/index.js';
import { users } from '../store/index.js';

const router = express.Router();

// GET /listings/matched (assuming it will be mounted somewhere accessible)
router.get('/listings/matched', authenticate, authorize('NGO', 'ADMIN'), (req, res) => {
  const attempts = Array.from(matchAttempts.values());
  
  const relevantMatches = attempts.filter(m => 
    m.ngo_id === req.user.id && (m.outcome === 'PENDING' || m.outcome === 'ACCEPTED')
  );

  const data = relevantMatches.map(match => {
    const listing = listings.get(match.listing_id);
    if (!listing) return null;
    
    const donor = users.get(listing.donor_id);
    
    return {
      match_id: match.id,
      listing_id: match.listing_id,
      food_type: listing.food_type,
      quantity_meals: listing.quantity_meals,
      best_before_at: listing.best_before_at,
      expires_at: match.expires_at,
      distance_km: match.distance_km,
      status: listing.status,
      donor_name: donor ? donor.name : 'Unknown Donor'
    };
  }).filter(Boolean);

  return success(res, data);
});

// POST /matches/:id/accept
router.post('/matches/:id/accept', authenticate, authorize('NGO'), idempotency, matchActionLimiter, (req, res) => {
  const matchId = req.params.id;
  const match = matchAttempts.get(matchId);
  
  if (!match) {
    return notFound(res, 'Match attempt not found');
  }

  if (match.ngo_id !== req.user.id) {
    return forbidden(res, 'Not authorized for this match');
  }

  const isSuccess = conditionalUpdate(matchAttempts, matchId,
    (m) => m.outcome === 'PENDING',
    (m) => {
      m.outcome = 'ACCEPTED';
      m.responded_at = new Date().toISOString();
      return m;
    }
  );

  if (!isSuccess) {
    return badRequest(res, 'Match attempt is no longer pending');
  }

  const listing = listings.get(match.listing_id);
  if (listing) {
    conditionalUpdate(listings, match.listing_id,
      () => true,
      (l) => {
        l.status = 'NGO_ACCEPTED';
        return l;
      }
    );

    try {
      if (triggerDeliveryAssignment) triggerDeliveryAssignment(listing, req.user.id);
      if (broadcast) {
        broadcast(listing.donor_id, 'LISTING_STATUS_CHANGED', { listing_id: listing.id, status: 'NGO_ACCEPTED' });
      }
    } catch (e) {
      console.error('Post-accept hooks failed:', e);
    }
  }

  logAudit(req.user.id, 'MATCH_ACCEPTED', 'MatchAttempt', matchId, {});

  return success(res, { match_id: matchId, status: 'NGO_ACCEPTED' });
});

// POST /matches/:id/decline
router.post('/matches/:id/decline', authenticate, authorize('NGO'), idempotency, matchActionLimiter, (req, res) => {
  const matchId = req.params.id;
  const match = matchAttempts.get(matchId);
  
  if (!match) {
    return notFound(res, 'Match attempt not found');
  }

  if (match.ngo_id !== req.user.id) {
    return forbidden(res, 'Not authorized for this match');
  }

  const isSuccess = conditionalUpdate(matchAttempts, matchId,
    (m) => m.outcome === 'PENDING',
    (m) => {
      m.outcome = 'DECLINED';
      m.responded_at = new Date().toISOString();
      return m;
    }
  );

  if (!isSuccess) {
    return badRequest(res, 'Match attempt is no longer pending');
  }

  const listing = listings.get(match.listing_id);
  if (listing) {
    try {
      if (triggerMatching) triggerMatching(listing);
    } catch (e) {
      console.error('Trigger matching failed:', e);
    }
  }

  logAudit(req.user.id, 'MATCH_DECLINED', 'MatchAttempt', matchId, {});

  return success(res, { match_id: matchId, status: 'DECLINED' });
});

// PATCH /ngo/auto-match
router.patch('/ngo/auto-match', authenticate, authorize('NGO'), requireVerified, (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return badRequest(res, 'enabled must be a boolean');
  }

  const profileEntry = Array.from(ngoProfiles.values()).find(p => p.user_id === req.user.id);
  if (!profileEntry) {
    return notFound(res, 'NGO profile not found');
  }

  conditionalUpdate(ngoProfiles, profileEntry.id || profileEntry.user_id,
    () => true,
    (p) => {
      p.auto_match_enabled = enabled;
      return p;
    }
  );

  logAudit(req.user.id, 'AUTO_MATCH_TOGGLED', 'NGOProfile', profileEntry.id || profileEntry.user_id, { auto_match_enabled: enabled });

  return success(res, { auto_match_enabled: enabled });
});

export default router;

import express from 'express';
import { deliveryAssignments, listings, matchAttempts, users, conditionalUpdate, findAll } from '../store/index.js';
import { success, notFound, forbidden, badRequest } from '../utils/envelope.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { logAudit } from '../services/audit.js';
import { broadcast } from '../websocket/index.js';

const router = express.Router();

// POST /delivery/:id/status (authenticate, authorize('DELIVERY_PARTNER'))
router.post('/delivery/:id/status', authenticate, authorize('DELIVERY_PARTNER'), (req, res) => {
  const assignment = deliveryAssignments.get(req.params.id);
  const { status } = req.body;

  if (!assignment) {
    return notFound(res, 'Assignment not found');
  }

  if (assignment.partner_id !== req.user.id) {
    return forbidden(res, 'Not your assignment');
  }

  const validStatuses = ['PARTNER_ARRIVED_PICKUP', 'PICKED_UP', 'DELIVERED'];
  if (!validStatuses.includes(status)) {
    return badRequest(res, 'Invalid status');
  }

  const transitions = {
    'ACCEPTED': 'PARTNER_ARRIVED_PICKUP',
    'PARTNER_ARRIVED_PICKUP': 'PICKED_UP',
    'PICKED_UP': 'DELIVERED'
  };

  if (transitions[assignment.status] !== status) {
    return badRequest(res, 'Invalid state transition');
  }

  if (status === 'DELIVERED' && !assignment.dropoff_photo_url) {
    return badRequest(res, 'Proof photo required before marking delivered');
  }

  assignment.status = status;
  deliveryAssignments.set(assignment.id, assignment);

  const listing = listings.get(assignment.listing_id);
  if (listing) {
    listing.status = status;
    listings.set(listing.id, listing);
    try {
      broadcast(listing.donor_id, 'LISTING_STATUS_CHANGED', { listing_id: listing.id, status });
    } catch (e) {
      console.error('Failed to broadcast', e);
    }
  }

  logAudit(req.user.id, 'DELIVERY_STATUS_UPDATED', 'DeliveryAssignment', assignment.id, { status });
  return success(res, { id: assignment.id, status });
});

// POST /delivery/:id/photo (authenticate, authorize('DELIVERY_PARTNER'))
router.post('/delivery/:id/photo', authenticate, authorize('DELIVERY_PARTNER'), (req, res) => {
  const assignment = deliveryAssignments.get(req.params.id);
  const { stage, file_url } = req.body;

  if (!assignment) {
    return notFound(res, 'Assignment not found');
  }

  if (assignment.partner_id !== req.user.id) {
    return forbidden(res, 'Not your assignment');
  }

  if (stage === 'PICKUP') {
    assignment.pickup_photo_url = file_url;
  } else if (stage === 'DROPOFF') {
    assignment.dropoff_photo_url = file_url;
  } else {
    return badRequest(res, 'Invalid stage');
  }
  
  deliveryAssignments.set(assignment.id, assignment);

  logAudit(req.user.id, 'DELIVERY_PHOTO_UPLOADED', 'DeliveryAssignment', assignment.id, { stage });
  return success(res, { success: true, file_url });
});

// POST /delivery/:id/no-show (authenticate)
router.post('/delivery/:id/no-show', authenticate, (req, res) => {
  const assignment = deliveryAssignments.get(req.params.id);
  const { flagged_role, notes } = req.body;

  if (!assignment) {
    return notFound(res, 'Assignment not found');
  }

  let flagged_user_id = null;
  const listing = listings.get(assignment.listing_id);
  
  if (flagged_role === 'DONOR') {
    flagged_user_id = listing ? listing.donor_id : null;
  } else if (flagged_role === 'DELIVERY_PARTNER') {
    flagged_user_id = assignment.partner_id;
  } else if (flagged_role === 'NGO') {
    // Requires looking up the match
    // Matches are in matchAttempts? Let's use matchAttempts
    const match = findAll(matchAttempts).find(m => m.listing_id === assignment.listing_id && m.status === 'ACCEPTED');
    flagged_user_id = match ? match.ngo_id : null;
  }

  if (!assignment.metadata) {
    assignment.metadata = {};
  }
  if (!assignment.metadata.no_shows) {
    assignment.metadata.no_shows = [];
  }
  assignment.metadata.no_shows.push({ reporter_id: req.user.id, flagged_role, flagged_user_id, notes, created_at: Date.now() });
  deliveryAssignments.set(assignment.id, assignment);

  if (flagged_user_id) {
    const user = users.get(flagged_user_id);
    if (user) {
      user.trust_score = (user.trust_score || 100) - 5;
      if (user.trust_score < 50) {
        user.suspended = true;
      }
      users.set(user.id, user);
    }
  }

  logAudit(req.user.id, 'NO_SHOW_REPORTED', 'DeliveryAssignment', assignment.id, { flagged_role });
  return success(res, { success: true });
});

// POST /delivery/:id/self-arrange (authenticate, authorize('NGO'))
router.post('/delivery/:id/self-arrange', authenticate, authorize('NGO'), (req, res) => {
  const assignment = deliveryAssignments.get(req.params.id);
  
  if (!assignment) {
    return notFound(res, 'Assignment not found');
  }

  const listing = listings.get(assignment.listing_id);
  if (!listing) {
    return notFound(res, 'Listing not found');
  }

  const match = findAll(matchAttempts).find(m => m.listing_id === listing.id && m.status === 'ACCEPTED');
  if (!match || match.ngo_id !== req.user.id) {
    return forbidden(res, 'Not your match');
  }

  listing.status = 'PICKED_UP';
  listings.set(listing.id, listing);

  assignment.status = 'SELF_ARRANGED';
  deliveryAssignments.set(assignment.id, assignment);

  logAudit(req.user.id, 'SELF_ARRANGE', 'DeliveryAssignment', assignment.id, {});
  return success(res, { success: true });
});

export default router;

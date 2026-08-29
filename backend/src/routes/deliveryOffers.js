import express from 'express';
import { deliveryAssignments, listings, findAll } from '../store/index.js';
import { success, notFound, forbidden, badRequest } from '../utils/envelope.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { idempotency } from '../middleware/idempotency.js';
import { logAudit } from '../services/audit.js';
import { broadcast } from '../websocket/index.js';
import { triggerDeliveryAssignment } from '../services/deliveryAssignment.js';

const router = express.Router();

// GET /delivery-offers/pending (authenticate, authorize('DELIVERY_PARTNER','ADMIN'))
router.get('/delivery-offers/pending', authenticate, authorize('DELIVERY_PARTNER', 'ADMIN'), (req, res) => {
  const assignments = findAll(deliveryAssignments)
    .filter(a => a.partner_id === req.user.id && a.status === 'PENDING');

  const data = assignments.map(assignment => {
    const listing = listings.get(assignment.listing_id);
    return {
      id: assignment.id,
      listing_id: assignment.listing_id,
      food_type: listing ? listing.food_type : null,
      quantity_meals: listing ? listing.quantity_meals : null,
      distance_km: assignment.distance_km,
      expires_at: assignment.expires_at,
      pickup_lat: listing ? listing.location.lat : null,
      pickup_lng: listing ? listing.location.lng : null
    };
  });

  return success(res, data);
});

// POST /delivery-offers/:id/accept (authenticate, authorize('DELIVERY_PARTNER'), idempotency)
router.post('/delivery-offers/:id/accept', authenticate, authorize('DELIVERY_PARTNER'), idempotency, (req, res) => {
  const assignment = deliveryAssignments.get(req.params.id);

  if (!assignment) {
    return notFound(res, 'Assignment not found');
  }

  if (assignment.partner_id !== req.user.id) {
    return forbidden(res, 'Not your assignment');
  }

  if (assignment.status !== 'PENDING') {
    return badRequest(res, 'Assignment is not pending');
  }

  assignment.status = 'ACCEPTED';
  deliveryAssignments.set(assignment.id, assignment);

  const listing = listings.get(assignment.listing_id);
  if (listing) {
    listing.status = 'DELIVERY_ASSIGNED';
    listings.set(listing.id, listing);
    
    try {
      broadcast(listing.donor_id, 'LISTING_STATUS_CHANGED', { listing_id: listing.id, status: 'DELIVERY_ASSIGNED' });
    } catch (e) {
      console.error('Failed to broadcast', e);
    }
  }

  logAudit(req.user.id, 'DELIVERY_OFFER_ACCEPTED', 'DeliveryAssignment', assignment.id, {});
  return success(res, { id: assignment.id, status: 'DELIVERY_ASSIGNED' });
});

// POST /delivery-offers/:id/decline (authenticate, authorize('DELIVERY_PARTNER'), idempotency)
router.post('/delivery-offers/:id/decline', authenticate, authorize('DELIVERY_PARTNER'), idempotency, (req, res) => {
  const assignment = deliveryAssignments.get(req.params.id);

  if (!assignment) {
    return notFound(res, 'Assignment not found');
  }

  if (assignment.partner_id !== req.user.id) {
    return forbidden(res, 'Not your assignment');
  }

  if (assignment.status !== 'PENDING') {
    return badRequest(res, 'Assignment is not pending');
  }

  assignment.status = 'DECLINED';
  deliveryAssignments.set(assignment.id, assignment);

  try {
    triggerDeliveryAssignment(assignment.listing_id);
  } catch (e) {
    console.error('Failed to trigger delivery assignment', e);
  }

  logAudit(req.user.id, 'DELIVERY_OFFER_DECLINED', 'DeliveryAssignment', assignment.id, {});
  return success(res, { id: assignment.id, status: 'DECLINED' });
});

export default router;

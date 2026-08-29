/**
 * Admin Routes
 */
import { Router } from 'express';
import { users, listings, matchAttempts, newId, ngoProfiles, deliveryPartnerProfiles } from '../store/index.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { logAudit } from '../services/audit.js';
import { success, badRequest, notFound } from '../utils/envelope.js';
import { triggerMatching } from '../services/matchingEngine.js';

const router = Router();

router.post('/admin/users/:id/suspend', authenticate, authorize('ADMIN'), (req, res) => {
  const { reason } = req.body;
  const { id } = req.params;
  
  const user = users.get(id);
  if (!user) {
    return notFound(res, 'User not found');
  }
  
  user.suspended = true;
  
  if (user.role === 'NGO') {
    const profile = Array.from(ngoProfiles.values()).find(p => p.user_id === id);
    if (profile) profile.auto_match_enabled = false;
  } else if (user.role === 'DELIVERY_PARTNER') {
    const profile = Array.from(deliveryPartnerProfiles.values()).find(p => p.user_id === id);
    if (profile) profile.status = 'OFFLINE';
  }
  
  logAudit(req.user.id, 'USER_SUSPENDED', 'User', id, { target_user_id: id, reason });
  return success(res, { success: true });
});

router.post('/admin/users/:id/reinstate', authenticate, authorize('ADMIN'), (req, res) => {
  const { id } = req.params;
  
  const user = users.get(id);
  if (!user) {
    return notFound(res, 'User not found');
  }
  
  user.suspended = false;
  
  logAudit(req.user.id, 'USER_REINSTATED', 'User', id, { target_user_id: id });
  return success(res, { success: true });
});

router.patch('/admin/users/:id/role', authenticate, authorize('ADMIN'), (req, res) => {
  const { role } = req.body;
  const { id } = req.params;
  
  const user = users.get(id);
  if (!user) {
    return notFound(res, 'User not found');
  }
  
  user.role = role;
  
  logAudit(req.user.id, 'USER_ROLE_CHANGED', 'User', id, { target_user_id: id, new_role: role });
  return success(res, { success: true, role });
});

router.post('/admin/matches/:id/override', authenticate, authorize('ADMIN'), async (req, res) => {
  const { action, ngo_id } = req.body;
  const { id } = req.params;
  
  const listing = listings.get(id);
  if (!listing) {
    return notFound(res, 'Listing not found');
  }
  
  if (action === 'FORCE_ASSIGN') {
    if (!ngo_id) return badRequest(res, 'ngo_id required');
    
    const matchAttemptId = newId();
    matchAttempts.set(matchAttemptId, {
      id: matchAttemptId,
      listing_id: id,
      ngo_id: ngo_id,
      offered_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10*60*1000).toISOString(),
      responded_at: new Date().toISOString(),
      outcome: 'ACCEPTED',
      distance_km: 0
    });
    
    listing.status = 'NGO_ACCEPTED';
  } else if (action === 'FORCE_CANCEL') {
    const activeMatch = Array.from(matchAttempts.values()).find(m => m.listing_id === id && m.outcome === 'PENDING');
    if (activeMatch) {
      activeMatch.outcome = 'CANCELLED';
    }
    listing.status = 'LISTED';
    await triggerMatching(listing);
  } else {
    return badRequest(res, 'Invalid action');
  }
  
  logAudit(req.user.id, 'MATCH_OVERRIDDEN', 'Listing', id, { listing_id: id, action, ngo_id });
  return success(res, { success: true });
});

export default router;

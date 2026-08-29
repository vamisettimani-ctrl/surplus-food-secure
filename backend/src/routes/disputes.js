import express from 'express';
import { disputes, users, newId, findAll } from '../store/index.js';
import { success, notFound } from '../utils/envelope.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { logAudit } from '../services/audit.js';

const router = express.Router();

// POST /disputes (authenticate)
router.post('/disputes', authenticate, (req, res) => {
  const { listing_id, delivery_id, description, photo_url } = req.body;

  const id = newId();
  const dispute = {
    id,
    reporter_id: req.user.id,
    listing_id,
    delivery_id,
    description,
    photo_url,
    outcome: null,
    trust_score_delta: 0,
    resolved_by: null,
    created_at: Date.now(),
    resolved_at: null
  };

  disputes.set(id, dispute);

  logAudit(req.user.id, 'DISPUTE_CREATED', 'Dispute', id, {});
  return success(res, { dispute_id: id });
});

// GET /admin/disputes (authenticate, authorize('ADMIN'))
router.get('/admin/disputes', authenticate, authorize('ADMIN'), (req, res) => {
  let allDisputes = findAll(disputes);

  const { status } = req.query;
  if (status === 'OPEN') {
    allDisputes = allDisputes.filter(d => d.outcome === null);
  } else if (status === 'RESOLVED') {
    allDisputes = allDisputes.filter(d => d.outcome !== null);
  }

  return success(res, allDisputes);
});

// POST /admin/disputes/:id/resolve (authenticate, authorize('ADMIN'))
router.post('/admin/disputes/:id/resolve', authenticate, authorize('ADMIN'), (req, res) => {
  const dispute = disputes.get(req.params.id);

  if (!dispute) {
    return notFound(res, 'Dispute not found');
  }

  const { outcome, trust_score_delta } = req.body;
  
  dispute.outcome = outcome;
  dispute.trust_score_delta = trust_score_delta;
  dispute.resolved_by = req.user.id;
  dispute.resolved_at = Date.now();

  disputes.set(dispute.id, dispute);

  if (trust_score_delta !== 0) {
    // Determine which user to apply the penalty to - based on outcome description or dispute logic
    // For simplicity we might apply it to the reporter, or look up the other party.
    // In a real app we'd need to know who is being penalized.
    // We'll apply it to the reporter for now, or maybe the outcome payload specifies the user.
    // (Specification doesn't specify who gets the delta, only "Apply trust_score_delta to the relevant user")
    const { target_user_id } = req.body;
    if (target_user_id) {
      const user = users.get(target_user_id);
      if (user) {
        user.trust_score = (user.trust_score || 100) + trust_score_delta;
        users.set(user.id, user);
      }
    }
  }

  logAudit(req.user.id, 'DISPUTE_RESOLVED', 'Dispute', dispute.id, {});
  return success(res, { success: true });
});

export default router;

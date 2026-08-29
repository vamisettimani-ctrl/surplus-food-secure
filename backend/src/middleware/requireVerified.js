/**
 * ============================================================================
 * ANNAYOG — Verification Gate Middleware
 * ============================================================================
 * Blocks any user whose verification_status is not 'APPROVED' from
 * accessing write endpoints (listing creation, match acceptance, etc.).
 * Read-only endpoints and verification submission itself are NOT gated.
 *
 * This is the enforcement of the spec rule: "an unverified account is
 * functionally read-only until Admin approves submitted proof."
 * ============================================================================
 */

import { forbidden } from '../utils/envelope.js';

export function requireVerified(req, res, next) {
  if (!req.user) {
    return forbidden(res, 'Authentication required');
  }
  if (req.user.verification_status !== 'APPROVED') {
    return forbidden(
      res,
      `Account verification status is '${req.user.verification_status}'. Only APPROVED accounts can perform this action.`
    );
  }
  next();
}

/**
 * ============================================================================
 * ANNAYOG — Role-Based Authorization Middleware
 * ============================================================================
 * Factory function that returns middleware checking if the authenticated
 * user's role is in the allowed list. Must run AFTER authenticate.js.
 *
 * Usage:  router.post('/listings', authenticate, authorize('RESTAURANT', 'INDIVIDUAL_DONOR'), handler)
 * ============================================================================
 */

import { forbidden } from '../utils/envelope.js';

/**
 * @param  {...string} allowedRoles - Roles permitted to access this route
 * @returns {Function} Express middleware
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return forbidden(res, 'Authentication required before authorization');
    }
    if (!allowedRoles.includes(req.user.role)) {
      return forbidden(res, `Role '${req.user.role}' is not permitted for this action`);
    }
    next();
  };
}

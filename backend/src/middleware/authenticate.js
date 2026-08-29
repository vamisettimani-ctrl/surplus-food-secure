/**
 * ============================================================================
 * ANNAYOG — Authentication Middleware
 * ============================================================================
 * Runs on every protected route. Extracts the JWT from the Authorization
 * header, verifies it, and then re-reads the user from the in-memory
 * store to get the REAL-TIME role and verification_status (not just
 * the cached token payload). This ensures that an Admin suspension
 * takes effect immediately, not after the token expires.
 *
 * Attaches `req.user` with the full user record for downstream use.
 * ============================================================================
 */

import { verifyAccessToken } from '../utils/jwt.js';
import { users }             from '../store/index.js';
import { unauthorized }      from '../utils/envelope.js';

export function authenticate(req, res, next) {
  try {
    // 1. Extract token from "Bearer <token>" header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'Missing or malformed Authorization header');
    }
    const token = authHeader.split(' ')[1];

    // 2. Verify JWT signature and expiry
    const decoded = verifyAccessToken(token);

    // 3. Re-read user from store for real-time status (suspension, role change)
    const user = users.get(decoded.user_id);
    if (!user) {
      return unauthorized(res, 'User account not found');
    }
    if (user.suspended) {
      return unauthorized(res, 'Account has been suspended');
    }

    // 4. Attach full user record to request
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Access token expired');
    }
    return unauthorized(res, 'Invalid access token');
  }
}

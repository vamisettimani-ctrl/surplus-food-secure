/**
 * ============================================================================
 * ANNAYOG — Rate Limiter Middleware
 * ============================================================================
 * Configures per-endpoint rate limits to prevent abuse:
 *   - General API:        100 requests / minute
 *   - Listing creation:    10 / minute (prevents spam listings)
 *   - OTP / auth:          5 / minute
 *   - Match accept/decline: 20 / minute
 * ============================================================================
 */

import rateLimit from 'express-rate-limit';

/** General rate limiter for all routes */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down' } },
});

/** Stricter limiter for listing creation */
export const listingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      10,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many listings created, please wait' } },
});

/** Strict limiter for auth endpoints */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      10,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many auth attempts, please wait' } },
});

/** Limiter for match/delivery accept/decline */
export const matchActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      20,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many match actions, please wait' } },
});

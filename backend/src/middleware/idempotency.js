/**
 * ============================================================================
 * ANNAYOG — Idempotency Middleware
 * ============================================================================
 * Checks for an `Idempotency-Key` header on mutation endpoints
 * (match accept/decline, delivery accept/decline). If the same key
 * has been seen before, returns the cached response instead of
 * re-executing the handler. Prevents double-booking from flaky
 * mobile network double-taps.
 * ============================================================================
 */

import { idempotencyKeys } from '../store/index.js';

export function idempotency(req, res, next) {
  const key = req.headers['idempotency-key'];

  // If no idempotency key provided, proceed normally
  if (!key) return next();

  // Check if this key was already processed
  const cached = idempotencyKeys.get(key);
  if (cached) {
    return res.status(200).json(cached.response);
  }

  // Monkey-patch res.json to capture the response for caching
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Only cache successful responses (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyKeys.set(key, {
        response:   body,
        created_at: new Date().toISOString(),
      });
    }
    return originalJson(body);
  };

  next();
}

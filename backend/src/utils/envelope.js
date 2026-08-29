/**
 * ============================================================================
 * ANNAYOG — Standard API Response Envelope
 * ============================================================================
 * Every response from the API uses one of these two shapes:
 *   Success → { data: <payload> }
 *   Error   → { error: { code: "ERROR_CODE", message: "Human-readable" } }
 *
 * This keeps frontend parsing uniform — the axios interceptor in the
 * frontend already expects response.data to contain the envelope.
 * ============================================================================
 */

/** Wrap a successful payload in the standard envelope */
export function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({ data });
}

/** Wrap an error in the standard envelope */
export function error(res, statusCode, code, message) {
  return res.status(statusCode).json({
    error: { code, message },
  });
}

/** 400 Bad Request */
export const badRequest = (res, message, code = 'BAD_REQUEST') =>
  error(res, 400, code, message);

/** 401 Unauthorized */
export const unauthorized = (res, message = 'Authentication required') =>
  error(res, 401, 'UNAUTHORIZED', message);

/** 403 Forbidden */
export const forbidden = (res, message = 'You do not have permission') =>
  error(res, 403, 'FORBIDDEN', message);

/** 404 Not Found */
export const notFound = (res, message = 'Resource not found') =>
  error(res, 404, 'NOT_FOUND', message);

/** 409 Conflict */
export const conflict = (res, message) =>
  error(res, 409, 'CONFLICT', message);

/** 429 Too Many Requests */
export const tooMany = (res, message = 'Rate limit exceeded') =>
  error(res, 429, 'RATE_LIMITED', message);

/** 500 Internal Server Error */
export const serverError = (res, message = 'Internal server error') =>
  error(res, 500, 'INTERNAL_ERROR', message);

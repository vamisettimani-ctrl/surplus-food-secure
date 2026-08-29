/**
 * ============================================================================
 * ANNAYOG — Global Error Handler
 * ============================================================================
 * Catches any unhandled errors in route handlers and returns a clean
 * error envelope. Prevents stack traces from leaking to clients.
 * ============================================================================
 */

export function errorHandler(err, req, res, _next) {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);

  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: {
        code:    'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues,
      },
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: err.message },
    });
  }

  // Default 500
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    error: {
      code:    err.code || 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
    },
  });
}

/**
 * ============================================================================
 * ANNAYOG — Zod Validation Middleware
 * ============================================================================
 * Factory that takes a Zod schema and returns middleware that validates
 * req.body against it. Rejects with 400 + detailed field errors on failure.
 *
 * Usage:  router.post('/listings', validate(createListingSchema), handler)
 * ============================================================================
 */

import { badRequest } from '../utils/envelope.js';

/**
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fieldErrors = result.error.issues.map((issue) => ({
        field:   issue.path.join('.'),
        message: issue.message,
      }));
      return badRequest(res, 'Validation failed', 'VALIDATION_ERROR');
    }
    // Replace req.body with the parsed/cleaned data (strips unknown fields)
    req.body = result.data;
    next();
  };
}

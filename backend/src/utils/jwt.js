/**
 * ============================================================================
 * ANNAYOG — JWT Token Utilities
 * ============================================================================
 * Handles generation and verification of access tokens (short-lived, 15 min)
 * and refresh tokens (longer-lived, 7 days). The access token payload
 * embeds user_id, role, and verification_status so middleware can enforce
 * RBAC without a DB call on every request — but sensitive endpoints still
 * re-check the DB (in-memory store) for real-time suspension detection.
 * ============================================================================
 */

import jwt from 'jsonwebtoken';

const ACCESS_SECRET  = process.env.JWT_SECRET         || 'dev-access-secret-change-me';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET  || 'dev-refresh-secret-change-me';
const ACCESS_EXPIRY  = '15m';
const REFRESH_EXPIRY = '7d';

/**
 * Generate an access token embedding the user's core identity claims.
 * @param {Object} user - User record from the store
 * @returns {string} Signed JWT access token
 */
export function generateAccessToken(user) {
  return jwt.sign(
    {
      user_id:             user.id,
      email:               user.email,
      role:                user.role,
      verification_status: user.verification_status,
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRY }
  );
}

/**
 * Generate a refresh token (contains only user_id).
 * @param {Object} user - User record from the store
 * @returns {string} Signed JWT refresh token
 */
export function generateRefreshToken(user) {
  return jwt.sign(
    { user_id: user.id },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRY }
  );
}

/**
 * Verify and decode an access token.
 * @param {string} token
 * @returns {Object} Decoded payload
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/**
 * Verify and decode a refresh token.
 * @param {string} token
 * @returns {Object} Decoded payload
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

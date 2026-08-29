/**
 * ============================================================================
 * ANNAYOG — Auth & Session Routes
 * ============================================================================
 * Handles Google OAuth login, one-time role selection, token refresh,
 * and logout. These are the first endpoints a new user interacts with.
 *
 * Flow:
 *   1. POST /auth/google/callback  →  exchange Google code for JWT tokens
 *   2. POST /auth/role             →  one-time role selection
 *   3. POST /auth/refresh          →  rotate expired access token
 *   4. POST /auth/logout           →  invalidate refresh tokens
 * ============================================================================
 */

import express from 'express';
import { users, refreshTokens, newId, findUserByGoogleSub, restaurantProfiles, verificationDocs } from '../store/index.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { exchangeGoogleCode } from '../utils/google.js';
import { success, badRequest, unauthorized, conflict, serverError } from '../utils/envelope.js';
import { logAudit } from '../services/audit.js';
import { authenticate } from '../middleware/authenticate.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// ── POST /auth/google/callback ──────────────────────────────────────────────
// Exchanges Google auth code for our JWT tokens. Creates user on first login.
router.post('/auth/google/callback', authLimiter, async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;
    if (!code || !redirect_uri) {
      return badRequest(res, 'Missing code or redirect_uri');
    }

    // Exchange auth code with Google for user profile
    const profile = await exchangeGoogleCode(code, redirect_uri);

    // Find existing user or create new one
    let user = findUserByGoogleSub(profile.sub);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = {
        id:                  newId(),
        google_sub:          profile.sub,
        email:               profile.email,
        name:                profile.name,
        picture:             profile.picture,
        role:                null,              // Must select role next
        verification_status: 'PENDING_VERIFICATION',
        trust_score:         100,
        suspended:           false,
        created_at:          new Date().toISOString(),
      };
      users.set(user.id, user);
    }

    // Auto-promote specific emails to ADMIN for hackathon convenience
    if (user.email === 'durgasravan21@gmail.com' || user.email === 'admin@annayog.app') {
      user.role = 'ADMIN';
      user.verification_status = 'APPROVED';
      users.set(user.id, user);
    }

    // Auto-approve and seed verification for specific emails for hackathon testing
    if (user.email === 'challagollasridevi@gmail.com') {
      user.role = 'RESTAURANT';
      user.verification_status = 'APPROVED';
      users.set(user.id, user);

      // Create a mock verification document if it doesn't exist
      const existingDoc = Array.from(verificationDocs.values()).find(d => d.user_id === user.id);
      if (!existingDoc) {
        const docId = newId();
        verificationDocs.set(docId, {
          id: docId,
          user_id: user.id,
          doc_type: 'FSSAI_LICENSE',
          file_url: 'http://localhost:5000/uploads/default_license.pdf',
          license_no: '12345678901234',
          status: 'APPROVED',
          submitted_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
          reviewed_by: 'system'
        });
      }

      // Create a mock restaurant profile if it doesn't exist
      if (!restaurantProfiles.has(user.id)) {
        restaurantProfiles.set(user.id, {
          user_id: user.id,
          business_name: 'Sridevi Restaurant',
          license_no: '12345678901234',
          address: 'Hyderabad, India',
          lat: 17.3850,
          lng: 78.4867,
          verified_doc_url: 'http://localhost:5000/uploads/default_license.pdf'
        });
      }
    }

    // Generate JWT tokens
    const access_token  = generateAccessToken(user);
    const refresh_token = generateRefreshToken(user);

    // Store refresh token for later validation
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    refreshTokens.set(refresh_token, {
      user_id:    user.id,
      expires_at: expiresAt.toISOString(),
    });

    logAudit(user.id, 'USER_LOGIN', 'User', user.id, { is_new_user: isNewUser });

    return success(res, {
      access_token,
      refresh_token,
      requires_role_selection: !user.role,
      role:                user.role,
      verification_status: user.verification_status,
      email:               user.email,
      name:                user.name,
      picture:             user.picture,
      user_id:             user.id,
    });
  } catch (err) {
    console.error('[Auth] Google callback error:', err.message);
    return serverError(res, 'Authentication failed: ' + err.message);
  }
});

// ── POST /auth/role ─────────────────────────────────────────────────────────
// One-time role selection. Cannot be changed by the user after setting.
router.post('/auth/role', authenticate, async (req, res) => {
  try {
    const { role } = req.body;
    const user = users.get(req.user.id);
    if (!user) return badRequest(res, 'User not found');

    // Prevent role re-selection
    if (user.role) {
      return conflict(res, 'Role already selected. Contact admin to change.');
    }

    // Validate role value
    const ALLOWED_ROLES = ['RESTAURANT', 'INDIVIDUAL_DONOR', 'NGO', 'DELIVERY_PARTNER'];
    if (!ALLOWED_ROLES.includes(role)) {
      return badRequest(res, `Invalid role. Must be one of: ${ALLOWED_ROLES.join(', ')}`);
    }

    user.role = role;
    user.verification_status = 'PENDING_VERIFICATION';
    users.set(user.id, user);

    logAudit(user.id, 'ROLE_SELECTED', 'User', user.id, { role });

    return success(res, {
      role:                user.role,
      verification_status: user.verification_status,
    });
  } catch (err) {
    return serverError(res, err.message);
  }
});

// ── POST /auth/refresh ──────────────────────────────────────────────────────
// Rotate refresh token and issue new access token.
router.post('/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return badRequest(res, 'Refresh token required');
    }

    // Verify JWT signature
    let decoded;
    try {
      decoded = verifyRefreshToken(refresh_token);
    } catch {
      return unauthorized(res, 'Invalid or expired refresh token');
    }

    // Check token is in our store
    const tokenData = refreshTokens.get(refresh_token);
    if (!tokenData || tokenData.user_id !== decoded.user_id) {
      return unauthorized(res, 'Refresh token not recognised');
    }

    // Rotate: delete old, issue new
    refreshTokens.delete(refresh_token);

    const user = users.get(decoded.user_id);
    if (!user) return unauthorized(res, 'User not found');

    const new_access_token  = generateAccessToken(user);
    const new_refresh_token = generateRefreshToken(user);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    refreshTokens.set(new_refresh_token, {
      user_id:    user.id,
      expires_at: expiresAt.toISOString(),
    });

    return success(res, {
      access_token:  new_access_token,
      refresh_token: new_refresh_token,
    });
  } catch (err) {
    return serverError(res, err.message);
  }
});

// ── POST /auth/logout ───────────────────────────────────────────────────────
// Invalidate all refresh tokens for this user.
router.post('/auth/logout', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Remove all refresh tokens for this user
    for (const [token, data] of refreshTokens.entries()) {
      if (data.user_id === userId) {
        refreshTokens.delete(token);
      }
    }

    logAudit(userId, 'USER_LOGOUT', 'User', userId);

    return success(res, { success: true });
  } catch (err) {
    return serverError(res, err.message);
  }
});

export default router;

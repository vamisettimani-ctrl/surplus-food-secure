/**
 * ============================================================================
 * ANNAYOG — Google OAuth 2.0 Utilities
 * ============================================================================
 * Exchanges the authorization code the frontend sends after the Google
 * consent screen for Google's ID token + profile info.
 *
 * Flow:
 *   1. Frontend redirects user to Google's consent screen.
 *   2. Google redirects back to /oauth/callback with a `code`.
 *   3. Frontend sends that `code` + `redirect_uri` to our
 *      POST /auth/google/callback.
 *   4. This module exchanges the code with Google for tokens,
 *      verifies the ID token, and returns the user's Google profile.
 * ============================================================================
 */

import { OAuth2Client } from 'google-auth-library';

/**
 * Exchange Google authorization code for user profile data.
 *
 * @param {string} code         - Authorization code from Google consent screen
 * @param {string} redirectUri  - Must match the redirect_uri used in the consent screen
 * @returns {Promise<Object>}   - { sub, email, name, picture }
 */
export async function exchangeGoogleCode(code, redirectUri) {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables.'
    );
  }

  const client = new OAuth2Client(clientId, clientSecret, redirectUri);

  // Exchange auth code for tokens
  const { tokens } = await client.getToken(code);

  // Verify the ID token and extract the payload
  const ticket = await client.verifyIdToken({
    idToken:  tokens.id_token,
    audience: clientId,
  });

  const payload = ticket.getPayload();

  return {
    sub:     payload.sub,           // Google unique user ID
    email:   payload.email,         // User's email address
    name:    payload.name || '',    // Display name
    picture: payload.picture || '', // Profile photo URL
  };
}

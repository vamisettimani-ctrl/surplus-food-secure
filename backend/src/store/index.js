/**
 * ============================================================================
 * ANNAYOG — In-Memory Data Store
 * ============================================================================
 * Provides Maps that act as database tables. Each Map is keyed by the
 * entity's `id` (UUID string). A real database can replace each Map
 * with ORM calls later — the route handlers use the helper functions
 * below, so the swap is a single-file change.
 *
 * This file is the ONLY place data lives at runtime. Every route
 * imports from here.
 * ============================================================================
 */

import { v4 as uuidv4 } from 'uuid';

// ── "Tables" ────────────────────────────────────────────────────────────────
export const users             = new Map();   // id → User
export const restaurantProfiles = new Map();  // user_id → RestaurantProfile
export const ngoProfiles       = new Map();   // user_id → NGOProfile
export const deliveryPartnerProfiles = new Map(); // user_id → DeliveryPartnerProfile
export const verificationDocs  = new Map();   // id → VerificationDocument
export const listings          = new Map();   // id → Listing
export const matchAttempts     = new Map();   // id → MatchAttempt
export const deliveryAssignments = new Map(); // id → DeliveryAssignment
export const disputes          = new Map();   // id → Dispute
export const auditLogs         = new Map();   // id → AuditLog
export const refreshTokens     = new Map();   // token_hash → { user_id, expires_at }
export const idempotencyKeys   = new Map();   // key → { response, created_at }

// ── Index helpers (simulate DB queries) ─────────────────────────────────────

/** Generate a new UUID primary key */
export const newId = () => uuidv4();

/** Find a user by their Google `sub` claim (unique identity anchor) */
export function findUserByGoogleSub(sub) {
  for (const user of users.values()) {
    if (user.google_sub === sub) return user;
  }
  return null;
}

/** Find a user by email */
export function findUserByEmail(email) {
  for (const user of users.values()) {
    if (user.email === email) return user;
  }
  return null;
}

/** Get all entries from a Map as an array, optionally filtered */
export function findAll(map, filterFn = () => true) {
  return Array.from(map.values()).filter(filterFn);
}

/** Get entries sorted by a numeric field (ascending) */
export function findAllSorted(map, filterFn, sortField) {
  return findAll(map, filterFn).sort((a, b) => (a[sortField] ?? 0) - (b[sortField] ?? 0));
}

/** Count entries matching a filter */
export function countWhere(map, filterFn) {
  return findAll(map, filterFn).length;
}

/**
 * Atomic conditional update — simulates `UPDATE ... WHERE status = ?`
 * Returns true if the update was applied (row existed and condition was met),
 * false otherwise. This prevents race conditions on state transitions.
 */
export function conditionalUpdate(map, id, conditionFn, updateFn) {
  const record = map.get(id);
  if (!record) return false;
  if (!conditionFn(record)) return false;
  updateFn(record);
  map.set(id, record);
  return true;
}

// ── Seed admin account ──────────────────────────────────────────────────────
const ADMIN_ID = 'admin-seed-001';
users.set(ADMIN_ID, {
  id: ADMIN_ID,
  google_sub: 'admin-google-sub',
  email: 'admin@annayog.app',
  name: 'Platform Admin',
  role: 'ADMIN',
  verification_status: 'APPROVED',
  trust_score: 100,
  suspended: false,
  created_at: new Date().toISOString(),
});

console.log('[Store] In-memory data store initialised with seeded admin.');

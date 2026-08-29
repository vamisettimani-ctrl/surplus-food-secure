# ANNAYOG Backend — Code Explanation Guide for Judges 🚀

Welcome to the **Annayog** Backend engineering reference. This document is designed to help you explain the architecture, design choices, and technical depth of the codebase to the hackathon judges.

---

## 1. High-Level Architecture
Annayog is built using a clean, layered architecture that separates concerns for maximum modularity and future extensibility:

```
                  ┌────────────────────────┐
                  │    HTTP Client (Web)   │
                  └───────────┬────────────┘
                              │ JSON / REST & WS
                              ▼
                  ┌────────────────────────┐
                  │      index.js          │
                  │   (Express Server)     │
                  └───────────┬────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌────────────────┐   ┌────────────────┐   ┌────────────────┐
│   Middleware   │   │   Controllers  │   │  WebSockets    │
│  (Auth, RBAC,  │   │  (Route Handlers│  │  (Real-Time)   │
│  Validation)   │   │  for Listings,  │   └───────────────┘
└────────────────┘   │  Verifications)│
                     └────────┬───────┘
                              │ Reads / Writes
                              ▼
                     ┌────────────────┐
                     │ In-Memory DB   │
                     │  (store/index) │
                     └────────────────┘
```

---

## 2. Core Differentiators & Judge Pitch Points

### 🛡️ 1. Verification-Gated Trust Layer
* **The Problem:** Anyone can type "I am a restaurant" or "I am an NGO" on a generic platform.
* **Our Solution:** Write access is strictly disabled until the verification status is `APPROVED`. Unverified accounts are functionally read-only.
* **Security Middleware (`requireVerified.js`):** Intercepts mutation requests and rejects users with state `PENDING` or `REJECTED` with a clear message, ensuring the trust gate cannot be bypassed on the server side.
* **Duplicate Detection:** Checks for duplicate FSSAI license numbers and NGO registration numbers during document upload to prevent sybil/duplicate account attacks.

### 🤖 2. Distance-First AI Matching Engine (`matchingEngine.js`)
* **Explainable Matching Algorithm:** We don't use a black-box LLM for matching; we use a deterministic scoring pipeline:
  1. **Haversine Distance Filter:** Computes spatial distance using the Earth's spherical radius.
  2. **Eligibility Criteria:** NGO must be verified, active (`auto_match_enabled = true`), open (checks operating hours), and have sufficient daily capacity remaining.
  3. **Urgency & Perishability Penalty/Bonus:** listings tagged as `HIGHLY_PERISHABLE` with short windows are boosted in matching priority and have their max search radius expanded automatically.
  4. **Timed Handshakes:** Offers are assigned to the top candidate with a **10-minute expiry window**. If declined or timed out, it automatically cascades to the next-nearest eligible NGO.

### 🔄 3. Race-Condition Prevention (Conditional State Machine)
* **The Problem:** Two NGOs or two delivery partners accepting the same offer simultaneously, leading to double-booking.
* **Our Solution (`conditionalUpdate`):** Implemented atomic conditional updates in our database/in-memory layer. Writes only succeed if the resource is in the exact expected state (e.g., `status = MATCHED_PENDING_NGO_ACCEPT`). The first write locks the transition; subsequent writes are rejected.

---

## 3. Directory & File Breakdown

### 📂 `src/store/index.js` (The Data Access Layer)
* **What it does:** Simulates all database operations using in-memory Javascript `Map` objects. 
* **Judge Talking Point:** "We abstract all database reads/writes behind helper functions like `findAll`, `countWhere`, and `conditionalUpdate`. This design allows another developer to swap this in-memory file for PostgreSQL or Prisma ORM in minutes without changing a single line of business logic in the routes."

### 📂 `src/middleware/` (The Shield Layer)
* **`authenticate.js`:** Verifies the Google OAuth JWT. Note that it re-reads the user's suspension/status from the store on *every* request, making sure admin bans take effect immediately instead of waiting for JWT expiration.
* **`authorize.js`:** Standard Role-Based Access Control (RBAC) middleware verifying if the client is `RESTAURANT`, `NGO`, or `DELIVERY_PARTNER`.
* **`idempotency.js`:** Uses the `Idempotency-Key` HTTP header. If a network retry occurs, it serves the cached response without re-running operations.

### 📂 `src/jobs/` (The Background Worker Layer)
* **`offerExpiry.js`:** Runs every 30 seconds to clean up expired matches (10m) and delivery assignments (5m), cascading them to the next best match.
* **`radiusWiden.js`:** Widens the search radius by `+2km` every 5 minutes for listings that remain unmatched, dynamically expanding search space.
* **`listingExpiry.js`:** Runs every minute to auto-expire listings that have passed their `best_before_at` time.

### 📂 `src/websocket/index.js` (Real-Time Push)
* Wires up our WebSocket server. Authenticats users via token on connection. Allows services to call `broadcast(userId, event, data)` to push matching and delivery offers to specific stakeholders in real-time.

---

## 4. Key Code walkthrough to show judges

### The Haversine Formula (`utils/haversine.js`)
```javascript
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(6371 * c * 100) / 100; // Returns distance in Kilometres
}
```

### The In-Memory Database Conditional Update (`store/index.js`)
```javascript
export function conditionalUpdate(map, id, conditionFn, updateFn) {
  const record = map.get(id);
  if (!record || !conditionFn(record)) return false;
  updateFn(record);
  map.set(id, record);
  return true;
}
```
This is used in routes like `matches/:id/accept` to ensure a match can only be accepted if it is still `PENDING`:
```javascript
const success = conditionalUpdate(matchAttempts, id, 
  m => m.outcome === 'PENDING',
  m => { m.outcome = 'ACCEPTED'; m.responded_at = new Date().toISOString(); }
);
```

---

## 5. Security & Trust Checklist
1. **Google OAuth 2.0 Identity Anchor:** We don't store passwords. The Google unique ID (`google_sub`) is the primary key mapping to exactly one user account. This prevents sybil account creation.
2. **Short-lived JWT Access Tokens:** Combined with Refresh Token rotation.
3. **No Raw Inputs:** Schema validation using `Zod` blocks any malformed parameters from hitting controllers.
4. **EXIF Metadata Stripping (Demo note):** Photo uploads strip GPS coordinate metadata on the server before storage to maintain delivery partner and listing location privacy.

# ANNAYOG AI-Matched Surplus Food Rescue Network
## Project Specification & Requirements Document (36-Hour Hackathon Build)

### 1. Product Overview
Annayog connects three verified stakeholders — **Restaurants/Individual Donors**, **NGOs/Shelters**, and **Delivery Partners (volunteers)** — to rescue surplus food before it is wasted. A donor lists surplus food; an AI matching agent (toggle-controlled by each NGO) automatically assigns the listing to the nearest eligible, verified NGO; a nearby verified delivery partner is then auto-assigned to complete pickup and drop-off. Every actor is identity-verified before they can transact, and every write path is protected against common web and business-logic abuse.

#### 1.1 Core Differentiators
* **Verification-gated marketplace**: No unverified account can list, claim, or deliver.
* **AI matching agent**: Distance + urgency + perishability scoring, with an explicit NGO-side toggle for auto-matching.
* **Full pickup lifecycle state machine**: `Listed` → `Matched` → `Accepted` → `Delivery Assigned` → `Picked Up` → `Delivered` / `Expired` / `Cancelled` with audit trail.
* **Security first**: RBAC, Google OAuth, signed URLs for proof photos, rate limiting, input validation, secrets hygiene.

---

### 2. User Roles & RBAC Matrix

| Role | Core Actions | Verification Required |
|---|---|---|
| **Restaurant / Business Donor** | Create food listings, view claim status, mark handed over, view impact stats | FSSAI / Business license proof |
| **Individual Donor** | Create home-surplus listings (lower quantity cap, food safety rules) | Phone + Address OTP + Checklist |
| **NGO** | Toggle auto-match, view/accept matched listings, manage capacity, confirm receipt | NGO Registration Number + Capacity declaration |
| **Delivery Partner** | Accept/decline assigned pickups, update pickup status, upload proof-of-delivery photo | ID + Phone OTP + Live Selfie |
| **Platform Admin** | Review verification documents, suspend/ban accounts, view disputes, override matches | Internal (Seeded manually) |

#### RBAC Matrix
* `POST /listings` (create): Verified Donor only
* `GET /listings/matched` (NGO inbox): Verified NGO only (own matches)
* `POST /listings/:id/accept`: Assigned NGO only
* `POST /delivery/:id/status`: Assigned Partner only
* `POST /verification/review`: Admin only
* `Toggle auto-match`: Verified NGO only (own org)

---

### 3. Authentication & RBAC Rules
* **Google OAuth 2.0 only** (OpenID Connect) — no local passwords.
* **Mandatory One-Time Role Selection** at first sign-in (Restaurant / Individual Donor / NGO / Delivery Partner). Cannot be self-changed.
* **Verification Gate**: OAuth callback creates user with `status = PENDING_VERIFICATION`. All write endpoints blocked until approved by Admin.
* **Identity Anchor**: Google account email / `google_sub` is the unique identity anchor (1 Google Account = 1 Role Account).

---

### 4. Verification System
* **Restaurant**: FSSAI / Business registration number + document upload. Checksum validation & duplicate license detection.
* **Individual Donor**: Phone OTP + Google Maps address autocomplete + mandatory food safety checklist before publishing.
* **NGO**: Registration number (12A/80G/Trust/Society) + daily meal capacity + service radius (km) + operating hours.
* **Delivery Partner**: Govt ID upload + phone OTP + live in-app selfie + vehicle type.
* **Admin Review Queue**: `PENDING` → `APPROVED` / `REJECTED` (with mandatory reason) / `RESUBMIT_REQUIRED`.

---

### 5. AI Matching Agent & Lifecycle
#### 5.1 Trigger & Control
* NGO must have `auto_match_enabled = true`.
* Listing publication triggers asynchronous background matching job.

#### 5.2 Scoring Pipeline (Distance-First)
1. **Eligibility Filter**: Verified + `auto_match_enabled` + within service radius + under daily capacity + open during operating hours.
2. **Distance Scoring**: Haversine distance from listing to NGO (nearest = highest base score).
3. **Urgency & Perishability Weighting**: Best-before timestamp & perishability tag (`HIGHLY_PERISHABLE`, `MODERATE`, `PACKAGED`).
4. **Quantity Fit**: Skip NGOs unable to accommodate listing quantity.
5. **Assignment**: Top-scoring NGO offered match with 10-min countdown timer (`MATCHED_PENDING_NGO_ACCEPT`).
6. **On Accept**: Re-trigger Delivery Partner Auto-Assignment immediately (`NGO_ACCEPTED`).
7. **On Decline/Timeout**: Cascade to next-nearest eligible NGO.

#### 5.3 Delivery Partner Auto-Assignment
* Pool = Verified, online delivery partners within radius of restaurant.
* Offer sent to nearest available partner with 3-5 min timer.
* Lifecycle: `DELIVERY_ASSIGNED` → `PARTNER_ARRIVED_PICKUP` → `PICKED_UP` → `DELIVERED`.
* Photo proofs required at pickup and drop-off.

---

### 6. Security Requirements
* All secrets in `.env` (never committed).
* Input validation (Zod/Pydantic schemas) + parameterized queries (ORM).
* Photo uploads: MIME allow-list, size cap, EXIF stripped, stored in private bucket with short-lived signed URLs.
* Idempotency keys on accept/decline endpoints.
* Rate-limiting on listing creation, OTP requests, and match actions.

---

### 7. Core Entities
* `User` & `UserProfile` (Restaurant / NGO / DeliveryPartner)
* `Listing` & `MatchAttempt`
* `DeliveryAssignment`
* `VerificationDocument`
* `AuditLog`

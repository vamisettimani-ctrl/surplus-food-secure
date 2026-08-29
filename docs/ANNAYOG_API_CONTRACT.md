# Annayog API Contract — AI-Matched Surplus Food Rescue Network
## Engineering Reference (v1.0, Hackathon Build) — Team Annayog, August 2026

### Table of Contents
0. How To Use This Document
1. Conventions
   1.1 Base URL & Versioning
   1.2 Authentication
   1.3 Standard Response Envelope
   1.4 HTTP Status Codes Used
   1.5 Pagination
   1.6 Timestamps & IDs
   1.7 Idempotency
   1.8 Error Code Registry
2. Auth & Session
   2.1 POST /auth/google/callback
   2.2 POST /auth/role (one-time role selection)
   2.3 POST /auth/refresh
   2.4 POST /auth/logout
   2.5 JWT Payload Shape
3. RBAC Middleware Contract
   3.1 Middleware Order
   3.2 RBAC Matrix (authoritative)
4. Verification
   4.1 POST /verification/submit
   4.2 GET /verification/me
   4.3 POST /verification/:id/review (Admin only)
   4.4 GET /admin/verification/queue (Admin only)
5. Listings
   5.1 State Machine
   5.2 POST /listings
   5.3 GET /listings/mine
   5.4 GET /listings/:id
   5.5 POST /listings/:id/cancel
   5.6 GET /listings/board (manual browse)
   5.7 POST /listings/:id/claim (manual claim from board)
6. AI Matching Engine
   6.1 Internal Job Contract
   6.2 GET /listings/matched (NGO inbox)
   6.3 POST /matches/:id/accept
   6.4 POST /matches/:id/decline
   6.5 Delivery Partner Auto-Assignment
   6.6 GET /delivery-offers/pending (Delivery Partner)
   6.7 POST /delivery-offers/:id/accept / .../decline
   6.8 PATCH /ngo/auto-match
   6.9 Radius Auto-Widen (background job)
7. Delivery Lifecycle
   7.1 State Machine
   7.2 POST /delivery/:id/status
   7.3 POST /delivery/:id/photo
   7.4 POST /delivery/:id/no-show
   7.5 POST /delivery/:id/self-arrange
   7.6 POST /listings/:id/confirm-receipt
8. Disputes & Trust
   8.1 POST /disputes
   8.2 GET /admin/disputes
   8.3 POST /admin/disputes/:id/resolve
9. Cross-Cutting Endpoints
   9.1 GET /stats/impact
   9.2 GET /admin/dashboard
   9.3 POST /uploads/presign
   9.4 POST /admin/users/:id/suspend / .../reinstate
   9.5 PATCH /admin/users/:id/role
   9.6 POST /admin/matches/:id/override
10. Realtime Events (WebSocket)
    10.1 Email/SMS Fallback Rule
11. Rate Limits
12. Data Model Reference
13. Non-Negotiable Security Checklist
14. Change Log

---

### 0. How To Use This Document
This is the single source of truth for every request/response shape, status code, field name, and enum value in the Annayog backend. It exists so that frontend, backend, and matching-engine work can proceed in parallel without breaking each other.

#### Rules for the team:
1. If it’s not in this contract, don’t ship it — add it here first, then build it.
2. Field names, casing (`snake_case` for JSON keys), and enum values below are final unless changed in this document.
3. Any breaking change to a shape already in use gets a new version note in Section 14, not a silent edit.
4. Mock servers / frontend stubs should return the exact example JSON shown per endpoint so integration is seamless on demo day.

---

### 1. Conventions

#### 1.1 Base URL & Versioning
* Base URL: `https://api.annayog.app/v1`
* WebSocket URL: `wss://api.annayog.app/v1/ws`
All routes are relative to the base URL. The `v1` prefix is fixed for the hackathon.

#### 1.2 Authentication
Every request except `POST /auth/google/callback` and `GET /health` requires:
```http
Authorization: Bearer <access_token>
```
`access_token` is a short-lived JWT issued after Google OAuth exchange.

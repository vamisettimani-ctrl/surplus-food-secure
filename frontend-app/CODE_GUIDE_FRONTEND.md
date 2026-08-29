# ANNAYOG Frontend — Code Explanation Guide for Judges 🎨

This guide explains the architecture, directory structure, and key files of the React/Vite frontend. Use this reference to answer judges' questions about user flows, state management, API integration, and real-time WebSockets.

---

## 1. High-Level Directory Structure

```
frontend-app/src/
├── main.jsx                 # Entry point (initialises React & Google Auth)
├── App.jsx                  # Main router (defines all pages and layout routes)
├── style.css                # Global base styles & theme variables
├── config/
│   └── constants.js         # Global enums (ROLES, STATUSES, PERISHABILITY)
├── context/
│   └── AuthContext.jsx      # Global state for Authentication & User session
├── services/                # API layer (Axios clients)
│   ├── api.js               # Central Axios client with JWT refresh interceptors
│   ├── auth.js              # Auth endpoints
│   ├── listings.js          # Listing creation/retrieval endpoints
│   ├── matching.js          # NGOs acceptance/declination endpoints
│   ├── delivery.js          # Delivery partner updates
│   ├── verification.js      # User verification submissions & admin queue
│   └── websocket.js         # Real-time WebSocket connection manager
├── hooks/                   # Custom React hooks
│   ├── useCountdown.js      # Countdown timer for matching/delivery offers
│   └── useWebSocket.js      # Socket connection subscriber
└── pages/                   # Views & Interfaces
    ├── LoginPage.jsx        # Login page (Google Sign-In)
    ├── SelectRolePage.jsx   # Select User Role page (NGO, Restaurant, Delivery)
    ├── VerificationSubmitPage.jsx # Document submission page
    ├── VerificationPendingPage.jsx # Verification pending screen
    ├── DonorDashboard.jsx   # Donor Panel (List surplus food)
    ├── NGODashboard.jsx     # NGO Panel (Claim and accept matches)
    ├── DeliveryOffersPage.jsx # Delivery Partner Panel (Accept delivery tasks)
    └── AdminDashboardPage.jsx # Administrator dashboard (verification queue)
```

---

## 2. Core Frontend Workflows (Step-by-Step)

### 🔐 1. Login & Auth Flow (`pages/LoginPage.jsx` & `context/AuthContext.jsx`)
1. The user clicks **"Continue with Google"** which uses the `@react-oauth/google` library.
2. The user consents via Google popup, which returns an **Authorization Code** back to the client.
3. The frontend passes this code to `AuthContext.login()`, which hits `POST /auth/google/callback` on our backend.
4. The backend returns:
   - `access_token` & `refresh_token` (stored securely in `localStorage`)
   - `requires_role_selection` (boolean flag)
5. If the user is new, they are routed to `/select-role` to select their profile type. Otherwise, they go directly to `/dashboard`.

### 📝 2. Role Selection & Route Guards (`App.jsx` & `components/ProtectedRoute.jsx`)
* **Role Selection (`SelectRolePage.jsx`)**: The user selects one of the roles (`RESTAURANT`, `NGO`, `DELIVERY_PARTNER`) and submits. Once chosen, they cannot change their role.
* **Route Guards (`ProtectedRoute.jsx`)**: Intercepts navigation:
  - If the user is not logged in, redirects to `/login`.
  - If the user selected a role but is **unverified**, redirects to `/verification/submit` or `/verification-pending` (restricting access to the core dashboards).
  - If verified, grants access to the dashboard.

### 📝 3. Document Verification (`pages/VerificationSubmitPage.jsx`)
1. User enters their FSSAI license (Restaurant) or NGO Registration number, and uploads a certificate file.
2. **File Upload Integration (`services/uploads.js`)**: 
   - Requests a presigned URL from the backend (`/uploads/presign`).
   - Uses `axios.put` to stream the raw file binary directly to the server.
   - Deduces empty MIME types from file extensions on Windows to prevent browser upload blocks.
3. Submits document metadata payload (`/verification/submit`) and locks the account in `PENDING` state until an admin approves.

### 🤖 4. Real-time Offer Broadcasts (`hooks/useWebSocket.js` & `services/websocket.js`)
* **Connection**: Once authenticated, the frontend opens a WebSocket connection to `ws://localhost:5000/v1/ws?token=ACCESS_TOKEN`.
* **State Updates**:
  - **NGOs** receive real-time notifications (`MATCH_OFFER`) when the backend AI engine matches a listing near them.
  - **Volunteers** receive real-time alerts (`DELIVERY_OFFER`) for pickups.
  - **Donors** receive notifications (`LISTING_STATUS_CHANGED`) when their listing status advances.

---

## 3. Key Architectural Files to Reference

### 🛠️ The Axios Interceptor (`services/api.js`)
Handles automatic **JWT Access Token renewal** completely transparently.
* **The Logic**: If any API request returns a `401 Unauthorized` (indicating the short-lived 15m Access Token has expired), the interceptor halts the request queue, makes a silent call to `POST /auth/refresh` using the `refresh_token`, updates the new tokens in storage, and re-executes the original request without interrupting the user.

### 🔌 WebSocket Client Manager (`services/websocket.js`)
Manages socket connections, heartbeat pings (prevents connection drops), and maintains an event subscriber list so components can hook into real-time events easily.

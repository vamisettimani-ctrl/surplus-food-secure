# Database — Neighborhood Food-Donation Matcher

This folder contains the full database layer for the Surplus Food Secure app,
backed by **PostgreSQL via Supabase**.

---

## Files

| File | Purpose |
|---|---|
| `schema.sql` | `CREATE TABLE` statements — run once to initialise the DB |
| `supabaseClient.js` | Supabase JS client setup (reads env vars) |
| `queries.js` | One exported function per DB operation |
| `seedData.js` | Inserts sample data for development / demo |

---

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Copy the **Project URL** and **anon / public** API key from
   **Settings → API**.

### 2. Set environment variables

```bash
# .env (add to .gitignore — never commit)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
```

Load them however your backend does (e.g. `dotenv`).

### 3. Run the schema

Open the **SQL Editor** in the Supabase dashboard and paste the contents
of `schema.sql`, then click **Run**.

Alternatively, use the Supabase CLI:

```bash
supabase db reset          # if using migrations
# or
psql $DATABASE_URL -f database/schema.sql
```

### 4. Install the dependency

```bash
npm install @supabase/supabase-js
```

### 5. Seed sample data

```bash
node database/seedData.js
```

---

## Field Reference

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `name` | VARCHAR(255) | Required |
| `email` | VARCHAR(255) | Required, unique |
| `password_hash` | VARCHAR(255) | Required |
| `role` | VARCHAR(20) | `donor` · `volunteer` · `ngo` · `admin` |
| `phone` | VARCHAR(20) | Optional |
| `latitude` | DECIMAL(9,6) | Optional |
| `longitude` | DECIMAL(9,6) | Optional |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |

### `food_listings`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `donor_id` | UUID (FK → users) | Required |
| `title` | VARCHAR(255) | Required |
| `description` | TEXT | Optional |
| `quantity` | DECIMAL(10,2) | Required |
| `unit` | VARCHAR(50) | Required |
| `food_type` | VARCHAR(10) | `veg` · `non-veg` · `mixed` |
| `expiry_time` | TIMESTAMPTZ | Required |
| `pickup_address` | TEXT | Required |
| `latitude` | DECIMAL(9,6) | Optional |
| `longitude` | DECIMAL(9,6) | Optional |
| `status` | VARCHAR(20) | `available` · `claimed` · `picked_up` · `expired` |
| `image_url` | TEXT | Optional |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |

**Index:** `idx_food_listings_location_status` on `(latitude, longitude, status)`

### `claims`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `listing_id` | UUID (FK → food_listings) | Required, **UNIQUE** |
| `claimer_id` | UUID (FK → users) | Required |
| `status` | VARCHAR(20) | `pending` · `confirmed` · `completed` · `cancelled` |
| `pickup_time` | TIMESTAMPTZ | Optional |
| `claimed_at` | TIMESTAMPTZ | Default `NOW()` |

> **Constraint:** Only one active claim per listing (`UNIQUE` on `listing_id`).

### `notifications`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `user_id` | UUID (FK → users) | Required |
| `listing_id` | UUID (FK → food_listings) | Nullable |
| `message` | TEXT | Required |
| `is_read` | BOOLEAN | Default `false` |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |

---

## Available Query Functions (`queries.js`)

### Users
- `createUser(fields)` → inserted user
- `getUserById(id)` → user
- `getUserByEmail(email)` → user
- `updateUser(id, updates)` → updated user

### Food Listings
- `createFoodListing(listing)` → inserted listing
- `getFoodListingById(id)` → listing + donor info
- `getListingsByDonor(donorId)` → array
- `getNearbyListings(lat, lng, radiusKm?)` → available listings within radius
- `updateFoodListing(id, updates)` → updated listing
- `deleteFoodListing(id)` → void
- `getAllFoodListings()` → array (admin)

### Claims
- `createClaim({ listing_id, claimer_id, pickup_time })` → claim
- `getClaimById(id)` → claim + listing + claimer
- `getClaimByListing(listingId)` → claim for a listing
- `getClaimsByUser(userId)` → array
- `updateClaim(id, updates)` → updated claim

### Notifications
- `createNotification({ user_id, listing_id, message })` → notification
- `getNotificationsByUser(userId)` → array (newest first)
- `markNotificationRead(id)` → updated notification
- `markAllNotificationsRead(userId)` → array of updated rows

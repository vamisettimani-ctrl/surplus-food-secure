-- ============================================================
-- Neighborhood Food-Donation Matcher — PostgreSQL Schema
-- Target: Supabase (PostgreSQL 15+)
-- ============================================================

-- Enable the uuid-ossp extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------
-- 1. users
-- ----------------------------------------------------------
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(255)  NOT NULL,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    role          VARCHAR(20)   NOT NULL CHECK (role IN ('donor', 'volunteer', 'ngo', 'admin')),
    phone         VARCHAR(20),
    latitude      DECIMAL(9,6),
    longitude     DECIMAL(9,6),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 2. food_listings
-- ----------------------------------------------------------
CREATE TABLE food_listings (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donor_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title          VARCHAR(255)  NOT NULL,
    description    TEXT,
    quantity        DECIMAL(10,2) NOT NULL,
    unit           VARCHAR(50)   NOT NULL,
    food_type      VARCHAR(10)   NOT NULL CHECK (food_type IN ('veg', 'non-veg', 'mixed')),
    expiry_time    TIMESTAMPTZ   NOT NULL,
    pickup_address TEXT          NOT NULL,
    latitude       DECIMAL(9,6),
    longitude      DECIMAL(9,6),
    status         VARCHAR(20)   NOT NULL DEFAULT 'available'
                       CHECK (status IN ('available', 'claimed', 'picked_up', 'expired')),
    image_url      TEXT,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Index for nearby-food queries (lat/lng + status filter)
CREATE INDEX idx_food_listings_location_status
    ON food_listings (latitude, longitude, status);

-- ----------------------------------------------------------
-- 3. claims
-- ----------------------------------------------------------
CREATE TABLE claims (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id  UUID        NOT NULL REFERENCES food_listings(id) ON DELETE CASCADE,
    claimer_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    pickup_time TIMESTAMPTZ,
    claimed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Only one active claim per listing
    CONSTRAINT uq_claims_listing UNIQUE (listing_id)
);

-- ----------------------------------------------------------
-- 4. notifications
-- ----------------------------------------------------------
CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id UUID        REFERENCES food_listings(id) ON DELETE SET NULL,
    message    TEXT        NOT NULL,
    is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick user-notification lookups
CREATE INDEX idx_notifications_user ON notifications (user_id, is_read);

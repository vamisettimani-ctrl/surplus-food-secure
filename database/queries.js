const { supabase } = require("./supabaseClient");

// =============================================================
// USERS
// =============================================================

/** Create a new user and return the inserted row. */
async function createUser({ name, email, password_hash, role, phone, latitude, longitude }) {
  const { data, error } = await supabase
    .from("users")
    .insert({ name, email, password_hash, role, phone, latitude, longitude })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Get a user by their UUID. */
async function getUserById(id) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

/** Get a user by email (login lookup). */
async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();
  if (error) throw error;
  return data;
}

/** Update user profile fields. */
async function updateUser(id, updates) {
  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// =============================================================
// FOOD LISTINGS
// =============================================================

/** Create a new food listing. */
async function createFoodListing(listing) {
  const { data, error } = await supabase
    .from("food_listings")
    .insert(listing)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Get a single food listing by ID. */
async function getFoodListingById(id) {
  const { data, error } = await supabase
    .from("food_listings")
    .select("*, users!donor_id(name, email, phone)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

/** Get all listings created by a specific donor. */
async function getListingsByDonor(donorId) {
  const { data, error } = await supabase
    .from("food_listings")
    .select("*")
    .eq("donor_id", donorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Get nearby available food listings within a bounding box.
 *
 * @param {number} lat      - center latitude
 * @param {number} lng      - center longitude
 * @param {number} radiusKm - search radius in kilometres (approx)
 */
async function getNearbyListings(lat, lng, radiusKm = 5) {
  // ~0.009 degrees ≈ 1 km
  const delta = radiusKm * 0.009;
  const { data, error } = await supabase
    .from("food_listings")
    .select("*, users!donor_id(name, phone)")
    .eq("status", "available")
    .gte("latitude", lat - delta)
    .lte("latitude", lat + delta)
    .gte("longitude", lng - delta)
    .lte("longitude", lng + delta)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Update a listing's status (or other fields). */
async function updateFoodListing(id, updates) {
  const { data, error } = await supabase
    .from("food_listings")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Delete a food listing by ID. */
async function deleteFoodListing(id) {
  const { error } = await supabase
    .from("food_listings")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/** Get all food listings (admin / dashboard use). */
async function getAllFoodListings() {
  const { data, error } = await supabase
    .from("food_listings")
    .select("*, users!donor_id(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// =============================================================
// CLAIMS
// =============================================================

/** Create a claim on a food listing. */
async function createClaim({ listing_id, claimer_id, pickup_time }) {
  const { data, error } = await supabase
    .from("claims")
    .insert({ listing_id, claimer_id, pickup_time })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Get a claim by its ID. */
async function getClaimById(id) {
  const { data, error } = await supabase
    .from("claims")
    .select("*, food_listings(*), users!claimer_id(name, email, phone)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

/** Get the claim for a specific listing. */
async function getClaimByListing(listingId) {
  const { data, error } = await supabase
    .from("claims")
    .select("*, users!claimer_id(name, email, phone)")
    .eq("listing_id", listingId)
    .single();
  if (error) throw error;
  return data;
}

/** Get all claims made by a specific user. */
async function getClaimsByUser(userId) {
  const { data, error } = await supabase
    .from("claims")
    .select("*, food_listings(*)")
    .eq("claimer_id", userId)
    .order("claimed_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Update a claim's status (or pickup_time). */
async function updateClaim(id, updates) {
  const { data, error } = await supabase
    .from("claims")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// =============================================================
// NOTIFICATIONS
// =============================================================

/** Create a notification for a user. */
async function createNotification({ user_id, listing_id, message }) {
  const { data, error } = await supabase
    .from("notifications")
    .insert({ user_id, listing_id, message })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Get all notifications for a user, newest first. */
async function getNotificationsByUser(userId) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Mark a single notification as read. */
async function markNotificationRead(id) {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Mark all notifications for a user as read. */
async function markAllNotificationsRead(userId) {
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false)
    .select();
  if (error) throw error;
  return data;
}

// =============================================================
// EXPORTS
// =============================================================

module.exports = {
  // Users
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,

  // Food Listings
  createFoodListing,
  getFoodListingById,
  getListingsByDonor,
  getNearbyListings,
  updateFoodListing,
  deleteFoodListing,
  getAllFoodListings,

  // Claims
  createClaim,
  getClaimById,
  getClaimByListing,
  getClaimsByUser,
  updateClaim,

  // Notifications
  createNotification,
  getNotificationsByUser,
  markNotificationRead,
  markAllNotificationsRead,
};

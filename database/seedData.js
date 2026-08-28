const { supabase } = require("./supabaseClient");

/**
 * Seed the database with sample data so every frontend screen
 * has real rows to render.
 *
 * Run: node database/seedData.js
 */
async function seed() {
  // -------------------------------------------------------
  // 1. Users — 3 donors, 1 volunteer, 1 ngo
  // -------------------------------------------------------
  const users = [
    {
      name: "Ananya Sharma",
      email: "ananya@example.com",
      password_hash: "$2b$10$placeholder_hash_ananya",
      role: "donor",
      phone: "9876543210",
      latitude: 17.385,
      longitude: 78.4867,
    },
    {
      name: "Ravi Kumar",
      email: "ravi@example.com",
      password_hash: "$2b$10$placeholder_hash_ravi",
      role: "donor",
      phone: "9876543211",
      latitude: 17.395,
      longitude: 78.49,
    },
    {
      name: "Meena Reddy",
      email: "meena@example.com",
      password_hash: "$2b$10$placeholder_hash_meena",
      role: "donor",
      phone: "9876543212",
      latitude: 17.375,
      longitude: 78.48,
    },
    {
      name: "Suresh Volunteer",
      email: "suresh@example.com",
      password_hash: "$2b$10$placeholder_hash_suresh",
      role: "volunteer",
      phone: "9876543213",
      latitude: 17.39,
      longitude: 78.485,
    },
    {
      name: "GreenPlate NGO",
      email: "contact@greenplate.org",
      password_hash: "$2b$10$placeholder_hash_greenplate",
      role: "ngo",
      phone: "9876543214",
      latitude: 17.38,
      longitude: 78.495,
    },
  ];

  const { data: insertedUsers, error: usersError } = await supabase
    .from("users")
    .insert(users)
    .select();

  if (usersError) {
    console.error("Error seeding users:", usersError.message);
    return;
  }
  console.log(`Inserted ${insertedUsers.length} users`);

  const donors = insertedUsers.filter((u) => u.role === "donor");
  const volunteer = insertedUsers.find((u) => u.role === "volunteer");
  const ngo = insertedUsers.find((u) => u.role === "ngo");

  // -------------------------------------------------------
  // 2. Food listings — 6 listings across all statuses
  // -------------------------------------------------------
  const now = new Date();
  const hoursFromNow = (h) => new Date(now.getTime() + h * 3600000).toISOString();

  const listings = [
    {
      donor_id: donors[0].id,
      title: "Rice & Dal (10 portions)",
      description: "Home-cooked rice and dal, enough for 10 people.",
      quantity: 10,
      unit: "portions",
      food_type: "veg",
      expiry_time: hoursFromNow(6),
      pickup_address: "Flat 301, Green Valley Apts, Madhapur",
      latitude: 17.385,
      longitude: 78.4867,
      status: "available",
      image_url: null,
    },
    {
      donor_id: donors[0].id,
      title: "Mixed Fruit Box",
      description: "Assorted fresh fruits — bananas, apples, oranges.",
      quantity: 5,
      unit: "kg",
      food_type: "veg",
      expiry_time: hoursFromNow(24),
      pickup_address: "Flat 301, Green Valley Apts, Madhapur",
      latitude: 17.385,
      longitude: 78.4867,
      status: "available",
      image_url: null,
    },
    {
      donor_id: donors[1].id,
      title: "Chicken Biryani (Party Leftover)",
      description: "Hyderabadi chicken biryani from a family event.",
      quantity: 15,
      unit: "portions",
      food_type: "non-veg",
      expiry_time: hoursFromNow(4),
      pickup_address: "12, Lake View Colony, Kondapur",
      latitude: 17.395,
      longitude: 78.49,
      status: "claimed",
      image_url: null,
    },
    {
      donor_id: donors[1].id,
      title: "Bread & Butter (Bakery Surplus)",
      description: "Day-old bread loaves and butter packs from bakery.",
      quantity: 20,
      unit: "packs",
      food_type: "veg",
      expiry_time: hoursFromNow(12),
      pickup_address: "12, Lake View Colony, Kondapur",
      latitude: 17.395,
      longitude: 78.49,
      status: "picked_up",
      image_url: null,
    },
    {
      donor_id: donors[2].id,
      title: "Mixed Lunch Boxes",
      description: "Packed lunch boxes with rice, curry and salad.",
      quantity: 8,
      unit: "boxes",
      food_type: "mixed",
      expiry_time: hoursFromNow(3),
      pickup_address: "Plot 7, Jubilee Hills",
      latitude: 17.375,
      longitude: 78.48,
      status: "expired",
      image_url: null,
    },
    {
      donor_id: donors[2].id,
      title: "Samosa & Chai Pack",
      description: "Freshly made samosas with chai for evening snack.",
      quantity: 30,
      unit: "pieces",
      food_type: "veg",
      expiry_time: hoursFromNow(2),
      pickup_address: "Plot 7, Jubilee Hills",
      latitude: 17.375,
      longitude: 78.48,
      status: "available",
      image_url: null,
    },
  ];

  const { data: insertedListings, error: listingsError } = await supabase
    .from("food_listings")
    .insert(listings)
    .select();

  if (listingsError) {
    console.error("Error seeding food_listings:", listingsError.message);
    return;
  }
  console.log(`Inserted ${insertedListings.length} food listings`);

  // -------------------------------------------------------
  // 3. Claims — for the "claimed" and "picked_up" listings
  // -------------------------------------------------------
  const claimedListing = insertedListings.find((l) => l.status === "claimed");
  const pickedUpListing = insertedListings.find((l) => l.status === "picked_up");

  const claims = [
    {
      listing_id: claimedListing.id,
      claimer_id: volunteer.id,
      status: "confirmed",
      pickup_time: hoursFromNow(2),
    },
    {
      listing_id: pickedUpListing.id,
      claimer_id: ngo.id,
      status: "completed",
      pickup_time: hoursFromNow(-1),
    },
  ];

  const { data: insertedClaims, error: claimsError } = await supabase
    .from("claims")
    .insert(claims)
    .select();

  if (claimsError) {
    console.error("Error seeding claims:", claimsError.message);
    return;
  }
  console.log(`Inserted ${insertedClaims.length} claims`);

  // -------------------------------------------------------
  // 4. Notifications
  // -------------------------------------------------------
  const notifications = [
    {
      user_id: donors[1].id,
      listing_id: claimedListing.id,
      message: "Your listing 'Chicken Biryani' has been claimed by Suresh Volunteer.",
      is_read: false,
    },
    {
      user_id: volunteer.id,
      listing_id: claimedListing.id,
      message: "You have claimed 'Chicken Biryani'. Pickup confirmed.",
      is_read: true,
    },
    {
      user_id: ngo.id,
      listing_id: pickedUpListing.id,
      message: "Pickup for 'Bread & Butter' is complete. Thank you!",
      is_read: false,
    },
  ];

  const { data: insertedNotifs, error: notifsError } = await supabase
    .from("notifications")
    .insert(notifications)
    .select();

  if (notifsError) {
    console.error("Error seeding notifications:", notifsError.message);
    return;
  }
  console.log(`Inserted ${insertedNotifs.length} notifications`);

  console.log("\nSeed complete!");
}

seed().catch(console.error);

/**
 * ============================================================================
 * ANNAYOG — Main Server Entry Point
 * ============================================================================
 * This is the single file that wires together:
 *   - Express app with CORS, JSON parsing, and security headers
 *   - All route modules (auth, verification, listings, matching, etc.)
 *   - Middleware stack (rate limiting, error handling)
 *   - WebSocket server for real-time notifications
 *   - Background jobs (offer expiry, listing expiry, radius auto-widen)
 *
 * Start with:  npm start   (or: npm run dev  for auto-restart on changes)
 * ============================================================================
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';


// ── Middleware ───────────────────────────────────────────────────────────────
import { generalLimiter } from './middleware/rateLimiter.js';
import { errorHandler }   from './middleware/errorHandler.js';

// ── Routes ──────────────────────────────────────────────────────────────────
import authRoutes          from './routes/auth.js';
import verificationRoutes  from './routes/verification.js';
import listingRoutes       from './routes/listings.js';
import matchingRoutes      from './routes/matching.js';
import deliveryOfferRoutes from './routes/deliveryOffers.js';
import deliveryRoutes      from './routes/delivery.js';
import disputeRoutes       from './routes/disputes.js';
import statsRoutes         from './routes/stats.js';
import adminRoutes         from './routes/admin.js';
import uploadRoutes        from './routes/uploads.js';

// ── WebSocket ───────────────────────────────────────────────────────────────
import { setupWebSocket } from './websocket/index.js';

// ── Background Jobs ─────────────────────────────────────────────────────────
import { startOfferExpiryJob }  from './jobs/offerExpiry.js';
import { startListingExpiryJob } from './jobs/listingExpiry.js';
import { startRadiusWidenJob }  from './jobs/radiusWiden.js';

// ── Express App Setup ───────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Security & parsing middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`[HTTP] ${req.method} ${req.path} - ${res.statusCode}`);
  });
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(generalLimiter);

// Serve uploaded files statically (local storage mode)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Handle direct file uploads (for local storage mode)
app.put('/uploads/:filename', (req, res) => {
  const filePath = path.join(__dirname, '..', 'uploads', req.params.filename);
  const writeStream = fs.createWriteStream(filePath);
  req.pipe(writeStream);
  req.on('end', () => {
    res.status(200).json({ success: true });
  });
  writeStream.on('error', (err) => {
    res.status(500).json({ error: { message: err.message } });
  });
});

// ── Health Check (no auth required) ─────────────────────────────────────────
app.get('/v1/health', (req, res) => {
  res.json({ data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// ── Mount All Routes under /v1 ──────────────────────────────────────────────
app.use('/v1', authRoutes);
app.use('/v1', verificationRoutes);
app.use('/v1', listingRoutes);
app.use('/v1', matchingRoutes);
app.use('/v1', deliveryOfferRoutes);
app.use('/v1', deliveryRoutes);
app.use('/v1', disputeRoutes);
app.use('/v1', statsRoutes);
app.use('/v1', adminRoutes);
app.use('/v1', uploadRoutes);

// ── Global Error Handler (must be last middleware) ──────────────────────────
app.use(errorHandler);

// ── Create HTTP Server + Attach WebSocket ───────────────────────────────────
const server = createServer(app);
setupWebSocket(server);

// ── Start Background Jobs ───────────────────────────────────────────────────
startOfferExpiryJob();
startListingExpiryJob();
startRadiusWidenJob();

// ── Start Listening ─────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║   🍽️  ANNAYOG Backend Server                     ║');
  console.log('  ║   AI-Matched Surplus Food Rescue Network         ║');
  console.log(`  ║   API:  http://localhost:${PORT}/v1                ║`);
  console.log(`  ║   WS:   ws://localhost:${PORT}/v1/ws               ║`);
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
});

export default app;

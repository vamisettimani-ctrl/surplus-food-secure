/**
 * ============================================================================
 * ANNAYOG — WebSocket Server
 * ============================================================================
 * Provides real-time push notifications to connected clients.
 * Each client connects with their JWT token as a query parameter:
 *   wss://api.annayog.app/v1/ws?token=<access_token>
 *
 * Events pushed to clients:
 *   - LISTING_STATUS_CHANGED  → to donors when their listing status updates
 *   - MATCH_OFFER             → to NGOs when a new match is offered
 *   - DELIVERY_OFFER          → to delivery partners when assigned a pickup
 *
 * Architecture:
 *   - `connections` Map tracks userId → Set<WebSocket>
 *   - `broadcast(userId, event, data)` sends to all sockets for that user
 *   - `broadcastToRole(role, event, data)` sends to all users with a role
 * ============================================================================
 */

import { WebSocketServer } from 'ws';
import { verifyAccessToken } from '../utils/jwt.js';
import { users } from '../store/index.js';

// userId → Set<WebSocket>
const connections = new Map();

/**
 * Attach WebSocket server to an existing HTTP server.
 * @param {import('http').Server} server - The HTTP server instance
 */
export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/v1/ws' });

  wss.on('connection', (ws, req) => {
    try {
      // Extract token from query string: ?token=xxx
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');

      if (!token) {
        ws.close(4001, 'Missing token');
        return;
      }

      // Verify JWT
      const decoded = verifyAccessToken(token);
      const user = users.get(decoded.user_id);
      if (!user || user.suspended) {
        ws.close(4003, 'Unauthorized');
        return;
      }

      const userId = decoded.user_id;

      // Register connection
      if (!connections.has(userId)) {
        connections.set(userId, new Set());
      }
      connections.get(userId).add(ws);
      console.log(`[WS] User ${userId} connected (${connections.get(userId).size} sockets)`);

      // Handle disconnect
      ws.on('close', () => {
        const userSockets = connections.get(userId);
        if (userSockets) {
          userSockets.delete(ws);
          if (userSockets.size === 0) connections.delete(userId);
        }
        console.log(`[WS] User ${userId} disconnected`);
      });

      // Handle errors
      ws.on('error', (err) => {
        console.error(`[WS] Error for user ${userId}:`, err.message);
      });

      // Send welcome message
      ws.send(JSON.stringify({ event: 'CONNECTED', data: { user_id: userId } }));

    } catch (err) {
      console.error('[WS] Connection auth failed:', err.message);
      ws.close(4003, 'Authentication failed');
    }
  });

  console.log('[WS] WebSocket server attached on /v1/ws');
}

/**
 * Send a message to all WebSocket connections for a specific user.
 * @param {string} userId - Target user ID
 * @param {string} event  - Event name (e.g., 'MATCH_OFFER')
 * @param {Object} data   - Event payload
 */
export function broadcast(userId, event, data) {
  const userSockets = connections.get(userId);
  if (!userSockets || userSockets.size === 0) return;

  const message = JSON.stringify({ event, data });
  for (const ws of userSockets) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(message);
    }
  }
}

/**
 * Send a message to all connected users with a specific role.
 * @param {string} role  - Target role (e.g., 'NGO')
 * @param {string} event - Event name
 * @param {Object} data  - Event payload
 */
export function broadcastToRole(role, event, data) {
  for (const [userId] of connections) {
    const user = users.get(userId);
    if (user && user.role === role) {
      broadcast(userId, event, data);
    }
  }
}

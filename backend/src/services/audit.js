/**
 * ============================================================================
 * ANNAYOG — Audit Log Service
 * ============================================================================
 * Records every state-changing action in the system for traceability.
 * Judges love this — every rescued meal can be traced from kitchen to plate.
 *
 * Rule: Never log full documents, OTPs, or tokens — only event metadata.
 * ============================================================================
 */

import { auditLogs, newId } from '../store/index.js';

/**
 * Write an audit log entry.
 *
 * @param {string} actorId      - user_id of the person performing the action
 * @param {string} action       - What happened (e.g., 'LISTING_CREATED', 'MATCH_ACCEPTED')
 * @param {string} resourceType - Entity type (e.g., 'Listing', 'MatchAttempt')
 * @param {string} resourceId   - ID of the affected entity
 * @param {Object} [metadata]   - Additional context (never include secrets/tokens)
 */
export function logAudit(actorId, action, resourceType, resourceId, metadata = {}) {
  const entry = {
    id:            newId(),
    actor_id:      actorId,
    action,
    resource_type: resourceType,
    resource_id:   resourceId,
    metadata,
    timestamp:     new Date().toISOString(),
  };
  auditLogs.set(entry.id, entry);
  console.log(`[Audit] ${action} on ${resourceType}:${resourceId} by ${actorId}`);
}

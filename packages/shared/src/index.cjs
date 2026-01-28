/**
 * @fileoverview Shared constants and type definitions for Songift (CommonJS)
 *
 * This module provides:
 * - Firestore collection names (to prevent typos and ensure consistency)
 * - JSDoc type definitions for core data models
 */

// =============================================================================
// Firestore Collection Names
// =============================================================================

/**
 * Firestore collection names used across the application
 * @constant
 */
const COLLECTIONS = {
  /** Order records */
  ORDERS: 'orders',
  /** Automation job queue for video generation */
  AUTOMATION_QUEUE: 'automation_queue',
  /** User feedback submissions */
  FEEDBACK: 'feedback',
  /** Visitor tracking data */
  VISITORS: 'visitors',
  /** Scheduled followup email queue */
  FOLLOWUP_QUEUE: 'followup_queue',
  /** IP-based rate limiting records */
  RATE_LIMITS: 'rate_limits',
};

// =============================================================================
// Firebase Project IDs
// =============================================================================

/**
 * Firebase project IDs for environment detection
 * @constant
 */
const PROJECT_IDS = {
  /** Staging project ID */
  STG: 'birthday-song-app-stg',
  /** Production project ID */
  PROD: 'birthday-song-app',
};

// =============================================================================
// Environment Detection
// =============================================================================

/**
 * Detect environment from Firebase project ID
 * @param {string} projectId - Firebase project ID
 * @returns {'stg' | 'prod' | null} - Environment or null if unknown project
 */
function getEnvironmentFromProjectId(projectId) {
  if (projectId === PROJECT_IDS.STG) return 'stg';
  if (projectId === PROJECT_IDS.PROD) return 'prod';
  return null;
}

module.exports = {
  COLLECTIONS,
  PROJECT_IDS,
  getEnvironmentFromProjectId,
};

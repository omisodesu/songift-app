/**
 * @fileoverview Shared constants and type definitions for Songift
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
export const COLLECTIONS = {
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
  /** B2B organizations */
  ORGANIZATIONS: 'organizations',
  /** Organization membership (keyed by uid) */
  ORGANIZATION_MEMBERS: 'organization_members',
  /** Super admin support sessions */
  SUPPORT_SESSIONS: 'support_sessions',
  /** Audit trail for admin actions */
  AUDIT_LOGS: 'audit_logs',
};

// =============================================================================
// Firebase Project IDs
// =============================================================================

/**
 * Firebase project IDs for environment detection
 * @constant
 */
export const PROJECT_IDS = {
  /** Staging project ID */
  STG: 'birthday-song-app-stg',
  /** Production project ID */
  PROD: 'birthday-song-app',
};

// =============================================================================
// Environment Detection
// =============================================================================

/**
 * Environment types
 * @typedef {'stg' | 'prod'} Environment
 */

/**
 * Detect environment from Firebase project ID
 * @param {string} projectId - Firebase project ID
 * @returns {Environment | null} - Environment or null if unknown project
 */
export function getEnvironmentFromProjectId(projectId) {
  if (projectId === PROJECT_IDS.STG) return 'stg';
  if (projectId === PROJECT_IDS.PROD) return 'prod';
  return null;
}

// =============================================================================
// B2B Song Billing Constants
// =============================================================================

/**
 * B2B基本プラン定義（曲数制）
 * @constant
 */
export const SONG_PLANS = {
  light:    { label: 'ライト',      songs: 22,  defaultPriceYen: 20000 },
  standard: { label: 'スタンダード', songs: 66,  defaultPriceYen: 60000 },
  premium:  { label: 'プレミアム',   songs: 110, defaultPriceYen: 100000 },
};

/**
 * 追加1曲のデフォルト価格（円）
 * @constant
 */
export const DEFAULT_ADDON_SONG_PRICE_YEN = 1000;

/**
 * 請求取引の種別
 * @constant
 */
export const BILLING_TXN_TYPES = {
  BASE_PLAN_PURCHASE: 'base_plan_purchase',
  ADDON_PURCHASE: 'addon_purchase',
  SUPPORT_GRANT: 'support_grant',
  RESERVE: 'reserve',
  CONSUME: 'consume',
  RELEASE: 'release',
  EXPIRE: 'expire',
};

// =============================================================================
// Type Definitions (JSDoc)
// =============================================================================

/**
 * Order status values
 * @typedef {'pending' | 'processing' | 'generating' | 'completed' | 'failed' | 'refunded'} OrderStatus
 */

/**
 * Order record in Firestore
 * @typedef {Object} Order
 * @property {string} orderId - Unique order identifier
 * @property {string} token - Public access token for order
 * @property {string} email - Customer email
 * @property {string} recipientName - Name of the birthday person
 * @property {string} senderName - Name of the sender
 * @property {string} relationship - Relationship to recipient
 * @property {string} [message] - Optional personal message
 * @property {string} [genre] - Music genre preference
 * @property {string} [mood] - Mood preference
 * @property {OrderStatus} status - Current order status
 * @property {Date} createdAt - Order creation timestamp
 * @property {Date} [updatedAt] - Last update timestamp
 * @property {string} [previewUrl] - URL to preview audio
 * @property {string} [videoUrl] - URL to full video
 * @property {boolean} [isPaid] - Whether payment is completed
 * @property {number} [amount] - Order amount in JPY
 */

/**
 * Generation job status
 * @typedef {'pending' | 'processing' | 'completed' | 'failed' | 'timeout'} JobStatus
 */

/**
 * Automation queue job for video generation
 * @typedef {Object} GenerationJob
 * @property {string} orderId - Reference to order
 * @property {string} type - Job type (e.g., 'generate_video')
 * @property {JobStatus} status - Current job status
 * @property {Date} createdAt - Job creation timestamp
 * @property {Date} scheduledAt - Scheduled execution time
 * @property {Date} [startedAt] - When processing started
 * @property {Date} [completedAt] - When job completed
 * @property {number} [retryCount] - Number of retry attempts
 * @property {string} [error] - Error message if failed
 */

/**
 * Credit ledger entry for B2B billing
 * @typedef {Object} CreditLedger
 * @property {string} orgId - Organization ID
 * @property {string} type - Transaction type (credit, debit)
 * @property {number} amount - Credit amount
 * @property {string} [orderId] - Reference to order (for debits)
 * @property {string} description - Transaction description
 * @property {Date} createdAt - Transaction timestamp
 * @property {number} balanceAfter - Balance after transaction
 */

/**
 * Organization for B2B multi-tenant
 * @typedef {Object} Organization
 * @property {string} name - Organization display name
 * @property {'active' | 'suspended'} status - Organization status
 * @property {Date} createdAt - Organization creation timestamp
 * @property {string} createdBy - UID of the creator
 */

/**
 * Organization membership (document ID = Firebase Auth UID)
 * @typedef {Object} OrganizationMember
 * @property {string} email - Member email address
 * @property {string[]} orgIds - List of organization IDs the member belongs to
 * @property {'super_admin' | 'org_admin' | 'org_member'} role - Member role
 * @property {Date} createdAt - Membership creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * Super admin support session for impersonation
 * @typedef {Object} SupportSession
 * @property {string} superAdminUid - UID of the super admin
 * @property {string} targetOrgId - Organization being accessed
 * @property {Date} startedAt - Session start timestamp
 * @property {Date|null} endedAt - Session end timestamp (null if active)
 * @property {string} reason - Reason for the support session
 */

/**
 * Audit log entry for admin actions
 * @typedef {Object} AuditLog
 * @property {string} actorUid - UID of the actor
 * @property {string} actorEmail - Email of the actor
 * @property {string} action - Action performed
 * @property {string} targetOrgId - Target organization ID
 * @property {string} targetResource - Target resource path
 * @property {Date} createdAt - Action timestamp
 * @property {Object} meta - Additional metadata
 */

/**
 * Feedback submission
 * @typedef {Object} Feedback
 * @property {string} feedbackId - Unique feedback ID
 * @property {string} [orderId] - Reference to order
 * @property {string} visitorId - Visitor identifier
 * @property {string} channel - Feedback channel (e.g., 'order_received', 'delivery_email')
 * @property {number} [rating] - Star rating (1-5)
 * @property {string} [comment] - Free text comment
 * @property {Date} createdAt - Submission timestamp
 */

/**
 * Visitor tracking record
 * @typedef {Object} Visitor
 * @property {string} visitorId - Unique visitor ID
 * @property {string[]} [feedbackChannels] - Channels where feedback was submitted
 * @property {Date} firstSeen - First visit timestamp
 * @property {Date} lastSeen - Last activity timestamp
 */

/**
 * @fileoverview Firebase client initialization for Songift browser apps
 *
 * This module provides:
 * - Firebase app initialization with environment config
 * - Auth, Firestore, and Functions instances
 * - Environment validation (VITE_APP_ENV vs projectId)
 *
 * Usage:
 *   import { auth, db, functions, firebaseConfig } from '@songift/firebase-client';
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { PROJECT_IDS, getEnvironmentFromProjectId } from '@songift/shared';

// =============================================================================
// Firebase Configuration
// =============================================================================

/**
 * Firebase configuration from Vite environment variables
 * @type {import('firebase/app').FirebaseOptions}
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// =============================================================================
// Environment Validation
// =============================================================================

/**
 * Validate that VITE_APP_ENV matches the Firebase projectId
 * This prevents deploying STG code to PROD or vice versa
 */
function validateEnvironment() {
  const declaredEnv = import.meta.env.VITE_APP_ENV; // 'stg' | 'prod' | undefined
  const projectId = firebaseConfig.projectId;
  const detectedEnv = getEnvironmentFromProjectId(projectId);

  // Log initialization info
  console.log(`[Firebase] Initializing with projectId: ${projectId}, authDomain: ${firebaseConfig.authDomain}`);

  // Skip validation in development (localhost)
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.log(`[Firebase] Development mode - skipping environment validation`);
    return;
  }

  // Validate only if VITE_APP_ENV is set
  if (declaredEnv && detectedEnv) {
    if (declaredEnv !== detectedEnv) {
      const errorMsg = `❌ 環境エラー: VITE_APP_ENV=${declaredEnv} と projectId=${projectId} (${detectedEnv}) が一致しません！

これは誤ったビルド設定でデプロイされた可能性があります。

修正方法:
- STG環境の場合: npm run build:stg を使用
- PROD環境の場合: npm run build:prod を使用

正しい組み合わせ:
- STG: VITE_APP_ENV=stg, projectId=${PROJECT_IDS.STG}
- PROD: VITE_APP_ENV=prod, projectId=${PROJECT_IDS.PROD}`;

      console.error(errorMsg);
      // Show alert in browser but don't block the app completely
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(errorMsg);
      }
      throw new Error('Environment mismatch error');
    }

    console.log(`✅ 環境チェックOK: ${declaredEnv.toUpperCase()}環境として正しく動作しています (projectId: ${projectId})`);
  } else if (detectedEnv) {
    // VITE_APP_ENV not set, but projectId is recognized - just log the detected environment
    console.log(`[Firebase] Running with projectId: ${projectId} (detected: ${detectedEnv})`);
  }
}

// Run validation
validateEnvironment();

// =============================================================================
// Firebase Initialization
// =============================================================================

/** Firebase app instance */
const app = initializeApp(firebaseConfig);

/** Firebase Auth instance */
export const auth = getAuth(app);

/** Google Auth Provider instance */
export const googleProvider = new GoogleAuthProvider();

/** Firestore database instance */
export const db = getFirestore(app);

/** Cloud Functions instance */
export const functions = getFunctions(app);

/** Firebase Storage instance */
export const storage = getStorage(app);

// =============================================================================
// Re-exports for convenience
// =============================================================================

export { COLLECTIONS, PROJECT_IDS } from '@songift/shared';

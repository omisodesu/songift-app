/**
 * @fileoverview Firebase client re-export for backward compatibility
 *
 * This file re-exports everything from @songift/firebase-client
 * to maintain backward compatibility with existing imports.
 */

export {
  auth,
  googleProvider,
  db,
  functions,
  storage,
  firebaseConfig,
  COLLECTIONS,
  PROJECT_IDS,
} from '@songift/firebase-client';

import { App, getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

let app: App | undefined;

/**
 * Lazily initializes the Firebase Admin app for the Express/SSR server.
 *
 * Credentials are resolved via Application Default Credentials:
 *  - locally, set GOOGLE_APPLICATION_CREDENTIALS to a service-account key file;
 *  - on Cloud Run / Cloud Functions, the attached runtime service account is used.
 *
 * When FIRESTORE_EMULATOR_HOST is set, the Admin SDK targets the emulator
 * automatically — no code change required.
 */
export function getAdminApp(): App {
  app ??= getApps()[0] ?? initializeApp();
  return app;
}

/** Privileged (Admin) Firestore instance for server-side use. Bypasses security rules. */
export function getDb(): Firestore {
  return getFirestore(getAdminApp());
}

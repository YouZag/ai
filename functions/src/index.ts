/**
 * Firebase Cloud Functions (2nd gen) entry point.
 *
 * Uses the Admin SDK for privileged Firestore access. Credentials come from the
 * runtime service account when deployed; the Admin SDK connects to the local
 * emulator automatically when FIRESTORE_EMULATOR_HOST is set.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

initializeApp();
const db = getFirestore();

/** HTTPS endpoint: writes a `pings` document and returns it. */
export const ping = onRequest(async (_req, res) => {
  const ref = await db.collection('pings').add({ createdAt: Date.now() });
  const snap = await ref.get();
  res.json({ id: ref.id, ...snap.data() });
});

/** Firestore trigger: fires when a `pings/{pingId}` document is created. */
export const onPingCreated = onDocumentCreated('pings/{pingId}', (event) => {
  logger.info('ping created', { pingId: event.params.pingId });
});

import { initializeApp } from 'firebase-admin/app';
import type { FirestoreDataConverter, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import type { ErrorDocument } from '@interfaces';

initializeApp();

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

const errorConverter: FirestoreDataConverter<ErrorDocument> = {
  toFirestore(error: ErrorDocument) {
    return error;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot) {
    return snapshot.data() as ErrorDocument;
  },
};

export const onErrorCreated = onDocumentCreated(
  {
    document: 'errors/{errorId}',
    memory: '2GiB',
    timeoutSeconds: 540,
    secrets: [anthropicApiKey],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const error = errorConverter.fromFirestore(snapshot);
    logger.info('error document created', {
      errorId: event.params.errorId,
      message: error.message,
    });

    // TODO: run the Claude Agent SDK against this error.
  },
);

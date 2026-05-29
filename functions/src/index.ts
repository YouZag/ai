import { initializeApp } from 'firebase-admin/app';
import type { FirestoreDataConverter, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { GoogleAuth } from 'google-auth-library';
import { ErrorDocumentSchema, type ErrorDocument } from '@schemas';
import { runClaude, githubMcpServer, firestoreMcpServer } from '@shared';

initializeApp();

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
const githubToken = defineSecret('GITHUB_TOKEN');

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

const errorConverter: FirestoreDataConverter<ErrorDocument> = {
  toFirestore(error: ErrorDocument) {
    return error;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot) {
    return ErrorDocumentSchema.parse(snapshot.data());
  },
};

export const onErrorCreated = onDocumentCreated(
  {
    document: 'errors/{errorId}',
    memory: '2GiB',
    timeoutSeconds: 540,
    secrets: [anthropicApiKey, githubToken],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const error = errorConverter.fromFirestore(snapshot);
    const errorId = event.params.errorId;

    const [accessToken, projectId] = await Promise.all([auth.getAccessToken(), auth.getProjectId()]);
    if (!accessToken) throw new Error('Failed to obtain a Google access token');

    const summary = await runClaude({
      prompt: `An application error was reported (id: ${errorId}) in Firestore project "${projectId}", database "(default)". Investigate the likely cause, read any related Firestore data that helps, and open a GitHub issue summarizing it with a suggested fix.\n\nMessage: ${error.message}\nStack: ${error.stack ?? '(none)'}`,
      mcpServers: {
        github: githubMcpServer(githubToken.value()),
        firestore: firestoreMcpServer(accessToken),
      },
    });

    logger.info('error triaged', { errorId, summary });
  },
);

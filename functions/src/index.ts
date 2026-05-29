import { initializeApp } from 'firebase-admin/app';
import type { FirestoreDataConverter, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import type { ErrorDocument } from '@interfaces';
import { runClaude, githubMcpServer } from '@shared';

initializeApp();

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
const githubToken = defineSecret('GITHUB_TOKEN');

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
    secrets: [anthropicApiKey, githubToken],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const error = errorConverter.fromFirestore(snapshot);
    const errorId = event.params.errorId;

    const summary = await runClaude({
      prompt: `An application error was reported (id: ${errorId}). Investigate the likely cause and open a GitHub issue summarizing it with a suggested fix.\n\nMessage: ${error.message}\nStack: ${error.stack ?? '(none)'}`,
      mcpServers: { github: githubMcpServer(githubToken.value()) },
    });

    logger.info('error triaged', { errorId, summary });
  },
);

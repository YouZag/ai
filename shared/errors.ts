import { ErrorDocumentSchema, type ErrorDocument } from '@schemas';

export type ErrorSource = 'functions' | 'express' | 'client';

export type ErrorWriter = (doc: ErrorDocument) => Promise<unknown>;

interface ErrorReportingConfig {
  source: ErrorSource;
  write: ErrorWriter;
}

let config: ErrorReportingConfig | undefined;

export function initErrorReporting(reporting: ErrorReportingConfig): void {
  config = reporting;
}

export function toErrorDocument(err: unknown, context?: Record<string, unknown>): ErrorDocument {
  const error =
    err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
  return ErrorDocumentSchema.parse({
    message: error.message,
    stack: error.stack,
    source: config?.source,
    context,
    createdAt: Date.now(),
  });
}

export async function reportError(err: unknown, context?: Record<string, unknown>): Promise<void> {
  if (!config) {
    console.error('reportError: initErrorReporting was never called; dropping error', err);
    return;
  }
  let doc: ErrorDocument;
  try {
    doc = toErrorDocument(err, context);
  } catch (buildErr) {
    console.error('reportError: failed to build error document', buildErr, err);
    return;
  }
  try {
    await config.write(doc);
  } catch (writeErr) {
    console.error('reportError: failed to persist error', writeErr);
  }
}

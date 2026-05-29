# Error handling

- Every error — caught or uncaught — is reported through the one shared reporter, which writes a validated `ErrorDocument` to the `errors` collection. That write triggers `onErrorCreated`, which triages it with the Agent SDK.
- Use the single shared API, imported the same way everywhere: `import { reportError, initErrorReporting } from '@shared/errors'`.
  - `initErrorReporting({ source, write })` — call once per runtime at startup. `source` is `'functions' | 'express' | 'client'`; `write` persists an `ErrorDocument` through a typed `withConverter()` (Admin SDK on the server, Web SDK on the client).
  - `reportError(err, context?)` — call for every error. It normalizes and validates via `ErrorDocumentSchema` and never throws; failures are logged, not re-raised.
- Wire each runtime's global catch to `reportError`:
  - Functions: `initErrorReporting` at module load; wrap handler bodies in `try/catch` that call `reportError`.
  - Express: call `initServerErrorReporting()` at startup and register a terminal error-handling middleware that calls `reportError` then `next(err)`.
  - Client: the Angular `ErrorReportingHandler` provided as `ErrorHandler` in `app.config.ts`; it initializes the writer in the browser only (the server path owns SSR errors).
- Never report from inside `onErrorCreated` (the triage function) — writing to `errors` would re-trigger it. Other loops are prevented because `reportError` swallows its own write failures.
- Import error reporting from `@shared/errors`, never the `@shared` barrel, so the browser bundle never pulls in the Agent SDK.

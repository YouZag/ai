import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { getAdminApp, getDb } from './server/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { initServerErrorReporting } from './server/errors';
import { reportError } from '@shared/errors';
import { applyPlanTool, PLANNING_TOOLS, planningSystemPrompt } from '@shared/planning';
import type { Feature, Vision } from '@schemas';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json());

initServerErrorReporting();

/**
 * Example Express REST API endpoint backed by the Admin (privileged) Firestore SDK.
 * Add your server-side routes here; use `getDb()` to read/write Firestore.
 *
 * Example with a real query:
 * ```ts
 * app.get('/api/users/:id', async (req, res, next) => {
 *   try {
 *     const snap = await getDb().collection('users').doc(req.params.id).get();
 *     snap.exists ? res.json(snap.data()) : res.sendStatus(404);
 *   } catch (err) {
 *     next(err);
 *   }
 * });
 * ```
 */
app.get('/api/health', (_req, res) => {
  // Touch the Admin Firestore handle to confirm wiring (no network call).
  getDb();
  res.json({ status: 'ok', projectId: getAdminApp().options.projectId ?? null });
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

const adminEmails = (process.env['ADMIN_EMAILS'] ?? 'drew@youzag.com')
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean);

app.get('/api/models', (req, res, next) => {
  void (async () => {
    try {
      const match = (req.header('authorization') ?? '').match(/^Bearer (.+)$/i);
      if (!match) {
        res.status(401).json({ error: 'Missing bearer token' });
        return;
      }
      const decoded = await getAuth(getAdminApp()).verifyIdToken(match[1]);
      if (
        decoded.email_verified !== true ||
        !decoded.email ||
        !adminEmails.includes(decoded.email)
      ) {
        res.status(403).json({ error: 'Admins only' });
        return;
      }
      const key = process.env['ANTHROPIC_API_KEY'];
      if (!key) {
        res.status(503).json({ error: 'Model list is not configured' });
        return;
      }
      const anthropic = await fetch('https://api.anthropic.com/v1/models?limit=100', {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      });
      if (!anthropic.ok) {
        res.status(502).json({ error: `Anthropic request failed (${anthropic.status})` });
        return;
      }
      const body = (await anthropic.json()) as { data?: { id: string; display_name?: string }[] };
      res.json({
        models: (body.data ?? []).map((model) => ({
          id: model.id,
          displayName: model.display_name ?? model.id,
        })),
      });
    } catch (err) {
      next(err);
    }
  })();
});

interface PlanBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

app.post('/api/plan', (req, res, next) => {
  void (async () => {
    try {
      const match = (req.header('authorization') ?? '').match(/^Bearer (.+)$/i);
      if (!match) {
        res.status(401).json({ error: 'Missing bearer token' });
        return;
      }
      const decoded = await getAuth(getAdminApp()).verifyIdToken(match[1]);
      if (
        decoded.email_verified !== true ||
        !decoded.email ||
        !adminEmails.includes(decoded.email)
      ) {
        res.status(403).json({ error: 'Admins only' });
        return;
      }
      const key = process.env['ANTHROPIC_API_KEY'];
      if (!key) {
        res.status(503).json({ error: 'Planning is not configured' });
        return;
      }
      const incoming = (req.body as { messages?: { role: string; content: unknown }[] }).messages;
      if (!Array.isArray(incoming)) {
        res.status(400).json({ error: 'A messages array is required' });
        return;
      }

      const db = getDb();
      const [visionSnap, featuresSnap] = await Promise.all([
        db.collection('vision').doc('current').get(),
        db.collection('features').get(),
      ]);
      const vision = visionSnap.exists ? (visionSnap.data() as Vision) : undefined;
      const features = featuresSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Feature) }));
      const system = planningSystemPrompt(vision, features);

      const messages: { role: string; content: unknown }[] = incoming.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      for (let turn = 0; turn < 8; turn++) {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-opus-4-8',
            max_tokens: 4096,
            system,
            tools: PLANNING_TOOLS,
            messages,
          }),
        });
        if (!resp.ok) {
          res.status(502).json({ error: `Anthropic request failed (${resp.status})` });
          return;
        }
        const data = (await resp.json()) as { content?: PlanBlock[]; stop_reason?: string };
        const content = data.content ?? [];

        if (data.stop_reason === 'tool_use') {
          messages.push({ role: 'assistant', content });
          const toolResults = [];
          for (const block of content) {
            if (block.type === 'tool_use' && block.name && block.id) {
              const output = await applyPlanTool(db, block.name, block.input ?? {});
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: output });
            }
          }
          messages.push({ role: 'user', content: toolResults });
          continue;
        }

        const text = content
          .filter((block) => block.type === 'text')
          .map((block) => block.text ?? '')
          .join('\n')
          .trim();
        res.json({ reply: text });
        return;
      }
      res.status(500).json({ error: 'Planning did not converge' });
    } catch (err) {
      next(err);
    }
  })();
});

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

const reportingErrorHandler: express.ErrorRequestHandler = (err, req, res, next) => {
  void reportError(err, { path: req.originalUrl });
  next(err);
};
app.use(reportingErrorHandler);

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

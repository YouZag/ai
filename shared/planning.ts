import type { Firestore } from 'firebase-admin/firestore';
import { FeatureSchema, VisionSchema, type Feature, type Vision } from '@schemas';
import { zodConverter } from './converter.js';

const visionConverter = zodConverter(VisionSchema);
const featureConverter = zodConverter(FeatureSchema);

export const PLANNING_TOOLS = [
  {
    name: 'set_vision',
    description:
      'Create or replace the product vision: what it is and the joy it creates, its operating principles, and explicit non-goals.',
    input_schema: {
      type: 'object',
      properties: {
        statement: { type: 'string' },
        principles: { type: 'array', items: { type: 'string' } },
        nonGoals: { type: 'array', items: { type: 'string' } },
      },
      required: ['statement', 'principles', 'nonGoals'],
    },
  },
  {
    name: 'upsert_feature',
    description:
      'Create a feature (omit id) or update one (pass its id). Give every feature a clear rationale and acceptance criteria, and set dependsOn and order so the build sequence is unambiguous.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        rationale: { type: 'string' },
        acceptance: { type: 'array', items: { type: 'string' } },
        dependsOn: { type: 'array', items: { type: 'string' } },
        priority: { type: 'number' },
        order: { type: 'number' },
      },
      required: ['title', 'description'],
    },
  },
  {
    name: 'remove_feature',
    description: 'Delete a feature by id.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
];

export function planningSystemPrompt(
  vision: Vision | undefined,
  features: Array<{ id: string } & Feature>,
): string {
  const visionText = vision
    ? `Statement: ${vision.statement}\nPrinciples:\n${vision.principles
        .map((p) => `- ${p}`)
        .join('\n')}\nNon-goals:\n${vision.nonGoals.map((n) => `- ${n}`).join('\n')}`
    : '(none yet)';
  const featureText =
    features.length > 0
      ? features
          .map(
            (f) =>
              `- ${f.id} · ${f.title} [${f.status}${f.order !== undefined ? `, order ${f.order}` : ''}]`,
          )
          .join('\n')
      : '(none yet)';
  return [
    'You are the Planning Studio. Work WITH the human, in a back-and-forth, to shape one coherent product: a sharp vision and a complete, ordered set of features that all trace back to it.',
    'Be opinionated and concrete — propose specifics and fill in the detail rather than only asking questions. Keep it grounded in the real world and the joy the product creates.',
    'As the plan takes shape, persist it with your tools: set_vision for the vision, upsert_feature for each feature (with a one-line rationale, acceptance criteria, dependsOn, and an order that makes the build sequence obvious), and remove_feature to prune. Do NOT break features into steps — that happens later, automatically.',
    'After each change, tell the human what you changed and what you would refine next.',
    '',
    'Current vision:',
    visionText,
    '',
    'Current features:',
    featureText,
  ].join('\n');
}

export async function applyPlanTool(
  db: Firestore,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  if (name === 'set_vision') {
    const vision: Vision = {
      statement: String(input['statement'] ?? ''),
      principles: (input['principles'] as string[] | undefined) ?? [],
      nonGoals: (input['nonGoals'] as string[] | undefined) ?? [],
      updatedAt: Date.now(),
    };
    await db.collection('vision').doc('current').withConverter(visionConverter).set(vision);
    return 'Vision updated.';
  }

  if (name === 'upsert_feature') {
    const col = db.collection('features').withConverter(featureConverter);
    const id = input['id'] as string | undefined;
    const ref = id ? col.doc(id) : col.doc();
    const existing = id ? (await ref.get()).data() : undefined;

    const feature: Feature = {
      title: (input['title'] as string | undefined) ?? existing?.title ?? '',
      description: (input['description'] as string | undefined) ?? existing?.description ?? '',
      status: existing?.status ?? 'proposed',
      priority: (input['priority'] as number | undefined) ?? existing?.priority ?? 0,
      createdBy: existing?.createdBy ?? 'studio',
      createdAt: existing?.createdAt ?? Date.now(),
    };
    const rationale = (input['rationale'] as string | undefined) ?? existing?.rationale;
    if (rationale !== undefined) feature.rationale = rationale;
    const acceptance = (input['acceptance'] as string[] | undefined) ?? existing?.acceptance;
    if (acceptance !== undefined) feature.acceptance = acceptance;
    const dependsOn = (input['dependsOn'] as string[] | undefined) ?? existing?.dependsOn;
    if (dependsOn !== undefined) feature.dependsOn = dependsOn;
    const order = (input['order'] as number | undefined) ?? existing?.order;
    if (order !== undefined) feature.order = order;
    if (existing?.supersededBy !== undefined) feature.supersededBy = existing.supersededBy;

    await ref.set(feature);
    return `Feature ${id ? 'updated' : 'created'}: ${ref.id} — ${feature.title}`;
  }

  if (name === 'remove_feature') {
    const id = input['id'] as string | undefined;
    if (id) await db.collection('features').doc(id).delete();
    return `Feature removed: ${id ?? '(none)'}`;
  }

  return `Unknown tool: ${name}`;
}

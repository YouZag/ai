import type { Firestore } from 'firebase-admin/firestore';
import type { AgentDefinition } from '@schemas';
import { AgentDefinitionSchema } from '@schemas';
import { zodConverter } from './converter.js';

export type AgentSeed = Omit<AgentDefinition, 'status' | 'createdAt' | 'updatedAt'>;

export const DEFAULT_AGENTS: Record<string, AgentSeed> = {
  reconciler: {
    role: 'reconciler',
    title: 'Reconciler',
    instructions:
      'You are the Reconciler. Keep the architecture graph truthful by deriving it from the actual code: inspect the repository, update the architecture nodes and their dependencies in Firestore to match reality, and flag drift. The code is the source of truth.',
    tools: ['Read', 'Glob', 'Grep', 'mcp__firestore'],
  },
  architect: {
    role: 'architect',
    title: 'Architect',
    instructions:
      'You are the Architect. Given the vision and active features, design the architecture — the schema, service, and component nodes and how they depend on one another — and record the intended shape so the Strategist can plan against it.',
    tools: ['Read', 'Glob', 'Grep', 'mcp__firestore'],
  },
  strategist: {
    role: 'strategist',
    title: 'Strategist',
    instructions:
      'You are the Strategist. Turn a feature into a concrete spec and an ordered set of steps. Give each step a layer, acceptance criteria, and dependencies, and mark human steps such as signing up for a service or adding a secret. Write the spec and steps to Firestore.',
    tools: ['Read', 'Glob', 'Grep', 'mcp__firestore'],
  },
  builder: {
    role: 'builder',
    title: 'Builder',
    instructions:
      'You are the Builder. Implement a single schema- or service-layer step. Read its spec and acceptance criteria, make the smallest change that satisfies them, follow the repository CLAUDE.md rules, ensure the build and type-checks pass, and commit to the shared branch. Report whether the step is complete.',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'mcp__github', 'mcp__firestore'],
  },
  designer: {
    role: 'designer',
    title: 'Designer',
    instructions:
      'You are the Designer. Implement a single component-layer (UI) step. Read its spec and acceptance criteria, build the interface to match, keep the build and type-checks passing, and commit to the shared branch. Report whether the step is complete.',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'mcp__github', 'mcp__firestore'],
  },
  tester: {
    role: 'tester',
    title: 'Tester',
    instructions:
      'You are the Tester. Verify that a built step meets its acceptance criteria. Run the relevant tests and type-checks, exercise the behavior, and report pass or fail with the evidence. Do not modify product code.',
    tools: ['Read', 'Bash', 'Glob', 'Grep', 'mcp__firestore'],
  },
  auditor: {
    role: 'auditor',
    title: 'Auditor',
    instructions:
      'You are the Auditor. Review a built and tested step for correctness, quality, and consistency with the architecture and the repository rules. This is the audit fixed-point: approve only when the work is right. Report pass or fail with specific findings.',
    tools: ['Read', 'Glob', 'Grep', 'mcp__github', 'mcp__firestore'],
  },
  optimizer: {
    role: 'optimizer',
    title: 'Optimizer',
    instructions:
      'You are the Optimizer. Study the metrics and signals and the live product, then propose new features or improvements and tune priorities. Turn what you learn into new feature documents.',
    tools: ['Read', 'Glob', 'Grep', 'mcp__firestore'],
  },
  supervisor: {
    role: 'supervisor',
    title: 'Supervisor',
    instructions:
      'You are the Supervisor. Watch orchestration health. Investigate blocked steps and repeated failures, decide whether to retry, re-plan, or escalate to a human, and keep the pipeline flowing.',
    tools: ['Read', 'Glob', 'Grep', 'mcp__github', 'mcp__firestore'],
  },
};

const converter = zodConverter(AgentDefinitionSchema);

export async function seedAgents(
  db: Firestore,
  now: number,
  agents: Record<string, AgentSeed> = DEFAULT_AGENTS,
): Promise<{ created: number }> {
  let created = 0;
  for (const [id, seed] of Object.entries(agents)) {
    const ref = db.collection('agents').doc(id).withConverter(converter);
    if ((await ref.get()).exists) continue;
    await ref.set({ ...seed, status: 'active', createdAt: now, updatedAt: now });
    created++;
  }
  return { created };
}

export async function exportAgents(db: Firestore): Promise<Record<string, AgentSeed>> {
  const snap = await db.collection('agents').withConverter(converter).get();
  const bundle: Record<string, AgentSeed> = {};
  for (const doc of snap.docs) {
    const data = doc.data();
    bundle[doc.id] = {
      role: data.role,
      title: data.title,
      instructions: data.instructions,
      tools: data.tools,
      ...(data.model !== undefined ? { model: data.model } : {}),
      ...(data.maxTurns !== undefined ? { maxTurns: data.maxTurns } : {}),
    };
  }
  return bundle;
}

import type { Firestore } from 'firebase-admin/firestore';
import { AgentDefinitionSchema, type AgentDefinition, type AgentRole } from '@schemas';
import { zodConverter } from './converter.js';
import { DEFAULT_AGENTS, type AgentSeed } from './default-agents.js';

export { DEFAULT_AGENTS };
export type { AgentSeed };

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

export async function loadAgent(db: Firestore, role: AgentRole): Promise<AgentDefinition | null> {
  const snap = await db.collection('agents').doc(role).withConverter(converter).get();
  return snap.exists ? (snap.data() ?? null) : null;
}

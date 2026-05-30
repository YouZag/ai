import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { orderBy } from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase.providers';
import { createRepo } from '../firebase/firestore-repo';
import { AgentDefinitionSchema, type AgentDefinition } from '@schemas';
import { DEFAULT_AGENTS, type AgentSeed } from '@shared/default-agents';

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly repo = createRepo(
    inject(FIRESTORE),
    AgentDefinitionSchema,
    'agents',
    isPlatformBrowser(inject(PLATFORM_ID)),
  );

  readonly agents = this.repo.list([orderBy('role')]);

  save(id: string, definition: AgentDefinition): Promise<void> {
    return this.repo.set(id, definition);
  }

  remove(id: string): Promise<void> {
    return this.repo.remove(id);
  }

  loadDefaults(): Promise<void> {
    return this.importBundle(DEFAULT_AGENTS);
  }

  async importBundle(bundle: Record<string, unknown>): Promise<void> {
    const now = Date.now();
    await Promise.all(
      Object.entries(bundle).map(([id, seed]) => {
        const definition = AgentDefinitionSchema.parse({
          ...(seed as Record<string, unknown>),
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
        return this.repo.set(id, definition);
      }),
    );
  }

  toBundle(): Record<string, AgentSeed> {
    const bundle: Record<string, AgentSeed> = {};
    for (const agent of this.agents.data()) {
      bundle[agent.id] = {
        role: agent.role,
        title: agent.title,
        instructions: agent.instructions,
        tools: agent.tools,
        ...(agent.model !== undefined ? { model: agent.model } : {}),
        ...(agent.maxTurns !== undefined ? { maxTurns: agent.maxTurns } : {}),
      };
    }
    return bundle;
  }
}

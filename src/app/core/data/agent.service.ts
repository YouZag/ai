import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FIRESTORE, FUNCTIONS } from '../firebase/firebase.providers';
import { createRepo } from '../firebase/firestore-repo';
import { AgentDefinitionSchema, type AgentDefinition } from '@schemas';

export interface ModelOption {
  id: string;
  displayName: string;
}

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly repo = createRepo(
    inject(FIRESTORE),
    AgentDefinitionSchema,
    'agents',
    isPlatformBrowser(inject(PLATFORM_ID)),
  );
  private readonly functions = inject(FUNCTIONS);

  readonly all = this.repo.list([orderBy('role')]);

  update(id: string, patch: Record<string, unknown>): Promise<void> {
    return this.repo.update(id, patch as unknown as Partial<AgentDefinition>);
  }

  async listModels(): Promise<ModelOption[]> {
    const callable = httpsCallable<unknown, { models: ModelOption[] }>(
      this.functions,
      'listModels',
    );
    const result = await callable();
    return result.data.models;
  }
}

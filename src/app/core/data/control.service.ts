import { Injectable, PLATFORM_ID, computed, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { orderBy } from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase.providers';
import { createRepo } from '../firebase/firestore-repo';
import { ControlSchema, type PipelinePhase } from '@schemas';

@Injectable({ providedIn: 'root' })
export class ControlService {
  private readonly repo = createRepo(
    inject(FIRESTORE),
    ControlSchema,
    'control',
    isPlatformBrowser(inject(PLATFORM_ID)),
  );

  private readonly pipeline = this.repo.list([orderBy('updatedAt', 'desc')]);

  readonly phase = computed<PipelinePhase>(() => this.pipeline.data()[0]?.phase ?? 'planning');

  setPhase(phase: PipelinePhase): Promise<void> {
    return this.repo.set('pipeline', { phase, updatedAt: Date.now() });
  }
}

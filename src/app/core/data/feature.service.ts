import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { orderBy } from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase.providers';
import { createRepo } from '../firebase/firestore-repo';
import { FeatureSchema, type Feature, type FeatureStatus } from '@schemas';

export interface NewFeature {
  title: string;
  description: string;
  priority: number;
  createdBy: string;
}

@Injectable({ providedIn: 'root' })
export class FeatureService {
  private readonly repo = createRepo(
    inject(FIRESTORE),
    FeatureSchema,
    'features',
    isPlatformBrowser(inject(PLATFORM_ID)),
  );

  readonly features = this.repo.list([orderBy('createdAt', 'desc')]);

  create(input: NewFeature): Promise<string> {
    return this.repo.create({
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: 'proposed',
      createdBy: input.createdBy,
      createdAt: Date.now(),
    });
  }

  setStatus(id: string, status: FeatureStatus): Promise<void> {
    return this.repo.update(id, { status });
  }
}

import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { addDoc, collection, doc, orderBy, updateDoc } from 'firebase/firestore';
import { of } from 'rxjs';
import { FIRESTORE } from '../firebase/firebase.providers';
import { zodConverter } from '../firebase/converter';
import { collection$, type WithId } from '../firebase/firestore-rx';
import { FeatureSchema, type Feature, type FeatureStatus } from '@schemas';

export interface NewFeature {
  title: string;
  description: string;
  priority: number;
  createdBy: string;
}

@Injectable({ providedIn: 'root' })
export class FeatureService {
  private readonly db = inject(FIRESTORE);
  private readonly col = collection(this.db, 'features').withConverter(zodConverter(FeatureSchema));

  readonly all = toSignal(
    isPlatformBrowser(inject(PLATFORM_ID))
      ? collection$<Feature>(this.db, FeatureSchema, 'features', [orderBy('createdAt', 'desc')])
      : of<WithId<Feature>[]>([]),
    { initialValue: [] as WithId<Feature>[] },
  );

  async create(input: NewFeature): Promise<void> {
    await addDoc(this.col, {
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: 'proposed',
      createdBy: input.createdBy,
      createdAt: Date.now(),
    });
  }

  async setStatus(id: string, status: FeatureStatus): Promise<void> {
    await updateDoc(doc(this.db, 'features', id), { status });
  }
}

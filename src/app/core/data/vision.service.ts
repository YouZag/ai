import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase.providers';
import { zodConverter } from '../firebase/converter';
import { createRepo } from '../firebase/firestore-repo';
import { VisionSchema, type Vision } from '@schemas';

@Injectable({ providedIn: 'root' })
export class VisionService {
  private readonly db = inject(FIRESTORE);
  private readonly ref = doc(this.db, 'vision', 'current').withConverter(zodConverter(VisionSchema));
  private readonly repo = createRepo(
    this.db,
    VisionSchema,
    'vision',
    isPlatformBrowser(inject(PLATFORM_ID)),
  );

  readonly current = this.repo.get('current');

  async load(): Promise<Vision | null> {
    const snap = await getDoc(this.ref);
    return snap.exists() ? snap.data() : null;
  }

  async save(vision: Vision): Promise<void> {
    await setDoc(this.ref, vision);
  }
}

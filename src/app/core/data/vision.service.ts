import { Injectable, inject } from '@angular/core';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase.providers';
import { zodConverter } from '../firebase/converter';
import { VisionSchema, type Vision } from '@schemas';

@Injectable({ providedIn: 'root' })
export class VisionService {
  private readonly db = inject(FIRESTORE);
  private readonly ref = doc(this.db, 'vision', 'current').withConverter(zodConverter(VisionSchema));

  async load(): Promise<Vision | null> {
    const snap = await getDoc(this.ref);
    return snap.exists() ? snap.data() : null;
  }

  async save(vision: Vision): Promise<void> {
    await setDoc(this.ref, vision);
  }
}

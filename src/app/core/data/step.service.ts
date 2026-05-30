import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { orderBy } from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase.providers';
import { createRepo } from '../firebase/firestore-repo';
import { StepSchema } from '@schemas';

@Injectable({ providedIn: 'root' })
export class StepService {
  private readonly repo = createRepo(
    inject(FIRESTORE),
    StepSchema,
    'steps',
    isPlatformBrowser(inject(PLATFORM_ID)),
  );

  readonly all = this.repo.list([orderBy('createdAt', 'desc')]);
}

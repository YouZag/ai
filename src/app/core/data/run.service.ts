import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { limit, orderBy } from 'firebase/firestore';
import { FIRESTORE } from '../firebase/firebase.providers';
import { createRepo } from '../firebase/firestore-repo';
import { RunSchema } from '@schemas';

@Injectable({ providedIn: 'root' })
export class RunService {
  private readonly repo = createRepo(
    inject(FIRESTORE),
    RunSchema,
    'runs',
    isPlatformBrowser(inject(PLATFORM_ID)),
  );

  readonly recent = this.repo.list([orderBy('createdAt', 'desc'), limit(50)]);
}

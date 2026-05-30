import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  type Auth,
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { FIREBASE_APP } from '../firebase/firebase.providers';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth: Auth | null;
  private readonly currentUser = signal<User | null>(null);

  readonly user = this.currentUser.asReadonly();
  readonly isAdmin = computed(() => {
    const email = this.currentUser()?.email;
    return !!email && environment.admins.includes(email);
  });

  constructor() {
    const app = inject(FIREBASE_APP);
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      this.auth = getAuth(app);
      if (environment.useEmulators) {
        connectAuthEmulator(this.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      }
      onAuthStateChanged(this.auth, (user) => this.currentUser.set(user));
    } else {
      this.auth = null;
    }
  }

  signIn(): Promise<unknown> {
    return this.auth ? signInWithPopup(this.auth, new GoogleAuthProvider()) : Promise.resolve();
  }

  signOut(): Promise<void> {
    return this.auth ? signOut(this.auth) : Promise.resolve();
  }
}

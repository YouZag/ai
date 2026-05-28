import {
  EnvironmentProviders,
  InjectionToken,
  makeEnvironmentProviders,
} from '@angular/core';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  Firestore,
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore';
import { environment } from '../../../environments/environment';

/** The initialized Firebase application (native Firebase Web SDK, no AngularFire). */
export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP');

/** Cloud Firestore instance for the default Firebase app. Inject this in services. */
export const FIRESTORE = new InjectionToken<Firestore>('FIRESTORE');

let emulatorConnected = false;

/**
 * Registers the Firebase app and Firestore with Angular's DI.
 *
 * Add `provideFirebase()` to the `providers` array in `app.config.ts`, then
 * inject `FIRESTORE` (or `FIREBASE_APP`) wherever you need Firestore access.
 */
export function provideFirebase(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: FIREBASE_APP,
      // initializeApp is not idempotent, so reuse an existing app if present.
      useFactory: (): FirebaseApp =>
        getApps()[0] ?? initializeApp(environment.firebase),
    },
    {
      provide: FIRESTORE,
      useFactory: (app: FirebaseApp): Firestore => {
        const firestore = getFirestore(app);
        if (environment.useEmulators && !emulatorConnected) {
          connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
          emulatorConnected = true;
        }
        return firestore;
      },
      deps: [FIREBASE_APP],
    },
  ]);
}

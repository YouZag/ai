export const environment = {
  production: false,
  // Firebase Web SDK config (safe to expose to the browser).
  // Fill these in from your Firebase project:
  // Project settings → General → Your apps → SDK setup and configuration.
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
  // Set true to point the client at the local Firestore emulator (run `npm run emulators`).
  useEmulators: false,
};

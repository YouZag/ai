export const environment = {
  production: true,
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
  // When true, the client connects to the local Firestore emulator (see firebase.json).
  useEmulators: false,
};

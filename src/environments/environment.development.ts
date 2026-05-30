export const environment = {
  production: false,
  // Firebase Web SDK config (safe to expose to the browser).
  // Fill these in from your Firebase project:
  // Project settings → General → Your apps → SDK setup and configuration.
  firebase: {
    apiKey: 'AIzaSyCwAH_wWAExuCAMFXQkizBBB9nLH9XpAXU',
    authDomain: 'youzagai.firebaseapp.com',
    projectId: 'youzagai',
    storageBucket: 'youzagai.firebasestorage.app',
    messagingSenderId: '1014423037911',
    appId: '1:1014423037911:web:a869ae1364f208aea9cd92',
  },
  // Set true to point the client at the local Firestore emulator (run `npm run emulators`).
  useEmulators: false,
  admins: ['drew@youzag.com'],
};

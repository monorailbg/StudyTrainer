import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// All six config values must be present for Firebase to be active.
// If any are missing the app runs in local-only (IndexedDB) mode.
const cfg = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            as string | undefined,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        as string | undefined,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         as string | undefined,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             as string | undefined,
};

export const isFirebaseConfigured = Object.values(cfg).every(Boolean);

let _app: FirebaseApp | null = null;
let _db:  Firestore | null = null;
let _storage: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  _app     = initializeApp(cfg as Required<typeof cfg>);
  _db      = getFirestore(_app);
  _storage = getStorage(_app);
}

export const firebaseDb      = _db;
export const firebaseStorage = _storage;

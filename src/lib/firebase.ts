import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

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

if (isFirebaseConfigured) {
  _app = initializeApp(cfg as Required<typeof cfg>);
  _db  = getFirestore(_app);
  // eslint-disable-next-line no-console
  console.info('%c[StudyTrainer] Firestore ON — notes, flashcards and quizzes are shared via Firebase.', 'color:#2EA043;font-weight:600');
} else {
  const missing = Object.entries(cfg).filter(([, v]) => !v).map(([k]) => k);
  // eslint-disable-next-line no-console
  console.warn(
    '[StudyTrainer] Cloud mode OFF — running local-only (IndexedDB). ' +
    'Uploads will NOT be shared. Missing/empty Firebase env vars at build time: ' +
    missing.join(', ') + '. Set them in .env and rebuild.'
  );
}

export const firebaseDb = _db;

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'roguelike-half.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'roguelike-half',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'roguelike-half.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

// APIキーおよびプロジェクトIDが設定されている場合のみFirebaseを初期化（未設定時はオフラインモードに安全フォールバック）
const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.warn('[Firebase] Firebase initialization failed; falling back to offline mode:', e);
  }
} else {
  console.info('[Firebase] Configuration missing or disabled; running in pure offline mode.');
}

export { app, auth, db };

// Configuración modular de Firebase v11+
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBb-I1DpbWPldUbDilJuSFvNHwpqJr9Cow",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "solibook-solideo.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "solibook-solideo",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "solibook-solideo.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "551478421232",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:551478421232:web:1ab3f9d456f7007b464435",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-42SV7N01QC"
};

// Inicialización singleton segura en SSR
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firestore con caché local persistente: la app puede leer y escribir sin
// conexión y los cambios se sincronizan solos al recuperar internet.
// persistentMultipleTabManager permite tener la app abierta en varias
// pestañas a la vez e ignoreUndefinedProperties protege las escrituras de
// objetos con campos opcionales vacíos.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true
});
export const auth = getAuth(app);
export const storage = getStorage(app);

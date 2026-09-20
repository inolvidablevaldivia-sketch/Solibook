import 'server-only';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const valorRequerido = (nombre: string): string => {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}.`);
  return valor;
};

export const obtenerFirebaseAdmin = () => {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: valorRequerido('FIREBASE_ADMIN_PROJECT_ID'),
        clientEmail: valorRequerido('FIREBASE_ADMIN_CLIENT_EMAIL'),
        privateKey: valorRequerido('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n')
      })
    });
  }

  return { db: getFirestore(), messaging: getMessaging() };
};

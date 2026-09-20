'use client';

import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { app, db } from '@/lib/firebase';

const COLECCION_DISPOSITIVOS = 'dispositivos_notificaciones';

export type EstadoPush =
  | 'no_soportado'
  | 'sin_configuracion'
  | 'denegado'
  | 'activo'
  | 'error';

const idSeguroDesdeToken = (uid: string, token: string): string => {
  let hash = 5381;
  for (let i = 0; i < token.length; i += 1) hash = (hash * 33) ^ token.charCodeAt(i);
  return `push-${uid}-${(hash >>> 0).toString(36)}`;
};

const obtenerRegistro = async (): Promise<ServiceWorkerRegistration> => {
  const existente = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
  return existente || navigator.serviceWorker.register('/firebase-messaging-sw.js');
};

export const estadoActualPush = async (): Promise<EstadoPush> => {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'no_soportado';
  }
  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) return 'sin_configuracion';
  if (Notification.permission === 'denied') return 'denegado';
  return Notification.permission === 'granted' ? 'activo' : 'error';
};

export const activarNotificacionesPush = async (uid: string): Promise<EstadoPush> => {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'no_soportado';
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) return 'sin_configuracion';

  try {
    const soportado = await isSupported();
    if (!soportado) return 'no_soportado';

    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return 'denegado';

    const registro = await obtenerRegistro();
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registro });
    if (!token) return 'error';

    const id = idSeguroDesdeToken(uid, token);
    const navegador = navigator.userAgent.slice(0, 240);
    await setDoc(
      doc(db, COLECCION_DISPOSITIVOS, id),
      {
        id,
        uid,
        token,
        navegador,
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString()
      },
      { merge: true }
    );

    return 'activo';
  } catch (error) {
    console.warn('[Push] No fue posible activar las notificaciones:', error);
    return 'error';
  }
};

// Se usa al cerrar sesión para retirar el dispositivo de los envíos futuros.
// No borra el permiso del navegador, que sólo la persona puede revocar.
export const retirarNotificacionesPush = async (uid: string): Promise<void> => {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) return;
  try {
    const soportado = await isSupported();
    if (!soportado) return;
    const registro = await obtenerRegistro();
    const token = await getToken(getMessaging(app), {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registro
    });
    if (token) await deleteDoc(doc(db, COLECCION_DISPOSITIVOS, idSeguroDesdeToken(uid, token)));
  } catch {
    // Cerrar sesión nunca debe quedar bloqueado por una suscripción push.
  }
};

let escuchaInstalada = false;

// En primer plano FCM entrega el mensaje a JavaScript, no al service worker.
// Se muestra una notificación nativa para que la experiencia sea consistente.
export const instalarEscuchaPushEnPrimerPlano = async (): Promise<void> => {
  if (escuchaInstalada || typeof window === 'undefined' || Notification.permission !== 'granted') return;
  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) return;

  try {
    const soportado = await isSupported();
    if (!soportado) return;
    escuchaInstalada = true;
    onMessage(getMessaging(app), payload => {
      const titulo = payload.notification?.title || 'Solibook';
      const opciones: NotificationOptions = {
        body: payload.notification?.body || 'Tienes un nuevo recordatorio.',
        icon: '/icon-192.png',
        tag: payload.messageId || 'solibook-aviso'
      };
      new Notification(titulo, opciones);
    });
  } catch {
    escuchaInstalada = false;
  }
};

/* global firebase */
// Service worker de Firebase Cloud Messaging para avisos del calendario y cumpleaños cuando
// Solibook está cerrada. La configuración web de Firebase no es secreta.
// Registrar antes de Firebase para controlar también sus notificaciones
// automáticas. Reutiliza una ventana propia y abre la agenda al tocar el aviso.
self.addEventListener('notificationclick', event => {
  event.stopImmediatePropagation();
  event.notification.close();
  const datos = event.notification.data;
  const enlace = datos?.url || datos?.FCM_MSG?.fcmOptions?.link || '/';
  let destino;
  try {
    const url = new URL(enlace, self.location.origin);
    destino = url.origin === self.location.origin ? url.href : self.location.origin;
  } catch { destino = self.location.origin; }
  event.waitUntil((async () => {
    const ventanas = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existente = ventanas.find(ventana => new URL(ventana.url).origin === self.location.origin);
    if (existente) {
      const navegada = await existente.navigate(destino);
      return (navegada || existente).focus();
    }
    return clients.openWindow(destino);
  })());
});

importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBb-I1DpbWPldUbDilJuSFvNHwpqJr9Cow',
  authDomain: 'solibook-solideo.firebaseapp.com',
  projectId: 'solibook-solideo',
  storageBucket: 'solibook-solideo.firebasestorage.app',
  messagingSenderId: '551478421232',
  appId: '1:551478421232:web:1ab3f9d456f7007b464435'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  // FCM ya muestra automáticamente los mensajes con notification. Mostrarlos
  // otra vez aquí producía dos avisos por un único envío.
  if (payload.notification) return;
  const titulo = payload.data?.title || 'Solibook';
  const opciones = {
    body: payload.data?.body || 'Tienes un nuevo recordatorio.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.messageId || 'solibook-aviso',
    data: { url: payload.fcmOptions?.link || '/' }
  };

  self.registration.showNotification(titulo, opciones);
});

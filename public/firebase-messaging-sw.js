/* global firebase */
// Service worker de Firebase Cloud Messaging para avisos de cumpleaños cuando
// Solibook está cerrada. La configuración web de Firebase no es secreta.
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
  const titulo = payload.notification?.title || 'Solibook';
  const opciones = {
    body: payload.notification?.body || 'Tienes un nuevo recordatorio.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.messageId || 'solibook-aviso',
    data: { url: payload.fcmOptions?.link || '/' }
  };

  self.registration.showNotification(titulo, opciones);
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destino = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ventanas => {
      const existente = ventanas.find(ventana => 'focus' in ventana);
      if (existente) return existente.focus();
      return clients.openWindow(destino);
    })
  );
});

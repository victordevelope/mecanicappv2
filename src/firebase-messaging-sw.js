/* global importScripts, firebase, self */
importScripts('https://www.gstatic.com/firebasejs/9.6.11/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.11/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID'
});

const messaging = firebase.messaging();

// Opcional: manejar notificaciones en background
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'MecanicApp';
  const options = {
    body: payload.notification?.body || 'Tienes un nuevo recordatorio',
    icon: '/assets/icon/icon-192x192.png'
  };
  self.registration.showNotification(title, options);
});
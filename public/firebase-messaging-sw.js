importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Fetch config from the same origin
fetch('/firebase-applet-config.json')
  .then(response => {
    if (!response.ok) throw new Error('Failed to fetch config');
    return response.json();
  })
  .then(config => {
    firebase.initializeApp(config);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[SW] Background notification received:', payload);
      
      const notificationTitle = payload.notification.title || 'تنبیه جديد من supplyX';
      const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: payload.data?.requestId || 'general',
        data: payload.data
      };

      return self.registration.showNotification(notificationTitle, notificationOptions);
    });
  })
  .catch(err => console.error('[SW] Initialization error:', err));

// Add listener for notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus().then(c => c.navigate(link));
      }
      return clients.openWindow(link);
    })
  );
});

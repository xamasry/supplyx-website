importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Should be replaced with actual config or fetched if needed, 
// for simplicity in this environment we use the same config.
// However, in a real build, we'd ideally inject this.
fetch('/firebase-applet-config.json')
  .then(response => response.json())
  .then(config => {
    firebase.initializeApp(config);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message ', payload);
      const notificationTitle = payload.notification.title;
      const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon.svg'
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  });

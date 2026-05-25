// sw.js - Basic Service Worker for notifications and PWA installability

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let message = event.data ? event.data.text() : 'Yeni Bildirim';

    // Fallback parsing if JSON
    try {
        const parsed = JSON.parse(message);
        const title = parsed.title || 'Q-Chat';
        const options = {
            body: parsed.body || '',
            icon: '/static/icons/icon-192.png',
            badge: '/static/icons/icon-192.png',
            vibrate: [200, 100, 200, 100, 200, 100, 200]
        };
        event.waitUntil(self.registration.showNotification(title, options));
    } catch {
        // Plain string message
        event.waitUntil(
            self.registration.showNotification('Q-Chat', {
                body: message,
                icon: '/static/icons/icon-192.png',
                badge: '/static/icons/icon-192.png'
            })
        );
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if there is already a window/tab open with the target URL
            for (let i = 0; i < windowClients.length; i++) {
                let client = windowClients[i];
                if (client.url.includes('/') && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

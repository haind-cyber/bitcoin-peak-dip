// Bitcoin PeakDip Service Worker
// Version: 1.12.40 - PRODUCTION READY
// Features: Cache, Push Notifications, Badge Sync, Version Check

const CACHE_NAME = 'bitcoin-peakdip-v1.12.40';
const DYNAMIC_CACHE = 'bitcoin-peakdip-dynamic-v1.12.40';
const ARTICLE_CACHE = 'article-cache-v1';

// Local assets - cache đầu tiên
const LOCAL_ASSETS = [
  '/',
  '/index.html',
  '/about.html',
  '/product.html',
  '/signals.html',
  '/learn.html',
  '/reading-list.html',
  '/offline.html',
  '/manifest.json',
  '/version.json',
  '/assets/css/main.css',
  '/assets/css/about.css',
  '/assets/css/product.css',
  '/assets/css/signals.css',
  '/assets/css/learn.css',
  '/assets/css/zoom.css',
  '/assets/js/main.js',
  '/assets/js/interactions.js',
  '/assets/js/product.js',
  '/assets/js/signals.js',
  '/assets/js/learn.js',
  '/assets/js/reading-list.js',
  '/assets/js/notifications.js',
  '/assets/js/update-notifier.js',
  '/assets/js/shared.js',
  '/assets/icons/icon-72x72.png',
  '/assets/icons/icon-96x96.png',
  '/assets/icons/icon-128x128.png',
  '/assets/icons/icon-152x152.png',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-384x384.png',
  '/assets/icons/icon-512x512.png'
];

// CDN assets - network only
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns'
];

// ========== HELPER FUNCTIONS ==========

function getVersionFromCacheName(cacheName) {
  const match = cacheName.match(/v([\d\.]+)/);
  return match ? match[1] : '1.12.37';
}

// ========== BADGE MANAGEMENT ==========

async function updateAppBadge(count) {
  try {
    if (self.navigator && self.navigator.setAppBadge) {
      if (count > 0) {
        await self.navigator.setAppBadge(count);
      } else {
        await self.navigator.clearAppBadge();
      }
    }
  } catch (error) {
    console.log('App badge update failed:', error);
  }
}

// ========== INSTALL EVENT ==========

self.addEventListener('install', event => {
  console.log('📦 Service Worker installing...');
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.allSettled(
          LOCAL_ASSETS.map(url => {
            return cache.add(url).catch(err => {
              console.warn(`⚠️ Failed to cache ${url}:`, err.message);
              return Promise.resolve();
            });
          })
        );
      })
  );
});

// ========== ACTIVATE EVENT ==========

self.addEventListener('activate', event => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== DYNAMIC_CACHE && name !== ARTICLE_CACHE)
            .map(name => {
              console.log('🗑️ Removing old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        return clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'PWA_UPDATED',
              version: '1.12.37'
            });
          });
        });
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// ========== MESSAGE HANDLER ==========

self.addEventListener('message', event => {
  if (!event.data) return;
  
  switch (event.data.type) {
    case 'CHECK_VERSION':
      event.waitUntil(
        clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'VERSION_RESPONSE',
              version: getVersionFromCacheName(CACHE_NAME)
            });
          });
        })
      );
      break;
    
    case 'UPDATE_BADGE':
      if (event.data.count !== undefined) {
        event.waitUntil(updateAppBadge(event.data.count));
        
        // Forward to other clients (tránh loop)
        event.waitUntil(
          clients.matchAll().then(clients => {
            clients.forEach(client => {
              if (client.id !== event.source?.id) {
                client.postMessage({
                  type: 'UPDATE_BADGE',
                  count: event.data.count,
                  source: 'sw'
                });
              }
            });
          })
        );
      }
      break;
    
    case 'FORCE_UPDATE':
      event.waitUntil(
        caches.keys().then(cacheNames => {
          return Promise.all(
            cacheNames.map(name => caches.delete(name))
          );
        }).then(() => {
          return clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'UPDATE_COMPLETED',
                message: 'Cache cleared, ready to reload'
              });
            });
          });
        })
      );
      break;
  }
});

// ========== PUSH EVENT (FCM) ==========

self.addEventListener('push', event => {
  console.log('📨 Push received');
  
  let data = {
    title: 'Bitcoin PeakDip',
    body: 'New update available',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-72x72.png',
    data: {
      url: '/learn/',
      type: 'push'
    }
  };
  
  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  // Thông báo cho clients
  event.waitUntil(
    clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'PUSH_RECEIVED',
          payload: data
        });
      });
    })
  );
  
  // Hiển thị notification
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      vibrate: [200, 100, 200],
      data: data.data,
      actions: data.actions || [
        { action: 'read', title: '📖 Read Now' },
        { action: 'later', title: '⏰ Read Later' }
      ],
      tag: data.tag || 'push',
      renotify: true,
      requireInteraction: true
    })
  );
});

// ========== NOTIFICATION CLICK ==========

self.addEventListener('notificationclick', event => {
  console.log('🔔 Notification clicked:', event.action);
  event.notification.close();
  
  const data = event.notification.data;
  const urlToOpen = data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

// ========== PERIODIC SYNC (ONLY VERSION CHECK) ==========

self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-check') {
    event.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  try {
    const response = await fetch('/version.json?t=' + Date.now());
    const data = await response.json();
    const currentVersion = getVersionFromCacheName(CACHE_NAME);
    
    if (data.version !== currentVersion) {
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'NEW_VERSION_AVAILABLE',
          version: data.version
        });
      });
    }
  } catch (error) {
    console.log('Periodic sync check failed:', error);
  }
}

// ========== FETCH HANDLER ==========

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip non-GET
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.protocol === 'chrome:' || url.protocol === 'about:') return;
  
  // CDN assets - network only
  if (CDN_ASSETS.includes(event.request.url)) {
    event.respondWith(
      fetch(event.request).catch(() => {
        if (url.pathname.includes('font-awesome')) {
          return new Response('', { 
            status: 200,
            headers: { 'Content-Type': 'text/css' }
          });
        }
        return new Response('', { status: 408 });
      })
    );
    return;
  }
  
  // version.json - network first
  if (url.pathname.includes('version.json')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // articles.json - network first
  if (url.pathname.includes('/assets/data/articles.json')) {
    event.respondWith(networkFirst(event.request));
    return;
  }  
  
  // CSV files - network first
  if (url.pathname.includes('/data/') || url.pathname.includes('.csv')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // HTML pages - stale while revalidate
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Static assets - cache first
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|ico|woff2?|ttf)$/)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Default - network first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ========== CACHING STRATEGIES ==========

function networkFirst(request) {
  return fetch(request)
    .then(response => {
      if (response && response.ok) {
        const responseClone = response.clone();
        caches.open(DYNAMIC_CACHE)
          .then(cache => cache.put(request, responseClone));
      }
      return response;
    })
    .catch(() => {
      return caches.match(request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        if (request.headers.get('Accept')?.includes('text/html')) {
          return caches.match('/offline.html');
        }
        return new Response('Offline', { status: 408 });
      });
    });
}

function cacheFirst(request) {
  return caches.match(request)
    .then(cachedResponse => {
      if (cachedResponse) return cachedResponse;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then(cache => cache.put(request, responseClone));
        }
        return response;
      });
    });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(cachedResponse => {
    const fetchPromise = fetch(request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          caches.open(DYNAMIC_CACHE)
            .then(cache => cache.put(request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => cachedResponse || new Response('Offline', { status: 408 }));
    
    return cachedResponse || fetchPromise;
  });
}

console.log('✅ Service Worker v1.12.37 loaded');
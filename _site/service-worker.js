// Bitcoin PeakDip Service Worker
// Version: 1.12.37 - OPTIMIZED - Only essential features
// Các chức năng được giữ lại:
// - Cache static assets
// - Push notifications (FCM)
// - Version checking
// - Badge updates

const CACHE_NAME = 'bitcoin-peakdip-v1.12.37';
const DYNAMIC_CACHE = 'bitcoin-peakdip-dynamic-v1.12.37';
const ARTICLE_CACHE = 'article-cache-v1';

// Local assets - có thể cache
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

// CDN assets - network only, không cache
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
    // Badge API (PWA)
    if (self.navigator && self.navigator.setAppBadge) {
      if (count > 0) {
        await self.navigator.setAppBadge(count);
        console.log(`📱 App badge updated: ${count}`);
      } else {
        await self.navigator.clearAppBadge();
        console.log('📱 App badge cleared');
      }
    }
    
    // Thông báo cho tất cả clients để update favicon
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'UPDATE_BADGE',
        count: count
      });
    });
  } catch (error) {
    console.log('App badge update failed:', error);
  }
}

async function clearAppBadge() {
  try {
    if (self.navigator && self.navigator.clearAppBadge) {
      await self.navigator.clearAppBadge();
      console.log('📱 App badge cleared');
    }
  } catch (error) {
    console.log('Clear app badge failed:', error);
  }
}

// ========== INSTALL EVENT ==========
self.addEventListener('install', event => {
  console.log(`📦 Service Worker installing version 1.12.37...`);
  
  // Force activation
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
  console.log(`🚀 Service Worker activating version 1.12.37...`);
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        // Xóa cache cũ
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
        // Thông báo cho tất cả clients về version mới
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
  console.log('📨 Service Worker received message:', event.data);
  
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
      }
      break;
    
    case 'CLEAR_BADGE':
      event.waitUntil(clearAppBadge());
      break;
    
    case 'FORCE_UPDATE':
      console.log('🔄 Force update requested');
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

// ========== PUSH EVENT HANDLER (FCM) ==========
self.addEventListener('push', function(event) {
  console.log('📨 Push received:', event);
  
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

// ========== NOTIFICATION CLICK HANDLER ==========
self.addEventListener('notificationclick', function(event) {
  console.log('🔔 Notification clicked:', event.action);
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data;
  
  if (action === 'later' && data?.articleId) {
    event.waitUntil(handleSaveForLater(data));
    return;
  }
  
  const urlToOpen = data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

// ========== HANDLE SAVE FOR LATER ==========
async function handleSaveForLater(data) {
  console.log('💾 Saving for later:', data);
  
  try {
    const cache = await caches.open('reading-list-queue');
    await cache.put(
      'pending-save',
      new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SAVE_FOR_LATER',
        article: {
          id: data.articleId || data.id,
          title: data.title,
          slug: data.slug,
          date: data.date,
          url: data.url
        }
      });
    });
  } catch (error) {
    console.error('❌ Error saving for later:', error);
  }
}

// ========== PERIODIC SYNC (CHỈ GIỮ LẠI UPDATE CHECK) ==========
self.addEventListener('periodicsync', event => {
  console.log('🔄 Periodic sync triggered:', event.tag);
  
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
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') return;
  
  // Skip chrome:// and about://
  if (url.protocol === 'chrome:' || url.protocol === 'about:') return;
  
  // CDN assets - network only, không cache
  if (CDN_ASSETS.includes(event.request.url)) {
    event.respondWith(
      fetch(event.request)
        .catch(error => {
          console.warn(`⚠️ CDN fetch failed: ${url.pathname}`, error.message);
          if (url.pathname.includes('font-awesome')) {
            return new Response('', { 
              status: 200,
              headers: { 'Content-Type': 'text/css' }
            });
          }
          if (url.pathname.includes('chart.js')) {
            return new Response('', { 
              status: 200,
              headers: { 'Content-Type': 'application/javascript' }
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
  
  // articles.json
  if (url.pathname.includes('/assets/data/articles.json')) {
    event.respondWith(networkFirst(event.request));
    return;
  }  
  
  // API/CSV requests - network first
  if (url.pathname.includes('/data/') || url.pathname.includes('.csv')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // HTML pages - stale while revalidate
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // CSS/JS/Images/Fonts - cache first
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|ico|woff2?|ttf)$/)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Default - network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

// ========== CACHING STRATEGIES ==========
function networkFirst(request) {
  return fetch(request)
    .then(response => {
      if (response && response.ok) {
        const responseClone = response.clone();
        caches.open(DYNAMIC_CACHE)
          .then(cache => {
            cache.put(request, responseClone);
          });
      }
      return response;
    })
    .catch(() => {
      return caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (request.headers.get('Accept')?.includes('text/html')) {
            return caches.match('/offline.html');
          }
          if (request.url.includes('.csv')) {
            return new Response(
              'timestamp,signal_type,price,confidence,validation\n' +
              new Date().toISOString() + ',OFFLINE,50000,0,PENDING',
              {
                headers: { 'Content-Type': 'text/csv' }
              }
            );
          }
          return new Response('Offline', { status: 408 });
        });
    });
}

function cacheFirst(request) {
  if (request.url.startsWith('chrome-extension://')) {
    return fetch(request);
  }
  
  return caches.match(request)
    .then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request)
        .then(response => {
          if (response && response.ok && !request.url.startsWith('chrome-extension://')) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => {
                cache.put(request, responseClone);
              });
          }
          return response;
        });
    });
}

function staleWhileRevalidate(request) {
  if (request.url.startsWith('chrome-extension://')) {
    return fetch(request);
  }
  
  return caches.match(request).then(cachedResponse => {
    const fetchPromise = fetch(request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          caches.open(DYNAMIC_CACHE)
            .then(cache => {
              cache.put(request, responseToCache);
            });
        }
        return networkResponse;
      })
      .catch(error => {
        console.log('Network request failed:', error);
        return cachedResponse || new Response('Offline', { status: 408 });
      });
    
    return cachedResponse || fetchPromise;
  });
}

console.log('✅ Service Worker v1.12.37 loaded successfully - Optimized version');
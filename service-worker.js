// Bitcoin PeakDip Service Worker
// Version: 1.12.26 - BADGE HANDLING & PUSH NOTIFICATION
// Đồng bộ với build system

const CACHE_NAME = 'bitcoin-peakdip-v1.12.26';
const DYNAMIC_CACHE = 'bitcoin-peakdip-dynamic-v1.12.26';
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

// CDN assets - không cache, chỉ fetch khi cần
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
  return match ? match[1] : '1.12.15';
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
  console.log(`📦 Service Worker installing version 1.12.15...`);
  
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
      .then(() => registerPeriodicSync())
  );
});

// ========== REGISTER PERIODIC SYNC ==========
async function registerPeriodicSync() {
  try {
    if ('periodicSync' in self.registration) {
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync',
      });
      
      if (status.state === 'granted') {
        await self.registration.periodicSync.register('check-new-articles', {
          minInterval: 60 * 60 * 1000 // 1 giờ
        });
        console.log('✅ Periodic background sync registered');
      }
    }
  } catch (error) {
    console.log('Periodic sync not supported:', error);
  }
}

// ========== ACTIVATE EVENT ==========
self.addEventListener('activate', event => {
  console.log(`🚀 Service Worker activating version 1.12.15...`);
  
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
              version: '1.12.15'
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
    
    case 'SHOW_NOTIFICATION':
      const article = event.data.article;
      event.waitUntil(
        self.registration.showNotification('📚 Bài viết mới từ Bitcoin PeakDip', {
          body: article.body,
          icon: '/assets/icons/icon-192x192.png',
          badge: '/assets/icons/icon-72x72.png',
          vibrate: [200, 100, 200],
          data: {
            url: article.url,
            articleId: article.id,
            slug: article.slug,
            title: article.title,
            date: article.date
          },
          actions: [
            { action: 'read', title: '📖 Đọc ngay' },
            { action: 'later', title: '⏰ Đọc sau' }
          ],
          tag: `article-${article.id}`,
          renotify: true,
          requireInteraction: true
        })
      );
      break;
    
    case 'GET_NOTIFIED_IDS':
      // Client yêu cầu danh sách ID đã thông báo
      event.waitUntil(
        caches.open(ARTICLE_CACHE).then(cache => {
          return cache.match('notified-ids').then(response => {
            if (response) {
              return response.json();
            }
            return { ids: [] };
          }).then(data => {
            // Gửi lại cho client
            return clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'NOTIFIED_IDS_RESPONSE',
                  ids: data.ids || []
                });
              });
            });
          });
        })
      );
      break;
    
    case 'SAVE_NOTIFIED_IDS':
      // Lưu danh sách ID đã thông báo
      if (event.data.ids) {
        event.waitUntil(
          caches.open(ARTICLE_CACHE).then(cache => {
            return cache.put(
              'notified-ids',
              new Response(JSON.stringify({ ids: event.data.ids }), {
                headers: { 'Content-Type': 'application/json' }
              })
            );
          }).then(() => {
            // Update badge dựa trên số lượng unread
            return caches.open(ARTICLE_CACHE).then(cache => {
              return cache.match('/assets/data/articles.json').then(response => {
                if (response) {
                  return response.json();
                }
                return { articles: [] };
              }).then(data => {
                const allIds = data.articles?.map(a => a.id) || [];
                const unreadCount = allIds.filter(id => !event.data.ids.includes(id)).length;
                return updateAppBadge(unreadCount);
              });
            });
          })
        );
      }
      break;
    
    case 'UPDATE_BADGE':
      if (event.data.count !== undefined) {
        event.waitUntil(updateAppBadge(event.data.count));
      }
      break;
    
    case 'CLEAR_BADGE':
      event.waitUntil(clearAppBadge());
      break;
    
    case 'CHECK_NEW_ARTICLES':
      console.log('🔍 Checking for new articles...');
      event.waitUntil(checkForNewArticles());
      break;
    
    default:
      console.log('Unknown message type:', event.data.type);
  }
});

// ========== BACKGROUND CHECK FOR NEW ARTICLES ==========
async function checkForNewArticles() {
  console.log('🔍 Background checking for new articles...');
  
  try {
    // Lấy articles đã cache
    const cache = await caches.open(ARTICLE_CACHE);
    const cachedResponse = await cache.match('/assets/data/articles.json');
    
    let cachedArticles = [];
    if (cachedResponse) {
      const cachedData = await cachedResponse.json();
      cachedArticles = cachedData.articles || [];
    }
    
    // Lấy notified IDs từ cache
    const notifiedResponse = await cache.match('notified-ids');
    let notifiedIds = [];
    if (notifiedResponse) {
      const notifiedData = await notifiedResponse.json();
      notifiedIds = notifiedData.ids || [];
    }
    
    // Fetch latest articles
    const fetchUrl = '/assets/data/articles.json?t=' + Date.now();
    const response = await fetch(fetchUrl, {
      headers: { 'Cache-Control': 'no-cache, no-store' }
    });
    
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    
    const data = await response.json();
    const newArticles = data.articles || [];
    
    // Find new articles not in cache
    const cachedIds = new Set(cachedArticles.map(a => a.id));
    const actuallyNew = newArticles.filter(a => !cachedIds.has(a.id));
    
    if (actuallyNew.length > 0) {
      console.log(`📢 Found ${actuallyNew.length} new articles in background`);
      
      // Lọc những bài chưa được thông báo
      const unNotifiedArticles = actuallyNew.filter(a => !notifiedIds.includes(a.id));
      
      if (unNotifiedArticles.length > 0) {
        console.log(`🔔 Showing notification for ${unNotifiedArticles.length} new articles`);
        
        // Show notification
        await showNewArticlesNotification(unNotifiedArticles);
        
        // Update notified IDs
        const newIds = [...notifiedIds, ...unNotifiedArticles.map(a => a.id)];
        await cache.put(
          'notified-ids',
          new Response(JSON.stringify({ ids: newIds }), {
            headers: { 'Content-Type': 'application/json' }
          })
        );
        
        // Update badge
        await updateAppBadge(unNotifiedArticles.length);
      }
      
      // Update cache với articles mới
      await cache.put('/assets/data/articles.json', response.clone());
      
      // Thông báo cho tất cả clients đang mở
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'NEW_ARTICLES_AVAILABLE',
          count: unNotifiedArticles.length,
          articles: unNotifiedArticles.map(a => ({ id: a.id, title: a.title }))
        });
      });
    } else {
      console.log('📭 No new articles found');
    }
  } catch (error) {
    console.error('❌ Background check failed:', error);
  }
}

// ========== SHOW NEW ARTICLES NOTIFICATION ==========
async function showNewArticlesNotification(articles) {
  if (articles.length === 0) return;
  
  if (articles.length === 1) {
    const article = articles[0];
    
    await self.registration.showNotification('📚 New Article from Bitcoin PeakDip', {
      body: `${article.title}\n⏱️ ${article.reading_time || 5} min read • ${article.level || 'Beginner'}`,
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      data: {
        url: article.url || `/learn/${article.id}.html`,
        articleId: article.id,
        title: article.title,
        type: 'single'
      },
      actions: [
        { action: 'read', title: '📖 Read Now' },
        { action: 'later', title: '⏰ Save for Later' }
      ],
      tag: `article-${article.id}`,
      renotify: true,
      requireInteraction: true
    });
    
  } else {
    const titles = articles.map(a => `• ${a.title}`).join('\n').substring(0, 150);
    
    await self.registration.showNotification(`📚 ${articles.length} New Articles from Bitcoin PeakDip`, {
      body: titles + (titles.length >= 150 ? '...' : ''),
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      data: {
        url: '/learn/',
        articles: articles.map(a => ({ id: a.id, title: a.title })),
        type: 'multiple',
        timestamp: Date.now()
      },
      actions: [
        { action: 'view', title: '👀 View All' }
      ],
      tag: 'multiple-articles',
      renotify: true,
      requireInteraction: true
    });
  }
}

// ========== NOTIFICATION CLICK HANDLER ==========
self.addEventListener('notificationclick', event => {
  console.log('🔔 Notification clicked:', event.action);
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data;
  
  if (action === 'later' && data.articleId) {
    event.waitUntil(handleSaveForLater(data));
    return;
  }
  
  if (action === 'read' || action === 'view' || !action) {
    const url = data?.url || '/learn/';
    
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then(clientList => {
          for (const client of clientList) {
            if (client.url === url && 'focus' in client) {
              return client.focus();
            }
          }
          return clients.openWindow(url);
        })
    );
  }
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

// ========== PUSH NOTIFICATION HANDLER ==========
self.addEventListener('push', event => {
  console.log('📨 Push notification received', event);
  
  let data = {
    title: 'Bitcoin PeakDip',
    body: 'New article available!',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/learn/',
      type: 'new-articles',
      timestamp: Date.now()
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
      vibrate: data.vibrate || [200, 100, 200],
      data: data.data,
      actions: data.actions || [
        { action: 'view', title: '📖 View Articles' }
      ],
      tag: data.tag || 'push-notification',
      renotify: true,
      requireInteraction: true
    })
  );
});

// ========== PERIODIC SYNC ==========
self.addEventListener('periodicsync', event => {
  console.log('🔄 Periodic sync triggered:', event.tag);
  
  if (event.tag === 'check-new-articles') {
    event.waitUntil(checkForNewArticles());
  }
  
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

// ========== BACKGROUND SYNC ==========
self.addEventListener('sync', event => {
  console.log('🔄 Sync event:', event.tag);
  
  if (event.tag === 'sync-csv-data') {
    console.log('🔄 Background sync triggered');
    event.waitUntil(syncCSVData());
  }
  
  if (event.tag === 'sync-reading-list') {
    event.waitUntil(syncReadingList());
  }
});

async function syncCSVData() {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const keys = await cache.keys();
    
    for (const request of keys) {
      if (request.url.includes('offline-upload')) {
        const response = await cache.match(request);
        const data = await response.text();
        console.log('Syncing offline data:', data);
        await cache.delete(request);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

async function syncReadingList() {
  try {
    const cache = await caches.open('reading-list-queue');
    const response = await cache.match('pending-save');
    
    if (response) {
      const data = await response.json();
      console.log('Syncing reading list item:', data);
      
      // Gửi lại cho client
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SAVE_FOR_LATER',
          article: data
        });
      });
      
      await cache.delete('pending-save');
    }
  } catch (error) {
    console.error('Reading list sync failed:', error);
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

console.log('✅ Service Worker v1.12.15 loaded successfully with Badge Handling');
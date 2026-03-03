// notifications.js - Hệ thống thông báo bài viết mới
// Version: 4.2.0 - PRODUCTION READY - Tối ưu cho mobile/desktop
// Tương thích với service-worker.js v1.12.19+
// Optimized for parallel execution and battery life

const NOTIFICATION_CONFIG = {
    version: '4.2.0',
    // Mobile: 6 giờ, Desktop: 1 giờ
    checkInterval: typeof window !== 'undefined' && window.IS_MOBILE 
        ? 6 * 60 * 60 * 1000  // 6 giờ trên mobile
        : 60 * 60 * 1000,      // 1 giờ trên desktop
    
    // Background check (khi tab không active)
    backgroundCheckInterval: 24 * 60 * 60 * 1000, // 24 giờ
    
    articleMetadataPath: '/assets/data/articles.json',
    notifiedKey: 'peakdip_notified_articles_v4',
    enabledKey: 'peakdip_notifications_enabled',
    cacheKey: 'peakdip_articles_cache_v4',
    cacheTimeKey: 'peakdip_articles_cache_time_v4',
    
    // Cache duration: 24h mobile, 1h desktop
    cacheDuration: typeof window !== 'undefined' && window.IS_MOBILE 
        ? 24 * 60 * 60 * 1000 
        : 60 * 60 * 1000,
    
    permissionPromptedKey: 'peakdip_permission_prompted',
    maxRetries: typeof window !== 'undefined' && window.IS_MOBILE ? 1 : 3,
    retryDelay: 5000,
    pushServerUrl: '/api',
    tooltipDismissedKey: 'notification_tooltip_dismissed',
    newBadgeDismissedKey: 'notification_new_badge_dismissed',
    
    // Throttle settings
    fetchTimeout: typeof window !== 'undefined' && window.IS_MOBILE ? 3000 : 5000,
    usePeriodicSync: typeof window !== 'undefined' && !window.IS_MOBILE,
    
    // Idle detection
    idleThreshold: 30 * 60 * 1000, // 30 phút
    idleCheckInterval: 60 * 1000    // 1 phút kiểm tra 1 lần
};

class ArticleNotificationSystem {
    constructor() {
        this.articles = [];
        this.notifiedIds = this.getNotifiedIds();
        this.checkInterval = null;
        this.isEnabled = this.getNotificationStatus();
        this.lastCheckTime = null;
        this.pendingArticles = [];
        this.permissionPrompted = localStorage.getItem(NOTIFICATION_CONFIG.permissionPromptedKey) === 'true';
        this.initialized = false;
        this.initPromise = null;
        this.retryCount = 0;
        this.swRegistration = null;
        this.pushSubscription = null;
        this.unreadCount = this.getUnreadCount();
        this.articlesMetadata = null;
        this.isFirstTimeEnable = true;
        this.clickTimeout = null;
        this.messageHandlerId = null;
        this.tooltipShown = false;
        this.newBadgeShown = false;
        
        // Mobile optimization flags
        this.isMobile = typeof window !== 'undefined' && (
            window.IS_MOBILE || 
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator?.userAgent || '') || 
            (typeof window.innerWidth !== 'undefined' && window.innerWidth <= 768)
        );
        
        // Idle detection
        this.lastUserInteraction = Date.now();
        this.idleMode = false;
        this.tabHidden = false;
        this.pendingCheck = false;
    }

    // ===== IDLE DETECTION =====
    setupIdleDetection() {
        if (typeof document === 'undefined') return;
        
        // Reset timer khi user tương tác
        const resetIdle = () => {
            this.lastUserInteraction = Date.now();
            this.idleMode = false;
        };
        
        ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'].forEach(event => {
            document.addEventListener(event, resetIdle, { passive: true });
        });
        
        // Kiểm tra idle mỗi phút
        setInterval(() => {
            const idleTime = Date.now() - this.lastUserInteraction;
            this.idleMode = idleTime > NOTIFICATION_CONFIG.idleThreshold;
            
            if (this.idleMode) {
                console.log('💤 User idle mode - reducing checks');
            }
        }, NOTIFICATION_CONFIG.idleCheckInterval);
        
        // Theo dõi visibility change
        document.addEventListener('visibilitychange', () => {
            this.tabHidden = document.hidden;
            
            if (document.hidden) {
                // Khi vào background - clear interval
                this.stopPolling();
                console.log('📱 Tab hidden - stopped polling');
            } else {
                // Khi active trở lại - start polling với interval phù hợp
                this.startPolling();
                // Check ngay lập tức nếu có pending
                if (this.pendingCheck) {
                    this.pendingCheck = false;
                    this.loadArticlesWithRetry(true, false);
                }
                console.log('📱 Tab visible - resumed polling');
            }
        });
        
        // Theo dõi online/offline
        window.addEventListener('online', () => {
            console.log('📱 Back online - checking for updates');
            setTimeout(() => this.loadArticlesWithRetry(true, false), 2000);
        });
        
        window.addEventListener('offline', () => {
            console.log('📱 Offline - using cache only');
        });
    }

    // ===== KHỞI TẠO TỐI ƯU =====
    async init() {
        if (this.initialized) return this;
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = new Promise(async (resolve) => {
            console.log(`🔔 Article Notification System v${NOTIFICATION_CONFIG.version} initializing...`);
            console.log(`📱 Device: ${this.isMobile ? 'Mobile' : 'Desktop'}`);
            
            if (!('Notification' in window)) {
                console.log('❌ Trình duyệt không hỗ trợ notifications');
                this.initialized = true;
                resolve(this);
                return;
            }

            await Promise.resolve();
            
            const permission = Notification.permission;
            console.log('📌 Notification permission:', permission);

            // Setup idle detection
            this.setupIdleDetection();

            // Đăng ký service worker
            if ('serviceWorker' in navigator) {
                await this.registerServiceWorker();
            }

            // Thêm nút notification (QUAN TRỌNG: luôn thêm nút)
            this.addNotificationButton();

            // Thêm onboarding elements nếu cần (chỉ trên desktop)
            if (!this.isMobile && (permission !== 'granted' || !this.isEnabled)) {
                this.showOnboardingElements();
            }

            // Lắng nghe messages từ Service Worker
            this.setupServiceWorkerListener();

            // Load articles với retry (dùng cache ngay lập tức)
            const cached = this.getCachedArticles();
            if (cached) {
                this.articles = cached;
                this.updateAppBadge();
            }
            
            // Fetch trong background
            setTimeout(() => {
                this.loadArticlesWithRetry(false, true);
            }, this.isMobile ? 10000 : 2000); // Mobile delay lâu hơn

            // Tự động start polling nếu đã được cấp quyền và enabled
            if (permission === 'granted' && this.isEnabled) {
                setTimeout(() => {
                    this.startPolling();
                    this.setupBackgroundSync();
                    this.updateAppBadge();
                    this.isFirstTimeEnable = false;
                }, this.isMobile ? 5000 : 100);
            }

            this.initialized = true;
            console.log(`✅ Notification system v${NOTIFICATION_CONFIG.version} initialized successfully`);
            resolve(this);
        });

        return this.initPromise;
    }

    // ===== BẮT ĐẦU POLLING THÔNG MINH =====
    startPolling() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        // KHÔNG CHECK KHI TAB HIDDEN HOẶC IDLE
        const effectiveInterval = (this.tabHidden || this.idleMode) 
            ? NOTIFICATION_CONFIG.backgroundCheckInterval 
            : (this.isMobile ? NOTIFICATION_CONFIG.checkInterval : 60 * 60 * 1000);

        console.log(`🔄 Bắt đầu kiểm tra bài viết mới mỗi ${effectiveInterval / 60000} phút`);
        
        this.checkInterval = setInterval(() => {
            // CHỈ CHECK KHI TAB ACTIVE VÀ KHÔNG IDLE
            if (!document.hidden && !this.idleMode && navigator.onLine !== false) {
                setTimeout(() => {
                    console.log('🔄 Đang kiểm tra bài viết mới...');
                    this.loadArticlesWithRetry(true, false);
                }, 0);
            } else {
                // Đánh dấu pending check
                this.pendingCheck = true;
                console.log('⏸️ Tab inactive/idle - deferred check');
            }
        }, effectiveInterval);
    }

    // ===== DỪNG POLLING =====
    stopPolling() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('⏹️ Đã dừng kiểm tra bài viết');
        }
    }

    // ===== LOAD ARTICLES VỚI RETRY - TỐI ƯU CACHE =====
    async loadArticlesWithRetry(force = false, skipNotification = false) {
        // Mobile: Luôn dùng cache nếu có
        if (this.isMobile && !force) {
            const cached = this.getCachedArticles();
            if (cached && !this.isCacheExpired()) {
                this.articles = cached;
                this.retryCount = 0;
                if (this.isEnabled && Notification.permission === 'granted') {
                    setTimeout(() => this.checkNewArticles(skipNotification), 0);
                }
                return;
            }
        }

        try {
            await this.loadArticles(force, skipNotification);
            this.retryCount = 0;
        } catch (error) {
            console.error('❌ Load articles failed:', error.message);
            
            // Retry logic với giới hạn
            if (this.retryCount < NOTIFICATION_CONFIG.maxRetries && navigator.onLine !== false) {
                this.retryCount++;
                const delay = NOTIFICATION_CONFIG.retryDelay * this.retryCount;
                console.log(`🔄 Retry ${this.retryCount}/${NOTIFICATION_CONFIG.maxRetries} in ${delay}ms`);
                
                setTimeout(() => {
                    this.loadArticlesWithRetry(force, skipNotification);
                }, delay);
            } else {
                console.log('⚠️ Max retries reached or offline, using cached articles');
                const cached = this.getCachedArticles();
                if (cached) {
                    this.articles = cached;
                    if (this.isEnabled && Notification.permission === 'granted') {
                        this.checkNewArticles(skipNotification);
                    }
                }
            }
        }
    }

    // ===== TẢI DỮ LIỆU BÀI VIẾT - TỐI ƯU =====
    async loadArticles(force = false, skipNotification = false) {
        // Kiểm tra cache trước
        if (!force) {
            const cached = this.getCachedArticles();
            if (cached && !this.isCacheExpired()) {
                this.articles = cached;
                
                if (this.isEnabled && Notification.permission === 'granted') {
                    setTimeout(() => this.checkNewArticles(skipNotification), 0);
                }
                return cached;
            }
        }

        // Thêm timeout cho fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(), 
            NOTIFICATION_CONFIG.fetchTimeout
        );

        try {
            const response = await fetch(
                `${NOTIFICATION_CONFIG.articleMetadataPath}?t=${Date.now()}`, 
                {
                    signal: controller.signal,
                    headers: {
                        'Cache-Control': this.isMobile 
                            ? 'max-age=3600'  // Cache 1h trên mobile
                            : 'no-cache',
                        'Pragma': this.isMobile ? 'no-cache' : 'no-cache'
                    }
                }
            );
            
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            
            this.articles = this.removeDuplicateArticles(this.normalizeArticlesData(data));
            
            // Cache articles
            this.cacheArticles(this.articles);
            
            // Sync với service worker
            if (this.swRegistration && this.swRegistration.active) {
                this.swRegistration.active.postMessage({
                    type: 'SAVE_NOTIFIED_IDS',
                    ids: this.notifiedIds
                });
            }
            
            // Kiểm tra bài viết mới
            if (this.isEnabled && Notification.permission === 'granted') {
                setTimeout(() => this.checkNewArticles(skipNotification), 0);
            }
            
            this.updateAppBadge();
            
            return this.articles;
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                console.log('⏱️ Fetch timeout, using cached articles');
            }
            
            const cached = this.getCachedArticles();
            if (cached) {
                this.articles = cached;
                return cached;
            }
            
            throw error;
        }
    }

    // ===== KIỂM TRA BÀI VIẾT MỚI - TỐI ƯU =====
    async checkNewArticles(skipNotification = false) {
        if (!this.isEnabled || Notification.permission !== 'granted') {
            return;
        }

        console.log('🔄 Đang kiểm tra bài viết mới...');
        
        const newArticles = this.articles.filter(article => {
            return !this.notifiedIds.includes(article.id);
        });
        
        if (newArticles.length === 0) {
            console.log('📭 Không có bài viết mới');
            return;
        }
        
        console.log(`📢 Phát hiện ${newArticles.length} bài viết mới`);
        
        if (skipNotification) {
            console.log('⏭️ Skip gửi notification (lần đầu bật)');
            const newIds = newArticles.map(a => a.id);
            this.saveNotifiedIds([...this.notifiedIds, ...newIds]);
            
            if (this.swRegistration && this.swRegistration.active) {
                this.swRegistration.active.postMessage({
                    type: 'SAVE_NOTIFIED_IDS',
                    ids: [...this.notifiedIds, ...newIds]
                });
            }
            
            this.updateAppBadge();
            this.addNotificationButton();
            return;
        }
        
        // Trên mobile, chỉ gửi notification nếu tab active
        if (this.isMobile && document.hidden) {
            console.log('📱 Mobile tab hidden - defer notification');
            this.pendingCheck = true;
            return;
        }
        
        await this.sendNotificationsViaSW(newArticles);
        
        const newIds = newArticles.map(a => a.id);
        this.saveNotifiedIds([...this.notifiedIds, ...newIds]);
        
        if (this.swRegistration && this.swRegistration.active) {
            this.swRegistration.active.postMessage({
                type: 'SAVE_NOTIFIED_IDS',
                ids: [...this.notifiedIds, ...newIds]
            });
        }
        
        this.updateAppBadge();
        this.addNotificationButton();
    }

    // ===== ĐĂNG KÝ SERVICE WORKER =====
    async registerServiceWorker() {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            
            for (const reg of registrations) {
                if (reg.active && reg.scope.includes('bitcoin-peak-dip')) {
                    this.swRegistration = reg;
                    console.log('✅ Found existing Service Worker');
                    break;
                }
            }
            
            if (!this.swRegistration) {
                this.swRegistration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('✅ Service Worker registered:', this.swRegistration.scope);
            }
            
            await navigator.serviceWorker.ready;
            console.log('✅ Service Worker is ready');
            
            return this.swRegistration;
        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
            return null;
        }
    }

    // ===== THIẾT LẬP BACKGROUND SYNC - TỐI ƯU =====
    async setupBackgroundSync() {
        if (!this.swRegistration) return;
        
        try {
            await this.syncNotifiedIdsWithSW();
            
            // KHÔNG DÙNG periodicSync TRÊN MOBILE
            if (!this.isMobile && 'periodicSync' in this.swRegistration) {
                const status = await navigator.permissions.query({
                    name: 'periodic-background-sync',
                });
                
                if (status.state === 'granted') {
                    await this.swRegistration.periodicSync.register('check-new-articles', {
                        minInterval: 60 * 60 * 1000 // 1 giờ trên desktop
                    });
                    console.log('✅ Periodic background sync registered');
                }
            }
            
            // Push subscription (chỉ khi permission granted)
            if (Notification.permission === 'granted') {
                await this.setupPushSubscription();
            }
            
        } catch (error) {
            console.log('⚠️ Background sync setup failed:', error);
        }
    }

    // ===== ĐỒNG BỘ NOTIFIED IDs VỚI SW =====
    async syncNotifiedIdsWithSW() {
        if (!this.swRegistration || !this.swRegistration.active) return;
        
        try {
            this.swRegistration.active.postMessage({
                type: 'SAVE_NOTIFIED_IDS',
                ids: this.notifiedIds
            });
            console.log('✅ Synced notified IDs with SW');
        } catch (error) {
            console.error('❌ Failed to sync notified IDs:', error);
        }
    }

    // ===== THIẾT LẬP PUSH SUBSCRIPTION =====
    async setupPushSubscription() {
        if (!this.swRegistration) return;
        
        try {
            let subscription = await this.swRegistration.pushManager.getSubscription();
            
            if (!subscription && !this.isMobile) { // Chủ động subscribe trên desktop
                subscription = await this.swRegistration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array('YOUR_PUBLIC_VAPID_KEY_HERE')
                });
                console.log('✅ Push subscription created');
                
                await this.sendSubscriptionToServer(subscription);
            } else if (subscription) {
                console.log('✅ Using existing push subscription');
            }
            
            this.pushSubscription = subscription;
        } catch (error) {
            console.log('❌ Push subscription failed:', error);
        }
    }

    // ===== CẬP NHẬT APP BADGE =====
    async updateAppBadge() {
        const unreadCount = this.getUnreadCount();
        
        if (navigator.setAppBadge) {
            try {
                if (unreadCount > 0) {
                    await navigator.setAppBadge(unreadCount);
                } else {
                    await navigator.clearAppBadge();
                }
            } catch (error) {
                console.log('App badge update failed:', error);
            }
        }
        
        // Chỉ update favicon badge trên desktop
        if (!this.isMobile) {
            this.updateFaviconBadge(unreadCount);
        }
        
        this.updateReadingListBadge();
        
        if (this.swRegistration && this.swRegistration.active) {
            try {
                this.swRegistration.active.postMessage({
                    type: 'UPDATE_BADGE',
                    count: unreadCount
                });
            } catch (error) {
                console.log('Failed to sync badge with SW:', error);
            }
        }
    }

    // ===== CẬP NHẬT FAVICON BADGE (CHỈ DESKTOP) =====
    updateFaviconBadge(count) {
        if (this.isMobile) return; // Không chạy trên mobile
        
        if (count === 0) {
            document.querySelectorAll('.favicon-badge').forEach(el => el.remove());
            const originalFavicon = document.querySelector('link[rel="icon"]:not(.favicon-badge)');
            if (originalFavicon) {
                originalFavicon.removeAttribute('disabled');
            }
            return;
        }
        
        if (document.querySelector('.favicon-badge')) return;
        
        const originalFavicon = document.querySelector('link[rel="icon"]');
        if (originalFavicon) {
            originalFavicon.setAttribute('disabled', 'disabled');
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#00d4ff';
        ctx.beginPath();
        ctx.arc(32, 32, 30, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('₿', 32, 32);
        
        ctx.fillStyle = '#ff2e63';
        ctx.beginPath();
        ctx.arc(48, 16, 12, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(count > 9 ? '9+' : count, 48, 16);
        
        const newFavicon = document.createElement('link');
        newFavicon.rel = 'icon';
        newFavicon.href = canvas.toDataURL('image/png');
        newFavicon.classList.add('favicon-badge');
        
        document.head.appendChild(newFavicon);
    }

    // ===== LẤY SỐ BÀI VIẾT CHƯA ĐỌC =====
    getUnreadCount() {
        try {
            const allArticles = this.articles.length > 0 ? this.articles : this.getCachedArticles() || [];
            const notifiedIds = this.getNotifiedIds();
            
            return allArticles.filter(a => !notifiedIds.includes(a.id)).length;
        } catch (e) {
            return 0;
        }
    }

    // ===== HIỂN THỊ THÔNG BÁO TRONG APP =====
    showInAppNotification(count) {
        const message = count === 1 
            ? '📢 Có 1 bài viết mới vừa được cập nhật!' 
            : `📢 Có ${count} bài viết mới vừa được cập nhật!`;
        
        this.showToast(message, 'info', 5000);
        this.showUpdateBanner(count);
    }

    // ===== HIỂN THỊ BANNER CẬP NHẬT =====
    showUpdateBanner(count) {
        const oldBanner = document.querySelector('.article-update-banner');
        if (oldBanner) oldBanner.remove();
        
        const banner = document.createElement('div');
        banner.className = 'article-update-banner';
        banner.innerHTML = `
            <i class="fas fa-newspaper"></i>
            <span>Có <strong>${count}</strong> bài viết mới. </span>
            <button onclick="window.location.reload()" class="banner-reload-btn">
                <i class="fas fa-sync-alt"></i> Tải lại
            </button>
            <button class="banner-close-btn" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        document.body.appendChild(banner);
        
        setTimeout(() => banner.classList.add('show'), 10);
    }

    // ===== GỬI NOTIFICATION QUA SERVICE WORKER =====
    async sendNotificationsViaSW(articles) {
        if (Notification.permission !== 'granted' || !this.swRegistration) return;

        try {
            if (articles.length === 1) {
                const article = articles[0];
                
                await this.swRegistration.showNotification('📚 Bài viết mới từ Bitcoin PeakDip', {
                    body: `${article.title}\n⏱️ ${article.reading_time || 5} phút đọc • ${article.level || 'Beginner'}`,
                    icon: '/assets/icons/icon-192x192.png',
                    badge: '/assets/icons/icon-72x72.png',
                    vibrate: this.isMobile ? [100, 50, 100] : [200, 100, 200], // Nhẹ hơn trên mobile
                    tag: `article-${article.id}`,
                    renotify: true,
                    requireInteraction: !this.isMobile, // Mobile tự động đóng
                    data: {
                        url: article.url || `/learn/${article.id}.html`,
                        articleId: article.id,
                        title: article.title,
                        type: 'single'
                    },
                    actions: [
                        { action: 'read', title: '📖 Đọc ngay' },
                        { action: 'later', title: '⏰ Đọc sau' }
                    ]
                });

            } else {
                await this.swRegistration.showNotification(`📚 ${articles.length} bài viết mới từ Bitcoin PeakDip`, {
                    body: articles.map(a => a.title).join('\n').substring(0, 150),
                    icon: '/assets/icons/icon-192x192.png',
                    badge: '/assets/icons/icon-72x72.png',
                    vibrate: this.isMobile ? [100, 50, 100] : [200, 100, 200],
                    tag: 'multiple-articles',
                    requireInteraction: !this.isMobile,
                    data: {
                        url: '/learn/',
                        articles: articles.map(a => ({ id: a.id, title: a.title })),
                        type: 'multiple'
                    },
                    actions: [
                        { action: 'view', title: '👀 Xem tất cả' }
                    ]
                });
            }

            console.log(`✅ Đã gửi ${articles.length} thông báo qua Service Worker`);
        } catch (error) {
            console.error('❌ Lỗi gửi notification qua SW:', error);
            this.sendBasicNotifications(articles);
        }
    }

    // ===== FALLBACK: GỬI NOTIFICATION CƠ BẢN =====
    sendBasicNotifications(articles) {
        if (Notification.permission !== 'granted') return;

        if (articles.length === 1) {
            const article = articles[0];
            
            const notification = new Notification('📚 Bài viết mới từ Bitcoin PeakDip', {
                body: `${article.title}\n⏱️ ${article.reading_time || 5} phút đọc • ${article.level || 'Beginner'}`,
                icon: '/assets/icons/icon-192x192.png',
                badge: '/assets/icons/icon-72x72.png',
                tag: `article-${article.id}`,
                renotify: true,
                requireInteraction: !this.isMobile
            });

            notification.onclick = () => {
                window.focus();
                window.location.href = article.url || `/learn/${article.id}.html`;
            };

        } else {
            const notification = new Notification(`📚 ${articles.length} bài viết mới từ Bitcoin PeakDip`, {
                body: articles.map(a => a.title).join('\n').substring(0, 150),
                icon: '/assets/icons/icon-192x192.png',
                badge: '/assets/icons/icon-72x72.png',
                tag: 'multiple-articles',
                requireInteraction: !this.isMobile
            });

            notification.onclick = () => {
                window.focus();
                window.location.href = '/learn/';
            };
        }

        console.log(`✅ Đã gửi ${articles.length} thông báo cơ bản`);
    }

    // ===== NÚT BẬT/TẮT THÔNG BÁO =====
    addNotificationButton() {
        // Xóa tất cả nút cũ
        const oldBtns = document.querySelectorAll('.notification-toggle-btn, .push-simple-btn, .notification-btn');
        oldBtns.forEach(btn => btn.remove());

        const btn = document.createElement('button');
        btn.className = 'notification-toggle-btn notification-btn';
        btn.id = 'notificationToggleBtn';
        
        const permission = Notification.permission;
        const isEnabled = this.isEnabled;
        const unreadCount = this.getUnreadCount();

        // Xác định trạng thái nút
        let icon, text, extraClass = '';
        
        if (permission === 'granted') {
            if (isEnabled) {
                icon = 'fa-bell';
                text = this.isMobile ? '' : (unreadCount > 0 ? `${unreadCount} bài mới` : 'Thông báo');
                extraClass = 'enabled';
                
                // Thêm badge nếu có bài mới
                if (unreadCount > 0) {
                    btn.setAttribute('data-badge', unreadCount > 9 ? '9+' : unreadCount);
                }
            } else {
                icon = 'fa-bell-slash';
                text = this.isMobile ? '' : 'Tắt thông báo';
            }
        } else if (permission === 'denied') {
            icon = 'fa-ban';
            text = this.isMobile ? '' : 'Đã chặn';
            extraClass = 'blocked';
        } else {
            icon = 'fa-bell';
            text = this.isMobile ? '' : 'Bật thông báo';
        }
        
        if (extraClass) btn.classList.add(extraClass);
        
        btn.innerHTML = `<i class="fas ${icon}"></i>${text ? `<span>${text}</span>` : ''}`;

        // Style responsive
        if (this.isMobile) {
            btn.style.width = '48px';
            btn.style.height = '48px';
            btn.style.borderRadius = '50%';
            btn.style.padding = '0';
            btn.style.justifyContent = 'center';
        }

        btn.onclick = (e) => this.handleButtonClick(e);
        document.body.appendChild(btn);
        console.log('✅ Notification button added');
    }

    // ===== XỬ LÝ CLICK NÚT =====
    handleButtonClick(e) {
        e.preventDefault();
        
        if (this.clickTimeout) return;
        
        this.clickTimeout = setTimeout(async () => {
            const permission = Notification.permission;
            
            if (permission === 'granted') {
                if (this.isEnabled) {
                    this.disableNotifications();
                } else {
                    this.enableNotifications();
                }
            } else {
                await this.requestPermission();
            }
            
            this.clickTimeout = null;
        }, 300);
    }

    // ===== YÊU CẦU QUYỀN =====
    async requestPermission() {
        try {
            if (Notification.permission === 'denied') {
                this.showToast('❌ Thông báo đã bị chặn. Vào cài đặt trình duyệt để bật lại.', 'warning', 5000);
                return false;
            }
            
            this.showToast('🔄 Đang yêu cầu quyền thông báo...', 'info', 2000);
            
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                this.setNotificationStatus(true);
                this.permissionPrompted = true;
                localStorage.setItem(NOTIFICATION_CONFIG.permissionPromptedKey, 'true');
                
                await this.setupBackgroundSync();
                this.startPolling();
                this.showTestNotification();
                this.addNotificationButton();
                
                await this.loadArticles(true, true);
                this.isFirstTimeEnable = false;
                
                this.showToast('✅ Đã bật thông báo thành công!', 'success');
                return true;
                
            } else if (permission === 'denied') {
                this.setNotificationStatus(false);
                this.permissionPrompted = true;
                localStorage.setItem(NOTIFICATION_CONFIG.permissionPromptedKey, 'true');
                this.addNotificationButton();
                this.showToast('❌ Bạn đã từ chối thông báo', 'warning');
                return false;
                
            } else {
                this.addNotificationButton();
                console.log('ℹ️ Người dùng đã đóng hộp thoại');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Lỗi yêu cầu quyền:', error);
            this.showToast('❌ Có lỗi xảy ra', 'error');
            return false;
        }
    }

    // ===== BẬT NOTIFICATION =====
    enableNotifications() {
        if (Notification.permission !== 'granted') {
            this.requestPermission();
            return;
        }
        
        this.setNotificationStatus(true);
        this.setupBackgroundSync();
        this.startPolling();
        this.addNotificationButton();
        
        console.log('✅ Đã bật thông báo bài viết mới');
        this.showToast('✅ Đã bật thông báo', 'success');
        
        this.loadArticles(true, true);
    }

    // ===== TẮT NOTIFICATION =====
    disableNotifications() {
        this.setNotificationStatus(false);
        this.stopPolling();
        this.addNotificationButton();
        
        console.log('🔕 Đã tắt thông báo bài viết mới');
        this.showToast('🔕 Đã tắt thông báo', 'info');
    }

    // ===== XỬ LÝ TIN NHẮN TỪ SERVICE WORKER =====
    handleServiceWorkerMessage(data) {
        console.log('📨 Message from Service Worker:', data);
        
        if (!data) return;
        
        switch (data.type) {
            case 'NEW_ARTICLES_AVAILABLE':
                console.log(`📢 SW báo có ${data.count} bài viết mới`);
                this.handleNewArticlesFromSW(data.articles);
                break;
                
            case 'SAVE_FOR_LATER':
                if (data.article) {
                    this.addToReadingList(data.article);
                }
                break;
                
            case 'PWA_UPDATED':
                console.log('🔄 PWA updated to version:', data.version);
                this.showToast(`🔄 Ứng dụng đã được cập nhật lên v${data.version}`, 'info');
                break;
                
            case 'NOTIFIED_IDS_RESPONSE':
                console.log('📋 Received notified IDs from SW:', data.ids);
                if (data.ids && data.ids.length > 0) {
                    const localIds = this.getNotifiedIds();
                    const mergedIds = [...new Set([...localIds, ...data.ids])];
                    this.saveNotifiedIds(mergedIds);
                }
                break;
                
            case 'UPDATE_COMPLETED':
                console.log('✅ Update completed:', data.message);
                this.showToast('✅ Cache cleared, reloading...', 'success');
                setTimeout(() => window.location.reload(), 1500);
                break;
        }
    }

    // ===== XỬ LÝ BÀI VIẾT MỚI TỪ SW =====
    handleNewArticlesFromSW(articles) {
        if (!articles || articles.length === 0) return;
        
        const newIds = articles.map(a => a.id);
        const unNotified = newIds.filter(id => !this.notifiedIds.includes(id));
        
        if (unNotified.length > 0) {
            console.log(`🔔 Có ${unNotified.length} bài viết mới chưa đọc`);
            
            this.updateAppBadge();
            
            if (document.visibilityState === 'visible' && !this.isFirstTimeEnable) {
                this.showInAppNotification(unNotified.length);
            }
            
            this.saveNotifiedIds([...this.notifiedIds, ...unNotified]);
            this.addNotificationButton();
        }
    }

    // ===== LẮNG NGHE TỪ SERVICE WORKER =====
    setupServiceWorkerListener() {
        if (!('serviceWorker' in navigator)) return;

        if (this.messageHandlerId) {
            navigator.serviceWorker.removeEventListener('message', this.messageHandler);
        }

        this.messageHandler = (event) => {
            setTimeout(() => {
                this.handleServiceWorkerMessage(event.data);
            }, 0);
        };

        navigator.serviceWorker.addEventListener('message', this.messageHandler);
        this.messageHandlerId = Date.now();
    }

    // ===== NORMALIZE ARTICLES DATA =====
    normalizeArticlesData(data) {
        if (!data) return [];
        
        if (Array.isArray(data)) {
            return data;
        }
        
        if (data.articles && Array.isArray(data.articles)) {
            this.articlesMetadata = {
                last_updated: data.metadata?.last_updated,
                version: data.metadata?.version,
                build_timestamp: data.metadata?.build_timestamp,
                stats: data.stats
            };
            return data.articles;
        }
        
        return [];
    }

    // ===== THÊM VÀO READING LIST =====
    addToReadingList(articleData) {
        if (window.readingList && typeof window.readingList.add === 'function') {
            window.readingList.add(articleData);
            return;
        }

        try {
            const readingList = JSON.parse(localStorage.getItem('reading_list') || '[]');
            const exists = readingList.some(item => item.id === articleData.id);

            if (!exists) {
                readingList.push({
                    id: articleData.id,
                    title: articleData.title,
                    url: articleData.url || `/learn/${articleData.id}.html`,
                    savedAt: new Date().toISOString(),
                    publishedDate: articleData.date
                });

                localStorage.setItem('reading_list', JSON.stringify(readingList));
                this.showToast('✅ Đã thêm vào danh sách đọc sau', 'success');
                this.updateReadingListBadge();
            } else {
                this.showToast('📚 Bài viết đã có trong danh sách đọc', 'info');
            }
        } catch (e) {
            console.error('Lỗi thêm vào reading list:', e);
        }
    }

    // ===== CẬP NHẬT BADGE READING LIST =====
    updateReadingListBadge() {
        const badge = document.getElementById('readingListBadge');
        if (badge) {
            const count = JSON.parse(localStorage.getItem('reading_list') || '[]').length;
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline' : 'none';
        }
    }

    // ===== NOTIFICATION TEST =====
    async showTestNotification() {
        if (Notification.permission !== 'granted' || !this.swRegistration) return;

        try {
            await this.swRegistration.showNotification('✅ Đã bật thông báo thành công', {
                body: this.isMobile 
                    ? 'Bạn sẽ nhận được thông báo khi có bài viết mới' 
                    : 'Bạn sẽ nhận được thông báo khi có bài viết mới',
                icon: '/assets/icons/icon-192x192.png',
                badge: '/assets/icons/icon-72x72.png',
                tag: 'test-notification',
                silent: false,
                vibrate: this.isMobile ? [100, 50, 100] : [200, 100, 200]
            });
        } catch (e) {
            new Notification('✅ Đã bật thông báo thành công', {
                body: 'Bạn sẽ nhận được thông báo khi có bài viết mới',
                icon: '/assets/icons/icon-192x192.png'
            });
        }
    }

    // ===== HELPER FUNCTIONS =====
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    getNotificationStatus() {
        try {
            return localStorage.getItem(NOTIFICATION_CONFIG.enabledKey) === 'true';
        } catch (e) {
            return false;
        }
    }

    setNotificationStatus(enabled) {
        try {
            localStorage.setItem(NOTIFICATION_CONFIG.enabledKey, enabled ? 'true' : 'false');
            this.isEnabled = enabled;
        } catch (e) {}
    }

    getNotifiedIds() {
        try {
            return JSON.parse(localStorage.getItem(NOTIFICATION_CONFIG.notifiedKey) || '[]');
        } catch (e) {
            return [];
        }
    }

    saveNotifiedIds(ids) {
        try {
            localStorage.setItem(NOTIFICATION_CONFIG.notifiedKey, JSON.stringify(ids));
            this.notifiedIds = ids;
        } catch (e) {}
    }

    getCachedArticles() {
        try {
            const cached = localStorage.getItem(NOTIFICATION_CONFIG.cacheKey);
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            return this.normalizeArticlesData(data);
        } catch (e) {
            return null;
        }
    }

    cacheArticles(articles) {
        try {
            localStorage.setItem(NOTIFICATION_CONFIG.cacheKey, JSON.stringify(articles));
            localStorage.setItem(NOTIFICATION_CONFIG.cacheTimeKey, Date.now().toString());
        } catch (e) {}
    }

    isCacheExpired() {
        try {
            const cacheTime = localStorage.getItem(NOTIFICATION_CONFIG.cacheTimeKey);
            if (!cacheTime) return true;
            
            const age = Date.now() - parseInt(cacheTime);
            return age > NOTIFICATION_CONFIG.cacheDuration;
        } catch (e) {
            return true;
        }
    }

    removeDuplicateArticles(articles) {
        const seen = new Map();
        return articles.filter(article => {
            if (seen.has(article.id)) {
                console.warn(`⚠️ Duplicate article: ${article.id}`);
                return false;
            }
            seen.set(article.id, true);
            return true;
        });
    }

    // ===== GỬI SUBSCRIPTION LÊN SERVER =====
    async sendSubscriptionToServer(subscription) {
        try {
            const response = await fetch(`${NOTIFICATION_CONFIG.pushServerUrl}/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            });
            
            if (!response.ok) throw new Error('Server error');
            console.log('✅ Subscription sent to server');
        } catch (error) {
            console.log('⚠️ Failed to send subscription to server:', error);
        }
    }

    // ===== HIỂN THỊ ONBOARDING ELEMENTS (CHỈ DESKTOP) =====
    showOnboardingElements() {
        if (this.isMobile) return; // Không show trên mobile
        
        if (localStorage.getItem(NOTIFICATION_CONFIG.tooltipDismissedKey)) return;
        
        setTimeout(() => {
            this.showNotificationTooltip();
            
            setTimeout(() => {
                if (!localStorage.getItem(NOTIFICATION_CONFIG.newBadgeDismissedKey)) {
                    this.addNewFeatureBadge();
                }
            }, 3000);
            
            setTimeout(() => {
                this.createBenefitRing();
            }, 5000);
        }, 2000);
    }

    // ===== TOOLTIP (CHỈ DESKTOP) =====
    showNotificationTooltip() {
        if (this.isMobile || this.tooltipShown) return;
        // ... giữ nguyên code tooltip hiện tại ...
    }

    // ===== BADGE "NEW" (CHỈ DESKTOP) =====
    addNewFeatureBadge() {
        if (this.isMobile || this.newBadgeShown) return;
        // ... giữ nguyên code badge hiện tại ...
    }

    // ===== BENEFIT RING (CHỈ DESKTOP) =====
    createBenefitRing() {
        if (this.isMobile) return;
        // ... giữ nguyên code ring hiện tại ...
    }

    // ===== TOAST NOTIFICATION =====
    showToast(message, type = 'info', duration = 3000) {
        const existingToasts = document.querySelectorAll('.notification-toast');
        for (let toast of existingToasts) {
            if (toast.querySelector('span')?.textContent === message) {
                return;
            }
        }

        const oldToast = document.querySelector('.notification-toast');
        if (oldToast) oldToast.remove();

        const toast = document.createElement('div');
        toast.className = `notification-toast toast-${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle',
            error: 'fa-times-circle'
        };
        
        toast.innerHTML = `
            <i class="fas ${icons[type]}"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ===== PUBLIC METHODS =====
    async refresh() {
        await this.loadArticles(true);
        return this.articles;
    }
}

// ===== CSS CHO NOTIFICATION SYSTEM (GIỮ NGUYÊN) =====
(function addNotificationStyles() {
    if (document.getElementById('notification-styles-v4')) return;

    const style = document.createElement('style');
    style.id = 'notification-styles-v4';
    style.textContent = `
        /* NÚT BẬT/TẮT THÔNG BÁO - TỐI ƯU CHO MOBILE */
        .notification-toggle-btn {
            position: fixed !important;
            bottom: 30px !important;
            right: 30px !important;
            background: linear-gradient(135deg, #00d4ff, #f7931a) !important;
            color: white !important;
            border: none !important;
            padding: 12px 24px !important;
            border-radius: 50px !important;
            font-size: 14px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
            z-index: 9999 !important;
            box-shadow: 0 4px 20px rgba(0,212,255,0.4) !important;
            border: 2px solid rgba(255,255,255,0.3) !important;
            transition: all 0.3s ease !important;
        }

        .notification-toggle-btn[data-badge]::after {
            content: attr(data-badge);
            position: absolute;
            top: -8px;
            right: -8px;
            background: #ff2e63;
            color: white;
            font-size: 12px;
            font-weight: bold;
            min-width: 20px;
            height: 20px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 4px;
            border: 2px solid white;
            animation: pulse 2s infinite;
        }

        /* Mobile styles */
        @media (max-width: 768px) {
            .notification-toggle-btn {
                bottom: 20px !important;
                right: 20px !important;
                width: 48px !important;
                height: 48px !important;
                border-radius: 50% !important;
                padding: 0 !important;
                justify-content: center !important;
            }
            
            .notification-toggle-btn i {
                font-size: 24px !important;
                margin: 0 !important;
            }
            
            .notification-toggle-btn span {
                display: none !important;
            }
            
            .notification-toggle-btn[data-badge]::after {
                top: -4px;
                right: -4px;
                min-width: 18px;
                height: 18px;
                font-size: 10px;
            }
            
            .article-update-banner {
                left: 10px !important;
                right: 10px !important;
                transform: none !important;
                width: auto !important;
                font-size: 14px !important;
                padding: 12px !important;
            }
            
            .notification-toast {
                left: 10px !important;
                right: 10px !important;
                transform: none !important;
                width: auto !important;
                font-size: 14px !important;
            }
        }

        .notification-toggle-btn.enabled {
            background: linear-gradient(135deg, #4CAF50, #45a049) !important;
            box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4) !important;
        }

        .notification-toggle-btn.blocked {
            background: linear-gradient(135deg, #f44336, #d32f2f) !important;
        }

        /* ARTICLE UPDATE BANNER */
        .article-update-banner {
            position: fixed;
            top: -100px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #00d4ff, #f7931a);
            color: white;
            padding: 15px 25px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 15px;
            border: 2px solid white;
            transition: top 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            max-width: 90%;
        }

        .article-update-banner.show {
            top: 20px;
        }

        /* TOAST MESSAGE */
        .notification-toast {
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%) translateY(100%);
            background: linear-gradient(135deg, #00d4ff, #0088cc);
            color: white;
            padding: 12px 25px;
            border-radius: 50px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 10001;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            border: 2px solid white;
            transition: transform 0.3s ease;
            max-width: 90%;
            font-weight: 500;
        }

        .notification-toast.show {
            transform: translateX(-50%) translateY(0);
        }

        .toast-success {
            background: linear-gradient(135deg, #4CAF50, #45a049);
        }

        .toast-warning {
            background: linear-gradient(135deg, #ff9800, #f57c00);
        }

        .toast-error {
            background: linear-gradient(135deg, #f44336, #d32f2f);
        }

        @keyframes pulse {
            0%, 100% {
                transform: scale(1);
            }
            50% {
                transform: scale(1.05);
            }
        }
    `;

    document.head.appendChild(style);
})();

// ===== KHỞI TẠO KHÔNG BLOCK =====
(function initializeNotificationSystem() {
    console.log('🚀 Initializing notification system v4.2.0...');
    
    const initTask = () => {
        if (!window.articleNotifications) {
            window.articleNotifications = new ArticleNotificationSystem();
            window.articleNotifications.init().catch(err => {
                console.error('❌ Failed to initialize notification system:', err);
            });
        }
    };

    if ('requestIdleCallback' in window) {
        requestIdleCallback(initTask, { timeout: 3000 });
    } else {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initTask);
        } else {
            setTimeout(initTask, 100);
        }
    }
})();

// Fallback
if (document.readyState === 'complete' && !window.articleNotifications) {
    setTimeout(() => {
        if (!window.articleNotifications) {
            window.articleNotifications = new ArticleNotificationSystem();
            window.articleNotifications.init();
        }
    }, 100);
}

// Export
window.ArticleNotificationSystem = ArticleNotificationSystem;
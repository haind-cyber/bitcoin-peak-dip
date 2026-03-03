// notifications.js - Hệ thống thông báo bài viết mới
// Version: 4.1.0 - PRODUCTION READY
// Tương thích với service-worker.js v1.12.15+
// Optimized for parallel execution and mobile/desktop

const NOTIFICATION_CONFIG = {
    version: '4.1.0',
    checkInterval: 1 * 60 * 1000, // 1 giờ
    articleMetadataPath: '/assets/data/articles.json',
    notifiedKey: 'peakdip_notified_articles_v4',
    enabledKey: 'peakdip_notifications_enabled',
    cacheKey: 'peakdip_articles_cache_v4',
    cacheTimeKey: 'peakdip_articles_cache_time_v4',
    cacheDuration: 1 * 60 * 1000, // 1 giờ
    permissionPromptedKey: 'peakdip_permission_prompted',
    maxRetries: 3,
    retryDelay: 1000,
    pushServerUrl: '/api',
    tooltipDismissedKey: 'notification_tooltip_dismissed',
    newBadgeDismissedKey: 'notification_new_badge_dismissed'
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
    }

    // ===== KHỞI TẠO TỐI ƯU =====
    async init() {
        if (this.initialized) return this;
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = new Promise(async (resolve) => {
            console.log(`🔔 Article Notification System v${NOTIFICATION_CONFIG.version} initializing...`);
            
            if (!('Notification' in window)) {
                console.log('❌ Trình duyệt không hỗ trợ notifications');
                this.initialized = true;
                resolve(this);
                return;
            }

            await Promise.resolve();
            
            const permission = Notification.permission;
            console.log('📌 Notification permission:', permission);

            // Đăng ký service worker
            if ('serviceWorker' in navigator) {
                await this.registerServiceWorker();
            }

            // Thêm nút notification (QUAN TRỌNG: luôn thêm nút)
            this.addNotificationButton();

            // Thêm onboarding elements nếu cần
            if (permission !== 'granted' || !this.isEnabled) {
                this.showOnboardingElements();
            }

            // Lắng nghe messages từ Service Worker
            this.setupServiceWorkerListener();

            // Load articles với retry
            this.loadArticlesWithRetry();

            // Tự động start polling nếu đã được cấp quyền và enabled
            if (permission === 'granted' && this.isEnabled) {
                setTimeout(() => {
                    this.startPolling();
                    this.setupBackgroundSync();
                    this.updateAppBadge();
                    this.isFirstTimeEnable = false;
                }, 100);
            }

            this.initialized = true;
            console.log('✅ Notification system v4.1.0 initialized successfully');
            resolve(this);
        });

        return this.initPromise;
    }

    // ===== HIỂN THỊ ONBOARDING ELEMENTS =====
    showOnboardingElements() {
        // Kiểm tra nếu đã dismiss
        if (localStorage.getItem(NOTIFICATION_CONFIG.tooltipDismissedKey)) return;
        
        setTimeout(() => {
            // Tooltip sau 2 giây
            this.showNotificationTooltip();
            
            // Badge "NEW" sau 3 giây
            setTimeout(() => {
                if (!localStorage.getItem(NOTIFICATION_CONFIG.newBadgeDismissedKey)) {
                    this.addNewFeatureBadge();
                }
            }, 3000);
            
            // Benefit ring sau 5 giây
            setTimeout(() => {
                this.createBenefitRing();
            }, 5000);
        }, 2000);
    }

    // ===== TOOLTIP THÔNG MINH =====
    showNotificationTooltip() {
        if (this.tooltipShown) return;
        if (Notification.permission === 'granted' && this.isEnabled) return;
        
        const btn = document.getElementById('notificationToggleBtn');
        if (!btn) return;
        
        // Xóa tooltip cũ
        const oldTooltip = document.querySelector('.notification-tooltip');
        if (oldTooltip) oldTooltip.remove();
        
        const tooltip = document.createElement('div');
        tooltip.className = 'notification-tooltip';
        
        let message = '';
        if (Notification.permission === 'denied') {
            message = '❌ Bạn đã chặn thông báo. Vào cài đặt trình duyệt để bật lại.';
        } else if (!this.isEnabled) {
            const unreadCount = this.getUnreadCount();
            message = unreadCount > 0 
                ? `🔔 Có ${unreadCount} bài viết mới! Bật thông báo để không bỏ lỡ.`
                : '🔔 Bật thông báo để nhận cảnh báo sớm về bài viết mới!';
        }
        
        tooltip.innerHTML = `
            <div class="tooltip-arrow"></div>
            <div class="tooltip-content">
                <i class="fas fa-bell"></i>
                <span>${message}</span>
            </div>
            <button class="tooltip-close" id="tooltipCloseBtn">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Định vị tooltip
        const btnRect = btn.getBoundingClientRect();
        tooltip.style.bottom = (window.innerHeight - btnRect.top + 10) + 'px';
        tooltip.style.right = (window.innerWidth - btnRect.right) + 'px';
        
        document.body.appendChild(tooltip);
        this.tooltipShown = true;
        
        // Xử lý đóng tooltip
        document.getElementById('tooltipCloseBtn')?.addEventListener('click', () => {
            tooltip.remove();
            localStorage.setItem(NOTIFICATION_CONFIG.tooltipDismissedKey, 'true');
        });
        
        // Tự động ẩn sau 10 giây
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => tooltip.remove(), 300);
            }
        }, 10000);
    }

    // ===== BADGE "NEW" =====
    addNewFeatureBadge() {
        if (this.newBadgeShown) return;
        if (Notification.permission === 'granted' && this.isEnabled) return;
        
        const btn = document.getElementById('notificationToggleBtn');
        if (!btn) return;
        
        const badge = document.createElement('div');
        badge.className = 'notification-new-badge';
        badge.innerHTML = `
            <span class="badge-text">✨ TÍNH NĂNG MỚI</span>
            <span class="badge-message">Nhận cảnh báo sớm bài viết</span>
            <button class="badge-close" id="newBadgeCloseBtn">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Định vị badge
        const btnRect = btn.getBoundingClientRect();
        badge.style.bottom = (window.innerHeight - btnRect.top + 50) + 'px';
        badge.style.right = (window.innerWidth - btnRect.right - 20) + 'px';
        
        document.body.appendChild(badge);
        this.newBadgeShown = true;
        
        document.getElementById('newBadgeCloseBtn')?.addEventListener('click', () => {
            badge.remove();
            localStorage.setItem(NOTIFICATION_CONFIG.newBadgeDismissedKey, 'true');
        });
    }

    // ===== BENEFIT RING =====
    createBenefitRing() {
        if (Notification.permission === 'granted' && this.isEnabled) return;
        if (document.querySelector('.benefit-ring')) return;
        
        const btn = document.getElementById('notificationToggleBtn');
        if (!btn) return;
        
        const ring = document.createElement('div');
        ring.className = 'benefit-ring';
        
        // Lấy số bài viết mới để hiển thị
        const unreadCount = this.getUnreadCount();
        const benefitText = unreadCount > 0 
            ? `📚 ${unreadCount} bài viết mới đang chờ`
            : '⚡ Cảnh báo sớm 30 phút';
        
        ring.innerHTML = `
            <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="64" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="4"/>
                <circle class="ring-segment segment-1" cx="70" cy="70" r="64" fill="none" stroke="#00d4ff" stroke-width="4" 
                    stroke-dasharray="402.123 402.123" stroke-dashoffset="100.53" stroke-linecap="round"/>
                <circle class="ring-segment segment-2" cx="70" cy="70" r="64" fill="none" stroke="#f7931a" stroke-width="4" 
                    stroke-dasharray="402.123 402.123" stroke-dashoffset="201.06" stroke-linecap="round"/>
                <circle class="ring-segment segment-3" cx="70" cy="70" r="64" fill="none" stroke="#ff2e63" stroke-width="4" 
                    stroke-dasharray="402.123 402.123" stroke-dashoffset="301.59" stroke-linecap="round"/>
                <text x="70" y="45" text-anchor="middle" fill="white" font-size="10">NHẬN</text>
                <text x="70" y="65" text-anchor="middle" fill="#00d4ff" font-size="18" font-weight="bold">CẢNH BÁO</text>
                <text x="70" y="85" text-anchor="middle" fill="white" font-size="10">SỚM 30 PHÚT</text>
            </svg>
            <div class="ring-text">${benefitText}</div>
            <button class="ring-close" id="ringCloseBtn">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        ring.style.bottom = (window.innerHeight - btn.getBoundingClientRect().top + 100) + 'px';
        ring.style.right = (window.innerWidth - btn.getBoundingClientRect().right - 40) + 'px';
        
        document.body.appendChild(ring);
        
        document.getElementById('ringCloseBtn')?.addEventListener('click', () => ring.remove());
        
        // Tự động ẩn sau 15 giây
        setTimeout(() => {
            if (ring.parentNode) {
                ring.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => ring.remove(), 300);
            }
        }, 15000);
    }

    // ===== NÚT BẬT/TẮT THÔNG BÁO - HOÀN CHỈNH =====
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
                text = unreadCount > 0 ? `${unreadCount} bài mới` : 'Thông báo';
                extraClass = 'enabled';
                
                // Thêm badge nếu có bài mới
                if (unreadCount > 0) {
                    btn.setAttribute('data-badge', unreadCount > 9 ? '9+' : unreadCount);
                }
            } else {
                icon = 'fa-bell-slash';
                text = 'Tắt thông báo';
            }
        } else if (permission === 'denied') {
            icon = 'fa-ban';
            text = 'Đã chặn';
            extraClass = 'blocked';
        } else {
            icon = 'fa-bell';
            text = 'Bật thông báo';
        }
        
        if (extraClass) btn.classList.add(extraClass);
        
        btn.innerHTML = `<i class="fas ${icon}"></i><span>${text}</span>`;

        // Style trực tiếp để đảm bảo hiển thị
        btn.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: linear-gradient(135deg, #00d4ff, #f7931a);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 50px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 9999;
            box-shadow: 0 4px 20px rgba(0,212,255,0.4);
            border: 2px solid rgba(255,255,255,0.3);
            transition: all 0.3s ease;
        `;

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
            this.addNotificationButton(); // Cập nhật nút với badge mới
        }
    }

    // ===== THIẾT LẬP BACKGROUND SYNC =====
    async setupBackgroundSync() {
        if (!this.swRegistration) return;
        
        try {
            await this.syncNotifiedIdsWithSW();
            
            if ('periodicSync' in this.swRegistration) {
                const status = await navigator.permissions.query({
                    name: 'periodic-background-sync',
                });
                
                if (status.state === 'granted') {
                    await this.swRegistration.periodicSync.register('check-new-articles', {
                        minInterval: NOTIFICATION_CONFIG.checkInterval
                    });
                    console.log('✅ Periodic background sync registered');
                }
            }
            
            await this.setupPushSubscription();
            
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
            
            if (!subscription) {
                subscription = await this.swRegistration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array('YOUR_PUBLIC_VAPID_KEY_HERE')
                });
                console.log('✅ Push subscription created');
                
                await this.sendSubscriptionToServer(subscription);
            } else {
                console.log('✅ Using existing push subscription');
            }
            
            this.pushSubscription = subscription;
        } catch (error) {
            console.log('❌ Push subscription failed:', error);
        }
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
        
        this.updateFaviconBadge(unreadCount);
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

    // ===== CẬP NHẬT FAVICON BADGE =====
    updateFaviconBadge(count) {
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

    // ===== LOAD ARTICLES VỚI RETRY =====
    async loadArticlesWithRetry(force = false, skipNotification = false) {
        try {
            await this.loadArticles(force, skipNotification);
            this.retryCount = 0;
        } catch (error) {
            console.error('❌ Load articles failed:', error.message);
            
            if (this.retryCount < NOTIFICATION_CONFIG.maxRetries) {
                this.retryCount++;
                console.log(`🔄 Retry ${this.retryCount}/${NOTIFICATION_CONFIG.maxRetries} in ${NOTIFICATION_CONFIG.retryDelay}ms`);
                
                setTimeout(() => {
                    this.loadArticlesWithRetry(force, skipNotification);
                }, NOTIFICATION_CONFIG.retryDelay * this.retryCount);
            } else {
                console.log('⚠️ Max retries reached, using cached articles if available');
                const cached = this.getCachedArticles();
                if (cached) {
                    this.articles = cached;
                }
            }
        }
    }

    // ===== TẢI DỮ LIỆU BÀI VIẾT =====
    async loadArticles(force = false, skipNotification = false) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        try {
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

            const response = await fetch(`${NOTIFICATION_CONFIG.articleMetadataPath}?t=${Date.now()}`, {
                signal: controller.signal,
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            
            this.articles = this.removeDuplicateArticles(this.normalizeArticlesData(data));
            
            this.cacheArticles(this.articles);
            
            if (this.swRegistration && this.swRegistration.active) {
                this.swRegistration.active.postMessage({
                    type: 'SAVE_NOTIFIED_IDS',
                    ids: this.notifiedIds
                });
            }
            
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
            }
            
            throw error;
        }
    }

    // ===== KIỂM TRA BÀI VIẾT MỚI =====
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
            this.addNotificationButton(); // Cập nhật nút với badge mới
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
        this.addNotificationButton(); // Cập nhật nút với badge mới
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
                    vibrate: [200, 100, 200],
                    tag: `article-${article.id}`,
                    renotify: true,
                    requireInteraction: true,
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
                    vibrate: [200, 100, 200],
                    tag: 'multiple-articles',
                    requireInteraction: true,
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
                requireInteraction: true
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
                requireInteraction: true
            });

            notification.onclick = () => {
                window.focus();
                window.location.href = '/learn/';
            };
        }

        console.log(`✅ Đã gửi ${articles.length} thông báo cơ bản`);
    }

    // ===== BẮT ĐẦU POLLING =====
    startPolling() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        console.log(`🔄 Bắt đầu kiểm tra bài viết mới mỗi ${NOTIFICATION_CONFIG.checkInterval / 60000} phút`);
        
        this.checkInterval = setInterval(() => {
            setTimeout(() => {
                console.log('🔄 Đang kiểm tra bài viết mới...');
                this.loadArticlesWithRetry(true, false);
            }, 0);
        }, NOTIFICATION_CONFIG.checkInterval);
    }

    // ===== DỪNG POLLING =====
    stopPolling() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('⏹️ Đã dừng kiểm tra bài viết');
        }
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
                body: 'Bạn sẽ nhận được thông báo khi có bài viết mới',
                icon: '/assets/icons/icon-192x192.png',
                badge: '/assets/icons/icon-72x72.png',
                tag: 'test-notification',
                silent: false
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

// ===== CSS CHO NOTIFICATION SYSTEM =====
(function addNotificationStyles() {
    if (document.getElementById('notification-styles-v4')) return;

    const style = document.createElement('style');
    style.id = 'notification-styles-v4';
    style.textContent = `
        /* NÚT BẬT/TẮT THÔNG BÁO */
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

        .notification-toggle-btn.enabled {
            background: linear-gradient(135deg, #4CAF50, #45a049) !important;
            box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4) !important;
        }

        .notification-toggle-btn.blocked {
            background: linear-gradient(135deg, #f44336, #d32f2f) !important;
        }

        .notification-toggle-btn:not(.enabled):not(.blocked) {
            animation: pulse-glow 2s infinite;
        }

        /* TOOLTIP */
        .notification-tooltip {
            position: fixed;
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border: 2px solid #00d4ff;
            border-radius: 12px;
            padding: 15px 20px;
            color: white;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 10px 30px rgba(0,212,255,0.3);
            animation: slideIn 0.3s ease;
            max-width: 300px;
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .notification-tooltip::before {
            content: '';
            position: absolute;
            bottom: -8px;
            right: 30px;
            width: 16px;
            height: 16px;
            background: #16213e;
            border-right: 2px solid #00d4ff;
            border-bottom: 2px solid #00d4ff;
            transform: rotate(45deg);
        }

        .tooltip-content {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .tooltip-content i {
            color: #00d4ff;
            font-size: 1.2em;
            animation: bellShake 2s infinite;
        }

        .tooltip-close {
            background: rgba(255,255,255,0.1);
            border: none;
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
        }

        .tooltip-close:hover {
            background: rgba(255,255,255,0.2);
            transform: rotate(90deg);
        }

        /* NEW BADGE */
        .notification-new-badge {
            position: fixed;
            background: linear-gradient(135deg, #ff2e63, #ff6b00);
            color: white;
            padding: 8px 16px;
            border-radius: 30px;
            font-size: 13px;
            font-weight: bold;
            z-index: 9998;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 4px 15px rgba(255,46,99,0.4);
            animation: bounce 2s infinite;
            border: 2px solid white;
        }

        .badge-text {
            background: rgba(255,255,255,0.2);
            padding: 3px 10px;
            border-radius: 20px;
        }

        .badge-message {
            white-space: nowrap;
        }

        .badge-close {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
        }

        /* BENEFIT RING */
        .benefit-ring {
            position: fixed;
            width: 160px;
            text-align: center;
            z-index: 9997;
            animation: float 3s ease-in-out infinite;
        }

        .ring-segment {
            transition: stroke-dashoffset 1s ease;
            transform-origin: center;
            transform: rotate(-90deg);
        }

        .segment-1 { animation: pulse 3s infinite; }
        .segment-2 { animation: pulse 3s infinite 0.5s; }
        .segment-3 { animation: pulse 3s infinite 1s; }

        .ring-text {
            margin-top: 10px;
            font-size: 12px;
            color: rgba(255,255,255,0.9);
            font-weight: bold;
            background: rgba(0,0,0,0.5);
            padding: 5px 10px;
            border-radius: 20px;
            backdrop-filter: blur(5px);
            border: 1px solid #00d4ff;
        }

        .ring-close {
            position: absolute;
            top: -5px;
            right: -5px;
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
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

        .banner-reload-btn {
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.5);
            color: white;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s ease;
        }

        .banner-close-btn {
            background: rgba(0,0,0,0.2);
            border: none;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
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

        /* ANIMATIONS */
        @keyframes pulse-glow {
            0%, 100% {
                box-shadow: 0 4px 20px rgba(0,212,255,0.4);
            }
            50% {
                box-shadow: 0 4px 30px rgba(0,212,255,0.8), 0 0 20px rgba(247,147,26,0.4);
            }
        }

        @keyframes bellShake {
            0%, 100% { transform: rotate(0); }
            10% { transform: rotate(15deg); }
            20% { transform: rotate(-15deg); }
            30% { transform: rotate(10deg); }
            40% { transform: rotate(-10deg); }
            50% { transform: rotate(5deg); }
            60% { transform: rotate(-5deg); }
        }

        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }

        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
        }

        @keyframes pulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes fadeOut {
            to {
                opacity: 0;
                transform: translateY(10px);
            }
        }

        /* MOBILE RESPONSIVE */
        @media (max-width: 768px) {
            .notification-toggle-btn {
                bottom: 20px !important;
                right: 15px !important;
                padding: 0 !important;
                width: 52px !important;
                height: 52px !important;
                border-radius: 50% !important;
                justify-content: center !important;
            }
            
            .notification-toggle-btn span {
                display: none !important;
            }
            
            .notification-toggle-btn i {
                font-size: 24px !important;
                margin: 0 !important;
            }
            
            .notification-tooltip,
            .benefit-ring,
            .notification-new-badge {
                display: none;
            }
            
            .notification-toast {
                bottom: 90px;
                padding: 10px 20px;
                font-size: 0.9em;
            }
            
            .article-update-banner {
                padding: 12px 15px;
                font-size: 0.9em;
                flex-wrap: wrap;
                justify-content: center;
                text-align: center;
            }
        }

        @media (max-width: 480px) {
            .notification-toggle-btn {
                right: 12px;
                bottom: 15px;
                width: 48px;
                height: 48px;
            }
            
            .notification-toggle-btn i {
                font-size: 22px;
            }
        }
    `;

    document.head.appendChild(style);
})();

// ===== KHỞI TẠO =====
(function initializeNotificationSystem() {
    console.log('🚀 Initializing notification system v4.1.0...');
    
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
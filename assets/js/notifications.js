// notifications.js - Bitcoin PeakDip FCM System
// Version: 6.1.0 - PRODUCTION READY
// Quản lý tập trung: FCM token, Badge count, Đồng bộ SW

const NOTIFICATION_CONFIG = {
    version: '6.1.0',
    
    // FCM Configuration
    fcm: {
        vapidKey: 'BBejP_DJ8kfSGg3lLa2WJOEFmjPuheqWlcOsg6cGXk_VvUItKx3PELEXwlqIJAL0T-nA541qb3myX5fmz9XORpE',
        serverUrl: '',
        registerEndpoint: '',
        unregisterEndpoint: ''
    },
    
    // Storage Keys
    enabledKey: 'peakdip_notifications_enabled',
    permissionPromptedKey: 'peakdip_permission_prompted',
    badgeCountKey: 'peakdip_badge_count',
    notifiedIdsKey: 'peakdip_notified_ids',
    userIdKey: 'fcm_user_id'
};

class ArticleNotificationSystem {
    constructor() {
        // Core properties
        this.isEnabled = this._getNotificationStatus();
        this.permissionPrompted = localStorage.getItem(NOTIFICATION_CONFIG.permissionPromptedKey) === 'true';
        this.initialized = false;
        this.initPromise = null;
        this.swRegistration = null;
        
        // FCM Properties
        this.fcmToken = null;
        this.fcmInitialized = false;
        this.userId = this._generateUserId();
        
        // Badge Management
        this.badgeCount = this._getStoredBadgeCount();
        this.notifiedIds = this._getNotifiedIds();
        this.pendingBadgeUpdate = null;
        this.updateTimeout = null;
        
        // Mobile detection
        this.isMobile = typeof window !== 'undefined' && (
            window.IS_MOBILE || 
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator?.userAgent || '') || 
            (typeof window.innerWidth !== 'undefined' && window.innerWidth <= 768)
        );
        
        console.log('🔔 FCM System v6.1.0 initialized');
    }

    // ===== PRIVATE METHODS =====
    
    _generateUserId() {
        let userId = localStorage.getItem(NOTIFICATION_CONFIG.userIdKey);
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem(NOTIFICATION_CONFIG.userIdKey, userId);
        }
        return userId;
    }

    _getNotificationStatus() {
        try {
            return localStorage.getItem(NOTIFICATION_CONFIG.enabledKey) === 'true';
        } catch (e) {
            return false;
        }
    }

    _setNotificationStatus(enabled) {
        try {
            localStorage.setItem(NOTIFICATION_CONFIG.enabledKey, enabled ? 'true' : 'false');
            this.isEnabled = enabled;
        } catch (e) {}
    }

    _getNotifiedIds() {
        try {
            return JSON.parse(localStorage.getItem(NOTIFICATION_CONFIG.notifiedIdsKey) || '[]');
        } catch (e) {
            return [];
        }
    }

    _saveNotifiedIds(ids) {
        try {
            localStorage.setItem(NOTIFICATION_CONFIG.notifiedIdsKey, JSON.stringify(ids));
            this.notifiedIds = ids;
        } catch (e) {}
    }

    _getStoredBadgeCount() {
        try {
            const count = parseInt(localStorage.getItem(NOTIFICATION_CONFIG.badgeCountKey) || '0');
            return isNaN(count) ? 0 : count;
        } catch (e) {
            return 0;
        }
    }

    _updateFaviconBadge(count) {
        if (this.isMobile) return;
        
        // Xóa badge cũ
        document.querySelectorAll('.favicon-badge').forEach(el => el.remove());
        
        if (count === 0) {
            const originalFavicon = document.querySelector('link[rel="icon"]:not(.favicon-badge)');
            if (originalFavicon) {
                originalFavicon.removeAttribute('disabled');
            }
            return;
        }
        
        // Tạo badge mới
        const originalFavicon = document.querySelector('link[rel="icon"]');
        if (originalFavicon) {
            originalFavicon.setAttribute('disabled', 'disabled');
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Vẽ icon Bitcoin
        ctx.fillStyle = '#00d4ff';
        ctx.beginPath();
        ctx.arc(32, 32, 30, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('₿', 32, 32);
        
        // Vẽ badge số
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

    _urlBase64ToUint8Array(base64String) {
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

    // ===== BADGE MANAGEMENT =====
    
    async updateBadge(count) {
        // Kiểm tra và validate count
        const newCount = Math.max(0, parseInt(count) || 0);
        
        // Nếu không thay đổi thì bỏ qua
        if (newCount === this.badgeCount) {
            return this.badgeCount;
        }
        
        console.log('📊 Updating badge:', this.badgeCount, '→', newCount);
        
        // Lưu vào localStorage
        try {
            localStorage.setItem(NOTIFICATION_CONFIG.badgeCountKey, newCount.toString());
            this.badgeCount = newCount;
        } catch (e) {}
        
        // Cập nhật PWA badge
        if (navigator.setAppBadge) {
            try {
                if (newCount > 0) {
                    await navigator.setAppBadge(newCount);
                } else {
                    await navigator.clearAppBadge();
                }
            } catch (error) {
                console.log('App badge update failed:', error);
            }
        }
        
        // Cập nhật favicon
        this._updateFaviconBadge(newCount);
        
        // Cập nhật document title
        const originalTitle = document.title.replace(/^\(\d+\)\s*/, '');
        document.title = newCount > 0 ? `(${newCount}) ${originalTitle}` : originalTitle;
        
        // Gửi message đến service worker (có đánh dấu nguồn)
        if (this.swRegistration && this.swRegistration.active) {
            try {
                this.swRegistration.active.postMessage({
                    type: 'UPDATE_BADGE',
                    count: newCount,
                    source: 'client'
                });
            } catch (error) {
                console.log('Failed to sync badge with SW:', error);
            }
        }
        
        return newCount;
    }

    async incrementBadge() {
        return this.updateBadge(this.badgeCount + 1);
    }

    async decrementBadge() {
        return this.updateBadge(Math.max(0, this.badgeCount - 1));
    }

    async clearBadge() {
        return this.updateBadge(0);
    }

    getCurrentBadgeCount() {
        return this.badgeCount;
    }

    // ===== FCM TOKEN MANAGEMENT =====
    
    async requestFCMToken() {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return null;
        }

        if (!('serviceWorker' in navigator) || !this.swRegistration) {
            return null;
        }

        try {
            // Kiểm tra subscription hiện tại
            let subscription = await this.swRegistration.pushManager.getSubscription();
            
            if (subscription) {
                this.fcmToken = subscription;
                this.fcmInitialized = true;
                return subscription;
            }
            
            // Tạo subscription mới
            subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this._urlBase64ToUint8Array(NOTIFICATION_CONFIG.fcm.vapidKey)
            });
            
            this.fcmToken = subscription;
            this.fcmInitialized = true;
            console.log('✅ FCM token obtained');
            
            return subscription;
            
        } catch (error) {
            console.error('❌ FCM token failed:', error.message);
            return null;
        }
    }

    // ===== SERVICE WORKER =====
    
    async registerServiceWorker() {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            
            for (const reg of registrations) {
                if (reg.active && reg.scope.includes('bitcoin-peak-dip')) {
                    this.swRegistration = reg;
                    break;
                }
            }
            
            if (!this.swRegistration) {
                this.swRegistration = await navigator.serviceWorker.register('/service-worker.js');
            }
            
            await navigator.serviceWorker.ready;
            return this.swRegistration;
        } catch (error) {
            console.error('❌ SW registration failed:', error);
            return null;
        }
    }

    // ===== MESSAGE HANDLING =====
    
    setupMessageListener() {
        if (!('serviceWorker' in navigator)) return;

        navigator.serviceWorker.addEventListener('message', (event) => {
            // Xử lý trong microtask để không block
            setTimeout(() => {
                this._handleServiceWorkerMessage(event.data);
            }, 0);
        });
    }

    _handleServiceWorkerMessage(data) {
        if (!data) return;
        
        switch (data.type) {
            case 'UPDATE_BADGE':
                // Chỉ cập nhật nếu không phải do client gửi
                if (data.source !== 'client' && data.count !== undefined) {
                    this.updateBadge(parseInt(data.count));
                }
                break;
                
            case 'NEW_ARTICLE':
                if (data.articleId && !this.notifiedIds.includes(data.articleId)) {
                    this._saveNotifiedIds([...this.notifiedIds, data.articleId]);
                    this.incrementBadge();
                }
                break;
                
            case 'PUSH_RECEIVED':
                console.log('📬 Push received:', data.payload);
                break;
        }
    }

    // ===== NOTIFICATION BUTTON =====
    
    addNotificationButton() {
        // Xóa nút cũ nếu có
        const oldBtn = document.getElementById('notificationToggleBtn');
        if (oldBtn) oldBtn.remove();

        const btn = document.createElement('button');
        btn.id = 'notificationToggleBtn';
        
        const permission = Notification.permission;
        const isEnabled = this.isEnabled;

        // Xác định icon
        let icon = 'fa-bell';
        if (permission === 'granted' && !isEnabled) icon = 'fa-bell-slash';
        if (permission === 'denied') icon = 'fa-ban';
        
        btn.innerHTML = `<i class="fas ${icon}"></i>`;

        // Style
        btn.style.position = 'fixed';
        btn.style.bottom = this.isMobile ? '20px' : '30px';
        btn.style.right = this.isMobile ? '20px' : '30px';
        btn.style.width = this.isMobile ? '48px' : '56px';
        btn.style.height = this.isMobile ? '48px' : '56px';
        btn.style.borderRadius = '50%';
        btn.style.background = 'linear-gradient(135deg, #00d4ff, #f7931a)';
        btn.style.color = 'white';
        btn.style.border = '2px solid rgba(255,255,255,0.3)';
        btn.style.cursor = 'pointer';
        btn.style.zIndex = '9999';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.fontSize = this.isMobile ? '24px' : '28px';
        btn.style.boxShadow = '0 4px 15px rgba(0,212,255,0.3)';
        btn.style.transition = 'all 0.3s ease';

        btn.onclick = () => this._handleButtonClick();
        
        document.body.appendChild(btn);
    }

    async _handleButtonClick() {
        const permission = Notification.permission;
        
        if (permission === 'granted') {
            if (this.isEnabled) {
                this._setNotificationStatus(false);
                this.showToast('🔕 Notifications disabled');
            } else {
                this._setNotificationStatus(true);
                await this.requestFCMToken();
                this.showToast('✅ Notifications enabled');
            }
            this.addNotificationButton();
        } else {
            await this._requestPermission();
        }
    }

    async _requestPermission() {
        try {
            if (Notification.permission === 'denied') {
                this.showToast('❌ Notifications blocked');
                return false;
            }
            
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                this._setNotificationStatus(true);
                localStorage.setItem(NOTIFICATION_CONFIG.permissionPromptedKey, 'true');
                
                await this.requestFCMToken();
                this.addNotificationButton();
                this.showToast('✅ Notifications enabled');
                return true;
            }
            
            this.addNotificationButton();
            return false;
            
        } catch (error) {
            console.error('❌ Permission error:', error);
            return false;
        }
    }

    // ===== TOAST NOTIFICATION =====
    
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '100px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'rgba(0,0,0,0.9)';
        toast.style.color = 'white';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '30px';
        toast.style.zIndex = '10001';
        toast.style.fontSize = '14px';
        toast.style.border = '2px solid #00d4ff';
        toast.style.boxShadow = '0 4px 15px rgba(0,212,255,0.3)';
        
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }

    // ===== INITIALIZATION =====
    
    async init() {
        if (this.initialized) return this;
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = new Promise(async (resolve) => {
            // Kiểm tra browser support
            if (!('Notification' in window)) {
                console.log('❌ Notifications not supported');
                this.initialized = true;
                resolve(this);
                return;
            }

            // Đăng ký service worker
            if ('serviceWorker' in navigator) {
                await this.registerServiceWorker();
            }

            // Setup message listener
            this.setupMessageListener();

            // Thêm nút notification
            setTimeout(() => this.addNotificationButton(), 1000);

            // Đồng bộ badge ban đầu
            const storedCount = this._getStoredBadgeCount();
            if (storedCount > 0) {
                await this.updateBadge(storedCount);
            }

            // Request FCM token nếu đã có permission
            if (Notification.permission === 'granted' && this.swRegistration) {
                setTimeout(() => {
                    this.requestFCMToken().catch(() => {});
                }, 3000);
            }

            this.initialized = true;
            console.log('✅ FCM System ready - Badge:', this.badgeCount);
            resolve(this);
        });

        return this.initPromise;
    }

    // ===== PUBLIC API =====
    
    getStatus() {
        return {
            initialized: this.fcmInitialized,
            hasToken: !!this.fcmToken,
            badgeCount: this.badgeCount,
            permission: Notification.permission,
            vapidKeyConfigured: !!NOTIFICATION_CONFIG.fcm.vapidKey,
            userId: this.userId
        };
    }
}

// ===== INITIALIZATION =====
(function initialize() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.articleNotifications = new ArticleNotificationSystem();
            window.articleNotifications.init().catch(console.error);
        });
    } else {
        window.articleNotifications = new ArticleNotificationSystem();
        window.articleNotifications.init().catch(console.error);
    }
})();

// ===== EXPORT GLOBAL API =====
window.fcm = {
    getStatus: () => window.articleNotifications?.getStatus(),
    requestToken: () => window.articleNotifications?.requestFCMToken(),
    updateBadge: (count) => window.articleNotifications?.updateBadge(count),
    incrementBadge: () => window.articleNotifications?.incrementBadge(),
    decrementBadge: () => window.articleNotifications?.decrementBadge(),
    clearBadge: () => window.articleNotifications?.clearBadge(),
    getBadgeCount: () => window.articleNotifications?.getCurrentBadgeCount()
};

window.ArticleNotificationSystem = ArticleNotificationSystem;
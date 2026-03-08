// notifications.js - Bitcoin PeakDip FCM System
// Version: 7.1.0 - FIXED: Added Firestore token saving
// GIỮ NGUYÊN tất cả tính năng cũ, CHỈ THÊM phần Firestore
// ============================================

const NOTIFICATION_CONFIG = {
    version: '7.1.0', // Tăng version nhẹ để đánh dấu
    
    // FCM Configuration
    fcm: {
        vapidKey: 'BBejP_DJ8kfSGg3lLa2WJOEFmjPuheqWlcOsg6cGXk_VvUItKx3PELEXwlqIJAL0T-nA541qb3myX5fmz9XORpE',
        serverUrl: 'https://fcm.googleapis.com/fcm/send',
        subscribeEndpoint: 'https://iid.googleapis.com/iid/v1:batchAdd',
        topic: 'new_articles',
        badgeTopic: 'badge_update'
    },
    
    // Storage Keys (GIỮ NGUYÊN)
    enabledKey: 'peakdip_notifications_enabled',
    permissionPromptedKey: 'peakdip_permission_prompted',
    badgeCountKey: 'peakdip_badge_count',
    notifiedIdsKey: 'peakdip_notified_ids',
    userIdKey: 'fcm_user_id',
    lastArticleCheckKey: 'last_article_check',
    
    // Constants
    checkInterval: 30 * 60 * 1000, // 30 phút kiểm tra bài viết mới
    badgeExpiry: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    maxRetries: 3
};

class ArticleNotificationSystem {
    constructor() {
        // Core properties (GIỮ NGUYÊN)
        this.isEnabled = this._getNotificationStatus();
        this.permissionPrompted = localStorage.getItem(NOTIFICATION_CONFIG.permissionPromptedKey) === 'true';
        this.initialized = false;
        this.initPromise = null;
        this.swRegistration = null;
        
        // FCM Properties (GIỮ NGUYÊN)
        this.fcmToken = null;
        this.fcmInitialized = false;
        this.userId = this._generateUserId();
        
        // ===== THÊM: Firestore instance =====
        this.db = null;
        
        // Badge Management (GIỮ NGUYÊN)
        this.badgeCount = this._getStoredBadgeCount();
        this.notifiedIds = this._getNotifiedIds();
        this.pendingBadgeUpdate = null;
        this.updateTimeout = null;
        
        // Mobile detection (GIỮ NGUYÊN)
        this.isMobile = typeof window !== 'undefined' && (
            window.IS_MOBILE || 
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator?.userAgent || '') || 
            (typeof window.innerWidth !== 'undefined' && window.innerWidth <= 768)
        );
        
        // ===== TÍNH NĂNG MỚI: HTML Detection =====
        this.lastCheck = this._getLastCheckTime();
        this.unreadArticles = this._getUnreadArticles();
        this.checkTimer = null;
        this.articleCache = new Map(); // Cache bài viết đã xử lý
        
        console.log('🔔 FCM System v7.1.0 initialized (with Firestore support)');
    }

    // ===== PRIVATE METHODS (GIỮ NGUYÊN) =====
    
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

    // ===== TÍNH NĂNG MỚI: Last check time =====
    _getLastCheckTime() {
        try {
            return parseInt(localStorage.getItem(NOTIFICATION_CONFIG.lastArticleCheckKey) || '0');
        } catch (e) {
            return 0;
        }
    }

    _setLastCheckTime(time = Date.now()) {
        try {
            localStorage.setItem(NOTIFICATION_CONFIG.lastArticleCheckKey, time.toString());
            this.lastCheck = time;
        } catch (e) {}
    }

    // ===== TÍNH NĂNG MỚI: Unread articles =====
    _getUnreadArticles() {
        try {
            return JSON.parse(localStorage.getItem('unread_articles') || '[]');
        } catch (e) {
            return [];
        }
    }

    _saveUnreadArticles(articles) {
        try {
            localStorage.setItem('unread_articles', JSON.stringify(articles));
            this.unreadArticles = articles;
        } catch (e) {}
    }

    // ===== THÊM: Khởi tạo Firestore =====
    async _initFirestore() {
        if (this.db) return this.db;
        
        console.log('🔥 Initializing Firestore...');
        
        // Kiểm tra Firebase có sẵn không
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase SDK not loaded!');
            return null;
        }
        
        try {
            // Đảm bảo Firebase đã được khởi tạo
            if (!firebase.apps.length) {
                firebase.initializeApp({
                    apiKey: "AIzaSyACWzl4DtQOaROFSfz9Duy21pwJFlcBBFU",
                    authDomain: "bitcoinpeakdip.firebaseapp.com",
                    projectId: "bitcoinpeakdip",
                    storageBucket: "bitcoinpeakdip.firebasestorage.app",
                    messagingSenderId: "900606660354",
                    appId: "1:900606660354:web:9fb71434f2d0fdc3543c1b"
                });
                console.log('✅ Firebase initialized');
            }
            
            this.db = firebase.firestore();
            
            // Test connection
            const testRef = this.db.collection('_test').doc('connection_test');
            await testRef.set({
                timestamp: new Date().toISOString(),
                userId: this.userId
            });
            console.log('✅ Firestore connection successful');
            
            return this.db;
        } catch (error) {
            console.error('❌ Firestore init failed:', error);
            return null;
        }
    }

    // ===== THÊM: Lưu token vào Firestore =====
    async _saveTokenToFirestore(token) {
        if (!token || !this.db) {
            console.log('❌ Cannot save token: missing token or Firestore');
            return false;
        }
        
        try {
            console.log('💾 Saving FCM token to Firestore...');
            
            const tokenRef = this.db.collection('fcm_tokens').doc(token);
            await tokenRef.set({
                token: token,
                userId: this.userId,
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                active: true
            }, { merge: true });
            
            console.log('✅ Token saved to Firestore successfully');
            
            // Verify
            const saved = await tokenRef.get();
            if (saved.exists) {
                console.log('✅ Token verified in Firestore');
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('❌ Failed to save token:', error);
            return false;
        }
    }

    // ===== FAVICON BADGE (GIỮ NGUYÊN) =====
    _updateFaviconBadge(count) {
        if (this.isMobile) return;
        
        // Xóa badge cũ
        document.querySelectorAll('.favicon-badge').forEach(el => el.remove());
        
        if (count === 0) {
            // Restore original favicon
            const originalFavicon = document.querySelector('link[rel="icon"]:not(.favicon-badge)');
            if (originalFavicon) {
                originalFavicon.removeAttribute('disabled');
            }
            return;
        }
        
        // Disable original favicon
        const originalFavicon = document.querySelector('link[rel="icon"]');
        if (originalFavicon) {
            originalFavicon.setAttribute('disabled', 'disabled');
        }
        
        // Create badge canvas
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
        if (count > 0) {
            ctx.fillStyle = '#ff2e63';
            ctx.beginPath();
            ctx.arc(48, 16, 12, 0, 2 * Math.PI);
            ctx.fill();
            
            ctx.fillStyle = 'white';
            ctx.font = 'bold 16px Arial';
            ctx.fillText(count > 9 ? '9+' : count, 48, 16);
        }
        
        // Thêm favicon mới
        const newFavicon = document.createElement('link');
        newFavicon.rel = 'icon';
        newFavicon.href = canvas.toDataURL('image/png');
        newFavicon.classList.add('favicon-badge');
        
        document.head.appendChild(newFavicon);
    }

    // ===== BADGE MANAGEMENT (GIỮ NGUYÊN) =====
    
    async updateBadge(count) {
        const newCount = Math.max(0, parseInt(count) || 0);
        
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
        
        // Gửi message đến service worker
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
        
        // Dispatch event cho các tab khác
        window.dispatchEvent(new CustomEvent('badgeUpdated', { detail: { count: newCount } }));
        
        return newCount;
    }

    async incrementBadge() {
        return this.updateBadge(this.badgeCount + 1);
    }

    async decrementBadge() {
        return this.updateBadge(Math.max(0, this.badgeCount - 1));
    }

    async clearBadge() {
        // Xóa tất cả unread articles
        this._saveUnreadArticles([]);
        return this.updateBadge(0);
    }

    getCurrentBadgeCount() {
        return this.badgeCount;
    }

    // ===== TÍNH NĂNG MỚI: Mark article as read =====
    async markArticleAsRead(articleId) {
        const unread = this.unreadArticles.filter(id => id !== articleId);
        this._saveUnreadArticles(unread);
        
        // Thêm vào notifiedIds để không thông báo lại
        if (!this.notifiedIds.includes(articleId)) {
            this._saveNotifiedIds([...this.notifiedIds, articleId]);
        }
        
        await this.updateBadge(unread.length);
        
        // Track với analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'article_read', {
                'article_id': articleId
            });
        }
        
        return unread.length;
    }

    // ===== TÍNH NĂNG MỚI: Check for new articles từ HTML =====
    async checkForNewArticles() {
        if (!this.isEnabled) return;
        
        const now = Date.now();
        
        // Chỉ check mỗi 30 phút
        if (now - this.lastCheck < NOTIFICATION_CONFIG.checkInterval) {
            return;
        }
        
        console.log('🔍 Checking for new articles...');
        
        try {
            // Fetch articles.json để biết bài viết mới
            const response = await fetch('/assets/data/articles.json?t=' + now, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            
            if (!response.ok) throw new Error('Failed to fetch articles');
            
            const data = await response.json();
            const articles = data.articles || [];
            
            // Lọc bài viết mới (trong 24h qua)
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            
            const newArticles = articles.filter(article => {
                const articleDate = new Date(article.date);
                return articleDate > oneDayAgo && 
                       !this.notifiedIds.includes(article.id) &&
                       !this.unreadArticles.includes(article.id);
            });
            
            if (newArticles.length > 0) {
                console.log(`📬 Found ${newArticles.length} new articles`);
                
                // Lưu IDs mới
                const newIds = newArticles.map(a => a.id);
                this._saveUnreadArticles([...this.unreadArticles, ...newIds]);
                
                // Cập nhật badge
                await this.updateBadge(this.unreadArticles.length + newIds.length);
                
                // Hiển thị toast cho từng bài
                newArticles.forEach(article => {
                    this.showArticleToast(article);
                });
                
                // Track với analytics
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'new_articles_detected', {
                        'count': newArticles.length
                    });
                }
            }
            
            this._setLastCheckTime(now);
            
        } catch (error) {
            console.error('❌ Failed to check for new articles:', error);
        }
    }

    // ===== TÍNH NĂNG MỚI: Show article toast =====
    showArticleToast(article) {
        // Xóa toast cũ nếu có
        const oldToast = document.querySelector('.article-toast');
        if (oldToast) oldToast.remove();
        
        const toast = document.createElement('div');
        toast.className = 'article-toast';
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas fa-newspaper"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">📚 Bài viết mới!</div>
                <div class="toast-message">${this._escapeHtml(article.title)}</div>
                <div class="toast-meta">
                    <span><i class="far fa-clock"></i> ${article.reading_time || 5} phút</span>
                    <span><i class="fas fa-signal"></i> ${article.level || 'Beginner'}</span>
                </div>
            </div>
            <button class="toast-close" onclick="event.stopPropagation(); this.closest('.article-toast').remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Click để đọc bài
        toast.onclick = () => {
            window.open(article.url, '_blank');
            this.markArticleAsRead(article.id);
            toast.remove();
        };
        
        document.body.appendChild(toast);
        
        // Animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Tự động ẩn sau 8 giây
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }
        }, 8000);
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== FCM TOKEN MANAGEMENT (SỬA ĐỂ LƯU TOKEN) =====
    
    async requestFCMToken() {
        console.log('🔑 Requesting FCM token...');
        
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            console.log('❌ Permission not granted');
            return null;
        }

        if (!('serviceWorker' in navigator) || !this.swRegistration) {
            console.log('❌ Service Worker not ready');
            return null;
        }

        try {
            // Khởi tạo Firestore trước
            await this._initFirestore();
            
            let subscription = await this.swRegistration.pushManager.getSubscription();
            
            if (!subscription) {
                console.log('🔄 Creating new push subscription...');
                subscription = await this.swRegistration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this._urlBase64ToUint8Array(NOTIFICATION_CONFIG.fcm.vapidKey)
                });
                console.log('✅ New subscription created');
            } else {
                console.log('✅ Existing subscription found');
            }
            
            // Lấy token string từ endpoint
            const token = subscription.endpoint.split('/').pop();
            console.log('🎯 FCM Token obtained:', token);
            
            // Lưu token object (giữ nguyên cho các hàm cũ)
            this.fcmToken = subscription;
            
            // ===== THÊM: Lưu token vào Firestore =====
            await this._saveTokenToFirestore(token);
            
            this.fcmInitialized = true;
            
            // TỰ ĐỘNG SUBSCRIBE TOPIC (giữ nguyên)
            await this.subscribeToTopic(NOTIFICATION_CONFIG.fcm.topic);
            await this.subscribeToTopic(NOTIFICATION_CONFIG.fcm.badgeTopic);
            
            console.log('✅ FCM token obtained, saved, and subscribed');
            return subscription;
            
        } catch (error) {
            console.error('❌ FCM token failed:', error.message);
            return null;
        }
    }

    // ===== TÍNH NĂNG MỚI: Subscribe to topic (GIỮ NGUYÊN) =====
    async subscribeToTopic(topic) {
        if (!this.fcmToken) return false;
        
        try {
            // Lấy token string từ subscription
            const token = this.fcmToken.endpoint.split('/').pop();
            
            // Gửi request subscribe (cần backend proxy để tránh CORS)
            const response = await fetch('/api/subscribe-to-topic', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: token,
                    topic: topic
                })
            });
            
            if (response.ok) {
                console.log(`✅ Subscribed to topic: ${topic}`);
                return true;
            }
            
            return false;
        } catch (error) {
            console.log(`⚠️ Topic subscription failed (${topic}):`, error.message);
            return false;
        }
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

    // ===== SERVICE WORKER (GIỮ NGUYÊN) =====
    
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

    // ===== MESSAGE HANDLING (GIỮ NGUYÊN) =====
    
    setupMessageListener() {
        if (!('serviceWorker' in navigator)) return;

        navigator.serviceWorker.addEventListener('message', (event) => {
            setTimeout(() => {
                this._handleServiceWorkerMessage(event.data);
            }, 0);
        });
    }

    _handleServiceWorkerMessage(data) {
        if (!data) return;
        
        switch (data.type) {
            case 'UPDATE_BADGE':
                if (data.source !== 'client' && data.count !== undefined) {
                    this.updateBadge(parseInt(data.count));
                }
                break;
                
            case 'NEW_ARTICLE':
                if (data.articleId && !this.notifiedIds.includes(data.articleId)) {
                    this._saveNotifiedIds([...this.notifiedIds, data.articleId]);
                    
                    // Thêm vào unread
                    if (!this.unreadArticles.includes(data.articleId)) {
                        this._saveUnreadArticles([...this.unreadArticles, data.articleId]);
                    }
                    
                    this.incrementBadge();
                    
                    // Hiển thị toast nếu có thông tin bài viết
                    if (data.article) {
                        this.showArticleToast(data.article);
                    }
                }
                break;
                
            case 'PUSH_RECEIVED':
                console.log('📬 Push received:', data.payload);
                if (data.payload?.data?.type === 'NEW_ARTICLE') {
                    // Xử lý khi nhận push từ server
                    this.checkForNewArticles();
                }
                break;
                
            case 'ARTICLE_READ':
                if (data.articleId) {
                    this.markArticleAsRead(data.articleId);
                }
                break;
        }
    }

    // ===== NOTIFICATION BUTTON (GIỮ NGUYÊN) =====
    
    addNotificationButton() {
        const oldBtn = document.getElementById('notificationToggleBtn');
        if (oldBtn) oldBtn.remove();

        const btn = document.createElement('button');
        btn.id = 'notificationToggleBtn';
        
        const permission = Notification.permission;
        const isEnabled = this.isEnabled;

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
                
                // Check for new articles ngay lập tức
                this.checkForNewArticles();
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
                
                // Check for new articles
                this.checkForNewArticles();
                return true;
            }
            
            this.addNotificationButton();
            return false;
            
        } catch (error) {
            console.error('❌ Permission error:', error);
            return false;
        }
    }

    // ===== TOAST NOTIFICATION (GIỮ NGUYÊN) =====
    
    showToast(message, type = 'info', duration = 3000) {
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
        
        // Style
        toast.style.position = 'fixed';
        toast.style.bottom = '100px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%) translateY(100%)';
        toast.style.background = 'rgba(0,0,0,0.95)';
        toast.style.color = 'white';
        toast.style.padding = '12px 25px';
        toast.style.borderRadius = '30px';
        toast.style.zIndex = '10001';
        toast.style.fontSize = '14px';
        toast.style.border = '2px solid #00d4ff';
        toast.style.boxShadow = '0 4px 20px rgba(0,212,255,0.3)';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '12px';
        toast.style.transition = 'transform 0.3s ease';
        toast.style.backdropFilter = 'blur(10px)';
        
        document.body.appendChild(toast);
        
        // Animation hiện
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(0)';
        }, 10);
        
        // Tự động ẩn
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ===== INITIALIZATION (SỬA ĐỂ BAO GỒM FIRESTORE) =====
    
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

            // Khởi tạo Firestore ngay từ đầu
            await this._initFirestore();

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
            const unreadCount = this.unreadArticles.length;
            
            if (storedCount > 0 || unreadCount > 0) {
                await this.updateBadge(Math.max(storedCount, unreadCount));
            }

            // Request FCM token nếu đã có permission
            if (Notification.permission === 'granted' && this.swRegistration) {
                setTimeout(() => {
                    this.requestFCMToken().catch(() => {});
                }, 3000);
            }

            // ===== TÍNH NĂNG MỚI: Periodic check =====
            // Check for new articles mỗi 30 phút
            this.checkTimer = setInterval(() => {
                this.checkForNewArticles();
            }, NOTIFICATION_CONFIG.checkInterval);
            
            // Check ngay lập tức
            setTimeout(() => {
                this.checkForNewArticles();
            }, 5000);

            // Lắng nghe sự kiện từ reading list
            window.addEventListener('storage', (e) => {
                if (e.key === 'reading_list') {
                    // Cập nhật badge khi reading list thay đổi
                    this.checkForNewArticles();
                }
            });

            this.initialized = true;
            console.log('✅ FCM System v7.1.0 ready - Badge:', this.badgeCount);
            resolve(this);
        });

        return this.initPromise;
    }

    // ===== CLEANUP =====
    destroy() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
    }

    // ===== PUBLIC API (GIỮ NGUYÊN) =====
    
    getStatus() {
        return {
            initialized: this.fcmInitialized,
            hasToken: !!this.fcmToken,
            badgeCount: this.badgeCount,
            unreadCount: this.unreadArticles.length,
            permission: Notification.permission,
            vapidKeyConfigured: !!NOTIFICATION_CONFIG.fcm.vapidKey,
            userId: this.userId,
            isEnabled: this.isEnabled,
            lastCheck: new Date(this.lastCheck).toISOString(),
            // ===== THÊM: Firestore status =====
            firestoreReady: !!this.db
        };
    }
    
    // ===== TÍNH NĂNG MỚI: Force check articles =====
    forceCheckArticles() {
        this._setLastCheckTime(0); // Reset last check
        return this.checkForNewArticles();
    }
    
    // ===== TÍNH NĂNG MỚI: Get unread articles list =====
    getUnreadArticles() {
        return this.unreadArticles;
    }
}

// ===== CSS CHO NOTIFICATION TOAST (GIỮ NGUYÊN) =====
(function addNotificationStyles() {
    if (document.getElementById('notification-toast-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'notification-toast-styles';
    style.textContent = `
        /* Article Toast */
        .article-toast {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: linear-gradient(135deg, #0a1a2a, #1a0a2a);
            color: white;
            padding: 16px 20px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            gap: 15px;
            z-index: 10000;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            border: 2px solid #00d4ff;
            transform: translateX(120%);
            transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            max-width: 380px;
            cursor: pointer;
            backdrop-filter: blur(10px);
        }
        
        .article-toast.show {
            transform: translateX(0);
        }
        
        .toast-icon {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #00d4ff, #f7931a);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.3em;
            flex-shrink: 0;
            animation: pulse 2s infinite;
        }
        
        .toast-content {
            flex: 1;
        }
        
        .toast-title {
            font-weight: bold;
            font-size: 0.9em;
            color: #00d4ff;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .toast-message {
            font-size: 1.1em;
            font-weight: 600;
            margin-bottom: 6px;
            line-height: 1.4;
        }
        
        .toast-meta {
            display: flex;
            gap: 15px;
            font-size: 0.8em;
            color: rgba(255,255,255,0.7);
        }
        
        .toast-meta i {
            color: #f7931a;
            margin-right: 3px;
        }
        
        .toast-close {
            background: rgba(255,255,255,0.1);
            border: none;
            color: rgba(255,255,255,0.7);
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            flex-shrink: 0;
        }
        
        .toast-close:hover {
            background: rgba(255,255,255,0.2);
            color: white;
            transform: rotate(90deg);
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        
        /* Notification Toast */
        .notification-toast {
            position: fixed;
            bottom: 30px;
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
            backdrop-filter: blur(10px);
        }
        
        .notification-toast.toast-success {
            background: linear-gradient(135deg, #4CAF50, #45a049);
        }
        
        .notification-toast.toast-warning {
            background: linear-gradient(135deg, #ff9800, #f57c00);
        }
        
        .notification-toast.toast-error {
            background: linear-gradient(135deg, #f44336, #d32f2f);
        }
        
        .notification-toast.show {
            transform: translateX(-50%) translateY(0);
        }
        
        .notification-toast i {
            font-size: 1.2em;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .article-toast {
                bottom: 20px;
                right: 20px;
                left: 20px;
                max-width: none;
                padding: 14px 16px;
            }
            
            .toast-icon {
                width: 40px;
                height: 40px;
                font-size: 1.1em;
            }
            
            .toast-message {
                font-size: 1em;
            }
            
            .notification-toast {
                bottom: 20px;
                padding: 10px 20px;
                font-size: 0.9em;
            }
        }
        
        @media (max-width: 480px) {
            .article-toast {
                padding: 12px;
            }
            
            .toast-meta {
                flex-direction: column;
                gap: 5px;
            }
        }
    `;
    
    document.head.appendChild(style);
})();

// ===== INITIALIZATION (GIỮ NGUYÊN) =====
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

// ===== EXPORT GLOBAL API (GIỮ NGUYÊN) =====
window.fcm = {
    getStatus: () => window.articleNotifications?.getStatus(),
    requestToken: () => window.articleNotifications?.requestFCMToken(),
    updateBadge: (count) => window.articleNotifications?.updateBadge(count),
    incrementBadge: () => window.articleNotifications?.incrementBadge(),
    decrementBadge: () => window.articleNotifications?.decrementBadge(),
    clearBadge: () => window.articleNotifications?.clearBadge(),
    getBadgeCount: () => window.articleNotifications?.getCurrentBadgeCount(),
    markAsRead: (id) => window.articleNotifications?.markArticleAsRead(id),
    forceCheck: () => window.articleNotifications?.forceCheckArticles(),
    getUnread: () => window.articleNotifications?.getUnreadArticles()
};

window.ArticleNotificationSystem = ArticleNotificationSystem;

// Cleanup khi page unload
window.addEventListener('beforeunload', () => {
    if (window.articleNotifications) {
        window.articleNotifications.destroy();
    }
});
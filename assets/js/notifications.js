// notifications.js - Hệ thống thông báo bài viết mới
// Version: 6.0.0 - ONLY FCM (No polling, No background checks)
// Tối giản, chỉ tập trung vào FCM, không ảnh hưởng các tính năng khác

const NOTIFICATION_CONFIG = {
    version: '6.0.0',
    
    // ===== FCM CONFIG =====
    fcm: {
        vapidKey: 'BBejP_DJ8kfSGg3lLa2WJOEFmjPuheqWlcOsg6cGXk_VvUItKx3PELEXwlqIJAL0T-nA541qb3myX5fmz9XORpE',
        serverUrl: '',
        registerEndpoint: '',
        unregisterEndpoint: ''
    },
    
    // ===== STORAGE KEYS =====
    enabledKey: 'peakdip_notifications_enabled',
    permissionPromptedKey: 'peakdip_permission_prompted'
};

class ArticleNotificationSystem {
    constructor() {
        // Core properties
        this.isEnabled = this.getNotificationStatus();
        this.permissionPrompted = localStorage.getItem(NOTIFICATION_CONFIG.permissionPromptedKey) === 'true';
        this.initialized = false;
        this.initPromise = null;
        this.swRegistration = null;
        
        // FCM Properties
        this.fcmToken = null;
        this.fcmInitialized = false;
        this.userId = this._generateFCMUserId();
        
        // Mobile detection
        this.isMobile = typeof window !== 'undefined' && (
            window.IS_MOBILE || 
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator?.userAgent || '') || 
            (typeof window.innerWidth !== 'undefined' && window.innerWidth <= 768)
        );
        
        console.log('🔔 FCM System initialized');
    }

    // ===== GENERATE USER ID =====
    _generateFCMUserId() {
        let userId = localStorage.getItem('fcm_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('fcm_user_id', userId);
        }
        return userId;
    }

    // ===== KHỞI TẠO =====
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

            // Đăng ký service worker (bắt buộc cho FCM)
            if ('serviceWorker' in navigator) {
                await this.registerServiceWorker();
            }

            // Thêm nút notification (không block)
            setTimeout(() => this.addNotificationButton(), 1000);

            // Request FCM token nếu đã có permission (không block)
            if (Notification.permission === 'granted' && this.swRegistration) {
                setTimeout(() => {
                    this.requestFCMToken().catch(() => {});
                }, 3000);
            }

            this.initialized = true;
            console.log('✅ FCM System ready');
            resolve(this);
        });

        return this.initPromise;
    }

    // ===== REGISTER SERVICE WORKER =====
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

    // ===== REQUEST FCM TOKEN =====
    async requestFCMToken() {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return null;
        }

        if (!('serviceWorker' in navigator) || !this.swRegistration) {
            return null;
        }

        try {
            let subscription = await this.swRegistration.pushManager.getSubscription();
            
            if (subscription) {
                this.fcmToken = subscription;
                this.fcmInitialized = true;
                return subscription;
            }
            
            subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this._urlBase64ToUint8Array(NOTIFICATION_CONFIG.fcm.vapidKey)
            });
            
            this.fcmToken = subscription;
            this.fcmInitialized = true;
            
            return subscription;
            
        } catch (error) {
            console.error('❌ FCM token failed:', error.message);
            return null;
        }
    }

    // ===== NÚT BẬT/TẮT =====
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

        // Style - đảm bảo không ảnh hưởng layout
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

        btn.onclick = () => this.handleButtonClick();
        
        document.body.appendChild(btn);
    }

    // ===== XỬ LÝ CLICK NÚT =====
    async handleButtonClick() {
        const permission = Notification.permission;
        
        if (permission === 'granted') {
            if (this.isEnabled) {
                this.setNotificationStatus(false);
                this.showToast('🔕 Notifications disabled');
            } else {
                this.setNotificationStatus(true);
                await this.requestFCMToken();
                this.showToast('✅ Notifications enabled');
            }
            this.addNotificationButton();
        } else {
            await this.requestPermission();
        }
    }

    // ===== YÊU CẦU QUYỀN =====
    async requestPermission() {
        try {
            if (Notification.permission === 'denied') {
                this.showToast('❌ Notifications blocked');
                return false;
            }
            
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                this.setNotificationStatus(true);
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

    // ===== HELPER FUNCTIONS =====
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

    getFCMStatus() {
        return {
            initialized: this.fcmInitialized,
            hasToken: !!this.fcmToken,
            permission: Notification.permission,
            vapidKeyConfigured: !!NOTIFICATION_CONFIG.fcm.vapidKey
        };
    }
}

// ===== KHỞI TẠO KHÔNG BLOCK =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.articleNotifications = new ArticleNotificationSystem();
        window.articleNotifications.init().catch(console.error);
    });
} else {
    window.articleNotifications = new ArticleNotificationSystem();
    window.articleNotifications.init().catch(console.error);
}

// ===== EXPORT =====
window.fcm = {
    getStatus: () => window.articleNotifications?.getFCMStatus(),
    requestToken: () => window.articleNotifications?.requestFCMToken()
};

window.ArticleNotificationSystem = ArticleNotificationSystem;
// update-notifier.js - Thông báo cập nhật phiên bản mới
// Version: 1.0.2 - FIXED: Chỉ thông báo khi version thực sự mới hơn

const UPDATE_CONFIG = {
    version: '1.0.2',
    checkInterval: 60 * 60 * 1000, // 1 giờ kiểm tra 1 lần
    versionUrl: '/version.json',
    dismissedKey: 'update_dismissed_', // Đã sửa: thêm _ để rõ ràng
    lastCheckKey: 'update_last_check',
    minCheckInterval: 10 * 60 * 1000, // THÊM: 10 phút tối thiểu giữa các lần check
    dismissExpiry: 24 * 60 * 60 * 1000 // THÊM: 24 giờ hết hạn dismiss
};

class UpdateNotifier {
    constructor() {
        // THÊM: Lấy version từ nhiều nguồn
        this.currentVersion = this.getCurrentVersion();
        this.latestVersion = null;
        this.updateBanner = null;
        this.lastCheckTime = 0; // THÊM: Biến theo dõi thời gian check
        this.init();
    }

    // THÊM: Hàm lấy version từ nhiều nguồn
    getCurrentVersion() {
        // Ưu tiên từ window.APP_VERSION
        if (window.APP_VERSION) return window.APP_VERSION;
        
        // Sau đó từ meta tag
        const meta = document.querySelector('meta[name="app-version"]');
        if (meta) return meta.getAttribute('content');
        
        // Cuối cùng là fallback
        return '1.12.2';
    }

    async init() {
        console.log('🔄 Update Notifier v' + UPDATE_CONFIG.version);
        console.log('📌 Current version:', this.currentVersion);
        
        // SỬA: Không check ngay, đợi 5 giây để trang load hoàn chỉnh
        setTimeout(() => this.checkForUpdate(), 5000);
        
        // Kiểm tra định kỳ (giữ nguyên)
        setInterval(() => this.checkForUpdate(), UPDATE_CONFIG.checkInterval);
        
        // Lắng nghe service worker update
        this.setupServiceWorkerListener();
    }

    setupServiceWorkerListener() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'NEW_VERSION_AVAILABLE') {
                    // THÊM: Chỉ hiện nếu version thực sự mới
                    const swVersion = event.data.version;
                    if (this.isNewerVersion(swVersion, this.currentVersion)) {
                        this.showUpdateBanner(swVersion);
                    }
                }
            });
        }
    }

    async checkForUpdate(force = false) {
        const now = Date.now();
        
        // THÊM: Tránh kiểm tra quá thường xuyên
        if (!force && (now - this.lastCheckTime) < UPDATE_CONFIG.minCheckInterval) {
            console.log('⏳ Skipping check - too frequent');
            return;
        }

        try {
            this.lastCheckTime = now;
            
            // THÊM: Kiểm tra localStorage với debounce
            const lastCheck = localStorage.getItem(UPDATE_CONFIG.lastCheckKey);
            if (!force && lastCheck && (now - parseInt(lastCheck)) < UPDATE_CONFIG.checkInterval) {
                console.log('⏳ Using cached check time');
                return;
            }

            console.log('🔍 Checking for updates...');
            const response = await fetch(`${UPDATE_CONFIG.versionUrl}?t=${now}`, {
                cache: 'no-store', // THÊM: Không cache
                headers: { 'Cache-Control': 'no-cache' }
            });
            
            if (!response.ok) throw new Error('Network error');

            const data = await response.json();
            this.latestVersion = data.version;

            console.log(`📊 Version check: current=${this.currentVersion}, latest=${this.latestVersion}`);

            // SỬA QUAN TRỌNG: Kiểm tra version KHÁC và MỚI HƠN
            if (this.latestVersion !== this.currentVersion && 
                this.isNewerVersion(this.latestVersion, this.currentVersion)) {
                
                // Kiểm tra dismiss với thời gian hết hạn
                const dismissed = localStorage.getItem(UPDATE_CONFIG.dismissedKey + this.latestVersion);
                const dismissedTime = dismissed ? parseInt(dismissed) : 0;
                
                // THÊM: Chỉ hiện nếu chưa dismiss hoặc đã hết hạn 24h
                if (!dismissed || (now - dismissedTime) > UPDATE_CONFIG.dismissExpiry) {
                    this.showUpdateBanner(this.latestVersion, data.changelog);
                } else {
                    console.log(`⏰ Update ${this.latestVersion} dismissed until ${new Date(dismissedTime + UPDATE_CONFIG.dismissExpiry).toLocaleString()}`);
                }
            } else {
                console.log('📊 No new version available');
            }

            localStorage.setItem(UPDATE_CONFIG.lastCheckKey, now.toString());
        } catch (error) {
            console.log('⚠️ Update check failed:', error.message);
        }
    }

    isNewerVersion(latest, current) {
        if (!latest || !current) return false;
        if (latest === current) return false; // ❌ QUAN TRỌNG: Không thông báo nếu bằng nhau
        
        const latestParts = latest.split('.').map(Number);
        const currentParts = current.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            if (latestParts[i] > currentParts[i]) return true;
            if (latestParts[i] < currentParts[i]) return false;
        }
        return false;
    }

    // SỬA: Thêm tham số changelog
    showUpdateBanner(version, changelog = []) {
        // Xóa banner cũ nếu có
        this.removeUpdateBanner();

        const banner = document.createElement('div');
        banner.className = 'update-notification-banner';
        banner.id = 'updateNotificationBanner';
        
        // THÊM: Hiển thị changelog nếu có
        const changelogHtml = changelog && changelog.length > 0 
            ? `<div class="update-changelog">
                <div class="changelog-title"><i class="fas fa-list"></i> What's new:</div>
                <ul>${changelog.map(item => `<li>${item}</li>`).join('')}</ul>
               </div>`
            : '';

        banner.innerHTML = `
            <div class="update-notification-content">
                <div class="update-icon">
                    <i class="fas fa-sync-alt"></i>
                </div>
                <div class="update-text">
                    <div class="update-title">
                        <i class="fas fa-rocket"></i> 
                        <span>Phiên bản mới ${version} đã sẵn sàng!</span>
                    </div>
                    <div class="update-description">
                        Cập nhật để trải nghiệm các tính năng mới nhất và cải thiện hiệu suất.
                    </div>
                    ${changelogHtml}
                </div>
                <div class="update-actions">
                    <button class="update-btn primary" onclick="window.updateNotifier.updateApp()">
                        <i class="fas fa-sync-alt"></i>
                        <span>Cập nhật ngay</span>
                    </button>
                    <button class="update-btn secondary" onclick="window.updateNotifier.dismissUpdate('${version}')">
                        <i class="fas fa-clock"></i>
                        <span>Để sau</span>
                    </button>
                    <button class="update-btn close" onclick="window.updateNotifier.closeBanner()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(banner);
        this.updateBanner = banner;

        // Animation hiện
        setTimeout(() => banner.classList.add('show'), 10);
    }

    removeUpdateBanner() {
        if (this.updateBanner) {
            this.updateBanner.remove();
            this.updateBanner = null;
        }
    }

    // SỬA: Dismiss lưu timestamp thay vì 'true'
    dismissUpdate(version) {
        localStorage.setItem(UPDATE_CONFIG.dismissedKey + version, Date.now().toString());
        this.closeBanner();
        this.showToast('⏰ Sẽ nhắc lại sau 24 giờ', 'info');
    }

    closeBanner() {
        if (this.updateBanner) {
            this.updateBanner.classList.remove('show');
            setTimeout(() => this.removeUpdateBanner(), 300);
        }
    }

    async updateApp() {
        this.showToast('🔄 Đang cập nhật...', 'info');

        // Clear cache
        if ('caches' in window) {
            try {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
                console.log('✅ Đã xóa cache cũ');
            } catch (e) {
                console.error('Lỗi xóa cache:', e);
            }
        }

        // Unregister service workers cũ
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(reg => reg.unregister()));
                console.log('✅ Đã unregister service workers cũ');
            } catch (e) {
                console.error('Lỗi unregister SW:', e);
            }
        }

        // Hiển thị thông báo đang reload
        this.showToast('✅ Đã cập nhật, đang tải lại...', 'success');

        // Reload trang (force reload)
        setTimeout(() => {
            window.location.href = window.location.pathname + '?updated=' + Date.now();
        }, 1000);
    }

    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `update-toast update-toast-${type}`;
        
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
}

// THÊM: CSS cho changelog
(function addUpdateStyles() {
    if (document.getElementById('update-notifier-styles')) return;

    const style = document.createElement('style');
    style.id = 'update-notifier-styles';
    style.textContent = `
        /* Update Notification Banner */
        .update-notification-banner {
            position: fixed;
            top: -200px;
            left: 50%;
            transform: translateX(-50%);
            width: 90%;
            max-width: 600px;
            background: linear-gradient(135deg, #0a1a2a, #1a0a2a);
            border: 2px solid #00d4ff;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0, 212, 255, 0.3);
            z-index: 10000;
            transition: top 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            backdrop-filter: blur(10px);
            overflow: hidden;
        }

        .update-notification-banner.show {
            top: 20px;
        }

        .update-notification-content {
            display: flex;
            align-items: flex-start;
            gap: 15px;
            padding: 20px;
            position: relative;
            z-index: 2;
        }

        .update-icon {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #00d4ff, #f7931a);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            animation: pulse 2s infinite;
        }

        .update-icon i {
            font-size: 24px;
            color: white;
        }

        .update-text {
            flex: 1;
        }

        .update-title {
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .update-title i {
            color: #f7931a;
        }

        .update-title span {
            background: linear-gradient(to right, #00d4ff, #f7931a, #ff2e63);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }

        .update-description {
            color: rgba(255, 255, 255, 0.8);
            font-size: 0.9em;
            line-height: 1.5;
            margin-bottom: 10px;
        }

        /* THÊM: Style cho changelog */
        .update-changelog {
            background: rgba(0, 212, 255, 0.1);
            border-radius: 8px;
            padding: 12px;
            margin-top: 10px;
            border-left: 3px solid #00d4ff;
        }

        .changelog-title {
            color: #00d4ff;
            font-size: 0.9em;
            font-weight: bold;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .update-changelog ul {
            margin: 0;
            padding-left: 20px;
            color: rgba(255, 255, 255, 0.9);
            font-size: 0.85em;
        }

        .update-changelog li {
            margin-bottom: 4px;
            line-height: 1.4;
        }

        .update-actions {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-shrink: 0;
        }

        .update-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border: none;
            border-radius: 8px;
            font-size: 0.9em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            white-space: nowrap;
        }

        .update-btn.primary {
            background: linear-gradient(135deg, #00d4ff, #0088cc);
            color: white;
        }

        .update-btn.primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 212, 255, 0.4);
        }

        .update-btn.secondary {
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .update-btn.secondary:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
        }

        .update-btn.close {
            width: 36px;
            height: 36px;
            padding: 0;
            justify-content: center;
            background: transparent;
            color: rgba(255, 255, 255, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .update-btn.close:hover {
            background: rgba(255, 255, 255, 0.1);
            color: white;
            transform: rotate(90deg);
        }

        .update-btn i {
            font-size: 1em;
        }

        .update-btn.primary i {
            animation: spin 2s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        @keyframes pulse {
            0%, 100% {
                transform: scale(1);
                box-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
            }
            50% {
                transform: scale(1.1);
                box-shadow: 0 0 30px rgba(0, 212, 255, 0.8);
            }
        }

        /* Update Toast */
        .update-toast {
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
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
            border: 2px solid white;
            transition: transform 0.3s ease;
            max-width: 90%;
        }

        .update-toast.show {
            transform: translateX(-50%) translateY(0);
        }

        .update-toast-success {
            background: linear-gradient(135deg, #4CAF50, #45a049);
        }

        .update-toast-warning {
            background: linear-gradient(135deg, #ff9800, #f57c00);
        }

        .update-toast-error {
            background: linear-gradient(135deg, #f44336, #d32f2f);
        }

        .update-toast i {
            font-size: 1.2em;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
            .update-notification-banner {
                width: 95%;
            }

            .update-notification-content {
                flex-direction: column;
                text-align: center;
                padding: 15px;
            }

            .update-icon {
                margin: 0 auto;
            }

            .update-actions {
                width: 100%;
                justify-content: center;
                flex-wrap: wrap;
            }

            .update-btn {
                flex: 1;
                min-width: 100px;
                justify-content: center;
            }

            .update-changelog {
                text-align: left;
            }
        }

        @media (max-width: 480px) {
            .update-notification-banner.show {
                top: 10px;
            }

            .update-actions {
                flex-direction: column;
            }

            .update-btn {
                width: 100%;
            }
        }
    `;

    document.head.appendChild(style);
})();

// Khởi tạo
const updateNotifier = new UpdateNotifier();
window.updateNotifier = updateNotifier;
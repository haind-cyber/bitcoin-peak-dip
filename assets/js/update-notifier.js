// update-notifier.js - Thông báo cập nhật phiên bản mới
// Version: 1.0.0

const UPDATE_CONFIG = {
    version: '1.0.0',
    checkInterval: 60 * 60 * 1000, // 1 giờ kiểm tra 1 lần
    versionUrl: '/version.json',
    dismissedKey: 'update_dismissed_v',
    lastCheckKey: 'update_last_check'
};

class UpdateNotifier {
    constructor() {
        this.currentVersion = window.APP_VERSION || '1.8.7';
        this.latestVersion = null;
        this.updateBanner = null;
        this.init();
    }

    async init() {
        console.log('🔄 Update Notifier v' + UPDATE_CONFIG.version);
        
        // Kiểm tra ngay lập tức
        await this.checkForUpdate();
        
        // Kiểm tra định kỳ
        setInterval(() => this.checkForUpdate(), UPDATE_CONFIG.checkInterval);
        
        // Lắng nghe service worker update
        this.setupServiceWorkerListener();
    }

    setupServiceWorkerListener() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'NEW_VERSION_AVAILABLE') {
                    this.showUpdateBanner(event.data.version);
                }
            });
        }
    }

    async checkForUpdate() {
        try {
            // Tránh kiểm tra quá thường xuyên
            const lastCheck = localStorage.getItem(UPDATE_CONFIG.lastCheckKey);
            if (lastCheck && (Date.now() - parseInt(lastCheck)) < UPDATE_CONFIG.checkInterval) {
                return;
            }

            const response = await fetch(`${UPDATE_CONFIG.versionUrl}?t=${Date.now()}`);
            if (!response.ok) throw new Error('Không thể lấy thông tin version');

            const data = await response.json();
            this.latestVersion = data.version;

            // So sánh version
            if (this.isNewerVersion(this.latestVersion, this.currentVersion)) {
                // Kiểm tra xem user đã dismiss version này chưa
                const dismissed = localStorage.getItem(UPDATE_CONFIG.dismissedKey + this.latestVersion);
                if (!dismissed) {
                    this.showUpdateBanner(this.latestVersion);
                }
            }

            localStorage.setItem(UPDATE_CONFIG.lastCheckKey, Date.now().toString());
        } catch (error) {
            console.log('⚠️ Không thể kiểm tra cập nhật:', error.message);
        }
    }

    isNewerVersion(latest, current) {
        const latestParts = latest.split('.').map(Number);
        const currentParts = current.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            if (latestParts[i] > currentParts[i]) return true;
            if (latestParts[i] < currentParts[i]) return false;
        }
        return false;
    }

    showUpdateBanner(version) {
        // Xóa banner cũ nếu có
        this.removeUpdateBanner();

        const banner = document.createElement('div');
        banner.className = 'update-notification-banner';
        banner.id = 'updateNotificationBanner';
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

    dismissUpdate(version) {
        // Lưu lại để không hiện lại version này
        localStorage.setItem(UPDATE_CONFIG.dismissedKey + version, 'true');
        this.closeBanner();
        
        // Hiển thị toast thông báo
        this.showToast('⏰ Bạn sẽ được nhắc lại sau 24 giờ', 'info');
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

// Thêm CSS
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

        .update-notification-banner::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: linear-gradient(
                45deg,
                transparent 30%,
                rgba(0, 212, 255, 0.1) 50%,
                transparent 70%
            );
            animation: shimmer 3s infinite;
        }

        @keyframes shimmer {
            0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
            100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }

        .update-notification-content {
            display: flex;
            align-items: center;
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
        }

        .update-actions {
            display: flex;
            gap: 8px;
            align-items: center;
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
    `;

    document.head.appendChild(style);
})();

// Khởi tạo
const updateNotifier = new UpdateNotifier();
window.updateNotifier = updateNotifier;
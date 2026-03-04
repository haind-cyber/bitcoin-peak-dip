// update-notifier.js - Thông báo cập nhật phiên bản mới
// Version: 2.0.0 - Tối ưu hóa chạy song song, không block

const UPDATE_CONFIG = {
    version: '2.0.0',
    checkInterval: 60 * 60 * 1000, // 1 giờ kiểm tra 1 lần
    initialDelay: 5000, // 5 giây delay ban đầu
    versionUrl: '/version.json',
    dismissedKey: 'update_dismissed_',
    lastCheckKey: 'update_last_check',
    minCheckInterval: 10 * 60 * 1000, // 10 phút tối thiểu giữa các lần check
    dismissExpiry: 24 * 60 * 60 * 1000, // 24 giờ hết hạn dismiss
    fetchTimeout: 8000, // 8 giây timeout cho fetch
    maxRetries: 2 // Số lần retry tối đa
};

class UpdateNotifier {
    constructor() {
        this.currentVersion = this.getCurrentVersion();
        this.latestVersion = null;
        this.updateBanner = null;
        this.lastCheckTime = 0;
        this.initialized = false;
        this.initPromise = null;
        this.retryCount = 0;
        
        // Khởi tạo không block
        this.initialize();
    }

    // ===== LẤY VERSION HIỆN TẠI =====
    getCurrentVersion() {
        // Ưu tiên từ window.APP_VERSION
        if (window.APP_VERSION) return window.APP_VERSION;
        
        // Sau đó từ meta tag
        const meta = document.querySelector('meta[name="app-version"]');
        if (meta) return meta.getAttribute('content');
        
        // Cuối cùng là fallback
        return '1.12.2';
    }

    // ===== KHỞI TẠO KHÔNG BLOCK =====
    async initialize() {
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise(async (resolve) => {
            console.log('🔄 Update Notifier v' + UPDATE_CONFIG.version);
            console.log('📌 Current version:', this.currentVersion);
            
            // Đợi microtask để không block
            await Promise.resolve();

            // Sử dụng requestIdleCallback nếu có
            const scheduleTask = (task, delay = 0) => {
                if ('requestIdleCallback' in window) {
                    requestIdleCallback(() => setTimeout(task, delay), { timeout: 3000 });
                } else {
                    setTimeout(task, delay);
                }
            };

            // Lên lịch kiểm tra đầu tiên
            scheduleTask(() => this.checkForUpdate(), UPDATE_CONFIG.initialDelay);

            // Thiết lập kiểm tra định kỳ không block
            setInterval(() => {
                scheduleTask(() => this.checkForUpdate(), 0);
            }, UPDATE_CONFIG.checkInterval);

            // Lắng nghe service worker update
            this.setupServiceWorkerListener();

            this.initialized = true;
            console.log('✅ Update Notifier initialized successfully');
            resolve();
        });

        return this.initPromise;
    }

    // ===== LẮNG NGHE TỪ SERVICE WORKER =====
    setupServiceWorkerListener() {
        if (!('serviceWorker' in navigator)) return;

        // Không block - sử dụng Promise.resolve
        Promise.resolve().then(() => {
            navigator.serviceWorker.addEventListener('message', (event) => {
                // Xử lý trong microtask
                setTimeout(() => {
                    if (event.data.type === 'NEW_VERSION_AVAILABLE') {
                        const swVersion = event.data.version;
                        if (this.isNewerVersion(swVersion, this.currentVersion)) {
                            this.showUpdateBanner(swVersion);
                        }
                    }
                }, 0);
            });
        });
    }

    // ===== KIỂM TRA CẬP NHẬT =====
    async checkForUpdate(force = false) {
        // Tạo microtask để không block
        await Promise.resolve();

        const now = Date.now();
        
        // Tránh kiểm tra quá thường xuyên
        if (!force && (now - this.lastCheckTime) < UPDATE_CONFIG.minCheckInterval) {
            console.log('⏳ Skipping check - too frequent');
            return;
        }

        // Kiểm tra localStorage debounce
        const lastCheck = localStorage.getItem(UPDATE_CONFIG.lastCheckKey);
        if (!force && lastCheck && (now - parseInt(lastCheck)) < UPDATE_CONFIG.checkInterval) {
            console.log('⏳ Using cached check time');
            return;
        }

        this.lastCheckTime = now;
        console.log('🔍 Checking for updates...');

        // Sử dụng AbortController cho timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), UPDATE_CONFIG.fetchTimeout);

        try {
            const response = await fetch(`${UPDATE_CONFIG.versionUrl}?t=${now}`, {
                signal: controller.signal,
                cache: 'no-store',
                headers: { 
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

            const data = await response.json();
            this.latestVersion = data.version;
            this.retryCount = 0; // Reset retry count on success

            console.log(`📊 Version check: current=${this.currentVersion}, latest=${this.latestVersion}`);

            // Kiểm tra version mới hơn
            if (this.latestVersion !== this.currentVersion && 
                this.isNewerVersion(this.latestVersion, this.currentVersion)) {
                
                this.handleNewVersion(this.latestVersion, data.changelog || []);
            } else {
                console.log('📊 No new version available');
            }

            localStorage.setItem(UPDATE_CONFIG.lastCheckKey, now.toString());

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                console.log('⏱️ Fetch timeout - check aborted');
            } else {
                console.log('⚠️ Update check failed:', error.message);
                
                // Retry logic
                if (this.retryCount < UPDATE_CONFIG.maxRetries) {
                    this.retryCount++;
                    console.log(`🔄 Retry ${this.retryCount}/${UPDATE_CONFIG.maxRetries} in 5s`);
                    
                    setTimeout(() => {
                        this.checkForUpdate(force);
                    }, 5000 * this.retryCount);
                }
            }
        }
    }

    // ===== XỬ LÝ PHIÊN BẢN MỚI =====
    handleNewVersion(version, changelog) {
        const now = Date.now();
        const dismissed = localStorage.getItem(UPDATE_CONFIG.dismissedKey + version);
        const dismissedTime = dismissed ? parseInt(dismissed) : 0;
        
        // Chỉ hiện nếu chưa dismiss hoặc đã hết hạn 24h
        if (!dismissed || (now - dismissedTime) > UPDATE_CONFIG.dismissExpiry) {
            // Dùng setTimeout để không block
            setTimeout(() => {
                this.showUpdateBanner(version, changelog);
            }, 100);
        } else {
            const expiryDate = new Date(dismissedTime + UPDATE_CONFIG.dismissExpiry);
            console.log(`⏰ Update ${version} dismissed until ${expiryDate.toLocaleString()}`);
        }
    }

    // ===== KIỂM TRA VERSION MỚI HƠN =====
    isNewerVersion(latest, current) {
        if (!latest || !current) return false;
        if (latest === current) return false;
        
        try {
            const latestParts = latest.split('.').map(Number);
            const currentParts = current.split('.').map(Number);

            for (let i = 0; i < 3; i++) {
                const latestNum = latestParts[i] || 0;
                const currentNum = currentParts[i] || 0;
                
                if (latestNum > currentNum) return true;
                if (latestNum < currentNum) return false;
            }
            return false;
        } catch (e) {
            console.log('⚠️ Version comparison error:', e.message);
            return false;
        }
    }

    // ===== HIỂN THỊ BANNER CẬP NHẬT =====
    showUpdateBanner(version, changelog = []) {
        this.showUpdateState(version); // THÊM DÒNG NÀY
        // Xóa banner cũ nếu có
        this.removeUpdateBanner();

        // Tạo banner trong setTimeout để không block
        setTimeout(() => {
            const banner = document.createElement('div');
            banner.className = 'update-notification-banner';
            banner.id = 'updateNotificationBanner';
            
            const changelogHtml = changelog && changelog.length > 0 
                ? `<div class="update-changelog">
                    <div class="changelog-title"><i class="fas fa-list"></i> What's new:</div>
                    <ul>${changelog.map(item => `<li>${this.escapeHtml(item)}</li>`).join('')}</ul>
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
                            <span>Phiên bản mới ${this.escapeHtml(version)} đã sẵn sàng!</span>
                        </div>
                        <div class="update-description">
                            Cập nhật để trải nghiệm các tính năng mới nhất và cải thiện hiệu suất.
                        </div>
                        ${changelogHtml}
                    </div>
                    <div class="update-actions">
                        <button class="update-btn primary" onclick="window.updateNotifier?.updateApp()">
                            <i class="fas fa-sync-alt"></i>
                            <span>Cập nhật ngay</span>
                        </button>
                        <button class="update-btn secondary" onclick="window.updateNotifier?.dismissUpdate('${this.escapeHtml(version)}')">
                            <i class="fas fa-clock"></i>
                            <span>Để sau</span>
                        </button>
                        <button class="update-btn close" onclick="window.updateNotifier?.closeBanner()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(banner);
            this.updateBanner = banner;

            // Animation hiện
            setTimeout(() => banner.classList.add('show'), 10);
        }, 0);
    }

    // ===== ESCAPE HTML ĐỂ TRÁNH XSS =====
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== XÓA BANNER =====
    removeUpdateBanner() {
        if (this.updateBanner) {
            this.updateBanner.remove();
            this.updateBanner = null;
        }
    }

    // ===== ĐÓNG BANNER =====
    closeBanner() {
        if (this.updateBanner) {
            this.updateBanner.classList.remove('show');
            setTimeout(() => this.removeUpdateBanner(), 300);
        }
    }

    // ===== DỜI THÔNG BÁO =====
    dismissUpdate(version) {
        try {
            localStorage.setItem(UPDATE_CONFIG.dismissedKey + version, Date.now().toString());
            this.closeBanner();
            this.showToast('⏰ Sẽ nhắc lại sau 24 giờ', 'info');
        } catch (e) {
            console.error('Error dismissing update:', e);
        }
    }

    // ===== CẬP NHẬT ỨNG DỤNG =====
    async updateApp() {
        this.showToast('🔄 Đang cập nhật...', 'info');

        // Dùng setTimeout để không block UI
        setTimeout(async () => {
            try {
                // Clear cache - dùng Promise.allSettled để không block
                if ('caches' in window) {
                    try {
                        const keys = await caches.keys();
                        const cacheDeletePromises = keys
                            .filter(key => key.includes('bitcoin-peakdip'))
                            .map(key => caches.delete(key));
                        
                        await Promise.allSettled(cacheDeletePromises);
                        console.log('✅ Đã xóa cache cũ');
                    } catch (e) {
                        console.error('Lỗi xóa cache:', e);
                    }
                }

                // Unregister service workers cũ
                if ('serviceWorker' in navigator) {
                    try {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        const unregisterPromises = registrations.map(reg => reg.unregister());
                        await Promise.allSettled(unregisterPromises);
                        console.log('✅ Đã unregister service workers cũ');
                    } catch (e) {
                        console.error('Lỗi unregister SW:', e);
                    }
                }

                // Reload trang
                this.showToast('✅ Đã cập nhật, đang tải lại...', 'success');
                
                setTimeout(() => {
                    window.location.href = window.location.pathname + '?updated=' + Date.now();
                }, 1000);

            } catch (error) {
                console.error('❌ Update failed:', error);
                this.showToast('❌ Cập nhật thất bại, thử lại sau', 'error');
            }
        }, 0);
    }

    // ===== HIỂN THỊ TOAST =====
    showToast(message, type = 'info', duration = 3000) {
        // Kiểm tra toast trùng
        const existingToasts = document.querySelectorAll('.update-toast');
        for (let toast of existingToasts) {
            if (toast.querySelector('span')?.textContent === message) {
                return;
            }
        }

        // Xóa toast cũ
        const oldToast = document.querySelector('.update-toast');
        if (oldToast) oldToast.remove();

        // Tạo toast mới trong setTimeout
        setTimeout(() => {
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

            // Animation
            setTimeout(() => toast.classList.add('show'), 10);
            
            // Tự động ẩn
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }, 0);
    }

    showUpdateState(version) {
        if (window.updateAllStates && window.appStates) {
            window.updateAllStates({
                type: 'signal',
                message: `UPDATE v${version} AVAILABLE`,
                badgeMessage: 'UPDATE READY',
                color: '#9c27b0'
            }, 1);
            
            // Tự động trở về analysing sau 5 giây
            setTimeout(() => {
                window.updateAllStates?.(window.appStates.analysing, 1);
            }, 5000);
        }
    }    
}

// ===== CSS CHO UPDATE NOTIFIER =====
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

        /* Animations */
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

// ===== KHỞI TẠO KHÔNG BLOCK =====
(function initializeUpdateNotifier() {
    // Sử dụng requestIdleCallback nếu có
    const initTask = () => {
        if (!window.updateNotifier) {
            window.updateNotifier = new UpdateNotifier();
        }
    };

    if ('requestIdleCallback' in window) {
        requestIdleCallback(initTask, { timeout: 3000 });
    } else {
        // Fallback: setTimeout với độ ưu tiên thấp
        setTimeout(initTask, 1000);
    }
})();

// Fallback nếu DOM đã load xong
if (document.readyState === 'complete' && !window.updateNotifier) {
    setTimeout(() => {
        if (!window.updateNotifier) {
            window.updateNotifier = new UpdateNotifier();
        }
    }, 100);
}

// Export
window.UpdateNotifier = UpdateNotifier;
// notifications.js - Hệ thống thông báo bài viết mới
// Version: 2.5.0 - Tự động xin quyền notification từ trình duyệt
// Bảo toàn: Reading list, Cache, Polling, Service Worker, Toast, Badge

const NOTIFICATION_CONFIG = {
    version: '2.5.0',
    checkInterval: 60 * 60 * 1000, // 60 phút (đồng bộ với comment)
    articleMetadataPath: '/learn/articles.json',
    notifiedKey: 'peakdip_notified_articles_v2',
    enabledKey: 'peakdip_notifications_enabled',
    cacheKey: 'peakdip_articles_cache',
    cacheTimeKey: 'peakdip_articles_cache_time',
    cacheDuration: 24 * 60 * 60 * 1000, // 24 giờ
    newArticleDays: 7,
    permissionPromptedKey: 'peakdip_permission_prompted' // Theo dõi đã hỏi quyền chưa
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
        
        // Flag để tránh double notification
        this.isFirstTimeEnable = true;
        // Debounce cho click events
        this.clickTimeout = null;
        
        this.init();
    }

    // ===== KHỞI TẠO =====
    init() {
        console.log('🔔 Article Notification System v' + NOTIFICATION_CONFIG.version);
        
        if (!('Notification' in window)) {
            console.log('❌ Trình duyệt không hỗ trợ notifications');
            return;
        }

        // Kiểm tra trạng thái permission
        const permission = Notification.permission;
        console.log('📌 Notification permission:', permission);

        // Luôn hiển thị nút bật/tắt, không phụ thuộc vào permission
        this.addNotificationButton();

        // Load articles ngay lập tức
        this.loadArticles();
        
        // Lắng nghe messages từ Service Worker
        this.setupServiceWorkerListener();

        // Tự động start polling nếu đã được cấp quyền và enabled
        if (permission === 'granted' && this.isEnabled) {
            this.startPolling();
            this.isFirstTimeEnable = false;
        }
    }

    // ===== LẮNG NGHE TỪ SERVICE WORKER =====
    setupServiceWorkerListener() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                console.log('📨 Message từ Service Worker:', event.data);
                
                if (event.data.type === 'SAVE_FOR_LATER' && event.data.article) {
                    this.addToReadingList(event.data.article);
                }
                
                if (event.data.type === 'READING_LIST_UPDATED') {
                    this.updateReadingListBadge();
                }
            });
        }
    }

    // ===== QUẢN LÝ TRẠNG THÁI =====
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

    // ===== TẢI DỮ LIỆU BÀI VIẾT =====
    async loadArticles(force = false, skipNotification = false) {
        try {
            // Kiểm tra cache nếu không force
            if (!force) {
                const cached = this.getCachedArticles();
                if (cached && !this.isCacheExpired()) {
                    this.articles = cached;
                    
                    // Kiểm tra bài viết mới từ cache
                    if (this.isEnabled && Notification.permission === 'granted') {
                        await this.checkNewArticles(skipNotification);
                    }
                    return cached;
                }
            }

            // Fetch từ server với timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${NOTIFICATION_CONFIG.articleMetadataPath}?t=${Date.now()}`, {
                signal: controller.signal,
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error('Không thể tải articles');

            const data = await response.json();
            this.articles = data.articles || [];
            
            // Lọc bỏ duplicate articles
            this.articles = this.removeDuplicateArticles(this.articles);
            
            // Lưu cache
            this.cacheArticles(this.articles);
            
            // Kiểm tra bài viết mới
            if (this.isEnabled && Notification.permission === 'granted') {
                await this.checkNewArticles(skipNotification);
            }
            
            return this.articles;
        } catch (error) {
            console.error('❌ Lỗi tải articles:', error.message);
            
            // Nếu có cached articles, dùng tạm
            const cached = this.getCachedArticles();
            if (cached) {
                console.log('📦 Dùng cached articles');
                this.articles = cached;
            }
            
            return this.articles;
        }
    }

    // ===== LOẠI BỎ DUPLICATE ARTICLES =====
    removeDuplicateArticles(articles) {
        const seen = new Map();
        return articles.filter(article => {
            if (seen.has(article.id)) {
                console.warn(`⚠️ Duplicate article found: ${article.id} - ${article.title}`);
                return false;
            }
            seen.set(article.id, true);
            return true;
        });
    }

    getCachedArticles() {
        try {
            const cached = localStorage.getItem(NOTIFICATION_CONFIG.cacheKey);
            if (!cached) return null;
            
            const parsed = JSON.parse(cached);
            if (!Array.isArray(parsed)) return null;
            
            return parsed;
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

    // ===== KIỂM TRA BÀI VIẾT MỚI =====
    async checkNewArticles(skipNotification = false) {
        if (!this.isEnabled || Notification.permission !== 'granted') {
            return;
        }

        console.log('🔄 Đang kiểm tra bài viết mới...');
        
        // Tìm bài viết mới
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - NOTIFICATION_CONFIG.newArticleDays);
        
        const newArticles = this.articles.filter(article => {
            if (this.notifiedIds.includes(article.id)) return false;
            try {
                const articleDate = new Date(article.date);
                return articleDate >= cutoffDate;
            } catch (e) {
                return false;
            }
        });
        
        if (newArticles.length === 0) {
            console.log('📭 Không có bài viết mới');
            return;
        }
        
        console.log(`📢 Phát hiện ${newArticles.length} bài viết mới`);
        
        // Nếu skipNotification = true, chỉ đánh dấu đã đọc, không gửi notification
        if (skipNotification) {
            console.log('⏭️ Skip gửi notification (lần đầu bật)');
            const newIds = newArticles.map(a => a.id);
            this.saveNotifiedIds([...this.notifiedIds, ...newIds]);
            return;
        }
        
        // Gửi notification qua service worker
        await this.sendNotificationsViaSW(newArticles);
        
        // Đánh dấu đã gửi notification
        const newIds = newArticles.map(a => a.id);
        this.saveNotifiedIds([...this.notifiedIds, ...newIds]);
    }
    
    // ===== GỬI NOTIFICATION QUA SERVICE WORKER =====
    async sendNotificationsViaSW(articles) {
        if (Notification.permission !== 'granted') return;

        try {
            const registration = await navigator.serviceWorker.ready;
            
            if (!registration || !registration.active) {
                this.sendBasicNotifications(articles);
                return;
            }

            if (articles.length === 1) {
                const article = articles[0];
                
                await registration.showNotification('📚 Bài viết mới từ Bitcoin PeakDip', {
                    body: `${article.title}\n⏱️ ${article.reading_time} phút đọc • ${article.level}`,
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/icon-72x72.png',
                    vibrate: [200, 100, 200],
                    tag: `article-${article.id}`,
                    renotify: true,
                    requireInteraction: true,
                    silent: false,
                    data: {
                        url: article.url || `/learn/article.html?id=${article.slug}`,
                        articleId: article.id,
                        title: article.title,
                        slug: article.slug,
                        date: article.date,
                        readingTime: article.reading_time,
                        level: article.level,
                        type: 'single'
                    },
                    actions: [
                        { action: 'read', title: '📖 Đọc ngay' },
                        { action: 'later', title: '⏰ Đọc sau' }
                    ]
                });

            } else {
                const titles = articles.map(a => `• ${a.title}`).join('\n').substring(0, 150);
                
                await registration.showNotification(`📚 ${articles.length} bài viết mới từ Bitcoin PeakDip`, {
                    body: titles + (titles.length >= 150 ? '...' : ''),
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/icon-72x72.png',
                    vibrate: [200, 100, 200],
                    tag: 'multiple-articles',
                    requireInteraction: true,
                    silent: false,
                    data: {
                        url: '/learn/',
                        articles: articles.map(a => ({ 
                            id: a.id, 
                            slug: a.slug, 
                            title: a.title 
                        })),
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
                body: `${article.title}\n⏱️ ${article.reading_time} phút đọc • ${article.level}`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png',
                tag: `article-${article.id}`,
                renotify: true,
                requireInteraction: true,
                silent: false
            });

            notification.onclick = (event) => {
                event.preventDefault();
                window.focus();
                window.location.href = article.url || `/learn/article.html?id=${article.slug}`;
            };

        } else {
            const titles = articles.map(a => `• ${a.title}`).join('\n').substring(0, 150);
            
            const notification = new Notification(`📚 ${articles.length} bài viết mới từ Bitcoin PeakDip`, {
                body: titles + (titles.length >= 150 ? '...' : ''),
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png',
                tag: 'multiple-articles',
                requireInteraction: true,
                silent: false
            });

            notification.onclick = (event) => {
                event.preventDefault();
                window.focus();
                window.location.href = '/learn/';
            };
        }

        console.log(`✅ Đã gửi ${articles.length} thông báo cơ bản`);
    }

    // ===== THÊM VÀO READING LIST =====
    addToReadingList(articleData) {
        if (window.readingList && typeof window.readingList.add === 'function') {
            window.readingList.add({
                id: articleData.articleId || articleData.id,
                title: articleData.title,
                slug: articleData.slug,
                date: articleData.date,
                url: articleData.url || `/learn/article.html?id=${articleData.slug}`
            });
            return;
        }

        try {
            const readingList = JSON.parse(localStorage.getItem('reading_list') || '[]');
            const exists = readingList.some(item => item.id === (articleData.articleId || articleData.id));

            if (!exists) {
                readingList.push({
                    id: articleData.articleId || articleData.id,
                    title: articleData.title,
                    url: articleData.url || `/learn/article.html?id=${articleData.slug}`,
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

    // ===== CẬP NHẬT BADGE =====
    updateReadingListBadge() {
        const badge = document.getElementById('readingListBadge');
        if (badge) {
            const count = JSON.parse(localStorage.getItem('reading_list') || '[]').length;
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline' : 'none';
        }
    }

    // ===== NÚT BẬT/TẮT THÔNG BÁO =====
    addNotificationButton() {
        // Xóa tất cả nút cũ
        const oldBtns = document.querySelectorAll('.notification-toggle-btn, .push-simple-btn');
        oldBtns.forEach(btn => btn.remove());

        const btn = document.createElement('button');
        btn.className = 'notification-toggle-btn';
        btn.id = 'notificationToggleBtn';
        
        const permission = Notification.permission;
        const isEnabled = this.isEnabled;

        // Xác định nội dung nút dựa trên trạng thái
        let icon, text;
        
        if (permission === 'granted') {
            if (isEnabled) {
                icon = 'fa-bell';
                text = 'Thông báo BẬT';
                btn.classList.add('enabled');
            } else {
                icon = 'fa-bell-slash';
                text = 'Thông báo TẮT';
            }
        } else if (permission === 'denied') {
            icon = 'fa-ban';
            text = 'Thông báo ĐÃ BỊ CHẶN';
            btn.classList.add('blocked');
        } else {
            // permission === 'default' - Chưa hỏi
            icon = 'fa-bell';
            text = 'Bật thông báo bài viết mới';
        }
        
        btn.innerHTML = `<i class="fas ${icon}"></i><span>${text}</span>`;

        // Xử lý click
        btn.onclick = (e) => this.handleButtonClick(e);

        document.body.appendChild(btn);
    }

    // ===== XỬ LÝ CLICK VỚI DEBOUNCE =====
    handleButtonClick(e) {
        e.preventDefault();
        
        if (this.clickTimeout) {
            console.log('⏳ Debounce: bỏ qua click trùng');
            return;
        }
        
        this.clickTimeout = setTimeout(async () => {
            const permission = Notification.permission;
            
            if (permission === 'granted') {
                // Đã được cấp quyền -> Toggle on/off
                if (this.isEnabled) {
                    this.disableNotifications();
                } else {
                    this.enableNotifications();
                }
            } else {
                // Chưa được cấp quyền (default hoặc denied) -> Xin quyền
                await this.requestPermission();
            }
            
            this.clickTimeout = null;
        }, 300);
    }

    // ===== YÊU CẦU QUYỀN TỰ ĐỘNG TỪ TRÌNH DUYỆT =====
    async requestPermission() {
        try {
            // Kiểm tra nếu đã bị denied
            if (Notification.permission === 'denied') {
                this.showToast('❌ Trình duyệt đã chặn thông báo. Nhấn lại để thử.', 'warning', 4000);
                return false;
            }
            
            // Hiển thị thông báo đang xin quyền
            this.showToast('🔄 Đang yêu cầu quyền thông báo...', 'info', 2000);
            
            // Gọi requestPermission - ĐÂY LÀ LỆNH DUY NHẤT ĐỂ HIỆN POPUP
            const permission = await Notification.requestPermission();
            
            console.log('✅ Permission result:', permission);
            
            if (permission === 'granted') {
                // User đã cho phép
                this.setNotificationStatus(true);
                this.permissionPrompted = true;
                localStorage.setItem(NOTIFICATION_CONFIG.permissionPromptedKey, 'true');
                
                this.startPolling();
                this.showTestNotification();
                
                // Cập nhật nút
                this.addNotificationButton();
                
                // Chỉ toast khi thành công (giữ nguyên behavior cũ)
                console.log('✅ Đã bật thông báo bài viết mới');
                
                await this.loadArticles(true, true);
                this.isFirstTimeEnable = false;
                
                return true;
                
            } else if (permission === 'denied') {
                // User đã từ chối
                this.setNotificationStatus(false);
                this.permissionPrompted = true;
                localStorage.setItem(NOTIFICATION_CONFIG.permissionPromptedKey, 'true');
                
                this.addNotificationButton();
                
                // Chỉ toast khi lỗi (giữ nguyên behavior cũ)
                this.showToast('❌ Cần bật thông báo để nhận bài viết mới', 'warning');
                return false;
                
            } else {
                // User đóng popup (permission === 'default')
                this.addNotificationButton();
                // Không toast, chỉ log console (giữ nguyên behavior cũ)
                console.log('ℹ️ Người dùng đã đóng hộp thoại thông báo');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Lỗi yêu cầu quyền:', error);
            this.showToast('❌ Có lỗi xảy ra khi yêu cầu quyền', 'error');
            return false;
        }
    }

    // ===== BẬT NOTIFICATION (KHI ĐÃ CÓ QUYỀN) =====
    enableNotifications() {
        if (Notification.permission !== 'granted') {
            this.requestPermission();
            return;
        }
        
        this.setNotificationStatus(true);
        this.startPolling();
        this.addNotificationButton();
        
        // Log console, không toast (giữ nguyên behavior cũ)
        console.log('✅ Đã bật thông báo bài viết mới');
        
        // Kiểm tra bài viết mới ngay
        this.loadArticles(true, true);
    }

    // ===== TẮT THÔNG BÁO =====
    disableNotifications() {
        if (!this.isEnabled) {
            console.log('ℹ️ Notifications already disabled');
            return;
        }
        
        this.setNotificationStatus(false);
        this.stopPolling();
        this.addNotificationButton();
        
        // Log console, không toast (giữ nguyên behavior cũ)
        console.log('🔕 Đã tắt thông báo bài viết mới');
    }

    // ===== POLLING =====
    startPolling() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        console.log('🔄 Bắt đầu kiểm tra bài viết mới mỗi 30 phút');
        this.checkInterval = setInterval(() => {
            console.log('🔄 Đang kiểm tra bài viết mới...');
            this.loadArticles(true, false);
        }, NOTIFICATION_CONFIG.checkInterval);
    }

    stopPolling() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('⏹️ Đã dừng kiểm tra bài viết');
        }
    }

    // ===== NOTIFICATION TEST =====
    async showTestNotification() {
        if (Notification.permission !== 'granted') return;

        try {
            const registration = await navigator.serviceWorker.ready;
            if (registration && registration.active) {
                await registration.showNotification('✅ Đã bật thông báo thành công', {
                    body: 'Bạn sẽ nhận được thông báo khi có bài viết mới',
                    icon: '/icons/icon-192x192.png',
                    tag: 'test-notification',
                    silent: false
                });
            } else {
                new Notification('✅ Đã bật thông báo thành công', {
                    body: 'Bạn sẽ nhận được thông báo khi có bài viết mới',
                    icon: '/icons/icon-192x192.png'
                });
            }
        } catch (e) {
            new Notification('✅ Đã bật thông báo thành công', {
                body: 'Bạn sẽ nhận được thông báo khi có bài viết mới',
                icon: '/icons/icon-192x192.png'
            });
        }
    }

    // ===== TOAST NOTIFICATION (CHỈ DÙNG KHI CÓ LỖI) =====
    showToast(message, type = 'info', duration = 3000) {
        // Kiểm tra toast trùng nội dung
        const existingToasts = document.querySelectorAll('.notification-toast');
        for (let toast of existingToasts) {
            if (toast.querySelector('span')?.textContent === message) {
                console.log('⏭️ Toast already showing:', message);
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
            <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
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

    getNewArticlesCount() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - NOTIFICATION_CONFIG.newArticleDays);
        
        return this.articles.filter(article => {
            if (this.notifiedIds.includes(article.id)) return false;
            try {
                const articleDate = new Date(article.date);
                return articleDate >= cutoffDate;
            } catch (e) {
                return false;
            }
        }).length;
    }
}

// ===== CSS CHO NOTIFICATION =====
(function addNotificationStyles() {
    if (document.getElementById('notification-styles')) return;

    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        /* NÚT BẬT/TẮT THÔNG BÁO */
        .notification-toggle-btn {
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
            animation: slideInRight 0.5s ease;
        }

        .notification-toggle-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(0,212,255,0.6);
            border-color: white;
        }

        /* Khi đã bật */
        .notification-toggle-btn.enabled {
            background: linear-gradient(135deg, #4CAF50, #45a049);
            box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
        }

        .notification-toggle-btn.enabled:hover {
            background: linear-gradient(135deg, #45a049, #3d8b40);
            box-shadow: 0 8px 20px rgba(76, 175, 80, 0.6);
        }

        /* Khi bị chặn */
        .notification-toggle-btn.blocked {
            background: linear-gradient(135deg, #f44336, #d32f2f);
            opacity: 0.9;
        }

        .notification-toggle-btn.blocked:hover {
            background: linear-gradient(135deg, #d32f2f, #b71c1c);
        }

        /* Icon */
        .notification-toggle-btn i {
            font-size: 16px;
        }

        /* STATUS INDICATOR */
        .status-indicator {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 20px;
            z-index: 9998;
            background: rgba(0, 0, 0, 0.7);
            padding: 15px 30px;
            border-radius: 50px;
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: all 0.5s ease;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            pointer-events: none;
        }

        .status-indicator.hidden {
            opacity: 0;
            visibility: hidden;
            transform: translateX(-50%) translateY(20px);
        }

        .status-light {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            animation: statusPulse 4s infinite alternate;
        }

        .status-peak {
            background: var(--wave-peak, #ff2e63);
        }

        .status-dip {
            background: var(--wave-trough, #00d4ff);
        }

        .status-text {
            font-size: 1.2em;
            font-weight: bold;
            letter-spacing: 2px;
            transition: all 1s ease;
            color: white;
            text-shadow: 0 0 10px currentColor;
        }

        @keyframes statusPulse {
            0%, 100% {
                box-shadow: 0 0 10px currentColor;
                transform: scale(1);
            }
            50% {
                box-shadow: 0 0 20px currentColor;
                transform: scale(1.1);
            }
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
            z-index: 10000;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            border: 2px solid white;
            transition: transform 0.3s ease;
            max-width: 90%;
            font-weight: 500;
            pointer-events: none;
            text-align: center;
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

        .toast-info {
            background: linear-gradient(135deg, #00d4ff, #0088cc);
        }

        /* MOBILE RESPONSIVE */
        @media (max-width: 768px) {
            .notification-toggle-btn {
                bottom: 20px;
                right: 15px;
                padding: 0;
                width: 52px;
                height: 52px;
                border-radius: 50%;
                justify-content: center;
                box-shadow: 0 4px 15px rgba(0,212,255,0.5);
            }
            
            .notification-toggle-btn span {
                display: none;
            }
            
            .notification-toggle-btn i {
                font-size: 24px;
                margin: 0;
            }
            
            .status-indicator {
                padding: 12px 20px;
                bottom: 20px;
                max-width: 90%;
            }
            
            .status-text {
                font-size: 1em;
                letter-spacing: 1px;
            }
            
            .status-light {
                width: 16px;
                height: 16px;
            }
            
            .notification-toast {
                bottom: 90px;
                padding: 10px 20px;
                font-size: 0.9em;
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
            
            .notification-toast {
                bottom: 80px;
                padding: 8px 16px;
                font-size: 0.85em;
            }
        }

        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideUp {
            from {
                transform: translate(-50%, 100%);
                opacity: 0;
            }
            to {
                transform: translate(-50%, 0);
                opacity: 1;
            }
        }
    `;

    document.head.appendChild(style);
})();

// ===== KHỞI TẠO =====
let notificationSystem = null;

// Chỉ khởi tạo một lần
if (!window.articleNotifications) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!window.articleNotifications) {
                notificationSystem = new ArticleNotificationSystem();
                window.articleNotifications = notificationSystem;
            }
        });
    } else {
        if (!window.articleNotifications) {
            notificationSystem = new ArticleNotificationSystem();
            window.articleNotifications = notificationSystem;
        }
    }
} else {
    console.log('ℹ️ Notification system already initialized');
    notificationSystem = window.articleNotifications;
}

window.ArticleNotificationSystem = ArticleNotificationSystem;
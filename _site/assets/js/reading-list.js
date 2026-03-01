// reading-list.js - Version 1.0.1
// Quản lý reading list tập trung cho Bitcoin PeakDip
// Đã đồng bộ toast với notifications.js

const READING_LIST = {
    KEY: 'reading_list',
    VERSION: '1.0.1',
    
    /**
     * Lấy tất cả bài viết trong reading list
     * @returns {Array} Danh sách bài viết
     */
    getAll() {
        try {
            return JSON.parse(localStorage.getItem(this.KEY) || '[]');
        } catch (e) {
            console.error('Error reading reading list:', e);
            return [];
        }
    },
    
    /**
     * Lưu danh sách bài viết
     * @param {Array} list - Danh sách bài viết
     * @returns {Array} Danh sách đã lưu
     */
    save(list) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(list));
            this.updateBadges();
            // Dispatch event để các tab khác cập nhật
            window.dispatchEvent(new StorageEvent('storage', {
                key: this.KEY,
                newValue: JSON.stringify(list)
            }));
            return list;
        } catch (e) {
            console.error('Error saving reading list:', e);
            return list;
        }
    },
    
    /**
     * Thêm bài viết vào reading list
     * @param {Object} article - Thông tin bài viết
     * @param {string} article.id - ID bài viết
     * @param {string} article.title - Tiêu đề
     * @param {string} article.slug - Slug (tùy chọn)
     * @param {string} article.url - URL đầy đủ (tùy chọn)
     * @param {string} article.date - Ngày xuất bản (tùy chọn)
     * @returns {boolean} true nếu thêm thành công
     */
    add(article) {
        if (!article || !article.id || !article.title) {
            console.error('Invalid article data:', article);
            this.showToast('❌ Invalid article data', 'error');
            return false;
        }
        
        const list = this.getAll();
        const exists = list.some(item => item.id === article.id);
        
        if (!exists) {
            const newItem = {
                id: article.id,
                title: article.title,
                url: article.url || this.generateUrl(article),
                savedAt: new Date().toISOString(),
                publishedDate: article.date || this.extractDateFromUrl(article.url) || new Date().toISOString().split('T')[0]
            };
            
            list.push(newItem);
            this.save(list);
            this.showToast('✅ Added to reading list', 'success');
            
            // Gửi message đến service worker nếu có
            this.notifyServiceWorker('ADDED', newItem);
            
            return true;
        } else {
            this.showToast('📚 Already in reading list', 'info');
            return false;
        }
    },
    
    /**
     * Tạo URL từ slug nếu không có URL
     * @param {Object} article - Thông tin bài viết
     * @returns {string} URL hoàn chỉnh
     */
    generateUrl(article) {
        if (article.url) return article.url;
        const slug = article.slug || article.id;
        return `/learn/article.html?id=${slug}`;
    },
    
    /**
     * Trích xuất ngày từ URL (fallback)
     * @param {string} url - URL bài viết
     * @returns {string|null} Ngày hoặc null
     */
    extractDateFromUrl(url) {
        // Có thể implement nếu cần
        return null;
    },
    
    /**
     * Xóa bài viết khỏi reading list
     * @param {string} id - ID bài viết
     * @returns {Array} Danh sách sau khi xóa
     */
    remove(id) {
        if (!id) return this.getAll();
        
        let list = this.getAll();
        const removedItem = list.find(item => item.id === id);
        list = list.filter(item => item.id !== id);
        
        if (list.length !== this.getAll().length) {
            this.save(list);
            this.showToast('🗑️ Removed from reading list', 'info');
            
            // Gửi message đến service worker
            if (removedItem) {
                this.notifyServiceWorker('REMOVED', removedItem);
            }
        }
        
        return list;
    },
    
    /**
     * Xóa nhiều bài viết cùng lúc
     * @param {Array<string>} ids - Mảng ID cần xóa
     * @returns {Array} Danh sách sau khi xóa
     */
    removeMultiple(ids) {
        if (!ids || !ids.length) return this.getAll();
        
        let list = this.getAll();
        const originalLength = list.length;
        list = list.filter(item => !ids.includes(item.id));
        
        if (list.length !== originalLength) {
            this.save(list);
            this.showToast(`🗑️ Removed ${originalLength - list.length} items`, 'info');
        }
        
        return list;
    },
    
    /**
     * Xóa tất cả bài viết
     * @returns {Array} Danh sách rỗng
     */
    clearAll() {
        if (this.getCount() === 0) return [];
        
        if (confirm('Are you sure you want to clear your entire reading list?')) {
            this.save([]);
            this.showToast('🗑️ Reading list cleared', 'info');
        }
        
        return [];
    },
    
    /**
     * Kiểm tra bài viết đã tồn tại chưa
     * @param {string} id - ID bài viết
     * @returns {boolean} true nếu đã tồn tại
     */
    exists(id) {
        return this.getAll().some(item => item.id === id);
    },
    
    /**
     * Lấy số lượng bài viết
     * @returns {number} Số lượng
     */
    getCount() {
        return this.getAll().length;
    },
    
    /**
     * Lấy bài viết theo ID
     * @param {string} id - ID bài viết
     * @returns {Object|null} Bài viết hoặc null
     */
    getById(id) {
        return this.getAll().find(item => item.id === id) || null;
    },
    
    /**
     * Sắp xếp danh sách theo ngày lưu
     * @param {string} order - 'asc' hoặc 'desc'
     * @returns {Array} Danh sách đã sắp xếp
     */
    sortByDate(order = 'desc') {
        const list = this.getAll();
        return list.sort((a, b) => {
            const dateA = new Date(a.savedAt).getTime();
            const dateB = new Date(b.savedAt).getTime();
            return order === 'desc' ? dateB - dateA : dateA - dateB;
        });
    },
    
    /**
     * Tìm kiếm bài viết
     * @param {string} query - Từ khóa tìm kiếm
     * @returns {Array} Kết quả tìm kiếm
     */
    search(query) {
        if (!query) return this.getAll();
        
        const lowerQuery = query.toLowerCase();
        return this.getAll().filter(item => 
            item.title.toLowerCase().includes(lowerQuery)
        );
    },
    
    /**
     * Xuất danh sách ra JSON
     * @returns {string} JSON string
     */
    exportToJSON() {
        return JSON.stringify({
            version: this.VERSION,
            exportDate: new Date().toISOString(),
            count: this.getCount(),
            items: this.getAll()
        }, null, 2);
    },
    
    /**
     * Nhập danh sách từ JSON
     * @param {string} jsonString - JSON string
     * @returns {boolean} true nếu thành công
     */
    importFromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (data.items && Array.isArray(data.items)) {
                // Merge với danh sách hiện tại, tránh trùng lặp
                const currentList = this.getAll();
                const newIds = new Set(data.items.map(item => item.id));
                const filteredCurrent = currentList.filter(item => !newIds.has(item.id));
                const mergedList = [...filteredCurrent, ...data.items];
                
                this.save(mergedList);
                this.showToast(`📥 Imported ${data.items.length} items`, 'success');
                return true;
            }
        } catch (e) {
            this.showToast('❌ Invalid JSON format', 'error');
        }
        return false;
    },
    
    /**
     * Cập nhật tất cả các badge
     */
    updateBadges() {
        const count = this.getCount();
        
        // 1. Desktop menu badge
        const badge = document.getElementById('readingListBadge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline' : 'none';
        }
        
        // 2. Mobile icon badge (PWA)
        let mobileBadge = document.getElementById('readingListBadgeMobile');
        if (!mobileBadge) {
            // Tạo mobile badge nếu chưa có
            mobileBadge = this.createMobileBadge();
        }
        
        if (mobileBadge) {
            mobileBadge.textContent = count > 9 ? '9+' : count;
            mobileBadge.style.display = count > 0 ? 'flex' : 'none';
        }
        
        // 3. PWA app badge (nếu trình duyệt hỗ trợ)
        this.updatePWABadge(count);
        
        // 4. Update document title nếu cần
        this.updateDocumentTitle(count);
    },
    
    /**
     * Tạo badge cho mobile
     * @returns {HTMLElement|null} Badge element
     */
    createMobileBadge() {
        const readingListLink = document.getElementById('readingListLink');
        if (!readingListLink) return null;
        
        // Kiểm tra đã có badge chưa
        let mobileBadge = document.getElementById('readingListBadgeMobile');
        if (mobileBadge) return mobileBadge;
        
        // Tạo badge mới
        mobileBadge = document.createElement('span');
        mobileBadge.id = 'readingListBadgeMobile';
        mobileBadge.className = 'reading-list-badge-mobile';
        mobileBadge.style.display = 'none';
        
        // Thêm style cho badge mobile
        const style = document.createElement('style');
        style.textContent = `
            .reading-list-badge-mobile {
                position: absolute;
                top: -5px;
                right: -5px;
                background: linear-gradient(135deg, #ff6b00, #ff3d00);
                color: white;
                font-size: 0.6em;
                font-weight: bold;
                min-width: 18px;
                height: 18px;
                border-radius: 9px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 4px;
                border: 2px solid #050811;
                box-shadow: 0 0 15px rgba(255, 107, 0, 0.7);
                z-index: 1000;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }
        `;
        
        if (!document.querySelector('style[data-reading-list]')) {
            style.setAttribute('data-reading-list', 'true');
            document.head.appendChild(style);
        }
        
        readingListLink.style.position = 'relative';
        readingListLink.appendChild(mobileBadge);
        
        return mobileBadge;
    },
    
    /**
     * Cập nhật PWA app badge
     * @param {number} count - Số lượng
     */
    updatePWABadge(count) {
        if (navigator.setAppBadge) {
            navigator.setAppBadge(count).catch(() => {});
        } else if (navigator.setExperimentalAppBadge) {
            navigator.setExperimentalAppBadge(count).catch(() => {});
        }
    },
    
    /**
     * Cập nhật document title
     * @param {number} count - Số lượng
     */
    updateDocumentTitle(count) {
        const originalTitle = document.title.replace(/^\(\d+\)\s*/, '');
        if (count > 0) {
            document.title = `(${count}) ${originalTitle}`;
        } else {
            document.title = originalTitle;
        }
    },
    
    /**
     * Gửi thông báo đến service worker
     * @param {string} action - Hành động
     * @param {Object} data - Dữ liệu
     */
    notifyServiceWorker(action, data) {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'READING_LIST_UPDATE',
                action: action,
                data: data,
                timestamp: Date.now()
            });
        }
    },
    
    /**
     * Hiển thị toast notification - ĐÃ ĐỒNG BỘ VỚI NOTIFICATIONS.JS
     * @param {string} message - Nội dung
     * @param {string} type - Loại: success, info, warning, error
     */
    showToast(message, type = 'info') {
        // Ưu tiên dùng toast từ notifications.js nếu có
        if (window.articleNotifications && typeof window.articleNotifications.showToast === 'function') {
            window.articleNotifications.showToast(message, type);
            return;
        }
        
        // Fallback nếu không có notifications.js
        // Xóa toast cũ
        const oldToast = document.querySelector('.notification-toast, .toast-notification');
        if (oldToast) oldToast.remove();
        
        const toast = document.createElement('div');
        // Dùng class .notification-toast để đồng bộ với notifications.js
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
        
        // Animation hiện
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Tự động ẩn sau 3 giây
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
        
        // Thêm keyframes nếu chưa có
        if (!document.querySelector('#toast-keyframes-fallback')) {
            const keyframes = document.createElement('style');
            keyframes.id = 'toast-keyframes-fallback';
            keyframes.textContent = `
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
                @keyframes fadeOut {
                    to {
                        opacity: 0;
                        transform: translate(-50%, 20px);
                    }
                }
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
                    z-index: 10000;
                    box-shadow: 0 5px 20px rgba(0,0,0,0.3);
                    border: 2px solid white;
                    transition: transform 0.3s ease;
                    max-width: 90%;
                    font-weight: 500;
                    pointer-events: none;
                }
                .notification-toast.show {
                    transform: translateX(-50%) translateY(0);
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
                .notification-toast.fade-out {
                    animation: fadeOut 0.3s ease forwards;
                }
            `;
            document.head.appendChild(keyframes);
        }
    }
};

// ========== AUTO INITIALIZATION ==========
(function() {
    // Khởi tạo khi DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            READING_LIST.updateBadges();
        });
    } else {
        READING_LIST.updateBadges();
    }
    
    // Lắng nghe sự thay đổi từ tab khác
    window.addEventListener('storage', (e) => {
        if (e.key === READING_LIST.KEY) {
            READING_LIST.updateBadges();
            
            // Reload trang reading list nếu đang mở
            if (window.location.pathname.includes('reading-list.html')) {
                if (typeof window.loadReadingList === 'function') {
                    window.loadReadingList();
                }
            }
        }
    });
    
    // Lắng nghe message từ service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('📨 ReadingList received:', event.data);
            
            if (event.data.type === 'SAVE_FOR_LATER' && event.data.article) {
                READING_LIST.add(event.data.article);
            }
            
            if (event.data.type === 'READING_LIST_UPDATED') {
                READING_LIST.updateBadges();
            }
        });
    }
    
    console.log('📚 Reading List Manager v' + READING_LIST.VERSION + ' initialized');
})();

// Export global
window.readingList = READING_LIST;
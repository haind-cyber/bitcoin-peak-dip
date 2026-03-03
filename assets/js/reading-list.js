// reading-list.js - Version 1.1.0
// Quản lý reading list tập trung cho Bitcoin PeakDip
// Tối ưu hóa chạy song song, đồng bộ với notification system

const READING_LIST = {
    KEY: 'reading_list',
    VERSION: '1.1.0',
    
    // Cache DOM elements để tránh query nhiều lần
    _elements: {
        badge: null,
        mobileBadge: null,
        readingListLink: null
    },
    
    // Debounce timers
    _debounceTimers: {},
    
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
     * Lưu danh sách bài viết (không block)
     * @param {Array} list - Danh sách bài viết
     * @returns {Array} Danh sách đã lưu
     */
    save(list) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(list));
            
            // Debounce update badges để tránh gọi nhiều lần
            this.debounce('updateBadges', () => {
                this.updateBadges();
            }, 100);
            
            // Dispatch event bất đồng bộ
            setTimeout(() => {
                window.dispatchEvent(new StorageEvent('storage', {
                    key: this.KEY,
                    newValue: JSON.stringify(list)
                }));
            }, 0);
            
            return list;
        } catch (e) {
            console.error('Error saving reading list:', e);
            return list;
        }
    },
    
    /**
     * Debounce function
     * @param {string} key - Key để identify timer
     * @param {Function} fn - Hàm cần debounce
     * @param {number} delay - Thời gian delay (ms)
     */
    debounce(key, fn, delay = 100) {
        if (this._debounceTimers[key]) {
            clearTimeout(this._debounceTimers[key]);
        }
        this._debounceTimers[key] = setTimeout(() => {
            fn();
            delete this._debounceTimers[key];
        }, delay);
    },
    
    /**
     * Thêm bài viết vào reading list (không block)
     * @param {Object} article - Thông tin bài viết
     * @returns {boolean} true nếu thêm thành công
     */
    add(article) {
        if (!article || !article.id || !article.title) {
            console.error('Invalid article data:', article);
            this.showToast('❌ Invalid article data', 'error');
            return false;
        }
        
        // Sử dụng requestIdleCallback nếu có
        const scheduleTask = (task) => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(task, { timeout: 1000 });
            } else {
                setTimeout(task, 0);
            }
        };
        
        scheduleTask(() => {
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
                
                // Gửi message đến service worker (có retry)
                this.notifyServiceWorkerWithRetry('ADDED', newItem);
            } else {
                this.showToast('📚 Already in reading list', 'info');
            }
        });
        
        return true;
    },
    
    /**
     * Gửi message đến service worker với retry
     * @param {string} action - Hành động
     * @param {Object} data - Dữ liệu
     * @param {number} retryCount - Số lần retry
     */
    notifyServiceWorkerWithRetry(action, data, retryCount = 0) {
        const maxRetries = 3;
        
        if (!('serviceWorker' in navigator)) return;
        
        const sendMessage = () => {
            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'READING_LIST_UPDATE',
                    action: action,
                    data: data,
                    timestamp: Date.now()
                });
            } else if (retryCount < maxRetries) {
                // Retry sau 500ms * retryCount
                setTimeout(() => {
                    this.notifyServiceWorkerWithRetry(action, data, retryCount + 1);
                }, 500 * (retryCount + 1));
            }
        };
        
        // Đợi service worker ready nếu cần
        if (navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready.then(sendMessage);
        } else {
            sendMessage();
        }
    },
    
    /**
     * Xóa bài viết khỏi reading list
     * @param {string} id - ID bài viết
     * @returns {Array} Danh sách sau khi xóa
     */
    remove(id) {
        if (!id) return this.getAll();
        
        // Sử dụng setTimeout để không block
        setTimeout(() => {
            let list = this.getAll();
            const removedItem = list.find(item => item.id === id);
            list = list.filter(item => item.id !== id);
            
            if (list.length !== this.getAll().length) {
                this.save(list);
                this.showToast('🗑️ Removed from reading list', 'info');
                
                if (removedItem) {
                    this.notifyServiceWorkerWithRetry('REMOVED', removedItem);
                }
            }
        }, 0);
        
        return this.getAll();
    },
    
    /**
     * Xóa nhiều bài viết cùng lúc
     * @param {Array<string>} ids - Mảng ID cần xóa
     * @returns {Array} Danh sách sau khi xóa
     */
    removeMultiple(ids) {
        if (!ids || !ids.length) return this.getAll();
        
        setTimeout(() => {
            let list = this.getAll();
            const originalLength = list.length;
            list = list.filter(item => !ids.includes(item.id));
            
            if (list.length !== originalLength) {
                this.save(list);
                this.showToast(`🗑️ Removed ${originalLength - list.length} items`, 'info');
            }
        }, 0);
        
        return this.getAll();
    },
    
    /**
     * Xóa tất cả bài viết
     * @returns {Array} Danh sách rỗng
     */
    clearAll() {
        if (this.getCount() === 0) return [];
        
        // Dùng setTimeout để không block confirm dialog
        setTimeout(() => {
            if (confirm('Are you sure you want to clear your entire reading list?')) {
                this.save([]);
                this.showToast('🗑️ Reading list cleared', 'info');
            }
        }, 0);
        
        return [];
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
        if (!url) return null;
        const match = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
        return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
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
                setTimeout(() => {
                    const currentList = this.getAll();
                    const newIds = new Set(data.items.map(item => item.id));
                    const filteredCurrent = currentList.filter(item => !newIds.has(item.id));
                    const mergedList = [...filteredCurrent, ...data.items];
                    
                    this.save(mergedList);
                    this.showToast(`📥 Imported ${data.items.length} items`, 'success');
                }, 0);
                return true;
            }
        } catch (e) {
            this.showToast('❌ Invalid JSON format', 'error');
        }
        return false;
    },
    
    /**
     * Cập nhật tất cả các badge (tối ưu)
     */
    updateBadges() {
        const count = this.getCount();
        
        // Sử dụng requestAnimationFrame để tránh layout thrashing
        requestAnimationFrame(() => {
            // Cache DOM elements
            if (!this._elements.badge) {
                this._elements.badge = document.getElementById('readingListBadge');
            }
            
            // 1. Desktop menu badge
            if (this._elements.badge) {
                this._elements.badge.textContent = count;
                this._elements.badge.style.display = count > 0 ? 'inline' : 'none';
            }
            
            // 2. Mobile icon badge
            this.updateMobileBadge(count);
            
            // 3. PWA app badge
            this.updatePWABadge(count);
            
            // 4. Update document title
            this.updateDocumentTitle(count);
        });
    },
    
    /**
     * Cập nhật mobile badge
     * @param {number} count - Số lượng
     */
    updateMobileBadge(count) {
        if (!this._elements.readingListLink) {
            this._elements.readingListLink = document.getElementById('readingListLink');
        }
        
        if (!this._elements.readingListLink) return;
        
        if (!this._elements.mobileBadge) {
            this._elements.mobileBadge = document.getElementById('readingListBadgeMobile');
        }
        
        if (!this._elements.mobileBadge) {
            this._elements.mobileBadge = this.createMobileBadge();
        }
        
        if (this._elements.mobileBadge) {
            this._elements.mobileBadge.textContent = count > 9 ? '9+' : count;
            this._elements.mobileBadge.style.display = count > 0 ? 'flex' : 'none';
        }
    },
    
    /**
     * Tạo badge cho mobile
     * @returns {HTMLElement|null} Badge element
     */
    createMobileBadge() {
        const readingListLink = this._elements.readingListLink || document.getElementById('readingListLink');
        if (!readingListLink) return null;
        
        let mobileBadge = document.getElementById('readingListBadgeMobile');
        if (mobileBadge) return mobileBadge;
        
        mobileBadge = document.createElement('span');
        mobileBadge.id = 'readingListBadgeMobile';
        mobileBadge.className = 'reading-list-badge-mobile';
        mobileBadge.style.display = 'none';
        
        // Thêm style một lần duy nhất
        if (!document.querySelector('style[data-reading-list]')) {
            const style = document.createElement('style');
            style.setAttribute('data-reading-list', 'true');
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
            document.head.appendChild(style);
        }
        
        readingListLink.style.position = 'relative';
        readingListLink.appendChild(mobileBadge);
        this._elements.mobileBadge = mobileBadge;
        
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
        document.title = count > 0 ? `(${count}) ${originalTitle}` : originalTitle;
    },
    
    /**
     * Gửi thông báo đến service worker
     * @param {string} action - Hành động
     * @param {Object} data - Dữ liệu
     */
    notifyServiceWorker(action, data) {
        this.notifyServiceWorkerWithRetry(action, data);
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
        
        // Fallback không block
        setTimeout(() => {
            const oldToast = document.querySelector('.notification-toast, .toast-notification');
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
            
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });
            
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }, 0);
    }
};

// ========== CẤU HÌNH DELAY CHO READING LIST ==========
const READING_LIST_LOAD_CONFIG = {
    // Thời gian delay tối thiểu (ms)
    minInitDelay: typeof window !== 'undefined' && window.IS_MOBILE ? 4000 : 2000,
    
    // Chỉ khởi tạo khi tab active
    requireVisible: true,
    
    // Timeout cho idle callback
    idleTimeout: typeof window !== 'undefined' && window.IS_MOBILE ? 8000 : 4000,
    
    // Không cập nhật badge ngay lập tức
    deferBadgeUpdate: true
};

// ===== HÀM KIỂM TRA ĐIỀU KIỆN =====
function canInitializeReadingList() {
    // Không khởi tạo nếu đang trong quá trình load ban đầu
    if (document.readyState === 'loading') {
        console.log('⏳ Document still loading, defer reading list init');
        return false;
    }
    
    // Trên mobile, chỉ khởi tạo khi tab visible
    if (window.IS_MOBILE && document.hidden) {
        console.log('📱 Mobile tab hidden, defer reading list init');
        return false;
    }
    
    return true;
}

// ===== HÀM KHỞI TẠO CHÍNH =====
function initializeReadingList() {
    // Kiểm tra nếu đã khởi tạo
    if (window.readingListInitialized) {
        console.log('ℹ️ Reading List already initialized');
        return;
    }
    
    // Kiểm tra điều kiện
    if (!canInitializeReadingList()) {
        // Thử lại sau 3 giây
        setTimeout(initializeReadingList, 3000);
        return;
    }
    
    console.log('📚 Reading List Manager v' + READING_LIST.VERSION + ' initializing...');
    
    try {
        // Cache DOM elements
        READING_LIST._elements.readingListLink = document.getElementById('readingListLink');
        READING_LIST._elements.badge = document.getElementById('readingListBadge');
        
        // Cập nhật badges nhưng có thể delay thêm trên mobile
        if (window.IS_MOBILE) {
            // Trên mobile, delay cập nhật badge thêm 1 giây
            setTimeout(() => {
                READING_LIST.updateBadges();
                console.log('📱 Mobile: Reading List badges updated after delay');
            }, 1000);
        } else {
            READING_LIST.updateBadges();
        }
        
        // Đánh dấu đã khởi tạo
        window.readingListInitialized = true;
        console.log('📚 Reading List Manager initialized successfully');
        
    } catch (error) {
        console.error('❌ Failed to initialize Reading List:', error);
        // Thử lại sau 10 giây nếu lỗi
        setTimeout(initializeReadingList, 10000);
    }
}

// ===== CHIẾN LƯỢC KHỞI TẠO THEO GIAI ĐOẠN =====
(function() {
    console.log('📖 Reading List loader ready');
    
    // Phase 1: Đợi DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('📄 DOM ready, scheduling reading list init...');
            scheduleReadingListInit();
        });
    } else {
        scheduleReadingListInit();
    }
    
    function scheduleReadingListInit() {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                setTimeout(initializeReadingList, READING_LIST_LOAD_CONFIG.minInitDelay);
            }, { timeout: READING_LIST_LOAD_CONFIG.idleTimeout });
        } else {
            setTimeout(initializeReadingList, READING_LIST_LOAD_CONFIG.minInitDelay + 1000);
        }
    }
    
    // Phase 2: Lắng nghe visibility change
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !window.readingListInitialized) {
            console.log('📱 Tab became visible, initializing reading list');
            setTimeout(initializeReadingList, 2000);
        }
    });
    
    // Phase 3: Fallback sau 15 giây
    setTimeout(() => {
        if (!window.readingListInitialized) {
            console.log('⏰ Fallback: forcing reading list init after 15s');
            initializeReadingList();
        }
    }, 15000);
})();

// ===== EVENT LISTENERS - GIỮ NGUYÊN NHƯNG DELAY =====
(function setupReadingListListeners() {
    // Lắng nghe sự thay đổi từ tab khác - nhưng có delay
    window.addEventListener('storage', (e) => {
        if (e.key === READING_LIST.KEY) {
            // Delay nhẹ để không ảnh hưởng performance
            setTimeout(() => {
                if (window.readingListInitialized) {
                    READING_LIST.updateBadges();
                    
                    // Reload trang reading list nếu đang mở
                    if (window.location.pathname.includes('reading-list.html')) {
                        if (typeof window.loadReadingList === 'function') {
                            window.loadReadingList();
                        }
                    }
                }
            }, 500);
        }
    });
    
    // Lắng nghe message từ service worker - nhưng có delay
    if ('serviceWorker' in navigator) {
        // Đợi service worker ready
        navigator.serviceWorker.ready.then(() => {
            navigator.serviceWorker.addEventListener('message', (event) => {
                // Xử lý trong microtask, không block
                setTimeout(() => {
                    if (!window.readingListInitialized) return;
                    
                    console.log('📨 ReadingList received:', event.data);
                    
                    if (event.data.type === 'SAVE_FOR_LATER' && event.data.article) {
                        READING_LIST.add(event.data.article);
                    }
                    
                    if (event.data.type === 'READING_LIST_UPDATED') {
                        READING_LIST.updateBadges();
                    }
                }, 0);
            });
        });
    }
})();

// Export global
window.readingList = READING_LIST;
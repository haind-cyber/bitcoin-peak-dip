---
layout: page
title: Reading List - Bitcoin PeakDip
description: Articles saved for later reading
status_text: READING LIST
---

<!-- Reading List Header -->
<div class="reading-list-header">
    <h1 class="reading-list-title">
        <i class="fas fa-bookmark"></i>
        Your Reading List
    </h1>
    <p class="reading-list-subtitle">Articles saved for later</p>
</div>

<!-- Reading List Container -->
<div class="reading-list-container">
    <div id="readingList" class="reading-list">
        <!-- JS will populate here -->
    </div>
    
    <!-- Reading List Actions -->
    <div class="reading-list-actions" id="readingListActions" style="display: none;">
        <button class="action-btn export-btn" onclick="exportReadingList()">
            <i class="fas fa-download"></i>
            Export List
        </button>
        <button class="action-btn clear-btn" onclick="clearReadingList()">
            <i class="fas fa-trash-alt"></i>
            Clear All
        </button>
    </div>
    
    <!-- Back to Learn -->
    <div class="back-to-learn">
        <a href="{{ '/learn' | relative_url }}" class="back-btn">
            <i class="fas fa-arrow-left"></i> Back to Knowledge Base
        </a>
    </div>
</div>

<!-- Import/Export Modal (hidden by default) -->
<div id="importModal" class="modal" style="display: none;">
    <div class="modal-content">
        <div class="modal-header">
            <h3><i class="fas fa-file-import"></i> Import Reading List</h3>
            <button class="modal-close" onclick="closeImportModal()">&times;</button>
        </div>
        <div class="modal-body">
            <p>Paste your exported reading list JSON below:</p>
            <textarea id="importData" class="import-textarea" rows="8" placeholder='{"version":"1.0.1","items":[...]}'></textarea>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="closeImportModal()">Cancel</button>
                <button class="modal-btn import" onclick="processImport()">Import</button>
            </div>
        </div>
    </div>
</div>

<!-- Empty State Template (used by JavaScript) -->
<template id="emptyStateTemplate">
    <div class="empty-list">
        <div class="empty-icon">
            <i class="fas fa-book-open"></i>
        </div>
        <h3>Your reading list is empty</h3>
        <p>Save articles from notifications or article pages to read them later</p>
        <div class="empty-actions">
            <a href="{{ '/learn' | relative_url }}" class="empty-btn">
                <i class="fas fa-graduation-cap"></i> Browse Articles
            </a>
            <button class="empty-btn secondary" onclick="window.articleNotifications?.requestPermission()">
                <i class="fas fa-bell"></i> Enable Notifications
            </button>
        </div>
    </div>
</template>

<!-- ========== JAVASCRIPT ========== -->
<script>
// Reading List Manager
const ReadingListManager = {
    STORAGE_KEY: 'reading_list',
    
    // Initialize
    init() {
        this.loadList();
        this.setupEventListeners();
        this.checkPendingSave();
    },
    
    // Load and display reading list
    loadList() {
        const container = document.getElementById('readingList');
        const actions = document.getElementById('readingListActions');
        const list = this.getList();
        
        if (!container) return;
        
        if (list.length === 0) {
            // Show empty state
            const template = document.getElementById('emptyStateTemplate');
            container.innerHTML = template ? template.innerHTML : this.getEmptyStateHTML();
            if (actions) actions.style.display = 'none';
            return;
        }
        
        // Show actions
        if (actions) actions.style.display = 'flex';
        
        // Sort by saved date (newest first)
        list.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        
        let html = '';
        list.forEach((item, index) => {
            html += this.renderItem(item, index);
        });
        
        container.innerHTML = html;
        
        // Attach event listeners to delete buttons
        document.querySelectorAll('.delete-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                this.removeItem(id);
            });
        });
        
        // Attach event listeners to mark as read buttons
        document.querySelectorAll('.mark-read').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                this.markAsRead(id);
            });
        });
    },
    
    // Get reading list from localStorage
    getList() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
        } catch (e) {
            console.error('Error reading reading list:', e);
            return [];
        }
    },
    
    // Save reading list to localStorage
    saveList(list) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
            this.updateBadge();
            this.loadList();
            
            // Dispatch event for other tabs
            window.dispatchEvent(new StorageEvent('storage', {
                key: this.STORAGE_KEY,
                newValue: JSON.stringify(list)
            }));
            
            return true;
        } catch (e) {
            console.error('Error saving reading list:', e);
            return false;
        }
    },
    
    // Add item to reading list
    addItem(article) {
        if (!article || !article.id || !article.title) {
            console.error('Invalid article data:', article);
            this.showToast('❌ Invalid article data', 'error');
            return false;
        }
        
        const list = this.getList();
        const exists = list.some(item => item.id === article.id);
        
        if (!exists) {
            const newItem = {
                id: article.id,
                title: article.title,
                url: article.url || this.generateUrl(article),
                savedAt: new Date().toISOString(),
                publishedDate: article.date || this.extractDateFromUrl(article.url) || new Date().toISOString().split('T')[0],
                read: false
            };
            
            list.push(newItem);
            this.saveList(list);
            this.showToast('✅ Added to reading list', 'success');
            
            // Track with analytics if available
            if (typeof gtag !== 'undefined') {
                gtag('event', 'add_to_reading_list', {
                    'article_id': article.id,
                    'article_title': article.title
                });
            }
            
            return true;
        } else {
            this.showToast('📚 Already in reading list', 'info');
            return false;
        }
    },
    
    // Remove item from reading list
    removeItem(id) {
        if (!id) return false;
        
        let list = this.getList();
        const removedItem = list.find(item => item.id === id);
        list = list.filter(item => item.id !== id);
        
        if (list.length !== this.getList().length) {
            this.saveList(list);
            this.showToast('🗑️ Removed from reading list', 'info');
            
            // Track with analytics
            if (typeof gtag !== 'undefined' && removedItem) {
                gtag('event', 'remove_from_reading_list', {
                    'article_id': id,
                    'article_title': removedItem.title
                });
            }
            
            return true;
        }
        
        return false;
    },
    
    // Mark item as read
    markAsRead(id) {
        let list = this.getList();
        const item = list.find(item => item.id === id);
        
        if (item) {
            item.read = true;
            item.readAt = new Date().toISOString();
            this.saveList(list);
            this.showToast('✅ Marked as read', 'success');
            
            // Optional: remove after marking as read
            // setTimeout(() => this.removeItem(id), 1500);
        }
    },
    
    // Clear entire reading list
    clearAll() {
        if (this.getList().length === 0) return false;
        
        if (confirm('Are you sure you want to clear your entire reading list?')) {
            this.saveList([]);
            this.showToast('🗑️ Reading list cleared', 'info');
            
            // Track with analytics
            if (typeof gtag !== 'undefined') {
                gtag('event', 'clear_reading_list');
            }
            
            return true;
        }
        
        return false;
    },
    
    // Export reading list as JSON
    exportList() {
        const list = this.getList();
        if (list.length === 0) {
            this.showToast('📭 No items to export', 'warning');
            return;
        }
        
        const exportData = {
            version: '1.0.1',
            exportDate: new Date().toISOString(),
            count: list.length,
            items: list
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bitcoin-peakdip-reading-list-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('📥 Reading list exported', 'success');
    },
    
    // Import reading list from JSON
    importList(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            // Validate format
            if (!data.items || !Array.isArray(data.items)) {
                throw new Error('Invalid format: missing items array');
            }
            
            // Validate each item
            const validItems = data.items.filter(item => 
                item.id && item.title && item.url
            );
            
            if (validItems.length === 0) {
                throw new Error('No valid items found');
            }
            
            // Merge with existing list, avoid duplicates
            const currentList = this.getList();
            const newIds = new Set(validItems.map(item => item.id));
            const filteredCurrent = currentList.filter(item => !newIds.has(item.id));
            const mergedList = [...filteredCurrent, ...validItems];
            
            this.saveList(mergedList);
            this.showToast(`📥 Imported ${validItems.length} items`, 'success');
            
            // Track with analytics
            if (typeof gtag !== 'undefined') {
                gtag('event', 'import_reading_list', {
                    'item_count': validItems.length
                });
            }
            
            return true;
        } catch (e) {
            console.error('Import error:', e);
            this.showToast('❌ Invalid JSON format', 'error');
            return false;
        }
    },
    
    // Update reading list badge in navigation
    updateBadge() {
        const count = this.getList().length;
        
        // Desktop badge
        const badge = document.getElementById('readingListBadge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline' : 'none';
        }
        
        // Mobile badge
        let mobileBadge = document.getElementById('readingListBadgeMobile');
        if (!mobileBadge) {
            mobileBadge = this.createMobileBadge();
        }
        
        if (mobileBadge) {
            mobileBadge.textContent = count > 9 ? '9+' : count;
            mobileBadge.style.display = count > 0 ? 'flex' : 'none';
        }
        
        // Update page title
        this.updateTitle(count);
        
        // Update PWA badge if supported
        this.updatePWABadge(count);
    },
    
    // Create mobile badge
    createMobileBadge() {
        const readingListLink = document.getElementById('readingListLink');
        if (!readingListLink) return null;
        
        // Check if already exists
        let mobileBadge = document.getElementById('readingListBadgeMobile');
        if (mobileBadge) return mobileBadge;
        
        // Create new badge
        mobileBadge = document.createElement('span');
        mobileBadge.id = 'readingListBadgeMobile';
        mobileBadge.className = 'reading-list-badge-mobile';
        mobileBadge.style.display = 'none';
        
        // Ensure parent has position relative
        if (window.getComputedStyle(readingListLink).position === 'static') {
            readingListLink.style.position = 'relative';
        }
        
        readingListLink.appendChild(mobileBadge);
        return mobileBadge;
    },
    
    // Update document title with count
    updateTitle(count) {
        const originalTitle = document.title.replace(/^\(\d+\)\s*/, '');
        if (count > 0) {
            document.title = `(${count}) ${originalTitle}`;
        } else {
            document.title = originalTitle;
        }
    },
    
    // Update PWA app badge
    updatePWABadge(count) {
        if (navigator.setAppBadge) {
            navigator.setAppBadge(count).catch(() => {});
        } else if (navigator.setExperimentalAppBadge) {
            navigator.setExperimentalAppBadge(count).catch(() => {});
        }
    },
    
    // Generate URL from article data
    generateUrl(article) {
        if (article.url) return article.url;
        const slug = article.slug || article.id;
        return `{{ '/' | relative_url }}learn/article.html?id=${slug}`;
    },
    
    // Extract date from URL (fallback)
    extractDateFromUrl(url) {
        // Try to extract date from URL pattern /YYYY/MM/DD/
        const match = url?.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
        if (match) {
            return `${match[1]}-${match[2]}-${match[3]}`;
        }
        return null;
    },
    
    // Render single reading list item
    renderItem(item, index) {
        const savedDate = new Date(item.savedAt);
        const formattedDate = savedDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const publishedDate = item.publishedDate ? 
            new Date(item.publishedDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }) : 'Unknown date';
        
        const isRead = item.read ? 'read' : '';
        
        return `
            <div class="reading-item ${isRead}" data-id="${item.id}" data-index="${index}">
                <div class="reading-item-status">
                    ${item.read ? '<span class="read-badge"><i class="fas fa-check-circle"></i> Read</span>' : ''}
                </div>
                <div class="reading-item-content">
                    <h3 class="reading-item-title">
                        <a href="${item.url}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(item.title)}</a>
                    </h3>
                    <div class="reading-item-meta">
                        <span class="meta-item">
                            <i class="fas fa-calendar-alt"></i> Published: ${publishedDate}
                        </span>
                        <span class="meta-item">
                            <i class="fas fa-bookmark"></i> Saved: ${formattedDate}
                        </span>
                    </div>
                </div>
                <div class="reading-item-actions">
                    <a href="${item.url}" class="item-btn read-btn" target="_blank" rel="noopener noreferrer">
                        <i class="fas fa-book-open"></i>
                        <span class="btn-text">Read</span>
                    </a>
                    <button class="item-btn mark-read" data-id="${item.id}" title="Mark as read">
                        <i class="fas fa-check"></i>
                        <span class="btn-text">Mark Read</span>
                    </button>
                    <button class="item-btn delete-btn delete-item" data-id="${item.id}" title="Remove from list">
                        <i class="fas fa-trash"></i>
                        <span class="btn-text">Remove</span>
                    </button>
                </div>
            </div>
        `;
    },
    
    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // Get empty state HTML (fallback if template not available)
    getEmptyStateHTML() {
        return `
            <div class="empty-list">
                <div class="empty-icon">
                    <i class="fas fa-book-open"></i>
                </div>
                <h3>Your reading list is empty</h3>
                <p>Save articles from notifications or article pages to read them later</p>
                <div class="empty-actions">
                    <a href="{{ '/learn' | relative_url }}" class="empty-btn">
                        <i class="fas fa-graduation-cap"></i> Browse Articles
                    </a>
                    <button class="empty-btn secondary" onclick="window.articleNotifications?.requestPermission()">
                        <i class="fas fa-bell"></i> Enable Notifications
                    </button>
                </div>
            </div>
        `;
    },
    
    // Check for pending saves from service worker
    checkPendingSave() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('pending') === 'true') {
            if ('caches' in window) {
                caches.open('reading-list-queue').then(cache => {
                    cache.match('pending-save').then(response => {
                        if (response) {
                            response.json().then(articleData => {
                                this.addItem({
                                    id: articleData.articleId || articleData.id,
                                    title: articleData.title,
                                    slug: articleData.slug,
                                    date: articleData.date,
                                    url: articleData.url
                                });
                                cache.delete('pending-save');
                            });
                        }
                    });
                });
            }
        }
    },
    
    // Setup event listeners
    setupEventListeners() {
        // Listen for storage events from other tabs
        window.addEventListener('storage', (e) => {
            if (e.key === this.STORAGE_KEY) {
                this.loadList();
                this.updateBadge();
            }
        });
        
        // Listen for messages from service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'SAVE_FOR_LATER' && event.data.article) {
                    this.addItem(event.data.article);
                }
            });
        }
    },
    
    // Show toast notification
    showToast(message, type = 'info', duration = 3000) {
        // Use shared toast if available
        if (window.Shared && typeof window.Shared.showToast === 'function') {
            window.Shared.showToast(message, type, duration);
            return;
        }
        
        // Fallback toast
        const icons = {
            success: 'fa-check-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle',
            error: 'fa-times-circle'
        };
        
        // Remove existing toast
        const oldToast = document.querySelector('.reading-toast');
        if (oldToast) oldToast.remove();
        
        const toast = document.createElement('div');
        toast.className = `reading-toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Auto hide
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

// ========== GLOBAL FUNCTIONS ==========

// Load reading list
window.loadReadingList = function() {
    ReadingListManager.loadList();
};

// Add to reading list
window.addToReadingList = function(article) {
    return ReadingListManager.addItem(article);
};

// Remove from reading list
window.removeFromReadingList = function(id) {
    return ReadingListManager.removeItem(id);
};

// Clear all
window.clearReadingList = function() {
    if (ReadingListManager.clearAll()) {
        ReadingListManager.loadList();
    }
};

// Export list
window.exportReadingList = function() {
    ReadingListManager.exportList();
};

// Show import modal
window.showImportModal = function() {
    const modal = document.getElementById('importModal');
    if (modal) {
        modal.style.display = 'flex';
    }
};

// Close import modal
window.closeImportModal = function() {
    const modal = document.getElementById('importModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('importData').value = '';
    }
};

// Process import
window.processImport = function() {
    const importData = document.getElementById('importData').value;
    if (!importData) {
        ReadingListManager.showToast('Please paste JSON data', 'warning');
        return;
    }
    
    if (ReadingListManager.importList(importData)) {
        closeImportModal();
        ReadingListManager.loadList();
    }
};

// Mark as read
window.markAsRead = function(id) {
    ReadingListManager.markAsRead(id);
};

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('📚 Reading List page initialized');
    ReadingListManager.init();
    
    // Add keyboard shortcut for import (Ctrl+I)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'i') {
            e.preventDefault();
            showImportModal();
        }
    });
});
</script>

<!-- ========== STYLES ========== -->
<style>
/* Reading List Header */
.reading-list-header {
    text-align: center;
    margin: 100px 0 30px 0;
    padding: 30px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
}

.reading-list-title {
    font-size: 2.5em;
    margin-bottom: 10px;
    background: linear-gradient(to right, var(--wave-trough), var(--wave-peak));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
}

.reading-list-title i {
    margin-right: 15px;
    color: var(--wave-trough);
}

.reading-list-subtitle {
    color: var(--text-glow);
    font-size: 1.2em;
}

/* Reading List Container */
.reading-list-container {
    max-width: 900px;
    margin: 0 auto 50px;
    padding: 0 20px;
}

/* Reading List Items */
.reading-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 30px;
}

.reading-item {
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 25px;
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    transition: all 0.3s ease;
    position: relative;
    backdrop-filter: blur(10px);
    animation: slideIn 0.3s ease;
}

.reading-item:hover {
    transform: translateY(-3px);
    border-color: var(--wave-trough);
    box-shadow: 0 10px 30px rgba(0, 212, 255, 0.15);
}

.reading-item.read {
    opacity: 0.8;
    background: rgba(0, 0, 0, 0.4);
}

.reading-item.read::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.05), transparent);
    pointer-events: none;
    border-radius: 16px;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Reading Item Status */
.reading-item-status {
    flex: 0 0 100%;
    margin-bottom: 5px;
}

.read-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(76, 175, 80, 0.15);
    color: #4CAF50;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.85em;
    font-weight: 600;
    border: 1px solid rgba(76, 175, 80, 0.3);
}

.read-badge i {
    font-size: 0.9em;
}

/* Reading Item Content */
.reading-item-content {
    flex: 1;
    min-width: 250px;
}

.reading-item-title {
    font-size: 1.3em;
    margin-bottom: 12px;
    line-height: 1.4;
}

.reading-item-title a {
    color: white;
    text-decoration: none;
    transition: color 0.3s ease;
}

.reading-item-title a:hover {
    color: var(--wave-trough);
}

.reading-item-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    color: var(--text-glow);
    font-size: 0.9em;
}

.meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
}

.meta-item i {
    color: var(--wave-mid);
    width: 16px;
}

/* Reading Item Actions */
.reading-item-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
}

.item-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    font-size: 0.9em;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    text-decoration: none;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.item-btn:hover {
    transform: translateY(-2px);
}

.read-btn {
    background: linear-gradient(135deg, var(--wave-trough), var(--wave-mid));
    color: black;
    border: none;
}

.read-btn:hover {
    box-shadow: 0 5px 15px rgba(0, 212, 255, 0.4);
}

.mark-read {
    background: rgba(76, 175, 80, 0.15);
    color: #4CAF50;
    border: 1px solid rgba(76, 175, 80, 0.3);
}

.mark-read:hover {
    background: rgba(76, 175, 80, 0.25);
}

.delete-btn {
    background: rgba(244, 67, 54, 0.15);
    color: #F44336;
    border: 1px solid rgba(244, 67, 54, 0.3);
}

.delete-btn:hover {
    background: rgba(244, 67, 54, 0.25);
}

/* Hide text on mobile, show icons only */
@media (max-width: 768px) {
    .btn-text {
        display: none;
    }
    
    .item-btn {
        width: 40px;
        height: 40px;
        padding: 0;
        border-radius: 50%;
    }
    
    .item-btn i {
        font-size: 1.1em;
        margin: 0;
    }
}

/* Reading List Actions */
.reading-list-actions {
    display: flex;
    justify-content: flex-end;
    gap: 15px;
    margin: 30px 0;
    padding: 20px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.action-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 0.95em;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.action-btn:hover {
    transform: translateY(-2px);
}

.export-btn:hover {
    background: rgba(0, 212, 255, 0.2);
    border-color: var(--wave-trough);
}

.clear-btn:hover {
    background: rgba(244, 67, 54, 0.2);
    border-color: #F44336;
}

/* Empty State */
.empty-list {
    text-align: center;
    padding: 60px 20px;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 30px;
    border: 2px dashed rgba(255, 255, 255, 0.1);
    animation: fadeIn 0.5s ease;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.empty-icon {
    font-size: 5em;
    color: var(--wave-mid);
    margin-bottom: 25px;
    opacity: 0.5;
}

.empty-icon i {
    animation: float 3s ease-in-out infinite;
}

@keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
}

.empty-list h3 {
    color: white;
    font-size: 1.8em;
    margin-bottom: 15px;
}

.empty-list p {
    color: var(--text-glow);
    font-size: 1.1em;
    margin-bottom: 30px;
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;
}

.empty-actions {
    display: flex;
    gap: 15px;
    justify-content: center;
    flex-wrap: wrap;
}

.empty-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 25px;
    border-radius: 30px;
    font-size: 1em;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.3s ease;
    cursor: pointer;
    border: none;
}

.empty-btn:first-child {
    background: linear-gradient(135deg, var(--wave-trough), var(--wave-mid));
    color: black;
}

.empty-btn.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.empty-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}

.empty-btn:first-child:hover {
    box-shadow: 0 10px 25px rgba(0, 212, 255, 0.4);
}

.empty-btn.secondary:hover {
    background: rgba(255, 255, 255, 0.2);
}

/* Modal */
.modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: modalFadeIn 0.3s ease;
}

@keyframes modalFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.modal-content {
    background: rgba(20, 20, 30, 0.95);
    border: 2px solid var(--wave-trough);
    border-radius: 20px;
    padding: 30px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 50px rgba(0, 212, 255, 0.3);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
    color: white;
    font-size: 1.5em;
}

.modal-header h3 i {
    color: var(--wave-trough);
    margin-right: 10px;
}

.modal-close {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 2em;
    cursor: pointer;
    line-height: 1;
    transition: all 0.3s ease;
}

.modal-close:hover {
    color: white;
    transform: rotate(90deg);
}

.modal-body p {
    color: var(--text-glow);
    margin-bottom: 15px;
}

.import-textarea {
    width: 100%;
    padding: 15px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    color: white;
    font-family: monospace;
    font-size: 0.95em;
    resize: vertical;
    margin-bottom: 20px;
}

.import-textarea:focus {
    outline: none;
    border-color: var(--wave-trough);
    box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.2);
}

.modal-actions {
    display: flex;
    gap: 15px;
    justify-content: flex-end;
}

.modal-btn {
    padding: 10px 25px;
    border: none;
    border-radius: 8px;
    font-size: 0.95em;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
}

.modal-btn.cancel {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.modal-btn.import {
    background: linear-gradient(135deg, var(--wave-trough), var(--wave-mid));
    color: black;
}

.modal-btn:hover {
    transform: translateY(-2px);
}

.modal-btn.cancel:hover {
    background: rgba(255, 255, 255, 0.2);
}

.modal-btn.import:hover {
    box-shadow: 0 5px 15px rgba(0, 212, 255, 0.4);
}

/* Back to Learn */
.back-to-learn {
    text-align: center;
    margin: 40px 0;
}

.back-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: linear-gradient(135deg, var(--wave-mid), var(--wave-peak));
    color: white;
    padding: 15px 30px;
    border-radius: 30px;
    text-decoration: none;
    font-weight: bold;
    font-size: 1.1em;
    transition: all 0.3s ease;
    border: 2px solid transparent;
}

.back-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 25px rgba(247, 147, 26, 0.4);
    border-color: white;
    gap: 15px;
}

/* Toast Notifications */
.reading-toast {
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

.reading-toast.show {
    transform: translateX(-50%) translateY(0);
}

.reading-toast.toast-success {
    background: linear-gradient(135deg, #4CAF50, #45a049);
}

.reading-toast.toast-warning {
    background: linear-gradient(135deg, #ff9800, #f57c00);
}

.reading-toast.toast-error {
    background: linear-gradient(135deg, #f44336, #d32f2f);
}

.reading-toast i {
    font-size: 1.2em;
}

/* Responsive */
@media (max-width: 768px) {
    .reading-list-header {
        margin: 80px 0 20px 0;
        padding: 20px;
    }
    
    .reading-list-title {
        font-size: 2em;
    }
    
    .reading-item {
        padding: 20px;
    }
    
    .reading-item-title {
        font-size: 1.2em;
    }
    
    .reading-item-meta {
        flex-direction: column;
        gap: 8px;
    }
    
    .reading-list-actions {
        justify-content: center;
    }
    
    .empty-list h3 {
        font-size: 1.5em;
    }
    
    .empty-list p {
        font-size: 1em;
    }
    
    .empty-actions {
        flex-direction: column;
        align-items: stretch;
    }
    
    .empty-btn {
        justify-content: center;
    }
    
    .modal-content {
        padding: 20px;
    }
    
    .modal-actions {
        flex-direction: column;
    }
    
    .modal-btn {
        width: 100%;
    }
}

@media (max-width: 480px) {
    .reading-item-actions {
        width: 100%;
        justify-content: flex-end;
    }
    
    .reading-list-actions {
        flex-direction: column;
    }
    
    .action-btn {
        width: 100%;
        justify-content: center;
    }
}

/* Mobile badge styles */
.reading-list-badge-mobile {
    position: absolute;
    top: -5px;
    right: -5px;
    background: linear-gradient(135deg, var(--wave-peak), #ff6b00);
    color: white;
    font-size: 0.7em;
    font-weight: bold;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    border: 2px solid var(--bg-darker);
    box-shadow: 0 0 15px rgba(255, 107, 0, 0.7);
    z-index: 100;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% {
        transform: scale(1);
        box-shadow: 0 0 10px rgba(255, 107, 0, 0.5);
    }
    50% {
        transform: scale(1.05);
        box-shadow: 0 0 20px rgba(255, 107, 0, 0.8);
    }
}

/* Animation for items */
.reading-item {
    animation: slideIn 0.3s ease;
    animation-fill-mode: both;
}

.reading-item:nth-child(1) { animation-delay: 0.05s; }
.reading-item:nth-child(2) { animation-delay: 0.1s; }
.reading-item:nth-child(3) { animation-delay: 0.15s; }
.reading-item:nth-child(4) { animation-delay: 0.2s; }
.reading-item:nth-child(5) { animation-delay: 0.25s; }
.reading-item:nth-child(6) { animation-delay: 0.3s; }
.reading-item:nth-child(7) { animation-delay: 0.35s; }
.reading-item:nth-child(8) { animation-delay: 0.4s; }
.reading-item:nth-child(9) { animation-delay: 0.45s; }
.reading-item:nth-child(10) { animation-delay: 0.5s; }
</style>
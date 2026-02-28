// article.js - Xử lý và hiển thị bài viết từ HTML
// Version: 2.0.0 - Hỗ trợ đọc article từ file HTML, bảo toàn tất cả tính năng

const ARTICLE_CONFIG = {
    version: '2.0.0',
    articlesPath: '/learn/articles/',        // Thư mục chứa các file HTML
    metadataPath: '/learn/articles.json',    // Metadata của articles
    cacheKey: 'peakdip_articles',
    cacheTimeKey: 'peakdip_articles_time',
    cacheDuration: 3600000, // 1 giờ
    newArticleDays: 3        // Số ngày để đánh dấu "NEW"
};

// ========== QUẢN LÝ BÀI VIẾT HTML ==========
class ArticleManager {
    constructor() {
        this.articles = [];
        this.currentArticle = null;
        this.lastCheck = null;
        this.notificationSystem = window.articleNotifications || null;
    }
    
    // ===== LOAD METADATA =====
    async loadArticles(force = false) {
        try {
            // Kiểm tra cache nếu không force
            if (!force) {
                const cached = this.loadFromCache();
                if (cached && !this.isCacheExpired()) {
                    console.log('📚 Using cached articles metadata');
                    this.articles = cached;
                    
                    // Kiểm tra bài viết mới nếu có notification system
                    if (this.notificationSystem) {
                        this.notificationSystem.articles = cached;
                        await this.notificationSystem.checkNewArticles(false);
                    }
                    
                    return cached;
                }
            }
            
            // Fetch metadata từ server
            const response = await fetch(`${ARTICLE_CONFIG.metadataPath}?t=${Date.now()}`);
            if (!response.ok) throw new Error('Failed to load articles metadata');
            
            const data = await response.json();
            this.articles = data.articles || [];
            
            // Lọc bỏ duplicate articles
            this.articles = this.removeDuplicateArticles(this.articles);
            
            // Lưu cache
            this.saveToCache();
            
            // Cập nhật cho notification system
            if (this.notificationSystem) {
                this.notificationSystem.articles = this.articles;
                await this.notificationSystem.checkNewArticles(false);
            }
            
            // Render lại danh sách nếu đang ở trang learn
            if (document.getElementById('articlesList')) {
                this.renderArticleList('articlesList');
            }
            
            return this.articles;
        } catch (error) {
            console.error('❌ Failed to load articles metadata:', error);
            
            // Fallback to cache
            const cached = this.loadFromCache();
            if (cached) {
                this.articles = cached;
                return cached;
            }
            
            return [];
        }
    }
    
    // ===== LOAD NỘI DUNG BÀI VIẾT HTML =====
    async loadArticle(slug) {
        try {
            // Tìm metadata
            const metadata = this.articles.find(a => a.slug === slug);
            if (!metadata) {
                throw new Error(`Article not found: ${slug}`);
            }
            
            // Đường dẫn đến file HTML
            const htmlPath = `${ARTICLE_CONFIG.articlesPath}${slug}.html`;
            
            // Fetch nội dung HTML
            const response = await fetch(`${htmlPath}?t=${Date.now()}`);
            if (!response.ok) {
                throw new Error(`Failed to load article HTML: ${response.status}`);
            }
            
            let html = await response.text();
            
            // Xử lý HTML: thêm classes, xử lý images, links, tables
            html = this.processArticleHTML(html, metadata);
            
            return {
                meta: metadata,
                content: html,
                raw: html
            };
        } catch (error) {
            console.error('❌ Failed to load article:', error);
            return null;
        }
    }
    
    // ===== XỬ LÝ HTML BÀI VIẾT =====
    processArticleHTML(html, metadata) {
        let processed = html;
        
        // 1. Thêm wrapper classes cho các elements
        processed = processed.replace(/<table>/g, '<div class="table-responsive"><table class="markdown-table">');
        processed = processed.replace(/<\/table>/g, '</table></div>');
        
        // 2. Xử lý images - thêm lazy loading và classes
        processed = processed.replace(/<img /g, '<img loading="lazy" class="article-image" ');
        
        // 3. Xử lý links - thêm target="_blank" cho external links
        processed = processed.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');
        
        // 4. Thêm IDs cho headings để tạo mục lục
        let headingCounter = 0;
        processed = processed.replace(/<h([2-3])>(.*?)<\/h\1>/g, (match, level, content) => {
            const id = `section-${headingCounter++}`;
            return `<h${level} id="${id}">${content}</h${level}>`;
        });
        
        // 5. Xử lý special boxes (nếu có trong HTML)
        processed = processed.replace(/:::info\s*([^:]+):::/g, '<div class="info-box"><i class="fas fa-info-circle"></i><div class="box-content">$1</div></div>');
        processed = processed.replace(/:::tip\s*([^:]+):::/g, '<div class="tip-box"><i class="fas fa-lightbulb"></i><div class="box-content">$1</div></div>');
        processed = processed.replace(/:::warning\s*([^:]+):::/g, '<div class="warning-box"><i class="fas fa-exclamation-triangle"></i><div class="box-content">$1</div></div>');
        processed = processed.replace(/:::success\s*([^:]+):::/g, '<div class="success-box"><i class="fas fa-check-circle"></i><div class="box-content">$1</div></div>');
        
        // 6. Thêm meta data vào đầu bài viết
        const metaHTML = `
            <div class="article-metadata-bar">
                <div class="meta-left">
                    <span class="meta-item"><i class="fas fa-user"></i> ${metadata.author || 'Bitcoin PeakDip'}</span>
                    <span class="meta-item"><i class="fas fa-calendar-alt"></i> ${new Date(metadata.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    <span class="meta-item"><i class="fas fa-clock"></i> ${metadata.reading_time || 5} min read</span>
                    <span class="difficulty ${(metadata.level || 'beginner').toLowerCase()}">${metadata.level || 'Beginner'}</span>
                </div>
                <div class="meta-right">
                    <button class="article-action-btn" onclick="articleManager.addCurrentToReadingList()" title="Save to reading list">
                        <i class="fas fa-bookmark"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Chèn meta data sau thẻ mở body hoặc đầu article content
        if (processed.includes('<body>')) {
            processed = processed.replace('<body>', '<body>' + metaHTML);
        } else {
            // Nếu không có body tag, thêm vào đầu
            processed = metaHTML + processed;
        }
        
        return processed;
    }
    
    // ===== HIỂN THỊ TRANG BÀI VIẾT =====
    async displayArticle(slug) {
        const contentContainer = document.getElementById('articleContent');
        const titleElement = document.getElementById('articleTitle');
        const metaElement = document.getElementById('articleMeta');
        
        if (!contentContainer) return;
        
        // Hiển thị loading
        contentContainer.innerHTML = `
            <div class="loading-article">
                <div class="loading-spinner"></div>
                <p>Loading article...</p>
            </div>
        `;
        
        const article = await this.loadArticle(slug);
        
        if (!article) {
            contentContainer.innerHTML = `
                <div class="error-404">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h2>Article Not Found</h2>
                    <p>The article you're looking for doesn't exist or has been moved.</p>
                    <a href="/learn/" class="back-btn">Back to Knowledge Base</a>
                </div>
            `;
            return;
        }
        
        this.currentArticle = article;
        
        // Cập nhật title
        document.title = `${article.meta.title} - Bitcoin PeakDip Learn`;
        
        // Update meta description
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.name = 'description';
            document.head.appendChild(metaDesc);
        }
        metaDesc.content = article.meta.description || `Learn about ${article.meta.title} with Bitcoin PeakDip Early Warning System`;
        
        // Hiển thị title
        if (titleElement) {
            titleElement.textContent = article.meta.title;
        }
        
        // Hiển thị meta (nếu có)
        if (metaElement) {
            metaElement.innerHTML = `
                <span class="article-author"><i class="fas fa-user"></i> ${article.meta.author || 'Bitcoin PeakDip'}</span>
                <span class="article-date"><i class="fas fa-calendar-alt"></i> ${new Date(article.meta.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                <span class="reading-time"><i class="fas fa-clock"></i> ${article.meta.reading_time || 5} min read</span>
                <span class="difficulty ${(article.meta.level || 'beginner').toLowerCase()}">${article.meta.level || 'Beginner'}</span>
            `;
        }
        
        // Hiển thị nội dung
        contentContainer.innerHTML = article.content;
        
        // THÔNG BÁO CHO USER: Đã đọc bài báo
        this.notifyArticleRead(article.meta);
        
        // Thêm reading progress bar
        this.addReadingProgress();
        
        // Thêm table of contents nếu có nhiều headings
        this.addTableOfContents();
        
        // Scroll lên đầu
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    // ===== THÔNG BÁO ĐÃ ĐỌC BÀI BÁO =====
    notifyArticleRead(metadata) {
        // Hiển thị toast thông báo
        if (window.articleNotifications && typeof window.articleNotifications.showToast === 'function') {
            window.articleNotifications.showToast(`📖 You're reading: ${metadata.title}`, 'info', 3000);
        } else {
            // Fallback toast
            this.showSimpleToast(`📖 Reading: ${metadata.title}`);
        }
        
        // Đánh dấu đã đọc trong localStorage để không hiển thị notification nữa
        try {
            const readArticles = JSON.parse(localStorage.getItem('read_articles') || '[]');
            if (!readArticles.includes(metadata.id)) {
                readArticles.push(metadata.id);
                localStorage.setItem('read_articles', JSON.stringify(readArticles));
            }
        } catch (e) {}
        
        console.log(`📖 User is reading: ${metadata.title}`);
    }
    
    // ===== THÊM VÀO READING LIST =====
    addCurrentToReadingList() {
        if (!this.currentArticle) return;
        
        const article = this.currentArticle.meta;
        
        if (window.readingList && typeof window.readingList.add === 'function') {
            window.readingList.add({
                id: article.id,
                title: article.title,
                slug: article.slug,
                date: article.date,
                url: `/learn/article.html?id=${article.slug}`
            });
        } else {
            // Fallback
            this.showSimpleToast('✅ Added to reading list');
        }
    }
    
    // ===== READING PROGRESS BAR =====
    addReadingProgress() {
        // Xóa progress bar cũ nếu có
        const oldBar = document.querySelector('.reading-progress');
        if (oldBar) oldBar.remove();
        
        const progressBar = document.createElement('div');
        progressBar.className = 'reading-progress';
        progressBar.innerHTML = '<div class="progress-bar" id="readingProgress"></div>';
        document.body.appendChild(progressBar);
        
        const updateProgress = () => {
            const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = (winScroll / height) * 100;
            
            const progress = document.getElementById('readingProgress');
            if (progress) {
                progress.style.width = scrolled + '%';
            }
        };
        
        window.addEventListener('scroll', updateProgress);
        updateProgress();
    }
    
    // ===== TABLE OF CONTENTS =====
    addTableOfContents() {
        const articleElement = document.querySelector('.learn-article');
        if (!articleElement) return;
        
        const headings = document.querySelectorAll('.article-content h2, .article-content h3');
        if (headings.length < 3) return;
        
        // Xóa TOC cũ nếu có
        const oldToc = document.querySelector('.table-of-contents');
        if (oldToc) oldToc.remove();
        
        const toc = document.createElement('div');
        toc.className = 'table-of-contents';
        toc.innerHTML = '<h3><i class="fas fa-list"></i> Contents</h3><ul></ul>';
        
        const tocList = toc.querySelector('ul');
        
        headings.forEach((heading, index) => {
            if (!heading.id) {
                heading.id = `section-${index}`;
            }
            
            const li = document.createElement('li');
            li.className = heading.tagName === 'H2' ? 'toc-h2' : 'toc-h3';
            li.innerHTML = `<a href="#${heading.id}">${heading.textContent}</a>`;
            tocList.appendChild(li);
        });
        
        // Chèn TOC sau article metadata bar
        const metaBar = document.querySelector('.article-metadata-bar');
        if (metaBar) {
            metaBar.insertAdjacentElement('afterend', toc);
        } else {
            articleElement.insertBefore(toc, articleElement.querySelector('.article-content'));
        }
        
        // Smooth scroll cho TOC links
        toc.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }
    
    // ===== RENDER DANH SÁCH BÀI VIẾT =====
    renderArticleList(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (this.articles.length === 0) {
            container.innerHTML = '<div class="loading">Loading articles...</div>';
            return;
        }
        
        let html = '';
        this.articles.forEach(article => {
            const isNew = this.isNewArticle(article);
            const date = new Date(article.date).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
            
            html += `
                <a href="/learn/article.html?id=${article.slug}" class="article-card ${(article.level || 'beginner').toLowerCase()}">
                    ${isNew ? '<span class="new-badge">NEW</span>' : ''}
                    <div class="article-meta">
                        <span class="article-category">${article.category || 'General'}</span>
                        <span class="article-date"><i class="fas fa-calendar-alt"></i> ${date}</span>
                    </div>
                    <h3>${article.title}</h3>
                    <p>${article.description || ''}</p>
                    <div class="article-footer">
                        <span class="reading-time"><i class="fas fa-clock"></i> ${article.reading_time || 5} min</span>
                        <span class="difficulty ${(article.level || 'beginner').toLowerCase()}">${article.level || 'Beginner'}</span>
                    </div>
                </a>
            `;
        });
        
        container.innerHTML = html;
    }
    
    // ===== UTILITY FUNCTIONS =====
    loadFromCache() {
        try {
            const cached = localStorage.getItem(ARTICLE_CONFIG.cacheKey);
            const cacheTime = localStorage.getItem(ARTICLE_CONFIG.cacheTimeKey);
            
            if (cached && cacheTime) {
                return JSON.parse(cached);
            }
        } catch (e) {}
        return null;
    }
    
    saveToCache() {
        try {
            localStorage.setItem(ARTICLE_CONFIG.cacheKey, JSON.stringify(this.articles));
            localStorage.setItem(ARTICLE_CONFIG.cacheTimeKey, Date.now().toString());
        } catch (e) {}
    }
    
    isCacheExpired() {
        const cacheTime = localStorage.getItem(ARTICLE_CONFIG.cacheTimeKey);
        if (!cacheTime) return true;
        
        const age = Date.now() - parseInt(cacheTime);
        return age > ARTICLE_CONFIG.cacheDuration;
    }
    
    removeDuplicateArticles(articles) {
        const seen = new Map();
        return articles.filter(article => {
            if (seen.has(article.id)) {
                console.warn(`⚠️ Duplicate article found: ${article.id}`);
                return false;
            }
            seen.set(article.id, true);
            return true;
        });
    }
    
    isNewArticle(article) {
        try {
            const articleDate = new Date(article.date);
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - ARTICLE_CONFIG.newArticleDays);
            return articleDate >= threeDaysAgo;
        } catch (e) {
            return false;
        }
    }
    
    showSimpleToast(message) {
        // Xóa toast cũ
        const oldToast = document.querySelector('.simple-toast');
        if (oldToast) oldToast.remove();
        
        const toast = document.createElement('div');
        toast.className = 'simple-toast';
        toast.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// ========== CSS STYLES ==========
(function addArticleStyles() {
    if (document.getElementById('article-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'article-styles';
    style.textContent = `
        /* ===== ARTICLE METADATA BAR ===== */
        .article-metadata-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 50px;
            padding: 15px 25px;
            margin: 20px 0 30px;
            backdrop-filter: blur(10px);
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .meta-left {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 20px;
        }
        
        .meta-item {
            color: var(--text-glow);
            font-size: 0.95em;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .meta-item i {
            color: var(--wave-trough);
            width: 16px;
        }
        
        .meta-right {
            display: flex;
            gap: 10px;
        }
        
        .article-action-btn {
            background: rgba(0, 212, 255, 0.1);
            border: 1px solid var(--wave-trough);
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 1.1em;
        }
        
        .article-action-btn:hover {
            background: var(--wave-trough);
            color: black;
            transform: scale(1.1);
        }
        
        /* ===== ARTICLE CONTENT ===== */
        .article-content {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 20px;
            padding: 40px;
            margin: 30px 0;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .article-content h2 {
            color: white;
            font-size: 2em;
            margin: 40px 0 20px;
            border-bottom: 2px solid rgba(0, 212, 255, 0.3);
            padding-bottom: 10px;
        }
        
        .article-content h3 {
            color: var(--wave-trough);
            font-size: 1.5em;
            margin: 30px 0 15px;
        }
        
        .article-content p {
            color: var(--text-glow);
            line-height: 1.8;
            margin-bottom: 20px;
            font-size: 1.1em;
        }
        
        .article-content ul, .article-content ol {
            color: var(--text-glow);
            line-height: 1.8;
            margin: 20px 0;
            padding-left: 30px;
        }
        
        .article-content li {
            margin-bottom: 10px;
        }
        
        .article-content code {
            background: rgba(0, 0, 0, 0.5);
            padding: 2px 8px;
            border-radius: 4px;
            color: var(--wave-trough);
            font-family: monospace;
        }
        
        .article-content pre {
            background: rgba(0, 0, 0, 0.7);
            padding: 20px;
            border-radius: 10px;
            overflow-x: auto;
            margin: 20px 0;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .article-content pre code {
            background: transparent;
            padding: 0;
            color: #e6e6e6;
        }
        
        .article-content img {
            max-width: 100%;
            border-radius: 10px;
            margin: 20px 0;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
        }
        
        .article-content blockquote {
            background: rgba(0, 212, 255, 0.1);
            border-left: 4px solid var(--wave-trough);
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 10px 10px 0;
            font-style: italic;
            color: rgba(255, 255, 255, 0.9);
        }
        
        /* ===== TABLE OF CONTENTS ===== */
        .table-of-contents {
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 25px;
            margin: 30px 0;
        }
        
        .table-of-contents h3 {
            color: white;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .table-of-contents h3 i {
            color: var(--wave-trough);
        }
        
        .table-of-contents ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .table-of-contents li {
            margin-bottom: 10px;
        }
        
        .table-of-contents a {
            color: var(--text-glow);
            text-decoration: none;
            transition: all 0.3s ease;
            display: block;
            padding: 8px 15px;
            border-radius: 8px;
        }
        
        .table-of-contents a:hover {
            background: rgba(0, 212, 255, 0.1);
            color: var(--wave-trough);
            padding-left: 25px;
        }
        
        .toc-h2 {
            font-weight: bold;
        }
        
        .toc-h3 {
            padding-left: 25px;
            font-size: 0.95em;
        }
        
        /* ===== READING PROGRESS ===== */
        .reading-progress {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: rgba(255, 255, 255, 0.1);
            z-index: 10000;
        }
        
        .progress-bar {
            height: 100%;
            background: linear-gradient(to right, var(--wave-trough), var(--wave-peak));
            width: 0%;
            transition: width 0.2s ease;
        }
        
        /* ===== LOADING SPINNER ===== */
        .loading-article {
            text-align: center;
            padding: 60px 20px;
        }
        
        .loading-spinner {
            width: 50px;
            height: 50px;
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-top-color: var(--wave-trough);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        /* ===== ERROR 404 ===== */
        .error-404 {
            text-align: center;
            padding: 60px 20px;
            background: rgba(0, 0, 0, 0.5);
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .error-404 i {
            font-size: 4em;
            color: var(--wave-peak);
            margin-bottom: 20px;
        }
        
        .error-404 h2 {
            color: white;
            margin-bottom: 15px;
        }
        
        .error-404 p {
            color: var(--text-glow);
            margin-bottom: 30px;
        }
        
        .back-btn {
            display: inline-block;
            background: linear-gradient(to right, var(--wave-trough), var(--wave-mid));
            color: white;
            padding: 12px 25px;
            border-radius: 25px;
            text-decoration: none;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        
        .back-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 20px rgba(0, 212, 255, 0.3);
        }
        
        /* ===== SIMPLE TOAST ===== */
        .simple-toast {
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
        }
        
        .simple-toast.show {
            transform: translateX(-50%) translateY(0);
        }
        
        /* ===== RESPONSIVE ===== */
        @media (max-width: 768px) {
            .article-content {
                padding: 20px;
            }
            
            .article-metadata-bar {
                flex-direction: column;
                align-items: flex-start;
                border-radius: 20px;
            }
            
            .meta-left {
                gap: 15px;
            }
            
            .meta-item {
                font-size: 0.85em;
            }
            
            .article-content h2 {
                font-size: 1.6em;
            }
            
            .article-content h3 {
                font-size: 1.3em;
            }
            
            .article-content p {
                font-size: 1em;
            }
        }
        
        @media (max-width: 480px) {
            .meta-left {
                gap: 10px;
            }
            
            .meta-item {
                font-size: 0.8em;
            }
            
            .table-of-contents {
                padding: 15px;
            }
            
            .toc-h3 {
                padding-left: 15px;
            }
        }
    `;
    
    document.head.appendChild(style);
})();

// ========== ARTICLE PAGE HANDLER ==========
async function handleArticlePage() {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('id');
    
    if (!slug) {
        window.location.href = '/learn/';
        return;
    }
    
    await articleManager.displayArticle(slug);
}

// ========== INITIALIZATION ==========
const articleManager = new ArticleManager();
window.articleManager = articleManager;

// Export global functions
window.addToReadingListFromArticle = function() {
    articleManager.addCurrentToReadingList();
};

// Auto initialize
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📚 Article System v' + ARTICLE_CONFIG.version);
    
    // Load articles metadata
    await articleManager.loadArticles();
    
    // Nếu đang ở trang learn, render article list
    if (document.getElementById('articlesList')) {
        articleManager.renderArticleList('articlesList');
    }
    
    // Nếu đang ở trang article, load article content
    if (document.getElementById('articleContent')) {
        await handleArticlePage();
    }
    
    // Auto refresh metadata every 30 minutes
    setInterval(async () => {
        await articleManager.loadArticles(true);
    }, 30 * 60 * 1000);
});
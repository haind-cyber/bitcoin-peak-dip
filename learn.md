---
layout: page
title: Learn - Bitcoin PeakDip Knowledge Base
description: Master Bitcoin trading with Early Warning System strategies and tutorials
status_text: KNOWLEDGE BASE
---

<!-- Learn Header -->
<div class="learn-header">
    <h1 class="learn-title">
        <i class="fas fa-graduation-cap"></i>
        <span class="bitcoin-text">Bitcoin PeakDip</span>
        <span class="highlight">Knowledge Base</span>
    </h1>
    <p class="learn-subtitle">Master the art of Early Warning System trading</p>
</div>

<!-- Knowledge Base Cards -->
<div class="learn-grid">
    {% for post in site.posts %}
    <a href="{{ post.url | relative_url }}" class="learn-card">
        <div class="card-icon">
            <i class="fas fa-{{ post.icon | default: 'book' }}"></i>
        </div>
        <h3>{{ post.title }}</h3>
        <p>{{ post.excerpt | strip_html | truncate: 120 }}</p>
        <div class="card-meta">
            <span><i class="fas fa-clock"></i> {{ post.reading_time }} min read</span>
            <span><i class="fas fa-signal"></i> {{ post.level | default: 'Beginner' }}</span>
        </div>
    </a>
    {% endfor %}
</div>

<!-- Featured Articles Section (nếu có) -->
{% assign featured_posts = site.posts | where: "featured", true %}
{% if featured_posts.size > 0 %}
<div class="featured-section">
    <h2 class="section-title"><i class="fas fa-star"></i> Featured Articles</h2>
    <div class="featured-grid">
        {% for post in featured_posts limit:2 %}
        <div class="featured-card">
            <div class="featured-content">
                <span class="featured-badge">FEATURED</span>
                <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
                <p>{{ post.excerpt | strip_html | truncate: 150 }}</p>
                <div class="featured-meta">
                    <span><i class="fas fa-calendar"></i> {{ post.date | date: "%b %d, %Y" }}</span>
                    <span><i class="fas fa-clock"></i> {{ post.reading_time }} min</span>
                </div>
            </div>
        </div>
        {% endfor %}
    </div>
</div>
{% endif %}

<!-- Categories Section -->
<div class="categories-section">
    <h2 class="section-title"><i class="fas fa-tags"></i> Browse by Category</h2>
    
    {% assign categories = site.posts | map: "category" | compact | uniq | sort %}
    <div class="categories-grid">
        {% for category in categories %}
        {% if category and category != "" %}
        {% assign category_posts = site.posts | where: "category", category %}
        <div class="category-card">
            <div class="category-header">
                {% if category == "fundamentals" %}
                <i class="fas fa-satellite-dish"></i>
                {% elsif category == "strategies" %}
                <i class="fas fa-chess-knight"></i>
                {% elsif category == "technical" %}
                <i class="fas fa-chart-line"></i>
                {% elsif category == "risk" %}
                <i class="fas fa-shield-alt"></i>
                {% elsif category == "Market Analysis" %}
                <i class="fas fa-chart-bar"></i>
                {% else %}
                <i class="fas fa-folder"></i>
                {% endif %}
                <h3>{{ category | replace: '-', ' ' | capitalize }}</h3>
                <span class="post-count">{{ category_posts.size }} article{% if category_posts.size > 1 %}s{% endif %}</span>
            </div>
            <ul class="category-posts">
                {% for post in category_posts limit:3 %}
                <li><a href="{{ post.url | relative_url }}">{{ post.title }}</a></li>
                {% endfor %}
                {% if category_posts.size > 3 %}
                <li class="more-link"><a href="#">+ {{ category_posts.size | minus: 3 }} more</a></li>
                {% endif %}
            </ul>
        </div>
        {% endif %}
        {% endfor %}
    </div>
</div>

<!-- Learning Paths -->
<div class="paths-section">
    <h2 class="section-title"><i class="fas fa-road"></i> Learning Paths</h2>
    
    <div class="paths-grid">
        <!-- Beginner Path -->
        <div class="path-card beginner">
            <div class="path-header">
                <span class="path-badge">BEGINNER</span>
                <i class="fas fa-seedling"></i>
            </div>
            <h3>Start Here</h3>
            <p>Perfect for newcomers to Bitcoin trading and EWS</p>
            <ul class="path-articles">
                {% assign beginner_posts = site.posts | where: "level", "Beginner" | sort: "date" %}
                {% for post in beginner_posts limit:3 %}
                <li><a href="{{ post.url | relative_url }}">{{ post.title }}</a></li>
                {% endfor %}
            </ul>
            <a href="#" class="path-btn">View All Beginner Guides →</a>
        </div>
        
        <!-- Intermediate Path -->
        <div class="path-card intermediate">
            <div class="path-header">
                <span class="path-badge">INTERMEDIATE</span>
                <i class="fas fa-tree"></i>
            </div>
            <h3>Advanced Strategies</h3>
            <p>Deep dive into trading strategies and analysis</p>
            <ul class="path-articles">
                {% assign intermediate_posts = site.posts | where: "level", "Intermediate" | sort: "date" %}
                {% for post in intermediate_posts limit:3 %}
                <li><a href="{{ post.url | relative_url }}">{{ post.title }}</a></li>
                {% endfor %}
            </ul>
            <a href="#" class="path-btn">View All Intermediate Guides →</a>
        </div>
        
        <!-- Advanced Path -->
        <div class="path-card advanced">
            <div class="path-header">
                <span class="path-badge">ADVANCED</span>
                <i class="fas fa-mountain"></i>
            </div>
            <h3>Expert Techniques</h3>
            <p>Multi-timeframe analysis and risk management</p>
            <ul class="path-articles">
                {% assign advanced_posts = site.posts | where: "level", "Advanced" | sort: "date" %}
                {% for post in advanced_posts limit:3 %}
                <li><a href="{{ post.url | relative_url }}">{{ post.title }}</a></li>
                {% endfor %}
            </ul>
            <a href="#" class="path-btn">View All Advanced Guides →</a>
        </div>
    </div>
</div>

<!-- Recent Articles with Pagination -->
<div class="recent-posts">
    <h2><i class="fas fa-newspaper"></i> All Articles</h2>
    
    {% assign all_posts = site.posts | sort: "date" | reverse %}
    <div id="articlesList" class="articles-grid">
        {% for post in all_posts %}
        <div class="article-item">
            <div class="article-meta-header">
                <span class="article-category">{{ post.category | default: 'General' }}</span>
                <span class="article-date"><i class="fas fa-calendar-alt"></i> {{ post.date | date: "%b %d, %Y" }}</span>
            </div>
            <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
            <p>{{ post.excerpt | strip_html | truncate: 120 }}</p>
            <div class="article-footer">
                <span class="reading-time"><i class="fas fa-clock"></i> {{ post.reading_time }} min read</span>
                <span class="difficulty {{ post.level | downcase }}">{{ post.level | default: 'Beginner' }}</span>
            </div>
        </div>
        {% endfor %}
    </div>
    
    <!-- Pagination (nếu cần) -->
    {% if paginator.total_pages > 1 %}
    <div class="pagination">
        {% if paginator.previous_page %}
        <a href="{{ paginator.previous_page_path | relative_url }}" class="page-btn">
            <i class="fas fa-chevron-left"></i> Previous
        </a>
        {% endif %}
        
        <span class="page-info">Page {{ paginator.page }} of {{ paginator.total_pages }}</span>
        
        {% if paginator.next_page %}
        <a href="{{ paginator.next_page_path | relative_url }}" class="page-btn">
            Next <i class="fas fa-chevron-right"></i>
        </a>
        {% endif %}
    </div>
    {% endif %}
</div>

<!-- Quick Start Guide -->
<div class="quick-start">
    <h2><i class="fas fa-rocket"></i> Quick Start Guide</h2>
    <div class="quick-steps">
        <div class="step">
            <div class="step-number">1</div>
            <h3>Understand EWS</h3>
            <p>Learn how our Early Warning System detects market movements</p>
            <a href="{{ '/learn/2026/02/15/ews-basics' | relative_url }}" class="step-link">Start →</a>
        </div>
        
        <div class="step">
            <div class="step-number">2</div>
            <h3>Master Strategies</h3>
            <p>Explore the 8 trading strategies activated by signals</p>
            <a href="{{ '/learn/2026/02/16/strategy-guide' | relative_url }}" class="step-link">Start →</a>
        </div>
        
        <div class="step">
            <div class="step-number">3</div>
            <h3>Risk Management</h3>
            <p>Learn proper position sizing and risk control</p>
            <a href="{{ '/learn/2026/02/18/risk-management' | relative_url }}" class="step-link">Start →</a>
        </div>
        
        <div class="step">
            <div class="step-number">4</div>
            <h3>View Live Signals</h3>
            <p>Apply your knowledge with real-time EWS signals</p>
            <a href="{{ '/signals' | relative_url }}" class="step-link">View →</a>
        </div>
    </div>
</div>

<!-- Channels Section -->
<div class="channels">
    <h2 class="section-title">Join Our Learning Community</h2>
    <p style="color: var(--text-glow); margin-bottom: 30px; font-size: 1.2em;">
        Connect with other traders and get support
    </p>
    
    <div class="channels-grid">
        <a href="https://t.me/+CTfMMvKCVcFlMTE1" class="channel-btn btn-telegram">
            <i class="fab fa-telegram"></i>
            Telegram Community
        </a>
        
        <a href="https://discord.gg/58akuxegwK" class="channel-btn btn-discord">
            <i class="fab fa-discord"></i>
            Discord Learning
        </a>
        
        <a href="https://x.com/bitcoinpeakdip" class="channel-btn btn-xcom">
            <i class="fab fa-x-twitter"></i>
            X.com Updates
        </a>
        
        <a href="https://group.beincom.com/ref/KkA8rZ" class="channel-btn btn-beincom">
            <i class="fas fa-globe-asia"></i>
            Vietnam Community
        </a>
    </div>
    
    <div class="disclaimer">
        <strong>⚠️ Educational Purpose:</strong> All content is for educational purposes only. Always do your own research and never risk more than you can afford to lose.
    </div>
</div>

<!-- Newsletter Signup (optional) -->
<div class="newsletter-section">
    <h3><i class="fas fa-envelope"></i> Get New Articles Delivered</h3>
    <p>Subscribe to receive notifications when new educational content is published</p>
    <button class="newsletter-btn" onclick="window.articleNotifications?.requestPermission()">
        <i class="fas fa-bell"></i> Enable Notifications
    </button>
</div>

<!-- Add JavaScript for learn page -->
<script>
document.addEventListener('DOMContentLoaded', function() {
    console.log('📚 Learn page loaded');
    
    // Add reading progress bar for articles (if on article page)
    if (document.querySelector('.learn-article')) {
        addReadingProgress();
    }
    
    // Highlight current page in learning paths
    highlightCurrentPage();
    
    // Initialize any interactive elements
    initLearnInteractions();
});

function addReadingProgress() {
    const progressBar = document.createElement('div');
    progressBar.className = 'reading-progress';
    progressBar.innerHTML = '<div class="progress-bar" id="readingProgress"></div>';
    document.body.appendChild(progressBar);
    
    window.addEventListener('scroll', function() {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        
        const progress = document.getElementById('readingProgress');
        if (progress) {
            progress.style.width = scrolled + '%';
        }
    });
}

function highlightCurrentPage() {
    const currentPath = window.location.pathname;
    const pathLinks = document.querySelectorAll('.category-posts a, .path-articles a');
    
    pathLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
}

function initLearnInteractions() {
    // Category filter functionality (if needed)
    const filterBtns = document.querySelectorAll('.filter-btn');
    if (filterBtns.length) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const category = this.dataset.category;
                filterArticles(category);
            });
        });
    }
}

function filterArticles(category) {
    const articles = document.querySelectorAll('.article-item');
    articles.forEach(article => {
        if (category === 'all' || article.dataset.category === category) {
            article.style.display = 'block';
        } else {
            article.style.display = 'none';
        }
    });
}

// Export for use in other scripts
window.learnFunctions = {
    addReadingProgress,
    highlightCurrentPage,
    filterArticles
};
</script>

<!-- Add styles for learn page enhancements -->
<style>
/* Reading Progress Bar */
.reading-progress {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: rgba(0, 0, 0, 0.3);
    z-index: 1001;
}

.progress-bar {
    height: 100%;
    background: linear-gradient(to right, var(--wave-trough), var(--wave-peak));
    width: 0%;
    transition: width 0.1s ease;
}

/* Category Cards */
.categories-section {
    margin: 50px 0;
}

.categories-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 25px;
    margin-top: 30px;
}

.category-card {
    background: rgba(0, 0, 0, 0.5);
    border-radius: 15px;
    padding: 25px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
}

.category-card:hover {
    transform: translateY(-5px);
    border-color: var(--wave-trough);
    box-shadow: 0 10px 30px rgba(0, 212, 255, 0.1);
}

.category-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.category-header i {
    font-size: 1.8em;
    color: var(--wave-trough);
}

.category-header h3 {
    color: white;
    font-size: 1.3em;
    margin: 0;
    flex: 1;
}

.post-count {
    background: rgba(0, 212, 255, 0.15);
    color: var(--wave-trough);
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 0.85em;
    font-weight: bold;
}

.category-posts {
    list-style: none;
    padding: 0;
    margin: 0;
}

.category-posts li {
    margin-bottom: 12px;
}

.category-posts a {
    color: var(--text-glow);
    text-decoration: none;
    transition: all 0.3s ease;
    display: block;
    padding: 5px 10px;
    border-radius: 6px;
}

.category-posts a:hover {
    color: white;
    background: rgba(0, 212, 255, 0.1);
    padding-left: 15px;
}

.category-posts a.active {
    color: var(--wave-trough);
    font-weight: 600;
    border-left: 3px solid var(--wave-trough);
    background: rgba(0, 212, 255, 0.05);
}

.more-link a {
    color: var(--wave-mid) !important;
    font-style: italic;
    font-size: 0.9em;
}

/* Learning Paths */
.paths-section {
    margin: 50px 0;
}

.paths-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 25px;
    margin-top: 30px;
}

.path-card {
    background: rgba(0, 0, 0, 0.5);
    border-radius: 20px;
    padding: 30px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
}

.path-card.beginner {
    border-top: 4px solid #4CAF50;
}

.path-card.intermediate {
    border-top: 4px solid #FFC107;
}

.path-card.advanced {
    border-top: 4px solid #F44336;
}

.path-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.3);
}

.path-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.path-badge {
    padding: 6px 15px;
    border-radius: 25px;
    font-size: 0.9em;
    font-weight: bold;
    letter-spacing: 0.5px;
}

.path-card.beginner .path-badge {
    background: rgba(76, 175, 80, 0.15);
    color: #4CAF50;
    border: 1px solid rgba(76, 175, 80, 0.3);
}

.path-card.intermediate .path-badge {
    background: rgba(255, 193, 7, 0.15);
    color: #FFC107;
    border: 1px solid rgba(255, 193, 7, 0.3);
}

.path-card.advanced .path-badge {
    background: rgba(244, 67, 54, 0.15);
    color: #F44336;
    border: 1px solid rgba(244, 67, 54, 0.3);
}

.path-header i {
    font-size: 2em;
    opacity: 0.7;
}

.path-card.beginner .path-header i {
    color: #4CAF50;
}

.path-card.intermediate .path-header i {
    color: #FFC107;
}

.path-card.advanced .path-header i {
    color: #F44336;
}

.path-card h3 {
    color: white;
    font-size: 1.5em;
    margin-bottom: 10px;
}

.path-card p {
    color: var(--text-glow);
    margin-bottom: 20px;
    line-height: 1.6;
}

.path-articles {
    list-style: none;
    padding: 0;
    margin: 0 0 20px 0;
}

.path-articles li {
    margin-bottom: 10px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    border-left: 3px solid transparent;
    transition: all 0.3s ease;
}

.path-card.beginner .path-articles li {
    border-left-color: rgba(76, 175, 80, 0.3);
}

.path-card.intermediate .path-articles li {
    border-left-color: rgba(255, 193, 7, 0.3);
}

.path-card.advanced .path-articles li {
    border-left-color: rgba(244, 67, 54, 0.3);
}

.path-articles li:hover {
    background: rgba(255, 255, 255, 0.05);
}

.path-articles a {
    color: var(--text-glow);
    text-decoration: none;
    display: block;
    font-size: 0.95em;
}

.path-articles a:hover {
    color: white;
}

.path-btn {
    display: inline-block;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.9em;
    transition: all 0.3s ease;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.path-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
}

/* Featured Section */
.featured-section {
    margin: 40px 0;
}

.featured-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 25px;
    margin-top: 20px;
}

.featured-card {
    background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(156, 39, 176, 0.1));
    border-radius: 20px;
    padding: 30px;
    border: 2px solid rgba(0, 212, 255, 0.3);
    position: relative;
    overflow: hidden;
}

.featured-card::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(0, 212, 255, 0.2) 0%, transparent 70%);
    animation: rotate 20s linear infinite;
}

@keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.featured-badge {
    position: absolute;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, gold, #ffaa00);
    color: black;
    padding: 5px 15px;
    border-radius: 25px;
    font-size: 0.8em;
    font-weight: bold;
    letter-spacing: 1px;
}

.featured-content {
    position: relative;
    z-index: 2;
}

.featured-content h3 {
    font-size: 1.6em;
    margin-bottom: 15px;
}

.featured-content h3 a {
    color: white;
    text-decoration: none;
}

.featured-content h3 a:hover {
    color: var(--wave-trough);
}

.featured-content p {
    color: var(--text-glow);
    margin-bottom: 20px;
    line-height: 1.6;
}

.featured-meta {
    display: flex;
    gap: 20px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.9em;
}

/* Article Grid */
.articles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 25px;
    margin: 30px 0;
}

.article-item {
    background: rgba(0, 0, 0, 0.4);
    border-radius: 15px;
    padding: 25px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
}

.article-item:hover {
    transform: translateY(-5px);
    border-color: var(--wave-trough);
    box-shadow: 0 10px 30px rgba(0, 212, 255, 0.1);
}

.article-meta-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    font-size: 0.85em;
}

.article-category {
    background: rgba(0, 212, 255, 0.15);
    color: var(--wave-trough);
    padding: 3px 12px;
    border-radius: 20px;
    font-weight: 600;
}

.article-date {
    color: rgba(255, 255, 255, 0.6);
}

.article-item h3 {
    margin-bottom: 15px;
    font-size: 1.3em;
}

.article-item h3 a {
    color: white;
    text-decoration: none;
}

.article-item h3 a:hover {
    color: var(--wave-trough);
}

.article-item p {
    color: var(--text-glow);
    margin-bottom: 20px;
    line-height: 1.6;
    font-size: 0.95em;
}

.article-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 15px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.reading-time {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.9em;
}

.reading-time i {
    color: var(--wave-mid);
    margin-right: 5px;
}

.difficulty {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.8em;
    font-weight: 600;
}

.difficulty.beginner {
    background: rgba(76, 175, 80, 0.15);
    color: #4CAF50;
    border: 1px solid rgba(76, 175, 80, 0.3);
}

.difficulty.intermediate {
    background: rgba(255, 193, 7, 0.15);
    color: #FFC107;
    border: 1px solid rgba(255, 193, 7, 0.3);
}

.difficulty.advanced {
    background: rgba(244, 67, 54, 0.15);
    color: #F44336;
    border: 1px solid rgba(244, 67, 54, 0.3);
}

/* Quick Start Guide */
.quick-start {
    margin: 60px 0;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 30px;
    padding: 40px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.quick-start h2 {
    color: white;
    font-size: 2em;
    margin-bottom: 30px;
    text-align: center;
}

.quick-start h2 i {
    color: var(--wave-trough);
    margin-right: 10px;
}

.quick-steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
}

.step {
    text-align: center;
    padding: 25px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
    position: relative;
}

.step:hover {
    transform: translateY(-5px);
    border-color: var(--wave-trough);
    box-shadow: 0 10px 30px rgba(0, 212, 255, 0.2);
}

.step-number {
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, var(--wave-trough), var(--wave-mid));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5em;
    font-weight: bold;
    color: white;
    margin: 0 auto 20px;
}

.step h3 {
    color: white;
    margin-bottom: 10px;
    font-size: 1.3em;
}

.step p {
    color: var(--text-glow);
    margin-bottom: 20px;
    line-height: 1.5;
    font-size: 0.95em;
}

.step-link {
    display: inline-block;
    color: var(--wave-trough);
    text-decoration: none;
    font-weight: 600;
    padding: 8px 20px;
    border-radius: 25px;
    background: rgba(0, 212, 255, 0.1);
    transition: all 0.3s ease;
}

.step-link:hover {
    background: var(--wave-trough);
    color: black;
    transform: translateY(-2px);
}

/* Newsletter Section */
.newsletter-section {
    text-align: center;
    margin: 50px 0;
    padding: 40px;
    background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(156, 39, 176, 0.1));
    border-radius: 30px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.newsletter-section h3 {
    color: white;
    font-size: 1.8em;
    margin-bottom: 15px;
}

.newsletter-section h3 i {
    color: var(--wave-trough);
    margin-right: 10px;
}

.newsletter-section p {
    color: var(--text-glow);
    margin-bottom: 25px;
    font-size: 1.1em;
}

.newsletter-btn {
    background: linear-gradient(135deg, var(--wave-trough), var(--wave-mid));
    color: white;
    border: none;
    padding: 15px 35px;
    border-radius: 50px;
    font-size: 1.1em;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    border: 2px solid transparent;
}

.newsletter-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 30px rgba(0, 212, 255, 0.4);
    border-color: white;
}

.newsletter-btn i {
    font-size: 1.2em;
}

/* Responsive */
@media (max-width: 768px) {
    .featured-grid {
        grid-template-columns: 1fr;
    }
    
    .articles-grid {
        grid-template-columns: 1fr;
    }
    
    .quick-steps {
        grid-template-columns: 1fr;
    }
    
    .quick-start {
        padding: 25px;
    }
    
    .step {
        padding: 20px;
    }
    
    .newsletter-section {
        padding: 25px;
    }
    
    .newsletter-section h3 {
        font-size: 1.5em;
    }
}

@media (max-width: 480px) {
    .path-card {
        padding: 20px;
    }
    
    .featured-card {
        padding: 20px;
    }
    
    .article-meta-header {
        flex-direction: column;
        gap: 10px;
        align-items: flex-start;
    }
}
</style>
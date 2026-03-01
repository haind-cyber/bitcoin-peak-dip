// Learn.js - Interactive features for Knowledge Base

document.addEventListener('DOMContentLoaded', function() {
    console.log('📚 Bitcoin PeakDip Knowledge Base Loaded');
    
    // Highlight current page in navigation
    highlightCurrentPage();
    
    // Add reading progress bar
    addReadingProgress();
    
    // Add table of contents for articles
    addTableOfContents();
});

function highlightCurrentPage() {
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('.dropdown-item');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
            
            // Also highlight parent dropdown
            const parentDropdown = link.closest('.dropdown');
            if (parentDropdown) {
                parentDropdown.classList.add('active');
            }
        }
    });
}
function addReadingProgress() {
    // Tạo progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'reading-progress';
    progressBar.innerHTML = '<div class="progress-bar" id="readingProgress"></div>';
    document.body.appendChild(progressBar);
    
    // Update progress khi scroll
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

function addTableOfContents() {
    // Chỉ thêm TOC cho articles
    if (!document.querySelector('.learn-article')) return;
    
    const headings = document.querySelectorAll('.article-content h2, .article-content h3');
    if (headings.length < 3) return;
    
    const toc = document.createElement('div');
    toc.className = 'table-of-contents';
    toc.innerHTML = '<h3><i class="fas fa-list"></i> Contents</h3><ul></ul>';
    
    const tocList = toc.querySelector('ul');
    
    headings.forEach((heading, index) => {
        // Add ID if not exists
        if (!heading.id) {
            heading.id = `section-${index}`;
        }
        
        const li = document.createElement('li');
        li.className = heading.tagName === 'H2' ? 'toc-h2' : 'toc-h3';
        li.innerHTML = `<a href="#${heading.id}">${heading.textContent}</a>`;
        tocList.appendChild(li);
    });
    
    // Insert TOC at beginning of article
    const article = document.querySelector('.learn-article');
    article.insertBefore(toc, article.querySelector('.article-content'));
}

// Add CSS for learn features
const learnStyle = document.createElement('style');
learnStyle.textContent = `
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
    
    .table-of-contents {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(0, 212, 255, 0.2);
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 30px;
    }
    
    .table-of-contents h3 {
        color: var(--wave-trough);
        margin-bottom: 15px;
    }
    
    .table-of-contents ul {
        list-style: none;
        padding-left: 0;
    }
    
    .table-of-contents li {
        margin-bottom: 8px;
    }
    
    .table-of-contents a {
        color: var(--text-glow);
        text-decoration: none;
        transition: all 0.3s ease;
    }
    
    .table-of-contents a:hover {
        color: var(--wave-trough);
        padding-left: 5px;
    }
    
    .toc-h3 {
        padding-left: 20px;
        font-size: 0.95em;
    }
    
    .post-item {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 15px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .post-item h4 {
        margin-bottom: 10px;
    }
    
    .post-item a {
        color: var(--wave-trough);
        text-decoration: none;
    }
    
    .post-meta {
        color: var(--text-glow);
        font-size: 0.85em;
        margin-bottom: 10px;
        opacity: 0.7;
    }
`;
document.head.appendChild(learnStyle);
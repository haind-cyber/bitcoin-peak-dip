// build.js - Version auto-increment build script
// Version: 2.0.0 - Tích hợp articles.json, badge support, PWA optimization

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n🔨 ===== BITCOIN PEAKDIP BUILD SYSTEM =====\n');

// ========== HELPER FUNCTIONS ==========
function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    fs.mkdirSync(dirname, { recursive: true });
    return true;
}

function extractFrontMatter(content) {
    const match = content.match(/^---\s*\n(.*?)\n---\s*\n(.*)/ms);
    if (!match) return { frontmatter: {}, content: content };
    
    try {
        const frontmatter = {};
        const lines = match[1].split('\n');
        lines.forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length) {
                let value = valueParts.join(':').trim();
                // Remove quotes if present
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                if (value.startsWith("'") && value.endsWith("'")) {
                    value = value.slice(1, -1);
                }
                frontmatter[key.trim()] = value;
            }
        });
        return { frontmatter, content: match[2] };
    } catch (e) {
        console.warn('⚠️ Error parsing frontmatter:', e.message);
        return { frontmatter: {}, content: content };
    }
}

function extractExcerpt(content, maxLength = 150) {
    // Remove HTML tags
    const plainText = content.replace(/<[^>]*>/g, '');
    // Remove markdown links
    const withoutLinks = plainText.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    // Get first paragraph or truncate
    const firstParagraph = withoutLinks.split('\n\n')[0] || withoutLinks;
    const truncated = firstParagraph.substring(0, maxLength).replace(/\s+\S*$/, '...');
    return truncated;
}

// ========== GENERATE ARTICLES.JSON ==========
function generateArticlesJson() {
    console.log('📄 Generating articles.json with full metadata...');
    
    try {
        const postsDir = path.join(__dirname, '_posts');
        const articles = [];
        
        if (!fs.existsSync(postsDir)) {
            console.warn('⚠️ _posts directory not found, skipping article generation');
            return false;
        }
        
        const files = fs.readdirSync(postsDir).filter(f => 
            f.endsWith('.md') || f.endsWith('.markdown')
        );
        
        console.log(`📁 Found ${files.length} post files`);
        
        files.forEach((file, index) => {
            const filePath = path.join(postsDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const { frontmatter, content: mainContent } = extractFrontMatter(content);
            
            // Parse filename for date
            const dateMatch = file.match(/^(\d{4})-(\d{2})-(\d{2})-/);
            let date = dateMatch 
                ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
                : new Date().toISOString().split('T')[0];
            
            // Get ID from filename (remove date and extension)
            let id = file;
            if (dateMatch) {
                id = file.replace(/^\d{4}-\d{2}-\d{2}-/, '');
            }
            id = id.replace(/\.(md|markdown)$/, '');
            
            // Get title from frontmatter or filename
            let title = frontmatter.title || id.replace(/-/g, ' ');
            // Capitalize first letter of each word
            title = title.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            
            // Get other metadata
            const description = frontmatter.description || extractExcerpt(mainContent);
            const author = frontmatter.author || 'Bitcoin PeakDip Team';
            const category = frontmatter.category || 'General';
            const reading_time = parseInt(frontmatter.reading_time) || 5;
            const level = frontmatter.level || 'Beginner';
            const icon = frontmatter.icon || 'book';
            const featured = frontmatter.featured === true || frontmatter.featured === 'true';
            
            // Generate URL
            const urlDate = date.replace(/-/g, '/');
            const url = `/learn/${urlDate}/${id}.html`;
            
            articles.push({
                id: id,
                title: title,
                description: description,
                url: url,
                date: date,
                author: author,
                category: category,
                reading_time: reading_time,
                level: level,
                icon: icon,
                featured: featured,
                excerpt: extractExcerpt(mainContent, 200)
            });
            
            if ((index + 1) % 10 === 0) {
                console.log(`  ✅ Processed ${index + 1}/${files.length} articles`);
            }
        });
        
        // Sort by date (newest first)
        articles.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Calculate new articles (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const newArticles = articles.filter(a => new Date(a.date) >= sevenDaysAgo);
        
        // Count by category
        const categories = {};
        articles.forEach(a => {
            categories[a.category] = (categories[a.category] || 0) + 1;
        });
        
        // Count by level
        const levels = {
            Beginner: 0,
            Intermediate: 0,
            Advanced: 0
        };
        articles.forEach(a => {
            if (levels.hasOwnProperty(a.level)) {
                levels[a.level]++;
            }
        });
        
        // Đọc version từ biến newVersion đã được tính ở trên
        const currentVersion = newVersion; // Sử dụng biến global từ build.js
        
        // Create output with full metadata
        const output = {
            articles: articles,
            metadata: {
                last_updated: new Date().toISOString(),
                total: articles.length,
                version: currentVersion,
                build_timestamp: timestamp,
                build_date: today,
                build_time: timeStr
            },
            stats: {
                new_articles_count: newArticles.length,
                new_articles: newArticles.map(a => ({
                    id: a.id,
                    title: a.title,
                    url: a.url,
                    date: a.date,
                    reading_time: a.reading_time,
                    level: a.level
                })),
                categories: categories,
                levels: levels,
                featured_count: articles.filter(a => a.featured).length
            }
        };
        
        // Write to multiple locations
        const paths = [
            '_site/_data/articles.json',
            '_data/articles.json',
            'assets/data/articles.json',
            '_site/assets/data/articles.json'
        ];
        
        paths.forEach(p => {
            const fullPath = path.join(__dirname, p);
            ensureDirectoryExistence(fullPath);
            fs.writeFileSync(fullPath, JSON.stringify(output, null, 2));
            console.log(`✅ Wrote to ${p}`);
        });
        
        console.log(`📊 Stats: ${articles.length} total articles, ${newArticles.length} new in last 7 days`);
        return true;
    } catch (error) {
        console.error('❌ Failed to generate articles.json:', error.message);
        return false;
    }
}

// ========== UPDATE NOTIFICATION CACHE ==========
function updateNotificationCache() {
    console.log('🔔 Updating notification cache...');
    
    try {
        const articlePath = path.join(__dirname, 'assets', 'data', 'articles.json');
        
        if (!fs.existsSync(articlePath)) {
            console.warn('⚠️ articles.json not found, skipping notification cache update');
            return false;
        }
        
        const articlesData = JSON.parse(fs.readFileSync(articlePath, 'utf8'));
        
        // Create notification-specific cache
        const notificationCache = {
            version: newVersion,
            last_checked: new Date().toISOString(),
            articles: articlesData.articles.map(a => ({
                id: a.id,
                title: a.title,
                url: a.url,
                date: a.date,
                reading_time: a.reading_time,
                level: a.level
            })),
            new_articles: articlesData.stats.new_articles,
            new_count: articlesData.stats.new_articles_count
        };
        
        const cachePath = path.join(__dirname, 'assets', 'data', 'notification-cache.json');
        fs.writeFileSync(cachePath, JSON.stringify(notificationCache, null, 2));
        console.log('✅ Notification cache updated');
        
        return true;
    } catch (error) {
        console.error('❌ Failed to update notification cache:', error.message);
        return false;
    }
}

// ========== VALIDATE PWA ASSETS ==========
function validatePWAAssets() {
    console.log('📱 Validating PWA assets...');
    
    const requiredAssets = [
        'assets/icons/icon-72x72.png',
        'assets/icons/icon-96x96.png',
        'assets/icons/icon-128x128.png',
        'assets/icons/icon-144x144.png',
        'assets/icons/icon-152x152.png',
        'assets/icons/icon-192x192.png',
        'assets/icons/icon-384x384.png',
        'assets/icons/icon-512x512.png',
        'manifest.json',
        'service-worker.js',
        'offline.html'
    ];
    
    let missingCount = 0;
    
    requiredAssets.forEach(asset => {
        const assetPath = path.join(__dirname, asset);
        if (!fs.existsSync(assetPath)) {
            console.warn(`⚠️ Missing PWA asset: ${asset}`);
            missingCount++;
        }
    });
    
    if (missingCount === 0) {
        console.log('✅ All PWA assets present');
    } else {
        console.warn(`⚠️ ${missingCount} PWA assets missing`);
    }
    
    return missingCount === 0;
}

// ========== UPDATE VERSION IN MULTIPLE FILES ==========
function updateVersionInFiles() {
    console.log('📝 Updating version in configuration files...');
    
    try {
        // Update _config.yml
        console.log('  → _config.yml');
        config = config.replace(
            /version:\s*["']?[\d.]+["']?/,
            `version: "${newVersion}"`
        );
        config = config.replace(
            /build_date:\s*["']?.*["']?/,
            `build_date: "${today}"`
        );
        fs.writeFileSync(configPath, config);
        
        // Update version.json
        console.log('  → version.json');
        const versionJson = {
            version: newVersion,
            build_date: today,
            changelog: [
                "Auto build system update",
                "Performance improvements",
                "Bug fixes"
            ],
            build_time: timeStr,
            build_timestamp: timestamp
        };
        fs.writeFileSync(
            path.join(__dirname, 'version.json'),
            JSON.stringify(versionJson, null, 2)
        );
        
        // Update service-worker.js
        console.log('  → service-worker.js');
        const swPath = path.join(__dirname, 'service-worker.js');
        let swContent = fs.readFileSync(swPath, 'utf8');
        
        swContent = swContent.replace(
            /CACHE_NAME = ['"]bitcoinpeakdip-v[\d.]+['"]/,
            `CACHE_NAME = 'bitcoinpeakdip-v${newVersion}'`
        );
        swContent = swContent.replace(
            /DYNAMIC_CACHE = ['"]bitcoinpeakdip-dynamic-v[\d.]+['"]/,
            `DYNAMIC_CACHE = 'bitcoinpeakdip-dynamic-v${newVersion}'`
        );
        swContent = swContent.replace(
            /\/\/ Version: [\d.]+/,
            `// Version: ${newVersion}`
        );
        fs.writeFileSync(swPath, swContent);
        
        // Update version.js if exists
        const versionJsPath = path.join(__dirname, 'assets', 'js', 'version.js');
        if (fs.existsSync(versionJsPath)) {
            console.log('  → assets/js/version.js');
            let versionJs = `// version.js - Auto-generated build ${newVersion}
const VERSION = {
    major: ${major},
    minor: ${minor},
    patch: ${patch}
};

window.APP_VERSION = \`\${VERSION.major}.\${VERSION.minor}.\${VERSION.patch}\`;

// Build info
window.BUILD_INFO = {
    version: '${newVersion}',
    date: '${today}',
    time: '${timeStr}',
    timestamp: ${timestamp}
};

console.log('🏗️  Build:', window.BUILD_INFO);

// PWA Cache Management
if ('serviceWorker' in navigator) {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.deferredPrompt = e;
        
        setTimeout(() => {
            showInstallPrompt();
        }, 3000);
    });
    
    window.addEventListener('appinstalled', () => {
        console.log('✅ PWA installed successfully');
        localStorage.setItem('pwa_installed', 'true');
    });
}

function showInstallPrompt() {
    if (!window.deferredPrompt) return;
    if (localStorage.getItem('pwa_dismissed')) return;
    
    const installPrompt = document.createElement('div');
    installPrompt.className = 'install-prompt';
    installPrompt.innerHTML = \`
        <div class="install-content">
            <i class="fas fa-download"></i>
            <span>Install Bitcoin PeakDip for offline access!</span>
            <button onclick="installPWA()" class="install-btn">Install</button>
            <button onclick="dismissInstall(this)" class="dismiss-btn">
                <i class="fas fa-times"></i>
            </button>
        </div>
    \`;
    
    document.body.appendChild(installPrompt);
    
    setTimeout(() => {
        if (installPrompt.parentNode) {
            installPrompt.remove();
        }
    }, 30000);
}

window.installPWA = function() {
    const prompt = window.deferredPrompt;
    if (!prompt) return;
    
    prompt.prompt();
    
    prompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted PWA installation');
        }
        window.deferredPrompt = null;
    });
    
    document.querySelector('.install-prompt')?.remove();
};

window.dismissInstall = function(btn) {
    const prompt = btn.closest('.install-prompt');
    if (prompt) {
        prompt.style.animation = 'slideDown 0.3s ease forwards';
        setTimeout(() => prompt.remove(), 300);
        localStorage.setItem('pwa_dismissed', 'true');
    }
};`;

            fs.writeFileSync(versionJsPath, versionJs);
        }
        
        // Create .version file
        console.log('  → .version');
        const versionInfo = `# Bitcoin PeakDip Build Information
VERSION=${newVersion}
BUILD_DATE=${today}
BUILD_TIME=${timeStr}
BUILD_TIMESTAMP=${timestamp}
`;
        fs.writeFileSync(path.join(__dirname, '.version'), versionInfo);
        
        // Update _data/version.yml
        console.log('  → _data/version.yml');
        const versionYml = `# Auto-generated by build.js
version: ${newVersion}
build_date: ${today}
build_time: ${timeStr}
build_timestamp: ${timestamp}
full_version: "${newVersion} (${today} ${timeStr})"
`;
        ensureDirectoryExistence(path.join(__dirname, '_data', 'version.yml'));
        fs.writeFileSync(path.join(__dirname, '_data', 'version.yml'), versionYml);
        
        console.log('✅ All version files updated successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to update version files:', error.message);
        return false;
    }
}

// ========== MAIN BUILD PROCESS ==========

// Bước 1: Đọc và tăng version
console.log('📊 Reading current version...');
const configPath = path.join(__dirname, '_config.yml');
let config = fs.readFileSync(configPath, 'utf8');

const versionMatch = config.match(/version:\s*["']?([\d.]+)["']?/);
let currentVersion = versionMatch ? versionMatch[1] : '1.12.0';
let [major, minor, patch] = currentVersion.split('.').map(Number);

// Tăng patch version
patch++;

// Version mới
const newVersion = `${major}.${minor}.${patch}`;
const today = new Date().toISOString().split('T')[0];
const now = new Date();
const timeStr = now.toLocaleTimeString('en-GB', { hour12: false });
const timestamp = Date.now();

console.log(`📊 Current version: ${currentVersion}`);
console.log(`✨ New version: ${newVersion}`);
console.log(`📅 Build date: ${today}`);
console.log(`⏰ Build time: ${timeStr}`);
console.log(`🕒 Timestamp: ${timestamp}\n`);

// Bước 2: Cập nhật version trong tất cả files
console.log('📝 Step 1: Updating version files...');
updateVersionInFiles();

// Bước 3: Generate articles.json
console.log('\n📄 Step 2: Generating articles...');
generateArticlesJson();

// Bước 4: Update notification cache
console.log('\n🔔 Step 3: Updating notification cache...');
updateNotificationCache();

// Bước 5: Validate PWA assets
console.log('\n📱 Step 4: Validating PWA assets...');
validatePWAAssets();

// Bước 6: Optional: Run Ruby generator for compatibility
console.log('\n🔄 Step 5: Running compatibility scripts...');
try {
    if (fs.existsSync(path.join(__dirname, 'generate_local.rb'))) {
        console.log('  → Running generate_local.rb for compatibility...');
        execSync('ruby generate_local.rb', { stdio: 'inherit' });
        console.log('  ✅ Ruby generator completed');
    }
} catch (error) {
    console.warn('⚠️ Ruby generator failed (non-critical):', error.message);
}

// Bước 7: Final summary
console.log('\n🎉 ===== BUILD COMPLETED SUCCESSFULLY =====');
console.log(`📦 New version: ${newVersion}`);
console.log(`📊 Articles: Generated with full metadata`);
console.log(`🔔 Notifications: Cache updated`);
console.log(`📱 PWA: Assets validated`);
console.log(`\n🚀 Run 'jekyll build' or 'jekyll serve' to deploy\n`);
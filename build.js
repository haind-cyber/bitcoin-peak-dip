// build.js - Version auto-increment build script
const fs = require('fs');
const path = require('path');

console.log('\n🔨 ===== BITCOIN PEAKDIP BUILD SYSTEM =====\n');

// Đọc version hiện tại từ _config.yml
const configPath = path.join(__dirname, '_config.yml');
let config = fs.readFileSync(configPath, 'utf8');

// Lấy version hiện tại
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

// 1. Update _config.yml
console.log('📝 Updating _config.yml...');
config = config.replace(
    /version:\s*["']?[\d.]+["']?/,
    `version: "${newVersion}"`
);
config = config.replace(
    /build_date:\s*["']?.*["']?/,
    `build_date: "${today}"`
);
fs.writeFileSync(configPath, config);
console.log('✅ _config.yml updated');

// 2. Update version.json
console.log('📝 Updating version.json...');
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
console.log('✅ version.json updated');

// 3. Update service-worker.js
console.log('📝 Updating service-worker.js...');
const swPath = path.join(__dirname, 'service-worker.js');
let swContent = fs.readFileSync(swPath, 'utf8');

// Update CACHE_NAME
swContent = swContent.replace(
    /CACHE_NAME = ['"]bitcoin-peakdip-v[\d.]+['"]/,
    `CACHE_NAME = 'bitcoin-peakdip-v${newVersion}'`
);

// Update DYNAMIC_CACHE
swContent = swContent.replace(
    /DYNAMIC_CACHE = ['"]bitcoin-peakdip-dynamic-v[\d.]+['"]/,
    `DYNAMIC_CACHE = 'bitcoin-peakdip-dynamic-v${newVersion}'`
);

// Update version comment ở đầu file
swContent = swContent.replace(
    /\/\/ Version: [\d.]+/,
    `// Version: ${newVersion}`
);

fs.writeFileSync(swPath, swContent);
console.log('✅ service-worker.js updated');

// 4. Tạo file version.js mới (tùy chọn)
console.log('📝 Updating version.js...');
const versionJsPath = path.join(__dirname, 'assets', 'js', 'version.js');
if (fs.existsSync(versionJsPath)) {
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
            <span>Install Bitcoin PeakDip v\${window.APP_VERSION} for offline access!</span>
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
    console.log('✅ version.js updated');
} else {
    console.log('⚠️ version.js not found, skipping');
}

// 5. Tạo file .version để lưu thông tin build
console.log('📝 Creating .version file...');
const versionInfo = `# Bitcoin PeakDip Build Information
VERSION=${newVersion}
BUILD_DATE=${today}
BUILD_TIME=${timeStr}
BUILD_TIMESTAMP=${timestamp}
`;
fs.writeFileSync(path.join(__dirname, '.version'), versionInfo);
console.log('✅ .version file created');

console.log('\n🎉 ===== BUILD COMPLETED SUCCESSFULLY =====');
console.log(`📦 New version: ${newVersion}`);
console.log(`🚀 Run 'jekyll build' or 'jekyll serve' to deploy\n`);
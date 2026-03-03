// version.js - Auto-generated build 1.12.22
const VERSION = {
    major: 1,
    minor: 12,
    patch: 22
};

window.APP_VERSION = `${VERSION.major}.${VERSION.minor}.${VERSION.patch}`;

// Build info
window.BUILD_INFO = {
    version: '1.12.22',
    date: '2026-03-03',
    time: '17:50:44',
    timestamp: 1772535044624
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
    installPrompt.innerHTML = `
        <div class="install-content">
            <i class="fas fa-download"></i>
            <span>Install Bitcoin PeakDip for offline access!</span>
            <button onclick="installPWA()" class="install-btn">Install</button>
            <button onclick="dismissInstall(this)" class="dismiss-btn">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
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
};
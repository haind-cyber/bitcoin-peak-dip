// version.js - Auto-incrementing version system với PWA support
const VERSION = {
    major: 1,
    minor: 4,
    patch: Date.now() // Using timestamp ensures unique version every time
};

window.APP_VERSION = `${VERSION.major}.${VERSION.minor}.${VERSION.patch}`;

// PWA Cache Management
if ('serviceWorker' in navigator) {
    // Check for PWA installation
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.deferredPrompt = e;
        
        // Show install button after 3 seconds
        setTimeout(() => {
            showInstallPrompt();
        }, 3000);
    });
    
    window.addEventListener('appinstalled', () => {
        console.log('✅ PWA installed successfully');
        localStorage.setItem('pwa_installed', 'true');
    });
}

// Function to show install prompt
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
    
    // Auto hide after 30 seconds
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
        } else {
            console.log('User dismissed PWA installation');
        }
        window.deferredPrompt = null;
    });
    
    // Remove install prompt
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
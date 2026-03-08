// assets/js/pwa-version.js
(function syncPWAVersion() {
    const currentVersion = window.APP_VERSION || '1.12.10';
    const pwaVersion = localStorage.getItem('pwa_version');
    const pwaInstalled = localStorage.getItem('pwa_installed') === 'true';
    
    console.log('📱 PWA Version Check:');
    console.log('   Current:', currentVersion);
    console.log('   Installed:', pwaVersion || 'none');
    
    // Nếu PWA đã cài nhưng version cũ
    if (pwaInstalled && pwaVersion && pwaVersion !== currentVersion) {
        console.log('🔄 Updating PWA version...');
        
        // Clear cache
        if ('caches' in window) {
            caches.keys().then(keys => {
                keys.forEach(key => {
                    if (key.includes('bitcoinpeakdip')) {
                        caches.delete(key);
                    }
                });
            });
        }
        
        // Unregister old service workers
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                registrations.forEach(registration => {
                    registration.unregister();
                });
            });
        }
        
        // Update version
        localStorage.setItem('pwa_version', currentVersion);
        
        // Thông báo user refresh
        if (confirm('🔄 New version available! Reload to update?')) {
            window.location.reload(true);
        }
    } else if (pwaInstalled && !pwaVersion) {
        localStorage.setItem('pwa_version', currentVersion);
    }
})();
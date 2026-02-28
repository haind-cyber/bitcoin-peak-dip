// Main JavaScript - Shared between all pages

document.addEventListener('DOMContentLoaded', function() {
    console.log('Bitcoin PeakDip Early Warning System Initialized');
    
    // Common elements
    const navigation = document.getElementById('navigation');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');
    const pageFooter = document.getElementById('pageFooter');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    
    // ===== FIX: MOBILE MENU - CĂN PHẢI VÀ XỬ LÝ ACTIVE STATE =====
    if (mobileMenuBtn && navMenu) {
        console.log('📱 Initializing mobile menu for:', window.location.pathname);
        
        // Xóa tất cả event listeners cũ
        const newMenuBtn = mobileMenuBtn.cloneNode(true);
        mobileMenuBtn.parentNode.replaceChild(newMenuBtn, mobileMenuBtn);
        
        const newNavMenu = navMenu.cloneNode(true);
        navMenu.parentNode.replaceChild(newNavMenu, navMenu);
        
        // Gán lại biến với elements mới
        const updatedMenuBtn = document.getElementById('mobileMenuBtn');
        const updatedNavMenu = document.getElementById('navMenu');
        const updatedNavLinks = updatedNavMenu.querySelectorAll('.nav-link');
        
        // Đảm bảo menu đóng khi load trang
        updatedNavMenu.classList.remove('active');
        if (updatedMenuBtn.querySelector('i')) {
            updatedMenuBtn.querySelector('i').className = 'fas fa-bars';
        }
        
        // ===== FIX: Set active class đúng cho menu items =====
        function setActiveMenuItem() {
            const currentPath = window.location.pathname.split('/').pop() || 'index.html';
            
            updatedNavLinks.forEach(link => {
                // Xóa tất cả active classes
                link.classList.remove('active');
                
                // Lấy href của link
                const href = link.getAttribute('href');
                
                // Kiểm tra match
                if (href === currentPath) {
                    link.classList.add('active');
                }
                
                // Special case cho index.html
                if (currentPath === 'index.html' || currentPath === '') {
                    if (href === 'index.html') {
                        link.classList.add('active');
                    }
                }
                
                // FIX: Đặc biệt cho Learn page
                if (currentPath.includes('learn') && href.includes('learn')) {
                    link.classList.add('active');
                }
                
                // FIX: Đặc biệt cho các page khác
                if (currentPath.includes('about') && href.includes('about')) {
                    link.classList.add('active');
                }
                if (currentPath.includes('product') && href.includes('product')) {
                    link.classList.add('active');
                }
                if (currentPath.includes('signals') && href.includes('signals')) {
                    link.classList.add('active');
                }
            });
            
            console.log('✅ Active menu set for:', currentPath);
        }
        
        // Gọi hàm set active
        setActiveMenuItem();
        
        // Xử lý click menu button
        updatedMenuBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('👆 Mobile menu clicked on:', window.location.pathname);
            
            // Toggle menu
            this.classList.toggle('active');
            updatedNavMenu.classList.toggle('active');
            
            // Đổi icon
            const icon = this.querySelector('i');
            if (updatedNavMenu.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
                
                // Chặn scroll khi menu mở
                document.body.style.overflow = 'hidden';
                document.documentElement.style.overflow = 'hidden';
                document.body.classList.add('menu-open');
                
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
                
                // Cho phép scroll lại
                document.body.style.overflow = '';
                document.documentElement.style.overflow = '';
                document.body.classList.remove('menu-open');
            }
        });
        
        // Xử lý click vào menu items
        updatedNavLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                console.log('🔗 Nav link clicked:', this.getAttribute('href'));
                
                // Đóng menu
                updatedNavMenu.classList.remove('active');
                if (updatedMenuBtn) {
                    const icon = updatedMenuBtn.querySelector('i');
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
                
                // Cho phép scroll lại
                document.body.style.overflow = '';
                document.documentElement.style.overflow = '';
                document.body.classList.remove('menu-open');
                
                // KHÔNG set active ở đây vì sẽ reload trang
                // Để trang mới tự set active
            });
        });
        
        // Đóng menu khi click ra ngoài
        document.addEventListener('click', function(e) {
            if (!updatedMenuBtn.contains(e.target) && !updatedNavMenu.contains(e.target)) {
                if (updatedNavMenu.classList.contains('active')) {
                    console.log('👆 Click outside - closing menu');
                    
                    updatedNavMenu.classList.remove('active');
                    if (updatedMenuBtn) {
                        const icon = updatedMenuBtn.querySelector('i');
                        icon.classList.remove('fa-times');
                        icon.classList.add('fa-bars');
                    }
                    
                    // Cho phép scroll lại
                    document.body.style.overflow = '';
                    document.documentElement.style.overflow = '';
                    document.body.classList.remove('menu-open');
                }
            }
        });
        
        // Xử lý resize window
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768 && updatedNavMenu.classList.contains('active')) {
                console.log('📱 Resize to desktop - closing menu');
                
                updatedNavMenu.classList.remove('active');
                if (updatedMenuBtn) {
                    const icon = updatedMenuBtn.querySelector('i');
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
                
                // Cho phép scroll lại
                document.body.style.overflow = '';
                document.documentElement.style.overflow = '';
                document.body.classList.remove('menu-open');
            }
        });
        
        // Xử lý escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && updatedNavMenu.classList.contains('active')) {
                console.log('🔑 Escape key - closing menu');
                
                updatedNavMenu.classList.remove('active');
                if (updatedMenuBtn) {
                    const icon = updatedMenuBtn.querySelector('i');
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
                
                // Cho phép scroll lại
                document.body.style.overflow = '';
                document.documentElement.style.overflow = '';
                document.body.classList.remove('menu-open');
            }
        });
        
        console.log('✅ Mobile menu initialized for:', window.location.pathname);
    } else {
        console.warn('⚠️ Mobile menu elements not found on:', window.location.pathname, {
            mobileMenuBtn: !!mobileMenuBtn,
            navMenu: !!navMenu
        });
    }

    // ===== XỬ LÝ DROPDOWN MOBILE =====
    const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
    
    dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                const dropdown = this.closest('.dropdown');
                
                // Close other dropdowns
                document.querySelectorAll('.dropdown').forEach(d => {
                    if (d !== dropdown) {
                        d.classList.remove('active');
                        const otherArrow = d.querySelector('.dropdown-arrow');
                        if (otherArrow) otherArrow.style.transform = '';
                    }
                });
                
                // Toggle current dropdown
                dropdown.classList.toggle('active');
                
                // Update arrow
                const arrow = this.querySelector('.dropdown-arrow');
                if (arrow) {
                    arrow.style.transform = dropdown.classList.contains('active') ? 'rotate(180deg)' : '';
                }
            }
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
            if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown').forEach(d => {
                    d.classList.remove('active');
                });
                
                document.querySelectorAll('.dropdown-arrow').forEach(arrow => {
                    arrow.style.transform = '';
                });
            }
        }
    });
        
    // Navigation scroll effect
    window.addEventListener('scroll', function() {
        if (navigation) {
            if (window.scrollY > 50) {
                navigation.classList.add('scrolled');
            } else {
                navigation.classList.remove('scrolled');
            }
        }
        
        // Hide status indicator when near footer
        updateStatusVisibility();
    });
    
    // Function to update status visibility
    function updateStatusVisibility() {
        if (!pageFooter || !statusIndicator) return;
        
        const scrollPosition = window.scrollY + window.innerHeight;
        const footerPosition = pageFooter.offsetTop;
        const distanceToFooter = footerPosition - scrollPosition;
        
        // If we're within 200px of the footer, hide the status indicator
        if (distanceToFooter < 200) {
            statusIndicator.classList.add('hidden');
        } else {
            statusIndicator.classList.remove('hidden');
        }
        
        // On mobile, also hide when scrolling
        if (window.innerWidth <= 768) {
            statusIndicator.style.transition = 'all 0.3s ease';
        }
    }
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Skip if it's just "#" or external links
            if (href === '#' || href.startsWith('http')) return;
            
            e.preventDefault();
            
            const targetElement = document.querySelector(href);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Update status text periodically (if statusText exists)
    if (statusText) {
        setInterval(() => {
            const statusMessages = [
                'ANALYSING BITCOIN WAVES',
                'MONITORING BITCOIN PATTERNS',
                'ANALYZING SENSOR DATA',
                'FILTERING MARKET NOISE',
                'DETECTING LOCAL EXTREMES',
                'EARLY WARNING SYSTEM ACTIVE'
            ];
            
            const randomStatus = statusMessages[Math.floor(Math.random() * statusMessages.length)];
            statusText.textContent = randomStatus;
        }, 12000);
    }
    
    // Create energy particles
    createEnergyParticles();
    
    // Initial update of status visibility
    updateStatusVisibility();
});

// Create floating energy particles
function createEnergyParticles() {
    const energyParticles = document.getElementById('energyParticles');
    if (!energyParticles) return;
    
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random position
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        
        // Random size
        const size = 1 + Math.random() * 3;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        // Random animation
        const duration = 3 + Math.random() * 5;
        const delay = Math.random() * 5;
        const particleX = -50 + Math.random() * 100;
        particle.style.setProperty('--particle-x', `${particleX}px`);
        
        particle.style.animation = `
            particleFloat ${duration}s infinite ${delay}s,
            particleFade ${duration}s infinite ${delay}s
        `;
        // THÊM: Màu sắc đa dạng
        if (i % 3 === 0) {
            particle.style.background = 'var(--wave-peak)';
        } else if (i % 3 === 1) {
            particle.style.background = 'var(--wave-trough)';
        } else {
            particle.style.background = 'var(--wave-mid)';
        }
                
        energyParticles.appendChild(particle);
    }
}

// THÊM MỚI: Đồng bộ sóng với Peak/Dip
function syncWavesWithDetection() {
    const waves = document.querySelectorAll('.bitcoin-wave');
    const peakMessage = document.getElementById('peakMessage');
    const dipMessage = document.getElementById('dipMessage');
    
    if (!waves.length) return;
    
    function updateWaveColors() {
        const isPeakActive = peakMessage && peakMessage.classList.contains('active');
        const isDipActive = dipMessage && dipMessage.classList.contains('active');
        
        waves.forEach((wave, index) => {
            const baseOpacity = 0.12 - (index * 0.04);
            
            if (isPeakActive) {
                // Peak mode - màu đỏ
                wave.style.background = `linear-gradient(90deg, 
                    transparent 0%,
                    rgba(255, 46, 99, ${baseOpacity}) 15%, 
                    rgba(247, 147, 26, ${baseOpacity * 0.6}) 35%, 
                    rgba(255, 46, 99, ${baseOpacity * 1.2}) 50%, 
                    rgba(247, 147, 26, ${baseOpacity * 0.6}) 65%, 
                    rgba(255, 46, 99, ${baseOpacity}) 85%,
                    transparent 100%)`;
                wave.style.filter = 'drop-shadow(0 0 5px rgba(255, 46, 99, 0.3))';
            } else if (isDipActive) {
                // Dip mode - màu xanh
                wave.style.background = `linear-gradient(90deg, 
                    transparent 0%,
                    rgba(0, 212, 255, ${baseOpacity}) 15%, 
                    rgba(247, 147, 26, ${baseOpacity * 0.4}) 35%, 
                    rgba(0, 212, 255, ${baseOpacity * 1.2}) 50%, 
                    rgba(247, 147, 26, ${baseOpacity * 0.4}) 65%, 
                    rgba(0, 212, 255, ${baseOpacity}) 85%,
                    transparent 100%)`;
                wave.style.filter = 'drop-shadow(0 0 5px rgba(0, 212, 255, 0.3))';
            } else {
                // Neutral mode
                wave.style.background = '';
                wave.style.filter = '';
            }
        });
    }
    
    updateWaveColors();
    
    // Theo dõi thay đổi
    if (peakMessage && dipMessage) {
        const observer = new MutationObserver(updateWaveColors);
        observer.observe(peakMessage, { attributes: true, attributeFilter: ['class'] });
        observer.observe(dipMessage, { attributes: true, attributeFilter: ['class'] });
    }
}

// Feature cards animation on scroll
document.addEventListener('DOMContentLoaded', function() {
    const observerOptions = {
        threshold: 0.2,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe feature cards
    document.querySelectorAll('.feature-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 1.5s ease, transform 1.5s ease';
        observer.observe(card);
    });
    
    // Observe process cards on about page
    document.querySelectorAll('.process-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 1s ease, transform 1s ease';
        observer.observe(card);
    });
    
    // Observe tech cards on about page
    document.querySelectorAll('.tech-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 1s ease, transform 1s ease';
        observer.observe(card);
    });
    setTimeout(syncWavesWithDetection, 1000);
});
// Thêm vào main.js (nếu file tồn tại)
// Export global functions
window.syncWavesWithDetection = syncWavesWithDetection;
window.intensifyWaves = intensifyWaves;
// Global error handler for CSV loading
window.addEventListener('error', function(e) {
    if (e.message.includes('CSV') || e.message.includes('signals')) {
        console.error('Global error caught:', e);
        
        // Show user-friendly message
        const banner = document.getElementById('dataStatusBanner');
        if (banner) {
            banner.style.display = 'block';
            document.getElementById('statusMessage').textContent = 
                'Error loading data: ' + e.message.substring(0, 100);
        }
    }
});

// Handle offline/online status
window.addEventListener('offline', function() {
    showNotification('You are offline. Some features may not work.', 'warning');
});

window.addEventListener('online', function() {
    showNotification('Back online. Reloading data...', 'info');
    setTimeout(() => location.reload(), 2000);
});
// ===== BADGE CHO READING LIST =====
function updateReadingListBadge() {
    const badge = document.getElementById('readingListBadge');
    if (!badge) return;
    
    // Lấy danh sách đọc từ localStorage
    const readingList = JSON.parse(localStorage.getItem('reading_list') || '[]');
    const count = readingList.length;
    
    // Cập nhật badge
    badge.textContent = count;
    
    if (count === 0) {
        badge.style.display = 'none';
    } else {
        badge.style.display = 'flex';
        // Thêm animation khi có số mới
        badge.style.animation = 'none';
        badge.offsetHeight; // Trigger reflow
        badge.style.animation = 'badgePulse 0.5s ease';
    }
    
    console.log('📊 Reading list badge updated:', count);
}

// Lắng nghe thay đổi từ localStorage (khi thêm/xóa ở tab khác)
window.addEventListener('storage', function(e) {
    if (e.key === 'reading_list') {
        updateReadingListBadge();
    }
});

// Gọi khi trang load
document.addEventListener('DOMContentLoaded', function() {
    // Gọi sau 500ms để đảm bảo DOM đã load xong
    setTimeout(updateReadingListBadge, 500);
});

// Thêm animation cho badge
const mainStyle = document.createElement('style');
mainStyle.textContent = `
    .reading-list-badge {
        position: absolute;
        top: -8px;
        right: -8px;
        background: linear-gradient(135deg, var(--wave-peak), #ff6b00);
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        font-size: 12px;
        display: none;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        font-weight: bold;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        z-index: 1000;
    }
    
    @keyframes badgePulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.3); }
        100% { transform: scale(1); }
    }
    
    /* Style cho nav link chứa badge */
    .nav-link {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }
`;
document.head.appendChild(mainStyle);
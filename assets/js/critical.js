// assets/js/critical.js - Load ngay lập tức
(function() {
    // Chỉ làm những việc thực sự cần thiết cho FCP
    console.log('⚡ Critical path initialized');
    
    // Set active menu item ngay lập tức
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
    
    // Mobile detection ngay lập tức
    window.IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    if (window.IS_MOBILE) {
        document.body.classList.add('mobile-device');
    }
})();
// update-footer.js
// Script để cập nhật footer links cho tất cả các trang HTML

function updateFooterLinks() {
    // Tìm tất cả các footer
    const footers = document.querySelectorAll('footer#pageFooter, .footer-links');
    
    footers.forEach(footer => {
        const footerLinks = footer.closest('footer')?.querySelector('.footer-links') || 
                           (footer.classList.contains('footer-links') ? footer : null);
        
        if (!footerLinks) return;
        
        // Lấy các link hiện tại
        const links = footerLinks.querySelectorAll('.footer-link');
        
        // Tạo HTML mới với đầy đủ các link
        const newLinksHTML = `
            <a href="index.html" class="footer-link">Home</a>
            <a href="about.html" class="footer-link">About</a>
            <a href="product.html" class="footer-link">Product</a>
            <a href="signals.html" class="footer-link">EWS Signals</a>
            <a href="learn.html" class="footer-link">Learn</a>
            <a href="#" class="footer-link">Contact</a>
            <a href="privacy-policy.html" class="footer-link">Privacy Policy</a>
            <a href="terms-of-service.html" class="footer-link">Terms of Service</a>
            <a href="risk-disclosure.html" class="footer-link">Risk Disclosure</a>
        `;
        
        footerLinks.innerHTML = newLinksHTML;
        
        // Đánh dấu active cho trang hiện tại
        const currentPage = window.location.pathname.split('/').pop();
        const footerLinkElements = footerLinks.querySelectorAll('.footer-link');
        
        footerLinkElements.forEach(link => {
            const href = link.getAttribute('href');
            if (href === currentPage) {
                link.classList.add('active');
            }
            
            // Special case for index.html
            if (currentPage === '' || currentPage === 'index.html' && href === 'index.html') {
                link.classList.add('active');
            }
        });
    });
    
    console.log('📝 Footer links updated with Privacy Policy, Terms of Service, and Risk Disclosure');
}

// Chạy khi DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateFooterLinks);
} else {
    updateFooterLinks();
}

// Export để có thể gọi lại
window.updateFooterLinks = updateFooterLinks;
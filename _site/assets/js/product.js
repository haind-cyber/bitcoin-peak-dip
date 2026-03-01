// Product Page Interactive Features

document.addEventListener('DOMContentLoaded', function() {
    console.log('Bitcoin PeakDip Product System Initialized');
    
    // Strategy card interactions
    const strategyCards = document.querySelectorAll('.strategy-card');
    
    strategyCards.forEach(card => {
        card.addEventListener('click', function() {
            const strategy = this.getAttribute('data-strategy');
            console.log(`Strategy selected: ${strategy}`);
            
            // Visual feedback
            this.style.transform = 'translateY(-15px)';
            this.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.4)';
            
            setTimeout(() => {
                this.style.transform = 'translateY(-10px)';
                this.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.3)';
            }, 300);
            
            // Show strategy details
            showStrategyDetails(strategy);
        });
        
        // Hover effects
        card.addEventListener('mouseenter', function() {
            this.style.zIndex = '10';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.zIndex = '1';
        });
    });
    
    // Animate confluence score bars
    const scoreFills = document.querySelectorAll('.score-fill');
    scoreFills.forEach(fill => {
        const width = fill.style.width;
        fill.style.width = '0';
        
        setTimeout(() => {
            fill.style.transition = 'width 2s ease-out';
            fill.style.width = width;
        }, 500);
    });
    
    // Animate premium meter
    const meterFill = document.querySelector('.meter-fill');
    if (meterFill) {
        setTimeout(() => {
            meterFill.style.transition = 'width 3s ease-out';
        }, 1000);
    }
    
    // Funding chart animation
    const chartPoints = document.querySelectorAll('.chart-point');
    chartPoints.forEach((point, index) => {
        point.style.opacity = '0';
        point.style.transform = 'translate(-50%, -50%) scale(0)';
        
        setTimeout(() => {
            point.style.transition = 'all 0.8s ease-out';
            point.style.opacity = '1';
            point.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 100 + (index * 200));
    });
    
    // Risk metric animations
    const metricValues = document.querySelectorAll('.metric-value');
    metricValues.forEach((value, index) => {
        const originalText = value.textContent;
        value.textContent = '0';
        
        setTimeout(() => {
            let counter = 0;
            const target = parseFloat(originalText);
            const isPercent = originalText.includes('%');
            const increment = target / 30;
            
            const updateCounter = () => {
                counter += increment;
                if (counter >= target) {
                    value.textContent = originalText;
                } else {
                    value.textContent = isPercent ? 
                        `${Math.round(counter)}%` : 
                        originalText.includes(':') ? originalText : Math.round(counter);
                    setTimeout(updateCounter, 50);
                }
            };
            
            updateCounter();
        }, 1000 + (index * 300));
    });
    
    // EWS workflow animation
    const workflowSteps = document.querySelectorAll('.workflow-step');
    workflowSteps.forEach((step, index) => {
        step.style.opacity = '0';
        step.style.transform = 'translateY(50px)';
        
        setTimeout(() => {
            step.style.transition = 'all 0.8s ease-out';
            step.style.opacity = '1';
            step.style.transform = 'translateY(0)';
        }, 300 + (index * 300));
    });
});

function showStrategyDetails(strategy) {
    // This function can be expanded to show modal or detailed view
    const messages = {
        'reclaim': 'RECLAIM_FAILURE: VWAP rejection strategy activated',
        'distribution': 'DISTRIBUTION_FADE: Fading distribution patterns',
        'hedge': 'HEDGE_FLIP: VWAP flip confirmation strategy',
        'continuation': 'CONTINUATION: Trend continuation strategy',
        'momentum': 'MOMENTUM_BREAKDOWN: Momentum-based breakdown',
        'multitf': 'MULTI_TF_CONFLUENCE: Multi-timeframe analysis',
        'volatility': 'VOLATILITY_EXPANSION: Volatility breakout strategy',
        'derivatives': 'DERIVATIVES_DIVERGENCE: Derivatives analysis strategy'
    };
    
    const statusText = document.getElementById('statusText');
    if (statusText && messages[strategy]) {
        const originalText = statusText.textContent;
        statusText.textContent = messages[strategy];
        statusText.style.color = 'var(--wave-peak)';
        
        setTimeout(() => {
            statusText.textContent = originalText;
            statusText.style.color = '';
        }, 3000);
    }
}

// Touch optimization for product page
if ('ontouchstart' in window) {
    document.addEventListener('touchstart', function() {
        // Add touch-specific optimizations
        const strategyCards = document.querySelectorAll('.strategy-card');
        strategyCards.forEach(card => {
            card.style.cursor = 'pointer';
        });
    }, { passive: true });
}
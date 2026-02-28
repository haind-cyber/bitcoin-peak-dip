---
layout: page
title: EWS Signals Log - Bitcoin PeakDip
description: Real-time Bitcoin Peak and Dip Detection Records
status_text: ANALYSING SIGNALS LOG
---

<!-- Signals Header -->
<div class="signals-header">
    <h1 class="signals-title">EWS Signals Log</h1>
    <p class="signals-subtitle">Real-time Bitcoin Peak and Dip Detection Records</p>
    <div class="signals-badge">
        <i class="fas fa-satellite-dish"></i> LIVE SIGNAL MONITORING
    </div>
</div>

<!-- Bitcoin Price Chart with Signals -->
<section class="chart-section">
    <div class="section-header">
        <h2><i class="fas fa-chart-line"></i> Bitcoin Price Chart with EWS Signals</h2>
        <div class="chart-controls">
            <button class="control-btn" data-timeframe="30d">30D</button>
            <button class="control-btn" data-timeframe="90d">90D</button>
            <button class="control-btn" data-timeframe="180d">180D</button>
            <button class="control-btn" data-timeframe="1y">1Y</button>
            <button class="control-btn" data-timeframe="2y">2Y</button>
            <button class="control-btn active" data-timeframe="all">ALL</button>
        </div>
    </div>
    
    <!-- Chart Stats Row -->
    <div class="chart-stats-row">
        <div class="stat-item">
            <div class="stat-icon-mini">
                <i class="fas fa-mountain"></i>
            </div>
            <div class="stat-content-mini">
                <span class="stat-label-mini">Peak Signals</span>
                <span class="stat-value-mini" id="peakCount">0</span>
            </div>
        </div>
        
        <div class="stat-item">
            <div class="stat-icon-mini">
                <i class="fas fa-water"></i>
            </div>
            <div class="stat-content-mini">
                <span class="stat-label-mini">Dip Signals</span>
                <span class="stat-value-mini" id="dipCount">0</span>
            </div>
        </div>
        
        <div class="stat-item">
            <div class="stat-icon-mini">
                <i class="fas fa-bolt"></i>
            </div>
            <div class="stat-content-mini">
                <span class="stat-label-mini">Total Signals</span>
                <span class="stat-value-mini" id="totalCount">0</span>
            </div>
        </div>
        
        <div class="stat-item noise-accuracy">
            <div class="stat-icon-mini">
                <i class="fas fa-shield-alt"></i>
            </div>
            <div class="stat-content-mini">
                <span class="stat-label-mini">Noise Accuracy Reduce</span>
                <span class="stat-value-mini" id="accuracyRate">98%</span>
            </div>
        </div>
    </div>
    
    <div class="chart-container">
        <canvas id="bitcoinChart"></canvas>
    </div>
    
    <!-- Zoom Toolbar (sẽ được tạo bởi JavaScript) -->
    <div class="zoom-toolbar" style="display: none;" id="zoomToolbar"></div>
    
    <div class="chart-info">
        <div class="info-item">
            <i class="fas fa-info-circle"></i>
            <p>Red markers indicate local peak detection zones. Blue markers indicate local dip detection zones.</p>
        </div>
        <div class="info-item">
            <i class="fas fa-database"></i>
            <p>Data loaded from CSV file and mapped to Bitcoin price chart in real-time.</p>
        </div>
    </div>
</section>

<!-- Signals Log Table -->
<section class="signals-log-section">
    <div class="section-header">
        <h2><i class="fas fa-list-alt"></i> Signals Log</h2>
        <div class="log-controls">
            <div class="filter-controls">
                <button class="filter-btn active" data-filter="all">All Signals</button>
                <button class="filter-btn" data-filter="peak">Peak Only</button>
                <button class="filter-btn" data-filter="dip">Dip Only</button>
                <button class="filter-btn" data-filter="high-confidence">High Confidence</button>
            </div>
            <div class="search-box">
                <i class="fas fa-search"></i>
                <input type="text" id="signalSearch" placeholder="Search signals...">
            </div>
        </div>
    </div>
    
    <div class="mobile-scroll-hint">
        <i class="fas fa-arrows-alt-h"></i> 
        <span class="hint-text">Kéo bảng sang trái/phải để xem đầy đủ thông tin</span>
        <div class="hint-sub">↔️ Nhấn và kéo tại bất kỳ đâu trong bảng</div>
    </div>
    
    <div class="log-container">
        <table class="signals-table" id="signalsTable">
            <thead>
                <tr>
                    <th>
                        <i class="fas fa-calendar"></i>
                        Date & Time
                    </th>
                    <th>
                        <i class="fas fa-bullseye"></i>
                        Signal Type
                    </th>
                    <th>
                        <i class="fas fa-chart-bar"></i>
                        Price
                    </th>
                    <th>
                        <i class="fas fa-tachometer-alt"></i>
                        Confidence
                    </th>
                    <th>
                        <i class="fas fa-check-circle"></i>
                        Validation
                    </th>
                </tr>
            </thead>
            <tbody id="signalsTableBody">
                <!-- Data will be loaded from CSV -->
                <tr class="loading-row">
                    <td colspan="5">
                        <div class="loading-spinner">
                            <i class="fas fa-sync fa-spin"></i>
                            Loading EWS signals from CSV...
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
        
        <div class="pagination">
            <button class="page-btn" id="prevPage" disabled>
                <i class="fas fa-chevron-left"></i> Previous
            </button>
            <div class="page-info">
                Page <span id="currentPage">1</span> of <span id="totalPages">1</span>
            </div>
            <button class="page-btn" id="nextPage" disabled>
                Next <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    </div>
    
    <div class="data-source-info">
        <i class="fas fa-file-csv"></i>
        <p>Data source: <code>assets/data/signals.csv</code> • Last updated: <span id="lastUpdated">Loading...</span></p>
        <button class="refresh-btn" id="refreshData">
            <i class="fas fa-sync-alt"></i> Refresh Data
        </button>
    </div>
</section>

<!-- Signal Details Panel -->
<section class="details-section">
    <h2><i class="fas fa-search"></i> Signal Details</h2>
    <div class="details-container" id="signalDetails">
        <div class="no-selection">
            <i class="fas fa-mouse-pointer"></i>
            <h3>Select a signal from the table</h3>
            <p>Click on any signal in the log table to view detailed analysis and chart position.</p>
        </div>
    </div>
</section>

<!-- Signal Analysis -->
<section class="analysis-section">
    <h2><i class="fas fa-chart-pie"></i> Signal Analysis</h2>
    
    <div class="analysis-grid">
        <div class="analysis-card">
            <h3><i class="fas fa-chart-bar"></i> Distribution by Type</h3>
            <div class="chart-small">
                <canvas id="typeDistributionChart"></canvas>
            </div>
            <div class="analysis-stats">
                <div class="analysis-stat">
                    <span class="stat-label">Peak Signals:</span>
                    <span class="stat-value" id="peakPercentage">0%</span>
                </div>
                <div class="analysis-stat">
                    <span class="stat-label">Dip Signals:</span>
                    <span class="stat-value" id="dipPercentage">0%</span>
                </div>
            </div>
        </div>
        
        <div class="analysis-card">
            <h3><i class="fas fa-tachometer-alt"></i> Confidence Levels</h3>
            <div class="chart-small">
                <canvas id="confidenceChart"></canvas>
            </div>
            <div class="analysis-stats">
                <div class="analysis-stat">
                    <span class="stat-label">High Confidence (80-100%):</span>
                    <span class="stat-value" id="highConfidence">0</span>
                </div>
                <div class="analysis-stat">
                    <span class="stat-label">Medium Confidence (60-79%):</span>
                    <span class="stat-value" id="mediumConfidence">0</span>
                </div>
                <div class="analysis-stat">
                    <span class="stat-label">Low Confidence (<60%):</span>
                    <span class="stat-value" id="lowConfidence">0</span>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- CSV Data Format Info -->
<section class="csv-info-section">
    <h2><i class="fas fa-file-code"></i> CSV Data Format</h2>
    <div class="csv-format">
        <div class="format-example">
            <h3><i class="fas fa-table"></i> Example CSV Structure</h3>
            <pre><code>timestamp,signal_type,price,confidence,validation
2024-01-15T08:30:00,PEAK,45000.50,85,VALIDATED
2024-01-15T12:45:00,DIP,44200.75,92,VALIDATED
2024-01-16T09:15:00,PEAK,45500.25,78,PENDING</code></pre>
        </div>
        
        <div class="format-details">
            <h3><i class="fas fa-info-circle"></i> Field Descriptions</h3>
            <ul>
                <li><strong>timestamp:</strong> ISO 8601 format (YYYY-MM-DDTHH:MM:SS) or M/D/YYYY HH:MM</li>
                <li><strong>signal_type:</strong> PEAK or DIP</li>
                <li><strong>price:</strong> Bitcoin price at signal detection</li>
                <li><strong>confidence:</strong> 0-100 score (higher = more confident)</li>
                <li><strong>validation:</strong> VALIDATED, PENDING, or INVALID</li>
                <li style="color: #ff9800; font-weight: bold; border-left: 3px solid #ff9800; padding-left: 10px; background: rgba(255, 152, 0, 0.1); margin-top: 15px;">
                    <i class="fas fa-code-branch"></i> <strong>UPDATE METHOD:</strong> CSV file can only be updated via Git commits. Place file in <code>assets/data/signals.csv</code>
                </li>
            </ul>
        </div>
    </div>
    
    <div class="csv-actions">
        <a href="{{ '/assets/data/signals.csv' | relative_url }}" class="csv-btn" download>
            <i class="fas fa-download"></i> Download Current CSV
        </a>
        <div class="update-info">
            <i class="fas fa-code-branch"></i>
            <span>CSV updates via Git commit only</span>
        </div>
    </div>
</section>

<!-- Back to Home -->
<div class="back-home">
    <a href="{{ '/' | relative_url }}" class="back-btn">
        <i class="fas fa-arrow-left"></i> Back to Home
    </a>
</div>

<!-- CSV Data Loading Script -->
<script>
// Load CSV data
(function() {
    // Function to fetch CSV with fallback paths
    async function fetchWithFallback(paths) {
        for (const path of paths) {
            try {
                const response = await fetch(`${path}?t=${Date.now()}`, { 
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' }
                });
                if (response.ok) return response;
            } catch (e) {
                console.log(`⚠️ Failed: ${path}`);
            }
        }
        return null;
    }

    // Load both signals and Bitcoin price data
    Promise.all([
        fetchWithFallback([
            '{{ "/assets/data/signals.csv" | relative_url }}',
            './assets/data/signals.csv',
            'assets/data/signals.csv'
        ]),
        fetchWithFallback([
            '{{ "/assets/data/Binance_BTCUSDT_d.csv" | relative_url }}',
            './assets/data/Binance_BTCUSDT_d.csv',
            'assets/data/Binance_BTCUSDT_d.csv'
        ])
    ])
    .then(async ([signalsResponse, bitcoinResponse]) => {
        // Process signals CSV
        if (signalsResponse && signalsResponse.ok) {
            const csvText = await signalsResponse.text();
            window.realCsvData = csvText;
            console.log('✅ Signals CSV loaded successfully');
            console.log('CSV length:', csvText.length, 'characters');
            
            const event = new CustomEvent('csvDataReady', { 
                detail: { csvText: csvText } 
            });
            document.dispatchEvent(event);
        } else {
            console.error('❌ Error loading signals CSV');
            // Show error in table
            const tableBody = document.getElementById('signalsTableBody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr class="no-results">
                        <td colspan="5">
                            <i class="fas fa-exclamation-triangle"></i>
                            <div>Failed to load signals data</div>
                            <small>Please ensure assets/data/signals.csv exists</small>
                        </td>
                    </tr>
                `;
            }
        }
        
        // Process Bitcoin price CSV
        if (bitcoinResponse && bitcoinResponse.ok) {
            const bitcoinCsvText = await bitcoinResponse.text();
            window.bitcoinPriceData = bitcoinCsvText;
            console.log('💰 Bitcoin price CSV loaded successfully');
            
            const bitcoinEvent = new CustomEvent('bitcoinDataReady', { 
                detail: { csvText: bitcoinCsvText } 
            });
            document.dispatchEvent(bitcoinEvent);
        } else {
            console.error('❌ Error loading Bitcoin price CSV');
        }
    })
    .catch(error => {
        console.error('❌ Fatal error loading CSV files:', error);
        
        // Show error in table
        const tableBody = document.getElementById('signalsTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr class="no-results">
                    <td colspan="5">
                        <i class="fas fa-exclamation-triangle"></i>
                        <div class="error-message">Error loading data: ${error.message}</div>
                        <small>Please refresh the page or check console</small>
                    </td>
                </tr>
            `;
        }
    });
})();
</script>

<!-- Global Loading Indicator -->
<div class="loading-indicator" id="globalLoading">
    <i class="fas fa-spinner fa-spin"></i>
    <span>Loading Bitcoin EWS Signals and Real Price Data...</span>
</div>

<script>
// Hide loading indicator when page is ready
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const loading = document.getElementById('globalLoading');
        if (loading) {
            loading.style.opacity = '0';
            setTimeout(() => {
                if (loading.parentNode) {
                    loading.parentNode.removeChild(loading);
                }
            }, 300);
        }
    }, 3000);
});

// Click-to-zoom helper functions
window.closeClickZoomInstructions = function() {
    if (typeof exitClickZoomMode === 'function') {
        exitClickZoomMode();
    }
};

window.resetZoomFromInstructions = function() {
    if (typeof resetZoom === 'function') {
        resetZoom();
        if (typeof updateClickZoomStatus === 'function') {
            updateClickZoomStatus('Đã reset zoom, chờ click lần 1...', 'waiting');
        }
        if (typeof window.clickZoomPoints !== 'undefined') {
            window.clickZoomPoints = [];
        }
    }
};

window.exitClickZoomMode = function() {
    if (typeof exitClickZoomMode === 'function') {
        exitClickZoomMode();
    }
};
</script>

<!-- Add styles for loading indicator and no results -->
<style>
.loading-indicator {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 20px 40px;
    border-radius: 50px;
    display: flex;
    align-items: center;
    gap: 15px;
    z-index: 10000;
    border: 2px solid #00d4ff;
    box-shadow: 0 0 30px rgba(0, 212, 255, 0.3);
    transition: opacity 0.3s ease;
}

.loading-indicator i {
    color: #00d4ff;
    font-size: 1.5em;
}

.no-results {
    text-align: center;
    padding: 40px 20px;
    color: rgba(255,255,255,0.7);
}

.no-results i {
    font-size: 2.5em;
    color: #00d4ff;
    margin-bottom: 15px;
    display: block;
}

.no-results div {
    font-size: 1.2em;
    margin-bottom: 10px;
}

.no-results small {
    color: rgba(255,255,255,0.5);
}

.error-message {
    color: #ff2e63;
}

.data-status-banner {
    position: fixed;
    top: 70px;
    left: 0;
    right: 0;
    background: linear-gradient(to right, #f44336, #ff9800);
    color: white;
    padding: 12px 20px;
    z-index: 9999;
    text-align: center;
    font-weight: bold;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
}

.status-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
}

.retry-btn {
    background: rgba(255,255,255,0.2);
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
    padding: 5px 15px;
    border-radius: 4px;
    cursor: pointer;
}

.retry-btn:hover {
    background: rgba(255,255,255,0.3);
}
</style>
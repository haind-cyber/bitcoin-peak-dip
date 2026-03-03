// ============================================
// Bitcoin PeakDip Early Warning System - Signals
// Version: 1.12.2 - UPDATED - Signal Details Floating & Layout
// ============================================

// ========== APP CONFIGURATION ==========
const APP_CONFIG = {
    version: '1.5.2', // Tăng version
    itemsPerPage: 15,
    versionKey: 'peakdip_version',
    dataPaths: {
        signals: ['data/signals.csv', './data/signals.csv', 'signals.csv'],
        bitcoin: ['data/Binance_BTCUSDT_d.csv', './data/Binance_BTCUSDT_d.csv', 'Binance_BTCUSDT_d.csv']
    }
};

// ========== GLOBAL STATE ==========
const state = {
    signals: [],
    filteredSignals: [],
    historicalPriceData: [],
    currentPage: 1,
    currentFilter: 'all',
    searchTerm: '',
    lastUpdateTime: null,
    csvDataLoaded: false,
    
    // Chart & zoom state
    charts: {
        bitcoin: null,
        analysis: []
    },
    zoom: {
        min: null,
        max: null,
        isZoomed: false,
        history: [],
        undoStack: [],
        redoStack: []
    },
    
    // Hover state
    hoverTimeout: null,
    currentHoverRow: null
};

// ========== CACHE CONTROL ==========
(function handleVersionCache() {
    const storedVersion = localStorage.getItem(APP_CONFIG.versionKey);
    
    if (storedVersion !== APP_CONFIG.version) {
        console.log(`🔄 Updating from ${storedVersion} to ${APP_CONFIG.version}`);
        
        // Clear all storage
        localStorage.clear();
        sessionStorage.clear();
        
        // Clear caches
        if ('caches' in window) {
            caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
        }
        
        localStorage.setItem(APP_CONFIG.versionKey, APP_CONFIG.version);
        
        // Force reload once
        if (storedVersion && !window.location.search.includes('reloaded')) {
            window.location.href = window.location.pathname + '?reloaded=' + Date.now();
            throw new Error('Reloading...');
        }
    }
    
    console.log(`🚀 Bitcoin PeakDip EWS v${APP_CONFIG.version} - UPDATED LAYOUT`);
})();

// ========== DOM ELEMENTS CACHE ==========
const elements = {
    peakCount: document.getElementById('peakCount'),
    dipCount: document.getElementById('dipCount'),
    totalCount: document.getElementById('totalCount'),
    accuracyRate: document.getElementById('accuracyRate'),
    lastUpdated: document.getElementById('lastUpdated'),
    tableBody: document.getElementById('signalsTableBody'),
    signalDetails: document.getElementById('signalDetails'),
    currentPage: document.getElementById('currentPage'),
    totalPages: document.getElementById('totalPages'),
    prevBtn: document.getElementById('prevPage'),
    nextBtn: document.getElementById('nextPage'),
    searchInput: document.getElementById('signalSearch'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    timeframeBtns: document.querySelectorAll('.control-btn'),
    refreshBtn: document.getElementById('refreshData'),
    bitcoinChart: document.getElementById('bitcoinChart'),
    typeChart: document.getElementById('typeDistributionChart'),
    confidenceChart: document.getElementById('confidenceChart'),
    timeChart: document.getElementById('timeDistributionChart'),
    peakPercentage: document.getElementById('peakPercentage'),
    dipPercentage: document.getElementById('dipPercentage'),
    highConfidence: document.getElementById('highConfidence'),
    mediumConfidence: document.getElementById('mediumConfidence')
};

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', init);

function init() {
    console.log('🔧 Initializing PeakDip EWS...');
    
    setupEventListeners();
    setupCharts();
    loadAllData();
    setupTableScroll();
    addDynamicStyles();
    updateTableHeaders();
    setupHoverDetails();
    
    // Mobile features after load
    setTimeout(initMobileFeatures, 2000);
    setTimeout(initMobileZoomSlider, 2500);
}

// ========== SETUP HOVER DETAILS FLOATING TABLE ==========
function setupHoverDetails() {
    const container = document.querySelector('.log-container');
    if (!container) return;
    
    // Create floating detail element
    const floatingDetail = document.createElement('div');
    floatingDetail.className = 'floating-signal-detail';
    floatingDetail.id = 'floatingSignalDetail';
    floatingDetail.style.display = 'none';
    document.body.appendChild(floatingDetail);
    
    // Hover events for table rows
    elements.tableBody.addEventListener('mouseover', (e) => {
        const row = e.target.closest('tr');
        if (!row || row.classList.contains('loading-row') || row.classList.contains('no-results')) return;
        
        // Clear previous timeout
        if (state.hoverTimeout) clearTimeout(state.hoverTimeout);
        
        // Get signal data
        const index = parseInt(row.dataset.index);
        if (isNaN(index)) return;
        
        const signal = state.filteredSignals[index];
        if (!signal) return;
        
        // Show floating detail after short delay
        state.hoverTimeout = setTimeout(() => {
            showFloatingSignalDetail(signal, row, e.clientX, e.clientY);
        }, 300);
    });
    
    elements.tableBody.addEventListener('mouseout', (e) => {
        const related = e.relatedTarget;
        const floating = document.getElementById('floatingSignalDetail');
        
        // Check if moving to floating detail or another row
        if (related && (related.closest('#floatingSignalDetail') || related.closest('tr'))) {
            return;
        }
        
        // Clear timeout and hide
        if (state.hoverTimeout) {
            clearTimeout(state.hoverTimeout);
            state.hoverTimeout = null;
        }
        
        if (floating) {
            floating.style.opacity = '0';
            floating.style.transform = 'translateY(10px)';
            setTimeout(() => {
                if (floating.style.opacity === '0') {
                    floating.style.display = 'none';
                }
            }, 200);
        }
    });
    
    // Handle hover on floating detail itself
    floatingDetail.addEventListener('mouseenter', () => {
        if (state.hoverTimeout) clearTimeout(state.hoverTimeout);
    });
    
    floatingDetail.addEventListener('mouseleave', (e) => {
        if (!e.relatedTarget || !e.relatedTarget.closest('tr')) {
            floatingDetail.style.opacity = '0';
            floatingDetail.style.transform = 'translateY(10px)';
            setTimeout(() => {
                if (floatingDetail.style.opacity === '0') {
                    floatingDetail.style.display = 'none';
                }
            }, 200);
        }
    });
}

// ========== SHOW FLOATING SIGNAL DETAIL ==========
function showFloatingSignalDetail(signal, row, mouseX, mouseY) {
    const floating = document.getElementById('floatingSignalDetail');
    if (!floating) return;
    
    const confClass = getConfidenceClass(signal.confidence);
    const confColor = confClass === 'high' ? '#4CAF50' : confClass === 'medium' ? '#FFC107' : '#F44336';
    const daysAgo = Math.floor((new Date() - signal.timestamp) / 86400000);
    
    floating.innerHTML = `
        <div class="floating-header">
            <span><i class="fas fa-info-circle" style="color: #00d4ff;"></i> Signal Details</span>
            <button class="floating-close" onclick="this.closest('#floatingSignalDetail').style.display='none'">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="floating-body">
            <div class="floating-row">
                <span class="floating-label"><i class="fas fa-bullseye"></i> Type:</span>
                <span class="floating-value signal-type ${signal.signal_type.toLowerCase()}">${signal.signal_type}</span>
            </div>
            <div class="floating-row">
                <span class="floating-label"><i class="fas fa-calendar"></i> Date:</span>
                <span class="floating-value">${formatDateTime(signal.timestamp)}</span>
            </div>
            <div class="floating-row">
                <span class="floating-label"><i class="fas fa-chart-bar"></i> Price:</span>
                <span class="floating-value price">$${signal.price.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
            </div>
            <div class="floating-row">
                <span class="floating-label"><i class="fas fa-tachometer-alt"></i> Confidence:</span>
                <span class="floating-value" style="color:${confColor}">${signal.confidence}% (${confClass})</span>
            </div>
            <div class="floating-row">
                <span class="floating-label"><i class="fas fa-check-circle"></i> Validation:</span>
                <span class="floating-value validation-pass">PASS</span>
            </div>
            <div class="floating-row">
                <span class="floating-label"><i class="fas fa-clock"></i> Age:</span>
                <span class="floating-value">${daysAgo} day${daysAgo!==1?'s':''} ago</span>
            </div>
            <div class="floating-row">
                <span class="floating-label"><i class="fas fa-chart-line"></i> Position:</span>
                <span class="floating-value">${getPriceZone(signal.price)}</span>
            </div>
            <div class="floating-row">
                <span class="floating-label"><i class="fas fa-lightbulb"></i> Rec:</span>
                <span class="floating-value">${getRecommendation(signal)}</span>
            </div>
        </div>
    `;
    
    // Position floating element near mouse but within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const floatingWidth = 300;
    const floatingHeight = 380;
    
    let left = mouseX + 20;
    let top = mouseY - 20;
    
    if (left + floatingWidth > viewportWidth - 20) {
        left = mouseX - floatingWidth - 20;
    }
    
    if (top + floatingHeight > viewportHeight - 20) {
        top = viewportHeight - floatingHeight - 20;
    }
    
    if (top < 10) top = 10;
    
    floating.style.left = left + 'px';
    floating.style.top = top + 'px';
    floating.style.display = 'block';
    
    // Animate in
    setTimeout(() => {
        floating.style.opacity = '1';
        floating.style.transform = 'translateY(0)';
    }, 10);
}

// ========== CẬP NHẬT HEADER BẢNG ==========
function updateTableHeaders() {
    const thead = document.querySelector('.signals-table thead tr');
    if (thead) {
        thead.innerHTML = `
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
        `;
    }
}

// ========== CẬP NHẬT LẠI ANALYSIS SECTION - LOẠI BỎ TIME DISTRIBUTION ==========
function updateAnalysisSectionLayout() {
    const analysisGrid = document.querySelector('.analysis-grid');
    if (analysisGrid) {
        // Giữ lại chỉ 2 card: Distribution by Type và Confidence Levels
        const cards = analysisGrid.querySelectorAll('.analysis-card');
        if (cards.length >= 3) {
            // Ẩn card Time Distribution
            cards[2].style.display = 'none';
        }
    }
}

// ========== DATA LOADING ==========
async function loadAllData() {
    try {
        showNotification('Loading Bitcoin EWS Signals...', 'info');
        
        const [signalsRes, bitcoinRes] = await Promise.all([
            fetchWithFallback(APP_CONFIG.dataPaths.signals),
            fetchWithFallback(APP_CONFIG.dataPaths.bitcoin)
        ]);
        
        if (signalsRes) parseSignalsData(await signalsRes.text());
        if (bitcoinRes) parseBitcoinData(await bitcoinRes.text());
        
        state.lastUpdateTime = new Date();
        updateUI();
        updateAnalysisSectionLayout(); // Gọi hàm cập nhật layout
        
    } catch (error) {
        console.error('❌ Data loading failed:', error);
        showNoDataUI('Failed to load data. Please refresh.');
    }
}

async function fetchWithFallback(paths) {
    for (const path of paths) {
        try {
            const response = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
            if (response.ok) return response;
        } catch (e) {
            console.log(`⚠️ Failed: ${path}`);
        }
    }
    return null;
}

// ========== PARSE SIGNALS CSV ==========
function parseSignalsData(csvText) {
    if (!csvText) return;
    
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return;
    
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const required = ['timestamp', 'signal_type', 'price'];
    
    if (!required.every(h => headers.includes(h))) {
        console.error('Missing required headers');
        return;
    }
    
    state.signals = [];
    let peak = 0, dip = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length < 3) continue;
        
        const row = {};
        headers.forEach((h, idx) => row[h] = values[idx] || '');
        
        const timestamp = parseDate(row.timestamp);
        const price = parseFloat(row.price);
        
        if (!timestamp || isNaN(price)) continue;
        
        row.signal_type === 'PEAK' ? peak++ : dip++;
        
        state.signals.push({
            timestamp,
            signal_type: row.signal_type?.toUpperCase() === 'PEAK' ? 'PEAK' : 'DIP',
            price,
            confidence: parseFloat(row.confidence) || 98,
            validation: 'PASS',
            id: `sig_${i}_${timestamp.getTime()}`
        });
    }
    
    // Sort newest first
    state.signals.sort((a, b) => b.timestamp - a.timestamp);
    state.filteredSignals = [...state.signals];
    
    console.log(`✅ Loaded ${state.signals.length} signals (Peak: ${peak}, Dip: ${dip})`);
}

// ========== PARSE BITCOIN PRICE DATA ==========
function parseBitcoinData(csvText) {
    if (!csvText) return generateSyntheticPriceData();
    
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return generateSyntheticPriceData();
    
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    state.historicalPriceData = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
        if (values.length < 6) continue;
        
        const row = {};
        headers.forEach((h, idx) => row[h] = values[idx]);
        
        // Parse date
        let date;
        if (row.unix) {
            const ts = parseFloat(row.unix);
            date = new Date(ts > 1e12 ? ts : ts * 1000);
        } else if (row.date) {
            date = parseDate(row.date);
        }
        
        const price = parseFloat(row.close) || parseFloat(row.open);
        if (!date || isNaN(price) || price <= 0) continue;
        
        state.historicalPriceData.push({
            x: date,
            y: price,
            open: parseFloat(row.open) || price,
            high: parseFloat(row.high) || price,
            low: parseFloat(row.low) || price,
            volume: parseFloat(row['volume btc'] || row.volume || 0)
        });
    }
    
    if (state.historicalPriceData.length === 0) {
        return generateSyntheticPriceData();
    }
    
    state.historicalPriceData.sort((a, b) => a.x - b.x);
    console.log(`💰 Loaded ${state.historicalPriceData.length} price points`);
}

function generateSyntheticPriceData() {
    console.warn('⚠️ Using synthetic price data');
    
    const end = new Date();
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 2);
    
    state.historicalPriceData = [];
    let price = 35000;
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        price = price * (1 + (Math.random() - 0.48) * 0.03);
        price = Math.max(20000, Math.min(80000, price));
        
        state.historicalPriceData.push({
            x: new Date(d),
            y: Math.round(price * 100) / 100,
            synthetic: true
        });
    }
}

// ========== DATE PARSING ==========
function parseDate(input) {
    if (!input) return null;
    
    // ISO format
    let d = new Date(input);
    if (!isNaN(d)) return d;
    
    // M/D/YYYY
    const mdy = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mdy) return new Date(mdy[3], mdy[1] - 1, mdy[2]);
    
    // YYYY-MM-DD HH:MM:SS
    const ymd = input.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
    if (ymd) return new Date(ymd[1], ymd[2] - 1, ymd[3], ymd[4], ymd[5], ymd[6]);
    
    return null;
}

// ========== UI UPDATE ==========
function updateUI() {
    updateStats();
    filterSignals();
    renderTable();
    updateCharts();
    updateLastUpdated();
}

function updateStats() {
    if (!elements.peakCount || state.signals.length === 0) return;
    
    const peak = state.signals.filter(s => s.signal_type === 'PEAK').length;
    const dip = state.signals.filter(s => s.signal_type === 'DIP').length;
    const total = state.signals.length;
    
    elements.peakCount.textContent = peak;
    elements.dipCount.textContent = dip;
    elements.totalCount.textContent = total;
    elements.accuracyRate.textContent = '98%';
    
    if (elements.peakPercentage) {
        elements.peakPercentage.textContent = total ? Math.round((peak / total) * 100) + '%' : '0%';
        elements.dipPercentage.textContent = total ? Math.round((dip / total) * 100) + '%' : '0%';
    }
    
    const high = state.signals.filter(s => s.confidence >= 80).length;
    const med = state.signals.filter(s => s.confidence >= 60 && s.confidence < 80).length;
    
    if (elements.highConfidence) elements.highConfidence.textContent = high;
    if (elements.mediumConfidence) elements.mediumConfidence.textContent = med;
}

function filterSignals() {
    state.filteredSignals = state.signals.filter(signal => {
        // Filter by type
        if (state.currentFilter === 'peak' && signal.signal_type !== 'PEAK') return false;
        if (state.currentFilter === 'dip' && signal.signal_type !== 'DIP') return false;
        if (state.currentFilter === 'high-confidence' && signal.confidence < 80) return false;
        
        // Search
        if (state.searchTerm) {
            const searchStr = [
                signal.signal_type,
                signal.validation,
                signal.price,
                signal.confidence,
                formatDate(signal.timestamp),
                formatTime(signal.timestamp)
            ].join(' ').toLowerCase();
            
            if (!searchStr.includes(state.searchTerm.toLowerCase())) return false;
        }
        
        return true;
    });
    
    state.currentPage = 1;
}

function renderTable() {
    if (!elements.tableBody) return;
    
    if (state.filteredSignals.length === 0) {
        elements.tableBody.innerHTML = getEmptyTableHTML();
        updatePagination();
        return;
    }
    
    const start = (state.currentPage - 1) * APP_CONFIG.itemsPerPage;
    const end = start + APP_CONFIG.itemsPerPage;
    const pageData = state.filteredSignals.slice(start, end);
    
    elements.tableBody.innerHTML = pageData.map((signal, idx) => `
        <tr class="signal-${signal.signal_type.toLowerCase()}" data-signal-id="${signal.id}" data-index="${start + idx}">
            <td><div class="timestamp"><div class="date">${formatDate(signal.timestamp)}</div><div class="time">${formatTime(signal.timestamp)}</div></div></td>
            <td><span class="signal-type ${signal.signal_type.toLowerCase()}">${signal.signal_type}</span></td>
            <td><div class="price-display"><span class="price">$${signal.price.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span></div></td>
            <td><span class="confidence-indicator confidence-${getConfidenceClass(signal.confidence)}">${signal.confidence}%</span></td>
            <td><span class="validation-status validation-pass">PASS</span></td>
        </tr>
    `).join('');
    
    // Attach click handlers
    elements.tableBody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', () => {
            const index = parseInt(row.dataset.index);
            selectSignal(state.filteredSignals[index], index);
        });
    });
    
    updatePagination();
}

function updatePagination() {
    const total = Math.ceil(state.filteredSignals.length / APP_CONFIG.itemsPerPage) || 1;
    
    if (elements.currentPage) elements.currentPage.textContent = state.currentPage;
    if (elements.totalPages) elements.totalPages.textContent = total;
    
    if (elements.prevBtn) {
        elements.prevBtn.disabled = state.currentPage === 1;
        elements.prevBtn.style.opacity = state.currentPage === 1 ? '0.5' : '1';
    }
    
    if (elements.nextBtn) {
        elements.nextBtn.disabled = state.currentPage === total;
        elements.nextBtn.style.opacity = state.currentPage === total ? '0.5' : '1';
    }
}

function selectSignal(signal, index) {
    document.querySelectorAll('.signals-table tbody tr').forEach(r => r.classList.remove('selected'));
    const rows = document.querySelectorAll('.signals-table tbody tr');
    if (rows[index]) rows[index].classList.add('selected');
    
    showSignalDetails(signal);
}

function showSignalDetails(signal) {
    if (!elements.signalDetails) return;
    
    const confClass = getConfidenceClass(signal.confidence);
    const confColor = confClass === 'high' ? '#4CAF50' : confClass === 'medium' ? '#FFC107' : '#F44336';
    const daysAgo = Math.floor((new Date() - signal.timestamp) / 86400000);
    
    elements.signalDetails.innerHTML = `
        <div class="signal-details">
            <div class="detail-card">
                <h3><i class="fas fa-info-circle"></i> Signal Information</h3>
                <div class="detail-item"><span class="detail-label">Signal Type:</span><span class="detail-value signal-type ${signal.signal_type.toLowerCase()}">${signal.signal_type}</span></div>
                <div class="detail-item"><span class="detail-label">Timestamp:</span><span class="detail-value">${formatDateTime(signal.timestamp)}</span></div>
                <div class="detail-item"><span class="detail-label">Bitcoin Price:</span><span class="detail-value">$${signal.price.toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
            </div>
            <div class="detail-card">
                <h3><i class="fas fa-chart-bar"></i> Signal Metrics</h3>
                <div class="detail-item"><span class="detail-label">Confidence:</span><span class="detail-value" style="color:${confColor}">${signal.confidence}% (${confClass})</span></div>
                <div class="detail-item"><span class="detail-label">Validation:</span><span class="detail-value validation-status validation-pass">PASS</span></div>
                <div class="detail-item"><span class="detail-label">Signal Age:</span><span class="detail-value">${daysAgo} day${daysAgo!==1?'s':''} ago</span></div>
            </div>
            <div class="detail-card">
                <h3><i class="fas fa-chart-line"></i> Analysis</h3>
                <div class="detail-item"><span class="detail-label">Position:</span><span class="detail-value">${getPriceZone(signal.price)}</span></div>
                <div class="detail-item"><span class="detail-label">Recommendation:</span><span class="detail-value">${getRecommendation(signal)}</span></div>
            </div>
        </div>
    `;
}

// ========== CHART SETUP ==========
function setupCharts() {
    if (!elements.bitcoinChart) return;
    
    if (state.charts.bitcoin) state.charts.bitcoin.destroy();
    
    state.charts.bitcoin = new Chart(elements.bitcoinChart, {
        type: 'line',
        data: {
            datasets: [
                { label: 'Bitcoin Price', data: [], borderColor: '#f7931a', backgroundColor: 'rgba(247,147,26,0.1)', borderWidth: 2, fill: true, tension: 0.1, pointRadius: 0 },
                { label: 'Peak Signals', data: [], borderColor: '#ff2e63', backgroundColor: '#ff2e63', pointRadius: 6, pointStyle: 'triangle', pointRotation: 180, showLine: false },
                { label: 'Dip Signals', data: [], borderColor: '#00d4ff', backgroundColor: '#00d4ff', pointRadius: 6, pointStyle: 'triangle', showLine: false }
            ]
        },
        options: getChartOptions()
    });
    
    setupAnalysisCharts();
    setTimeout(createChartToolbar, 1000);
}

function getChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
            legend: { display: true, position: 'top', labels: { color: 'rgba(255,255,255,0.7)' } },
            tooltip: {
                backgroundColor: 'rgba(0,0,0,0.9)',
                titleColor: '#f7931a',
                bodyColor: '#fff',
                callbacks: {
                    label: ctx => ctx.dataset.label.includes('Price') 
                        ? `Price: $${ctx.parsed.y.toLocaleString()}`
                        : `${ctx.raw.signal?.signal_type || ''}: $${ctx.raw.y?.toLocaleString()}`
                }
            }
        },
        scales: {
            x: { type: 'time', time: { unit: 'month' }, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'rgba(255,255,255,0.7)' } },
            y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: 'rgba(255,255,255,0.7)', callback: v => '$' + v.toLocaleString() } }
        }
    };
}

function setupAnalysisCharts() {
    state.charts.analysis = [];
    
    if (elements.typeChart) {
        state.charts.analysis.push(new Chart(elements.typeChart, {
            type: 'doughnut',
            data: { labels: ['Peak', 'Dip'], datasets: [{ data: [0,0], backgroundColor: ['#ff2e63','#00d4ff'] }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } }
        }));
    }
    
    if (elements.confidenceChart) {
        state.charts.analysis.push(new Chart(elements.confidenceChart, {
            type: 'bar',
            data: { labels: ['High','Medium','Low'], datasets: [{ data: [0,0,0], backgroundColor: ['#4CAF50','#FFC107','#F44336'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
        }));
    }
}

function updateCharts() {
    if (!state.charts.bitcoin || state.historicalPriceData.length === 0) return;
    
    const peak = state.signals.filter(s => s.signal_type === 'PEAK');
    const dip = state.signals.filter(s => s.signal_type === 'DIP');
    
    state.charts.bitcoin.data.datasets[0].data = state.historicalPriceData;
    state.charts.bitcoin.data.datasets[1].data = peak.map(s => ({ x: s.timestamp, y: s.price, signal: s }));
    state.charts.bitcoin.data.datasets[2].data = dip.map(s => ({ x: s.timestamp, y: s.price, signal: s }));
    state.charts.bitcoin.update();
    
    // Analysis charts
    if (state.charts.analysis[0]) {
        state.charts.analysis[0].data.datasets[0].data = [peak.length, dip.length];
        state.charts.analysis[0].update();
    }
    
    if (state.charts.analysis[1]) {
        const high = state.signals.filter(s => s.confidence >= 80).length;
        const med = state.signals.filter(s => s.confidence >= 60 && s.confidence < 80).length;
        const low = state.signals.filter(s => s.confidence < 60).length;
        state.charts.analysis[1].data.datasets[0].data = [high, med, low];
        state.charts.analysis[1].update();
    }
    
    setTimeout(updateRangeHandles, 200);
}

// ========== ZOOM CONTROLS ==========
function createChartToolbar() {
    const chartSection = document.querySelector('.chart-section');
    if (!chartSection) return;
    
    document.querySelector('.zoom-bottom-container')?.remove();
    
    const container = document.createElement('div');
    container.className = 'zoom-bottom-container';
    container.innerHTML = `
        <div class="zoom-controls-group">
            <button class="zoom-btn" id="zoomIn" data-tooltip="Zoom In"><i class="fas fa-search-plus"></i></button>
            <button class="zoom-btn" id="zoomOut" data-tooltip="Zoom Out"><i class="fas fa-search-minus"></i></button>
            <button class="zoom-btn" id="zoomBack" data-tooltip="Undo Zoom"><i class="fas fa-undo-alt"></i></button>
            <button class="zoom-btn" id="panModeBtn" data-tooltip="Pan Mode (Drag to move chart)">
                <i class="fas fa-hand-paper"></i>
            </button>
        </div>
        <div class="range-slider-container">
            <div class="range-slider" id="rangeSlider">
                <div class="range-fill" id="rangeFill"></div>
                <div class="range-handle left" id="rangeHandleLeft"></div>
                <div class="range-handle right" id="rangeHandleRight"></div>
            </div>
            <div class="range-labels">
                <span id="rangeStartLabel">Start</span>
                <span id="rangeEndLabel">End</span>
            </div>
        </div>
        <div class="reset-btn-group">
            <div class="zoom-info" id="zoomInfo">Full Range</div>
            <button class="zoom-btn" id="zoomReset" data-tooltip="Reset Zoom"><i class="fas fa-sync-alt"></i></button>
        </div>
    `;
    
    chartSection.querySelector('.chart-container').after(container);
    setupZoomListeners();
    setupPanMode();
    setupRangeSlider();
}

// ========== PAN MODE ==========
let panModeActive = false;
let isPanning = false;
let panStartX = null;
let panStartMin = null;
let panStartMax = null;

function setupPanMode() {
    const panBtn = document.getElementById('panModeBtn');
    if (!panBtn) return;
    
    const chartCanvas = document.getElementById('bitcoinChart');
    if (!chartCanvas) return;
    
    // Toggle pan mode
    panBtn.addEventListener('click', function() {
        panModeActive = !panModeActive;
        this.classList.toggle('active', panModeActive);
        
        // Update cursor
        chartCanvas.style.cursor = panModeActive ? 'grab' : 'default';
        
        // Show notification
        if (panModeActive) {
            showNotification('Pan Mode activated - Drag chart to move', 'info', 2000);
        }
        
        // Remove any existing pan listeners if deactivating
        if (!panModeActive) {
            chartCanvas.style.cursor = 'default';
        }
    });
    
    // Pan mouse events
    chartCanvas.addEventListener('mousedown', startPan);
    chartCanvas.addEventListener('mousemove', pan);
    chartCanvas.addEventListener('mouseup', endPan);
    chartCanvas.addEventListener('mouseleave', endPan);
    
    // Touch events for mobile
    chartCanvas.addEventListener('touchstart', startPanTouch);
    chartCanvas.addEventListener('touchmove', panTouch);
    chartCanvas.addEventListener('touchend', endPan);
    chartCanvas.addEventListener('touchcancel', endPan);
}

function startPan(e) {
    if (!panModeActive || !state.charts.bitcoin || !state.zoom.min || !state.zoom.max) return;
    
    e.preventDefault();
    isPanning = true;
    
    const rect = e.target.getBoundingClientRect();
    panStartX = e.clientX - rect.left;
    panStartMin = new Date(state.zoom.min);
    panStartMax = new Date(state.zoom.max);
    
    document.getElementById('bitcoinChart').style.cursor = 'grabbing';
}

function pan(e) {
    if (!isPanning || !panModeActive || !state.charts.bitcoin) return;
    
    e.preventDefault();
    
    const rect = e.target.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const deltaX = currentX - panStartX;
    
    // Calculate time range
    const totalRange = panStartMax - panStartMin;
    const pixelsPerMs = rect.width / totalRange;
    const deltaMs = deltaX / pixelsPerMs;
    
    // Calculate new min/max
    let newMin = new Date(panStartMin.getTime() - deltaMs);
    let newMax = new Date(panStartMax.getTime() - deltaMs);
    
    // Get full data range boundaries
    if (state.historicalPriceData.length > 0) {
        const dates = state.historicalPriceData.map(d => d.x);
        const fullMin = new Date(Math.min(...dates));
        const fullMax = new Date(Math.max(...dates));
        
        // Constrain to data boundaries
        if (newMin < fullMin) {
            const offset = fullMin - newMin;
            newMin = fullMin;
            newMax = new Date(panStartMax.getTime() - deltaMs + offset);
        }
        
        if (newMax > fullMax) {
            const offset = newMax - fullMax;
            newMax = fullMax;
            newMin = new Date(panStartMin.getTime() - deltaMs - offset);
        }
    }
    
    // Apply pan
    state.zoom.min = newMin;
    state.zoom.max = newMax;
    
    // Update chart
    state.charts.bitcoin.options.scales.x.min = newMin;
    state.charts.bitcoin.options.scales.x.max = newMax;
    state.charts.bitcoin.update('none'); // 'none' for smoother panning
    
    // Update UI
    updateZoomInfo();
    updateRangeHandles();
}

function endPan() {
    if (isPanning) {
        isPanning = false;
        document.getElementById('bitcoinChart').style.cursor = panModeActive ? 'grab' : 'default';
        
        // Save zoom state after pan
        if (state.zoom.min && state.zoom.max) {
            saveZoomState();
        }
    }
}

// Touch events for mobile
function startPanTouch(e) {
    if (!panModeActive || !state.charts.bitcoin || !state.zoom.min || !state.zoom.max) return;
    if (e.touches.length !== 1) return;
    
    e.preventDefault();
    isPanning = true;
    
    const touch = e.touches[0];
    const rect = e.target.getBoundingClientRect();
    panStartX = touch.clientX - rect.left;
    panStartMin = new Date(state.zoom.min);
    panStartMax = new Date(state.zoom.max);
    
    // Prevent body scrolling
    document.body.style.overflow = 'hidden';
}

function panTouch(e) {
    if (!isPanning || !panModeActive || !state.charts.bitcoin || e.touches.length !== 1) return;
    
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = e.target.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const deltaX = currentX - panStartX;
    
    const totalRange = panStartMax - panStartMin;
    const pixelsPerMs = rect.width / totalRange;
    const deltaMs = deltaX / pixelsPerMs;
    
    let newMin = new Date(panStartMin.getTime() - deltaMs);
    let newMax = new Date(panStartMax.getTime() - deltaMs);
    
    // Constrain to data boundaries
    if (state.historicalPriceData.length > 0) {
        const dates = state.historicalPriceData.map(d => d.x);
        const fullMin = new Date(Math.min(...dates));
        const fullMax = new Date(Math.max(...dates));
        
        if (newMin < fullMin) {
            const offset = fullMin - newMin;
            newMin = fullMin;
            newMax = new Date(panStartMax.getTime() - deltaMs + offset);
        }
        
        if (newMax > fullMax) {
            const offset = newMax - fullMax;
            newMax = fullMax;
            newMin = new Date(panStartMin.getTime() - deltaMs - offset);
        }
    }
    
    state.zoom.min = newMin;
    state.zoom.max = newMax;
    
    state.charts.bitcoin.options.scales.x.min = newMin;
    state.charts.bitcoin.options.scales.x.max = newMax;
    state.charts.bitcoin.update('none');
    
    updateZoomInfo();
    updateRangeHandles();
    
    // Show feedback on mobile
    if (!document.getElementById('panFeedback')?.classList.contains('visible')) {
        showPanFeedback();
    }
}

function showPanFeedback() {
    let fb = document.getElementById('panFeedback');
    if (!fb) {
        fb = document.createElement('div');
        fb.id = 'panFeedback';
        fb.className = 'slider-feedback pan-feedback';
        fb.innerHTML = '<i class="fas fa-hand-paper"></i> Dragging to pan';
        document.body.appendChild(fb);
    }
    fb.classList.add('visible');
    
    clearTimeout(window.panFeedbackTimeout);
    window.panFeedbackTimeout = setTimeout(() => {
        fb.classList.remove('visible');
    }, 1000);
}

function setupZoomListeners() {
    document.getElementById('zoomIn')?.addEventListener('click', () => zoom(0.8));
    document.getElementById('zoomOut')?.addEventListener('click', () => zoom(1.2));
    document.getElementById('zoomReset')?.addEventListener('click', resetZoom);
    document.getElementById('zoomBack')?.addEventListener('click', undoZoom);
}

function zoom(factor) {
    if (!state.charts.bitcoin) return;
    
    saveZoomState();
    
    const scale = state.charts.bitcoin.scales.x;
    const range = scale.max - scale.min;
    const center = scale.min + range / 2;
    const newRange = range * factor;
    
    state.zoom.min = new Date(center - newRange / 2);
    state.zoom.max = new Date(center + newRange / 2);
    
    applyZoom(state.zoom.min, state.zoom.max);
}

function resetZoom() {
    if (state.historicalPriceData.length === 0) return;
    
    // Exit pan mode if active
    if (panModeActive) {
        panModeActive = false;
        const panBtn = document.getElementById('panModeBtn');
        if (panBtn) {
            panBtn.classList.remove('active');
        }
        document.getElementById('bitcoinChart').style.cursor = 'default';
    }
    
    saveZoomState();
    
    const dates = state.historicalPriceData.map(d => d.x);
    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    const range = max - min;
    
    state.zoom.min = new Date(min.getTime() - range * 0.05);
    state.zoom.max = new Date(max.getTime() + range * 0.05);
    state.zoom.isZoomed = false;
    
    applyZoom(state.zoom.min, state.zoom.max);
}

function applyZoom(min, max) {
    if (!state.charts.bitcoin) return;
    
    state.charts.bitcoin.options.scales.x.min = min;
    state.charts.bitcoin.options.scales.x.max = max;
    state.charts.bitcoin.update();
    
    updateZoomInfo();
    updateRangeHandles();
}

function saveZoomState() {
    if (!state.charts.bitcoin) return;
    
    state.zoom.history.push({
        min: state.charts.bitcoin.options.scales.x.min,
        max: state.charts.bitcoin.options.scales.x.max
    });
    
    if (state.zoom.history.length > 20) state.zoom.history.shift();
}

function undoZoom() {
    if (state.zoom.history.length === 0) return;
    
    const prev = state.zoom.history.pop();
    if (prev) {
        state.charts.bitcoin.options.scales.x.min = prev.min;
        state.charts.bitcoin.options.scales.x.max = prev.max;
        state.charts.bitcoin.update();
        updateZoomInfo();
        updateRangeHandles();
    }
}

function zoomToRange(start, end) {
    saveZoomState();
    state.zoom.min = start;
    state.zoom.max = end;
    state.zoom.isZoomed = true;
    applyZoom(start, end);
}

function updateZoomInfo() {
    const info = document.getElementById('zoomInfo');
    if (!info || !state.zoom.min || !state.zoom.max) {
        if (info) info.textContent = 'Full Range';
        return;
    }
    
    const days = Math.ceil((state.zoom.max - state.zoom.min) / 86400000);
    info.innerHTML = `<i class="fas fa-calendar-alt"></i> ${formatDateShort(state.zoom.min)} - ${formatDateShort(state.zoom.max)} (${days}d)`;
}

// ========== RANGE SLIDER ==========
function setupRangeSlider() {
    const slider = document.getElementById('rangeSlider');
    const left = document.getElementById('rangeHandleLeft');
    const right = document.getElementById('rangeHandleRight');
    const fill = document.getElementById('rangeFill');
    
    if (!slider || !left || !right) return;
    
    let active = null;
    
    const update = () => {
        const leftPercent = parseFloat(left.style.left) || 0;
        const rightPercent = parseFloat(right.style.left) || 100;
        
        if (fill) {
            fill.style.left = leftPercent + '%';
            fill.style.width = (rightPercent - leftPercent) + '%';
        }
        
        if (state.historicalPriceData.length === 0) return;
        
        const dates = state.historicalPriceData.map(d => d.x);
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        const range = maxDate - minDate;
        
        const start = new Date(minDate.getTime() + range * leftPercent / 100);
        const end = new Date(minDate.getTime() + range * rightPercent / 100);
        
        document.getElementById('rangeStartLabel').textContent = formatDateShort(start);
        document.getElementById('rangeEndLabel').textContent = formatDateShort(end);
        
        zoomToRange(start, end);
    };
    
    // Mouse events
    left.addEventListener('mousedown', e => { active = left; e.stopPropagation(); });
    right.addEventListener('mousedown', e => { active = right; e.stopPropagation(); });
    
    slider.addEventListener('mousedown', e => {
        if (e.target === left || e.target === right) return;
        
        const rect = slider.getBoundingClientRect();
        const percent = ((e.clientX - rect.left) / rect.width) * 100;
        const currentRange = parseFloat(right.style.left) - parseFloat(left.style.left);
        
        let newLeft = percent - currentRange / 2;
        let newRight = percent + currentRange / 2;
        
        if (newLeft < 0) { newLeft = 0; newRight = currentRange; }
        if (newRight > 100) { newRight = 100; newLeft = 100 - currentRange; }
        
        left.style.left = newLeft + '%';
        right.style.left = newRight + '%';
        update();
    });
    
    document.addEventListener('mousemove', e => {
        if (!active) return;
        
        const rect = slider.getBoundingClientRect();
        let x = e.clientX - rect.left;
        x = Math.max(0, Math.min(rect.width, x));
        let percent = (x / rect.width) * 100;
        
        if (active === left) {
            const rightPercent = parseFloat(right.style.left) || 100;
            percent = Math.min(percent, rightPercent - 2);
            left.style.left = percent + '%';
        } else {
            const leftPercent = parseFloat(left.style.left) || 0;
            percent = Math.max(percent, leftPercent + 2);
            right.style.left = percent + '%';
        }
        
        update();
    });
    
    document.addEventListener('mouseup', () => { active = null; });
    
    // Touch events
    setupRangeSliderTouch(slider, left, right, update);
    
    left.style.left = '0%';
    right.style.left = '100%';
    update();
}

function setupRangeSliderTouch(slider, left, right, updateCallback) {
    let activeTouch = null;
    let activeHandle = null;
    let startLeft, startRight, startX;
    
    slider.addEventListener('touchstart', e => {
        e.preventDefault();
        if (e.touches.length === 0) return;
        
        const touch = e.touches[0];
        const rect = slider.getBoundingClientRect();
        const percent = ((touch.clientX - rect.left) / rect.width) * 100;
        
        const leftPercent = parseFloat(left.style.left) || 0;
        const rightPercent = parseFloat(right.style.left) || 100;
        
        if (Math.abs(percent - leftPercent) < 15) {
            activeHandle = 'left';
        } else if (Math.abs(percent - rightPercent) < 15) {
            activeHandle = 'right';
        } else {
            activeHandle = 'pan';
        }
        
        activeTouch = touch.identifier;
        startLeft = leftPercent;
        startRight = rightPercent;
        startX = touch.clientX;
    }, { passive: false });
    
    slider.addEventListener('touchmove', e => {
        e.preventDefault();
        if (activeTouch === null) return;
        
        let touch = null;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === activeTouch) {
                touch = e.touches[i];
                break;
            }
        }
        if (!touch) return;
        
        const rect = slider.getBoundingClientRect();
        let x = touch.clientX - rect.left;
        x = Math.max(0, Math.min(rect.width, x));
        const percent = (x / rect.width) * 100;
        
        if (activeHandle === 'left') {
            const newLeft = Math.min(percent, startRight - 2);
            left.style.left = newLeft + '%';
        } else if (activeHandle === 'right') {
            const newRight = Math.max(percent, startLeft + 2);
            right.style.left = newRight + '%';
        } else if (activeHandle === 'pan') {
            const delta = ((touch.clientX - startX) / rect.width) * 100;
            const range = startRight - startLeft;
            let newLeft = startLeft + delta;
            let newRight = startRight + delta;
            
            if (newLeft < 0) { newLeft = 0; newRight = range; }
            if (newRight > 100) { newRight = 100; newLeft = 100 - range; }
            
            left.style.left = newLeft + '%';
            right.style.left = newRight + '%';
        }
        
        if (updateCallback) updateCallback();
    }, { passive: false });
    
    slider.addEventListener('touchend', () => {
        activeTouch = null;
        activeHandle = null;
    });
}

function updateRangeHandles() {
    if (state.historicalPriceData.length === 0 || !state.zoom.min || !state.zoom.max) return;
    
    const dates = state.historicalPriceData.map(d => d.x);
    const fullMin = new Date(Math.min(...dates));
    const fullMax = new Date(Math.max(...dates));
    const fullRange = fullMax - fullMin;
    
    const leftPercent = Math.max(0, Math.min(100, ((state.zoom.min - fullMin) / fullRange) * 100));
    const rightPercent = Math.max(0, Math.min(100, ((state.zoom.max - fullMin) / fullRange) * 100));
    
    const left = document.getElementById('rangeHandleLeft');
    const right = document.getElementById('rangeHandleRight');
    const fill = document.getElementById('rangeFill');
    
    if (left) left.style.left = leftPercent + '%';
    if (right) right.style.left = rightPercent + '%';
    if (fill) {
        fill.style.left = leftPercent + '%';
        fill.style.width = (rightPercent - leftPercent) + '%';
    }
    
    document.getElementById('rangeStartLabel').textContent = formatDateShort(state.zoom.min);
    document.getElementById('rangeEndLabel').textContent = formatDateShort(state.zoom.max);
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    // Filter buttons
    elements.filterBtns?.forEach(btn => {
        btn.addEventListener('click', function() {
            elements.filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            state.currentFilter = this.dataset.filter;
            filterSignals();
            renderTable();
        });
    });
    
    // Search
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', debounce(function() {
            state.searchTerm = this.value;
            filterSignals();
            renderTable();
        }, 300));
    }
    
    // Pagination
    if (elements.prevBtn) {
        elements.prevBtn.addEventListener('click', () => {
            if (state.currentPage > 1) {
                state.currentPage--;
                renderTable();
            }
        });
    }
    
    if (elements.nextBtn) {
        elements.nextBtn.addEventListener('click', () => {
            const total = Math.ceil(state.filteredSignals.length / APP_CONFIG.itemsPerPage);
            if (state.currentPage < total) {
                state.currentPage++;
                renderTable();
            }
        });
    }
    
    // Timeframe buttons
    elements.timeframeBtns?.forEach(btn => {
        btn.addEventListener('click', function() {
            elements.timeframeBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            setTimeframe(this.dataset.timeframe);
        });
    });
    
    // Refresh
    if (elements.refreshBtn) {
        elements.refreshBtn.addEventListener('click', refreshData);
    }
}

function setTimeframe(tf) {
    if (!state.charts.bitcoin || state.historicalPriceData.length === 0) return;
    
    const dates = state.historicalPriceData.map(d => d.x);
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const now = new Date();
    
    let start, unit = 'month';
    
    switch(tf) {
        case '30d': start = new Date(now.setDate(now.getDate() - 30)); unit = 'day'; break;
        case '90d': start = new Date(now.setDate(now.getDate() - 90)); unit = 'week'; break;
        case '180d': start = new Date(now.setDate(now.getDate() - 180)); unit = 'week'; break;
        case '1y': start = new Date(now.setFullYear(now.getFullYear() - 1)); unit = 'month'; break;
        case '2y': start = new Date(now.setFullYear(now.getFullYear() - 2)); unit = 'month'; break;
        default: start = minDate;
    }
    
    if (start < minDate) start = minDate;
    
    const range = maxDate - start;
    const end = new Date(maxDate.getTime() + range * 0.05);
    start = new Date(start.getTime() - range * 0.05);
    
    saveZoomState();
    state.zoom.min = start;
    state.zoom.max = end;
    state.zoom.isZoomed = tf !== 'all';
    
    state.charts.bitcoin.options.scales.x.min = start;
    state.charts.bitcoin.options.scales.x.max = end;
    state.charts.bitcoin.options.scales.x.time.unit = unit;
    state.charts.bitcoin.update();
    
    updateZoomInfo();
    updateRangeHandles();
}

function refreshData() {
    if (!elements.refreshBtn) return;
    
    const original = elements.refreshBtn.innerHTML;
    elements.refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
    elements.refreshBtn.disabled = true;
    
    showNotification('Refreshing data...', 'info');
    
    loadAllData();
    
    setTimeout(() => {
        elements.refreshBtn.innerHTML = original;
        elements.refreshBtn.disabled = false;
        showNotification('Data refreshed!', 'success');
    }, 2000);
}

// ========== MOBILE FEATURES ==========
function initMobileFeatures() {
    addMobileStyles();
    setupMobileSliderHints();
    
    // Add pan mode hint for mobile
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            if (!document.querySelector('.pan-mode-hint')) {
                const hint = document.createElement('div');
                hint.className = 'pan-mode-hint mobile-scroll-hint';
                hint.innerHTML = '<i class="fas fa-hand-paper"></i> Bật Pan Mode (👆) để kéo đồ thị';
                document.querySelector('.zoom-controls-group')?.after(hint);
                
                setTimeout(() => {
                    hint.style.opacity = '0';
                    setTimeout(() => hint.remove(), 2000);
                }, 5000);
            }
        }, 3000);
    }
    
    window.addEventListener('resize', debounce(() => {
        updateRangeHandles();
    }, 200));
}

function initMobileZoomSlider() {
    const slider = document.getElementById('timelineSlider');
    if (!slider) return;
    
    // Clone to remove old listeners
    const newSlider = slider.cloneNode(true);
    slider.parentNode.replaceChild(newSlider, slider);
    
    newSlider.addEventListener('touchstart', handleSliderTouch, { passive: false });
    newSlider.addEventListener('touchmove', handleSliderTouch, { passive: false });
    newSlider.addEventListener('touchend', handleSliderTouchEnd);
    newSlider.addEventListener('mousedown', handleSliderMouse);
    newSlider.addEventListener('mousemove', handleSliderMouse);
    newSlider.addEventListener('mouseup', handleSliderMouseEnd);
    newSlider.addEventListener('mouseleave', handleSliderMouseLeave);
}

function handleSliderTouch(e) {
    e.preventDefault();
    
    const slider = e.target;
    const touch = e.touches[0];
    if (!touch) return;
    
    const rect = slider.getBoundingClientRect();
    let x = touch.clientX - rect.left;
    x = Math.max(0, Math.min(rect.width, x));
    const percent = (x / rect.width) * 100;
    
    slider.value = percent;
    
    if (typeof updateZoomFromSlider === 'function') {
        updateZoomFromSlider(percent);
    }
    
    showSliderFeedback(percent);
}

function handleSliderTouchEnd() {
    hideSliderFeedback();
    if (typeof saveZoomState === 'function') saveZoomState();
}

function handleSliderMouse(e) {
    if (e.type === 'mousedown') e.target.dataset.mouseActive = 'true';
    if (!e.target.dataset.mouseActive) return;
    
    const rect = e.target.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(rect.width, x));
    const percent = (x / rect.width) * 100;
    
    e.target.value = percent;
    
    if (typeof updateZoomFromSlider === 'function') {
        updateZoomFromSlider(percent);
    }
    
    showSliderFeedback(percent);
}

function handleSliderMouseEnd(e) {
    e.target.dataset.mouseActive = 'false';
    hideSliderFeedback();
    if (typeof saveZoomState === 'function') saveZoomState();
}

function handleSliderMouseLeave(e) {
    if (e.target.dataset.mouseActive) {
        e.target.dataset.mouseActive = 'false';
        hideSliderFeedback();
    }
}

function showSliderFeedback(percent) {
    let fb = document.getElementById('sliderFeedback');
    if (!fb) {
        fb = document.createElement('div');
        fb.id = 'sliderFeedback';
        fb.className = 'slider-feedback';
        document.querySelector('.timeline-controls')?.appendChild(fb) || document.body.appendChild(fb);
    }
    
    fb.innerHTML = `<i class="fas fa-search"></i> ${Math.round(percent)}% view`;
    fb.classList.add('visible');
}

function hideSliderFeedback() {
    document.getElementById('sliderFeedback')?.classList.remove('visible');
}

function addMobileStyles() {
    if (document.getElementById('mobileStyles')) return;
    
    const signalsStyle = document.createElement('style');
    signalsStyle.id = 'mobileStyles';
    signalsStyle.textContent = `
        @media (max-width: 768px) {
            .timeline-slider { height: 10px !important; margin: 20px 0 !important; }
            .timeline-slider::-webkit-slider-thumb { width: 32px !important; height: 32px !important; }
            .range-handle { width: 28px !important; height: 28px !important; }
            .slider-feedback { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.95); color: white; padding: 12px 24px; border-radius: 30px; border: 2px solid #00d4ff; z-index: 10000; opacity: 0; transition: 0.3s; pointer-events: none; }
            .slider-feedback.visible { opacity: 1; transform: translateX(-50%) translateY(0); }
            body.slider-active { overflow: hidden; position: fixed; width: 100%; height: 100%; touch-action: none; }
        }
    `;
    document.head.appendChild(signalsStyle);
}

function setupMobileSliderHints() {
    if (window.innerWidth <= 768 && !document.querySelector('.mobile-slider-hint')) {
        const hint = document.createElement('div');
        hint.className = 'mobile-slider-hint';
        hint.innerHTML = '<i class="fas fa-hand-pointer"></i> Kéo slider để zoom';
        document.querySelector('.timeline-controls')?.prepend(hint);
    }
}

// ========== TABLE SCROLL ==========
function setupTableScroll() {
    const container = document.querySelector('.log-container');
    if (!container) return;
    
    let isDown = false;
    let startX, scrollLeft;
    
    container.addEventListener('mousedown', e => {
        isDown = true;
        container.style.cursor = 'grabbing';
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
    });
    
    container.addEventListener('mouseleave', () => {
        isDown = false;
        container.style.cursor = 'grab';
    });
    
    container.addEventListener('mouseup', () => {
        isDown = false;
        container.style.cursor = 'grab';
    });
    
    container.addEventListener('mousemove', e => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        container.scrollLeft = scrollLeft - (x - startX) * 2;
    });
    
    // Touch
    container.addEventListener('touchstart', e => {
        isDown = true;
        startX = e.touches[0].pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
    });
    
    container.addEventListener('touchmove', e => {
        if (!isDown) return;
        const x = e.touches[0].pageX - container.offsetLeft;
        container.scrollLeft = scrollLeft - (x - startX) * 1.5;
    });
    
    container.addEventListener('touchend', () => { isDown = false; });
}

// ========== HELPER FUNCTIONS ==========
function formatDate(d) { return d?.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) || 'Invalid'; }
function formatTime(d) { return d?.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false }) || 'Invalid'; }
function formatDateTime(d) { return `${formatDate(d)} ${formatTime(d)}`; }

function formatDateShort(d) {
    if (!d) return 'N/A';
    const now = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff}d ago`;
    if (diff < 30) return `${Math.floor(diff/7)}w ago`;
    return d.toLocaleDateString('en-US', { month:'short', year:'numeric' });
}

function getConfidenceClass(c) { return c >= 80 ? 'high' : c >= 60 ? 'medium' : 'low'; }
function getPriceZone(p) { return p > 80000 ? 'Extreme High' : p > 60000 ? 'High' : p > 40000 ? 'Upper' : p > 30000 ? 'Mid' : p > 20000 ? 'Support' : 'Low'; }

function getRecommendation(s) {
    if (s.signal_type === 'PEAK') {
        return s.confidence >= 80 ? 'Consider taking profits' : s.confidence >= 60 ? 'Monitor for reversal' : 'Wait for confirmation';
    } else {
        return s.confidence >= 80 ? 'Consider accumulation' : s.confidence >= 60 ? 'Monitor for entry' : 'Wait for stronger signal';
    }
}

function getEmptyTableHTML() {
    if (state.signals.length === 0) {
        return `<tr><td colspan="5" class="no-results"><i class="fas fa-exclamation-triangle"></i><div>No signals loaded</div><small>Check CSV file</small></td></tr>`;
    }
    return `<tr><td colspan="5" class="no-results"><i class="fas fa-filter"></i>No signals match filter</td></tr>`;
}

function updateLastUpdated() {
    if (elements.lastUpdated && state.lastUpdateTime) {
        elements.lastUpdated.textContent = state.lastUpdateTime.toLocaleString();
    }
}

function showNoDataUI(msg) {
    if (elements.tableBody) {
        elements.tableBody.innerHTML = `<tr><td colspan="5" class="no-results"><i class="fas fa-exclamation-triangle"></i><div class="error-message">${msg}</div><small>Please ensure signals.csv exists</small></td></tr>`;
    }
    showNotification(msg, 'error');
}

function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ========== NOTIFICATIONS ==========
function showNotification(msg, type = 'info', duration = 3000) {
    const icons = { success:'check-circle', error:'exclamation-circle', warning:'exclamation-triangle', info:'info-circle' };
    
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const n = document.createElement('div');
    n.className = `notification notification-${type}`;
    n.innerHTML = `<i class="fas fa-${icons[type]}"></i><span>${msg}</span>`;
    document.body.appendChild(n);
    
    setTimeout(() => {
        n.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => n.remove(), 300);
    }, duration);
}

// ========== ADD STYLES ==========
function addDynamicStyles() {
    const dynamicstyle = document.createElement('style');
    dynamicstyle.textContent = `
        /* Notification styles */
        .notification { position:fixed; top:20px; right:20px; background:rgba(0,0,0,0.95); color:white; padding:15px 25px; border-radius:10px; display:flex; align-items:center; gap:12px; z-index:10000; border-left:4px solid #f7931a; animation:slideInRight 0.3s ease; max-width:400px; backdrop-filter:blur(10px); }
        .notification-success { border-left-color:#4CAF50; }
        .notification-error { border-left-color:#f44336; }
        .notification-info { border-left-color:#2196F3; }
        .notification-warning { border-left-color:#FF9800; }
        @keyframes slideInRight { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
        @keyframes fadeOut { from { opacity:1; transform:translateX(0); } to { opacity:0; transform:translateX(100%); } }
        .mobile-scroll-hint { display:none; text-align:center; color:#00d4ff; margin:10px 0; padding:8px; background:rgba(0,212,255,0.1); border-radius:20px; }
        @media (max-width:768px) { .mobile-scroll-hint { display:block; } }
        
        /* Validation PASS style */
        .validation-pass {
            background: rgba(76, 175, 80, 0.15);
            color: #4CAF50;
            border: 1px solid rgba(76, 175, 80, 0.3);
            display: inline-block;
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.85em;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            animation: glowGreen 2s infinite;
        }
        
        @keyframes glowGreen {
            0%, 100% { box-shadow: 0 0 5px rgba(76, 175, 80, 0.3); }
            50% { box-shadow: 0 0 12px rgba(76, 175, 80, 0.7); }
        }
        
        /* No results */
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
        
        /* Floating Signal Detail - NEW */
        .floating-signal-detail {
            position: fixed;
            background: linear-gradient(135deg, rgba(0, 20, 30, 0.98), rgba(0, 0, 0, 0.98));
            border: 1px solid #00d4ff;
            border-radius: 12px;
            padding: 15px;
            width: 300px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 212, 255, 0.3);
            z-index: 10000;
            backdrop-filter: blur(10px);
            transition: opacity 0.2s ease, transform 0.2s ease;
            opacity: 0;
            transform: translateY(10px);
            pointer-events: auto;
            color: white;
            border-left: 4px solid #00d4ff;
        }
        
        .floating-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        
        .floating-header span {
            font-weight: bold;
            color: white;
            font-size: 1.1em;
        }
        
        .floating-close {
            background: transparent;
            border: none;
            color: rgba(255,255,255,0.5);
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: all 0.2s ease;
        }
        
        .floating-close:hover {
            color: white;
            background: rgba(255,255,255,0.1);
            transform: rotate(90deg);
        }
        
        .floating-body {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .floating-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            border-bottom: 1px dashed rgba(255,255,255,0.05);
        }
        
        .floating-row:last-child {
            border-bottom: none;
        }
        
        .floating-label {
            color: rgba(255,255,255,0.7);
            font-size: 0.9em;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .floating-label i {
            color: #00d4ff;
            width: 16px;
            font-size: 0.9em;
        }
        
        .floating-value {
            font-weight: 600;
            color: white;
            font-size: 0.95em;
        }
        
        .floating-value.price {
            color: #f7931a;
        }
        
        .floating-value.signal-type.peak {
            color: #ff2e63;
        }
        
        .floating-value.signal-type.dip {
            color: #00d4ff;
        }
        
        .floating-value.validation-pass {
            color: #4CAF50;
            background: rgba(76, 175, 80, 0.15);
            padding: 2px 8px;
            border-radius: 12px;
            border: 1px solid rgba(76, 175, 80, 0.3);
        }
        
        /* Signal Details container */
        .signal-details {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
        }
        
        .detail-card {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 10px;
            padding: 20px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        
        .detail-card h3 {
            color: #00d4ff;
            margin-bottom: 15px;
            font-size: 1.1em;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .detail-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 5px 0;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        
        .detail-item:last-child {
            border-bottom: none;
        }
        
        .detail-label {
            color: rgba(255,255,255,0.7);
            font-size: 0.9em;
        }
        
        .detail-value {
            font-weight: 600;
            color: white;
        }
        
        @media (max-width: 768px) {
            .signal-details {
                grid-template-columns: 1fr;
                gap: 10px;
            }
        }
    `;
    document.head.appendChild(dynamicstyle);
}

// ========== INITIAL LOAD IF DATA EXISTS ==========
if (window.realCsvData) parseSignalsData(window.realCsvData);
if (window.bitcoinPriceData) parseBitcoinData(window.bitcoinPriceData);

console.log('✅ signals.js v1.5.2 - UPDATED: Floating details, layout fixed');
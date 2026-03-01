// Interactive JavaScript - For home page interactions only

document.addEventListener('DOMContentLoaded', function() {
    // Only run on home page
    if (!document.getElementById('peakMessage')) return;
    
    console.log('Interactive System Active');
    
    const peakMessage = document.getElementById('peakMessage');
    const dipMessage = document.getElementById('dipMessage');
    const statusLight = document.getElementById('statusLight');
    const statusText = document.getElementById('statusText');
    const aiBadge = document.getElementById('aiBadge');
    const logoContainer = document.querySelector('.logo-container');
    const logoWaveSync = document.getElementById('logoWaveSync');
    const interactiveBackground = document.getElementById('interactiveBackground');
    const sensorAlert = document.getElementById('sensorAlert');
    
    let wavePhase = 0;
    let lastUpdate = 0;
    const waveFrequency = 0.125/3; // Tần số wave
    const updateInterval = 2000; // 0.5Hz = 2000ms (2 giây một lần)
    let lastInteractionTime = 0;
    
    // Kiểm tra mobile
    const isMobile = window.IS_MOBILE || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    if (isMobile) {
        console.log('📱 Mobile mode: Wave updates at 0.5Hz (every 2 seconds), effects disabled');
        
        // Ẩn các hiệu ứng nặng
        const sensorRings = document.querySelectorAll('.sensor-ring');
        const energyParticles = document.getElementById('energyParticles');
        const bitcoinWaves = document.querySelectorAll('.bitcoin-wave');
        
        sensorRings.forEach(ring => {
            ring.style.animation = 'none';
            ring.style.opacity = '0.1';
        });
        
        if (energyParticles) {
            energyParticles.style.display = 'none';
        }
        
        bitcoinWaves.forEach(wave => {
            wave.style.animation = 'none';
            wave.style.opacity = '0.1';
        });
        
        // Tắt hiệu ứng click/touch
        if (interactiveBackground) {
            interactiveBackground.style.pointerEvents = 'none';
        }
    }
    
    // Initialize wave state
    updateWaveState();
    
    // Tạo particle burst (chỉ trên desktop)
    function createParticleBurst(x, y, intensity) {
        if (isMobile) return; // Không chạy trên mobile
        
        const particleCount = Math.floor(30 * intensity);
        const burstContainer = document.createElement('div');
        burstContainer.style.position = 'fixed';
        burstContainer.style.left = `${x}px`;
        burstContainer.style.top = `${y}px`;
        burstContainer.style.transform = 'translate(-50%, -50%)';
        burstContainer.style.pointerEvents = 'none';
        burstContainer.style.zIndex = '3';
        
        document.body.appendChild(burstContainer);
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'absolute';
            const size = 2 + Math.random() * 4;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.borderRadius = '50%';
            particle.style.backgroundColor = Math.random() > 0.5 ? 'var(--wave-peak)' : 'var(--wave-trough)';
            particle.style.opacity = '0.8';
            
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 100;
            const distance = speed * (1 + intensity);
            
            const animation = particle.animate([
                {
                    transform: 'translate(0, 0) scale(1)',
                    opacity: 0.8
                },
                {
                    transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0)`,
                    opacity: 0
                }
            ], {
                duration: 800 + Math.random() * 400,
                easing: 'cubic-bezier(0.215, 0.610, 0.355, 1)'
            });
            
            burstContainer.appendChild(particle);
            
            animation.onfinish = () => {
                if (particle.parentNode === burstContainer) {
                    burstContainer.removeChild(particle);
                }
            };
        }
        
        setTimeout(() => {
            if (burstContainer.parentNode === document.body) {
                document.body.removeChild(burstContainer);
            }
        }, 2000);
    }
    
    // Intensify background waves (chỉ trên desktop)
    function intensifyBackgroundWaves(x, y, intensity) {
        if (isMobile) return; // Không chạy trên mobile
        
        const waves = document.querySelectorAll('.bitcoin-wave');
        const rings = document.querySelectorAll('.sensor-ring');
        
        waves.forEach((wave, index) => {
            const originalOpacity = wave.style.opacity;
            wave.style.opacity = (parseFloat(wave.style.opacity || 0.1) * (1 + intensity * 2)).toString();
            wave.style.filter = `blur(${intensity * 5}px) brightness(${1 + intensity})`;
            
            setTimeout(() => {
                wave.style.opacity = originalOpacity || '0.1';
                wave.style.filter = '';
            }, 1000 * intensity);
        });
        
        rings.forEach((ring, index) => {
            const originalBorderColor = ring.style.borderColor;
            ring.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            ring.style.borderWidth = '2px';
            ring.style.filter = `blur(${intensity}px) brightness(${1 + intensity})`;
            
            setTimeout(() => {
                ring.style.borderColor = originalBorderColor;
                ring.style.borderWidth = '';
                ring.style.filter = '';
            }, 1500 * intensity);
        });
        
        const logoWave = document.querySelector('.logo-wave-effect');
        if (logoWave) {
            const originalOpacity = logoWave.style.opacity;
            logoWave.style.opacity = (parseFloat(logoWave.style.opacity || 0.05) * 3).toString();
            logoWave.style.filter = `blur(${intensity * 2}px) brightness(${1 + intensity})`;
            
            setTimeout(() => {
                logoWave.style.opacity = originalOpacity || '0.05';
                logoWave.style.filter = '';
            }, 1000 * intensity);
        }
    }
    
    // Create sensor alert (chỉ trên desktop)
    function createSensorAlert(x, y, intensity = 1) {
        if (isMobile) return; // Không chạy trên mobile
        
        const currentTime = Date.now();
        const mobileCooldown = window.innerWidth <= 768 ? 200 : 500;
        if (currentTime - lastInteractionTime < mobileCooldown) {
            return;
        }
        
        lastInteractionTime = currentTime;
        
        console.log(`Sensor alert at x: ${x}, y: ${y}, intensity: ${intensity}`);
        
        const ringCount = 3;
        const colors = [
            'rgba(255, 46, 99, 0.8)',
            'rgba(0, 212, 255, 0.8)',
            'rgba(247, 147, 26, 0.8)'
        ];
        
        for (let i = 0; i < ringCount; i++) {
            const ring = document.createElement('div');
            ring.className = 'alert-ring';
            
            ring.style.left = `${x}px`;
            ring.style.top = `${y}px`;
            ring.style.borderColor = colors[i % colors.length];
            
            const delay = i * 0.2;
            const sizeMultiplier = 1 + (i * 0.3) * intensity;
            
            ring.style.animation = `alertExpand ${1.5 * sizeMultiplier}s ease-out ${delay}s forwards`;
            ring.style.boxShadow = `0 0 30px ${colors[i % colors.length]}`;
            
            sensorAlert.appendChild(ring);
            
            setTimeout(() => {
                if (ring.parentNode === sensorAlert) {
                    sensorAlert.removeChild(ring);
                }
            }, (1.5 * sizeMultiplier + delay) * 1000);
        }
        
        createParticleBurst(x, y, intensity);
        intensifyBackgroundWaves(x, y, intensity);
        
        const originalText = statusText.textContent;
        statusText.textContent = 'SENSOR TRIGGERED!';
        statusText.style.color = colors[0];
        statusText.style.textShadow = `0 0 20px ${colors[0]}`;
        
        setTimeout(() => {
            statusText.textContent = originalText;
            statusText.style.color = '';
            statusText.style.textShadow = '';
        }, 2000);
        
        const originalBadgeText = aiBadge.textContent;
        aiBadge.textContent = 'SENSOR ACTIVATED!';
        aiBadge.style.background = 'linear-gradient(to right, var(--wave-peak), var(--wave-mid))';
        aiBadge.style.boxShadow = '0 0 25px rgba(255, 46, 99, 0.8)';
        
        setTimeout(() => {
            aiBadge.textContent = originalBadgeText;
            aiBadge.style.background = 'linear-gradient(to right, var(--wave-trough), var(--wave-mid))';
            aiBadge.style.boxShadow = '0 0 15px rgba(0, 212, 255, 0.4)';
        }, 1500);
    }
    
    // Handle interaction events (chỉ trên desktop)
    if (!isMobile) {
        interactiveBackground.addEventListener('click', function(e) {
            handleInteraction(e.clientX, e.clientY, 1);
        });
        
        interactiveBackground.addEventListener('touchstart', function(e) {
            e.preventDefault();
            const touch = e.touches[0];
            if (touch) {
                handleInteraction(touch.clientX, touch.clientY, 0.8);
            }
            
            interactiveBackground.style.setProperty('--touch-x', `${touch.clientX}px`);
            interactiveBackground.style.setProperty('--touch-y', `${touch.clientY}px`);
            interactiveBackground.classList.add('touch-active');
            
            setTimeout(() => {
                interactiveBackground.classList.remove('touch-active');
            }, 300);
        }, { passive: false });
        
        interactiveBackground.addEventListener('touchmove', function(e) {
            e.preventDefault();
            const touch = e.touches[0];
            if (touch) {
                handleInteraction(touch.clientX, touch.clientY, 0.3);
            }
        }, { passive: false });
        
        let isDragging = false;
        interactiveBackground.addEventListener('mousedown', function(e) {
            isDragging = true;
            handleInteraction(e.clientX, e.clientY, 0.5);
        });
        
        interactiveBackground.addEventListener('mousemove', function(e) {
            if (isDragging) {
                handleInteraction(e.clientX, e.clientY, 0.3);
            }
        });
        
        interactiveBackground.addEventListener('mouseup', function() {
            isDragging = false;
        });
        
        interactiveBackground.addEventListener('mouseleave', function() {
            isDragging = false;
        });
    }
    
    function handleInteraction(x, y, intensity = 1) {
        createSensorAlert(x, y, intensity);
    }
    
    // Animation loop cho wave updates (chạy cả trên mobile và desktop)
    function animate(currentTime) {
        if (!lastUpdate) lastUpdate = currentTime;
        
        const deltaTime = currentTime - lastUpdate;
        
        // Cập nhật với tần số 0.5Hz (2000ms) trên cả mobile và desktop
        if (deltaTime >= updateInterval) {
            wavePhase += (deltaTime / 1000) * waveFrequency;
            wavePhase %= 1;
            
            updateWaveState();
            lastUpdate = currentTime;
        }
        
        requestAnimationFrame(animate);
    }
    
    // Update wave visual state based on phase
    // Update wave visual state based on phase
    function updateWaveState() {
        // Calculate wave position (giá trị từ -1 đến 1)
        const wavePosition = Math.sin(wavePhase * Math.PI * 4);
        const absoluteWavePosition = Math.abs(wavePosition);
        
        // Xóa hết các class active trước khi set
        peakMessage.classList.remove('active');
        dipMessage.classList.remove('active');
        
        // Reset opacity styles để dùng animation mượt
        peakMessage.style.opacity = '';
        dipMessage.style.opacity = '';
        peakMessage.style.transition = 'opacity 1.5s ease';
        dipMessage.style.transition = 'opacity 1.5s ease';
        
        // TÍNH TOÁN ĐỘ SÁNG DỰA TRÊN VỊ TRÍ SÓNG
        // wavePosition > 0: đang ở phía peak (giá trị dương)
        // wavePosition < 0: đang ở phía dip (giá trị âm)
        
        // Peak phase (wavePosition từ 0.5 đến 1)
        if (wavePosition > 0.5) {
            // Peak sáng dần khi tiến về 1, mờ dần khi lui về 0.5
            const peakBrightness = (wavePosition - 0.5) * 2; // 0 -> 1
            peakMessage.style.opacity = peakBrightness.toString();
            dipMessage.style.opacity = '0';
            
            // Animation cho peak message
            peakMessage.style.animation = 'detectionPulse 9s infinite alternate';
            dipMessage.style.animation = 'none';
            
            // Update status indicator
            statusLight.className = 'status-light status-peak';
            statusLight.style.opacity = peakBrightness.toString();
            statusText.textContent = 'BITCOIN PEAK DETECTED';
            statusText.style.color = 'var(--wave-peak)';
            statusText.style.opacity = peakBrightness.toString();
            
            // Update badge
            aiBadge.textContent = 'PEAK DETECTED - SELL SIGNAL';
            aiBadge.style.background = 'linear-gradient(to right, var(--wave-peak), #ff6b00)';
            aiBadge.style.opacity = peakBrightness.toString();
            
            // Logo border
            logoContainer.style.borderColor = `rgba(255, 46, 99, ${0.2 + peakBrightness * 0.3})`;
        } 
        // Dip phase (wavePosition từ -0.5 đến -1)
        else if (wavePosition < -0.5) {
            // Dip sáng dần khi tiến về -1, mờ dần khi lui về -0.5
            const dipBrightness = Math.abs(wavePosition + 0.5) * 2; // 0 -> 1
            peakMessage.style.opacity = '0';
            dipMessage.style.opacity = dipBrightness.toString();
            
            // Animation cho dip message
            dipMessage.style.animation = 'detectionPulse 9s infinite alternate';
            peakMessage.style.animation = 'none';
            
            // Update status indicator
            statusLight.className = 'status-light status-dip';
            statusLight.style.opacity = dipBrightness.toString();
            statusText.textContent = 'BITCOIN DIP DETECTED';
            statusText.style.color = 'var(--wave-trough)';
            statusText.style.opacity = dipBrightness.toString();
            
            // Update badge
            aiBadge.textContent = 'DIP DETECTED - BUY SIGNAL';
            aiBadge.style.background = 'linear-gradient(to right, var(--wave-trough), #0088cc)';
            aiBadge.style.opacity = dipBrightness.toString();
            
            // Logo border
            logoContainer.style.borderColor = `rgba(0, 212, 255, ${0.2 + dipBrightness * 0.3})`;
        }
        // Transition phase (wavePosition từ -0.5 đến 0.5)
        else {
            // Cả hai đều mờ, nhưng vẫn có thể thấy nhẹ
            const transitionBrightness = Math.abs(wavePosition) * 0.5; // 0 -> 0.25
            
            if (wavePosition > 0) {
                // Đang chuyển từ peak sang trung tâm
                peakMessage.style.opacity = (0.5 - wavePosition).toString();
                dipMessage.style.opacity = '0';
            } else {
                // Đang chuyển từ dip sang trung tâm
                peakMessage.style.opacity = '0';
                dipMessage.style.opacity = (0.5 + wavePosition).toString();
            }
            
            // Gentle pulse animation cho cả hai
            const pulseSpeed = 12 + absoluteWavePosition * 6;
            peakMessage.style.animation = `detectionPulse ${pulseSpeed}s infinite alternate`;
            dipMessage.style.animation = `detectionPulse ${pulseSpeed}s infinite alternate`;
            
            // Update status indicator
            statusLight.className = 'status-light';
            statusLight.style.background = 'var(--wave-mid)';
            statusLight.style.opacity = transitionBrightness.toString();
            statusText.textContent = 'ANALYSING BITCOIN WAVES';
            statusText.style.color = 'var(--wave-mid)';
            statusText.style.opacity = '1';
            
            // Update badge
            aiBadge.textContent = 'ANALYSING BITCOIN WAVES';
            aiBadge.style.background = 'linear-gradient(to right, var(--wave-trough), var(--wave-mid))';
            aiBadge.style.opacity = '1';
            
            // Logo border
            logoContainer.style.borderColor = `rgba(255, 255, 255, ${0.1 + transitionBrightness * 0.2})`;
        }
        
        // Sync logo wave effect with background waves
        const logoWave = document.querySelector('.logo-wave-effect');
        if (logoWave) {
            const waveOffset = wavePhase * 50;
            logoWave.style.transform = `translateX(${-waveOffset}%) translateY(${Math.sin(wavePhase * Math.PI * 8) * 3}px)`;
            logoWave.style.opacity = `${0.02 + absoluteWavePosition * 0.04}`;
        }
        
        // Move wave sync indicator
        if (logoWaveSync) {
            const syncPosition = wavePhase * 50;
            logoWaveSync.style.transform = `translateX(${syncPosition}%)`;
            logoWaveSync.style.opacity = `${0.2 + absoluteWavePosition * 0.3}`;
        }
    }
        
    // Start animation loop
    requestAnimationFrame(animate);
    
    // Add wave sync effect to badge
    setInterval(() => {
        const waveIntensity = Math.abs(Math.sin(wavePhase * Math.PI * 2));
        aiBadge.style.transform = `translateY(${Math.sin(wavePhase * Math.PI * 8) * 1}px)`;
    }, 100);
    
    // Console instructions
    setTimeout(() => {
        if (!isMobile) {
            console.log('%c💡 TIP: Click or touch anywhere to test the Early Warning System sensors!', 'color: #00d4ff; font-size: 14px;');
            
            if ('ontouchstart' in window || navigator.maxTouchPoints) {
                console.log('%c📱 MOBILE: Touch and drag to simulate sensor network activity!', 'color: #f7931a; font-size: 14px;');
            }
        } else {
            console.log('%c📱 Mobile mode: Wave updates at 0.5Hz (every 2 seconds), touch effects disabled', 'color: #00d4ff; font-size: 14px;');
        }
    }, 3000);
});

// interactions.js - Interactive effects for home page

// interactions.js - Interactive effects for home page
// Version: 2.0.0 - Đã loại bỏ hoàn toàn tính năng click tạo sóng

document.addEventListener('DOMContentLoaded', function() {
    // Only run on home page
    if (!document.getElementById('peakMessage')) return;
    
    console.log('Interactive System Active - Click effects disabled');
    
    const peakMessage = document.getElementById('peakMessage');
    const dipMessage = document.getElementById('dipMessage');
    const statusLight = document.getElementById('statusLight');
    const statusText = document.getElementById('statusText');
    const aiBadge = document.getElementById('aiBadge');
    const logoContainer = document.querySelector('.logo-container');
    const logoWaveSync = document.getElementById('logoWaveSync');
    
    let wavePhase = 0;
    let lastUpdate = 0;
    const waveFrequency = 0.125/3; // Tần số wave
    const updateInterval = 2000; // 0.5Hz = 2000ms (2 giây một lần)
    
    // Kiểm tra mobile
    const isMobile = window.IS_MOBILE || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    if (isMobile) {
        console.log('📱 Mobile mode: Wave updates at 0.5Hz (every 2 seconds), effects disabled');
        
        // Ẩn các hiệu ứng nặng
        const sensorRings = document.querySelectorAll('.sensor-ring');
        const energyParticles = document.getElementById('energyParticles');
        const bitcoinWaves = document.querySelectorAll('.bitcoin-wave');
        
        sensorRings.forEach(ring => {
            ring.style.animation = 'none';
            ring.style.opacity = '0.1';
        });
        
        if (energyParticles) {
            energyParticles.style.display = 'none';
        }
        
        bitcoinWaves.forEach(wave => {
            wave.style.animation = 'none';
            wave.style.opacity = '0.1';
        });
    }
    
    // Initialize wave state
    updateWaveState();
    
    // Animation loop cho wave updates
    function animate(currentTime) {
        if (!lastUpdate) lastUpdate = currentTime;
        
        const deltaTime = currentTime - lastUpdate;
        
        // Cập nhật với tần số 0.5Hz (2000ms) trên cả mobile và desktop
        if (deltaTime >= updateInterval) {
            wavePhase += (deltaTime / 1000) * waveFrequency;
            wavePhase %= 1;
            
            updateWaveState();
            lastUpdate = currentTime;
        }
        
        requestAnimationFrame(animate);
    }
    
    // Update wave visual state based on phase
    function updateWaveState() {
        // Calculate wave position (giá trị từ -1 đến 1)
        const wavePosition = Math.sin(wavePhase * Math.PI * 4);
        const absoluteWavePosition = Math.abs(wavePosition);
        
        // Xóa hết các class active trước khi set
        peakMessage.classList.remove('active');
        dipMessage.classList.remove('active');
        
        // Reset opacity styles để dùng animation mượt
        peakMessage.style.opacity = '';
        dipMessage.style.opacity = '';
        peakMessage.style.transition = 'opacity 1.5s ease';
        dipMessage.style.transition = 'opacity 1.5s ease';
        
        // TÍNH TOÁN ĐỘ SÁNG DỰA TRÊN VỊ TRÍ SÓNG
        // wavePosition > 0: đang ở phía peak (giá trị dương)
        // wavePosition < 0: đang ở phía dip (giá trị âm)
        
        // Peak phase (wavePosition từ 0.5 đến 1)
        if (wavePosition > 0.5) {
            // Peak sáng dần khi tiến về 1, mờ dần khi lui về 0.5
            const peakBrightness = (wavePosition - 0.5) * 2; // 0 -> 1
            peakMessage.style.opacity = peakBrightness.toString();
            dipMessage.style.opacity = '0';
            
            // Animation cho peak message
            peakMessage.style.animation = 'detectionPulse 9s infinite alternate';
            dipMessage.style.animation = 'none';
            
            // Update status indicator
            statusLight.className = 'status-light status-peak';
            statusLight.style.opacity = peakBrightness.toString();
            statusText.textContent = 'BITCOIN PEAK DETECTED';
            statusText.style.color = 'var(--wave-peak)';
            statusText.style.opacity = peakBrightness.toString();
            
            // Update badge
            aiBadge.textContent = 'PEAK DETECTED - SELL SIGNAL';
            aiBadge.style.background = 'linear-gradient(to right, var(--wave-peak), #ff6b00)';
            aiBadge.style.opacity = peakBrightness.toString();
            
            // Logo border
            logoContainer.style.borderColor = `rgba(255, 46, 99, ${0.2 + peakBrightness * 0.3})`;
        } 
        // Dip phase (wavePosition từ -0.5 đến -1)
        else if (wavePosition < -0.5) {
            // Dip sáng dần khi tiến về -1, mờ dần khi lui về -0.5
            const dipBrightness = Math.abs(wavePosition + 0.5) * 2; // 0 -> 1
            peakMessage.style.opacity = '0';
            dipMessage.style.opacity = dipBrightness.toString();
            
            // Animation cho dip message
            dipMessage.style.animation = 'detectionPulse 9s infinite alternate';
            peakMessage.style.animation = 'none';
            
            // Update status indicator
            statusLight.className = 'status-light status-dip';
            statusLight.style.opacity = dipBrightness.toString();
            statusText.textContent = 'BITCOIN DIP DETECTED';
            statusText.style.color = 'var(--wave-trough)';
            statusText.style.opacity = dipBrightness.toString();
            
            // Update badge
            aiBadge.textContent = 'DIP DETECTED - BUY SIGNAL';
            aiBadge.style.background = 'linear-gradient(to right, var(--wave-trough), #0088cc)';
            aiBadge.style.opacity = dipBrightness.toString();
            
            // Logo border
            logoContainer.style.borderColor = `rgba(0, 212, 255, ${0.2 + dipBrightness * 0.3})`;
        }
        // Transition phase (wavePosition từ -0.5 đến 0.5)
        else {
            // Cả hai đều mờ, nhưng vẫn có thể thấy nhẹ
            const transitionBrightness = Math.abs(wavePosition) * 0.5; // 0 -> 0.25
            
            if (wavePosition > 0) {
                // Đang chuyển từ peak sang trung tâm
                peakMessage.style.opacity = (0.5 - wavePosition).toString();
                dipMessage.style.opacity = '0';
            } else {
                // Đang chuyển từ dip sang trung tâm
                peakMessage.style.opacity = '0';
                dipMessage.style.opacity = (0.5 + wavePosition).toString();
            }
            
            // Gentle pulse animation cho cả hai
            const pulseSpeed = 12 + absoluteWavePosition * 6;
            peakMessage.style.animation = `detectionPulse ${pulseSpeed}s infinite alternate`;
            dipMessage.style.animation = `detectionPulse ${pulseSpeed}s infinite alternate`;
            
            // Update status indicator
            statusLight.className = 'status-light';
            statusLight.style.background = 'var(--wave-mid)';
            statusLight.style.opacity = transitionBrightness.toString();
            statusText.textContent = 'ANALYSING BITCOIN WAVES';
            statusText.style.color = 'var(--wave-mid)';
            statusText.style.opacity = '1';
            
            // Update badge
            aiBadge.textContent = 'ANALYSING BITCOIN WAVES';
            aiBadge.style.background = 'linear-gradient(to right, var(--wave-trough), var(--wave-mid))';
            aiBadge.style.opacity = '1';
            
            // Logo border
            logoContainer.style.borderColor = `rgba(255, 255, 255, ${0.1 + transitionBrightness * 0.2})`;
        }
        
        // Sync logo wave effect with background waves
        const logoWave = document.querySelector('.logo-wave-effect');
        if (logoWave) {
            const waveOffset = wavePhase * 50;
            logoWave.style.transform = `translateX(${-waveOffset}%) translateY(${Math.sin(wavePhase * Math.PI * 8) * 3}px)`;
            logoWave.style.opacity = `${0.02 + absoluteWavePosition * 0.04}`;
        }
        
        // Move wave sync indicator
        if (logoWaveSync) {
            const syncPosition = wavePhase * 50;
            logoWaveSync.style.transform = `translateX(${syncPosition}%)`;
            logoWaveSync.style.opacity = `${0.2 + absoluteWavePosition * 0.3}`;
        }
    }
    
    // Start animation loop
    requestAnimationFrame(animate);
    
    // Add wave sync effect to badge
    setInterval(() => {
        const waveIntensity = Math.abs(Math.sin(wavePhase * Math.PI * 2));
        aiBadge.style.transform = `translateY(${Math.sin(wavePhase * Math.PI * 8) * 1}px)`;
    }, 100);
    
    // Console message
    setTimeout(() => {
        console.log('%c🌊 Bitcoin PeakDip Early Warning System Active', 'color: #00d4ff; font-size: 14px; font-weight: bold;');
    }, 3000);
});

// Export global (giữ lại để tương thích)
window.intensifyWaves = function() {
    // Empty function - đã vô hiệu hóa
    console.log('Wave intensification disabled');
};
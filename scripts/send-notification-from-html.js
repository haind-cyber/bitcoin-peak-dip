#!/usr/bin/env node

/**
 * Bitcoin PeakDip - Complete Notification System
 * Version: 3.0.0
 * Features: Discord, FCM Push, Badge Update, Analytics, Retry Logic
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// ========== CONFIGURATION ==========
const CONFIG = {
    version: '3.0.0',
    discord: {
        publicWebhook: process.env.DISCORD_PUBLIC_WEBHOOK,
        privateWebhook: process.env.DISCORD_PRIVATE_WEBHOOK
    },
    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID || 'bitcoinpeakdip'
    },
    topics: {
        articles: 'new_articles',
        badge: 'badge_update',
        signals: 'trading_signals'
    },
    retry: {
        maxAttempts: 3,
        delay: 1000
    },
    cache: {
        articles: 'notification-cache.json',
        stats: 'stats-cache.json'
    }
};

// ========== LOGGING ==========
const log = {
    info: (msg) => console.log(`ℹ️ ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    warn: (msg) => console.log(`⚠️ ${msg}`),
    error: (msg) => console.log(`❌ ${msg}`),
    section: (msg) => console.log(`\n📌 ${msg}`)
};

// ========== INITIALIZATION ==========
log.section('BITCOIN PEAKDIP NOTIFICATION SYSTEM v' + CONFIG.version);

// Khởi tạo Firebase Admin
let firebaseInitialized = false;
let db = null;

function initializeFirebase() {
    if (firebaseInitialized) return true;
    
    try {
        // Kiểm tra credentials từ file hoặc env
        let credentials = null;
        
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            try {
                credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                log.info('Firebase credentials loaded from env');
            } catch (e) {
                log.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT');
            }
        }
        
        if (!credentials && fs.existsSync('firebase-credentials.json')) {
            credentials = JSON.parse(fs.readFileSync('firebase-credentials.json', 'utf8'));
            log.info('Firebase credentials loaded from file');
        }
        
        if (!credentials) {
            log.warn('No Firebase credentials found');
            return false;
        }
        
        admin.initializeApp({
            credential: admin.credential.cert(credentials),
            projectId: CONFIG.firebase.projectId,
            databaseURL: CONFIG.firebase.databaseURL
        });
        
        db = admin.firestore();
        db.settings({ ignoreUndefinedProperties: true });
        
        firebaseInitialized = true;
        log.success('Firebase Admin initialized');
        
        // Test connection
        return testFirebaseConnection();
        
    } catch (error) {
        log.error('Firebase init failed: ' + error.message);
        return false;
    }
}

async function testFirebaseConnection() {
    try {
        const testRef = db.collection('_test').doc('connection');
        await testRef.set({ 
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            pid: process.pid
        });
        await testRef.delete();
        log.success('Firebase connection OK');
        return true;
    } catch (error) {
        log.warn('Firebase connection test failed: ' + error.message);
        return false;
    }
}

// ========== HELPER FUNCTIONS ==========

function extractMetadata(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return { title: 'New Article', description: '' };
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Extract title
        let title = '';
        const titleMatch = content.match(/<title>([^<]*)<\/title>/);
        if (titleMatch) title = titleMatch[1].trim();
        
        if (!title) {
            const h1Match = content.match(/<h1[^>]*>([^<]*)<\/h1>/);
            if (h1Match) title = h1Match[1].trim();
        }
        
        if (!title) {
            const ogMatch = content.match(/<meta property="og:title" content="([^"]*)"[^>]*>/);
            if (ogMatch) title = ogMatch[1].trim();
        }
        
        // Extract description
        let description = '';
        const descMatch = content.match(/<meta name="description" content="([^"]*)"[^>]*>/);
        if (descMatch) description = descMatch[1].trim();
        
        if (!description) {
            const ogDescMatch = content.match(/<meta property="og:description" content="([^"]*)"[^>]*>/);
            if (ogDescMatch) description = ogDescMatch[1].trim();
        }
        
        // Extract reading time
        let readingTime = 5;
        const timeMatch = content.match(/<span class="reading-time">(\d+)<\/span>/);
        if (timeMatch) readingTime = parseInt(timeMatch[1]);
        
        // Extract image
        let image = '';
        const imgMatch = content.match(/<meta property="og:image" content="([^"]*)"[^>]*>/);
        if (imgMatch) image = imgMatch[1].trim();
        
        return {
            title: title || 'New Article',
            description: description || 'New article on Bitcoin PeakDip',
            readingTime,
            image: image || 'https://bitcoin-peak-dip.com/assets/images/og-default.jpg'
        };
    } catch (error) {
        log.error('Error extracting metadata: ' + error.message);
        return {
            title: 'New Article',
            description: '',
            readingTime: 5,
            image: 'https://bitcoin-peak-dip.com/assets/images/og-default.jpg'
        };
    }
}

// ========== DISCORD FUNCTIONS ==========

async function sendDiscord(article, index, total) {
    if (!CONFIG.discord.publicWebhook && !CONFIG.discord.privateWebhook) {
        return false;
    }
    
    const embed = {
        title: `📚 **New Article ${index}/${total}**`,
        description: article.description || article.title,
        color: 0x00d4ff,
        fields: [
            {
                name: '📄 Title',
                value: article.title,
                inline: false
            },
            {
                name: '🔗 Link',
                value: article.url,
                inline: false
            },
            {
                name: '⏱️ Reading Time',
                value: `${article.readingTime || 5} minutes`,
                inline: true
            },
            {
                name: '📅 Published',
                value: new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                inline: true
            }
        ],
        thumbnail: {
            url: 'https://bitcoin-peak-dip.com/assets/icons/icon-192x192.png'
        },
        image: {
            url: article.image || 'https://bitcoin-peak-dip.com/assets/images/og-default.jpg'
        },
        footer: {
            text: 'Bitcoin PeakDip • Early Warning System',
            icon_url: 'https://bitcoin-peak-dip.com/assets/icons/icon-72x72.png'
        },
        timestamp: new Date().toISOString()
    };
    
    let success = true;
    
    // Gửi đến public webhook
    if (CONFIG.discord.publicWebhook) {
        try {
            await axios.post(CONFIG.discord.publicWebhook, { embeds: [embed] });
            log.success('Discord public sent');
        } catch (error) {
            log.error('Discord public failed: ' + error.message);
            success = false;
        }
    }
    
    // Gửi đến private webhook
    if (CONFIG.discord.privateWebhook) {
        try {
            await axios.post(CONFIG.discord.privateWebhook, { embeds: [embed] });
            log.success('Discord private sent');
        } catch (error) {
            log.error('Discord private failed: ' + error.message);
            success = false;
        }
    }
    
    return success;
}

// ========== FCM FUNCTIONS ==========

async function updateBadgeCount(increment = 1) {
    if (!firebaseInitialized) return null;
    
    try {
        const statsRef = db.collection('stats').doc('unread');
        
        // Sử dụng transaction để đảm bảo consistency
        const result = await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(statsRef);
            
            let newCount;
            if (!doc.exists) {
                newCount = increment;
                transaction.set(statsRef, {
                    count: newCount,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                newCount = (doc.data().count || 0) + increment;
                transaction.update(statsRef, {
                    count: admin.firestore.FieldValue.increment(increment),
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            
            return newCount;
        });
        
        log.success(`Badge count updated to ${result}`);
        return result;
    } catch (error) {
        log.error('Badge update failed: ' + error.message);
        return null;
    }
}

async function sendFCM(article, badgeCount) {
    if (!firebaseInitialized) return false;
    
    try {
        // ===== ĐỌC TOKEN TỪ FIRESTORE =====
        log.info('📱 Fetching active tokens from Firestore...');
        const tokensSnapshot = await db.collection('fcm_tokens')
            .where('active', '==', true)
            .get();
        
        if (tokensSnapshot.empty) {
            log.warn('⚠️ No active tokens found in Firestore');
            return false;
        }
        
        const tokens = tokensSnapshot.docs.map(doc => doc.id);
        log.success(`📱 Found ${tokens.length} active token(s)`);
        
        // Log token đầu tiên để kiểm tra
        if (tokens.length > 0) {
            log.info(`📱 First token: ${tokens[0].substring(0, 30)}...`);
        }
        
        // ===== TẠO MESSAGE =====
        const message = {
            notification: {
                title: '📚 Bitcoin PeakDip',
                body: article.description || `New article: ${article.title}`,
                image: article.image
            },
            data: {
                type: 'NEW_ARTICLE',
                articleId: `article_${Date.now()}`,
                title: article.title,
                url: article.url,
                readingTime: article.readingTime?.toString() || '5',
                badgeCount: badgeCount?.toString() || '1',
                click_action: 'OPEN_ARTICLE',
                timestamp: Date.now().toString()
            },
            android: {
                priority: 'high',
                notification: {
                    icon: '@drawable/ic_notification',
                    color: '#00d4ff',
                    sound: 'default',
                    priority: 'high',
                    channelId: 'new_articles'
                }
            },
            apns: {
                payload: {
                    aps: {
                        alert: {
                            title: '📚 Bitcoin PeakDip',
                            body: article.description || `New article: ${article.title}`
                        },
                        sound: 'default',
                        badge: badgeCount || 1,
                        'mutable-content': 1,
                        category: 'NEW_ARTICLE'
                    }
                },
                headers: {
                    'apns-priority': '10',
                    'apns-push-type': 'alert'
                }
            },
            webpush: {
                headers: {
                    Urgency: 'high'
                },
                notification: {
                    icon: '/assets/icons/icon-192x192.png',
                    badge: '/assets/icons/icon-72x72.png',
                    vibrate: [200, 100, 200],
                    requireInteraction: true,
                    actions: [
                        { action: 'read', title: '📖 Read Now' },
                        { action: 'later', title: '⏰ Read Later' }
                    ]
                },
                fcm_options: {
                    link: article.url
                }
            }
        };
        
        // ===== GỬI MULTICAST =====
        log.info(`📨 Sending multicast to ${tokens.length} devices...`);
        
        const batchResponse = await admin.messaging().sendEachForMulticast({
            tokens: tokens,
            notification: message.notification,
            data: message.data,
            android: message.android,
            apns: message.apns,
            webpush: message.webpush
        });
        
        log.success(`✅ Success: ${batchResponse.successCount}/${tokens.length}`);
        
        // ===== XỬ LÝ TOKEN LỖI =====
        if (batchResponse.failureCount > 0) {
            log.warn(`⚠️ ${batchResponse.failureCount} tokens failed`);
            
            const failedTokens = [];
            batchResponse.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                    log.error(`   Token ${idx} failed: ${resp.error?.message}`);
                }
            });
            
            // Deactivate invalid tokens
            if (failedTokens.length > 0) {
                log.info('📝 Deactivating invalid tokens...');
                const batch = db.batch();
                failedTokens.forEach(token => {
                    const tokenRef = db.collection('fcm_tokens').doc(token);
                    batch.update(tokenRef, { 
                        active: false, 
                        lastError: resp.error?.message,
                        deactivatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                });
                await batch.commit();
                log.success(`✅ Deactivated ${failedTokens.length} invalid tokens`);
            }
        }
        
        // ===== GỬI BADGE UPDATE =====
        if (badgeCount) {
            try {
                await admin.messaging().send({
                    data: {
                        type: 'BADGE_UPDATE',
                        count: badgeCount.toString(),
                        timestamp: Date.now().toString()
                    },
                    topic: CONFIG.topics.badge
                });
                log.success('✅ Badge update sent');
            } catch (badgeError) {
                log.warn('⚠️ Badge update failed: ' + badgeError.message);
            }
        }
        
        return true;
        
    } catch (error) {
        log.error('❌ FCM send failed: ' + error.message);
        if (error.stack) {
            log.error(error.stack);
        }
        return false;
    }
}

async function sendToIndividualTokens(message) {
    try {
        const tokensSnapshot = await db.collection('fcm_tokens')
            .where('active', '==', true)
            .limit(500)
            .get();
        
        if (tokensSnapshot.empty) {
            log.warn('No active tokens found');
            return;
        }
        
        const tokens = tokensSnapshot.docs.map(doc => doc.id);
        log.info(`Sending to ${tokens.length} individual tokens`);
        
        const batchResponse = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: message.notification,
            data: message.data,
            android: message.android,
            apns: message.apns,
            webpush: message.webpush
        });
        
        log.success(`Sent to ${batchResponse.successCount}/${tokens.length} devices`);
        
        // Cleanup invalid tokens
        if (batchResponse.failureCount > 0) {
            const failedTokens = [];
            batchResponse.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });
            
            if (failedTokens.length > 0) {
                const batch = db.batch();
                failedTokens.forEach(token => {
                    const tokenRef = db.collection('fcm_tokens').doc(token);
                    batch.update(tokenRef, { active: false, lastError: resp.error?.message });
                });
                await batch.commit();
                log.warn(`Deactivated ${failedTokens.length} invalid tokens`);
            }
        }
        
    } catch (error) {
        log.error('Individual send failed: ' + error.message);
    }
}

// ========== CACHE MANAGEMENT ==========

function saveToCache(articles) {
    try {
        const cachePath = path.join(__dirname, '..', CONFIG.cache.articles);
        const cache = {
            timestamp: Date.now(),
            articles: articles.map(a => ({
                title: a.title,
                url: a.url,
                notifiedAt: new Date().toISOString()
            }))
        };
        fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
        log.success('Cache saved');
    } catch (error) {
        log.warn('Cache save failed: ' + error.message);
    }
}

// ========== MAIN FUNCTION ==========

async function main() {
    log.section('PROCESSING ARTICLES');
    
    // Parse files từ environment - ĐỌC TỪ FILES
    const filesEnv = process.env.FILES || '';
    const files = filesEnv.split('\n').filter(f => f.trim());

    log.info(`Found ${files.length} file(s) from FILES environment`);

    if (files.length === 0) {
        log.warn('No files to process');
        process.exit(0);
    }

    // Chuyển đổi files thành articles
    const articles = [];
    for (const file of files) {
        if (!file.trim()) continue;
        
        const metadata = extractMetadata(file.trim());
        const cleanFile = file.trim().replace('_site/', '');
        const url = `https://bitcoin-peak-dip.com/${cleanFile}`;
        
        articles.push({
            file: file.trim(),
            title: metadata.title,
            description: metadata.description,
            url: url,
            readingTime: metadata.readingTime,
            image: metadata.image
        });
        
        log.info(`Added: ${metadata.title}`);
    }

    log.info(`Converted ${articles.length} files to articles`);
    
    // Khởi tạo Firebase
    initializeFirebase();
    
    // Cập nhật badge count
    let badgeCount = null;
    if (firebaseInitialized) {
        badgeCount = await updateBadgeCount(articles.length);
    }
    
    // Xử lý từng article
    const results = [];
    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        
        log.section(`Article ${i+1}/${articles.length}: ${article.title}`);
        log.info(`URL: ${article.url}`);
        
        const result = {
            title: article.title,
            url: article.url,
            discord: false,
            fcm: false
        };
        
        // Gửi Discord
        result.discord = await sendDiscord(article, i+1, articles.length);
        
        // Gửi FCM
        if (firebaseInitialized) {
            result.fcm = await sendFCM(article, badgeCount);
        }
        
        results.push(result);
        
        // Delay giữa các requests
        if (i < articles.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    
    // Lưu cache
    saveToCache(articles);
    
    // In summary
    log.section('SUMMARY');
    results.forEach((r, i) => {
        console.log(`${i+1}. ${r.title}`);
        console.log(`   Discord: ${r.discord ? '✅' : '❌'} | FCM: ${r.fcm ? '✅' : '❌'}`);
    });
    
    const successCount = results.filter(r => r.discord || r.fcm).length;
    log.success(`Processed ${successCount}/${articles.length} successfully`);
    
    // Gửi summary đến Discord private
    if (CONFIG.discord.privateWebhook && successCount > 0) {
        try {
            const summaryEmbed = {
                title: '📊 **Notification Summary**',
                color: 0x00d4ff,
                fields: [
                    {
                        name: '📄 Articles Processed',
                        value: articles.length.toString(),
                        inline: true
                    },
                    {
                        name: '✅ Successful',
                        value: successCount.toString(),
                        inline: true
                    },
                    {
                        name: '📊 Current Unread',
                        value: badgeCount?.toString() || 'N/A',
                        inline: true
                    },
                    {
                        name: '📅 Time',
                        value: new Date().toLocaleString(),
                        inline: false
                    }
                ],
                timestamp: new Date().toISOString()
            };
            
            await axios.post(CONFIG.discord.privateWebhook, { embeds: [summaryEmbed] });
            log.success('Summary sent to Discord');
        } catch (error) {
            log.warn('Summary send failed: ' + error.message);
        }
    }
    
    log.section('NOTIFICATION SYSTEM COMPLETED');
    process.exit(0);
}

// Run with error handling
main().catch(error => {
    log.error('Fatal error: ' + error.message);
    console.error(error.stack);
    process.exit(1);
});
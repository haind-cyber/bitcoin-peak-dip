#!/usr/bin/env node

/**
 * Bitcoin PeakDip - Notification Script
 * Version: 3.0.0 (Production Ready)
 * 
 * Chức năng:
 * - Public articles: Gửi FCM + Discord Public
 * - Private articles: Gửi Discord Private
 * - Tự động phát hiện file mới, không gửi lại file cũ
 * - Xử lý rate limit, retry tự động
 */

const admin = require('firebase-admin');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ==================== CONFIGURATION ====================
const CONFIG = {
  siteUrl: 'https://bitcoin-peak-dip.com',
  fcm: {
    topic: 'new_articles',
    badgeTopic: 'badge_update'
  },
  discord: {
    username: 'Bitcoin PeakDip',
    avatarUrl: 'https://bitcoin-peak-dip.com/assets/icons/icon-192x192.png',
    footerIcon: 'https://bitcoin-peak-dip.com/assets/icons/icon-72x72.png'
  },
  colors: {
    public: 0x00d4ff,    // Xanh cyan
    private: 0x9c27b0,   // Tím
    analysis: 0xf7931a,  // Cam
    signal: 0xff2e63      // Đỏ
  }
};

// ==================== INITIALIZE FIREBASE ====================
let messaging = null;
try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT not found - FCM disabled');
  } else {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    messaging = admin.messaging();
    console.log('✅ Firebase Admin initialized');
  }
} catch (error) {
  console.error('❌ Firebase init failed:', error.message);
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Parse frontmatter từ file markdown
 * @param {string} filePath - Đường dẫn file .md
 * @returns {Object|null} Thông tin bài viết
 */
function parseFrontMatter(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ File not found: ${filePath}`);
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      console.log('⚠️ No frontmatter found');
      return null;
    }
    
    const frontMatter = match[1];
    
    // Helper để lấy field
    const getField = (regex) => {
      const match = frontMatter.match(regex);
      return match ? match[1].replace(/^["']|["']$/g, '').trim() : null;
    };
    
    // Parse tags
    let tags = [];
    const tagsMatch = frontMatter.match(/tags:\s*\[(.*?)\]/);
    if (tagsMatch) {
      tags = tagsMatch[1].split(',').map(t => 
        t.trim().replace(/^["']|["']$/g, '')
      );
    }
    
    return {
      title: getField(/title:\s*(.+)/) || 'Untitled',
      description: getField(/description:\s*(.+)/) || '',
      tags: tags,
      date: getField(/date:\s*(.+)/) || new Date().toISOString().split('T')[0],
      readingTime: parseInt(getField(/reading_time:\s*(\d+)/) || '5'),
      level: getField(/level:\s*(.+)/) || 'Beginner',
      author: getField(/author:\s*(.+)/) || 'Bitcoin PeakDip Team',
      image: getField(/image:\s*(.+)/) || '/assets/images/og-default.jpg'
    };
  } catch (error) {
    console.error(`❌ Error parsing ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Gửi FCM notification
 * @param {Object} article - Thông tin bài viết
 * @param {string} fileName - Tên file (không đuôi)
 */
async function sendFCMNotification(article, fileName) {
  if (!messaging) {
    console.log('⚠️ FCM not available - skipping');
    return false;
  }
  
  const articleUrl = `${CONFIG.siteUrl}/learn/${fileName}.html`;
  
  try {
    console.log('   📱 Sending FCM...');
    
    // 1. Gửi notification chính
    const message = {
      topic: CONFIG.fcm.topic,
      notification: {
        title: '📚 Bài viết mới từ Bitcoin PeakDip',
        body: `${article.title} • ${article.readingTime} phút đọc • ${article.level}`
      },
      data: {
        type: 'NEW_ARTICLE',
        articleId: fileName,
        title: article.title,
        url: articleUrl,
        level: article.level,
        readingTime: article.readingTime.toString(),
        author: article.author,
        click_action: 'OPEN_ARTICLE'
      },
      android: {
        priority: 'high',
        notification: {
          icon: 'ic_notification',
          color: '#00d4ff',
          sound: 'default',
          channelId: 'new_articles'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true
          }
        }
      },
      webpush: {
        headers: { Urgency: 'high' },
        notification: {
          icon: '/assets/icons/icon-192x192.png',
          badge: '/assets/icons/icon-72x72.png',
          vibrate: [200, 100, 200],
          requireInteraction: true,
          actions: [
            { action: 'read', title: '📖 Đọc ngay' },
            { action: 'later', title: '⏰ Đọc sau' }
          ]
        },
        fcmOptions: { link: articleUrl }
      }
    };
    
    await messaging.send(message);
    console.log('   ✅ FCM notification sent');
    
    // 2. Gửi cập nhật badge
    await messaging.send({
      topic: CONFIG.fcm.badgeTopic,
      data: {
        type: 'UPDATE_BADGE',
        count: '1'
      }
    });
    console.log('   ✅ Badge update sent');
    
    return true;
    
  } catch (error) {
    console.error('   ❌ FCM error:', error.message);
    
    // Retry nếu rate limit
    if (error.code === 'messaging/topic-message-rate-exceeded') {
      console.log('   ⏳ Rate limited, retrying in 1s...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return sendFCMNotification(article, fileName);
    }
    return false;
  }
}

/**
 * Gửi Discord notification
 * @param {Object} article - Thông tin bài viết
 * @param {string} fileName - Tên file
 * @param {string} type - 'public' hoặc 'private'
 */
async function sendDiscordNotification(article, fileName, type = 'public') {
  const webhookUrl = type === 'private' 
    ? process.env.DISCORD_PRIVATE_WEBHOOK 
    : process.env.DISCORD_PUBLIC_WEBHOOK;
  
  if (!webhookUrl) {
    console.log(`   ⚠️ Discord ${type} webhook not configured`);
    return false;
  }
  
  const articleUrl = `${CONFIG.siteUrl}/learn/${fileName}.html`;
  const isPrivate = type === 'private';
  const color = isPrivate ? CONFIG.colors.private : CONFIG.colors.public;
  
  // Format tags cho Discord
  const tagDisplay = article.tags.map(t => `\`${t}\``).join(' ');
  
  try {
    console.log(`   💬 Sending Discord ${type}...`);
    
    const embed = {
      username: CONFIG.discord.username,
      avatar_url: CONFIG.discord.avatarUrl,
      content: isPrivate ? '@everyone 🔒 **PRIVATE SIGNAL** 🔒' : '@here 📢 **NEW PUBLIC ARTICLE** 📢',
      embeds: [{
        title: article.title,
        description: article.description || 'Click the link below to read the full article',
        url: articleUrl,
        color: color,
        fields: [
          {
            name: '📅 Published',
            value: new Date(article.date).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric'
            }),
            inline: true
          },
          {
            name: '⏱️ Reading Time',
            value: `${article.readingTime} min`,
            inline: true
          },
          {
            name: '📊 Level',
            value: article.level,
            inline: true
          },
          {
            name: '👤 Author',
            value: article.author,
            inline: true
          },
          {
            name: '🏷️ Tags',
            value: tagDisplay,
            inline: false
          },
          {
            name: '🔗 Direct Link',
            value: `[Click here to read](${articleUrl})`,
            inline: false
          }
        ],
        thumbnail: { url: CONFIG.discord.avatarUrl },
        footer: {
          text: 'Bitcoin PeakDip - Early Warning System',
          icon_url: CONFIG.discord.footerIcon
        },
        timestamp: new Date().toISOString()
      }]
    };
    
    // Thêm image nếu có
    if (article.image && article.image !== '/assets/images/og-default.jpg') {
      embed.embeds[0].image = { url: `${CONFIG.siteUrl}${article.image}` };
    }
    
    await axios.post(webhookUrl, embed);
    console.log(`   ✅ Discord ${type} sent`);
    return true;
    
  } catch (error) {
    console.error(`   ❌ Discord ${type} error:`, error.response?.data || error.message);
    
    // Retry nếu rate limit
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 1;
      console.log(`   ⏳ Rate limited, retrying after ${retryAfter}s...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return sendDiscordNotification(article, fileName, type);
    }
    return false;
  }
}

/**
 * MAIN FUNCTION
 */
async function main() {
  console.log('\n🚀 ===== BITCOIN PEAKDIP NOTIFICATION SYSTEM =====\n');
  console.log(`⏱️  Started at: ${new Date().toISOString()}`);
  
  // Lấy danh sách file mới (ADDED) từ GitHub Actions
  const addedFiles = (process.env.ADDED_FILES || '').split(' ').filter(Boolean);
  
  if (addedFiles.length === 0) {
    console.log('📭 No new files to process');
    return;
  }
  
  console.log(`📂 Found ${addedFiles.length} new file(s):`);
  addedFiles.forEach(f => console.log(`   ➕ ${f}`));
  
  const results = {
    total: addedFiles.length,
    public: 0,
    private: 0,
    errors: []
  };
  
  // Xử lý từng file
  for (let i = 0; i < addedFiles.length; i++) {
    const file = addedFiles[i];
    
    console.log(`\n📄 [${i+1}/${addedFiles.length}] Processing: ${file}`);
    
    // Parse frontmatter
    const article = parseFrontMatter(file);
    if (!article) {
      console.log('   ❌ Invalid frontmatter, skipping');
      results.errors.push({ file, error: 'Invalid frontmatter' });
      continue;
    }
    
    const fileName = path.basename(file, '.md');
    console.log(`   📌 Title: ${article.title}`);
    console.log(`   🏷️ Tags: ${article.tags.join(', ')}`);
    
    // ===== XỬ LÝ PUBLIC ARTICLE =====
    if (article.tags.includes('public')) {
      console.log('   📢 TYPE: PUBLIC');
      
      // Gửi FCM
      await sendFCMNotification(article, fileName);
      
      // Gửi Discord Public
      await sendDiscordNotification(article, fileName, 'public');
      
      results.public++;
    }
    
    // ===== XỬ LÝ PRIVATE ARTICLE =====
    if (article.tags.includes('private')) {
      console.log('   🔒 TYPE: PRIVATE');
      
      // Gửi Discord Private
      await sendDiscordNotification(article, fileName, 'private');
      
      results.private++;
    }
    
    // Không có tag phù hợp
    if (!article.tags.includes('public') && !article.tags.includes('private')) {
      console.log('   ⏭️ No matching tags, skipped');
    }
    
    // Delay giữa các file để tránh rate limit
    if (i < addedFiles.length - 1) {
      console.log('   ⏳ Waiting 2s before next file...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Tổng kết
  console.log('\n📊 ===== RESULTS =====');
  console.log(`📂 Total new files: ${results.total}`);
  console.log(`📱 Public (FCM+Discord): ${results.public}`);
  console.log(`🔒 Private (Discord only): ${results.private}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:', results.errors.length);
    process.exit(1);
  }
  
  console.log('\n✅ ===== ALL NOTIFICATIONS SENT SUCCESSFULLY =====');
}

// Run
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
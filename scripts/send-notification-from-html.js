// scripts/send-notification-from-html.js
#!/usr/bin/env node

/**
 * Bitcoin PeakDip - Notification Script từ HTML
 * Version: 4.0.0 - Phát hiện bài viết mới từ file HTML trong _site/
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
    public: 0x00d4ff,
    private: 0x9c27b0
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

// ==================== PARSE HTML FILES ====================
function parseArticleFromHTML(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Trích xuất title từ <title>
    const titleMatch = content.match(/<title>([^<]*)<\/title>/);
    let title = titleMatch ? titleMatch[1].trim() : '';
    
    // Nếu không có title, lấy từ filename
    if (!title) {
      const fileName = path.basename(filePath, '.html');
      title = fileName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Trích xuất meta description
    const descMatch = content.match(/<meta name="description" content="([^"]*)"/);
    const description = descMatch ? descMatch[1] : '';
    
    // Trích xuất ngày từ đường dẫn (nếu có)
    // Ví dụ: _site/learn/2026/03/06/bitcoin-analysis.html
    const dateMatch = filePath.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    let date = new Date().toISOString().split('T')[0];
    if (dateMatch) {
      date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    }
    
    // Tạo URL từ file path
    // Bỏ _site/ ở đầu
    let urlPath = filePath.replace(/^_site\//, '');
    const articleUrl = `${CONFIG.siteUrl}/${urlPath}`;
    
    // Xác định level từ class trong HTML (nếu có)
    const levelMatch = content.match(/class="[^"]*difficulty-([a-z]+)[^"]*"/);
    const level = levelMatch ? levelMatch[1] : 'Beginner';
    
    // Đọc thời gian đọc từ meta (nếu có)
    const readingMatch = content.match(/<meta name="reading-time" content="(\d+)"/);
    const readingTime = readingMatch ? parseInt(readingMatch[1]) : 5;
    
    // Lấy tên file làm ID
    const fileName = path.basename(filePath, '.html');
    
    return {
      id: fileName,
      title: title,
      description: description,
      url: articleUrl,
      date: date,
      readingTime: readingTime,
      level: level,
      author: 'Bitcoin PeakDip Team',
      tags: ['public']  // Mặc định là public
    };
  } catch (error) {
    console.error(`❌ Error parsing ${filePath}:`, error.message);
    return null;
  }
}

// ==================== SEND NOTIFICATIONS ====================
async function sendFCMNotification(article) {
  if (!messaging) return false;
  
  try {
    console.log(`   📱 Sending FCM for: ${article.title}`);
    
    // Gửi notification chính
    await messaging.send({
      topic: CONFIG.fcm.topic,
      notification: {
        title: '📚 Bài viết mới từ Bitcoin PeakDip',
        body: `${article.title} • ${article.readingTime} phút đọc • ${article.level}`
      },
      data: {
        type: 'NEW_ARTICLE',
        articleId: article.id,
        title: article.title,
        url: article.url,
        level: article.level,
        readingTime: article.readingTime.toString(),
        author: article.author
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
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
        fcmOptions: { link: article.url }
      }
    });
    console.log('   ✅ FCM notification sent');
    
    // Gửi badge update sau 500ms
    setTimeout(async () => {
      try {
        await messaging.send({
          topic: CONFIG.fcm.badgeTopic,
          data: {
            type: 'UPDATE_BADGE',
            count: '1'
          }
        });
        console.log('   ✅ Badge update sent');
      } catch (badgeError) {
        console.log('   ⚠️ Badge update error:', badgeError.message);
      }
    }, 500);
    
    return true;
  } catch (error) {
    console.error('   ❌ FCM error:', error.message);
    return false;
  }
}

async function sendDiscordNotification(article, type = 'public') {
  const webhookUrl = type === 'private' 
    ? process.env.DISCORD_PRIVATE_WEBHOOK 
    : process.env.DISCORD_PUBLIC_WEBHOOK;
  
  if (!webhookUrl) return false;
  
  const isPrivate = type === 'private';
  const color = isPrivate ? CONFIG.colors.private : CONFIG.colors.public;
  
  try {
    console.log(`   💬 Sending Discord ${type}...`);
    
    await axios.post(webhookUrl, {
      username: CONFIG.discord.username,
      avatar_url: CONFIG.discord.avatarUrl,
      content: isPrivate ? '@everyone 🔒 **PRIVATE SIGNAL** 🔒' : '@here 📢 **NEW ARTICLE** 📢',
      embeds: [{
        title: article.title,
        description: article.description || 'Click the link below to read',
        url: article.url,
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
            name: '🔗 Direct Link',
            value: `[Click here to read](${article.url})`,
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
    });
    
    console.log(`   ✅ Discord ${type} sent`);
    return true;
  } catch (error) {
    console.error(`   ❌ Discord error:`, error.message);
    return false;
  }
}

// ==================== MAIN FUNCTION ====================
async function main() {
  console.log('\n🚀 ===== BITCOIN PEAKDIP NOTIFICATION SYSTEM (HTML) =====\n');
  
  // Lấy danh sách file HTML từ environment variable
  const articlesJson = process.env.ARTICLES || '[]';
  let articles = [];
  
  try {
    articles = JSON.parse(articlesJson);
  } catch (e) {
    console.error('❌ Failed to parse ARTICLES JSON:', e.message);
    
    // Fallback: nếu có NEW_HTML_FILES
    const htmlFiles = (process.env.NEW_HTML_FILES || '').split(' ').filter(Boolean);
    if (htmlFiles.length > 0) {
      console.log(`📂 Found ${htmlFiles.length} HTML files from environment`);
      
      for (const file of htmlFiles) {
        const article = parseArticleFromHTML(file);
        if (article) {
          articles.push(article);
        }
      }
    }
  }
  
  if (articles.length === 0) {
    console.log('📭 No articles to process');
    return;
  }
  
  console.log(`📂 Found ${articles.length} new article(s)\n`);
  
  const results = {
    total: articles.length,
    public: 0,
    private: 0,
    errors: []
  };
  
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    
    console.log(`\n📄 [${i+1}/${articles.length}] Processing: ${article.title}`);
    console.log(`   📌 URL: ${article.url}`);
    
    // PUBLIC article (mặc định)
    if (article.tags.includes('public') || !article.tags.includes('private')) {
      console.log('   📢 TYPE: PUBLIC');
      if (messaging) {
        await sendFCMNotification(article);
      }
      await sendDiscordNotification(article, 'public');
      results.public++;
    }
    
    // PRIVATE article (nếu có tag private)
    if (article.tags.includes('private')) {
      console.log('   🔒 TYPE: PRIVATE');
      await sendDiscordNotification(article, 'private');
      results.private++;
    }
    
    // Delay giữa các file
    if (i < articles.length - 1) {
      console.log('   ⏳ Waiting 1s...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n📊 ===== RESULTS =====');
  console.log(`📂 Total articles: ${results.total}`);
  console.log(`📱 Public (FCM+Discord): ${results.public}`);
  console.log(`🔒 Private (Discord only): ${results.private}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:', results.errors.length);
    process.exit(1);
  }
  
  console.log('\n✅ ===== ALL NOTIFICATIONS SENT =====');
}

// ==================== RUN ====================
main().catch(console.error);
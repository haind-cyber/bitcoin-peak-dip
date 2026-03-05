#!/usr/bin/env node

/**
 * Bitcoin PeakDip - Notification Script
 * Version: 3.1.0 - PRODUCTION READY
 * Gửi notifications khi có bài viết mới (Public → FCM + Discord, Private → Discord)
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

// ==================== UTILITY FUNCTIONS ====================

function parseFrontMatter(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    
    const frontMatter = match[1];
    
    const getField = (regex) => {
      const match = frontMatter.match(regex);
      return match ? match[1].replace(/^["']|["']$/g, '').trim() : null;
    };
    
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

async function sendFCMNotification(article, fileName) {
  if (!messaging) return false;
  
  const articleUrl = `${CONFIG.siteUrl}/learn/${fileName}.html`;
  
  try {
    console.log('   📱 Sending FCM...');
    
    // Gửi notification chính
    await messaging.send({
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
        fcmOptions: { link: articleUrl }
      }
    });
    console.log('   ✅ FCM notification sent');
    
    // Gửi badge update sau 500ms để tránh rate limit
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

async function sendDiscordNotification(article, fileName, type = 'public') {
  const webhookUrl = type === 'private' 
    ? process.env.DISCORD_PRIVATE_WEBHOOK 
    : process.env.DISCORD_PUBLIC_WEBHOOK;
  
  if (!webhookUrl) return false;
  
  const articleUrl = `${CONFIG.siteUrl}/learn/${fileName}.html`;
  const isPrivate = type === 'private';
  const color = isPrivate ? CONFIG.colors.private : CONFIG.colors.public;
  
  try {
    console.log(`   💬 Sending Discord ${type}...`);
    
    await axios.post(webhookUrl, {
      username: CONFIG.discord.username,
      avatar_url: CONFIG.discord.avatarUrl,
      content: isPrivate ? '@everyone 🔒 **PRIVATE SIGNAL** 🔒' : '@here 📢 **NEW PUBLIC ARTICLE** 📢',
      embeds: [{
        title: article.title,
        description: article.description || 'Click the link below to read',
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
    });
    
    console.log(`   ✅ Discord ${type} sent`);
    return true;
    
  } catch (error) {
    console.error(`   ❌ Discord error:`, error.message);
    return false;
  }
}

async function main() {
  console.log('\n🚀 ===== BITCOIN PEAKDIP NOTIFICATION SYSTEM =====\n');
  
  const addedFiles = (process.env.ADDED_FILES || '').split(' ').filter(Boolean);
  
  if (addedFiles.length === 0) {
    console.log('📭 No new files to process');
    return;
  }
  
  console.log(`📂 Found ${addedFiles.length} new file(s)`);
  
  const results = {
    total: addedFiles.length,
    public: 0,
    private: 0,
    errors: []
  };
  
  for (let i = 0; i < addedFiles.length; i++) {
    const file = addedFiles[i];
    
    console.log(`\n📄 [${i+1}/${addedFiles.length}] Processing: ${file}`);
    
    const article = parseFrontMatter(file);
    if (!article) {
      console.log('   ❌ Invalid frontmatter, skipping');
      results.errors.push({ file, error: 'Invalid frontmatter' });
      continue;
    }
    
    const fileName = path.basename(file, '.md');
    console.log(`   📌 Title: ${article.title}`);
    console.log(`   🏷️ Tags: ${article.tags.join(', ')}`);
    
    // PUBLIC article
    if (article.tags.includes('public')) {
      console.log('   📢 TYPE: PUBLIC');
      await sendFCMNotification(article, fileName);
      await sendDiscordNotification(article, fileName, 'public');
      results.public++;
    }
    
    // PRIVATE article
    if (article.tags.includes('private')) {
      console.log('   🔒 TYPE: PRIVATE');
      await sendDiscordNotification(article, fileName, 'private');
      results.private++;
    }
    
    // No matching tags
    if (!article.tags.includes('public') && !article.tags.includes('private')) {
      console.log('   ⏭️ No matching tags, skipped');
    }
    
    // Delay between files
    if (i < addedFiles.length - 1) {
      console.log('   ⏳ Waiting 2s...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n📊 ===== RESULTS =====');
  console.log(`📂 Total: ${results.total}`);
  console.log(`📱 Public (FCM+Discord): ${results.public}`);
  console.log(`🔒 Private (Discord only): ${results.private}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:', results.errors.length);
    process.exit(1);
  }
  
  console.log('\n✅ ===== ALL NOTIFICATIONS SENT =====');
}

main().catch(console.error);
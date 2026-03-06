#!/usr/bin/env node

/**
 * Bitcoin PeakDip - Simple Notification Script
 * Version: 1.0.0
 */

const axios = require('axios');
const fs = require('fs');

console.log('\n🚀 ===== BITCOIN PEAKDIP NOTIFICATION =====\n');

// Lấy files từ environment
const filesEnv = process.env.FILES || '';
const files = filesEnv.split('\n').filter(f => f.trim());

console.log(`📂 Found ${files.length} new file(s)`);

if (files.length === 0) {
  console.log('No files to process');
  process.exit(0);
}

async function main() {
  for (let i = 0; i < files.length; i++) {
    const file = files[i].trim();
    console.log(`\n📄 [${i+1}/${files.length}] Processing: ${file}`);

    // Đọc title từ file
    let title = 'New Article';
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const titleMatch = content.match(/<title>([^<]*)<\/title>/);
      title = titleMatch ? titleMatch[1].trim() : title;
    }

    // Tạo URL
    const cleanFile = file.replace('_site/', '');
    const url = `https://bitcoin-peak-dip.com/${cleanFile}`;

    console.log(`   Title: ${title}`);
    console.log(`   URL: ${url}`);

    // Gửi Discord
    if (process.env.DISCORD_PUBLIC_WEBHOOK) {
      try {
        await axios.post(process.env.DISCORD_PUBLIC_WEBHOOK, {
          content: `📢 **NEW ARTICLE**: ${title}\n${url}`
        });
        console.log('   ✅ Discord sent');
      } catch (err) {
        console.log('   ❌ Discord error:', err.message);
      }
    }
  }

  console.log('\n✅ All notifications sent!');
}

main().catch(console.error);

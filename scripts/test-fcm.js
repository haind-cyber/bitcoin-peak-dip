// scripts/test-fcm.js - Giữ nguyên logic, chỉ thêm cảnh báo
const admin = require('firebase-admin');

console.log('\n🧪 ===== FCM TEST SUITE =====\n');
console.log(`📋 Mode: ${process.env.GITHUB_ACTIONS ? 'GitHub Actions' : 'Local'}`);

// CẢNH BÁO an toàn
if (!process.env.GITHUB_ACTIONS) {
    console.log('⚠️  LOCAL DEVELOPMENT MODE');
    console.log('🔒 Secrets loaded from GitHub CLI (not from .env)\n');
}

const admin = require('firebase-admin');
const fs = require('fs');

console.log('\n🧪 ===== FCM TEST SUITE =====\n');

async function testFCM() {
    // Test 1: Kiểm tra credentials
    console.log('📋 Test 1: Firebase Credentials');
    let credentials = null;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            console.log('   ✅ Credentials loaded from env');
        } catch (e) {
            console.log('   ❌ Failed to parse credentials from env');
        }
    }
    
    if (!credentials && fs.existsSync('firebase-credentials.json')) {
        try {
            credentials = JSON.parse(fs.readFileSync('firebase-credentials.json', 'utf8'));
            console.log('   ✅ Credentials loaded from file');
        } catch (e) {
            console.log('   ❌ Failed to parse credentials from file');
        }
    }
    
    if (!credentials) {
        console.log('   ❌ No credentials found');
        process.exit(1);
    }
    
    // Test 2: Initialize Firebase
    console.log('\n📋 Test 2: Firebase Initialization');
    try {
        admin.initializeApp({
            credential: admin.credential.cert(credentials),
            projectId: 'bitcoinpeakdip'
        });
        console.log('   ✅ Firebase initialized');
    } catch (e) {
        console.log('   ❌ Firebase init failed:', e.message);
        process.exit(1);
    }
    
    // Test 3: Firestore Connection
    console.log('\n📋 Test 3: Firestore Connection');
    try {
        const db = admin.firestore();
        const testRef = db.collection('_test').doc('connection');
        await testRef.set({ 
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            test: true
        });
        await testRef.delete();
        console.log('   ✅ Firestore connected');
    } catch (e) {
        console.log('   ❌ Firestore connection failed:', e.message);
    }
    
    // Test 4: FCM Send
    console.log('\n📋 Test 4: FCM Send');
    try {
        const message = {
            notification: {
                title: '🧪 Test Notification',
                body: 'This is a test from GitHub Actions'
            },
            data: {
                type: 'TEST',
                timestamp: Date.now().toString()
            },
            topic: 'test'
        };
        
        const response = await admin.messaging().send(message);
        console.log('   ✅ FCM message sent:', response);
    } catch (e) {
        console.log('   ❌ FCM send failed:', e.message);
    }
    
    // Test 5: Token Management
    console.log('\n📋 Test 5: Token Management');
    try {
        const db = admin.firestore();
        const tokens = await db.collection('fcm_tokens').limit(5).get();
        console.log(`   ✅ Found ${tokens.size} tokens in database`);
        
        if (tokens.size > 0) {
            const token = tokens.docs[0].id;
            console.log(`   Sample token: ${token.substring(0, 20)}...`);
        }
    } catch (e) {
        console.log('   ❌ Token query failed:', e.message);
    }
    
    console.log('\n✅ Test suite completed\n');
}

testFCM().catch(console.error);
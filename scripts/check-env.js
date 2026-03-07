// scripts/check-env-fixed.js
const fs = require('fs');
const path = require('path');

console.log('\n🔍 ===== ENVIRONMENT CHECK (FIXED) =====\n');

// System info
console.log('📊 System:');
console.log(`   Node: ${process.version}`);
console.log(`   Platform: ${process.platform}`);
console.log(`   Arch: ${process.arch}`);
console.log(`   CWD: ${process.cwd()}\n`);

// Check dependencies với nhiều phương pháp
console.log('📦 Dependencies:');

const deps = [
    { name: 'axios', required: true },
    { name: 'firebase-admin', required: true },
    { name: '@google-cloud/firestore', required: false }
];

deps.forEach(dep => {
    process.stdout.write(`   ${dep.name}... `);
    
    // Method 1: require.resolve
    try {
        const resolvedPath = require.resolve(dep.name);
        const pkgPath = path.join(resolvedPath.split(dep.name)[0], dep.name, 'package.json');
        
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            console.log(`✅ v${pkg.version}`);
            console.log(`      📍 ${resolvedPath}`);
        } else {
            // Try to get version from module
            const mod = require(dep.name);
            const version = mod.SDK_VERSION || mod.version || 'unknown';
            console.log(`✅ v${version}`);
        }
    } catch (e) {
        // Method 2: Check node_modules directly
        try {
            const localPath = path.join(process.cwd(), 'node_modules', dep.name, 'package.json');
            if (fs.existsSync(localPath)) {
                const pkg = JSON.parse(fs.readFileSync(localPath, 'utf8'));
                console.log(`✅ v${pkg.version} (from node_modules)`);
            } else {
                console.log(`❌ not found`);
                if (dep.required) {
                    console.log(`      ⚠️ Required dependency missing!`);
                }
            }
        } catch (e2) {
            console.log(`❌ not found`);
            if (dep.required) {
                console.log(`      ⚠️ Required dependency missing!`);
            }
        }
    }
});

// Check node_modules structure
console.log('\n📂 Node_modules check:');
const nodeModulesPath = path.join(process.cwd(), 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
    const dirs = fs.readdirSync(nodeModulesPath).filter(d => !d.startsWith('.'));
    console.log(`   Found ${dirs.length} packages`);
    
    // Check specifically for firebase-admin
    const fbAdminPath = path.join(nodeModulesPath, 'firebase-admin');
    if (fs.existsSync(fbAdminPath)) {
        console.log(`   ✅ firebase-admin directory exists`);
        
        // Check package.json
        const pkgPath = path.join(fbAdminPath, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            console.log(`   📦 Version: ${pkg.version}`);
        }
    } else {
        console.log(`   ❌ firebase-admin directory NOT found!`);
    }
} else {
    console.log(`   ❌ node_modules directory not found!`);
}

// Environment variables
console.log('\n🔧 Environment:');
const envVars = [
    'FIREBASE_SERVICE_ACCOUNT',
    'DISCORD_PUBLIC_WEBHOOK',
    'DISCORD_PRIVATE_WEBHOOK'
];

envVars.forEach(env => {
    if (process.env[env]) {
        console.log(`   ✅ ${env} is set`);
    } else {
        console.log(`   ⚠️ ${env} is not set`);
    }
});

console.log('\n✅ Check completed\n');
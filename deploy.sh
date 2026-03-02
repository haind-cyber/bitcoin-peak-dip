#!/bin/bash
# deploy.sh

MAIN_PATH="/c/Users/ADMIN/OneDrive/bitcoin-peak-dip"
SITE_PATH="/c/Users/ADMIN/OneDrive/bitcoin-peak-dip-btcpeakdip"

echo "🚀 Bắt đầu deploy..."

cd "$MAIN_PATH"

# Build site
echo "📦 Building site..."
bundle exec jekyll build

# Copy sang worktree
echo "📋 Copying _site to btcpeakdip branch..."
rm -rf "$SITE_PATH"/*
cp -r _site/* "$SITE_PATH/"
touch "$SITE_PATH/.nojekyll"

# Commit và push
cd "$SITE_PATH"
git add .
git commit -m "Deploy: $(date +'%Y-%m-%d %H:%M:%S')"
git push origin btcpeakdip

cd "$MAIN_PATH"
echo "✅ Deploy complete!"
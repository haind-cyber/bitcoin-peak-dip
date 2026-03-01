@echo off
echo 🔨 ===== BITCOIN PEAKDIP BUILD SYSTEM =====
echo.

REM Tăng version
node build.js
if %errorlevel% neq 0 (
    echo ❌ Failed to update version
    exit /b 1
)

echo.
echo 🚀 Building Jekyll site...
echo.

REM Kiểm tra bundle
where bundle >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ bundle not found. Installing bundler...
    gem install bundler
    bundle install
)

REM Build với bundle exec
call bundle exec jekyll build

if %errorlevel% equ 0 (
    echo.
    echo ✅ ===== BUILD COMPLETED SUCCESSFULLY =====
) else (
    echo.
    echo ❌ ===== BUILD FAILED =====
)

pause
@echo off
echo 🔨 Starting development server...
echo.

REM Tăng version
node build.js

echo.
echo 🚀 Starting Jekyll server...
echo.

call bundle exec jekyll serve --livereload

pause
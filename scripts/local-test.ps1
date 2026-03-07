# local-test.ps1 - Cách an toàn để test local
param(
    [switch]$DryRun
)

Write-Host "🧪 Local Test Script" -ForegroundColor Cyan
Write-Host "========================`n"

# Kiểm tra GitHub CLI
if (!(Get-Command "gh" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ GitHub CLI not found" -ForegroundColor Red
    Write-Host "   Install: winget install --id GitHub.cli" -ForegroundColor Yellow
    exit 1
}

# Kiểm tra authenticated
gh auth status > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "🔑 Please login to GitHub first:"
    gh auth login
}

Write-Host "📦 Getting secrets from GitHub..." -ForegroundColor Yellow

# Lấy secrets
$secrets = @(
    "FIREBASE_SERVICE_ACCOUNT",
    "DISCORD_PUBLIC_WEBHOOK",
    "DISCORD_PRIVATE_WEBHOOK"
)

foreach ($secret in $secrets) {
    $value = gh secret list --repo "haind-cyber/bitcoin-peak-dip" --json name,value | 
        ConvertFrom-Json | 
        Where-Object { $_.name -eq $secret } | 
        Select-Object -ExpandProperty value
    
    if ($value) {
        [Environment]::SetEnvironmentVariable($secret, $value, "Process")
        Write-Host "  ✅ $secret loaded" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ $secret not found" -ForegroundColor Yellow
    }
}

# Chạy test
if ($DryRun) {
    Write-Host "`n🧪 DRY RUN MODE - Not sending actual notifications" -ForegroundColor Cyan
    node scripts/test-fcm.js --dry-run
} else {
    Write-Host "`n🚀 Running actual test..." -ForegroundColor Cyan
    node scripts/test-fcm.js
}
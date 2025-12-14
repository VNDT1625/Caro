# Script để chạy migration cho currency packages
# Chạy: .\scripts\run-currency-migration.ps1

Write-Host "=== Currency Packages Migration ===" -ForegroundColor Cyan

# Đọc file .env để lấy Supabase credentials
$envFile = "backend/.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            Set-Item -Path "env:$key" -Value $value
        }
    }
}

$supabaseUrl = $env:SUPABASE_URL
if (-not $supabaseUrl) { $supabaseUrl = $env:VITE_SUPABASE_URL }
$serviceKey = $env:SUPABASE_SERVICE_KEY
if (-not $serviceKey) { $serviceKey = $env:SUPABASE_SERVICE_ROLE_KEY }

if (-not $supabaseUrl -or -not $serviceKey) {
    Write-Host "ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend/.env" -ForegroundColor Red
    exit 1
}

Write-Host "Supabase URL: $supabaseUrl" -ForegroundColor Gray

# Đọc SQL migration
$sqlFile = "infra/migrations/20251205_000001_create_currency_packages_table.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "ERROR: Migration file not found: $sqlFile" -ForegroundColor Red
    exit 1
}

Write-Host "Reading migration file..." -ForegroundColor Yellow
$sql = Get-Content $sqlFile -Raw

Write-Host ""
Write-Host "Migration SQL loaded. Please run this SQL in Supabase SQL Editor:" -ForegroundColor Green
Write-Host "1. Go to: $supabaseUrl (Dashboard)" -ForegroundColor Cyan
Write-Host "2. Navigate to SQL Editor" -ForegroundColor Cyan
Write-Host "3. Paste and run the following SQL:" -ForegroundColor Cyan
Write-Host ""
Write-Host "=== SQL START ===" -ForegroundColor Magenta
Write-Host $sql
Write-Host "=== SQL END ===" -ForegroundColor Magenta
Write-Host ""
Write-Host "After running the migration, the currency packages will be available." -ForegroundColor Green
Write-Host "Access the Currency Shop at: http://localhost:5173/#currency-shop" -ForegroundColor Cyan

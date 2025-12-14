# Script: Run Payment Sessions Migration
# Purpose: Tạo bảng payment_sessions để fix VNPay timeout issue

param(
    [string]$DbHost = "127.0.0.1",
    [string]$DbPort = "3306",
    [string]$DbName = "mindpoint",
    [string]$DbUser = "root",
    [string]$DbPassword = "",
    [switch]$UseSupabase = $false
)

Write-Host "🔧 VNPay Payment Sessions Migration" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if migration file exists
$migrationFile = "infra/migrations/20251204_000001_create_payment_sessions_table.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Migration file not found: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Migration file found: $migrationFile" -ForegroundColor Green
Write-Host ""

if ($UseSupabase) {
    Write-Host "📋 Supabase Mode" -ForegroundColor Yellow
    Write-Host "1. Go to: https://app.supabase.com" -ForegroundColor White
    Write-Host "2. Select your project" -ForegroundColor White
    Write-Host "3. Go to SQL Editor" -ForegroundColor White
    Write-Host "4. Click 'New Query'" -ForegroundColor White
    Write-Host "5. Copy & paste the migration file content" -ForegroundColor White
    Write-Host "6. Click 'Run'" -ForegroundColor White
    Write-Host ""
    Write-Host "Migration file content:" -ForegroundColor Cyan
    Write-Host "========================" -ForegroundColor Cyan
    Get-Content $migrationFile
    Write-Host ""
    Write-Host "After running the migration, press Enter to continue..." -ForegroundColor Yellow
    Read-Host
} else {
    Write-Host "🗄️  MySQL Local Mode" -ForegroundColor Yellow
    Write-Host "Host: $DbHost" -ForegroundColor White
    Write-Host "Port: $DbPort" -ForegroundColor White
    Write-Host "Database: $DbName" -ForegroundColor White
    Write-Host "User: $DbUser" -ForegroundColor White
    Write-Host ""
    
    # Check if mysql command exists
    $mysqlCmd = Get-Command mysql -ErrorAction SilentlyContinue
    if (-not $mysqlCmd) {
        Write-Host "❌ MySQL client not found. Please install MySQL or use -UseSupabase flag" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Running migration..." -ForegroundColor Cyan
    
    # Run migration
    if ($DbPassword) {
        mysql -h $DbHost -P $DbPort -u $DbUser -p$DbPassword $DbName < $migrationFile
    } else {
        mysql -h $DbHost -P $DbPort -u $DbUser $DbName < $migrationFile
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Verifying table creation..." -ForegroundColor Cyan
        
        # Verify table
        if ($DbPassword) {
            mysql -h $DbHost -P $DbPort -u $DbUser -p$DbPassword $DbName -e "SHOW TABLES LIKE 'payment_sessions';"
        } else {
            mysql -h $DbHost -P $DbPort -u $DbUser $DbName -e "SHOW TABLES LIKE 'payment_sessions';"
        }
        
        Write-Host ""
        Write-Host "✅ Table payment_sessions created successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Migration failed!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "1. Restart backend: cd backend && php -S localhost:8001 -t public" -ForegroundColor White
Write-Host "2. Test payment: http://localhost:5173 → Subscription → VNPay" -ForegroundColor White
Write-Host "3. Use test card: 9704198526191432198" -ForegroundColor White
Write-Host ""
Write-Host "✅ Done!" -ForegroundColor Green

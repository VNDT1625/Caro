# Script để chạy migration avatar frame
# Chạy: .\scripts\run-avatar-frame-migration.ps1

Write-Host "=== Avatar Frame Migration ===" -ForegroundColor Cyan
Write-Host ""

# Đọc file migration
$migrationFile = "infra/migrations/20251209_000040_add_equipped_avatar_frame.sql"

if (Test-Path $migrationFile) {
    Write-Host "Migration file found: $migrationFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "Nội dung migration:" -ForegroundColor Yellow
    Write-Host "---"
    Get-Content $migrationFile
    Write-Host "---"
    Write-Host ""
    Write-Host "Để chạy migration, copy nội dung trên vào Supabase SQL Editor và execute." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Hoặc sử dụng Supabase CLI:" -ForegroundColor Cyan
    Write-Host "  supabase db push" -ForegroundColor White
} else {
    Write-Host "Migration file not found: $migrationFile" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Hướng dẫn ===" -ForegroundColor Cyan
Write-Host "1. Vào Supabase Dashboard > SQL Editor"
Write-Host "2. Paste nội dung migration"
Write-Host "3. Click 'Run'"
Write-Host ""
Write-Host "Sau khi chạy migration:"
Write-Host "- Bảng profiles sẽ có cột equipped_avatar_frame"
Write-Host "- Category avatar_frame sẽ được tạo"
Write-Host "- 8 sample frames sẽ được thêm vào bảng items"

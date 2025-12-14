# Script to run tournament migration
# Run this in Supabase SQL Editor or via CLI

Write-Host "=== Tournament Migration Script ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Please run the following SQL in your Supabase SQL Editor:" -ForegroundColor Yellow
Write-Host ""
Write-Host "File: infra/migrations/20251208_000001_create_tournaments_table.sql" -ForegroundColor Green
Write-Host ""
Write-Host "Steps:" -ForegroundColor Cyan
Write-Host "1. Go to Supabase Dashboard > SQL Editor"
Write-Host "2. Copy content from infra/migrations/20251208_000001_create_tournaments_table.sql"
Write-Host "3. Run the SQL"
Write-Host "4. Verify tables created: tournaments, tournament_participants, tournament_matches"
Write-Host ""

# Show the migration file path
$migrationFile = "infra/migrations/20251208_000001_create_tournaments_table.sql"
if (Test-Path $migrationFile) {
    Write-Host "Migration file found!" -ForegroundColor Green
    Write-Host "Content preview:" -ForegroundColor Yellow
    Get-Content $migrationFile | Select-Object -First 30
} else {
    Write-Host "Migration file not found at: $migrationFile" -ForegroundColor Red
}

# Apply New Migrations Script
# Run this in Supabase SQL Editor or via psql

Write-Host "🚀 Applying game logic and ranking system migrations..." -ForegroundColor Cyan
Write-Host ""

# Migration 0012: Validate turn on moves
Write-Host "📝 Migration 0012: Adding turn validation to moves policy..." -ForegroundColor Yellow
$migration12 = Get-Content ".\migrations\0012_validate_turn_on_moves.sql" -Raw
Write-Host $migration12
Write-Host "✅ Migration 0012 ready to apply" -ForegroundColor Green
Write-Host ""

# Migration 0013: Rebalance ranks
Write-Host "📝 Migration 0013: Rebalancing rank system..." -ForegroundColor Yellow
$migration13 = Get-Content ".\migrations\0013_rebalance_ranks.sql" -Raw
Write-Host $migration13
Write-Host "✅ Migration 0013 ready to apply" -ForegroundColor Green
Write-Host ""

Write-Host "📋 MANUAL STEPS:" -ForegroundColor Magenta
Write-Host "1. Go to Supabase Dashboard → SQL Editor" -ForegroundColor White
Write-Host "2. Copy content from migrations/0012_validate_turn_on_moves.sql" -ForegroundColor White
Write-Host "3. Run the SQL" -ForegroundColor White
Write-Host "4. Copy content from migrations/0013_rebalance_ranks.sql" -ForegroundColor White
Write-Host "5. Run the SQL" -ForegroundColor White
Write-Host "6. Verify: SELECT * FROM rank_distribution;" -ForegroundColor White
Write-Host ""

Write-Host "🎯 Expected results after migrations:" -ForegroundColor Cyan
Write-Host "  - moves_insert policy updated with turn validation" -ForegroundColor White
Write-Host "  - rank_history table created" -ForegroundColor White
Write-Host "  - update_user_rank function updated with new thresholds" -ForegroundColor White
Write-Host "  - All existing users' ranks recalculated" -ForegroundColor White
Write-Host "  - rank_distribution view created" -ForegroundColor White
Write-Host ""

Write-Host "✅ Migrations preparation complete!" -ForegroundColor Green
Write-Host "   Next: Apply them in Supabase SQL Editor" -ForegroundColor Yellow

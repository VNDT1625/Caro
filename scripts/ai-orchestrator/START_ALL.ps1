# ============================================
# MASTER SCRIPT - Chạy tất cả AI Orchestration
# ============================================
# Cách dùng: Mở PowerShell, chạy:
#   cd C:\PJ\caro
#   .\scripts\ai-orchestrator\START_ALL.ps1
# ============================================

$ProjectRoot = "C:\PJ\caro"
$OrchestratorDir = "$ProjectRoot\scripts\ai-orchestrator"

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     CARO AI ORCHESTRATOR - NIGHT MODE      ║" -ForegroundColor Cyan
Write-Host "╠════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  GPT CLI: Payment System + AI Training     ║" -ForegroundColor Yellow
Write-Host "║  Kiro: Ranked BO3 System                   ║" -ForegroundColor Yellow
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Reset status files
$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"

@{
    agent = "kiro"
    status = "idle"
    current_task = "ranked-bo3-system"
    last_update = $timestamp
    completed_tasks = @()
    errors = @()
    message_for_gpt = "Kiro san sang lam Ranked BO3"
} | ConvertTo-Json | Set-Content "$OrchestratorDir\kiro_status.json"

@{
    agent = "gpt"
    status = "idle"
    current_task = "payment-system"
    last_update = $timestamp
    completed_tasks = @()
    errors = @()
    message_for_kiro = "GPT san sang lam Payment System"
} | ConvertTo-Json | Set-Content "$OrchestratorDir\gpt_status.json"

Write-Host "[OK] Reset status files" -ForegroundColor Green

# Copy GPT prompt to clipboard
$gptPrompt = Get-Content "$OrchestratorDir\prompts\gpt_master_prompt.md" -Raw
Set-Clipboard -Value $gptPrompt
Write-Host "[OK] GPT prompt da copy vao clipboard" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  BUOC TIEP THEO:                       " -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. MO TERMINAL MOI cho GPT CLI:" -ForegroundColor White
Write-Host "   codex --model o3 --full-auto" -ForegroundColor Cyan
Write-Host "   (Paste prompt tu clipboard)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. TRONG KIRO, paste prompt nay:" -ForegroundColor White
Write-Host "   ----------------------------------------" -ForegroundColor Gray

$kiroPrompt = @"
Doc scripts/ai-orchestrator/prompts/for_kiro.md va lam Ranked BO3 System.
Bat dau voi Task 2: Implement SeriesManagerService.
Cap nhat scripts/ai-orchestrator/kiro_status.json sau moi buoc.
Neu gap loi, thu cach khac. KHONG DUNG LAI.
"@

Write-Host $kiroPrompt -ForegroundColor Green
Write-Host "   ----------------------------------------" -ForegroundColor Gray
Write-Host ""
Write-Host "3. CHAY MONITOR (optional):" -ForegroundColor White
Write-Host "   .\scripts\ai-orchestrator\auto_helper.ps1" -ForegroundColor Cyan
Write-Host "   (Se beep khi Kiro gap loi)" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  DI NGU THOI! GPT se lam qua dem.      " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# Auto-launch GPT CLI in new terminal
Write-Host ""
Write-Host "[AUTO] Dang khoi dong GPT CLI..." -ForegroundColor Cyan

$gptPromptShort = @"
Doc file C:/PJ/caro/scripts/ai-orchestrator/prompts/gpt_master_prompt.md va lam theo. Lam Payment System truoc. KHONG HOI - LAM LIEN TUC.
"@

# Save prompt to temp file for GPT
$gptPromptShort | Set-Content "$OrchestratorDir\gpt_input.txt"

# Try to launch codex CLI
try {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\PJ\caro; Write-Host 'GPT CLI Ready - Paste prompt va chay:' -ForegroundColor Green; Write-Host 'codex --model o3 --full-auto' -ForegroundColor Yellow; Get-Content scripts\ai-orchestrator\gpt_input.txt"
    Write-Host "[OK] Da mo terminal moi cho GPT CLI" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Khong the tu dong mo terminal. Mo thu cong." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  XONG! Bay gio ban can:               " -ForegroundColor Green
Write-Host "  1. Trong terminal GPT: chay codex    " -ForegroundColor White
Write-Host "  2. Trong Kiro: paste prompt (da copy)" -ForegroundColor White
Write-Host "  3. Di ngu!                           " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Start monitor in background
Write-Host "Bat dau monitor... (Ctrl+C de dung)" -ForegroundColor Yellow
& "$OrchestratorDir\auto_helper.ps1"

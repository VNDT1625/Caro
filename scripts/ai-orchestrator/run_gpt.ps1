# GPT CLI Orchestrator Script
# Chạy: .\scripts\ai-orchestrator\run_gpt.ps1

$ProjectRoot = "C:\PJ\caro"
$OrchestratorDir = "$ProjectRoot\scripts\ai-orchestrator"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GPT CLI Orchestrator - Caro Project  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Update GPT status to working
$gptStatus = @{
    agent = "gpt"
    status = "working"
    current_task = "payment-1"
    last_update = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
    completed_tasks = @()
    errors = @()
    message_for_kiro = "Bat dau lam Payment System. Kiro tiep tuc Ranked BO3."
}
$gptStatus | ConvertTo-Json | Set-Content "$OrchestratorDir\gpt_status.json"

Write-Host "[INFO] GPT status updated to 'working'" -ForegroundColor Green
Write-Host "[INFO] Starting GPT CLI with /approach mode..." -ForegroundColor Yellow
Write-Host ""

# Master prompt for GPT
$MasterPrompt = @"
Ban la GPT Codex Max, dang lam viec tren du an Caro game tai C:\PJ\caro.

## NHIEM VU CHINH
1. Doc file scripts/ai-orchestrator/gpt_master_prompt.md de hieu full context
2. Lam Payment System truoc (tao spec, implement Stripe integration)
3. Khi xong, cap nhat scripts/ai-orchestrator/gpt_status.json
4. Tiep tuc lam AI Training Upgrade

## QUY TAC
- KHONG DUNG LAI cho den khi het task hoac gap loi nghiem trong
- Cap nhat status files sau moi buoc quan trong
- Neu gap loi, ghi vao gpt_status.json va thu cach khac
- Doc kiro_status.json de biet Kiro dang lam gi

## BAT DAU
1. Doc scripts/ai-orchestrator/gpt_master_prompt.md
2. Doc backend/app/Services/SubscriptionService.php de hieu code hien tai
3. Tao .kiro/specs/payment-system/requirements.md
4. Implement PaymentController.php
5. Test va cap nhat status

KHONG HỎI - CỨ LÀM LIÊN TỤC!
"@

# Run GPT CLI
# Option 1: Using codex CLI (if installed)
# codex --model o3 --approach "$MasterPrompt"

# Option 2: Using OpenAI API directly (fallback)
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  COPY PROMPT NAY VAO GPT CLI:         " -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host $MasterPrompt -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "[TIP] Chay lenh sau trong terminal GPT:" -ForegroundColor Cyan
Write-Host "codex --model o3 --full-auto" -ForegroundColor Green
Write-Host ""
Write-Host "Hoac paste prompt tren vao GPT CLI va chon /approach" -ForegroundColor Cyan
Write-Host ""

# Monitor loop (optional - for status checking)
Write-Host "[INFO] Bat dau monitor loop..." -ForegroundColor Yellow
Write-Host "[INFO] Nhan Ctrl+C de dung" -ForegroundColor Yellow
Write-Host ""

$counter = 0
while ($true) {
    Start-Sleep -Seconds 60
    $counter++
    
    # Read status files
    $gptStatusFile = Get-Content "$OrchestratorDir\gpt_status.json" | ConvertFrom-Json
    $kiroStatusFile = Get-Content "$OrchestratorDir\kiro_status.json" | ConvertFrom-Json
    
    Write-Host "[$counter min] GPT: $($gptStatusFile.status) - $($gptStatusFile.current_task) | Kiro: $($kiroStatusFile.status) - $($kiroStatusFile.current_task)" -ForegroundColor Gray
    
    # Check if both completed
    if ($gptStatusFile.status -eq "completed" -and $kiroStatusFile.status -eq "completed") {
        Write-Host "[DONE] Ca hai AI da hoan thanh tasks!" -ForegroundColor Green
        break
    }
    
    # Check for errors
    if ($gptStatusFile.errors.Count -gt 0) {
        Write-Host "[WARN] GPT gap loi: $($gptStatusFile.errors[-1])" -ForegroundColor Red
    }
}

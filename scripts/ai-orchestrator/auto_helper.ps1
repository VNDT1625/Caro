# Auto Helper Script - Monitors Kiro status and prepares prompts
# Chạy script này trong PowerShell, nó sẽ:
# 1. Monitor kiro_status.json mỗi 30 giây
# 2. Khi Kiro gặp lỗi, tạo prompt giải quyết
# 3. Tự động copy prompt vào clipboard
# 4. Phát tiếng beep để báo bạn (nếu bạn còn thức)

$ProjectRoot = "C:\PJ\caro"
$OrchestratorDir = "$ProjectRoot\scripts\ai-orchestrator"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Kiro Auto Helper - Monitoring...     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

function Get-KiroStatus {
    $statusFile = "$OrchestratorDir\kiro_status.json"
    if (Test-Path $statusFile) {
        return Get-Content $statusFile | ConvertFrom-Json
    }
    return $null
}

function Write-PromptForKiro {
    param($error_message)
    
    $prompt = @"
Tôi vừa gặp lỗi: $error_message

Hãy thử cách khác:
1. Nếu lỗi executePwsh - dùng fsWrite thay vì shell command
2. Nếu lỗi file not found - kiểm tra path và tạo file mới
3. Nếu lỗi syntax - đọc lại file và sửa

Tiếp tục làm task hiện tại trong scripts/ai-orchestrator/prompts/for_kiro.md
KHÔNG HỎI - CỨ LÀM TIẾP.
"@
    
    $prompt | Set-Content "$OrchestratorDir\prompts\kiro_recovery_prompt.md"
    Set-Clipboard -Value $prompt
    
    Write-Host "[ALERT] Kiro gap loi! Prompt da copy vao clipboard." -ForegroundColor Red
    Write-Host "[TIP] Paste vao Kiro va nhan Enter" -ForegroundColor Yellow
    
    # Beep 3 times
    [console]::beep(1000, 300)
    Start-Sleep -Milliseconds 200
    [console]::beep(1000, 300)
    Start-Sleep -Milliseconds 200
    [console]::beep(1000, 300)
}

function Update-GptPromptWithKiroError {
    param($error_message)
    
    $gptHelp = @"
# GPT - Kiro cần giúp đỡ!

Kiro gặp lỗi: $error_message

Hãy:
1. Đọc file mà Kiro đang làm
2. Tìm cách fix lỗi
3. Ghi solution vào scripts/ai-orchestrator/prompts/kiro_solution.md
4. Tiếp tục task của bạn

Solution format:
- Nếu cần sửa code: ghi code đúng
- Nếu cần tạo file: ghi nội dung file
- Nếu cần chạy command: ghi command thay thế
"@
    
    $gptHelp | Set-Content "$OrchestratorDir\prompts\gpt_help_kiro.md"
    Write-Host "[INFO] Da tao prompt de GPT giup Kiro" -ForegroundColor Green
}

# Main monitoring loop
$lastError = ""
while ($true) {
    $status = Get-KiroStatus
    
    if ($status -and $status.status -eq "error" -and $status.errors.Count -gt 0) {
        $currentError = $status.errors[-1]
        
        if ($currentError -ne $lastError) {
            Write-Host ""
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] KIRO GAP LOI!" -ForegroundColor Red
            Write-Host "Error: $currentError" -ForegroundColor Yellow
            
            Write-PromptForKiro -error_message $currentError
            Update-GptPromptWithKiroError -error_message $currentError
            
            $lastError = $currentError
        }
    }
    elseif ($status -and $status.status -eq "completed") {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Kiro: COMPLETED - $($status.current_task)" -ForegroundColor Green
    }
    elseif ($status -and $status.status -eq "working") {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Kiro: Working on $($status.current_task)" -ForegroundColor Gray
    }
    
    Start-Sleep -Seconds 30
}

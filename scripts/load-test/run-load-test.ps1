# Load Test Runner Script
# Usage: .\run-load-test.ps1 -Users 50 -SpawnRate 5 -Duration 60

param(
    [int]$Users = 50,
    [int]$SpawnRate = 5,
    [int]$Duration = 60,
    [string]$Host = "http://localhost:8001",
    [switch]$WebUI
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== MindPoint Arena Load Test ===" -ForegroundColor Cyan
Write-Host "Users: $Users"
Write-Host "Spawn Rate: $SpawnRate users/sec"
Write-Host "Duration: $Duration seconds"
Write-Host "Target: $Host"
Write-Host ""

# Check if locust is installed
$locustCheck = Get-Command locust -ErrorAction SilentlyContinue
if (-not $locustCheck) {
    Write-Host "Locust not found. Installing..." -ForegroundColor Yellow
    pip install -r "$scriptDir\requirements.txt"
}

if ($WebUI) {
    Write-Host "Starting Locust Web UI at http://localhost:8089" -ForegroundColor Green
    locust -f "$scriptDir\locustfile.py" --host=$Host
} else {
    Write-Host "Running headless test..." -ForegroundColor Green
    locust -f "$scriptDir\locustfile.py" --host=$Host --users $Users --spawn-rate $SpawnRate --run-time "${Duration}s" --headless --csv="$scriptDir\results"
    
    Write-Host ""
    Write-Host "=== Test Complete ===" -ForegroundColor Cyan
    Write-Host "Results saved to: $scriptDir\results_*.csv"
}

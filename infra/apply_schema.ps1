<#
Simple PowerShell helper to apply `supabase_schema.sql` to a Postgres connection.

Usage:
  .\apply_schema.ps1 -ConnString 'postgresql://user:pass@host:5432/dbname' [-FilePath '.\supabase_schema.sql']

This script shells out to `psql`. Ensure `psql` is installed and available in PATH.
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ConnString,
    [string]$FilePath = '.\supabase_schema.sql'
)

if (-not (Test-Path $FilePath)) {
    Write-Error "SQL file not found: $FilePath"
    exit 2
}

Write-Host "Applying schema file: $FilePath to $ConnString"

$psqlArgs = "--set=ON_ERROR_STOP=on -f `"$FilePath`" `"$ConnString`""

try {
    $proc = Start-Process -FilePath psql -ArgumentList $psqlArgs -NoNewWindow -Wait -PassThru -ErrorAction Stop
    if ($proc.ExitCode -ne 0) {
        Write-Error "psql exited with code $($proc.ExitCode)"
        exit $proc.ExitCode
    }
    Write-Host "Schema applied successfully."
} catch {
    Write-Error "Failed to run psql: $_"
    exit 10
}

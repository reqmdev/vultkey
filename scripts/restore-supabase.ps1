param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [Parameter(Mandatory = $true)]
  [string]$ConfirmProjectRef,
  [Parameter(Mandatory = $true)]
  [string]$ConfirmRestore
)

$ErrorActionPreference = "Stop"

function Read-DotEnvValue($content, $name) {
  foreach ($line in ($content -split "`n")) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    if ($trimmed -match "^$([regex]::Escape($name))\s*=\s*(.+?)\s*$") {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return $null
}

if ($ConfirmRestore -ne "RESTORE_DATABASE") {
  throw "Restore requires -ConfirmRestore RESTORE_DATABASE."
}

if (-not (Test-Path -LiteralPath $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

$envPath = Join-Path (Get-Location) ".env.local"
if (-not (Test-Path -LiteralPath $envPath)) {
  throw "No .env.local file found."
}

$envContent = Get-Content -LiteralPath $envPath -Raw
$supabaseUrl = Read-DotEnvValue $envContent "NEXT_PUBLIC_SUPABASE_URL"
$dbUrl = Read-DotEnvValue $envContent "SUPABASE_DB_URL"

if (-not $supabaseUrl -or $supabaseUrl -notmatch "https://([^.]+)\.supabase\.co") {
  throw "NEXT_PUBLIC_SUPABASE_URL is missing or invalid."
}

$projectRef = $Matches[1]
if ($ConfirmProjectRef -ne $projectRef) {
  throw "Project confirmation mismatch. Expected -ConfirmProjectRef $projectRef."
}

if (-not $dbUrl) {
  throw "SUPABASE_DB_URL is required for restore."
}

"Restoring $BackupFile into project $projectRef..."
psql "$dbUrl" -f "$BackupFile"
exit $LASTEXITCODE

param(
  [string]$OutputDir = "backups"
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

$envPath = Join-Path (Get-Location) ".env.local"
if (-not (Test-Path -LiteralPath $envPath)) {
  throw "No .env.local file found."
}

$envContent = Get-Content -LiteralPath $envPath -Raw
$dbUrl = Read-DotEnvValue $envContent "SUPABASE_DB_URL"
if (-not $dbUrl) {
  throw "SUPABASE_DB_URL is required for backups."
}

if (-not (Test-Path -LiteralPath $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$output = Join-Path $OutputDir "supabase-$timestamp.sql"

"Writing Supabase backup to $output..."
pnpm dlx supabase db dump --db-url "$dbUrl" --file "$output"
exit $LASTEXITCODE

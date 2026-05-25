param(
  [ValidateSet("dev", "staging", "prod")]
  [string]$Target = "dev",
  [string]$ConfirmProjectRef = ""
)

$ErrorActionPreference = "Stop"

function Read-DotEnvValue($content, $name) {
  $lines = $content -split "`n"
  foreach ($line in $lines) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    if ($trimmed -match "^$([regex]::Escape($name))\s*=\s*(.+?)\s*$") {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }

  return $null
}

function Test-PlaceholderValue($value) {
  if (-not $value) {
    return $false
  }

  return $value -match "<[^>]+>" -or
    $value -match "your-project-ref" -or
    $value -match "your-project" -or
    $value -match "your-db-password" -or
    $value -match "aws-0-region" -or
    $value -match "POOLER_HOST" -or
    $value -match "PROJECT_REF" -or
    $value -match "DB_PASSWORD"
}

$envPath = Join-Path (Get-Location) ".env"
$envLocalPath = Join-Path (Get-Location) ".env.local"

if (Test-Path -LiteralPath $envLocalPath) {
  $envContent = Get-Content -LiteralPath $envLocalPath -Raw
} elseif (Test-Path -LiteralPath $envPath) {
  $envContent = Get-Content -LiteralPath $envPath -Raw
} else {
  throw "No .env or .env.local file found."
}

$supabaseUrl = Read-DotEnvValue $envContent "NEXT_PUBLIC_SUPABASE_URL"
$dbUrl = Read-DotEnvValue $envContent "SUPABASE_DB_URL"
$accessToken = Read-DotEnvValue $envContent "SUPABASE_ACCESS_TOKEN"
$misspelledAccessToken = Read-DotEnvValue $envContent "SUPABASE_ACCES_TOKEN"
$dbPassword = Read-DotEnvValue $envContent "SUPABASE_DB_PASSWORD"

if (-not $accessToken -and $misspelledAccessToken) {
  "Found SUPABASE_ACCES_TOKEN. Using it, but rename it to SUPABASE_ACCESS_TOKEN when you can."
  $accessToken = $misspelledAccessToken
}

if (-not $supabaseUrl -or $supabaseUrl -notmatch "https://([^.]+)\.supabase\.co") {
  throw "NEXT_PUBLIC_SUPABASE_URL is missing or invalid."
}

$projectRef = $Matches[1]

if ($Target -eq "prod" -and $ConfirmProjectRef -ne $projectRef) {
  throw "Production migration requires -ConfirmProjectRef $projectRef."
}

if ($Target -ne "prod" -and $supabaseUrl -notmatch "localhost|127\.0\.0\.1|supabase\.co") {
  throw "Unexpected Supabase URL for non-production target."
}

if ($dbUrl) {
  if (Test-PlaceholderValue $dbUrl) {
    throw "SUPABASE_DB_URL still contains placeholder text. Copy the exact Session Pooler URI from Supabase Dashboard > Project Settings > Database > Pooler settings, replace the password, and keep the real pooler host."
  }

  if ($dbUrl -match "@db\.[^.]+\.supabase\.co:5432") {
    throw "SUPABASE_DB_URL is a Direct connection URI, which is IPv6-only unless you have the Supabase IPv4 add-on. Use the Session Pooler URI from Project Settings > Database > Pooler settings instead."
  }

  "Applying Supabase migrations to $Target project $projectRef with SUPABASE_DB_URL..."
  pnpm dlx supabase db push --db-url "$dbUrl" --yes
  exit $LASTEXITCODE
}

if (-not $accessToken -or -not $dbPassword) {
  throw "Missing credentials. Add either SUPABASE_DB_URL, or both SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD to .env.local."
}

$env:SUPABASE_ACCESS_TOKEN = $accessToken

"Linking Supabase $Target project $projectRef..."
pnpm dlx supabase link --project-ref "$projectRef" --password "$dbPassword"

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

"Applying Supabase migrations..."
pnpm dlx supabase db push --yes
exit $LASTEXITCODE

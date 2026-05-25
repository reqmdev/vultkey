param(
  [switch]$IncludeBuild
)

$ErrorActionPreference = "Stop"

$paths = @(
  ".next/dev",
  ".next/trace",
  ".next/trace-build",
  ".next/diagnostics",
  "tsconfig.tsbuildinfo"
)

if ($IncludeBuild) {
  $paths += @(".next", "out", "build", "dist")
}

foreach ($path in $paths) {
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Recurse -Force
    "Removed $path"
  }
}

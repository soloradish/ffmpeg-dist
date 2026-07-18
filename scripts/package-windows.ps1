param(
  [Parameter(Mandatory = $true)][string]$Stage,
  [Parameter(Mandatory = $true)][string]$Destination
)

$ErrorActionPreference = 'Stop'
$resolvedStage = (Resolve-Path -LiteralPath $Stage).Path
$resolvedParent = Split-Path -Parent $resolvedStage
$stageName = Split-Path -Leaf $resolvedStage
$destinationParent = Split-Path -Parent $Destination
New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
if (Test-Path -LiteralPath $Destination) {
  Remove-Item -LiteralPath $Destination -Force
}
Push-Location $resolvedParent
try {
  Compress-Archive -LiteralPath $stageName -DestinationPath $Destination -CompressionLevel Optimal
} finally {
  Pop-Location
}

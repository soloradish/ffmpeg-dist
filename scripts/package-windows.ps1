param(
  [Parameter(Mandatory = $true)][string]$Stage,
  [Parameter(Mandatory = $true)][string]$Destination
)

$ErrorActionPreference = 'Stop'
$resolvedStage = (Resolve-Path -LiteralPath $Stage).Path
$resolvedDestination = [System.IO.Path]::GetFullPath($Destination)
$resolvedParent = Split-Path -Parent $resolvedStage
$stageName = Split-Path -Leaf $resolvedStage
$destinationParent = Split-Path -Parent $resolvedDestination
New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
if (Test-Path -LiteralPath $resolvedDestination) {
  Remove-Item -LiteralPath $resolvedDestination -Force
}
Push-Location $resolvedParent
try {
  Compress-Archive -LiteralPath $stageName -DestinationPath $resolvedDestination -CompressionLevel Optimal
} finally {
  Pop-Location
}

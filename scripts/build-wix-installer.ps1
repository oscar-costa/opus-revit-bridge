param(
    [ValidateSet("2020", "2021", "2022", "2023", "2024", "2025", "2026")]
    [string[]]$RevitVersions = @("2024"),

    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Release",

    [string]$PayloadRoot,

    [string]$ProductVersion = "0.1.0",

    [switch]$SkipStage
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-ExternalCommand {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory
  )

  Push-Location $WorkingDirectory
  try {
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed: $FilePath $($Arguments -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDirectory
$resolvedPayloadRoot = if ($PayloadRoot) {
  $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($PayloadRoot)
} else {
  Join-Path $repoRoot "artifacts\installer-payload"
}

if (-not $SkipStage) {
  $stageArguments = @(
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    (Join-Path $repoRoot "scripts\stage-installer-payload.ps1"),
    "-Configuration",
    $Configuration,
    "-RevitVersions"
  ) + $RevitVersions

  Invoke-ExternalCommand -FilePath "powershell" -Arguments $stageArguments -WorkingDirectory $repoRoot
}

Invoke-ExternalCommand -FilePath "powershell" -Arguments @(
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  (Join-Path $repoRoot "scripts\generate-wix-installer-assets.ps1"),
  "-PayloadRoot",
  $resolvedPayloadRoot
) -WorkingDirectory $repoRoot

Invoke-ExternalCommand -FilePath "dotnet" -Arguments @(
  "build",
  "installer\OpusRevitBridge.Installer.wixproj",
  "-c",
  $Configuration,
  "-p:PayloadRoot=$resolvedPayloadRoot",
  "-p:ProductVersion=$ProductVersion"
) -WorkingDirectory $repoRoot

Write-Host "Built WiX installer using payload root: $resolvedPayloadRoot"
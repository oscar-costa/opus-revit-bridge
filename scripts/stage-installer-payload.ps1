param(
    [ValidateSet("2020", "2021", "2022", "2023", "2024", "2025", "2026")]
    [string[]]$RevitVersions = @("2024"),

  [switch]$AllSupportedRevitVersions,

    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Release",

    [string]$PayloadRoot,

    [string]$NodeExecutablePath,

    [switch]$SkipBridgeServiceBuild,

    [switch]$SkipPluginBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$supportedRevitVersions = @("2020", "2021", "2022", "2023", "2024", "2025", "2026")

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

function New-CleanDirectory {
  param([string]$Path)

  if (Test-Path -Path $Path) {
    Remove-Item -Path $Path -Recurse -Force
  }

  New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Copy-DirectoryContents {
  param(
    [string]$Source,
    [string]$Destination
  )

  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  Copy-Item -Path (Join-Path $Source "*") -Destination $Destination -Recurse -Force
}

function Resolve-NodeExecutablePath {
  param([string]$ConfiguredPath)

  if ($ConfiguredPath) {
    return $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ConfiguredPath)
  }

  $nodeCommand = Get-Command node -ErrorAction Stop
  return $nodeCommand.Source
}

function Get-RevitApiPath {
  param([string]$Version)

  return "C:\Program Files\Autodesk\Revit $Version"
}

function Write-TextFile {
  param(
    [string]$Path,
    [string]$Content
  )

  $parent = Split-Path -Parent $Path
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Set-Content -Path $Path -Value $Content -Encoding UTF8
}

function Get-SelectedRevitVersions {
  param(
    [string[]]$RequestedVersions,
    [bool]$UseAllSupportedVersions
  )

  if ($UseAllSupportedVersions) {
    return $supportedRevitVersions
  }

  return $RequestedVersions |
    Sort-Object -Unique { [int]$_ }
}

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDirectory
$selectedRevitVersions = Get-SelectedRevitVersions -RequestedVersions $RevitVersions -UseAllSupportedVersions $AllSupportedRevitVersions.IsPresent
$resolvedPayloadRoot = if ($PayloadRoot) {
  $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($PayloadRoot)
} else {
  Join-Path $repoRoot "artifacts\installer-payload"
}

$productName = "Opus Revit Bridge"
$programFilesProductRoot = Join-Path $resolvedPayloadRoot "ProgramFiles\$productName"
$programDataProductRoot = Join-Path $resolvedPayloadRoot "ProgramData\$productName"
$bridgeServiceSourceRoot = Join-Path $repoRoot "bridge-service"
$bridgeServiceInstallRoot = Join-Path $programFilesProductRoot "bridge-service"
$revitPluginInstallRoot = Join-Path $programFilesProductRoot "RevitPlugin"
$nodeRuntimeRoot = Join-Path $programFilesProductRoot "runtime\node"
$toolsRoot = Join-Path $programFilesProductRoot "tools"
$configRoot = Join-Path $programDataProductRoot "config"
$outputRoot = Join-Path $programDataProductRoot "output"
$nodeExecutable = Resolve-NodeExecutablePath -ConfiguredPath $NodeExecutablePath

if (-not $SkipBridgeServiceBuild) {
  Invoke-ExternalCommand -FilePath "npm" -Arguments @("run", "build") -WorkingDirectory $bridgeServiceSourceRoot
}

foreach ($revitVersion in $selectedRevitVersions) {
  if ($SkipPluginBuild) {
    continue
  }

  Invoke-ExternalCommand -FilePath "dotnet" -Arguments @(
    "build",
    "RevitPlugin/RevitOpusBridge.csproj",
    "-c",
    $Configuration,
    "-p:RevitVersion=$revitVersion",
    "-p:RevitApiPath=$(Get-RevitApiPath -Version $revitVersion)"
  ) -WorkingDirectory $repoRoot
}

New-CleanDirectory -Path $resolvedPayloadRoot
New-Item -ItemType Directory -Path $bridgeServiceInstallRoot -Force | Out-Null
New-Item -ItemType Directory -Path $revitPluginInstallRoot -Force | Out-Null
New-Item -ItemType Directory -Path $nodeRuntimeRoot -Force | Out-Null
New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
New-Item -ItemType Directory -Path $configRoot -Force | Out-Null
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

Copy-DirectoryContents -Source (Join-Path $bridgeServiceSourceRoot "dist") -Destination (Join-Path $bridgeServiceInstallRoot "dist")
Copy-Item -Path (Join-Path $bridgeServiceSourceRoot "package.json") -Destination (Join-Path $bridgeServiceInstallRoot "package.json") -Force
Copy-Item -Path (Join-Path $bridgeServiceSourceRoot "package-lock.json") -Destination (Join-Path $bridgeServiceInstallRoot "package-lock.json") -Force
Copy-DirectoryContents -Source (Join-Path $bridgeServiceSourceRoot "config") -Destination $configRoot
Copy-Item -Path $nodeExecutable -Destination (Join-Path $nodeRuntimeRoot "node.exe") -Force
Copy-Item -Path (Join-Path $repoRoot "scripts\install-revit-plugin.ps1") -Destination (Join-Path $toolsRoot "install-revit-plugin.ps1") -Force

Invoke-ExternalCommand -FilePath "npm" -Arguments @("ci", "--omit=dev") -WorkingDirectory $bridgeServiceInstallRoot

$launcherContent = @"
@echo off
setlocal
set "OPUS_BRIDGE_SERVICE_ROOT=%~dp0bridge-service"
set "OPUS_BRIDGE_CONFIG_DIR=%ProgramData%\Opus Revit Bridge\config"
set "OPUS_BRIDGE_DATA_DIR=%ProgramData%\Opus Revit Bridge"
"%~dp0runtime\node\node.exe" "%OPUS_BRIDGE_SERVICE_ROOT%\dist\src\index.js"
"@

Write-TextFile -Path (Join-Path $programFilesProductRoot "start-bridge-service.cmd") -Content $launcherContent
Write-TextFile -Path (Join-Path $outputRoot ".gitkeep") -Content ""

$pluginVersions = @()
foreach ($revitVersion in $selectedRevitVersions) {
  $pluginSourcePath = Join-Path $repoRoot "RevitPlugin\bin\$Configuration\Revit$revitVersion\net48\RevitOpusBridge.dll"
  if (-not (Test-Path -Path $pluginSourcePath -PathType Leaf)) {
    throw "Plugin DLL not found at '$pluginSourcePath'."
  }

  $versionRoot = Join-Path $revitPluginInstallRoot "Revit$revitVersion"
  New-Item -ItemType Directory -Path $versionRoot -Force | Out-Null
  Copy-Item -Path $pluginSourcePath -Destination (Join-Path $versionRoot "RevitOpusBridge.dll") -Force

  $pluginVersions += [PSCustomObject]@{
    version = $revitVersion
    assemblyPath = "C:\Program Files\Opus Revit Bridge\RevitPlugin\Revit$revitVersion\RevitOpusBridge.dll"
    addinDirectory = "C:\ProgramData\Autodesk\Revit\Addins\$revitVersion"
  }
}

$layoutMetadata = [PSCustomObject]@{
  productName = $productName
  payloadRoot = $resolvedPayloadRoot
  installRoots = [PSCustomObject]@{
    programFiles = "C:\Program Files\Opus Revit Bridge"
    programData = "C:\ProgramData\Opus Revit Bridge"
  }
  bridgeService = [PSCustomObject]@{
    serviceRoot = "C:\Program Files\Opus Revit Bridge\bridge-service"
    configDirectory = "C:\ProgramData\Opus Revit Bridge\config"
    dataDirectory = "C:\ProgramData\Opus Revit Bridge"
    nodeExecutable = "C:\Program Files\Opus Revit Bridge\runtime\node\node.exe"
    launcher = "C:\Program Files\Opus Revit Bridge\start-bridge-service.cmd"
  }
  revitPlugin = [PSCustomObject]@{
    selectedVersions = $selectedRevitVersions
    versions = $pluginVersions
  }
}

$layoutJson = $layoutMetadata | ConvertTo-Json -Depth 6
Write-TextFile -Path (Join-Path $resolvedPayloadRoot "installer-layout.json") -Content $layoutJson

Write-Host "Staged installer payload to: $resolvedPayloadRoot"
Write-Host "Program Files payload: $programFilesProductRoot"
Write-Host "Program Data payload: $programDataProductRoot"
Write-Host "Revit versions included: $($selectedRevitVersions -join ', ')"

param(
    [ValidateSet("2020", "2021", "2022", "2023", "2024", "2025", "2026")]
    [string]$RevitVersion = "2024",

    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug",

    [ValidateSet("CurrentUser", "AllUsers")]
    [string]$InstallScope = "CurrentUser",

    [string]$AssemblyPath,

    [string]$AddinDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RevitAddinDirectory {
  param(
    [string]$Version,
    [string]$Scope
  )

  $rootDirectory = if ($Scope -eq "AllUsers") { $env:ProgramData } else { $env:APPDATA }

  return Join-Path $rootDirectory "Autodesk\Revit\Addins\$Version"
}

function Get-DefaultAssemblyPath {
  param(
    [string]$RepositoryRoot,
    [string]$Version,
    [string]$BuildConfiguration
  )

  return Join-Path $RepositoryRoot "RevitPlugin\bin\$BuildConfiguration\Revit$Version\net48\RevitOpusBridge.dll"
}

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDirectory
$resolvedAssemblyPath = if ($AssemblyPath) {
  $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($AssemblyPath)
} else {
  Get-DefaultAssemblyPath -RepositoryRoot $repoRoot -Version $RevitVersion -BuildConfiguration $Configuration
}

$addinDirectory = if ($AddinDirectory) {
  $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($AddinDirectory)
} else {
  Get-RevitAddinDirectory -Version $RevitVersion -Scope $InstallScope
}
$addinPath = Join-Path $addinDirectory "RevitOpusBridge.addin"

if (-not (Test-Path -Path $resolvedAssemblyPath -PathType Leaf)) {
  throw (
    "Plugin DLL not found at '$resolvedAssemblyPath'. Build the plugin first with: " +
    "dotnet build RevitPlugin/RevitOpusBridge.csproj " +
    "-p:RevitVersion=$RevitVersion " +
    "-p:RevitApiPath=`"C:\Program Files\Autodesk\Revit $RevitVersion`""
  )
}

New-Item -ItemType Directory -Path $addinDirectory -Force | Out-Null

$manifest = @"
<?xml version="1.0" encoding="utf-8" standalone="no"?>
<RevitAddIns>
  <AddIn Type="Application">
    <Name>RevitOpusBridge</Name>
    <Assembly>$resolvedAssemblyPath</Assembly>
    <AddInId>724E2F54-394D-4A64-9E2A-4FF53A3B4B03</AddInId>
    <FullClassName>RevitOpusBridge.App</FullClassName>
    <VendorId>OPBR</VendorId>
    <VendorDescription>Opus Revit Bridge</VendorDescription>
  </AddIn>
</RevitAddIns>
"@

Set-Content -Path $addinPath -Value $manifest -Encoding UTF8

Write-Host "Installed RevitOpusBridge manifest to: $addinPath"
Write-Host "Plugin assembly path: $resolvedAssemblyPath"
Write-Host "Install scope: $InstallScope"
Write-Host "Restart Revit $RevitVersion if it is already open."

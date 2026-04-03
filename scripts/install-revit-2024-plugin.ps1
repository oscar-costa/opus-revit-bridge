Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Debug"
)

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDirectory
$pluginDirectory = Join-Path $repoRoot "RevitPlugin"
$dllPath = Join-Path $pluginDirectory "bin\$Configuration\net48\RevitOpusBridge.dll"
$addinDirectory = Join-Path $env:APPDATA "Autodesk\Revit\Addins\2024"
$addinPath = Join-Path $addinDirectory "RevitOpusBridge.addin"

if (-not (Test-Path -Path $dllPath -PathType Leaf)) {
  throw 'Plugin DLL not found at ''{0}''. Build the plugin first with: dotnet build RevitPlugin/RevitOpusBridge.csproj -p:RevitApiPath="C:\Program Files\Autodesk\Revit 2024"' -f $dllPath
}

New-Item -ItemType Directory -Path $addinDirectory -Force | Out-Null

$manifest = @"
<?xml version="1.0" encoding="utf-8" standalone="no"?>
<RevitAddIns>
  <AddIn Type="Application">
    <Name>RevitOpusBridge</Name>
    <Assembly>$dllPath</Assembly>
    <AddInId>724E2F54-394D-4A64-9E2A-4FF53A3B4B03</AddInId>
    <FullClassName>RevitOpusBridge.App</FullClassName>
    <VendorId>OPBR</VendorId>
    <VendorDescription>Opus Revit Bridge</VendorDescription>
  </AddIn>
</RevitAddIns>
"@

Set-Content -Path $addinPath -Value $manifest -Encoding UTF8

Write-Host "Installed RevitOpusBridge manifest to: $addinPath"
Write-Host "Plugin assembly path: $dllPath"
Write-Host "Restart Revit 2024 if it is already open."

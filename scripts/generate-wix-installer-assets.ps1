param(
    [string]$PayloadRoot,

    [string]$OutputDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Xml.Linq

function New-CleanDirectory {
  param([string]$Path)

  if (Test-Path -Path $Path) {
    Remove-Item -Path $Path -Recurse -Force
  }

  New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Get-RelativePath {
  param(
    [string]$BasePath,
    [string]$TargetPath
  )

  $resolvedBasePath = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $BasePath).Path)
  $resolvedTargetPath = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $TargetPath).Path)

  $basePrefix = $resolvedBasePath.TrimEnd("\") + "\"
  if ($resolvedTargetPath.ToLowerInvariant().StartsWith($basePrefix.ToLowerInvariant())) {
    return $resolvedTargetPath.Substring($basePrefix.Length)
  }

  if ($resolvedTargetPath.ToLowerInvariant() -eq $resolvedBasePath.ToLowerInvariant()) {
    return "."
  }

  $baseUri = [System.Uri]::new(($resolvedBasePath.TrimEnd("\") + "\"))
  $targetUri = [System.Uri]::new($resolvedTargetPath)

  return [System.Uri]::UnescapeDataString(
    $baseUri.MakeRelativeUri($targetUri).ToString().Replace("/", "\")
  )
}

function Get-HashedId {
  param(
    [string]$Prefix,
    [string]$Value
  )

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $sha256.ComputeHash($bytes)
  } finally {
    $sha256.Dispose()
  }
  $hash = ([System.BitConverter]::ToString($hashBytes)).Replace("-", "")
  return "${Prefix}_$($hash.Substring(0, 24))"
}

function New-WixElement {
  param(
    [System.Xml.Linq.XName]$Name,
    [hashtable]$Attributes
  )

  $element = [System.Xml.Linq.XElement]::new($Name)
  foreach ($attribute in $Attributes.GetEnumerator()) {
    $element.SetAttributeValue([System.Xml.Linq.XName]::Get($attribute.Key), $attribute.Value)
  }

  return $element
}

function Add-DirectoryPayload {
  param(
    [System.Xml.Linq.XElement]$ParentElement,
    [string]$SourceRoot,
    [string]$CurrentDirectory,
    [string]$PayloadVariableRoot,
    [System.Collections.Generic.List[string]]$ComponentIds,
    [System.Xml.Linq.XNamespace]$Namespace
  )

    $sourceRootPrefix = [System.IO.Path]::GetFullPath($SourceRoot).TrimEnd("\") + "\"

  foreach ($file in Get-ChildItem -LiteralPath $CurrentDirectory -File | Sort-Object Name) {
      $filePath = [System.IO.Path]::GetFullPath($file.FullName)
      $relativeFilePath = if ($filePath.ToLowerInvariant().StartsWith($sourceRootPrefix.ToLowerInvariant())) {
        $filePath.Substring($sourceRootPrefix.Length)
      } else {
        Get-RelativePath -BasePath $SourceRoot -TargetPath $file.FullName
      }
    $normalizedFilePath = $relativeFilePath -replace "\\", "/"
    $componentId = Get-HashedId -Prefix "Cmp" -Value $normalizedFilePath
    $fileId = Get-HashedId -Prefix "File" -Value $normalizedFilePath
    $sourcePath = if ([string]::IsNullOrEmpty($relativeFilePath) -or $relativeFilePath -eq ".") {
      $PayloadVariableRoot
    } else {
      "$PayloadVariableRoot\$relativeFilePath"
    }

    $component = New-WixElement -Name ($Namespace + "Component") -Attributes @{
      Id = $componentId
      Guid = "*"
    }
    $fileElement = New-WixElement -Name ($Namespace + "File") -Attributes @{
      Id = $fileId
      Source = $sourcePath
      KeyPath = "yes"
    }
    $component.Add($fileElement)
    $ParentElement.Add($component)
    $ComponentIds.Add($componentId)
  }

  foreach ($directory in Get-ChildItem -LiteralPath $CurrentDirectory -Directory | Sort-Object Name) {
    $directoryPath = [System.IO.Path]::GetFullPath($directory.FullName)
    $relativeChildPath = if ($directoryPath.ToLowerInvariant().StartsWith($sourceRootPrefix.ToLowerInvariant())) {
      $directoryPath.Substring($sourceRootPrefix.Length)
    } else {
      Get-RelativePath -BasePath $SourceRoot -TargetPath $directory.FullName
    }
    $directoryId = Get-HashedId -Prefix "Dir" -Value $relativeChildPath
    $directoryElement = New-WixElement -Name ($Namespace + "Directory") -Attributes @{
      Id = $directoryId
      Name = $directory.Name
    }
    $ParentElement.Add($directoryElement)
    Add-DirectoryPayload -ParentElement $directoryElement -SourceRoot $SourceRoot -CurrentDirectory $directory.FullName -PayloadVariableRoot $PayloadVariableRoot -ComponentIds $ComponentIds -Namespace $Namespace
  }
}

function Add-ComponentGroup {
  param(
    [System.Xml.Linq.XElement]$Fragment,
    [string]$GroupId,
    [System.Collections.Generic.List[string]]$ComponentIds,
    [System.Xml.Linq.XNamespace]$Namespace
  )

  $groupElement = New-WixElement -Name ($Namespace + "ComponentGroup") -Attributes @{ Id = $GroupId }
  foreach ($componentId in $ComponentIds) {
    $groupElement.Add((New-WixElement -Name ($Namespace + "ComponentRef") -Attributes @{ Id = $componentId }))
  }

  $Fragment.Add($groupElement)
}

function Write-RevitAddinManifest {
  param(
    [string]$OutputPath,
    [string]$AssemblyPath
  )

  $manifest = @"
<?xml version="1.0" encoding="utf-8" standalone="no"?>
<RevitAddIns>
  <AddIn Type="Application">
    <Name>RevitOpusBridge</Name>
    <Assembly>$AssemblyPath</Assembly>
    <AddInId>724E2F54-394D-4A64-9E2A-4FF53A3B4B03</AddInId>
    <FullClassName>RevitOpusBridge.App</FullClassName>
    <VendorId>OPBR</VendorId>
    <VendorDescription>Opus Revit Bridge</VendorDescription>
  </AddIn>
</RevitAddIns>
"@

  $parentDirectory = Split-Path -Parent $OutputPath
  New-Item -ItemType Directory -Path $parentDirectory -Force | Out-Null
  Set-Content -Path $OutputPath -Value $manifest -Encoding UTF8
}

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDirectory
$resolvedPayloadRoot = if ($PayloadRoot) {
  $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($PayloadRoot)
} else {
  Join-Path $repoRoot "artifacts\installer-payload"
}
$resolvedOutputDirectory = if ($OutputDirectory) {
  $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
} else {
  Join-Path $repoRoot "installer\generated"
}

$layoutPath = Join-Path $resolvedPayloadRoot "installer-layout.json"
if (-not (Test-Path -Path $layoutPath -PathType Leaf)) {
  throw "Could not find installer layout metadata at '$layoutPath'. Run stage-installer-payload.ps1 first."
}

$layout = Get-Content -Path $layoutPath -Raw | ConvertFrom-Json
$programFilesSourceRoot = Join-Path $resolvedPayloadRoot "ProgramFiles\Opus Revit Bridge"
$programDataSourceRoot = Join-Path $resolvedPayloadRoot "ProgramData\Opus Revit Bridge"

New-CleanDirectory -Path $resolvedOutputDirectory

$namespace = [System.Xml.Linq.XNamespace]::Get("http://wixtoolset.org/schemas/v4/wxs")
$document = [System.Xml.Linq.XDocument]::new()
$root = [System.Xml.Linq.XElement]::new($namespace + "Wix")
$document.Add($root)

$programFilesComponentIds = [System.Collections.Generic.List[string]]::new()
$programFilesFragment = [System.Xml.Linq.XElement]::new($namespace + "Fragment")
$programFilesDirectoryRef = New-WixElement -Name ($namespace + "DirectoryRef") -Attributes @{ Id = "INSTALLFOLDER" }
Add-DirectoryPayload -ParentElement $programFilesDirectoryRef -SourceRoot $programFilesSourceRoot -CurrentDirectory $programFilesSourceRoot -PayloadVariableRoot '$(var.PayloadRoot)\ProgramFiles\Opus Revit Bridge' -ComponentIds $programFilesComponentIds -Namespace $namespace
$programFilesFragment.Add($programFilesDirectoryRef)
Add-ComponentGroup -Fragment $programFilesFragment -GroupId "ProgramFilesPayload" -ComponentIds $programFilesComponentIds -Namespace $namespace
$root.Add($programFilesFragment)

$programDataComponentIds = [System.Collections.Generic.List[string]]::new()
$programDataFragment = [System.Xml.Linq.XElement]::new($namespace + "Fragment")
$programDataDirectoryRef = New-WixElement -Name ($namespace + "DirectoryRef") -Attributes @{ Id = "OPUSDATADIR" }
Add-DirectoryPayload -ParentElement $programDataDirectoryRef -SourceRoot $programDataSourceRoot -CurrentDirectory $programDataSourceRoot -PayloadVariableRoot '$(var.PayloadRoot)\ProgramData\Opus Revit Bridge' -ComponentIds $programDataComponentIds -Namespace $namespace
$programDataFragment.Add($programDataDirectoryRef)
Add-ComponentGroup -Fragment $programDataFragment -GroupId "ProgramDataPayload" -ComponentIds $programDataComponentIds -Namespace $namespace
$root.Add($programDataFragment)

$manifestRoot = Join-Path $resolvedOutputDirectory "manifests"
$revitComponentIds = [System.Collections.Generic.List[string]]::new()
$revitFragment = [System.Xml.Linq.XElement]::new($namespace + "Fragment")
$revitDirectoryRef = New-WixElement -Name ($namespace + "DirectoryRef") -Attributes @{ Id = "REVITADDINSDIR" }

foreach ($version in $layout.revitPlugin.versions) {
  $versionDirectoryElement = New-WixElement -Name ($namespace + "Directory") -Attributes @{
    Id = (Get-HashedId -Prefix "RevitAddinDir" -Value $version.version)
    Name = [string]$version.version
  }

  $manifestOutputPath = Join-Path $manifestRoot "Revit$($version.version)\RevitOpusBridge.addin"
  Write-RevitAddinManifest -OutputPath $manifestOutputPath -AssemblyPath ([string]$version.assemblyPath)

  $componentId = Get-HashedId -Prefix "RevitAddinCmp" -Value ([string]$version.version)
  $fileId = Get-HashedId -Prefix "RevitAddinFile" -Value ([string]$version.version)
  $component = New-WixElement -Name ($namespace + "Component") -Attributes @{
    Id = $componentId
    Guid = "*"
  }
  $fileElement = New-WixElement -Name ($namespace + "File") -Attributes @{
    Id = $fileId
    Source = ('$(var.GeneratedRoot)\manifests\Revit{0}\RevitOpusBridge.addin' -f $version.version)
    KeyPath = "yes"
  }

  $component.Add($fileElement)
  $versionDirectoryElement.Add($component)
  $revitDirectoryRef.Add($versionDirectoryElement)
  $revitComponentIds.Add($componentId)
}

$revitFragment.Add($revitDirectoryRef)
Add-ComponentGroup -Fragment $revitFragment -GroupId "RevitAddinManifests" -ComponentIds $revitComponentIds -Namespace $namespace
$root.Add($revitFragment)

$outputPath = Join-Path $resolvedOutputDirectory "PayloadFragments.wxs"
$document.Save($outputPath)

Write-Host "Generated WiX fragments at: $outputPath"
Write-Host "Generated Revit add-in manifests under: $manifestRoot"
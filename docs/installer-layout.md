# Installer Layout

This document defines the staging layout produced by `scripts/stage-installer-payload.ps1` and the intended final install locations for the first Windows installer.

## Target Install Roots

- Program Files: `C:\Program Files\Opus Revit Bridge`
- ProgramData: `C:\ProgramData\Opus Revit Bridge`

## Program Files Payload

- `bridge-service/dist/` contains the compiled HTTP service.
- `bridge-service/package.json` and `bridge-service/package-lock.json` are copied into the staged runtime so `npm ci --omit=dev` can install production dependencies for the payload.
- `runtime/node/node.exe` contains the bundled Node runtime used by the installed launcher.
- `RevitPlugin/Revit<Version>/RevitOpusBridge.dll` contains the version-specific plugin assembly to be registered with Revit.
- `tools/install-revit-plugin.ps1` is copied into the payload so the later installer can reuse the same manifest-generation logic if needed.
- `start-bridge-service.cmd` launches the service with installer-specific runtime environment variables.

## ProgramData Payload

- `config/export.json`
- `config/mappings.json`
- `config/opus-template.json`
- `output/`

The bridge-service runtime uses these environment variables to bind to the installed layout:

- `OPUS_BRIDGE_SERVICE_ROOT=C:\Program Files\Opus Revit Bridge\bridge-service`
- `OPUS_BRIDGE_CONFIG_DIR=C:\ProgramData\Opus Revit Bridge\config`
- `OPUS_BRIDGE_DATA_DIR=C:\ProgramData\Opus Revit Bridge`

## Metadata Artifact

The staging script writes `installer-layout.json` into the payload root. This file records the intended install locations and the plugin payloads that were staged for each selected Revit version.

## WiX Authoring Flow

The WiX scaffold does not manually track payload files. Instead:

1. `scripts/stage-installer-payload.ps1` produces the staged Program Files and ProgramData tree.
2. `scripts/generate-wix-installer-assets.ps1` reads `installer-layout.json`, emits generated Revit add-in manifest files, and writes `installer/generated/PayloadFragments.wxs`.
3. `installer/OpusRevitBridge.Installer.wixproj` builds an MSI from `installer/src/Product.wxs` plus the generated fragment.

This keeps the staged payload as the source of truth while allowing the installer project to stay small and maintainable.

The current MSI output path is `installer/bin/Release/en-us/OpusRevitBridge.Installer.msi`.

## Current Scope

- Supported first installer target: Revit 2024
- Extensible payload shape: Revit 2020 through 2026
- Current launcher model: user-session command launcher, not a Windows service

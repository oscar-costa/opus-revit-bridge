# Opus Revit Bridge

Deterministic bridge between Autodesk Revit and Ecosoft Opus.

The first implementation target is a sidecar architecture with two layers:

- `RevitPlugin/`: thin Revit add-in responsible only for safe Revit API execution.
- `bridge-service/`: Node.js service responsible for orchestration, mapping, validation, and XLSX export.

## First slice

The initial slice implemented in this scaffold does three things:

1. Starts a local HTTP service.
2. Queries Revit project information through a Named Pipe sidecar.
3. Generates a simple XLSX workbook from normalized budget lines.
4. Loads default category-to-Opus mapping rules from a versioned JSON config.
5. Validates wall mappings before export.
6. Exports an Opus-oriented workbook with import rows and metadata.
7. Can save exported workbooks to a configured output folder on disk.
8. Loads workbook sheet names and columns from a template config file.

## Planned workflow

1. Extract normalized quantities and metadata from Revit.
2. Map those quantities to Opus concept codes and units.
3. Export a quantity-only Opus-importable XLSX workbook.
4. Let Opus assign and process pricing after import.

## Current quantity slices

- Walls: length-based export using `m` quantities.
- Rooms: area-based export using `m2` quantities.
- Doors: count-based export using aggregated `pza` quantities.
- Windows: count-based export using aggregated `pza` quantities.

## Combined export

- `POST /api/export/combined/xlsx` exports one workbook for multiple selected categories.
- `POST /api/export/combined/file` saves that combined workbook to disk.
- `POST /api/validate/combined` previews merged mapping and quantity issues for multiple selected categories.
- If no categories are provided, the default scope is walls, rooms, doors, and windows.

## Layout

- `bridge-service/` — TypeScript orchestrator and export service.
- `RevitPlugin/` — Revit add-in and IPC bridge.
- `docs/` — architecture, MDF notes, and mapping decisions.
- `bridge-service/config/mappings.json` — versioned default mapping rules.
- `bridge-service/config/export.json` — default output folder and file naming prefix.
- `bridge-service/config/opus-template.json` — workbook template for Opus sheet names and columns.
- `samples/` — optional fixtures and templates.
- `scripts/` — local automation scripts.

## Bridge Service Runtime Paths

The bridge service now supports installer-friendly runtime locations instead of assuming it always runs from the source repo.

- `OPUS_BRIDGE_SERVICE_ROOT` overrides the bridge-service installation root.
- `OPUS_BRIDGE_CONFIG_DIR` overrides the directory used for `export.json`, `mappings.json`, and `opus-template.json`.
- `OPUS_BRIDGE_DATA_DIR` overrides the base directory used to resolve relative export output paths such as `./output`.

If those variables are not set, the service falls back to the current repo-style layout under `bridge-service/`.

## Revit Plugin Build And Install

The Revit plugin build now accepts a `RevitVersion` property so the packaging flow can emit version-specific payloads without changing the shared plugin code.

- Default local target is Revit 2024.
- Version-specific build output now lands under `RevitPlugin/bin/<Configuration>/Revit<Version>/net48/`.
- Use `dotnet build RevitPlugin/RevitOpusBridge.csproj -p:RevitVersion=2024 -p:RevitApiPath="C:\Program Files\Autodesk\Revit 2024"` for local 2024 builds.
- Use `scripts/install-revit-plugin.ps1 -RevitVersion 2024` to generate a local add-in manifest for the selected Revit year.
- The install script also supports `-InstallScope AllUsers` for machine-wide add-in registration and `-AssemblyPath` when an installer needs to point the manifest at an installed DLL path.
- The checked-in `RevitPlugin/RevitOpusBridge.addin` file is a placeholder only; release and local install manifests should be generated from the install script or installer.

## Installer Payload Layout

The repository now includes `scripts/stage-installer-payload.ps1`, which assembles a staging layout for a future Windows installer.

- `ProgramFiles/Opus Revit Bridge/bridge-service/` contains the compiled bridge-service runtime plus production Node dependencies.
- `ProgramFiles/Opus Revit Bridge/runtime/node/node.exe` contains the bundled Node runtime used to launch the service.
- `ProgramFiles/Opus Revit Bridge/RevitPlugin/Revit<Version>/RevitOpusBridge.dll` contains the version-specific Revit plugin payload.
- `ProgramFiles/Opus Revit Bridge/start-bridge-service.cmd` launches the bridge-service with `OPUS_BRIDGE_SERVICE_ROOT`, `OPUS_BRIDGE_CONFIG_DIR`, and `OPUS_BRIDGE_DATA_DIR` pointed at the installed layout.
- `ProgramData/Opus Revit Bridge/config/` contains editable runtime config files.
- `ProgramData/Opus Revit Bridge/output/` is the default writable export location.
- `installer-layout.json` describes the intended final install paths for use by later WiX packaging work.

Run `powershell -ExecutionPolicy Bypass -File .\scripts\stage-installer-payload.ps1 -RevitVersions 2024` from the repo root to create the staging tree under `artifacts/installer-payload/`.

For a multi-version payload, pass several years or use the new release preset:

- `powershell -ExecutionPolicy Bypass -File .\scripts\stage-installer-payload.ps1 -RevitVersions 2024 2025 2026`
- `powershell -ExecutionPolicy Bypass -File .\scripts\stage-installer-payload.ps1 -AllSupportedRevitVersions`

## WiX Installer Scaffold

The repository now includes an MSI-first WiX scaffold under `installer/`.

- `installer/OpusRevitBridge.Installer.wixproj` is the SDK-style WiX project.
- `installer/src/Product.wxs` defines the package roots and feature wiring for the per-machine MSI.
- `scripts/generate-wix-installer-assets.ps1` converts `artifacts/installer-payload/installer-layout.json` into WiX fragments and generated Revit add-in manifest files.
- Each staged Revit year becomes its own generated MSI subfeature, and that subfeature is only enabled when `C:\Program Files\Autodesk\Revit <Version>\Revit.exe` exists on the target machine.
- `scripts/build-wix-installer.ps1` stages the payload, regenerates WiX authoring, and builds the MSI.

Run `powershell -ExecutionPolicy Bypass -File .\scripts\build-wix-installer.ps1 -RevitVersions 2024` from the repo root to produce the WiX sources and build the MSI at `installer/bin/Release/en-us/OpusRevitBridge.Installer.msi`.

For a single release MSI that carries every currently supported Revit plugin payload, run `powershell -ExecutionPolicy Bypass -File .\scripts\build-wix-installer.ps1 -AllSupportedRevitVersions`.

This requires local Revit SDK/API availability for every selected Revit year because the installer build flow compiles each version-specific plugin payload before packaging it.

## Export behavior

- `POST /api/export/walls/xlsx` blocks export when unmapped lines exist.
- Set `allowUnmapped: true` only when generating a review workbook.
- The workbook contains `Project`, `Opus Import`, `Metadata`, and `Traceability` sheets.
- `POST /api/export/walls/file` saves the workbook to disk and returns the generated path.
- Export routes can use the default template from `bridge-service/config/opus-template.json` or a caller-provided template path.
- Template columns can now pull from a source field or use a static default value, which is how you can model real Opus-only columns without changing code.

## Traceability

- `Opus Import` stays minimal for Opus processing.
- `Traceability` keeps the Revit source level, category, element ids, and export notes for review.

## Project Context

- `Project` captures project name, project number, client, address, export scope, and generation time.
- Category-specific exports fetch this information directly from Revit before building the workbook.

## Current sample alignment

- The default workbook template now uses a reduced quantity-only import sheet.
- Current headers: `Clave`, `Descripción`, `Unidad`, `Cantidad`.
- The sample Opus `.xls` files remain useful as reference artifacts, but pricing columns are intentionally not exported.

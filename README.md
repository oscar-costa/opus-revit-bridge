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

# Architecture

## Diagram

See [figures/architecture.mmd](figures/architecture.mmd).

## Design

This project follows the same sidecar split proven in the `revit-mcp` reference project, but it is not MCP-first.

- Hands: `RevitPlugin/`
  - Runs inside Revit.
  - Executes Revit API calls only inside `IExternalEventHandler.Execute`.
  - Exposes a small Named Pipe JSON contract.
- Brain: `bridge-service/`
  - Runs outside Revit as a local Node.js service.
  - Calls the Revit sidecar through Named Pipes.
  - Applies concept/unit mapping, quantity validation, and XLSX export.

## Initial contract

Request:

```json
{ "method": "get_project_info", "params": {} }
```

Response:

```json
{
  "result": {
    "name": "Project Name",
    "address": "Address",
    "clientName": "Client",
    "projectNumber": "P-001"
  },
  "error": null
}
```

Wall query response:

```json
{
  "result": {
    "walls": [
      {
        "id": 1001,
        "typeName": "Generic - 200mm",
        "length": 5.4,
        "baseLevel": "Level 1",
        "topConstraint": "Level 2"
      }
    ]
  },
  "error": null
}
```

Room query response:

```json
{
  "result": {
    "rooms": [
      {
        "id": 2001,
        "name": "Living Room",
        "number": "101",
        "area": 24.6,
        "level": "Level 1"
      }
    ]
  },
  "error": null
}
```

Category element query response:

```json
{
  "result": {
    "category": "OST_Doors",
    "elements": [
      {
        "id": 3001,
        "name": "Single-Flush 0915 x 2134mm",
        "typeName": "Single-Flush 0915 x 2134mm",
        "level": "Level 1"
      }
    ]
  },
  "error": null
}
```

## Next additions

- Quantity extraction handlers by category and element type.
- Mapping configuration for Opus concept codes.
- XLSX workbook templates that match Opus import expectations.
- MDF research track with sample files and parser feasibility notes.

## Current mapping workflow

- Default mapping rules live in `bridge-service/config/mappings.json`.
- `POST /api/validate/walls` fetches walls from Revit, applies the configured mapping rules, and returns a validation summary plus mapped lines.
- `POST /api/export/walls/xlsx` uses the same mapping flow and exports the resulting lines to Excel.
- Request bodies may still override the default mapping rules or point to a different mapping file path for local experiments.

## Current workbook contract

- Sheet `Project` contains project metadata and export scope so each workbook carries header context.
- Sheet `Opus Import` contains a minimal quantity-oriented import sheet with `Clave`, `Descripción`, `Unidad`, and `Cantidad`.
- Sheet `Metadata` contains export diagnostics such as line count, unmapped count, and generation timestamp.
- Sheet `Traceability` contains Revit source context such as level, category, source element ids, and notes for audit/review.
- Export is blocked by default when unmapped rows exist, to avoid generating misleading import files.
- Sheet names and visible columns are no longer hardcoded in the exporter; they are loaded from `bridge-service/config/opus-template.json`.
- Each template column can either map to a row field or emit a constant default value, which makes it possible to express Opus-specific status or placeholder columns entirely in config.

## Sample-derived Opus layout

- The sample files `EXEMPLO OPUS 2017.xls` and `EXEMPLO OPUS.xls` are usable as workbook-layout references.
- Their first worksheet exposes a consistent six-column budget table, but the current plugin scope intentionally uses only the quantity-relevant subset.
- The current default export template exports `Clave`, `Descripción`, `Unidad`, and `Cantidad` only.
- Pricing is explicitly out of scope and is expected to be handled inside Opus after import.

## Combined export workflow

- The service can now aggregate multiple categories into one workbook in a single export run.
- Supported categories for the combined flow are `walls`, `rooms`, `doors`, and `windows`.
- `POST /api/validate/combined` uses the same category aggregation path and returns both merged and per-category summaries before export.
- The `Project` sheet records the export scope as a comma-separated list of the included categories.

## Current file export workflow

- Default output settings live in `bridge-service/config/export.json`.
- `POST /api/export/walls/file` builds the workbook, saves it to the configured output directory, and returns the absolute saved path.
- Request bodies may override the config path or output directory for local testing and per-job exports.
- Request bodies may also point to an alternate workbook template path when testing different Opus import layouts.

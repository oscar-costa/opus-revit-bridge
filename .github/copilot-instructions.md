# Opus Revit Bridge — Workspace Instructions

## Architecture: Brain / Hands Sidecar

Two strictly separated layers — never mix them:

| Layer | Location | Technology | Responsibility |
| --- | --- | --- | --- |
| Brain | `bridge-service/` | Node.js 20 / TypeScript | HTTP API, Named Pipe client, quantity mapping, validation, XLSX export |
| Hands | `RevitPlugin/` | C# / .NET Framework 4.8 | Revit API execution inside valid Revit API context |

Cross-boundary communication: Named Pipe `\\.\pipe\opus-revit-bridge`, newline-delimited JSON.

## Product Scope

This project is a quantity-only Revit-to-Opus export bridge.

- In scope: quantity extraction, concept/unit mapping, validation, combined export, save-to-disk export, traceability metadata.
- Supported categories: `walls`, `rooms`, `doors`, `windows`.
- Workbook sheets: `Project`, `Opus Import`, `Metadata`, `Traceability`.
- `Opus Import` is intentionally minimal: `Clave`, `Descripción`, `Unidad`, `Cantidad`.

Out of scope:

- Pricing
- `Precio unitario`
- `Total`
- MDF parsing
- Write-back into Revit
- Write-back into Opus

Do not reintroduce pricing logic unless the user explicitly changes project scope.

## Build And Test

```bash
# TypeScript — run from bridge-service/
npm install
npm run typecheck
npm test
npm run build
npm run start

# C# — full build requires local Revit 2024 SDK DLLs
dotnet build RevitPlugin/RevitOpusBridge.csproj -p:RevitApiPath="C:\Program Files\Autodesk\Revit 2024"

# CI-safe C# validation
dotnet restore RevitPlugin/RevitOpusBridge.csproj
```

Current compiled service entrypoint: `bridge-service/dist/src/index.js`.

## Runtime Constraints

The service can start without Revit, but Revit-backed routes will fail until the Revit add-in is running and listening on `\\.\pipe\opus-revit-bridge`.

Typical local order:

1. Start Revit with the Opus bridge add-in loaded.
2. Confirm the Named Pipe server is active.
3. Start `bridge-service`.
4. Run validation or export routes.

## Critical Gotchas

**Revit API thread safety**

- Revit API calls are only valid inside `IExternalEventHandler.Execute()`.
- Correct dispatch path: `Bridge.cs` background listener -> `ExternalEvent.Raise()` -> Revit main thread -> handler executes -> response returns.
- Never call the Revit API directly from a background thread.

**CI cannot build the Revit plugin**

- `RevitAPI.dll` and `RevitAPIUI.dll` are local SDK references, not CI-available packages.
- In hosted CI, validate the plugin with `dotnet restore` only.
- Full plugin build is a local developer task on a machine with Revit installed.

**Runtime config paths matter**

- Default mapping, export, and workbook template files live under `bridge-service/config/`.
- Keep runtime path resolution relative to the `bridge-service` project root, not the process working directory.

**stdout/stderr separation**

- The Node service is an HTTP server, not MCP, but diagnostics should still prefer `process.stderr`.
- Avoid noisy stdout logging that obscures request/response debugging.

**Quantity-only export blocking**

- Export is blocked by default when unmapped rows exist.
- `allowUnmapped: true` is for review workbooks only.

## Mapping And Workbook Contract

- Default mapping rules: `bridge-service/config/mappings.json`
- Output defaults: `bridge-service/config/export.json`
- Workbook template: `bridge-service/config/opus-template.json`

Template columns may map from a source field or emit a static value, but the default import sheet must stay aligned with Opus quantity import expectations.

## API Surfaces

Important live routes:

- `POST /api/validate/combined`
- `POST /api/export/combined/xlsx`
- `POST /api/export/combined/file`

Category-specific routes still exist for narrower flows.

## Engineering Expectations

- Preserve the Brain/Hands separation.
- Keep the Revit plugin thin and outcome-oriented.
- Put orchestration, mapping, validation, and workbook generation in `bridge-service/`.
- Prefer minimal changes that keep tests passing.
- Add or update tests when changing route behavior, mapping behavior, path resolution, or workbook structure.
- Do not assume Revit is available during automated tests.

## Verified Commands

- TypeScript validation: `npm run typecheck`
- Test suite: `npm test`
- Build output: `npm run build`
- Local runtime: `npm run start`

## File Reference

- `bridge-service/src/server.ts` — Express app wiring
- `bridge-service/src/routes/export.ts` — export endpoints
- `bridge-service/src/routes/validation.ts` — validation endpoints
- `bridge-service/src/services/category-lines.ts` — shared category aggregation
- `bridge-service/src/services/mapping-service.ts` — mapping rules and validation summary
- `bridge-service/src/services/export-storage.ts` — config/template loading and save-to-disk
- `bridge-service/src/services/xlsx-exporter.ts` — workbook generation
- `RevitPlugin/src/Bridge.cs` — Named Pipe server and dispatch
- `RevitPlugin/src/DispatcherEventHandler.cs` — main-thread Revit dispatch

# Architecture Diagram

```mermaid
flowchart TB
    client[Local user or client]

    subgraph brain[Brain: bridge-service]
        direction TB
        http[Express HTTP API\nhealth, validate, export]
        pipeline[Quantity pipeline\nfetch -> normalize -> map -> validate]
        workbook[XLSX workbook builder\nProject, Opus Import, Metadata, Traceability]
        config[(Runtime config\nmappings.json\nexport.json\nopus-template.json)]
        output[(Saved XLSX output)]

        http --> pipeline
        pipeline --> workbook
        config --> pipeline
        config --> workbook
        workbook --> output
    end

    subgraph ipc[IPC boundary]
        pipe[Named Pipe\n\\.\\pipe\\opus-revit-bridge\nnewline-delimited JSON]
    end

    subgraph hands[Hands: RevitPlugin]
        direction TB
        addin[Revit add-in startup]
        bridge[Bridge listener]
        dispatch[ExternalEvent dispatcher]
        handlers[Query handlers\nproject info, walls, rooms, doors, windows]

        addin --> bridge
        bridge --> dispatch
        dispatch --> handlers
    end

    subgraph revit[Revit process]
        direction TB
        ui[Revit main thread]
        api[Autodesk Revit API]

        ui --> api
        api --> ui
    end

    client -->|HTTP localhost:3781| http
    pipeline -->|request model data| pipe
    pipe --> bridge
    handlers -->|execute only in valid API context| ui
    ui -->|results| handlers
    bridge -->|JSON responses| pipe
    pipe --> pipeline
```

## Notes

- This view is intentionally simplified for PDF export.
- The key boundary is Brain versus Hands: the Node service never calls the Revit API directly.
- All Revit API execution is routed through ExternalEvent onto the Revit main thread.
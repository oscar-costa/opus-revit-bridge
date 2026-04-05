# Architecture Diagram

```mermaid
flowchart LR
    user[User]
    bridge[Opus Revit Bridge\nLocal HTTP service for validation and export]
    revit[Autodesk Revit\nHosts active model and add-in]
    opus[Ecosoft Opus\nConsumes quantity-oriented workbook imports]
    filesystem[(Local File System\nConfig, templates, generated workbooks)]

    user -->|Calls local HTTP endpoints| bridge
    bridge -->|Requests model data\nNamed Pipe + JSON| revit
    bridge -->|Produces import-ready XLSX| opus
    bridge -->|Reads config and writes exports| filesystem
```

## Container View

```mermaid
flowchart TB
    user[User or local client]
    opus[Ecosoft Opus]
    revit[Autodesk Revit host]

    subgraph system[Opus Revit Bridge]
        direction LR

        subgraph brain[Brain: bridge-service]
            direction TB
            service[Node.js and TypeScript\nHTTP API, mapping, validation, XLSX generation]
            config[(Runtime Config\nJSON mappings, export settings, workbook template)]
            output[(Generated Workbooks\nSaved XLSX exports)]

            service -->|Loads settings and templates| config
            service -->|Writes export files| output
        end

        subgraph hands[Hands: RevitPlugin]
            direction TB
            plugin[C# and .NET Framework 4.8\nNamed pipe server and Revit API dispatch]
            eventFlow[ExternalEvent\nMain-thread execution path]

            plugin -->|Dispatches API work through| eventFlow
        end
    end

    user -->|HTTP localhost:3781| service
    service -->|Named Pipe + JSON| plugin
    plugin -->|Executes queries in valid API context| revit
    service -->|Produces import-ready workbooks for| opus
```

## Notes

- The context diagram is now a standard Mermaid flowchart for broader renderer compatibility.
- The container diagram is also plain flowchart syntax so it should render more reliably in VS Code previews.
- The Node service owns orchestration, mapping, validation, and XLSX generation.
- The Revit plugin stays thin and only executes Revit API work through ExternalEvent on the Revit UI thread.

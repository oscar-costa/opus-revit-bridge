# Architecture Diagram

```mermaid
C4Context
    title System Context - Opus Revit Bridge

    Person(user, "User", "Runs exports and validation from a local client")
    System(revit, "Autodesk Revit", "Hosts the active building model and add-in")
    System(bridge, "Opus Revit Bridge", "Local bridge that validates quantities and exports Opus workbooks")
    System_Ext(opus, "Ecosoft Opus", "Consumes quantity-oriented workbook imports")
    System_Ext(filesystem, "Local File System", "Stores config, templates, and generated workbooks")

    Rel(user, bridge, "Calls local HTTP endpoints")
    Rel(bridge, revit, "Requests model data via named pipe", "newline-delimited JSON")
    Rel(bridge, opus, "Produces import-ready XLSX workbooks for")
    Rel(bridge, filesystem, "Reads config and writes exports")
```

## Container View

```mermaid
C4Container
    title Container View - Opus Revit Bridge

    Person(user, "User")
    System(revit, "Autodesk Revit", "Desktop host for the model")
    System_Ext(opus, "Ecosoft Opus", "Consumes workbook imports")

    Container_Boundary(system, "Opus Revit Bridge") {
        Container(service, "bridge-service", "Node.js / TypeScript", "HTTP API, mapping, validation, workbook generation")
        Container(plugin, "RevitPlugin", ".NET Framework 4.8 / C#", "Named pipe server and Revit API dispatch")
        ContainerDb(config, "Runtime Config", "JSON files", "Mappings, export settings, workbook template")
        ContainerDb(output, "Generated Workbooks", "XLSX files", "Saved quantity export files")
    }

    Rel(user, service, "Calls", "HTTP localhost:3781")
    Rel(service, plugin, "Requests project and category data", "Named Pipe / JSON")
    Rel(plugin, revit, "Executes queries inside valid API context", "ExternalEvent")
    Rel(service, config, "Loads settings and templates from")
    Rel(service, output, "Writes export files to")
    Rel(service, opus, "Produces import-ready workbooks for")
```

## Notes

- The context diagram shows the system boundary and its external relationships.
- The container diagram shows the core Brain and Hands split inside the system.
- The Node service owns orchestration, mapping, validation, and XLSX generation.
- The Revit plugin stays thin and only executes Revit API work through ExternalEvent on the Revit UI thread.

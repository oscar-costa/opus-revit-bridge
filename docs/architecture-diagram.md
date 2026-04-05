# Architecture Diagram

```mermaid
flowchart LR
    user[User, browser, or local client]

    subgraph workspace[Repository and local tooling]
        docs[docs and samples]
        scripts[scripts and installer tooling]
        installer[WiX installer project]
    end

    subgraph brain[Brain: bridge-service / Node.js + TypeScript]
        direction TB
        entry[index.ts and server.ts]
        routes[HTTP routes\nrevit, validation, export]
        revitClient[revit-client.ts]

        subgraph orchestration[Service layer]
            categoryLines[category-lines]
            mapping[mapping-service]
            scope[export-scope]
            storage[export-storage and project-paths]
            workbook[xlsx-exporter]
            quantity[wall, room, count budget builders]
        end

        config[(Config files\nmappings.json\nexport.json\nopus-template.json)]
        output[(Generated workbooks\noutput or installed data dir)]

        entry --> routes
        routes --> revitClient
        routes --> categoryLines
        routes --> storage
        categoryLines --> quantity
        categoryLines --> mapping
        routes --> workbook
        routes --> scope
        storage --> config
        workbook --> output
        storage --> output
    end

    subgraph boundary[Cross-process boundary]
        pipe[Named Pipe\n\\.\\pipe\\opus-revit-bridge\nnewline-delimited JSON]
    end

    subgraph hands[Hands: RevitPlugin / C# + .NET Framework 4.8]
        direction TB
        app[App.cs add-in startup]
        bridge[Bridge.cs pipe server]
        dispatcher[DispatcherEventHandler\nExternalEvent queue]
        handlers[Handlers\nproject info, walls, rooms, category elements]
        status[Status ribbon command]

        app --> bridge
        app --> status
        bridge --> dispatcher
        dispatcher --> handlers
    end

    subgraph revit[Autodesk Revit host process]
        direction TB
        ui[Revit UI thread]
        api[Revit API]
        model[Active project model]

        ui --> api
        api --> model
    end

    subgraph deployment[Deployment layout]
        programFiles[Program Files payload\nservice, runtime, plugin binaries]
        programData[ProgramData payload\nconfig and output]
    end

    user -->|HTTP on localhost:3781| routes
    docs --> entry
    scripts --> installer
    scripts --> programFiles
    scripts --> programData
    installer --> programFiles
    installer --> programData
    revitClient -->|request and response| pipe
    pipe --> bridge
    handlers -->|execute inside valid Revit API context| ui
    model --> api
    bridge -->|JSON responses| pipe
    config -. loaded at runtime .-> storage
    programFiles -. installed service root .-> entry
    programData -. installed config and output .-> config
    programData -. writable exports .-> output
```

## Notes

- This view is broader than the runtime-only sketch and includes repository, deployment, and service-layer structure.
- The key architectural rule is still the Brain versus Hands split: the Node service never calls the Revit API directly.
- All Revit API work is dispatched through ExternalEvent onto the Revit UI thread.
- The service owns mapping, validation, workbook generation, and runtime path resolution.

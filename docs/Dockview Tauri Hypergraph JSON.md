# **Architecting Declarative Multi-Window Desktop Applications: A Unified Hypergraph Schema for Tauri and Dockview**

The historical trajectory of desktop application development has been heavily burdened by the manual, imperative curation of user interface layouts and system state. Developers traditionally write explicit routines to instantiate windows, mount UI components, track local state, and manually construct event listeners to bridge disparate processes. As applications scale in complexity—particularly those requiring high-density data visualization across multiple independent operating system windows—this imperative approach becomes brittle, difficult to serialize, and highly susceptible to synchronization errors. To eliminate manual curation, system architecture must pivot toward declarative, data-driven topologies. By standardizing application state and layout rendering into a universally parsable JSON format, complex environments can be hydrated automatically.

When modeling these highly interconnected, multi-participant software environments, traditional dyadic graph structures are fundamentally inadequate. The mathematical framework of hypergraphs provides the exact structural primitives necessary to represent multi-window, multi-component interfaces. This report presents an exhaustive architectural design for a unified JSON-based hypergraph data structure, engineered specifically for ingestion by two interacting systems: Tauri, a high-performance Rust-based desktop application framework, and Dockview, a zero-dependency JavaScript layout manager for rendering complex IDE-like grids. By designing independent conceptual adapters for Dockview and Tauri, and subsequently synthesizing them into a unified, high-level composite adapter, an application can dynamically construct and synchronize infinitely complex interfaces directly from a single JSON source of truth.

## **The Mathematical Supremacy of Hypergraphs in System Architecture**

To construct a robust adapter system capable of translating arbitrary data into functional application code, the underlying data structure must perfectly mirror the reality of the software's execution environment.

The conventional property graph model dictates a strict binary constraint: every edge must connect exactly two nodes1. While this is suitable for modeling simple relational data, it forces unnatural compromises when applied to modern user interfaces. For example, if a single application window contains five distinct visualization panels, representing this in a property graph requires creating an artificial "Window" node and drawing five separate dyadic edges to the "Panel" nodes2. This decomposition strips the model of its native grouping semantics, requiring downstream rendering engines to execute complex graph traversals to understand what elements belong together.

Hypergraphs generalize the network model by entirely removing the two-node constraint, allowing a single edge to simultaneously encompass any arbitrary number of nodes2. Formally, a hypergraph is defined as a system ![][image1], where ![][image2] represents a finite set of vertices, ![][image3] represents a finite set of hyperedges, and ![][image4] represents the incidences connecting them5. Each hyperedge ![][image5] is a subset of the vertex set, meaning a single connection natively represents a multi-participant grouping6.

When analyzing higher-order software interactions, the mathematical representation transitions from a standard adjacency matrix to an adjacency tensor ![][image6], where entries ![][image7] capture the existence and weight of a ![][image8]\-dimensional interaction among the connected nodes4. In the context of application architecture, this polyadic capability is perfectly isomorphic to the concept of a UI "Group" (which holds multiple individual "Panels") or an OS "Window" (which executes multiple concurrent frontend processes)7.

### **The Hypergraph Interchange Format (HIF) Specification**

To prevent the proliferation of proprietary, unmaintainable JSON schemas, the adapter architecture must strictly adhere to an established scientific standard. The Hypergraph Interchange Format (HIF) provides a schema-driven, extensible JSON specification explicitly designed for higher-order networks5.

The HIF standard is defined by several core structural arrays and metadata objects, which provide the foundational grammar for the adapters.

| Field Designation | Data Type | Architectural Function in HIF |
| :---- | :---- | :---- |
| network-type | Enumeration | Specifies the mathematical topology, typically set to "directed", "undirected", or "simplicial-complex"5. |
| metadata | Object | Houses top-level network attributes, semantic versioning, and global contextual descriptors5. |
| nodes | Array | Contains individual vertex records, each requiring a global identifier (node) and an optional attrs object for custom properties5. |
| edges | Array | Contains hyperedge records, each requiring a global identifier (edge) and an optional attrs object5. |
| incidences | Array | Defines the intersections, requiring an edge identifier, a node identifier, and optional direction (e.g., "head" or "tail") and attrs fields5. |

The critical feature of the HIF specification is the attrs object present on nodes, edges, and incidences. This field is explicitly designated for library-specific, non-structural attributes5. It is within these localized attrs objects that the specific rendering directives for the Dockview layout engine and the process-management directives for the Tauri core are injected, maintaining perfect mathematical integrity while facilitating deep software integration.

## **The Tauri Subsystem and Inter-Process Communication**

To architect the Tauri adapter, one must deeply understand the framework's multiprocess execution model. Tauri applications are divided into a secure, high-performance Core process written in Rust, and one or more Webview processes that render the frontend using HTML, CSS, and JavaScript10.

These processes are strictly isolated. They do not share memory, meaning that state management and layout data cannot simply be accessed globally across the application. Instead, all communication must traverse an Inter-Process Communication (IPC) bridge10. Tauri implements a protocol termed Asynchronous Message Passing, utilizing a JSON-RPC-like serialization format10. Every payload crossing this bridge must implement the serde::Serialize and serde::Deserialize traits in Rust10.

Tauri provides two primary IPC primitives that the hypergraph adapter will control. Commands act as a foreign function interface (FFI) abstraction. The frontend utilizes an invoke API (similar to the browser's native fetch API) to call Rust functions, pass serialized JSON arguments, and await a response10. Events, conversely, are fire-and-forget, one-way messages designed to broadcast state changes and lifecycle events. Unlike Commands, Events can be emitted by both the Tauri Core and the frontend Webviews10.

### **Multi-Window State Synchronization Mechanics**

When a hypergraph requires the instantiation of multiple operating system windows, state synchronization becomes highly complex. The core issue in multi-window Tauri development is that when a user modifies a setting or data point in an auxiliary window, the main window will display stale data unless explicitly refreshed, because the Webviews lack shared memory11.

The Tauri hypergraph adapter solves this by enforcing the Rust backend as the absolute source of truth. State is maintained in Rust within a Mutex\<AppState\> structure11. When a user mutates data, the frontend does not update its local state immediately; instead, it issues an invoke('update\_state') command, transmitting the entire patched state object to Rust11.

To prevent infinite update loops and IPC congestion during rapid interactions (such as dragging a slider), the architecture relies on a revision gate pattern. The Rust state includes an auto-incrementing integer representing the current revision. Upon modifying the Mutex, Rust bumps the revision number and emits a global event (e.g., state:invalidated) containing the new revision and the topic11. All active Webviews listen for this event. When received, the frontend cross-references the incoming revision with its local state manager (whether Redux, Zustand, Pinia, or MobX); if the incoming revision is higher, the Webview fetches the fresh snapshot from Rust and applies it11.

### **High-Throughput Data Constraints**

A critical constraint the Tauri adapter must account for is the serialization overhead of the JSON-RPC bridge. If the application is rendering massive datasets—such as an empirical network hypergraph containing 400,000 discrete data points—attempting to emit all 400,000 elements across the IPC bridge to the frontend will result in massive latency, often taking multiple seconds per transmission16.

The optimal architectural solution, therefore, is to retain the bulk of the raw topological data strictly within the Rust process. The Webview is treated solely as an input/output facilitator16. The hypergraph dictates that the frontend adapter requests only the localized viewport slice of the data, transmitting smaller batches (e.g., 100 data points per second) that the human eye can actually perceive, ensuring flawless performance while the heavy computation remains isolated in Rust16.

## **The Dockview Layout Engine and UI Primitives**

Operating entirely within the isolated Webview processes, Dockview is a framework-agnostic, zero-dependency layout engine engineered for building complex, IDE-like interfaces directly in the browser17. While Tauri handles the operating system windows and memory, Dockview manages the internal spatial organization of the rendered HTML content.

The Dockview layout architecture is organized into a hierarchical grid, constructed from a specific set of foundational primitives.

| UI Primitive | Architectural Definition and Behavior |
| :---- | :---- |
| **Panels** | The fundamental unit of content. Panels are wrapper instances that render a specific framework component (React, Vue, etc.) registered by name. They are never instantiated directly in the DOM, but strictly through the api.addPanel() method, requiring a unique id and component name7. |
| **Groups** | Containers that aggregate one or more panels. When multiple panels share a group, Dockview natively renders a tab bar at the top of the container. Groups can be manipulated, split, or popped out as floating windows over the layout7. |
| **Gridview** | A specialized layout format providing a strictly resizable grid of panels without rendering the tab bar interfaces, ideal for fixed-topology dashboards17. |

All programmatic mutations to this UI topology pass through the DockviewApi interface, which is obtained via the onReady lifecycle callback once the framework component mounts7. Dockview possesses native layout serialization, utilizing api.toJSON() and api.fromJSON() to capture and restore the spatial coordinates, group configurations, and panel identities into a serialized object7.

However, Dockview's native JSON representation is purely mechanical. It understands the pixel widths of a split-view and the index of a tab, but it contains zero semantic knowledge regarding the relationships between the data components themselves. Therefore, using Dockview's native JSON as the application's source of truth limits the application to a static UI builder, incapable of driving backend logic or cross-window synchronization. The hypergraph adapter corrects this by subsuming Dockview's spatial configuration into the larger, semantically rich HIF structure.

## **Adapter Architecture 1: The Dockview Hypergraph Projection**

The first conceptual adapter focuses purely on translating the abstract mathematical topology of the HIF hypergraph into the concrete layout primitives of the Dockview engine. Operating in the frontend Webview, this adapter acts as a deterministic parser, mapping mathematical entities to UI elements.

In this projection, the hypergraph nodes represent the discrete units of visual content. Each node in the HIF nodes array translates directly to a Dockview Panel. The node's globally unique node property serves as the panel's id. The attrs.dockview object contains the component registry name and specific instantiation parameters, such as a localized title or a minimum rendering width5.

The hypergraph edges represent the layout containers. An edge mathematically encapsulates multiple nodes; therefore, it perfectly maps to a Dockview Group, which encapsulates multiple panel tabs2. The edges array is parsed to execute api.addGroup() calls, initializing the container topology of the screen5.

The hypergraph incidences dictate the spatial positioning and hierarchical nesting. An incidence record connecting Node ![][image6] to Edge ![][image9] is translated by the adapter into an instruction to mount Panel ![][image6] inside Group ![][image9].

The ingestion loop executes as follows: The adapter initializes by scanning the edges array, creating empty Dockview groups and retaining their generated reference IDs. It then iterates over the nodes array. For each node, it queries the incidences array to determine which edge it belongs to. Finally, it executes api.addPanel(), passing the registered component name from the node attributes and targeting the layout using the position: { referenceGroup: group\_id } parameter derived from the incidence7.

## **Adapter Architecture 2: The Tauri Multi-Window State Projection**

The second conceptual adapter operates simultaneously but interprets the exact same HIF JSON file to orchestrate the operating system environment and the IPC data routing. This adapter resides primarily in the Rust Core, executing during the application initialization phase.

In this secondary projection, the hypergraph nodes represent isolated fragments of application state managed within the Rust Mutex. The attrs.tauri object on a node defines the required state synchronization mechanisms, such as whether a node requires a high-frequency asynchronous stream from a background thread, or if it relies on a standard revision-gated IPC command11.

The hypergraph edges represent the physical OS-level windows. If an edge contains an attrs.tauri.window\_label property, the Rust adapter identifies it as an independent execution context. During the tauri::Builder::default().setup() lifecycle hook, the adapter iterates over these specific edges, invoking tauri::WindowBuilder::new() to dynamically provision Webview processes based on the hypergraph's topology8.

The hypergraph incidences, in this context, define the IPC event channels. By analyzing the incidences, the Rust adapter constructs an internal map of state dependencies. If Node ![][image6] (a specific state fragment) is incident to both Edge ![][image9] (Main Window) and Edge ![][image10] (Auxiliary Window), the adapter automatically provisions an event listener. When Node ![][image6] mutates, the Core knows it must invoke app.emit("state:invalidated", payload) to both the Main and Auxiliary window labels, ensuring that the isolated Webviews remain perfectly synchronized8.

## **The Synthesis: "Working with Dockview in Tauri" Unified Adapter**

The ultimate objective of declarative system design is the elimination of manual curation through a single, unified data structure. The synthesis of the Dockview UI layout and the Tauri OS-level window management yields a third, composite architecture: the "Working with Dockview in Tauri" Unified Adapter.

In this unified model, a single, exhaustive HIF JSON file serves as the definitive source of truth for the entire application stack. The JSON dictates what data exists, how it is grouped visually on the screen, which OS windows render those groups, and how state changes propagate across the IPC bridge.

### **The Unified JSON Schema Specification**

The following JSON structure demonstrates the extreme depth and expressiveness of the synthesized hypergraph schema, utilizing the standard HIF grammar augmented with unified adapter attributes.

JSON

{  
  "network-type": "directed",  
  "metadata": {  
    "name": "Unified-Tauri-Dockview-Topology",  
    "version": "2.1.0",  
    "description": "Composite hypergraph defining both process isolation and spatial UI layout.",  
    "schema-standard": "HIF-Extended"  
  },  
  "nodes": \[  
    {  
      "node": "metric\_cpu\_utilization",  
      "weight": 1.0,  
      "attrs": {  
        "dockview": {  
          "component": "RealtimeLineGraph",  
          "title": "CPU Profiler",  
          "watermark": false  
        },  
        "tauri": {  
          "state\_key": "sys\_cpu",  
          "sync\_strategy": "streaming\_event",  
          "throttle\_ms": 100  
        }  
      }  
    },  
    {  
      "node": "metric\_memory\_heap",  
      "weight": 1.0,  
      "attrs": {  
        "dockview": {  
          "component": "HeapAllocationTable",  
          "title": "Memory Heap"  
        },  
        "tauri": {  
          "state\_key": "sys\_mem",  
          "sync\_strategy": "revision\_gated",  
          "throttle\_ms": 500  
        }  
      }  
    },  
    {  
      "node": "control\_preferences",  
      "weight": 2.0,  
      "attrs": {  
        "dockview": {  
          "component": "GlobalSettingsPanel",  
          "title": "System Preferences"  
        },  
        "tauri": {  
          "state\_key": "user\_preferences",  
          "sync\_strategy": "revision\_gated"  
        }  
      }  
    }  
  \],  
  "edges": \[  
    {  
      "edge": "group\_primary\_dashboard",  
      "weight": 1.0,  
      "attrs": {  
        "dockview": {  
          "type": "group",  
          "direction": "left",  
          "activePanel": "metric\_cpu\_utilization"  
        },  
        "tauri": {  
          "window\_label": "main\_workspace",  
          "window\_url": "index.html",  
          "is\_primary": true  
        }  
      }  
    },  
    {  
      "edge": "group\_floating\_toolset",  
      "weight": 1.0,  
      "attrs": {  
        "dockview": {  
          "type": "popout\_window",  
          "x": 200,  
          "y": 150,  
          "width": 600,  
          "height": 400  
        },  
        "tauri": {  
          "window\_label": "settings\_dialog",  
          "window\_url": "settings.html",  
          "always\_on\_top": true  
        }  
      }  
    }  
  \],  
  "incidences": \[  
    {  
      "edge": "group\_primary\_dashboard",  
      "node": "metric\_cpu\_utilization",  
      "direction": "tail",  
      "attrs": {  
        "dockview": { "tab\_index": 0 }  
      }  
    },  
    {  
      "edge": "group\_primary\_dashboard",  
      "node": "metric\_memory\_heap",  
      "direction": "tail",  
      "attrs": {  
        "dockview": { "tab\_index": 1 }  
      }  
    },  
    {  
      "edge": "group\_floating\_toolset",  
      "node": "control\_preferences",  
      "direction": "tail",  
      "attrs": {  
        "dockview": { "tab\_index": 0 }  
      }  
    },  
    {  
      "edge": "group\_primary\_dashboard",  
      "node": "control\_preferences",  
      "direction": "head",  
      "attrs": {  
        "dockview": { "isHidden": true },  
        "tauri": {   
          "cross\_window\_sync": true,  
          "sync\_dependency": "group\_floating\_toolset"  
        }  
      }  
    }  
  \]  
}

### **Execution Trace of a Unified Hypergraph Mutation**

To illustrate the power of this unified architecture, consider the exact lifecycle of a complex user interaction: a user tearing a panel away from the main window to create a new floating window.

When the user clicks and drags the "Memory Heap" tab outside the bounds of the Dockview group, the Dockview engine registers a drop event intended to instantiate a popout window7. Under a manually curated system, this action is restricted entirely to the frontend DOM; it merely floats a div element over the existing window.

Under the Unified Adapter architecture, the interaction triggers a deep cascade of systemic mutations. The frontend Dockview adapter intercepts the drag-and-drop lifecycle event. Rather than immediately rendering the floating UI, it translates the user's intent into a hypergraph mutation instruction. It recognizes that a node (metric\_memory\_heap) is being stripped of its incidence to group\_primary\_dashboard and requires a new edge.

The frontend Webview executes a Tauri JSON-RPC command: invoke('mutate\_hypergraph', { action: 'extract\_node', node: 'metric\_memory\_heap' }).

The Rust Core receives this payload and locks the global Mutex\<AppState\>. It modifies the central HIF JSON structure stored in memory, dynamically generating a new edge record (e.g., group\_dynamic\_popout\_1) and assigning it a new Tauri window label. It updates the incidences array, removing the old connection and mapping metric\_memory\_heap to the new edge5.

Recognizing that a new edge with a distinct window label has been generated, the Rust Core invokes tauri::WindowBuilder::new() at runtime, spawning a physically distinct, OS-level window8.

Once the new Webview process is initialized, it emits a ready signal. The Rust Core responds by utilizing the revised hypergraph to broadcast a targeted layout hydration event. It sends the layout instructions to the original window (instructing Dockview to remove the panel) and to the new window (instructing Dockview to execute api.addPanel for the memory heap component)8. Because the attrs.tauri synchronization strategy for this node is defined as revision\_gated, the Rust Core automatically wires the IPC channels, ensuring that memory statistics flowing from the system continue to route precisely to the newly spawned window without the developer writing a single line of explicit event-handling logic11.

## **Future Architectural Implications and Extensibility**

The transition to a unified hypergraph model permanently solves the fragility of multi-window desktop application development. By forcing all layout, process allocation, and IPC synchronization to derive strictly from a declarative JSON document, developers eliminate the entire class of bugs related to stale state, orphaned event listeners, and race conditions.

Furthermore, because the adapter relies on the standardized Hypergraph Interchange Format, the system remains infinitely extensible. Future iterations can leverage temporal hypergraphs to serialize the complete layout state over time, allowing for full "undo/redo" capabilities across multiple operating system windows simultaneously6. Multiplex hypergraphs could be utilized to define overlapping user workspaces, instantly switching between entirely different topologies of Tauri windows and Dockview panels by simply applying a different contextual layer of the incidence matrix9.

By abandoning manual information curation in favor of mathematically rigorous, structured JSON arrays, applications achieve an unprecedented level of dynamic scalability, transforming complex interface logic into purely data-driven execution.

#### **Works cited**

1. Seeing the schema: TypeDB's approach to graph visualization, [https://typedb.com/blog/graph-visualisation-for-hypergraphs](https://typedb.com/blog/graph-visualisation-for-hypergraphs)  
2. Graph databases, complex data, and the case for a structured hypergraph \- TypeDB, [https://typedb.com/blog/the-case-for-a-structured-hypergraph](https://typedb.com/blog/the-case-for-a-structured-hypergraph)  
3. From Triples to Metagraphs: Modeling Humanlike Agentic Memory with Complex Graph Structures | by Volodymyr Pavlyshyn, [https://volodymyrpavlyshyn.medium.com/from-triples-to-metagraphs-modeling-humanlike-agentic-memory-with-complex-graph-structures-fa4e71e47bb7](https://volodymyrpavlyshyn.medium.com/from-triples-to-metagraphs-modeling-humanlike-agentic-memory-with-complex-graph-structures-fa4e71e47bb7)  
4. Inference of hyperedges and overlapping communities in hypergraphs \- PMC, [https://pmc.ncbi.nlm.nih.gov/articles/PMC9700742/](https://pmc.ncbi.nlm.nih.gov/articles/PMC9700742/)  
5. HIF: The hypergraph interchange format for higher-order networks \- arXiv, [https://arxiv.org/html/2507.11520v2](https://arxiv.org/html/2507.11520v2)  
6. HIF: The hypergraph interchange format for higher-order networks \- arXiv, [https://arxiv.org/html/2507.11520v1](https://arxiv.org/html/2507.11520v1)  
7. Core Concepts \- Dockview, [https://dockview.dev/docs/core/overview/](https://dockview.dev/docs/core/overview/)  
8. Multiwindow | Tauri v1, [https://tauri.app/v1/guides/features/multiwindow](https://tauri.app/v1/guides/features/multiwindow)  
9. Hypergraph Interchange Format (HIF) \- Emergent Mind, [https://www.emergentmind.com/topics/hypergraph-interchange-format-hif](https://www.emergentmind.com/topics/hypergraph-interchange-format-hif)  
10. Inter-Process Communication \- Tauri, [https://v2.tauri.app/concept/inter-process-communication/](https://v2.tauri.app/concept/inter-process-communication/)  
11. How to Sync State Across Tauri Windows — With Any State Manager \- 777genius \- Medium, [https://777genius.medium.com/how-to-sync-state-across-tauri-windows-with-any-state-manager-redux-zustand-jotai-mobx-9797a364b22b](https://777genius.medium.com/how-to-sync-state-across-tauri-windows-with-any-state-manager-redux-zustand-jotai-mobx-9797a364b22b)  
12. Calling Rust from the Frontend \- Tauri, [https://v2.tauri.app/develop/calling-rust/](https://v2.tauri.app/develop/calling-rust/)  
13. Calling the Frontend from Rust | Tauri, [https://v2.tauri.app/develop/calling-frontend/](https://v2.tauri.app/develop/calling-frontend/)  
14. I built a multi-window state sync engine for Tauri \- works with any state manager \- Reddit, [https://www.reddit.com/r/tauri/comments/1r3u2bu/i\_built\_a\_multiwindow\_state\_sync\_engine\_for\_tauri/](https://www.reddit.com/r/tauri/comments/1r3u2bu/i_built_a_multiwindow_state_sync_engine_for_tauri/)  
15. Loosely synchronize your (Zustand) stores in multiple Tauri processes \- Hopp, [https://www.gethopp.app/blog/tauri-window-state-sync](https://www.gethopp.app/blog/tauri-window-state-sync)  
16. Send data from Rust to Front end via IPC at an extremely high rate · tauri-apps \- GitHub, [https://github.com/orgs/tauri-apps/discussions/7146](https://github.com/orgs/tauri-apps/discussions/7146)  
17. Introduction \- Dockview, [https://dockview.dev/docs/overview/introduction/](https://dockview.dev/docs/overview/introduction/)  
18. dockview-core \- NPM, [https://npmjs.com/package/dockview-core?ref=pkgstats.com](https://npmjs.com/package/dockview-core?ref=pkgstats.com)  
19. Managing Groups \- Dockview, [https://dockview.dev/docs/core/groups/add](https://dockview.dev/docs/core/groups/add)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIMAAAAcCAYAAABCrQzwAAAFVUlEQVR4Xu2aZ6jlRBiGX/vaxbp2VOwFFLuuXisqdrFg+eEPu1hAVCzsogh2xYKLjVWxK1bEioIiuFiwd8VeFnvvfo9fhpv7bc45SU4ue66bB17OzbyTZCaZzHwzc6WWlpaWlpaWlpaWlpaWlpYOLGGaFBNnUlY2nRgTy7Cxacg0wbR59rulabHMXzNL28S0UfbL8bKZPwiMMz1t2iKXtq68HtSPcm9q2irnJ1Y3ba3h+pNn1hE5yrOQacMKSs+4KvOZtpWXlTpvJi/7kGneLM91qtEgbjQ9avon07Omu+UPEE4z3W/6M/PfNd1r2iXzBwEqPjGkXWGaquF6vSGva2SS6Xt5nj9MD6h+Y9hX3ii/ll+P36dMT5ieND1jei/z0JH/nVWdDeTv4CX5df6S34P3tnSWZx7Ta6Y9s+PSrCG/6Fem2YIHtDZu+Ldp0eDNaGiUPPT0ReSZW8MPfpng5aHh3GBaPBo1uVV+z2OjkbGX3N85GhU5Qn6d+6KRcaDpI9Nc0ejGIfKL3hmNjG3k/gvRGADo1c6OiTm+kJed4a0Ixtc3VdyY6vKZ/J7rRCMHL2ntmFiR1OiOiUbGHKZP1LlRFsJXwUWPjkbGmXL/wmjMYIhnKBfxQSfSULFPNDIeNu0aE/tgVfn9pplmyaUvIm94iVdMC+SO6/C5/F48h05cJr9XaT6QX3StaGQw7uE3+dCa4BTTDyoe2hJ3yMt+QjSM/eTjbJMcJr8f981zkrxbT0zJ/V2H1eT3oefrxv7yfOOjUcQK8sxfamRLThCI/C6PGYiWB4mrTY/HxAC9GfW7JKQvaHrbtFxI75dbNH0vu548HmPm0hSHy+9zWzQCK8rz0fB7crA8M7MFGgRdz6c5kYb/XDqhJAR2t9fQSpxcksfkQ1w3jpOX/66QfrmKe4t+SfECz/F9ec+VjpskNbqjohEgeCTfydEo4np55uPlX0sSvQC6KPMvSCeUZH75LKWT+Ero6hDj7CryMXV2Ti4J07RLY2KAqVVszEzNCIar3KsM+a57KflaDOM5jZaX1yRl4oXEL6bzYmIRH6r7RZkf4w9avMBaAOsCZ0QjsL68/NOyY+IL1lI6zS76IU31iPLzTDQdmjveQf1NK/mQuE+noT1Cb3VtTIzQJacHVXRR5um/aTDjBSCWOScmBlimpo6I+IdhY/KIHM2Rpnr5QBF20sgAjl5q+dxxVVK8wLBaBuKV82NipNf6Akue+M9HowTbma6pIYaMstDir4yJARr5r/J6UKZ3NHoNO61pMAx2YjfTPTGxIkVBaieoPx9zr9hCN6v7Rc+S+8QNVWGlkn2BqpqTk0vyssp9HW/J6/GxfKpVFoaig1RucYhhNnXdnWDmxrC8fTTk+yhlh44yi1oJ4j/y7hiNPHwdaabApklknOlFuX9A8AaFKabXY2IBj8jr8VA0esAL4jxmWksGL3KqPG+ctQDBJF8mMwtWO+OQzHD8s/z8vYMXYUOKfD/KVxh7wQYd+Qlup4OA6jt5hPmTvBB0o9/IC0WlGWPw8ZLPL3PWQYKvlv2ShaMRuEpe16rlZ1fxVflG1u7BSzDPJ5DlgScRy/C8eIY0JMpIV016jCcSLFJ9a7o4GhnnyhtTfG+9VheZPlP+SvsTY5Hx8ge8RzQC9HxFXXNZTpdvLo02E9R7qlwVdpybvubAMlk+DIwmD8r3FkYbhhoCzKYgRqHXqhKUj2nYmqbLLBNM1YEepekFoyLo5Vj/YKhuCoacm2Li/x2CrqmqNhMpC0Fn3f9IqgJ7KEMxsQ/47yeWBPivqJkOAqU6U+BexMh/LEDjZWGra8D8LzohTVzH/KuQAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,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>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGYAAAAcCAYAAACTZsrFAAAD1ElEQVR4Xu2Ya6hNaRjHH8a13OVOzAf3ZhIiZppzDDNmJIpE4ct8wFxQPhA+KCXXaHxQ+GA+KJcxGKQopXGbCzMTIhRCuZNcYxj//3nWe/a7n3P2Pmudvc6t3l/92nu9z9prP2u973pvIoFAIBAIBAKBQCBQ9ymCn0efn8JP4Gewq39SNdMDjoDD4VA4DBbDVplTSugAR4rmy9yLYRv/hBqAOQ5JYDv9WTZN4V54FP4f+Q/cD7/MnBabxqIP6Gs4phzbZ07Ny/fwMHwjmtM9uE+0wnzGw5uSyf007JN1RvUzGZ6Ej0Rz4udx0Wd8DP4Br0Yx+l3Jr3LQV/Skx7CBicWhFzwAz8LNcD1cB9fAVXAFXA4Hux/E5HfRvKbZgMcU0cbEe6hN7BDNfa4NREwUjY+1AZ9vRU/abQMxmA6vwx9gw+xQwWwXzWuhDUQ0gufhABuoBdwWzf1jG/Dg2/6RLfRxD4BdSBJ40VOwhQ2kBN825rXBBiIWw7W2MAbdYH1baGgOW9rCmPQWzfs+rOeVt4U9vWM2qrzP7o7ohfrZQAX8JlXbp/MtZF7sJi0fwsuwmQ3EYDbcCj+wgQhOKv6Eg2wgJjNF895lyheI9k6On7zvZeCD5UXu2kAFcKDnoFaVjBPNjWOX5SCcYAsTsFR0HLBjKivlDBxlypPgeiA2LMdA+FASjIWzRC/ysw1UAPv1jbYwZfgfzI2TEp9JUv5blJRloq3aVY6rlC9Kz6gcbnxhT3QNPvWOY+NmD0nHFw5qO21hynBNwtwo+3zCPvmKlJ06VxZXOVy3/Q1HZ4cT4/dAnUXHs/7wiOibFBs3vvDHSeAM7IbkWCClyDPJzu9H0b46TTi9fyG6LioUN8Nlg/dZAmd4x19Jnqmyq10u4PzZQ1xWiv5hVXJRNEcuUDkY/yvpTsv5ppyDW+AeKfzargfyB3nC/Dt6x+wyu3vHWbjxxc4e4tJEdDU73wZS5JBkutq/RLeM0sJVitvlWAR/kbITgiSwC2O++Wa4fDN/tYU+20QvMscGEsBxgNdha+MNthZd+PHmuFbgm+isDJtEc7wVfU+LLqKzPbv1xMrhRKgylcPu1vVAueA0n0OA/d9SuNn2QPRC3CQsFO6RrYYnRG+YLZELKN+cfWoeuIhkjhwLWelp0El0G4ebt+XBnQZ2SbnWOblwubKRWjgR4FvPGdolKaehcm3wBL6Ez0UHvVfR95rcUc7FVNGb5eZgWswT3ZHOB3uRIluYA85O3Yar87Xos+Vz/g++g2+jcjv+1EnY0r6xhYFAnYRrigsJ5JQxEAgECuQ9x6XYngYpZzMAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD8AAAAcCAYAAADWZ2dHAAACnElEQVR4Xu2XS8hNURiGX/dbuaeQgUgoBshdUZIYuA1QMjEwUC6Ry4QiJJGECBOFAbmFUopcJkJCLjF1GUhmGLi8r++cY53P3v/e55x9jiP7qaf+/a21/7PW3uv71tpATk5OTk5OTk5zMo1OoePoeDqJjirrYUyE9Z0M6z+mvLmxDKQz6KwINYE09KIX6Wv6o+BdujHsRFrRy/QbrM8nuq2sRwNoTdfSF/QcPUj30T10N91Fd9INxRtSMhM2KT2ElnhOV9NOvqHe9KQ36SU6rLypZobCJv8F9pajWErP+mCjOEWX+GBGdMbvZd/HtYkesFXR3zfEoXxS4WjnG6pgOj3tgxnzATb5qEJ2GLbcE1HBuQ8rHEfpS1iVrIWtsLysJw9hk5/v4toBHtA2Lv4H22H/YGUQm0fvBNeiA91BB7l4HBdoXx/MGP2Gxr4qiLWFPZSxQSySxbCbTwQxVWctmS1BTIykb+lwF49DlT1t32rZDxu/do4i2lkOBdexPIHdvBe2Tx6j9wrX7YN+1aB8CwdVD9bBxn+mcD2AvqLdSj1i6A27UW9zEZ1KhyC7/VDF8w1SDKQGFsLmoBcmlAaaSyKaqG685hscXegReosucG1JqHY8gp3s6sEE2Bze07lInkuJjrCj33nfAKuScwp/6xQ2mh5AdN8k9MCUXmvoYNjvaivVb+hwElop/WCT/w7b09MW41+cpB9Rnt86MFynmwvXOiVpoO/o8mKnCulKV8ByUytBD0M+Dbxa6p0eFeevsAewybUlory8Asv74/Q2vQFbTiGz6Wfa3cWbARW4x6jhYKa3PQK2JKPQ+VinNbX7B/O3UVpl/d1QQimhpaVT4DLYN/R/hVJBBW+9b2gB7SbPKlDp17ToKynnX+cn7ziBcT2kJ7AAAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAdCAYAAACjbey/AAABBklEQVR4XmNgGAWjgDRgDMQfgVgcXYIYwAjEx4H4PxAboMkRBeIYIJpB2A1NjiDgBeI7QHyJAWJADKo0YdANxBVAPJsBYkARqjR+oAbEV4GYDYhbGSAGdKKoIAAoNmA7EHtD2YUMEAPmI6TxA18g3ozEj2WAGLAVSQwnYGeAOF0ZSQzkEpABp5HEcIIqID4DxDlAnAXF/QwQAx4hqcMKZID4NhD3oOHpDBADfiCUYgcrgTgaXRAIOBkQqVEATQ4OnIH4CLogEvjCADFAHV2CgwES6m+AuAFVCg4Egfg1A8QAH2QJHSD+DsTfoPQfBkiAIQOQq0B+B6kB4V9A/AGIhZAVjQIyAQBY5Tp6vn33PQAAAABJRU5ErkJggg==>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAAAcCAYAAAApxUKlAAAC0UlEQVR4Xu2YWchNURTHl5nMM/FGlCTlQbwgZVaKUqaSQvJgTkqRkCkPCBGPhsiDWcmXlIxFCVG+JAqFkjn8/9bZ96y9uiSdr++o/atf95619h32uns6VySRSCQSiUQiUd8Mgu9gV59IxDSAV+EPONDlEo5ZooWio1wuYWgNH8O7osWaEacTli1wJdwnWqwlcToR6APvwaZwvWixNkUtEhXOwvHZ88WixTqYpxOBifCkuZ4pWqzTJmZpBjfAXj5RQubDMT74r7DjnH624xxhLNYNE7MMgM9hP58oGTwG1UqBG9UqeBMuhAsyt4sW66lp9zf0hltFd9X/hUawI+zhE56e8JFoB627RYv1KW/6RyaIFvyB6Os6x+lSsx++h5d8wnMETvdB0ELyg2k7E28J98LLcLKJN8kep4q+ppPJ1Rer4Rm40SeqcAeu80HLSHjFBw2sNjve18R4DuN94054wsQDZSkWR/pSOAW+cTlPe/hdfnO30lx093sN18SpCnyDV6Id5wcHeCvEOf4CzjPxQFmKxSJxdhyFh1zOw1p8ha18oj/8CD9kj99EF3MLRxvXKrahX+Bb2CHLc6fka+30DIRilWHN4vdlP0a7OAfLZngK7hI9Ml2PWhTIMdFfix86xOXKVCzu7s9gQzgii3FWXIQ7smvOAA4ILi+Fw1uhz3AcnAMHx+lKsbq4OBkGb0n8t89xeMBcW/jrc4diZz1cArgoh9HOx9sSn6dqRN+Dt3HLs9hc0ZkSZgWPOJxd7E+dwA5wgV/hE5IXq9qfhlxAuU7y5B+4AA+bawt/fR6KqxVrEXwiebE4knkmrAkNRNdj3oFsE50F5JrEmxqLxGK1MbHC4QZQjVCsbj6RwSKu9cEC2eOuQzEDLyU+InDkcb1qDIeaeJ0yHJ6HD0WPHPfhOdjWtCGzYXcXKwreek3yQQcX82XZc36PWtGRNxZOy+K/+Am6jo+lMQvb3AAAAABJRU5ErkJggg==>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAdCAYAAAB8I5agAAABCklEQVR4Xu3SsUtCURTH8UMpYWKTVNjS7CCNBQUG9S+0NohLQbQFihJI/4D/gku0KIJL1FRLQ2MNgbNbSwgVoX1P9146vt7QmNAPPsP9nQPvcd8T+c9fyCr2cIDDydHPHOEeY1xHZrHZFLd8GuljUxG3vB0dxOUSb0hFB5pZFLCMJIa4mdgw+fXyPvro4hEtce/bsEuaGj6w4c8LeBa3vBOWNFu+bNqSXOEd87a8E7e8ZroEXnBrOlkUt6iPnDH9uu/PTCdFX3ZsSU58v4s5ZLXM+bL+vfeV8L5plHEcBg84DwdxVzXCkz/rT7QShnobA7TRQ0ncr/mKC1TDYoh+uTwyptO7XjLnqcsnBUIzux66rvQAAAAASUVORK5CYII=>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAcCAYAAABh2p9gAAABLUlEQVR4Xu2UvS4FURRGv8RvKGhEhE6hoFIIIahIbkVBouAxVB6AkFDovINoVEJQqESh0KoRpZ+IYG37MHMm997cobnFrGQVs789O5M5e0YqKKhPhnAaJ4KTOIXtIe8LtVEcwTEcDllZNvAE3/AT3/EMu0K+jM8hM+9xLWRV2ZTfcJEN4AgPcQYbM1lF+vFDPnQwVV/FA2xI1WrGnsQG7oTrFTzH1t+OnCzKBz7iHF5hZ9SRk2Z8kA+9xd44/hvb8oF20v+mB2+UHM5AHOejAy+xpORwtqKOHLTIl9tO1ViQD7T3aVkubL/25fv2QxPeyYcupeo1sadk79KsyweeZuplacNxPJZ/p91x/M2sku/XfgwVmccX+SDzFa+jDmk31C1/kvfbslf9yxTUCV8kpj/fcAdh2wAAAABJRU5ErkJggg==>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAdCAYAAABMr4eBAAABDElEQVR4Xu2SvytFYRzGH5Lk6g5ilN3AxkV+lLp3tyqD8U5WVotN/oCb0Wgim4WyGVgNBlluuiU/SuFz+p7jvucrvOpmOp/6DOd9np5Ob69UUBBHCZdwDqewgrM4EZZSJnFe7c50FozjAV7je+o5rmeFgCO1Oze4k4+lUXyTFWZcljGG97jsg5BT2ciuD2AQL3HRnX+hLhu5w+7gvBdPcDU4+5YhfJUNJZedsYdbwfePdGQk4VA20ki/N3Efuz4bEazIRlq4hmfYl2tEkDy+R9lQ8naG83E8F7KRBR/EMiC73AfscVk0VdlfHPvgL2zLRjZ8EEs/XslGai77lRG8xWd8Sn3BJpaDXsF/8gGRkDcNJ/TkvAAAAABJRU5ErkJggg==>
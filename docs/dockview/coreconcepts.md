Core Concepts
Framework
Dockview organizes content into panels and groups arranged in a resizable grid. Understanding these primitives and the API pattern is all you need to get started.

Panels
A panel is the unit of content in Dockview. Each panel renders a component you register by name. Panels are never created directly. They are instantiated through the API using api.addPanel(), which requires an id (unique identifier) and a component (the registered component name).

See Adding Panels for positioning, sizing, and floating options.

Groups
A group is a container that holds one or more panels and renders a tab bar at the top. When a group contains multiple panels, each panel appears as a tab. Groups are created automatically when panels are added, and can be manipulated through the Group API.

Users can drag panels between groups, split groups to create new ones, and float or pop out groups as separate windows.

The API Pattern
All mutations to the layout go through the DockviewApi. You receive the API instance via the onReady callback (or ready event in Vue/Angular), which fires once the component has mounted.

Store the API reference in a ref or class property, as you will use it throughout the lifetime of your application.

function onReady(event: DockviewReadyEvent) {
  /**
   * You should store a reference to `api` in a Ref or State
   * for later interactions
   */
  const api: DockviewApi = event.api;
}

<DockviewReact onReady={onReady}/>


See the full API Reference for all available methods.

Drag & Drop
Drag and drop is built in. Users can drag panel tabs to rearrange them within a group, move them to a different group, split the layout to create a new group, or float a group. No configuration is required to enable this.

See Drag & Drop for customization and third-party drag source integration.

Serialization
Layouts can be saved and restored using api.toJSON() and api.fromJSON(). This allows you to persist the layout to local storage or a backend and restore it on the next load.

// Save
const layout = api.toJSON();
localStorage.setItem('my_layout', JSON.stringify(layout));

// Restore
const saved = localStorage.getItem('my_layout');
if (saved) {
    api.fromJSON(JSON.parse(saved));
}

https://dockview.dev/docs/core/overview

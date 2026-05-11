API
Framework
constructor


height
Height of the component.
height: number

maximumSize
The maximum size the component can reach where size is measured in the direction of orientation provided.
maximumSize: number

minimumSize
The minimum size the component can reach where size is measured in the direction of orientation provided.
minimumSize: number

onDidAddView
Invoked when a panel is added. May be called multiple times when moving panels.
onDidAddView: Event<IPaneviewPanel>

onDidDrop
Invoked when a Drag'n'Drop event occurs that the component was unable to handle. Exposed for custom Drag'n'Drop functionality.
onDidDrop: Event<PaneviewDidDropEvent>

onDidLayoutChange
Invoked when any layout change occures, an aggregation of many events.
onDidLayoutChange: Event<void>

onDidLayoutFromJSON
Invoked after a layout is deserialzied using the fromJSON method.
onDidLayoutFromJSON: Event<void>

onDidRemoveView
Invoked when a panel is removed. May be called multiple times when moving panels.
onDidRemoveView: Event<IPaneviewPanel>

onUnhandledDragOverEvent
onUnhandledDragOverEvent: Event<PaneviewDndOverlayEvent>


panels
All panel objects.
panels: IPaneviewPanel[]

width
Width of the component.
width: number

addPanel
Add a panel and return the created object.
addPanel<T extends object = Parameters>(options: AddPaneviewComponentOptions<T>): IPaneviewPanel


clear
Reset the component back to an empty and default state.
clear(): void

dispose
Release resources and teardown component. Do not call when using framework versions of dockview.
dispose(): void

focus
Focus the component. Will try to focus an active panel if one exists.
focus(): void

fromJSON
Create a component from a serialized object.
fromJSON(data: SerializedPaneview): void

getPanel
Get a panel object given a string id. May return undefined.
getPanel(id: string): IPaneviewPanel | undefined

layout
Force resize the component to an exact width and height. Read about auto-resizing before using.
layout(width: number, height: number): void

movePanel
Move a panel given it's current and desired index.
movePanel(from: number, to: number): void

removePanel
Remove a panel given the panel object.
removePanel(panel: IPaneviewPanel): void

toJSON
Create a serialized object of the current component.
toJSON(): SerializedPaneview

updateOptions
Update configuratable options.
updateOptions(options: Partial<PaneviewComponentOptions>): void



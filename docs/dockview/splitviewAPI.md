API
Framework
constructor


height
Height of the component.
height: number

length
The current number of panels.
length: number

maximumSize
The maximum size the component can reach where size is measured in the direction of orientation provided.
maximumSize: number

minimumSize
The minimum size the component can reach where size is measured in the direction of orientation provided.
minimumSize: number

onDidAddView
Invoked when a view is added.
onDidAddView: Event<IView>

onDidLayoutChange
Invoked whenever any aspect of the layout changes. If listening to this event it may be worth debouncing ouputs.
onDidLayoutChange: Event<void>

onDidLayoutFromJSON
Invoked after a layout is loaded through the fromJSON method.
onDidLayoutFromJSON: Event<void>

onDidRemoveView
Invoked when a view is removed.
onDidRemoveView: Event<IView>

orientation
The current orientation of the component.
orientation: Orientation

panels
The list of current panels.
panels: ISplitviewPanel[]

width
Width of the component.
width: number

addPanel
Add a new panel and return the created instance.
addPanel<T extends object = Parameters>(options: AddSplitviewComponentOptions<T>): ISplitviewPanel


clear
Remove all panels and clear the component.
clear(): void

dispose
Release resources and teardown component. Do not call when using framework versions of dockview.
dispose(): void

focus
Focus the component.
focus(): void

fromJSON
Deserialize a layout to built a splitivew.
fromJSON(data: SerializedSplitview): void

getPanel
Get the reference to a panel given it's string id.
getPanel(id: string): ISplitviewPanel | undefined

layout
Layout the panel with a width and height.
layout(width: number, height: number): void

movePanel
Move a panel given it's current and desired index.
movePanel(from: number, to: number): void

removePanel
Removes an existing panel and optionally provide a Sizing method for the subsequent resize.
removePanel(panel: ISplitviewPanel, sizing: Sizing): void


toJSON
Serialize a layout
toJSON(): SerializedSplitview

updateOptions
Update configuratable options.
updateOptions(options: Partial<SplitviewComponentOptions>): void

API
Framework
constructor


height
Height of the component.
height: number

maximumHeight
Maximum height of the component.
maximumHeight: number

maximumWidth
Maximum width of the component.
maximumWidth: number

minimumHeight
Minimum height of the component.
minimumHeight: number

minimumWidth
Minimum width of the component.
minimumWidth: number

onDidActivePanelChange
Invoked when the active panel changes. May be undefined if no panel is active.
onDidActivePanelChange: Event<IGridviewPanel<GridviewPanelApi> | undefined>


onDidAddPanel
Invoked when a panel is added. May be called multiple times when moving panels.
onDidAddPanel: Event<IGridviewPanel<GridviewPanelApi>>

onDidLayoutChange
Invoked when any layout change occures, an aggregation of many events.
onDidLayoutChange: Event<void>

onDidLayoutFromJSON
Invoked after a layout is deserialzied using the fromJSON method.
onDidLayoutFromJSON: Event<void>

onDidRemovePanel
Invoked when a panel is removed. May be called multiple times when moving panels.
onDidRemovePanel: Event<IGridviewPanel<GridviewPanelApi>>


orientation
Current orientation. Can be changed after initialization.
orientation: Orientation

panels
All panel objects.
panels: IGridviewPanel<GridviewPanelApi>[]

width
Width of the component.
width: number

addPanel
Add a panel and return the created object.
addPanel<T extends object = Parameters>(options: AddComponentOptions<T>): IGridviewPanel<GridviewPanelApi>


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
fromJSON(data: SerializedGridviewComponent): void

getPanel
Get a panel object given a string id. May return undefined.
getPanel(id: string): IGridviewPanel<GridviewPanelApi> | undefined


layout
Force resize the component to an exact width and height. Read about auto-resizing before using.
layout(width: number, height: number, force: boolean): void


movePanel
Move a panel in a particular direction relative to another panel.
movePanel(panel: IGridviewPanel<GridviewPanelApi>, options: {
		direction: Direction,
		reference: string,
		size?: number
	}): void


removePanel
Remove a panel given the panel object.
removePanel(panel: IGridviewPanel<GridviewPanelApi>, sizing: Sizing): void


toJSON
Create a serialized object of the current component.
toJSON(): SerializedGridviewComponent

updateOptions
updateOptions(options: Partial<GridviewComponentOptions>): void


https://dockview.dev/docs/api/gridview/api

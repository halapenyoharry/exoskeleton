Group API
Framework
Use the group API sparingly. As you move panels, groups change and if you don't track this correctly you may encounter unexpected behaviours. You should be able to achieve most things directly through the panel API.

component
The id of the component renderer
readonly component: string

height
The panel height in pixels
readonly height: number

id
The id of the panel that would have been assigned when the panel was created
readonly id: string

isActive
Whether the panel is the actively selected panel
readonly isActive: boolean

isFocused
Whether the panel holds the current focus
readonly isFocused: boolean

isVisible
Whether the panel is visible
readonly isVisible: boolean

onDidActiveChange
readonly onDidActiveChange: Event<ActiveEvent>

onDidDimensionsChange
readonly onDidDimensionsChange: Event<PanelDimensionChangeEvent>


onDidFocusChange
readonly onDidFocusChange: Event<FocusEvent>

onDidParametersChange
readonly onDidParametersChange: Event<Parameters>

onDidVisibilityChange
readonly onDidVisibilityChange: Event<VisibilityEvent>

onWillFocus
readonly onWillFocus: Event<WillFocusEvent>

width
The panel width in pixels
readonly width: number

getParameters
getParameters<T extends Parameters = Parameters>(): T

setActive
setActive(): void

setVisible
setVisible(isVisible: boolean): void

updateParameters
updateParameters(parameters: Parameters): void

component
The id of the component renderer
readonly component: string

height
The panel height in pixels
readonly height: number

id
The id of the panel that would have been assigned when the panel was created
readonly id: string

isActive
Whether the panel is the actively selected panel
readonly isActive: boolean

isFocused
Whether the panel holds the current focus
readonly isFocused: boolean

isVisible
Whether the panel is visible
readonly isVisible: boolean

onDidActiveChange
readonly onDidActiveChange: Event<ActiveEvent>

onDidConstraintsChange
readonly onDidConstraintsChange: Event<GridConstraintChangeEvent>


onDidDimensionsChange
readonly onDidDimensionsChange: Event<PanelDimensionChangeEvent>


onDidFocusChange
readonly onDidFocusChange: Event<FocusEvent>

onDidParametersChange
readonly onDidParametersChange: Event<Parameters>

onDidVisibilityChange
readonly onDidVisibilityChange: Event<VisibilityEvent>

onWillFocus
readonly onWillFocus: Event<WillFocusEvent>

width
The panel width in pixels
readonly width: number

getParameters
getParameters<T extends Parameters = Parameters>(): T

setActive
setActive(): void

setConstraints
setConstraints(value: GridConstraintChangeEvent2): void

setSize
setSize(event: SizeEvent): void

setVisible
setVisible(isVisible: boolean): void

updateParameters
updateParameters(parameters: Parameters): void

component
The id of the component renderer
readonly component: string

height
The panel height in pixels
readonly height: number

id
The id of the panel that would have been assigned when the panel was created
readonly id: string

isActive
Whether the panel is the actively selected panel
readonly isActive: boolean

isFocused
Whether the panel holds the current focus
readonly isFocused: boolean

isVisible
Whether the panel is visible
readonly isVisible: boolean

location
readonly location: DockviewGroupLocation

onDidActiveChange
readonly onDidActiveChange: Event<ActiveEvent>

onDidActivePanelChange
readonly onDidActivePanelChange: Event<DockviewGroupChangeEvent>


onDidCollapsedChange
Fired when an edge group's collapsed state changes. Never fires for non-edge groups.
readonly onDidCollapsedChange: Event<DockviewGroupPanelCollapsedChangeEvent>


onDidConstraintsChange
readonly onDidConstraintsChange: Event<GridConstraintChangeEvent>


onDidDimensionsChange
readonly onDidDimensionsChange: Event<PanelDimensionChangeEvent>


onDidFocusChange
readonly onDidFocusChange: Event<FocusEvent>

onDidLocationChange
readonly onDidLocationChange: Event<DockviewGroupPanelFloatingChangeEvent>


onDidParametersChange
readonly onDidParametersChange: Event<Parameters>

onDidVisibilityChange
readonly onDidVisibilityChange: Event<VisibilityEvent>

onWillFocus
readonly onWillFocus: Event<WillFocusEvent>

width
The panel width in pixels
readonly width: number

close
close(): void

collapse
Collapse this group (edge groups only). No-op for non-edge groups.
collapse(): void

exitMaximized
exitMaximized(): void

expand
Expand this group (edge groups only). No-op for non-edge groups.
expand(): void

getHeaderPosition
getHeaderPosition(): DockviewHeaderPosition

getParameters
getParameters<T extends Parameters = Parameters>(): T

getWindow
If you require the Window object
getWindow(): Window

isCollapsed
Returns true if this edge group is currently collapsed. Always returns false for non-edge groups.
isCollapsed(): boolean

isMaximized
isMaximized(): boolean

maximize
maximize(): void

moveTo
moveTo(options: DockviewGroupMoveParams): void

setActive
setActive(): void

setConstraints
setConstraints(value: GridConstraintChangeEvent2): void

setHeaderPosition
setHeaderPosition(position: DockviewHeaderPosition): void


setSize
setSize(event: SizeEvent): void

setVisible
setVisible(isVisible: boolean): void

updateParameters
updateParameters(parameters: Parameters): void



https://dockview.dev/docs/api/dockview/groupApi

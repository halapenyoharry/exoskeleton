Panel API
Framework
component
The id of the component renderer
readonly component: string

group
readonly group: DockviewGroupPanel

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

isGroupActive
readonly isGroupActive: boolean

isVisible
Whether the panel is visible
readonly isVisible: boolean

location
readonly location: DockviewGroupLocation

onDidActiveChange
readonly onDidActiveChange: Event<ActiveEvent>

onDidActiveGroupChange
readonly onDidActiveGroupChange: Event<ActiveGroupEvent>


onDidDimensionsChange
readonly onDidDimensionsChange: Event<PanelDimensionChangeEvent>


onDidFocusChange
readonly onDidFocusChange: Event<FocusEvent>

onDidGroupChange
readonly onDidGroupChange: Event<GroupChangedEvent>

onDidLocationChange
readonly onDidLocationChange: Event<DockviewGroupPanelFloatingChangeEvent>


onDidParametersChange
readonly onDidParametersChange: Event<Parameters>

onDidRendererChange
readonly onDidRendererChange: Event<RendererChangedEvent>


onDidTitleChange
readonly onDidTitleChange: Event<TitleEvent>

onDidVisibilityChange
readonly onDidVisibilityChange: Event<VisibilityEvent>

onWillFocus
readonly onWillFocus: Event<WillFocusEvent>

renderer
readonly renderer: DockviewPanelRenderer

tabComponent
The id of the tab component renderer Undefined if no custom tab renderer is provided
readonly tabComponent: string | undefined

title
readonly title: string | undefined

width
The panel width in pixels
readonly width: number

close
close(): void

exitMaximized
exitMaximized(): void

getParameters
getParameters<T extends Parameters = Parameters>(): T

getWindow
If you require the Window object
getWindow(): Window

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

setRenderer
setRenderer(renderer: DockviewPanelRenderer): void

setSize
setSize(event: SizeEvent): void

setTitle
setTitle(title: string): void

updateParameters
updateParameters(parameters: Parameters): void


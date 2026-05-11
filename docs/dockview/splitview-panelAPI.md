Panel API
Framework
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
readonly onDidConstraintsChange: Event<PanelConstraintChangeEvent>


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
setConstraints(value: PanelConstraintChangeEvent2): void


setSize
setSize(event: PanelSizeEvent): void

setVisible
setVisible(isVisible: boolean): void

updateParameters
updateParameters(parameters: Parameters): void


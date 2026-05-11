Options
Framework
className
className?: string

createTabGroupChipComponent
Factory to create custom tab group chip renderers. If not provided, the default chip renderer is used.
createTabGroupChipComponent?: (tabGroup: ITabGroup): ITabGroupChipRenderer


debug
debug?: boolean

defaultHeaderPosition
defaultHeaderPosition?: DockviewHeaderPosition

defaultRenderer
defaultRenderer?: DockviewPanelRenderer

disableAutoResizing
Disable the auto-resizing which is controlled through a ResizeObserver. Call .layout(width, height) to manually resize the container.
disableAutoResizing?: boolean

disableDnd
disableDnd?: boolean

disableFloatingGroups
disableFloatingGroups?: boolean

disableTabsOverflowList
disableTabsOverflowList?: boolean

dndEdges
dndEdges?: DroptargetOverlayModel | 'false'

floatingGroupBounds
floatingGroupBounds?: {
minimumHeightWithinViewport?: number,
minimumWidthWithinViewport?: number
} | 'boundedWithinViewport'

getTabContextMenuItems
Return the items to display in the tab context menu on right-click. Use built-in string shortcuts ('close', 'closeOthers', 'closeAll', 'separator') or provide a ContextMenuItemConfig object for custom items. If omitted, no context menu is shown. Return an empty array to suppress the menu for specific cases.
getTabContextMenuItems?: (params: GetTabContextMenuItemsParams): ContextMenuItem[]


getTabGroupChipContextMenuItems
Return the items to display in the tab group chip context menu on right-click. Use built-in string shortcuts ('separator', 'colorPicker', 'rename') or provide a ContextMenuItemConfig object for custom items. 'colorPicker' renders a native grid of color swatches for the tab group. 'rename' renders an inline text input to rename the tab group. If omitted, no context menu is shown on chip right-click. Return an empty array to suppress the menu for specific cases.
getTabGroupChipContextMenuItems?: (params: GetTabGroupChipContextMenuItemsParams): ContextMenuItemConfig | BuiltInChipContextMenuItem[]


hideBorders
hideBorders?: boolean

locked
locked?: boolean

noPanelsOverlay
Define the behaviour of the dock when there are no panels to display. Defaults to watermark.
noPanelsOverlay?: 'watermark' | 'emptyGroup'

popoutUrl
popoutUrl?: string

rootOverlayModel
@deprecated
use dndEdges instead. To be removed in a future version.
rootOverlayModel?: DroptargetOverlayModel

scrollbars
Select native to use built-in scrollbar behaviours and custom to use an internal implementation that allows for improved scrollbar overlay UX. This is only applied to the tab header section. Defaults to custom.
scrollbars?: 'custom' | 'native'

singleTabMode
singleTabMode?: 'fullwidth' | 'default'

tabGroupAccent
Controls how dockview applies tab group color accents. - 'palette' (default): write --dv-tab-group-color, render the color picker, and apply built-in accent styling. - 'off': opt out entirely. No --dv-tab-group-color is written, the color picker is suppressed, and chips/indicators render without the accent. The tg.color data field is preserved so custom chip renderers can still read it and roll their own visual.
tabGroupAccent?: 'off' | 'palette'

tabGroupColors
Replace the built-in tab group color palette with a user-defined list. Each entry has an id (stored on tabGroup.color and serialized), a value (any CSS color expression — hex, rgb(), var(...), etc.), and an optional label shown in the context menu picker. If omitted, the default 9-color palette is used. The list fully replaces the defaults — there is no merge.
tabGroupColors?: DockviewTabGroupColorEntry[]

theme
theme?: DockviewTheme

components
components: Record<string,React.FunctionComponent<IDockviewPanelProps>>


defaultTabComponent
defaultTabComponent?: React.FunctionComponent<IDockviewPanelHeaderProps>


getTabContextMenuItems
Return the items to display in the tab context menu on right-click. Use built-in string shortcuts ('close', 'closeOthers', 'closeAll', 'separator') or provide a ContextMenuItemConfig object for custom items. If omitted, no context menu is shown. Return an empty array to suppress the menu for specific cases.
getTabContextMenuItems?: (params: GetTabContextMenuItemsParams): BuiltInContextMenuItem | ReactContextMenuItemConfig[]


getTabGroupChipContextMenuItems
Return the items to display in the tab group chip context menu on right-click. Use built-in string shortcuts ('separator', 'colorPicker', 'rename') or provide a ContextMenuItemConfig object for custom items. 'colorPicker' renders a native grid of color swatches for the tab group. 'rename' renders an inline text input to rename the tab group. If omitted, no context menu is shown on chip right-click. Return an empty array to suppress the menu for specific cases.
getTabGroupChipContextMenuItems?: (params: GetTabGroupChipContextMenuItemsParams): BuiltInChipContextMenuItem | ReactContextMenuItemConfig[]


leftHeaderActionsComponent
leftHeaderActionsComponent?: React.FunctionComponent<IDockviewHeaderActionsProps>


onDidDrop
onDidDrop?: (event: DockviewDidDropEvent): void

onReady
onReady: (event: DockviewReadyEvent): void

onWillDrop
onWillDrop?: (event: DockviewWillDropEvent): void

prefixHeaderActionsComponent
prefixHeaderActionsComponent?: React.FunctionComponent<IDockviewHeaderActionsProps>


rightHeaderActionsComponent
rightHeaderActionsComponent?: React.FunctionComponent<IDockviewHeaderActionsProps>


tabComponents
tabComponents?: Record<string,React.FunctionComponent<IDockviewPanelHeaderProps>>


tabGroupChipComponent
tabGroupChipComponent?: React.FunctionComponent<IDockviewTabGroupChipProps>


watermarkComponent
watermarkComponent?: React.FunctionComponent<IWatermarkPanelProps>

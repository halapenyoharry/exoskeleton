# ur-control

## An input layer that owns no canvas

Harold Rosen, with Claude. Draft of 6 November 2026. The title, like every name in this paper, is a placeholder until Harold replaces it.

---

### Abstract

Every viewport application decides, somewhere in its code, what a tap means. Most decide it in the same place they draw, so the decision cannot be moved, shared, or chosen by the person using it. ur-control is a proposal to pull that decision out into a layer of its own, a layer that knows every device a person might hold, from a mouse to a game controller to a single accessibility switch, and knows nothing about what is being drawn. It takes signals from devices and gives back actions by name. Between the two sits a table the user can swap. The paper describes the layer as a set of Unix-style filters, each with a declared input and a declared output, surveys the prior art that solved each piece inside some engine or renderer, states the design as it stands in the companion contract document, and lists the choices that remain open.

---

### 1. The problem, told from the desk

A phone in one hand, the graph of a book on its screen, a thumb over a card. The tap lands and waits, two hundred and fifty milliseconds, in case a second one is coming, because a double tap on this site means zoom until the title is readable and a single tap means open the card in place, and a tap that fires too early would do both. That wait is in post-pipe, in a file called `tapGate.js`, thirty lines with an injectable clock so the timing can be tested. The table that says what the double tap does is in another file, `actions.js`, and the site's owner can change a row of it without touching code. This is good work. It is also welded, by every path it takes to the screen, to one SVG viewer with HTML cards inside it, a component six thousand lines long, where the keyboard lives in a scatter of window listeners the table knows nothing about and a controller does not exist at all.

Across the desk, in exoskeleton, three graph layouts of the same data sit in three docked panels (Dockview), and a hover in one lights the same node in the others, not by position but by name. The event that crosses the panel boundary is an OSC message, `/json/{doc}/select`, carrying an identifier and nothing else, and the comment on the channel that decouples the panels calls it a foot-pedal gesture, because you are already using both hands and want the other panels to stop following. That is the right output. But there is no input layer above it. Each panel takes what its library gives, d3.zoom here (D3, "d3-zoom"), a three.js orbit control there, cytoscape's own handlers in the third, and the only keystrokes the whole application knows are two chords that open a sidebar.

So the two projects hold complementary halves. One has the front of the pipeline, recognizers and a table, bound to a renderer. The other has the back, actions by name on a wire, with no front at all. Neither has a controller. Neither treats the keyboard as a peer of the pointer. And when the question came up, in the plain form a person asks it, whether there is a drop-in library that hands camera control to a layer where the user chooses the type, the honest answer after two rounds of looking was that every piece exists and the composition does not.

### 2. What exists

It helps to say what the pieces are before saying why no one has put them together.

The oldest layer is theory. Buxton's three-state model describes any pointing device as a machine with states for out of range, tracking, and dragging, and shows that a mouse and a touchscreen differ in which states they can reach, which is the same fact post-pipe discovered by hand when it learned that a finger does not hover (Buxton). Card, Mackinlay, and Robertson laid out the design space of input devices as a morphology, a table of what each device senses and in how many dimensions, so that a new device could be placed on the chart before it was built (Card et al.). Myers, in the Garnet system, separated interactors from the objects they acted on, so that the same drag behaviour could be attached to anything drawable, a separation this paper is still arguing for thirty-five years later (Myers). Shneiderman named direct manipulation, and Hutchins, Hollan, and Norman explained why it feels direct, in terms of the distance between what a person intends and what the interface lets them say (Shneiderman; Hutchins et al.). Norman later folded the same idea into the plain word mapping, the match between what a control does and what a person expects it to do, which is the thing a profile exists to let a person set for themselves (Norman). Hinckley and Wigdor's survey of input technologies, a generation on, makes the case that direct input now spans touch, pen, and sensed motion as one family, which is the case this paper's device catalogue assumes (Hinckley and Wigdor). None of this is code, and all of it is the shape of the code that follows.

The second layer is the game engines, which took the theory seriously because a game has to ship on a keyboard, a controller, and a touchscreen on the same day. Godot has an InputMap, actions by name bound to any number of device events, editable in the project settings and at runtime (Godot Engine, "InputMap"; Godot Engine, "Using InputEvent"). Unity's Input System has action maps, bindings per device, processors on the values, and control schemes a player can switch between (Unity Technologies). Unreal's Enhanced Input adds mapping contexts that stack, so the bindings for driving a vehicle sit over the bindings for walking and come off again when the player climbs out (Epic Games). This is the model. It is also native, inside engines that own the camera and the scene, and it does not reach the web except through engines that copy it: KAPLAY binds one action name to keys, a mouse button, and a controller button at once; Excalibur has an InputMapper that feeds a command from any input; the GWEN engine's input plugin covers keyboard, mouse, gamepad, touch, and gyroscope with stackable contexts (KAPLAY; Excalibur.js; gwenjs). Each of these is the right shape and each is a game engine.

The third layer is the viewports themselves, the map and chart and model viewers of the web, and here the binding table appears again and again, each time bolted to one renderer. Cesium's camera controller exposes the gestures that zoom, rotate, tilt, and translate as arrays of event types with optional modifiers, rebindable at runtime (Cesium). three.js ships an ArcballControls with a `setMouseAction` that takes an operation, a button, and a modifier key, and a separate community library, camera-controls, keeps a map from mouse buttons and finger counts to an action enum (three.js; yomotsu). OpenSeadragon, the deep-zoom image viewer, has a gesture profile per pointer type, one settings object each for mouse, touch, pen, and unknown, which is the per-device field of this paper's table shipped years ago (OpenSeadragon). OpenLayers composes interactions, DragPan and PinchZoom and KeyboardPan, gated by condition functions and added or removed at runtime (OpenLayers). MapLibre and Leaflet expose one handler per gesture with an enable and a disable (MapLibre; Leaflet). pixi-viewport builds the camera out of plugins, drag and pinch and wheel and decelerate, each with options for which buttons and which held keys (Figatner). Sigma.js, a WebGL graph renderer, keeps a camera whose whole state is a position, a ratio, and an angle, which is the two-dimensional half of this paper's camera with rotation already in it (Sigma.js). And deck.gl, most interestingly, splits the problem the way this paper does: an event manager, mjolnir.js, that unifies mouse, touch, wheel, and keyboard with no renderer attached, and a Controller that turns gestures into a ViewState that pluggable views consume (vis.gl, "EventManager"; vis.gl, "Controller"; Green and Chen). It stops short of profiles and of controllers, and the views are deck.gl's.

The fourth layer is the applications that let a user pick, which is the layer a person actually sees. Blender ships keymap presets, its own and an industry-compatible one, chosen in preferences (Blender Foundation). SolidCraft, an open-source CAD program, ships navigation presets named after the commercial tools whose mouse conventions they copy (Tangency Labs). ComfyUI added a Navigation Mode setting, with a standard mode, the older drag-navigation mode, and a custom one, to a node canvas that had only ever had one way to move (Comfy Org, "ComfyUI LiteGraph"; Comfy Org, "ComfyUI 0.3.51"). Each of these is a profile picker, and each is inside its application.

Read across the four layers, the pattern is plain. The theory says separate the interactor from the object. The engines do it, natively, with the camera inside. The web viewports do it, each inside its own renderer, so that adopting the table means adopting the canvas. The applications let a user choose, inside the application. What does not exist is a layer that is device-complete down to the controller, profile-based down to the user's own rows, and bound to nothing, so that post-pipe's SVG cards and exoskeleton's three.js panels and whatever comes next could all sit under one table. That is the gap, and it is narrower than "no one has built this." Everyone has built it. No one has let it go.

### 3. The Unix shape

The way to let it go is the way Unix let things go: small programs, each doing one thing, connected by streams whose format is plain enough that any program can read what another wrote (McIlroy et al.; Raymond). Kernighan and Pike put it as a question to ask of every tool, what does it read and what does it write, and if the answer is clear the tool can be composed (Kernighan and Pike). ur-control is four such tools and two kinds of file.

**Adapters** read a device and write signals. A pointer adapter reads DOM pointer, touch, and wheel events, the first of which the web now treats as the one model for mouse, pen, and finger and the second as a legacy it still has to honour (W3C, *Pointer Events*; W3C, *Touch Events*), and writes one record per reading: which source, which contact, where, how hard, with what modifiers. A gamepad adapter polls the Gamepad API every frame, because that API is polled and not evented, applies the standard mapping where the controller declares it, and writes button and axis records with the raw index kept beside the name (W3C, *Gamepad*; Mozilla, "Using the Gamepad API"). A keyboard adapter writes key records with both the physical code and the typed key, and tracks held keys as down until they lift, because auto-repeat is a property of the operating system and not of the hand (Mozilla, "KeyboardEvent"). A MIDI adapter writes notes and control changes; an OSC adapter writes whatever address arrives; a sensor adapter writes tilt. An adapter knows one device family and nothing else.

**Recognizers** read signals and write gestures. The tap gate reads pointer records and writes `tap` or `doubletap`, with the first tap's target kept so a double that drifts off the card is still the card's. The long press reads a down and a clock and writes `longpress` if nothing moves for half a second, and marks the release so it is not also a tap. The twist reads two contacts and writes an angle per frame. The deadzone reads a stick and writes nothing until the stick is a seventh of the way out, then writes a curved value. A recognizer carries its thresholds as parameters and reads them from the profile, so that a site with slower readers can lengthen the double-tap window without a build.

**The table** reads a gesture, a target, and a context and writes an action. The target comes from the viewport, by a query, and the context comes from the application, by a declaration. The table's rows come from a profile, which is a file. The resolution is deterministic and small enough to hold in a head: a profile's rows go over its parent's; an action a profile binds is bound only where that profile binds it; a row with a device beats one without, a row with modifiers beats one without, a row with a context beats one without; a readable card falls back to a card, and any target falls back to no target; two rows still tied, the later one. A row that names something the table does not know is dropped with one line in the console, and an action that cannot answer the gesture it is bound to becomes `none`, with one line. post-pipe has the first two rules and the validation in production (Rosen, "Actions"); the rest extend them. The full obligation on the viewport side is the companion contract's (Rosen, "ur-control").

**The viewport** reads actions and answers queries. It owns a camera with named verbs, pan and zoom about a point and rotate about a point and fit and fly to an item by its name, each taking an optional animation. It answers `targetAt(x, y)` with a kind, an identifier, and a region, so that a drag from a card's edge can resize while a drag from its body moves. It keeps a navigation cursor for devices with no pointer, and answers `move(left)` by its own geometry, because only the viewport knows which card is to the left of this one in this embedding. It draws highlights, sets the mouse cursor's shape, and declares its contexts. It never listens to a raw event and it never decides what a gesture means. The full obligation is in the companion contract, section three, and nothing in this paper changes it.

Two kinds of file hold the rest. A **profile** is JSON, with a name, a parent, the devices it applies to, its thresholds, and its rows, and fifteen of them ship as templates, from a mouse to a television remote to a two-switch scanner, so that an agent wiring a new application copies the ones that apply instead of writing rows from memory. A **session** is the stream itself, written down: every signal, gesture, and action in order, one record per line, which makes a recorded session replayable against a viewport, a bug reproducible from a file, and a test writable without a browser.

| module | reads | writes |
| --- | --- | --- |
| pointer adapter | DOM pointer, touch, wheel events | signal records: source, contact, position, pressure, modifiers |
| gamepad adapter | `navigator.getGamepads()` each frame | signal records: button index and name, axis index and value |
| keyboard adapter | keydown, keyup | signal records: code, key, held set, modifiers |
| MIDI, OSC, sensor adapters | their APIs | signal records |
| recognizers | signal records, thresholds | gesture records: name, phase, point, delta, value |
| table | gesture record, `targetAt` answer, context set, profile | action record: id, phase, target, point, delta, value, device, profile |
| viewport | action records | camera state; answers to `targetAt`, `boundsOf`, `cursor.*`, `contexts()` |
| profile | nothing | rows and thresholds for the table and the recognizers |
| session file | the stream, teed | the stream, replayed |

The boundaries are text. That is the Unix discipline and it is also exoskeleton's discipline already, because an action with a name and a target is one short step from an OSC message, and exoskeleton's bus is OSC used as a naming convention with a UDP bridge switched off by default (Rosen, "Cross-Panel"; Wright). The step is so short that the table's output could be OSC addresses natively, and a TouchOSC layout on a tablet across the room would then be one more adapter. Whether it should be is one of the open choices below.

### 4. The design as it stands

The contract document holds the design in full. This section is its outline, so the paper can be read alone.

A viewport owes the layer an element, its metrics and safe-area insets, a camera in two-dimensional or three-dimensional form with the verbs above, a hit-test, a navigation cursor, feedback hooks, and a context stack. The layer owes the viewport an action stream, and nothing else; it does not touch the viewport's DOM, it does not know what a node is beyond its name.

The device catalogue runs from the mouse, with its five buttons and its two wheel axes and the platform-dependent units its deltas arrive in, through the trackpad, whose pinch reaches the browser disguised as a wheel event with the control key held, through pen and touch and phone, where the browser's own gestures for back and refresh and page zoom must be absorbed or respected, through small touch screens with one contact and a crown, through the keyboard with its two names for every key, to game controllers with the standard mapping's sixteen buttons and four axes laid out by index and by glyph for the three console vocabularies, and on to the long tail: joysticks and flight yokes, racing wheels, arcade sticks, six-axis mice over WebHID, MIDI surfaces, OSC, foot pedals that arrive as keys, television remotes that arrive as keys, accessibility switches that scan, and the phone's own tilt. Each entry says what the device gives, what it lacks, and the quirks a recognizer must absorb. A device not in the catalogue is not supported, by definition, until it is added, and that definition is the point: the list is the thing that keeps an agent from forgetting.

The gesture vocabulary names what the recognizers can emit, with post-pipe's measured thresholds as the defaults, two hundred and fifty milliseconds and thirty-two pixels for a double, five hundred milliseconds and eight pixels for a long press, a third of a log step as the most one wheel event may zoom.

The action vocabulary keeps post-pipe's names where they exist and adds the camera verbs, the navigation verbs, selection, synchronisation, profile switching, and a reserved `app.*` namespace that passes through untouched.

The profile schema and the resolution rules are as section three gives them. Fifteen templates ship. Two of them are post-pipe's current engine defaults row for row and the Elinor Jones site's table, so that loading the layer under post-pipe should change nothing a reader can feel.

### 5. Choices still open

A white paper that reported only decisions would be a specification. These are the places where the design could go two ways, with the author's lean where there is one.

**Lift or adopt, for the recognizers.** post-pipe's tap gate, long press, twist, two-finger tap, and wheel cap are tested and tuned, and lifting them is a day's work. mjolnir.js covers the same ground for pointer, touch, and wheel, is dependency-free, and is maintained by the group that maintains deck.gl, but its commit cadence is not confirmed, and it has no gamepad. The lean is to lift post-pipe's, because the thresholds are already the right ones for reading, and to keep mjolnir.js as the fallback if the pointer adapter grows beyond what one person wants to own.

**Whether the keyboard enters the table.** post-pipe's documentation calls the keyboard fixed, outside the table, and there is a case for that: a key is not a gesture on a target, and a site owner rewriting a row for the plus key is a strange thing to picture. The lean is yes, into the table, because a television remote is a keyboard, a foot pedal is a keyboard, an accessibility switch is a keyboard, and a layer that leaves the keyboard out has left those out.

**Actions as plain identifiers or as OSC addresses.** Plain identifiers are what post-pipe has. OSC addresses are what exoskeleton speaks, and an action stream in that form is externally drivable the moment the bridge is on. The lean is plain identifiers in the table and a one-line mapping to addresses at the boundary, so that a profile does not need to know OSC exists.

**One profile per application, or one per viewport.** exoskeleton's declared controls are already per panel type with state per instance, and a two-dimensional panel and a three-dimensional panel genuinely want different rows for the right stick. The lean is one active profile per application, with per-viewport target kinds and per-viewport overrides of camera rows, which is what a controller user would expect when switching tabs.

**Profiles that stack.** A desktop has a mouse and a keyboard at once, and a laptop with a controller plugged in has three. Unreal's mapping contexts stack and come off again. The lean is a stack, with the device field on each row doing the work of keeping the layers from colliding, and a rule that a connected controller offers its profile rather than replacing the active one.

**Who sets the CSS.** `touch-action`, `user-select`, `overscroll-behavior`, and the context menu must be set on the viewport's element for the recognizers to work, and either side could set them. The lean is that the layer sets them on attach and restores them on detach, because a viewport that forgets one of them fails in a way that looks like a recognizer bug.

**The pivot policy.** Every zoom keeps one screen point still, and post-pipe's cover art wants that point to be the art, where exoskeleton wants the pointer. This is a per-application setting, and probably a per-viewport one, and the only open question is whether a profile may override it. The lean is no: the pivot belongs to the viewport, and a profile that moved it would surprise the application.

**Persistence and the rebinding interface.** The user's chosen profile and their edited rows must survive a reload. The schema is the layer's; the storage is the application's, post-pipe's view state or exoskeleton's workspace. The rebinding interface is not designed, and the lean is to design it once, as a viewport of its own that reads the catalogue and the active profile and writes rows, so that every application gets the same one.

**Recording and replay.** The session file is cheap to write and expensive to leave out. The lean is to write it from the first day, behind a flag, and to make the test suite read it.

**Where the layer runs.** A worker cannot read DOM events, so the adapters must be on the main thread; the recognizers and the table could be elsewhere. The lean is the main thread for all of it until a profiler says otherwise.

**Names.** The repository, the layer, the verbs, the profile, the cursor, the file formats. Harold names what needs a name, and every name in this paper and its companion is a placeholder until he does.

### 6. What it gives the projects, and the next three moves

For post-pipe, the layer is a refactor of what already works. The table and the recognizers move out of the viewer and come back in as a dependency; the force layout stays, because it only produces positions (D3, "d3-force"); d3.zoom goes, replaced by a forty-line camera that owns `x`, `y`, `k`, and `angle` and answers the verbs; rotation stops being a capture-phase hack layered under a library that does not know about it; the keyboard's scattered listeners become rows; a controller works for the first time. A reader on a phone feels nothing change. A site owner gains the ability to say, in one file, that this book is read with a controller from the couch.

For exoskeleton, the layer is the input half it never had. One panel at a time implements the contract, the three.js panels first because `controlType` already exposes a camera choice and camera-controls already has a binding map to borrow from, then the d3 panels, then cytoscape. The connected flag becomes `sync.toggle`, bound to a pedal, a key, a bumper, as the user likes. The deck mode on a phone gains a profile instead of a layout only. And because every action is already one step from an OSC address, the bridge that lets a tablet across the room drive the graph needs no new code on the viewport side.

For information2topology, nothing yet, and nothing needs to be said until it grows a viewport of its own.

The next three moves are small. First, lift post-pipe's recognizers and table into a package with the schema from section three and the templates as fixtures, with the session file as the test input. Second, give one exoskeleton panel a camera that answers the verbs, remove d3.zoom from that panel, and drive it from the package under the mouse profile, then the phone profile, then a controller. Third, put the table under post-pipe behind the engine-defaults profile and confirm with the recorded sessions that nothing moved.

### 7. A side thought

White papers in development projects are usually written once, at the start, and then drift from the code they describe until someone deletes them. This one lives beside its contract and its templates, in the same directory, under the same version control, and the contract is the thing the code is tested against, so the paper has a reason to stay true. Harold raised, in passing, whether a document like this could be a zpaper, a living paper whose claims are bound to the artefacts that make them true. The thought is left here as it was raised, to be entertained as the work goes on. If it holds, the test is simple: a claim in section four that the code no longer honours should fail somewhere a build can see.

---

### A note on sources

Every web source below was checked on the date given. Where the live site could not be reached from the machine that checked it, the page's content was confirmed from the repository that generates it or from the page as search engines hold it, and any detail that could not be confirmed that way, a day, a version, a byline, is left out rather than guessed. The companion contract and its templates exist, as of this draft, only on the branch named in their entry.

## Works Cited

Blender Foundation. "Keymap." *Blender Manual*, docs.blender.org/manual/en/latest/editors/preferences/keymap.html. Accessed 6 Nov. 2026.

Buxton, William. "A Three-State Model of Graphical Input." *Human-Computer Interaction – INTERACT '90*, edited by D. Diaper et al., North-Holland, 1990, pp. 449–56.

Card, Stuart K., et al. "A Morphological Analysis of the Design Space of Input Devices." *ACM Transactions on Information Systems*, vol. 9, no. 2, Apr. 1991, pp. 99–122, https://doi.org/10.1145/123078.128726.

Cesium. "ScreenSpaceCameraController." *CesiumJS Reference Documentation*, cesium.com/learn/cesiumjs/ref-doc/ScreenSpaceCameraController.html. Accessed 6 Nov. 2026.

Comfy Org. "ComfyUI 0.3.51: Subgraph, New Manager UI, Mini Map and More." *ComfyUI Blog*, blog.comfy.org/p/comfyui-035-frontend-updates. Accessed 6 Nov. 2026.

---. "ComfyUI LiteGraph (Canvas) Settings." *ComfyUI Documentation*, docs.comfy.org/interface/settings/lite-graph. Accessed 6 Nov. 2026.

D3. "d3-force: Force-Directed Graph Layout Using Velocity Verlet Integration." *GitHub*, github.com/d3/d3-force. Accessed 6 Nov. 2026.

---. "d3-zoom: Pan and Zoom SVG, HTML or Canvas Using Mouse or Touch Input." *GitHub*, github.com/d3/d3-zoom. Accessed 6 Nov. 2026.

Dockview. *Dockview*, dockview.dev. Accessed 6 Nov. 2026.

Epic Games. "Enhanced Input in Unreal Engine." *Unreal Engine Documentation*, dev.epicgames.com/documentation/en-us/unreal-engine/enhanced-input-in-unreal-engine. Accessed 6 Nov. 2026.

Excalibur.js. "InputMapper." *Excalibur.js API Reference*, excaliburjs.com/api/class/InputMapper. Accessed 6 Nov. 2026.

Figatner, David. "pixi-viewport: A Highly Configurable Viewport/2D Camera Designed to Work with pixi.js." *GitHub*, pixijs-userland, github.com/pixijs-userland/pixi-viewport. Accessed 6 Nov. 2026.

Godot Engine. "InputMap." *Godot Engine Documentation*, stable version, docs.godotengine.org/en/stable/classes/class_inputmap.html. Accessed 6 Nov. 2026.

---. "Using InputEvent." *Godot Engine Documentation*, stable version, docs.godotengine.org/en/stable/tutorials/inputs/inputevent.html. Accessed 6 Nov. 2026.

Green, Ib, and Xiaoji Chen. "RFC: Break out Event Manager." *deck.gl*, dev-docs/RFCs/v5.0/break-out-event-manager-rfc.md, GitHub, Aug. 2017, github.com/visgl/deck.gl/blob/master/dev-docs/RFCs/v5.0/break-out-event-manager-rfc.md. Accessed 6 Nov. 2026.

gwenjs. "@gwenjs/input: Type-Safe, Composables-First Input Plugin for the GWEN Game Engine." *GitHub*, github.com/gwenjs/input. Accessed 6 Nov. 2026.

Hinckley, Ken, and Daniel Wigdor. "Input Technologies and Techniques." *The Human-Computer Interaction Handbook: Fundamentals, Evolving Technologies, and Emerging Applications*, edited by Julie A. Jacko, 3rd ed., CRC Press, 2012.

Hutchins, Edwin L., et al. "Direct Manipulation Interfaces." *Human-Computer Interaction*, vol. 1, no. 4, 1985, pp. 311–38, https://doi.org/10.1207/s15327051hci0104_2.

KAPLAY. "Unified Input and Input Bindings." *KAPLAY* wiki, GitHub, 14 June 2024, github.com/kaplayjs/kaplay/wiki/Unified-Input-and-Input-Bindings. Accessed 6 Nov. 2026.

Kernighan, Brian W., and Rob Pike. *The UNIX Programming Environment*. Prentice-Hall, 1984.

Leaflet. "Leaflet API Reference." *Leaflet*, leafletjs.com/reference.html. Accessed 6 Nov. 2026.

MapLibre. "Map." *MapLibre GL JS Docs*, maplibre.org/maplibre-gl-js/docs/API/classes/Map/. Accessed 6 Nov. 2026.

McIlroy, M. D., et al. "UNIX Time-Sharing System: Foreword." *The Bell System Technical Journal*, vol. 57, no. 6, part 2, July–Aug. 1978, pp. 1899–904.

Mozilla. "KeyboardEvent: code Property." *MDN Web Docs*, developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code. Accessed 6 Nov. 2026.

---. "Using the Gamepad API." *MDN Web Docs*, developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API. Accessed 6 Nov. 2026.

Myers, Brad A. "A New Model for Handling Input." *ACM Transactions on Information Systems*, vol. 8, no. 3, July 1990, pp. 289–320, https://doi.org/10.1145/98188.98204.

Norman, Don. *The Design of Everyday Things*. Revised and expanded ed., Basic Books, 2013.

OpenLayers. "ol/interaction." *OpenLayers API Documentation*, openlayers.org/en/latest/apidoc/module-ol_interaction.html. Accessed 6 Nov. 2026.

OpenSeadragon. "OpenSeadragon." *OpenSeadragon API Documentation*, openseadragon.github.io/docs/OpenSeadragon.html. Accessed 6 Nov. 2026.

Raymond, Eric S. *The Art of Unix Programming*. Addison-Wesley, 2003.

Rosen, Harold. "Actions and What Triggers Them." *post-pipe*, docs/ACTIONS.md, GitHub, 2026, github.com/halapenyoharry/post-pipe/blob/main/docs/ACTIONS.md. Accessed 6 Nov. 2026.

---. "Cross-Panel Graph Synchronization." *exoskeleton*, docs/cross-panel-sync.md, GitHub, 2026, github.com/halapenyoharry/exoskeleton/blob/main/docs/cross-panel-sync.md. Accessed 6 Nov. 2026.

---. "ur-control: What a Viewport Owes the Input Layer." *exoskeleton*, docs/ur-control/README.md, branch hhvc/zen-lovelace-i5t307, GitHub, 6 Nov. 2026, github.com/halapenyoharry/exoskeleton/blob/hhvc/zen-lovelace-i5t307/docs/ur-control/README.md. Accessed 6 Nov. 2026.

Shneiderman, Ben. "Direct Manipulation: A Step Beyond Programming Languages." *Computer*, vol. 16, no. 8, Aug. 1983, pp. 57–69, https://doi.org/10.1109/MC.1983.1654471.

Sigma.js. "Camera." *Sigma.js API Reference*, www.sigmajs.org/api/sigma/classes/camera/. Accessed 6 Nov. 2026.

Tangency Labs. "Release v0.29.0." *SolidCraft*, GitHub, 1 Nov. 2026, github.com/tangency-labs/solidcraft/releases/tag/v0.29.0. Accessed 6 Nov. 2026.

three.js. "ArcballControls." *three.js docs*, threejs.org/docs/pages/ArcballControls.html. Accessed 6 Nov. 2026.

Unity Technologies. "Input System." *Unity Package Documentation*, docs.unity3d.com/Packages/com.unity.inputsystem@latest. Accessed 6 Nov. 2026.

vis.gl. "Controller." *deck.gl*, deck.gl/docs/api-reference/core/controller. Accessed 6 Nov. 2026.

---. "EventManager." *mjolnir.js*, visgl.github.io/mjolnir.js/docs/api-reference/event-manager. Accessed 6 Nov. 2026.

W3C. *Gamepad*. Edited by Steve Agoston and Matt Reynolds, W3C Working Draft, 10 July 2025, www.w3.org/TR/gamepad/. Accessed 6 Nov. 2026.

---. *Pointer Events Level 3*. W3C Recommendation, 2026, www.w3.org/TR/pointerevents3/. Accessed 6 Nov. 2026.

---. *Touch Events*. W3C Recommendation, 10 Oct. 2013, www.w3.org/TR/touch-events/. Accessed 6 Nov. 2026.

Wright, Matt. "OpenSoundControl Specification 1.0." Version 1.0, 26 Mar. 2002. *OpenSoundControl.org*, CNMAT / Stanford CCRMA, opensoundcontrol.stanford.edu/spec-1_0.html. Accessed 6 Nov. 2026.

yomotsu. "camera-controls: A Camera Control for three.js, Similar to THREE.OrbitControls Yet Supports Smooth Transitions and More Features." *GitHub*, github.com/yomotsu/camera-controls. Accessed 6 Nov. 2026.

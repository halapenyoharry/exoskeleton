# ur-control: what a viewport owes the input layer

Status: draft contract, 2026-11-06. It lives here until the `ur-control`
repository exists; then it moves there and this file becomes a pointer.
Every name in this document is a placeholder unless it already exists in
post-pipe or exoskeleton. Harold names what needs a name.

This is the document an agent reads before touching input in any of
Harold's apps. If a device, a gesture or a controller type is not in
section 5 or 6, add it here first. The point of the file is that nothing
is forgotten twice.

---

## 0. Why

post-pipe has a binding table for pointer gestures on its graph
(`src/lib/actions.js`, `docs/ACTIONS.md`) and hand-rolled recognizers for
tap, double tap, long press, two-finger tap and twist. exoskeleton has no
input layer at all, but it has the right output: an action named on a bus,
never a position (`src/osc/channels/`). Neither treats the keyboard as a peer
of the pointer. Neither knows a game controller exists. Both are welded to
d3.zoom, which owns the camera and the input at once.

ur-control separates those. It owns the devices and the table. The app owns
the viewport. This file is the seam between them.

## 1. The three layers

```
device ──signals──▶ recognizers ──gestures──▶ binding table ──actions──▶ viewport verbs
   (1)                   (1)                     (2)                      (3)
```

| layer | owns | lives in |
| --- | --- | --- |
| 1. device to gesture | adapters per device family, recognizers, thresholds, glyphs | ur-control |
| 2. gesture to action | the table, profiles, resolution rules, user rebinding, persistence of the user's choice | ur-control |
| 3. action to viewport | the camera, hit-testing, navigation cursor, feedback | the app, against the contract in section 3 |

ur-control never draws and never decides where anything is. The app never
listens to a raw event and never decides what a gesture means.

## 2. Vocabulary

| word | meaning |
| --- | --- |
| device | a physical thing a person acts with: mouse, trackpad, pen, finger, keyboard, controller, remote, switch, sensor |
| source | one input of a device: left button, wheel, left stick X, key `KeyW`, finger 2 |
| signal | one raw reading from a source: down, up, move, delta, axis value |
| gesture | what the recognizers make of signals: tap, drag, pinch, chord, stick, button hold |
| target | what the gesture landed on, as the viewport reports it: `node`, `container`, `space`, `edge`, `handle`, or nothing (for keys and controllers, the navigation cursor's target) |
| action | what the app can do, by id: `view.pan`, `node.openReader` |
| binding | one row: this gesture, on this target, under this device and context, runs this action |
| profile | a named set of rows, with a parent it extends. The thing a user picks |
| context | a stack of modal states the app declares: `typing`, `reader`, `menu`, `dragging` |
| viewport | the app's drawing surface plus everything it owes (section 3) |
| camera | the viewport's transform and the verbs that move it |
| cursor | the navigation cursor: the current item for devices that have no pointer |

## 3. The contract: what a viewport owes

An app registers a viewport with ur-control by handing it an object with the
members below. Names are placeholders. Anything marked *optional* may be
omitted and the matching actions become `none` for that viewport, with one
console line saying so.

### 3.1 An element, and the CSS it sets

- `element`: the DOM element ur-control attaches listeners to. One per viewport.
- The viewport sets on it, or ur-control sets for it (decision open):
  `touch-action: none` (ur-control owns all touch, or `pan-y` on scrollable
  children it yields to), `user-select: none` except inside text it wants
  selectable, `overscroll-behavior: contain`, `-webkit-touch-callout: none`,
  and it suppresses `contextmenu` where long press is bound.
- Children that keep the browser's own behaviour (a scrollable card body,
  a text input, a slider) carry a marker attribute (post-pipe uses
  `.rp-scroll` and `[data-pp-listen]`); ur-control's recognizers yield there.

### 3.2 Metrics and capabilities

- `size()`: width, height in CSS px; `devicePixelRatio`.
- `insets()`: safe-area insets (phone notch, home bar) so edge gestures and
  targets avoid them.
- `capabilities()`: `{ dimensions: 2 | 3, rotate: bool, tilt: bool, bounds: bool }`.
  ur-control reads the device side itself (`pointer: coarse`, `hover: none`,
  gamepads present) and does not ask the viewport about devices.

### 3.3 A camera

Two forms. A viewport provides one.

2D state: `{ x, y, k, angle }` (translate, scale, rotation about the view's
origin). post-pipe's `zoomPivot.js` is a third of this math already.

3D state: `{ position, target, up }` plus `fov` or orthographic size.

Verbs, each taking `{ animate?: ms, ease? }`:

| verb | 2D | 3D |
| --- | --- | --- |
| `pan(dx, dy)` | translate by screen px | truck/pedestal (move along the view plane) |
| `zoomAbout(ratio, px, py)` | scale about a screen point; the world under that point stays put | dolly toward the ray through the point |
| `zoomStep(dir)` | one step (post-pipe: 1.25×) about the pivot policy | same |
| `rotateAbout(theta, px, py)` | rotate about a screen point | orbit about the target |
| `tilt(dtheta)` | not applicable | pitch the camera |
| `fit(box?)` | fit the whole graph, or a box, with margin | same |
| `flyTo(id)` | centre on an item by identity, in this viewport's own embedding | same; exoskeleton already does this on `/json/{doc}/focus` |
| `follow(id | null)` | keep an item centred as it moves | same |
| `home()` | the view the document opened with | same |
| `setPivot(policy)` | `pointer`, `centre`, `anchor:<id>`, `art` (post-pipe's cover pivot) | same |
| `get()` / `set(state)` | read and write state, for persistence and undo | same |
| `limits()` | scale extent, world bounds, angle locks | same |

Continuous verbs (`pan`, `zoomAbout`, `rotateAbout`, `tilt`) are called every
frame while a drag, a stick or a held key is active, with deltas. The
viewport never sees a pointer position except through `px, py` on the verbs
that need a pivot.

### 3.4 Hit-testing

- `targetAt(px, py)`: returns `{ kind, id, region?, bounds }` or `null`.
  `kind` is one of the viewport's declared target kinds (section 7). `region`
  names a part: `edge`, `corner`, `title`, `grip`, `body`. `bounds` is the
  screen box, so ur-control can decide "readable" and "near".
- `boundsOf(id)`: the screen box of an item, for `flyTo` and for the
  navigation cursor's highlight.
- `targetKinds()`: the list of kinds this viewport can answer, so the
  table can be validated against it at load, the way post-pipe validates rows.

### 3.5 A navigation cursor

For keyboards, controllers, remotes and switches, which have no pointer.
*Optional*, but without it those devices can only drive the camera.

- `cursor.current()`: the item id the cursor is on, or null.
- `cursor.move(dir)`: `left | right | up | down` (spatial, in this viewport's
  embedding) or `next | prev` (sequence, the app's own order: post-pipe's
  `readerNav.js` neighbours).
- `cursor.enter()` / `cursor.exit()`: into a container, out to its parent.
- `cursor.first()` / `cursor.last()`.
- `cursor.set(id)`: ur-control sets it when a pointer device selects.

### 3.6 Feedback

- `highlight(id, state)`: `hover | cursor | selected | none`. The viewport
  draws it; ur-control never styles.
- `cursorShape(shape)`: `grab | grabbing | pointer | crosshair | default`, so
  mouse users see what a drag will do under the active profile.
- `haptic(pattern)` *optional*: passed through to `navigator.vibrate` or a
  controller's actuator by ur-control; the viewport only asks.
- `announce(text)` *optional*: an ARIA live region line for screen readers
  ("Selected: Gilgamesh, 12 connections").

### 3.7 Context

- `contexts()`: the set of active modal contexts. The app declares its own
  names; the reserved ones are `typing` (focus in an input), `menu`, `modal`,
  `dragging`, `reader`. Rows can carry `when` to apply only in or out of a
  context. post-pipe's zoom keys already check three of these by hand.
- `onAction(handler)`: the action stream (section 4). The viewport runs
  `view.*` actions through its camera and hands the rest to the app.

### 3.8 What a viewport must not do

- Listen to pointer, touch, wheel, key or gamepad events itself. One
  exception: a child that keeps the browser's behaviour (3.1).
- Decide what a gesture means, or hold any thresholds.
- Emit a position to any other viewport. Identity only (exoskeleton's rule).
- Assume a device. A viewport that only works with a mouse is a bug.

## 4. The action stream

Every action is an event:

```json
{
  "id": "view.pan",
  "phase": "move",
  "target": { "kind": "space", "id": null },
  "at": { "x": 412, "y": 230 },
  "delta": { "x": -3, "y": 1 },
  "value": null,
  "device": "trackpad",
  "gesture": "twofinger.scroll",
  "modifiers": { "shift": false, "alt": false, "ctrl": false, "meta": false },
  "profile": "trackpad.default"
}
```

`phase` is `start | move | end` for continuous actions and `once` for
discrete ones. `value` carries an axis (−1..1) or a key count. `at` is in
viewport CSS px and is only for pivots and hit-testing; the app must not
persist it.

### 4.1 Standard action vocabulary

Names that exist in post-pipe are kept. New ones are placeholders.

| id | kind | what it does |
| --- | --- | --- |
| `none` | any | nothing; switches a gesture off |
| `view.pan` | continuous | move the view |
| `view.zoom` | continuous | scale about the gesture's point (pinch, wheel, stick) |
| `view.zoomInStep` / `view.zoomOutStep` | once | one step about the pivot policy |
| `view.zoomAtPoint` | once | ~2× at the point, out with shift (post-pipe) |
| `view.rotate` | continuous | rotate or orbit about the gesture's point |
| `view.tilt` | continuous | 3D pitch |
| `view.fit` | once | fit everything |
| `view.home` | once | the opening view |
| `view.deselect` | once | post-pipe: close reader, drop highlight |
| `view.undo` / `view.redo` | once | view or arrangement history |
| `view.flyTo` | once | fly to the target (exoskeleton focus) |
| `view.follow` | once | follow the target until the next pan |
| `node.select` | once | post-pipe: open the card in place |
| `node.openReader` | once | post-pipe |
| `node.zoomToReadable` | once | post-pipe |
| `node.listen` / `node.stopListening` | once | post-pipe |
| `node.move` | continuous | drag the item (post-pipe) |
| `node.resize` | continuous | from its edge (post-pipe) |
| `node.pin` / `node.unpin` | once | hold the layout still for this item |
| `container.toggle` | once | post-pipe |
| `container.enter` / `container.exit` | once | cursor into and out of |
| `nav.left` / `nav.right` / `nav.up` / `nav.down` | once | cursor spatial |
| `nav.next` / `nav.prev` | once | cursor sequence |
| `nav.first` / `nav.last` | once | cursor ends |
| `nav.activate` | once | what a tap does on the cursor's item under this profile |
| `nav.back` | once | the back gesture or button: exoskeleton's back absorption order |
| `select.hover` | once | the hover highlight (mouse, pen); exoskeleton broadcasts it as `/json/{doc}/select` |
| `select.toggle` / `select.clear` | once | multi-select |
| `sync.toggle` | once | exoskeleton `/json/graphs/connected`, the foot-pedal action |
| `profile.next` / `profile.prev` / `profile.set:<name>` | once | switch profile from the device itself |
| `app.*` | any | reserved for the app; passed through untouched |

## 5. Device catalogue

The never-forget list. Each family: what it gives, what it lacks, the
quirks the recognizers must absorb, and which profile template it starts
from. A device not listed here is not supported, by definition, until it is.

### 5.1 Mouse

- Gives: buttons 0 to 4 (left, middle, right, back, forward), vertical and
  horizontal wheel, hover, a fine pointer, modifiers.
- Lacks: pressure, multi-touch, rotation.
- Quirks: wheel `deltaMode` is pixels, lines or pages by platform; a
  high-resolution wheel reports many small deltas; one notch on Chrome can
  report hundreds of pixels (post-pipe caps one event at one step,
  `wheelZoom.js`). Right button opens the context menu unless suppressed.
  Middle click on Windows starts autoscroll. Back and forward buttons
  navigate the page unless prevented. Drag threshold ~4 px.
- Template: `profiles/mouse.json`. Alternatives: `cad-fusion`, `cad-blender`,
  `comfy-standard` (middle or space pans, left selects).

### 5.2 Trackpad

- Gives: two-finger scroll (arrives as `wheel` with pixel deltas and
  momentum), pinch (arrives as `wheel` with `ctrlKey` on Chrome and Firefox;
  Safari also fires `gesturestart`/`gesturechange` with `scale` and
  `rotation`), tap-to-click, force click, horizontal scroll.
- Lacks: a middle button, a wheel notch, three-button CAD conventions.
- Quirks: "natural" scrolling inverts the sign; momentum keeps sending
  deltas after the fingers lift (recognizers must know a scroll ended);
  pinch and ctrl+wheel are indistinguishable on Chrome; rotation is Safari
  only on the web; `pointerType` is `mouse`.
- Template: `profiles/trackpad.json` (two-finger scroll pans, pinch zooms,
  Safari rotation rotates, click selects).

### 5.3 Pen and stylus

- Gives: `pointerType: "pen"`, pressure, tilt, hover without contact,
  a barrel button, an eraser end.
- Quirks: hover shows popovers like a mouse (post-pipe already treats pen as
  hover-capable); palm contact arrives as a second touch (use `isPrimary`);
  the barrel button maps to right click on most platforms.
- Template: `profiles/touch.json` with hover on.

### 5.4 Touchscreen, tablet and touch laptop

- Gives: up to 10 contacts, pinch, twist, two- and three-finger taps and
  drags, long press, coarse pointer, sometimes a mouse at the same time.
- Lacks: hover, a right button, precision.
- Quirks: browsers send both Pointer Events and Touch Events, then a
  synthetic `click` and `dblclick` after the fingers lift (post-pipe's ghost
  guard); the browser's own double-tap zoom and long-press menu must be
  suppressed; a drag on a scrollable child must yield to scrolling
  (post-pipe's `.rp-scroll` rule); d3.zoom and d3.drag race for the same
  touch sequence; targets need 44 px.
- Template: `profiles/touch.json`.

### 5.5 Phone

Everything in 5.4, plus:

- Viewport ≤ 600 px (exoskeleton's deck query), one thumb, usually portrait.
- Browser gestures to respect or absorb: edge swipe back (exoskeleton pushes
  a history sentinel and steps back through its own UI), pull to refresh,
  overscroll, address bar collapse changing the viewport height (use
  `visualViewport`), pinch zooming the page itself.
- Safe-area insets; orientation change; vibration API for haptics;
  `DeviceOrientation` and `DeviceMotion` as tilt axes (optional, must be
  opt-in and asks permission on iOS).
- Template: `profiles/phone.json` (one-finger pan, pinch zoom, tap selects,
  double tap zooms to readable, long press opens the item's menu, edge
  swipe is `nav.back`).

### 5.6 Small touch screens

Watches, kiosks, car and embedded displays.

- Gives: one contact, often no multi-touch, sometimes a rotary crown or
  bezel (an axis), a few physical buttons.
- Lacks: hover, pinch, room.
- Quirks: targets must be very large; one gesture per screen; zoom comes
  from the crown or from `view.zoomInStep` on a tap.
- Template: `profiles/small-touch.json`.

### 5.7 Keyboard

- Gives: `code` (physical key, layout-independent) and `key` (what it
  types), modifiers, auto-repeat, chords, held keys as continuous axes
  (WASD, arrows), numpad, media keys.
- Quirks: never act while `typing` is in the context stack; `preventDefault`
  only on keys the profile binds; the browser reserves Cmd+W, Cmd+T and
  more; a focused iframe swallows keydown (exoskeleton routes Cmd+B and
  Cmd+J through Tauri menu accelerators for this reason); IME composition
  (`isComposing`); layouts (bind by `code` for movement, by `key` for
  mnemonics); auto-repeat makes a held key fire `keydown` repeatedly, so a
  held key is tracked as down until `keyup`, not per event.
- Template: `profiles/keyboard.json` (arrows and WASD pan, +/− zoom, Q/E
  rotate, F fit, H home, Tab and Shift+Tab are `nav.next`/`nav.prev`,
  Enter is `nav.activate`, Escape is `nav.back`).

### 5.8 Game controllers, standard mapping

The Gamepad API. Polled every frame, not evented. A controller becomes
visible only after a button press.

Standard mapping (`gamepad.mapping === "standard"`):

| index | button | glyphs (Xbox / PlayStation / Switch) |
| --- | --- | --- |
| 0 | south | A / ✕ / B |
| 1 | east | B / ○ / A |
| 2 | west | X / □ / Y |
| 3 | north | Y / △ / X |
| 4, 5 | left, right bumper | LB RB / L1 R1 / L R |
| 6, 7 | left, right trigger (analog, 0..1) | LT RT / L2 R2 / ZL ZR |
| 8, 9 | select, start | View Menu / Share Options / − + |
| 10, 11 | left, right stick click | LS RS / L3 R3 / — |
| 12..15 | d-pad up, down, left, right | |
| 16 | home | Xbox / PS / Home |

Axes 0, 1 left stick X, Y; 2, 3 right stick X, Y; −1..1, Y up is negative.

- Recognizers must apply: a radial deadzone (default 0.15), a response
  curve (default squared), digital emulation of a stick or trigger with a
  threshold and auto-repeat for `nav.*`, button double-press and hold,
  stick flick.
- Feedback: `vibrationActuator.playEffect("dual-rumble", …)` where present.
- Glyphs: pick the set from `gamepad.id` (contains "Xbox", "DualSense",
  "DualShock", "Pro Controller", "Joy-Con") and show them in any rebinding UI.
- Non-standard mapping: expose raw indices and let the user bind.
- Template: `profiles/gamepad-standard.json` (left stick pans, right stick
  zooms and rotates, triggers zoom, d-pad is `nav.*`, south activates, east
  is back, bumpers step profiles or cycle panels, start opens the menu).

### 5.9 Other controllers

| family | arrives as | notes |
| --- | --- | --- |
| joystick, HOTAS, flight yoke | Gamepad API, non-standard, many axes and hats | hats are axes with 8 discrete values; throttle is an absolute axis (no centre), needs its own curve |
| racing wheel and pedals | Gamepad API, non-standard | wheel is one absolute axis, pedals are absolute; force feedback not reachable from the web |
| arcade stick | Gamepad API, digital only | d-pad or axis 0/1 at ±1; no analog |
| 3D mouse (SpaceMouse) | WebHID, six axes | the natural 3D camera device; also Gamepad on some drivers |
| MIDI controllers (knobs, faders, pads) | Web MIDI: CC 0..127, notes with velocity | exoskeleton's piano and OSC world; a knob is an absolute axis, an encoder is relative |
| OSC and network controllers (TouchOSC, Sonic Pi) | exoskeleton's bus, UDP bridge | the app's own addresses are the surface; ur-control treats an incoming address as a gesture source |
| foot pedals | keyboard (a key), HID, or MIDI | exoskeleton's `sync.toggle` is the foot-pedal action by its own comment |
| TV and streaming remotes | keyboard events: arrows, Enter, Back/Escape, colour keys, media keys | spatial navigation only; no pointer; use the navigation cursor |
| accessibility switches | one or two keys, or a Gamepad button | scanning: `nav.next` on a timer, `nav.activate` on the switch; a profile with exactly those rows |
| VR controllers | WebXR | reserved; not designed |
| voice | an action source, not a device | speaks action ids straight into the stream |
| phone sensors | `DeviceOrientation`, `DeviceMotion` | tilt as two axes; opt-in |

## 6. Gesture vocabulary

What the recognizers can emit. Thresholds are defaults, overridable per
profile; post-pipe's numbers are kept.

| gesture | devices | parameters (defaults) |
| --- | --- | --- |
| `tap` | pointer, touch, pen | slop 5 px; waits `doubleTapMs` (250) so it never runs as half a double |
| `doubletap` | pointer, touch, pen | 250 ms, 32 px; the first tap's target wins |
| `longpress` | pointer, touch, pen | 500 ms, 8 px slop; release is not a tap; listened for only when bound |
| `drag` | pointer, touch, pen | starts past 5 px; carries `region` from the hit-test |
| `hover` | mouse, pen | never touch |
| `dwell` | touch | 500 ms held, no action on release (post-pipe pills); mouse `hover` 350 ms is the same row |
| `wheel` / `wheel.h` | mouse, trackpad | one notch capped at one step (0.32 log2 per event) |
| `pinch` | touch, trackpad (ctrl+wheel, Safari gesture) | ratio per frame about the midpoint |
| `twist` | touch, Safari trackpad | angle per frame about the midpoint; starts past a few degrees |
| `twofinger.tap` / `twofinger.doubletap` | touch | 350 ms, 14 px; double within 450 ms and 60 px |
| `twofinger.drag` / `threefinger.drag` | touch, trackpad | |
| `swipe.left|right|up|down` | touch | ≥ 70 px, ≤ 700 ms, mostly one axis (post-pipe's reader) |
| `edge.swipe.left|right` | phone | from the screen's edge; usually the OS's own |
| `key` | keyboard, remote | `code` or `key`, modifiers, `repeat` |
| `chord` | keyboard | several keys down together |
| `key.hold` | keyboard | a held key as an axis of value 1 until `keyup` |
| `button` / `button.hold` / `button.double` | gamepad, MIDI pad, switch | index or name |
| `dpad.*` | gamepad | up, down, left, right; auto-repeat 350 ms then 80 ms |
| `stick.left` / `stick.right` | gamepad | axis pair after deadzone and curve |
| `stick.flick.*` | gamepad | a fast push and release past 0.8 |
| `trigger.left` / `trigger.right` | gamepad | 0..1 |
| `axis:<n>` | gamepad, HID, MIDI | raw, for non-standard devices |
| `cc:<n>` / `note:<n>` | MIDI | |
| `osc:<address>` | OSC | |
| `tilt.x` / `tilt.y` | phone sensors | |
| `scan.tick` | switch scanning | a timer the switch profile runs; `scanMs` (1200) |

## 7. The binding table and profiles

A profile is JSON. It extends post-pipe's rows with `device`, `when`,
`modifiers` and `params`, and adds inheritance.

```json
{
  "name": "phone",
  "extends": "touch",
  "devices": ["touch"],
  "thresholds": { "doubleTapMs": 250, "longPressMs": 500 },
  "rows": [
    { "target": "node",  "gesture": "doubletap", "action": "node.zoomToReadable" },
    { "target": "space", "gesture": "edge.swipe.right", "action": "nav.back" },
    { "gesture": "pinch", "action": "view.zoom" },
    { "gesture": "key", "key": "ArrowLeft", "action": "nav.left", "when": ["!typing"] },
    { "gesture": "stick.left", "action": "view.pan", "params": { "speed": 600 } }
  ]
}
```

Row fields: `gesture` (required), `action` (required), `target` (omit for
"anywhere" and for devices without a pointer), `device`, `region`, `key`/`code`/
`button`/`index`/`keys` as the gesture needs, `modifiers` (`shift`, `alt`,
`ctrl`, `meta`, or a held key or controller button such as `space` or
`button: 5`), `when` (context names, `!` negates), `params` (speed, curve,
invert, sign, axis, step), `comment`.

Resolution, inherited from post-pipe and extended:

1. A profile's rows go over its parent's. A row replaces the parent's rows
   for the same gesture, target and device.
2. An action a profile binds is bound only where that profile binds it
   (post-pipe's second rule).
3. More specific wins: a row with a `device` beats one without; a row with
   `modifiers` beats one without; a row with `when` beats one without.
4. `node.readable` falls back to `node`; any target falls back to a row with
   no target.
5. A drag on a card may hold two rows (`node.move` and `node.resize`);
   `region: edge` picks the resize (post-pipe).
6. Two rows still tied: the later one.
7. A row naming an unknown gesture, target, action or device is dropped with
   one console line; an action that cannot answer that gesture becomes `none`
   with one console line. The viewport's `targetKinds()` is the target list.

The user's choice of profile, and any rows they changed in a rebinding UI,
persist with the app's own persistence (post-pipe `viewState`, exoskeleton
workspace params). ur-control defines the shape; the app stores it.

Auto-selection on first run: `pointer: coarse` and width ≤ 600 → `phone`;
`pointer: coarse` → `touch`; a `gamepadconnected` event → offer
`gamepad-standard` as an additional profile (profiles stack: a keyboard and a
mouse are both live on a desktop); otherwise `mouse`, and `trackpad` when
the first wheel event carries pixel deltas with momentum.

## 8. Profile templates

In `profiles/`. Each is complete and loads on its own. An agent asked to
wire a new app copies the ones that apply and changes rows; it does not
write rows from memory.

| file | starts from | for |
| --- | --- | --- |
| `base.json` | nothing | the actions every viewport answers; the parent of all |
| `mouse.json` | base | three-button mouse, wheel |
| `trackpad.json` | mouse | two-finger scroll, pinch, Safari rotate |
| `touch.json` | base | tablets and touch laptops |
| `phone.json` | touch | one thumb, back gesture, readable zoom |
| `small-touch.json` | touch | one contact, big targets, crown as zoom |
| `keyboard.json` | base | keys as pan, zoom, rotate and navigation |
| `gamepad-standard.json` | base | the standard mapping |
| `tv-remote.json` | keyboard | arrows, Enter, Back, no pointer |
| `switch-scanning.json` | base | one or two switches, scanning |
| `cad-fusion.json` | mouse | middle pans, shift+middle orbits, wheel zooms |
| `cad-blender.json` | mouse | middle orbits, shift+middle pans, ctrl+middle zooms |
| `comfy-standard.json` | mouse | left selects, space or middle pans |
| `post-pipe-engine.json` | touch + mouse | post-pipe's engine defaults, row for row |
| `elinor-jones.json` | post-pipe-engine | the site example in `docs/ACTIONS.md` |

## 9. Wiring an app: the checklist

1. Read this file. List the devices the app will meet (section 5). All of
   them, not the one on your desk.
2. Implement the viewport contract (section 3) for each viewport. Start with
   3.1, 3.2, 3.3 and 3.4; add 3.5 if any non-pointer device is in the list
   from step 1 (it is).
3. Remove every raw listener the viewport had. d3.zoom, d3.drag, `onKeyDown`,
   `touchstart`. Keep only the children that yield to the browser (3.1).
4. Declare the app's own actions (`app.*`) and target kinds.
5. Copy the profile templates that apply (section 8). Change rows. Do not
   invent gestures; if one is missing, add it to section 6 first.
6. Register the viewport, the profiles and the persistence hooks.
7. Test with the thresholds table (section 6) and one device per family in
   step 1. A phone, a trackpad and a controller at minimum.
8. Wire feedback (3.6) so a controller or keyboard user can see the cursor.
9. Expose `profile.set` somewhere the user can reach from every device
   (a menu row, a button, a chord).
10. Append a session note where the app keeps them.

## 10. What exists today to lift

| piece | where | becomes |
| --- | --- | --- |
| action ids, rows, resolution, validation, tests | post-pipe `src/lib/actions.js`, `test/` | layer 2 core, generalized by section 7 |
| tap vs double tap, injectable clock | post-pipe `src/components/GraphViewer/tapGate.js` | `tap`, `doubletap` recognizer |
| long press on Pointer Events | post-pipe `GraphViewer.jsx` ~L1278 | `longpress` recognizer |
| two-finger tap, twist | post-pipe `GraphViewer.jsx` ~L995 and ~L1246 | `twofinger.*`, `twist` recognizers |
| wheel cap | post-pipe `src/lib/wheelZoom.js` | `wheel` recognizer |
| zoom about a point, fit about a pivot, repivot | post-pipe `src/components/GraphViewer/zoomPivot.js` | 2D camera math |
| ghost click guard | post-pipe `GraphViewer.jsx` ~L1227 | touch adapter |
| drag yields to scrollable child, edge grip | post-pipe `GraphViewer.jsx` ~L3530 | `drag` filter, `region` |
| swipe to turn the page | post-pipe `ReaderPanel.jsx` ~L434 | `swipe.*` recognizer |
| hover 350 ms vs dwell 500 ms vs tap | post-pipe `FeedZ.jsx` | `hover`, `dwell` |
| sequence neighbours | post-pipe `src/lib/readerNav.js` | `cursor.move('next'/'prev')` |
| action by name on a bus, echo suppression, retention | exoskeleton `src/osc/channels/` | the action stream's transport, and OSC as a gesture source |
| connected flag as a foot-pedal action | exoskeleton `src/osc/channels/connected.ts` | `sync.toggle` |
| back-gesture absorption order | exoskeleton `src/App.tsx` ~L377 | `nav.back` on phone |
| deck mode, 44 px targets under coarse pointer | exoskeleton `src/persistence/deck.ts`, `*.css` | phone profile's viewport side |
| native menu accelerators past the iframe | exoskeleton `src-tauri`, `App.tsx` ~L453 | keyboard adapter on Tauri |
| `controlType` trackball/orbit/fly | exoskeleton 3D panels via react-force-graph-3d | 3D camera verbs, first implementation |

## 11. Open decisions

For Harold. Nothing above is final until these are answered.

1. Names: `ur-control` itself, `profile`, `cursor`, `targetAt`, the action
   ids marked placeholder, the verb names in 3.3.
2. Where the repository lives and whether post-pipe and exoskeleton take it
   as a dependency or vendor it.
3. Whether the keyboard enters the table (this draft says yes) or stays
   fixed per app.
4. exoskeleton: one profile per app, or per panel? This draft assumes one
   per app with per-panel target kinds, because exoskeleton's controls are
   already per panel *type* (`src/chrome/panes/*.panes.ts`, keyed by component)
   with state per panel *instance* (params), and the input side should
   match that shape.
5. Whether ur-control sets the CSS in 3.1 or the viewport does.
6. The default pivot policy per app (`pointer` for exoskeleton; post-pipe
   sites choose `art`).

## 12. Prior art

Checked 2026-11-06. Each of these has one or two of the three layers,
bound to its own renderer or engine. None has all three renderer-agnostic
with controllers included. Read them before designing a piece they already
solved.

| project | what it has | layer | bound to |
| --- | --- | --- | --- |
| mjolnir.js (vis.gl) | dependency-free event manager: mouse, touch, wheel, keyboard; pan, pinch, rotate, swipe recognizers; split out of deck.gl | 1 | nothing; no gamepad |
| deck.gl `Controller` + `ViewState` + `View` | input to view state with pluggable projections (map, orbit, first person, orthographic); per-handler toggles and keyboard speeds | 2 (thin) + 3 (as a contract) | deck.gl views |
| OpenSeadragon `gestureSettingsMouse/Touch/Pen/Unknown` | a gesture profile per pointer type; its own `MouseTracker` pointer abstraction | 2 (per device) | OpenSeadragon |
| Cesium `ScreenSpaceCameraController` | `zoomEventTypes`, `rotateEventTypes`, `tiltEventTypes`, `translateEventTypes`: arrays of event type plus modifier, rebindable at runtime | 2 for the camera | Cesium |
| three.js `ArcballControls.setMouseAction` | operation × button × modifier, with `unsetMouseAction` | 2 for the camera | three.js |
| camera-controls (yomotsu) | `mouseButtons` and `touches` maps to an action enum | 2 for the camera | three.js |
| OpenLayers interactions + conditions | composable interactions (DragPan, PinchZoom, KeyboardPan, DragRotate…) gated by condition functions, added and removed at runtime | 2 | OpenLayers |
| MapLibre and Leaflet handlers | one enable/disable handler per gesture | 2 (toggles only) | their maps |
| pixi-viewport plugins | drag, pinch, wheel, decelerate, follow, with `mouseButtons` and `keyToPress` options | 2 + 3 | PixiJS |
| KAPLAY `buttons` | one action name bound to keyboard keys, a mouse button and a gamepad button at once; `setButton` at runtime | 2, device-complete | KAPLAY |
| Excalibur `InputMapper` | several inputs to one command, keyboard and gamepad shown; pointer normalized to one event type | 2, device-complete | Excalibur |
| `@gwenjs/input` | keyboard, mouse, gamepad, touch, gyroscope; action contexts; runtime rebinding | 1 + 2, device-complete | the GWEN engine |
| Godot `InputMap`, Unity Input System, Unreal Enhanced Input | the model: actions, per-device bindings, processors, contexts, user rebinding | 1 + 2 | native engines |
| SolidCraft navigation presets, ComfyUI Navigation Mode, Blender keymap presets | the user-facing shape: a named profile picked in settings | 2 (UX) | their apps |

What to borrow: mjolnir.js for layer 1 pointer, touch, wheel and keyboard,
if its maintenance holds up; deck.gl's `ViewState` split for the shape of
section 3.3; OpenSeadragon's per-pointer-type profiles for section 7's
`device` field; Cesium's event-type arrays for how a camera row reads;
KAPLAY's `buttons` for how a device-complete row reads; Godot's InputMap for
contexts and processors.

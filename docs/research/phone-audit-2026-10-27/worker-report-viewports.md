# Phone Audit — Viewports, First-Run Screen, Status Bar & iOS/PWA CSS

Covered viewports (`iPhone 15` 393×659, `iPhone SE` 320×568, `iPhone 15 Pro Max` 430×739, `iPhone 15 landscape` 734×343, `Pixel 7` 412×839, dynamic portrait↔landscape rotation at 600px, and PWA full-screen 393×852), first-run screen scrolling, status bar controls & minimize/restore lifecycle, text sizes (<12px), and pinch-zoom/safe-area CSS across **24 screenshots** in `shots/viewports/`.

---

## Findings (most severe first)

### 1. **Gets in the way** — On iPhone SE (320×568) and narrow panes, 2×2 JSON Lab panel headers lose their tab titles or collapse to a single letter with a "∨ 1" overflow indicator
- **What the person does**: Opens the app on an iPhone SE (320×568) or iPhone 15 (393×659) and taps the **JSON Lab** preset.
- **What they see / what happens**:
  - On **iPhone SE (320×568)**, the 35px collapsed left document edge leaves 285px for the 2×2 grid (142px and 143px per column). Inside each 142px group header, the right-side header action buttons (`reset`/`fit` 20×18, `+` 25×20, `⨯` 23×20) and Dockview's tab overflow button (`∨ 1`) squeeze the tab container so tightly that **every tab title is completely hidden** (`tree`, `graph`, `3d`, `cyto` all disappear, leaving only a clipped 3px–6px sliver of the glyph) and a `∨ 1` dropdown indicator appears in all four panes. Furthermore, the `reset`/`fit` button (`x=50, w=20`) overlaps the active tab box (`x=35..127, w=92`).
  - On **iPhone 15 (393×659)** and **Pixel 7 (412×839)**, each column is 179px–189px wide. The `tree`, `graph`, and `cyto` tabs are truncated to `tre`, `gra`, and `cyt` alongside a `∨ 1` indicator, and their `27×27` tab close (`×`) button is pushed out of view unless the user only has a 2-character title like `3d`.
  - On **iPhone 15 landscape (734×343)**, when JSON Lab opens, the left document edge (`w=360`) takes almost half the width, leaving 187px per grid column—where `tree`, `graph`, `3d`, and `cyto` again lose their tab text completely behind `∨ 1`.
- **Measured numbers**:
  - iPhone SE (320×568): left edge `35×568`; grid columns `142×283` and `143×283`; header action buttons `20×18`, `25×20`, `23×20`; visible tab label width `~0px`.
  - iPhone 15 (393×659): grid columns `179×330`; header action buttons `20×18` (`reset`/`fit`), `25×20` (`+`), `23×20` (`⨯`); `Controls` pane header `179×24`.
  - iPhone 15 Pro Max (430×739): grid columns `197×370` and `198×370` — the only tested portrait phone wide enough (`≥197px` per column) for `tree`, `graph`, `3d`, and `cyto` to show their full tab names without `∨ 1`.
- **Screenshots**: `08-iphone15-json-lab.png`, `10-iphonese-json-lab.png`, `12-iphone15promax-json-lab.png`, `14-iphone15-landscape-json-lab.png`, `17-pixel7-json-lab.png`.
- **Likely cause**: `src/persistence/default-layout.ts:482-491` (`buildWebPreset` builds a 2-column × 2-row grid even when `narrow` is true, despite the comment at line 429 saying *"Phones (under 600px) get the stacked web arrangements"*), combined with `src/HeaderActions.css:28-38,65-66` placing multiple header action buttons inside each narrow group header.

---

### 2. **Gets in the way** — Tapping any preset on the first-run screen destroys the status bar edge group and replaces it with the floating `⌬` summoner button
- **What the person does**: Loads the app for the first time (where the bottom status bar is visible at `y=619..659, h=40`) and taps **JSON Lab** (or any preset button on the "THE GRID IS EMPTY" watermark).
- **What they see / what happens**: The status bar at the bottom vanishes, and a floating circular `⌬` button (`38×38`) appears at the bottom-right corner (`x=343, y=609`) overlapping the bottom-right panel (`cyto`). If the user wants the status bar back, they have to tap `⌬`.
- **Measured numbers**:
  - Before tapping preset: `.status-bar-container` is `358×40` at `(35, 619)`.
  - After tapping preset: `.status-bar-container` is absent (`null`); `.status-bar-summoner-btn` is `38×38` at `(343, 609)`, 12px from right and bottom edges.
- **Screenshots**: `01-iphone15-first-run.png`, `08-iphone15-json-lab.png`, `20-iphone15-json-lab-with-statusbar.png`.
- **Likely cause**: `src/Watermark.tsx:13-16` calls `api.clear(); buildPreset(api, presetId);` which removes all panels including `status-bar` and triggers `onDidLayoutChange` in `src/App.tsx:603-611` (`setIsStatusBarVisible(false)`), without calling `ensureStatusBarChrome(api)`.

---

### 3. **Gets in the way** — Status bar controls are all under 44×44px, and the `✕` (Minimize) button and node/edge stats overflow off-screen horizontally on iPhone SE and in JSON Lab on iPhone 15
- **What the person does**: Inspects and taps the controls in the bottom status bar (`.status-bar-container`, height `40px`) on first run and after loading JSON Lab.
- **What they see / what happens**:
  - Every control in the status bar is smaller than Apple's 44×44px touch guideline, and two interactive buttons (`linked` and `✕`) are flagged `small` (<32px in height/width):
    1. **Link toggle button** (`.status-bar-link-btn`, shows `● linked` on phone): `72×29` at `(43, 625)`. Tapping it toggles graph coordination to `● decoupled` (`95×29`, red border/dot); tapping again restores `● linked`.
    2. **Active document badge** (`.status-doc-badge`, non-interactive): `60×27` at `(123, 626)` on first run (`default`), growing to `96×27` (`library-ber…`) when Berry Thief loads in JSON Lab.
    3. **Selected node readout** (`.status-selection`, non-interactive): `108×32` at `(191, 624)` (`No Selection`).
    4. **Graph statistics** (`.status-stats`, non-interactive): `28×22` at `(307, 629)` (`0 · 0` on first run), growing to `60×22` (`124 · 246`) in JSON Lab.
    5. **Minimize button** (`.status-bar-close-btn`, `✕`): `20×25` at `(343, 627)` on first run. Tapping it closes the `status-bar` panel and removes the bottom edge group.
  - **How to get the status bar back after minimizing**:
    - In **grid mode** (default on phone): minimizing reveals the floating `⌬` summoner button (`.status-bar-summoner-btn`, `38×38` at `x=343, y=609`, still under 44×44px). Tapping `⌬` re-mounts the status bar at the bottom.
    - In **deck mode** ("One pane at a time" enabled): the floating `⌬` summoner button is suppressed (`!deckMode` at `src/App.tsx:851`), so the user must open the `⊞` (`Exo-skeleton`) menu tab in the left document edge and tap **Status bar** (`src/panels/MenuPanel.tsx:83-87`).
  - **Horizontal clipping / overflow**:
    - On **iPhone SE (320×568)**, even on first run (`DOC: default`, `0 · 0`), the status bar container is `285px` wide (`x=35..320`) while its content `scrollWidth` is `336px`. The stats (`x=307..335`) are half-cut-off and the `✕` Minimize button (`x=343..363`) is **completely off-screen** unless the user knows to horizontally swipe the 40px-tall status bar strip.
    - On **iPhone 15 (393×659)** with JSON Lab loaded (`library-berry-thief`, `124 · 246`), the status bar `scrollWidth` grows to `404px` inside the `358px` container (`x=35..393`). The edge count (`246` at `x=343..403`) is clipped at the right edge and the `✕` Minimize button (`x=411..431`) is pushed **completely off-screen** until horizontally scrolled.
- **Measured numbers**:
  - `.status-bar-link-btn`: `72×29` (linked) / `95×29` (decoupled), font `12px`.
  - `.status-doc-badge`: `60×27` (`default`) / `96×27` (`library-ber…`), font `12px`.
  - `.status-selection`: `108×32`, font `12.8px`.
  - `.status-stats`: `28×22` (`0 · 0`) / `60×22` (`124 · 246`), font `12.8px`.
  - `.status-bar-close-btn`: `20×25`, font `15.2px`.
  - `.status-bar-summoner-btn`: `38×38` at `(343, 609)`, `bottom: 12px; right: 12px`, font `18.4px`.
- **Screenshots**: `01-iphone15-first-run.png`, `05-status-bar-decoupled.png`, `06-status-bar-minimized-summoner.png`, `07-status-bar-restored.png`, `09-iphonese-first-run.png`, `20-iphone15-json-lab-with-statusbar.png`, `21-iphone15-json-lab-statusbar-scrolled-right.png`.
- **Likely cause**: `src/panels/StatusBarPanel.css:25-42` (`padding: 3px 8px` at line 234, no `min-height: 44px`), `src/panels/StatusBarPanel.css:136-149` (`.status-bar-close-btn` has `padding: 4px`, no `min-width`/`min-height`), `src/panels/StatusBarPanel.css:158-165` (`.status-bar-summoner-btn` is `38×38`), and `src/panels/StatusBarPanel.css:206-214` (`overflow-x: auto` with `justify-content: flex-start` and no visual indicator that the `✕` button is off-screen).

---

### 4. **Gets in the way** — Rotating from portrait to landscape (or vice versa) across the 600px breakpoint leaves the document edge group with stale phone/desktop sizing constraints
- **What the person does**:
  - **Case A**: Opens JSON Lab on iPhone 15 in portrait (`393×659`), taps the left strip (`0,0 35×16`) to open the document sheet (`393×659` full-width overlay), then rotates the phone to landscape (`659×393`).
  - **Case B**: Starts in or rotates to `iPhone 15 landscape` (`734×343`) and taps JSON Lab.
- **What they see / what happens**:
  - Above `600px` width, `.app-frame` loses the `exo-phone` class (`frameClass: "app-frame"`, `DECK_QUERY = "(max-width: 600px)"`), leaving phone mode:
    - The pop-out button (`↗`, `.header-btn--popout`, `32×20`) reappears in every panel header (`src/HeaderActions.css:59-61`).
    - In **Case A** (rotated from 393px portrait with sheet open to 659×393 landscape): because `.exo-phone` is removed, the CSS rule forcing `.exo-doc-edge` to `width: 100% !important; z-index: 30` (`src/DocumentEdge.css:32-35`) stops applying. The document edge drops inline beside the 2×2 grid at `293×393` (and its maximum width remains capped at `393px`, the portrait `window.innerWidth` captured when `documentEdgeOptions` ran at creation time), squeezing the two grid columns to `183×197` each (`23-iphone15-rotated-with-sheet-open.png`).
    - In **Case B** (fresh load in `iPhone 15 landscape` at `734×343`): on first-run, the preset grid switches from 1 column to 2 columns (`13-iphone15-landscape-first-run.png`), and the status bar shows full desktop labels (`COORDINATED LINK ACTIVE`, `Selected Node: No Selection`). When tapping **JSON Lab**, because `isPhoneWidth()` is `false` (`734 > 600`), `finishPreset` (`src/persistence/default-layout.ts:423`) opens the left document edge automatically at `360×343`—consuming **49% of the landscape screen width** and leaving only `187×172` per viewer pane (`14-iphone15-landscape-json-lab.png`).
- **Measured numbers**:
  - `iPhone 15 landscape` (`734×343`): `.app-frame` has no `exo-phone`; document edge opens at `360×343`; 4 grid panes are `187×172` and `187×171` (with `59px` of each `172px` height eaten by the `35px` tab header + `24px` `Controls` header, leaving `113px` of vertical canvas height).
  - Portrait (`393×659`) rotated to landscape (`659×393`) with sheet open: document edge resizes to `293×393`; grid panes become `183×197` and `183×196`.
- **Screenshots**: `13-iphone15-landscape-first-run.png`, `14-iphone15-landscape-json-lab.png`, `15-iphone15-rotated-to-landscape-json-lab.png`, `22-iphone15-docedge-sheet-portrait.png`, `23-iphone15-rotated-with-sheet-open.png`.
- **Likely cause**: `src/persistence/deck.ts:10` (`DECK_QUERY = "(max-width: 600px)"` treats all phone landscape viewports as desktop) and `src/persistence/document-edge.ts:190-209` (`documentEdgeOptions` bakes `initialSize`/`maximumSize` from `window.innerWidth` once at group creation; see comment at line 188: *"Fixed at creation (Dockview reads them once)"*).

---

### 5. **Gets in the way** (Inferred, iOS Safari / Home-Screen PWA) — Floating `⌬` status bar summoner ignores `safe-area-inset-bottom`, and `black-translucent` status bar in `index.html` conflicts with dark UI in standalone mode
- **What the person does**: Installs Exoskeleton to the iPhone Home Screen (PWA standalone mode, simulated at full-screen `393×852` on iPhone 15) and uses the app on first-run and in JSON Lab.
- **What they see / what happens**:
  - **HTML meta tags (`index.html`)**:
    - Line 14: `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />` — `viewport-fit=cover` **is present**, so the webview extends edge-to-edge behind the top 59px Dynamic Island/status bar and bottom 34px home indicator.
    - Lines 10–13: `apple-mobile-web-app-capable="yes"`, `mobile-web-app-capable="yes"`, `apple-mobile-web-app-status-bar-style="black-translucent"`, `apple-mobile-web-app-title="Exo"`, and `/manifest.webmanifest` has `"display": "standalone"`.
  - **CSS `safe-area-inset` / `env()` / `100vh` / `dvh` audit across `src/`**:
    - `.app-frame` (`src/App.css:28-34`) sets `position: absolute; inset: 0; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); box-sizing: border-box;`. Because `DockviewReact` is a flex/flow child of `.app-frame`, on real iOS Safari when `env(safe-area-inset-top)` (59px) and `env(safe-area-inset-bottom)` (34px) are non-zero, the Dockview grid and bottom status bar edge group are pushed inside the safe area (**inferred**).
    - **However**, when `env(safe-area-inset-*)` is 0 in headless emulation (or for elements positioned `position: absolute` relative to `.app-frame`'s padding box), in the `393×852` full-screen simulation without safe-area padding:
      - **Top 59px zone (`y = 0..59`)**: On first-run, the three collapsed left-edge tabs (`Exo-skeleton` at `y=0..16`, `Settings` at `y=16..32`, `JSON Edit` at `y=32..48`) and the `"THE GRID IS EMPTY"` heading (`y=33..48`) sit inside `y < 59`. In JSON Lab, the top row's tab bars (`tree`, `graph` at `y=0..35`), header action buttons (`y=8..28`), and `Controls` pane headers (`y=35..59`) sit inside `y < 59`. (On real iOS, `.app-frame`'s `padding-top: env(safe-area-inset-top)` shifts normal-flow Dockview children down by 59px — **inferred**.)
      - **Bottom 34px zone (`y = 818..852`) — real bug even with `env(safe-area-inset-bottom)`**: `.status-bar-summoner-btn` (`src/panels/StatusBarPanel.css:158-162`) uses `position: absolute; bottom: 12px; right: 12px;` inside `.app-frame`. In CSS, `position: absolute` positions against the **padding box** (outer edge) of `.app-frame`, **ignoring `.app-frame`'s `padding-bottom: env(safe-area-inset-bottom)`!** Thus, even on a real iPhone 15 in PWA standalone mode, the `38×38` `⌬` summoner button sits at `y = 802..840` (`12px` from the physical bottom of the screen), directly overlapping the 34px iOS Home Indicator bar (`y = 818..852`).
      - **`100vh` vs `dvh`**: `dvh`, `svh`, and `lvh` are **completely absent** from `src/`. `100vh` is used in `src/PanelMenuButton.css:20` (`max-height: calc(100vh - 80px)`) and `70vh` in `src/App.css:151` (`max-height: 70vh`). In mobile Safari browser mode (with collapsible URL bar), `100vh` equals the large viewport height (`lvh`), so a tall `.exo-menu` dropdown can extend behind Safari's bottom toolbar (**inferred**).
- **Measured numbers**:
  - In `393×852` viewport: `.status-bar-summoner-btn` is at `x=343, y=802, w=38, h=38, bottom=840` (`bottomGap: 12px`, protruding 22px into the `y=818..852` home-indicator zone).
- **Screenshots**: `18-pwa-393x852-first-run.png`, `19-pwa-393x852-json-lab.png`, `24-pwa-393x852-json-lab-with-statusbar.png`.
- **Likely cause**: `src/panels/StatusBarPanel.css:159-161` (`position: absolute; bottom: 12px; right: 12px;` instead of `bottom: calc(12px + env(safe-area-inset-bottom, 0px))` and `right: calc(12px + env(safe-area-inset-right, 0px))`), and `src/PanelMenuButton.css:20` (`100vh` instead of `100dvh`).

---

### 6. **Cosmetic** — First-run screen ("THE GRID IS EMPTY") cuts off panel picker buttons behind the status bar on initial load, though touch scrolling reaches all of them
- **What the person does**: Opens Exoskeleton on a fresh visit on iPhone 15 (`393×659`), iPhone SE (`320×568`), iPhone 15 Pro Max (`430×739`), or Pixel 7 (`412×839`), looks at the bottom of the screen, and then swipes up to scroll `.watermark`.
- **What they see / what happens**:
  - **Initial load on iPhone 15 (`393×659`)**: The `.watermark` container occupies `x=35, y=0, w=358, h=619` above the 40px status bar (`y=619..659`), with `scrollHeight: 1281` and `overflow-y: auto`.
  - Without scrolling (`scrollTop = 0`), the 5 preset buttons (`Minimal`, `JSON Lab`, `AV Lab`, `Procedural Lab`, `Everything`, each `w=300, h=55..70`) and the first 5 panel chips (`editor`, `webview`, `terminal` at `y=528..572`; `text-viewer`, `tempo-clock` at `y=580..624`, whose bottom 5px touch the status bar at `y=619` but whose centers at `y=602` still hit the buttons) are visible and tappable.
  - The next row of chips — `♬ piano` (`87,632 68×44`), `∿ scope` (`163,632 68×44`), and `{} json-edit` (`240,632 101×44`) — sits at `y=632..676`, directly behind the status bar (`y=619..659`, occluded in hit-testing by `div.status-bar-left` and `div.status-selection`), and the remaining 15 panel buttons (`json-tree` at `y=684` down to `json-attention` at `y=1204..1248`) are below the fold.
  - **No scrollbar or scroll fade indicator** is visible on first load, making the cut-off `text-viewer` / `tempo-clock` row look like a layout clipping bug at the status bar boundary.
  - **Scrolling**: Both wheel scrolling (`page.mouse.wheel`) and touch drag scrolling (CDP `Input.synthesizeScrollGesture` / touch swipe) scroll `.watermark` smoothly up to `scrollTop = 662` (`1281 - 619`). When scrolled to the bottom, **every single button**—including `piano`, `scope`, `json-edit`, and the very last button `◉ json-attention` (`x=150, y=542, w=128, h=44, bottom=586`, 33px above the status bar at `y=619`)—is **100% reachable and tappable** (`hitSelf: true`).
  - Note: if the status bar is minimized (`06-status-bar-minimized-summoner.png`), the floating `⌬` summoner (`x=343..381, y=609..647`) sits in the bottom-right corner, clear of the centered `json-attention` chip (`x=150..278`).
- **Measured numbers**:
  - `.watermark`: `358×619` (`clientHeight: 619`, `scrollHeight: 1281`, `maxScrollTop: 662`).
  - At `scrollTop: 0`: `text-viewer` & `tempo-clock` are at `y=580..624` (bottom 5px clipped by status bar at `y=619`); `piano`, `scope`, `json-edit` are at `y=632..676` (occluded by status bar).
  - At `scrollTop: 662` (scrolled to bottom): `procedural-visuals-recursive` is at `y=490..534` (`221×44`), `json-attention` is at `y=542..586` (`128×44`), leaving `33px` of bottom padding above the status bar (`y=619`).
- **Screenshots**: `01-iphone15-first-run.png`, `02-iphone15-wheel-scroll.png`, `03-iphone15-scrolled-bottom.png`, `04-iphone15-touch-drag-scroll.png`, `06-status-bar-minimized-summoner.png`.
- **Likely cause**: `src/Watermark.css:9-13,140` (`.watermark` has `overflow-y: auto` and scrolls inside its Dockview area above the bottom edge group, which works, but has no scroll indicator and aligns the second chip row right across the `y=619` cut line on iPhone 15).

---

### 7. **Cosmetic** — Multiple visible UI texts and glyphs are under 12px on the first-run screen and in JSON Lab
- **What the person does**: Reads preset descriptions and button labels on the first-run screen, or reads tab glyphs, control captions, and graph edge labels in JSON Lab.
- **What they see / what happens**:
  - **On the first-run screen (`01-iphone15-first-run.png`)**:
    1. **5 preset descriptions** (`.watermark-preset-desc`): **`11px`** (`274×30` or `274×15`, color `#6a8a98`).
    2. **"or summon one panel at a time:"** (`.watermark-hint`): **`11px`** (`300×17`, color `#4a6a78`).
    3. **All 23 panel-picker chip buttons** (`.panel-picker-btn.watermark-btn`, both the glyph and the panel ID text): **`11px`** (`h=44`, widths `68px` to `221px`).
    4. **Collapsed left document-edge tab labels** (`JSON Edit`, `Settings`, `Exo-skeleton` inside `.exo-phone .dv-groupview.exo-doc-edge.dv-edge-collapsed .dv-default-tab-content`): **`0px`** (`35×16` tabs with labels hidden by `font-size: 0` and no `::before` glyph because `ColoredTab.tsx:104` sets `glyph = '""'` for `isDocEdge`).
    5. **Status bar stats divider** (`.status-stats-divider` `|` text): **`0px`** (replaced by `::before` middle dot `·` at `12.8px`).
  - **After opening JSON Lab (`08-iphone15-json-lab.png` & `25-iphone15-json-lab-controls-open.png`)**:
    1. **Tab icon glyphs** (`.dv-default-tab .dv-default-tab-content::before` for `tree` `ϟ`, `graph` `✦`, `3d` `⌬`, `cyto` `⬢`): **`10px`** (`src/ColoredTab.css:9`).
    2. **Controls pane cell captions** (`.pp-cell-caption` when Controls is expanded, e.g. `LAYOUT`, `ORIENTATION`, `FIT ON LOAD`, `LABELS`, `FREEZE`, `ALGORITHM`): **`10px`** uppercase (`115×11` to `159×11`, `src/PanelPanes.css:23`).
    3. **Collapsed left document-edge tab label** (`JSON Edit - Berry Thief`): **`0px`** (`35×16`).
    4. **SVG edge role labels inside the `graph` panel canvas** (`svg text`, e.g., `contains`, `controls`, `has`, `lives_in`): **`11px`**.
- **Measured numbers**:
  - First-run screen: 5 preset descriptions at `11px`, 1 hint paragraph at `11px`, 23 panel buttons at `11px`, 3 collapsed edge tabs at `0px`.
  - JSON Lab: 4 tab `::before` glyphs at `10px`, 6 `.pp-cell-caption` labels at `10px`, SVG graph edge `<text>` elements at `11px`, 1 collapsed edge tab at `0px`.
- **Screenshots**: `01-iphone15-first-run.png`, `03-iphone15-scrolled-bottom.png`, `08-iphone15-json-lab.png`, `25-iphone15-json-lab-controls-open.png`.
- **Likely cause**: `src/Watermark.css:102,109,129` (`font-size: 11px`), `src/ColoredTab.css:9` (`font-size: 10px`), `src/PanelPanes.css:23,35` (`font-size: 10px`), and `src/DocumentEdge.css:28` (`font-size: 0`).

---

## Works fine

- **Pinch zoom is allowed**: `index.html:14` sets `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />` with no `user-scalable=no` and no `maximum-scale=1`, and no global `touch-action: none` on `html`/`body`/`.app-frame`. A person on iOS Safari can pinch-zoom normally.
- **No horizontal page-level overflow**: Across all 6 tested viewport sizes (`320×568`, `393×659`, `393×852`, `412×839`, `430×739`, `734×343`), `document.documentElement.scrollWidth === window.innerWidth` (`horizontalOverflow: false`).
- **First-run preset & panel-picker button heights on phone**: All 5 preset buttons (`300×70` / `300×55` on iPhone 15) and all 23 panel-picker chip buttons (`h=44px`, widths `68px–221px`) meet the 44px minimum touch height thanks to `@media (max-width: 600px) { .watermark-preset-btn, .watermark-btn { min-height: 44px; } }` (`src/Watermark.css:143`) and `@media (pointer: coarse) { .panel-picker-btn { min-height: 44px; } }` (`src/PanelPicker.css:19-21`).
- **First-run vertical scrolling**: `.watermark` scrolls smoothly via touch drag and wheel all the way to the bottom (`scrollTop: 662`), making all 23 panel buttons (`piano`, `scope`, `json-edit`, down to `json-attention`) reachable and tappable.
- **Status bar link toggle & restore flow**: Tapping `● linked` toggles cleanly to `● decoupled` and back, and tapping the `⌬` summoner button reliably restores the status bar when minimized.

# Phone audit, 2026-10-27 (v2.0.0-beta)

Exoskeleton v2.0.0-beta was driven at phone size in a headless browser to find the obvious problems before Harold went looking for them by hand. This is the consolidated list, most severe first. The three worker reports it was built from, with every measurement, are in [research/phone-audit-2026-10-27/](research/phone-audit-2026-10-27/).

## How it was tested

- Build: `just-dockview` at d7708e4, the same code that is live on exo-skeleton.org, served by the Vite dev server on port 1420.
- Browser: the installed Google Chrome, headless, driven by playwright-core 1.64.1 with Playwright's device profiles. Main device iPhone 15 (393 by 659 CSS pixels with Safari's bars). Also iPhone SE, iPhone 15 Pro Max, iPhone 15 landscape, Pixel 7, and 393 by 852 to stand in for the home-screen app.
- Taps were touch taps. Every state was screenshotted and measured: tap target sizes against Apple's 44 by 44 guideline, text sizes, clipping, overflow.
- Workers: three Gemini 4 Argon workers through `agy`, one each for the left document edge group, the presets and panel headers, and device sizes with the status bar. The lead re-ran the heaviest claims; one worker claim (that the collapsed strip needs two taps to open) was disproved and is left out here.
- Limits: this is Chrome pretending to be a phone, not iOS Safari. Findings that depend on Safari-only behavior (zoom on focus, safe areas, the on-screen keyboard) are marked inferred.

## Blocks use

1. **The collapsed document strip is blank.** On a phone the left edge group collapses to a dark column 35 pixels wide. Its tab names are hidden on purpose, and a symbol was supposed to show instead. On 2026-10-18 the document-edge tabs were changed to names only with no symbols (536e102), so nothing is left. The only tappable parts are three 35 by 16 slivers at the top; the rest of the column does nothing. One tap on a sliver does open the sheet with that tab. Cause: [DocumentEdge.css](../src/DocumentEdge.css) hides the names on phones and [ColoredTab.tsx](../src/ColoredTab.tsx) gives document-edge tabs an empty symbol. Screenshot: [first-visit.png](images/phone-audit-2026-10-27/first-visit.png).

2. **Choosing a preset removes the menu, Settings, and the status bar.** On a first visit, tapping any preset on the empty grid leaves the left edge group with only the JSON Edit tab. The Exo-skeleton menu tab (workspaces, add panel, One pane at a time, reset layout), the Settings tab, and the status bar are gone until the page is reloaded. This also happens on desktop, so it is a release bug, not only a phone one. Cause: the preset path in [Watermark.tsx](../src/Watermark.tsx), and Reset layout in [App.tsx](../src/App.tsx), clear the layout and rebuild it, and `finishPreset` in [default-layout.ts](../src/persistence/default-layout.ts) puts back only the document edge.

3. **Presets lay out desktop columns on a phone.** Minimal gives two columns 179 pixels wide, JSON Lab a 2 by 2 grid, AV Lab three columns 119 pixels wide, and Everything six groups, four of them 100 pixels wide. The phone branch for JSON Lab in `buildWebPreset` is a copy of the desktop branch, though its comment promises a stacked arrangement. Knock-on damage at those widths:
   - Tab names shrink to nothing or to "tre", "grap", "cyt", because the header buttons take the space first.
   - In AV Lab the piano's white keys overflow and the black keys sit over the wrong white keys. The tempo clock's BPM field is cut off.
   - Procedural controls cards have a 240-pixel minimum width, so their right third is cut off.
   - The tree viewer shrinks the whole Berry Thief tree to a thin vertical line, even at full width in One pane at a time.
   - Screenshots: [json-lab.png](images/phone-audit-2026-10-27/json-lab.png), [av-lab.png](images/phone-audit-2026-10-27/av-lab.png), [minimal.png](images/phone-audit-2026-10-27/minimal.png).

4. **A folded Controls section cannot be reopened by tapping.** Fold Controls in JSON Edit and its header shrinks to 24 pixels. The resize sash below it then sits over the header and takes the tap, so the second tap does nothing. Grid panels have the same overlap on the bottom edge of their Controls header. Cause: the cell sizing in [PanelPanes.tsx](../src/PanelPanes.tsx).

5. **Minimal, the first preset, includes the terminal, which cannot work in a browser.** It shows a red "the terminal needs the desktop app" error. See [minimal.png](images/phone-audit-2026-10-27/minimal.png).

## Gets in the way

6. **Header buttons are tiny, and one of them is dangerous.** The panel menu, fit, plus and close-group buttons measure about 20 by 18 to 26 by 20 pixels. Close-group sits one pixel from plus and closes every tab in the group without asking. In One pane at a time all panels share one group, so it closes everything.

7. **The status bar is cramped and its replacement floats over content.** Every status bar control is under 44 pixels. On iPhone SE, and on iPhone 15 once JSON Lab loads, the counts and the minimize button scroll off the right edge. After a preset the status bar is replaced by a floating round button that covers the bottom-right of the panel under it. In the home-screen app that button would also sit on the home indicator, because it ignores the safe area (inferred).

8. **The open document sheet keeps a 35-pixel vertical tab column.** Its names read bottom-to-top, and the 27 by 27 close button sits right where the thumb tapped to open the sheet. A quick double tap opens it and closes it again. See [document-open.png](images/phone-audit-2026-10-27/document-open.png).

9. **Settings and the Exo-skeleton menu show an empty Controls section.** It costs 59 pixels at the top of each.

10. **"Document" in the Exo-skeleton menu closes the sheet** instead of switching to JSON Edit, because the menu itself lives in the same edge group.

11. **The JSON Edit menu runs 59 pixels past the bottom of the screen,** hiding the save, copy, rename and delete items below the fold. Cause: a `100vh` height in [PanelMenuButton.css](../src/PanelMenuButton.css).

12. **Text fields are smaller than 16 pixels** (rename 11, editor 13, settings 12), so iOS Safari will zoom the page when one is focused (inferred). The document switcher's rows are 21 pixels tall.

13. **The panel menu offers things that do not belong on a phone.** Pop out is hidden from headers on phones but still in the menu. Move to lists the document edge as a target. Tapping over a webview does not close the menu, because the iframe swallows the tap.

14. **Landscape leaves phone mode.** A phone held sideways is wider than 600 pixels, so it gets the desktop layout: JSON Lab opens the document edge at 360 pixels, half the screen. Rotating with the sheet open leaves the edge at its portrait size.

15. **Everything is too much for one screen.** Its 10-tab overflow list is cut off at the bottom of the screen. In One pane at a time it puts 22 tabs into one header strip.

16. **The Pane tab inside JSON Edit's Controls** offers Maximize, Pop out and Move to for the document edge, which the panel menu already withholds from it.

## Cosmetic

- Preset descriptions, panel buttons on the empty grid, tab symbols and Controls captions use 10 to 11 pixel text.
- On the empty grid, a row of panel buttons sits half under the status bar on first load. The list does scroll to every button, but nothing hints that it scrolls.
- In a 179-pixel webview the reload button wraps to a second row and the address is cut off.

## Works fine

- No sideways page scroll at any tested size, and pinch zoom is allowed.
- Tapping a tab in the collapsed strip opens the sheet on that tab, and the back gesture closes the sheet first.
- JSON Edit's round document buttons, the Exo-skeleton menu rows, the preset buttons and the empty-grid panel buttons all meet 44 pixels.
- The empty-grid list scrolls by touch to every button.
- Tapping a visible tab switches panels. Tapping the active tab maximizes its group, and "all" restores the grid.

## Fixes that need a decision from Harold

These are not bugs with one obvious answer:

- What the collapsed strip should show on a phone: the vertical names as on desktop, a symbol, or something else. Also whether the whole column should be tappable.
- Whether presets on a phone should stack into one column, open in One pane at a time, or both.
- Whether landscape on a phone should stay in phone mode (the breakpoint is width 600).
- Whether Minimal on the web should drop the terminal, and what replaces it.
- How large header buttons should be on touch screens, and whether close-group should ask first.

The rest (items 2, 4, 9, 10, 11, 13, 16, and the floating button's safe area) are plain bugs with an obvious fix.

// Monaco theme — Midnight Alaska.
//
// Origin: ported from json-visual-viewer/src/components/Editor.tsx, lines
// 16–48, on 2026-05-19. Designed to harmonize with the viewer's JSON-Crack-
// inspired node colors (cyan keys, white string values, gold numbers, green
// keywords).
//
// To install in Monaco:
//
//   import { midnightAlaska, MIDNIGHT_ALASKA } from "./themes/midnight-alaska";
//   monaco.editor.defineTheme(MIDNIGHT_ALASKA, midnightAlaska);

import type { editor } from "monaco-editor";

export const MIDNIGHT_ALASKA = "midnight-alaska";

export const midnightAlaska: editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "string.key.json", foreground: "59b8ff" },
    { token: "string.value.json", foreground: "DCE5E7" },
    { token: "number", foreground: "e8c479" },
    { token: "keyword.json", foreground: "00DC7D" },
    { token: "keyword", foreground: "939598" },
    { token: "delimiter", foreground: "636363" },
  ],
  colors: {
    "editor.background": "#080c22",
    "editor.foreground": "#DCE5E7",
    "editor.lineHighlightBackground": "#0d122580",
    "editor.selectionBackground": "#1a237e60",
    "editorCursor.foreground": "#00e5ff",
    "editorLineNumber.foreground": "#1a237e",
    "editorLineNumber.activeForeground": "#00d4ee",
    "editor.selectionHighlightBackground": "#1a237e40",
    "editorIndentGuide.background": "#1a237e30",
    "editorIndentGuide.activeBackground": "#1a237e60",
    "editorBracketMatch.background": "#1a237e40",
    "editorBracketMatch.border": "#00e5ff50",
    "scrollbarSlider.background": "#00e5ff15",
    "scrollbarSlider.hoverBackground": "#00e5ff30",
    "editorWidget.background": "#080c22",
    "editorWidget.border": "#00e5ff30",
    "input.background": "#0a0e27",
    "input.border": "#00e5ff30",
    "input.foreground": "#18ffff",
  },
};

// CodeMirror 6 theme — Midnight Alaska.
//
// Origin: ported from json-visual-viewer/src/components/Editor.tsx, lines
// 16–48, on 2026-05-19. Designed to harmonize with the viewer's JSON-Crack-
// inspired node colors (cyan keys, white string values, gold numbers, green
// keywords).
//
// Ported to CodeMirror 6 EditorView.theme() and HighlightStyle on 2026-07-28.

import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export const MIDNIGHT_ALASKA = "midnight-alaska";

export const midnightAlaskaTheme = EditorView.theme(
  {
    "&": {
      color: "#DCE5E7",
      backgroundColor: "#080c22",
      height: "100%",
    },
    ".cm-content": {
      caretColor: "#00e5ff",
      fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
      padding: "12px 0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#00e5ff",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "#1a237e60",
    },
    ".cm-activeLine": {
      backgroundColor: "#0d122580",
    },
    ".cm-gutters": {
      backgroundColor: "#080c22",
      color: "#1a237e",
      borderRight: "1px solid #1a237e30",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#0d122580",
      color: "#00d4ee",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "#0d122580",
      border: "1px solid #1a237e60",
      color: "#59b8ff",
    },
  },
  { dark: true },
);

export const midnightAlaskaHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: "#59b8ff" },
  { tag: tags.string, color: "#DCE5E7" },
  { tag: tags.number, color: "#e8c479" },
  { tag: tags.bool, color: "#00DC7D" },
  { tag: tags.null, color: "#00DC7D" },
  { tag: tags.keyword, color: "#00DC7D" },
  { tag: tags.punctuation, color: "#636363" },
  { tag: tags.squareBracket, color: "#636363" },
  { tag: tags.brace, color: "#636363" },
  { tag: tags.separator, color: "#636363" },
]);

export const midnightAlaskaExtension = [
  midnightAlaskaTheme,
  syntaxHighlighting(midnightAlaskaHighlightStyle),
];

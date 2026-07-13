// Visibility-aware json-bus subscription hook, used by every viewer panel.
//
// The json-bus fan-out is synchronous: setJson runs every subscriber on the
// publisher's call stack. Dockview keeps inactive tab panels MOUNTED (their
// DOM detaches, but React effects stay live), so without this gate a single
// edit re-renders all seven viewers — 7× O(N) transforms on the main thread
// for one visible tab. This hook buffers updates while the panel is hidden
// (no setState → no re-render → no transform) and flushes the latest value
// when the panel becomes visible again.

import { useEffect, useState } from "react";
import type { DockviewPanelApi } from "dockview";
import { getJson, onJsonChange, type JsonValue } from "./json-bus";

export function useJsonDoc(
  api: DockviewPanelApi,
  documentId: string,
): JsonValue | undefined {
  const [doc, setDoc] = useState<JsonValue | undefined>(() =>
    getJson(documentId),
  );

  useEffect(() => {
    // Re-seed when the document id changes (viewers that follow the
    // active document swap ids at runtime).
    setDoc(getJson(documentId));

    // Buffered latest value while hidden. `undefined` doubles as "nothing
    // pending" — a bus value can't be undefined (JsonValue includes null,
    // not undefined).
    let pending: JsonValue | undefined;

    const unsubJson = onJsonChange(documentId, (value) => {
      if (api.isVisible) {
        setDoc(value);
      } else {
        pending = value;
      }
    });

    const visDisposable = api.onDidVisibilityChange((e) => {
      if (e.isVisible && pending !== undefined) {
        setDoc(pending);
        pending = undefined;
      }
    });

    return () => {
      unsubJson();
      visDisposable.dispose();
    };
  }, [api, documentId]);

  return doc;
}

// Opens a bundled graph-library fixture as a document on the json bus.
// Document id scheme: `library-<entry id>`, stable, so reopening reuses it.
import { graphLibrary, type GraphLibraryEntry } from "../fixtures/graphs/index.ts";
import { getJson, setJson, type JsonValue } from "./json-bus.ts";
import { setActiveDocumentId } from "../osc/channels/index.ts";

export function libraryDocumentId(entryId: string): string {
  return `library-${entryId}`;
}

export async function openLibraryDocument(
  entryId: string,
  opts?: { documentId?: string; entries?: GraphLibraryEntry[] },
): Promise<string> {
  const entry = (opts?.entries ?? graphLibrary).find((e) => e.id === entryId);
  if (!entry) throw new Error(`Unknown library entry: ${entryId}`);
  const id = opts?.documentId ?? libraryDocumentId(entry.id);
  if (getJson(id) === undefined) {
    const value = (await entry.load()) as JsonValue;
    // Re-check: a concurrent open may have created it while loading.
    if (getJson(id) === undefined) {
      setJson(id, value, { title: entry.title, source: "library" });
    }
  }
  setActiveDocumentId(id);
  return id;
}

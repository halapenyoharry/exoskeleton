// File and clipboard I/O for both runtimes Exoskeleton runs in.
//
//   - Tauri app: native save/open dialogs + the fs plugin.
//   - Plain browser tab (e.g. the dev server opened from another machine):
//     <a download>, <input type="file">, and a clipboard fallback.
//
// Every panel goes through these helpers so file and clipboard actions
// behave the same everywhere. They throw Errors with messages meant for the
// person at the screen; callers show them instead of logging to the console.
// A cancelled dialog or picker is not an error: save returns null and open
// returns [].
//
// Why the browser branch matters: on http://<lan-or-tailscale-ip>:1420 the
// page is not a secure context, so navigator.clipboard is undefined, and the
// Tauri plugins do not exist at all. Before this module, every one of those
// actions failed silently.

import { isTauri } from "@tauri-apps/api/core";

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface SaveResult {
  /** "dialog": written to disk via Tauri. "download": handed to the browser. */
  method: "dialog" | "download";
  /** Full path (dialog) or the file name offered to the browser (download). */
  path: string;
}

export interface OpenedFile {
  name: string;
  /** Present only in Tauri, where the file has a real path. */
  path?: string;
  text: string;
}

export function inTauri(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

/** A file-name-safe version of `base` with `ext` appended. */
export function fileNameFor(base: string, ext: string): string {
  const stem =
    base
      .trim()
      .replace(/[^\w\s.-]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "untitled";
  return stem.endsWith(`.${ext}`) ? stem : `${stem}.${ext}`;
}

function basename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

/**
 * Save text to a file. In Tauri, writes to `existingPath` if given, else asks
 * with a save dialog. In a browser, downloads it as `suggestedName`.
 * Returns null if the person cancelled the dialog.
 */
export async function saveTextFile(
  text: string,
  suggestedName: string,
  filters: FileFilter[],
  existingPath?: string | null,
): Promise<SaveResult | null> {
  if (inTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const target =
      existingPath ?? (await save({ defaultPath: suggestedName, filters }));
    if (!target) return null;
    try {
      await writeTextFile(target, text);
    } catch (err) {
      throw new Error(`Could not write ${target}: ${errorText(err)}`);
    }
    return { method: "dialog", path: target };
  }

  const blob = new Blob([text], { type: mimeFor(suggestedName) });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { method: "download", path: suggestedName };
}

/**
 * Ask for one or more text files and read them. Returns [] on cancel.
 */
export async function openTextFiles(
  filters: FileFilter[],
  multiple = false,
): Promise<OpenedFile[]> {
  if (inTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const picked = await open({ multiple, directory: false, filters });
    if (!picked) return [];
    const paths = Array.isArray(picked) ? picked : [picked];
    const files: OpenedFile[] = [];
    for (const path of paths) {
      try {
        files.push({ name: basename(path), path, text: await readTextFile(path) });
      } catch (err) {
        throw new Error(`Could not read ${path}: ${errorText(err)}`);
      }
    }
    return files;
  }

  return new Promise<OpenedFile[]>((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    const exts = filters.flatMap((f) => f.extensions).filter((e) => e !== "*");
    if (exts.length > 0) input.accept = exts.map((e) => `.${e}`).join(",");
    input.style.display = "none";
    const cleanup = () => input.remove();
    input.addEventListener("cancel", () => {
      cleanup();
      resolve([]);
    });
    input.addEventListener("change", async () => {
      const list = Array.from(input.files ?? []);
      cleanup();
      try {
        resolve(
          await Promise.all(
            list.map(async (f) => ({ name: f.name, text: await f.text() })),
          ),
        );
      } catch (err) {
        reject(new Error(`Could not read the file: ${errorText(err)}`));
      }
    });
    document.body.appendChild(input);
    input.click();
  });
}

/** Read a file by path. Tauri only; a browser has no access to paths. */
export async function readTextFileAt(path: string): Promise<string> {
  if (!inTauri()) {
    throw new Error("Reopening a file by path only works in the desktop app.");
  }
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  return readTextFile(path);
}

/**
 * Copy text to the clipboard. Uses the async clipboard API where the page
 * allows it, and the selection-based fallback where it doesn't (plain http
 * pages served from another machine). Call it directly from a click handler:
 * the fallback needs the click's user activation.
 */
export async function copyText(text: string): Promise<void> {
  if (text === "") throw new Error("Nothing to copy: it's empty.");
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the selection-based copy.
    }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "-9999px";
  ta.style.opacity = "0";
  // The copy acts on the focused element's selection, so the textarea must
  // take focus (an editor like CodeMirror otherwise keeps it); focus goes
  // back afterwards.
  const previous = document.activeElement as HTMLElement | null;
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  previous?.focus?.();
  if (!ok) {
    throw new Error(
      "The browser blocked the clipboard. Open the JSON view and copy by hand (⌘A, ⌘C).",
    );
  }
}

/** Read text from the clipboard, where the page is allowed to. */
export async function readClipboardText(): Promise<string> {
  if (navigator.clipboard?.readText && window.isSecureContext) {
    return navigator.clipboard.readText();
  }
  throw new Error(
    "This page can't read the clipboard (http:// from another machine). Click in the text box and press ⌘V instead.",
  );
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function mimeFor(name: string): string {
  if (name.endsWith(".json")) return "application/json";
  if (name.endsWith(".md")) return "text/markdown";
  return "text/plain";
}

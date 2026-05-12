import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { OscArg, OscEvent } from "./types";

/**
 * Sends an OSC message via UDP.
 *
 * @param address - The OSC address (e.g. "/test/address").
 * @param args - Array of OSC arguments to send.
 */
export async function sendOsc(address: string, args: OscArg[]): Promise<void> {
  return invoke("send_osc", { address, args });
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegExp(string: string) {
  return string.replace(/[.+^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

/**
 * Converts an OSC address pattern (which may contain `*` and `?`)
 * into a Regular Expression for matching.
 */
function oscPatternToRegExp(pattern: string): RegExp {
  const segments = pattern.split("/");
  const regexSegments = segments.map((segment) => {
    if (!segment.includes("*") && !segment.includes("?")) {
      return escapeRegExp(segment);
    }
    // Convert ? to match any single character (except /)
    // Convert * to match any sequence of characters (except /)
    let regexStr = "";
    for (let i = 0; i < segment.length; i++) {
      const char = segment[i];
      if (char === "?") {
        regexStr += "[^/]";
      } else if (char === "*") {
        regexStr += "[^/]*";
      } else {
        regexStr += escapeRegExp(char);
      }
    }
    return regexStr;
  });

  return new RegExp(`^${regexSegments.join("/")}$`);
}

/**
 * Subscribes to incoming OSC messages that match the specified address pattern.
 *
 * @param pattern - The OSC address pattern to match (supports `*` and `?`).
 * @param handler - Callback function invoked with the matching address and arguments.
 * @returns A promise that resolves to an unlisten function to remove the listener.
 */
export async function onOsc(
  pattern: string,
  handler: (address: string, args: OscArg[]) => void
): Promise<UnlistenFn> {
  const regex = oscPatternToRegExp(pattern);

  return listen<OscEvent>("osc://message", (event) => {
    const { address, args } = event.payload;
    if (regex.test(address)) {
      handler(address, args);
    }
  });
}

export * from "./types";

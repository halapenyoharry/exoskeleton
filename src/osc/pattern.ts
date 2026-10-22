// OSC address-pattern matching, split out from src/osc/index.ts so it can be
// imported (and unit-tested) without pulling in the @tauri-apps modules that
// index.ts loads at module scope. Both the bus and the retainer match
// addresses; they must agree exactly, so there is one implementation.

function escapeRegExp(s: string) {
  return s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

/**
 * Compile an OSC address pattern to a RegExp.
 *
 * Pattern syntax (OSC convention):
 *   *  matches any sequence of characters within a single path segment
 *   ?  matches any single character within a single path segment
 *
 * Neither wildcard crosses a "/" — that is what makes "/json/*\/select" mean
 * "select in any document" rather than "anything under /json".
 */
export function oscPatternToRegExp(pattern: string): RegExp {
  const segments = pattern.split("/");
  const regexSegments = segments.map((segment) => {
    if (!segment.includes("*") && !segment.includes("?")) {
      return escapeRegExp(segment);
    }
    let regexStr = "";
    for (let i = 0; i < segment.length; i++) {
      const ch = segment[i];
      if (ch === "?") regexStr += "[^/]";
      else if (ch === "*") regexStr += "[^/]*";
      else regexStr += escapeRegExp(ch);
    }
    return regexStr;
  });
  return new RegExp(`^${regexSegments.join("/")}$`);
}

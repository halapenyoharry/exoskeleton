// Pure utility — no dependencies. Converts arbitrary JSON into a d3.hierarchy
// compatible nested tree. Used by json-tree, json-circles, json-mass panels.
//
// Origin: ported from json-visual-viewer/src/utils/jsonToHierarchy.ts on
// 2026-05-19. If you change behaviour here, check the originating viewer to
// keep parity (or note the divergence in this file).

export interface HierarchyNode {
  name: string;
  children?: HierarchyNode[];
  _value?: unknown;
}

export function countHierarchyNodes(node: HierarchyNode): number {
  if (!node.children) return 1;
  let count = 1;
  for (const child of node.children) {
    count += countHierarchyNodes(child);
  }
  return count;
}

/**
 * Converts any arbitrary JSON structure into a purely nested d3.hierarchy
 * compatible layout.
 *
 * @param json The parsed JSON object/array/primitive
 * @param isExplodedView Whether to decouple keys from primitive values
 *                       (compact: `key: 42`; exploded: `key` → `42`).
 * @param nodeName Current node label
 * @param showArrayIndices Whether to prefix array items with `[N]` labels
 */
export function jsonToHierarchy(
  json: unknown,
  isExplodedView: boolean,
  nodeName: string = "root",
  showArrayIndices: boolean = true,
): HierarchyNode {
  if (json === null) {
    return { name: isExplodedView ? nodeName : `${nodeName}: null` };
  }

  if (Array.isArray(json)) {
    if (json.length === 0) {
      return { name: `${nodeName} []` };
    }
    const children = json.map((item, index) => {
      const childName = showArrayIndices
        ? `[${index}]`
        : item !== null && typeof item === "object"
          ? `[${index}]`
          : "";
      return jsonToHierarchy(item, isExplodedView, childName, showArrayIndices);
    });
    return { name: nodeName, children };
  }

  if (typeof json === "object") {
    const keys = Object.keys(json as Record<string, unknown>);
    if (keys.length === 0) {
      return { name: `${nodeName} {}` };
    }
    const children = keys.map((key) =>
      jsonToHierarchy(
        (json as Record<string, unknown>)[key],
        isExplodedView,
        key,
        showArrayIndices,
      ),
    );
    return { name: nodeName, children };
  }

  const strVal = String(json);
  if (isExplodedView) {
    return {
      name: nodeName,
      children: [{ name: strVal, _value: json }],
    };
  }

  if (nodeName === "") {
    return { name: strVal, _value: json };
  }
  return { name: `${nodeName}: ${strVal}`, _value: json };
}

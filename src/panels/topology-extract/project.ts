// Projection from the extractor's relation-list output to a TopoDocument.
//
// The model writes every relation in one shape: a predicate plus a
// `participants` list of {node, role}. That is the incidence form of the
// canonical hypergraph. This module projects it into the dyadic
// TopoDocument the viewers consume, deterministically:
//
//   - 2 participants  -> one dyadic link (source_role / target_role)
//   - 3+ participants -> one kind:"hyperedge" node + one spoke per participant
//
// Doing this in code rather than asking the model to choose between two
// encodings is deliberate: a model asked to choose picks dyadic and drops
// the third participant (the addressee or topic of a speech act). Code also
// enforces what models are unreliable at: layer = predicate, category id
// prefixes, container-as-source, endpoint validity, and verbatim evidence.

import type {
  EdgeCategory,
  TopoAttrs,
  TopoDocument,
  TopoLink,
  TopoNode,
} from "../json-dyadic/types";

export interface ExtractedParticipant {
  node: string;
  role?: string;
}

export interface ExtractedRelation {
  predicate: string;
  category: EdgeCategory;
  secondary_category?: EdgeCategory;
  mode?: string;
  asserted_by?: string;
  directed?: boolean;
  locus?: string;
  label?: string;
  evidence?: string;
  participants: ExtractedParticipant[];
}

export interface RelationDocument {
  metadata?: Record<string, unknown>;
  nodes: TopoNode[];
  relations: ExtractedRelation[];
}

const CATEGORIES: EdgeCategory[] = [
  "containment",
  "state_change",
  "interactivity",
  "reference",
];

// Undeclared participant references longer than this are quotations or
// descriptions rather than entity names, and are dropped, not auto-created.
const MAX_AUTO_NODE_CHARS = 48;
const MAX_AUTO_NODE_WORDS = 6;

// Same convention json-dyadic/parse.ts recognises.
const HYPEREDGE_PREFIX: Record<EdgeCategory, string> = {
  containment: "c:",
  state_change: "sc:",
  interactivity: "i:",
  reference: "r:",
};

export function isRelationDocument(doc: unknown): doc is RelationDocument {
  const d = doc as Record<string, unknown> | null;
  return (
    !!d &&
    typeof d === "object" &&
    Array.isArray(d.nodes) &&
    Array.isArray(d.relations)
  );
}

/**
 * Comparison form for evidence checks: markdown emphasis markers dropped,
 * curly quotes straightened, whitespace collapsed. Words and punctuation
 * otherwise have to match exactly.
 */
export function normalizeForMatch(s: string): string {
  return s
    .replace(/[_*]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Project a relation-list document into a TopoDocument. When `sourceText`
 * is given, every relation's evidence is checked against it and marked
 * with `i2t:evidence_verified`.
 */
export function projectRelations(
  doc: RelationDocument,
  sourceText?: string,
): TopoDocument {
  const warnings: string[] = [];
  const nodes: TopoNode[] = [];
  const nodeIds = new Set<string>();

  for (const n of doc.nodes) {
    if (!n || typeof n.id !== "string") {
      warnings.push("skipped node without id");
      continue;
    }
    if (nodeIds.has(n.id)) {
      warnings.push(`skipped duplicate node "${n.id}"`);
      continue;
    }
    nodeIds.add(n.id);
    nodes.push({ ...n, kind: "node" });
  }

  // Models sometimes cite a participant by its label or an alias instead of
  // its id ("Rook" for "rook"). Resolve those first.
  const byName = new Map<string, string>();
  for (const n of nodes) {
    const aliases = n.attrs?.aliases;
    const names = [n.id, n.label, ...(Array.isArray(aliases) ? aliases : [])];
    for (const name of names) {
      if (typeof name === "string" && !byName.has(slug(name))) {
        byName.set(slug(name), n.id);
      }
    }
  }

  // Models also use entities they never declared ("contract", "her car").
  // Dropping those loses real structure, so short references become
  // flagged nodes, evidenced by the relation that introduced them. Long
  // strings are quotations or descriptions, not entities, and are dropped.
  const autoCreated: string[] = [];
  const autoCreate = (ref: string, evidence?: string): string | undefined => {
    const id = slug(ref);
    if (!id || ref.length > MAX_AUTO_NODE_CHARS) return undefined;
    if (ref.trim().split(/\s+/).length > MAX_AUTO_NODE_WORDS) return undefined;
    const label = /^[a-z0-9-]+$/.test(ref) ? ref.replace(/-/g, " ") : ref;
    nodeIds.add(id);
    byName.set(id, id);
    nodes.push({
      id,
      kind: "node",
      label,
      attrs: {
        "i2t:kind": "other",
        "i2t:auto_created": true,
        ...(evidence ? { "i2t:evidence": evidence } : {}),
      },
    });
    autoCreated.push(id);
    return id;
  };

  const resolve = (
    ref: string | undefined,
    evidence?: string,
  ): string | undefined => {
    if (typeof ref !== "string") return undefined;
    if (nodeIds.has(ref)) return ref;
    return byName.get(slug(ref)) ?? autoCreate(ref, evidence);
  };

  const haystack =
    sourceText !== undefined ? normalizeForMatch(sourceText) : undefined;
  const usedIds = new Set(nodeIds);
  const links: TopoLink[] = [];
  let unverified = 0;

  doc.relations.forEach((r, i) => {
    if (!r || typeof r.predicate !== "string" || r.predicate === "") {
      warnings.push(`relation ${i}: missing predicate, skipped`);
      return;
    }
    const where = `relation ${i} (${r.predicate})`;

    let category: EdgeCategory = r.category;
    if (!CATEGORIES.includes(category)) {
      warnings.push(`${where}: unknown category "${r.category}", defaulted to reference`);
      category = "reference";
    }

    let participants: ExtractedParticipant[] = [];
    for (const p of r.participants ?? []) {
      const id = resolve(p?.node, r.evidence);
      if (id) {
        participants.push(id === p.node ? p : { ...p, node: id });
      } else {
        warnings.push(`${where}: dropped participant "${p?.node}" (no such node)`);
      }
    }
    if (participants.length < 2) {
      warnings.push(`${where}: fewer than two participants, skipped`);
      return;
    }

    // Containment always reads container -> contained.
    if (category === "containment") {
      const c = participants.findIndex((p) => p.role === "container");
      if (c > 0) {
        participants = [
          participants[c],
          ...participants.slice(0, c),
          ...participants.slice(c + 1),
        ];
      }
    }

    const attrs: TopoAttrs = {
      "i2t:predicate": r.predicate,
      "i2t:edge_category": category,
      "i2t:mode": r.mode ?? "asserted",
    };
    if (r.secondary_category && CATEGORIES.includes(r.secondary_category)) {
      attrs["i2t:edge_category_secondary"] = r.secondary_category;
    }
    if (r.asserted_by) attrs["i2t:asserted_by"] = r.asserted_by;
    if (r.locus) attrs["i2t:locus"] = r.locus;
    if (r.evidence) {
      attrs["i2t:evidence"] = r.evidence;
      if (haystack !== undefined) {
        const verified = haystack.includes(normalizeForMatch(r.evidence));
        attrs["i2t:evidence_verified"] = verified;
        if (!verified) unverified++;
      }
    } else {
      warnings.push(`${where}: no evidence`);
    }

    const directed = r.directed !== false;

    if (participants.length === 2) {
      const [s, t] = participants;
      links.push({
        source: s.node,
        target: t.node,
        directed,
        layer: r.predicate,
        ...(s.role ? { source_role: s.role } : {}),
        ...(t.role ? { target_role: t.role } : {}),
        attrs,
      });
      return;
    }

    const base =
      HYPEREDGE_PREFIX[category] + slug(`${r.predicate}-${participants[0].node}`);
    let id = base;
    for (let k = 2; usedIds.has(id); k++) id = `${base}-${k}`;
    usedIds.add(id);

    nodes.push({ id, kind: "hyperedge", label: r.label ?? r.predicate, attrs });
    for (const p of participants) {
      links.push({
        source: id,
        target: p.node,
        directed,
        layer: r.predicate,
        ...(p.role ? { role: p.role } : {}),
      });
    }
  });

  const metadata: Record<string, unknown> = {
    ...(doc.metadata ?? {}),
    format: "normalized-dyadic",
    "i2t:relation_to_canonical": "dyadic-projection",
  };
  if (haystack !== undefined) metadata["i2t:evidence_unverified"] = unverified;
  if (autoCreated.length > 0) metadata["i2t:auto_created_nodes"] = autoCreated;
  if (warnings.length > 0) metadata["i2t:extraction_warnings"] = warnings;

  return { metadata, nodes, links };
}

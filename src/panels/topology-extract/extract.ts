// Iterative extraction: split the source at its own divisions, extract each
// part, then re-ask focused questions about the same part until a sweep
// finds nothing new (or the pass budget runs out). Results accumulate in one
// relation-list document, deduplicated as they arrive, so a failure or a
// cancel part-way still leaves everything extracted so far.
//
// Why focused follow-ups rather than one long prompt: the system prompt
// lists every rule, but a model writes its JSON in a single forward pass and
// cannot go back to check it. Small local models especially skip rules that
// need a second look (foretold events, addressees, identity). A short pass
// that asks one question of the passage, with what was already found in
// view, gives every rule its own turn.
//
// Why "until nothing new" is bounded: a small model always finds something
// to add, so "nothing new" is decided after deduplication, and the pass
// budget caps the loop either way.

import type { ExtractedRelation, RelationDocument } from "./project.ts";
import { normalizeForMatch } from "./project.ts";
import type { TopoNode } from "../json-dyadic/types";
import type { ChatFn, ChatUsage } from "./transport.ts";
import { ExtractionError, parseModelJson } from "./transport.ts";

// ── Source division and chunking ─────────────────────────────────────

export interface Division {
  id: string;
  label: string;
  /** Character range in the source. */
  start: number;
  end: number;
  /** The marker or heading line that opened it ("" for the first part). */
  marker: string;
}

export interface Chunk {
  index: number;
  text: string;
  start: number;
  end: number;
  divisionIds: string[];
}

const BREAK_LINE = /^[ \t]*(#{2,}|\*[ \t]*\*[ \t]*\*[ *\t]*|-{3,}|~{3,}|_{3,})[ \t]*$/;
const HEADING_LINE = /^[ \t]*#{1,6}[ \t]+(\S.*?)[ \t]*#*[ \t]*$/;

/**
 * The source's own divisions: scene-break lines ("##", "***", "---") and
 * markdown headings. Returns [] when the source marks none.
 */
export function findDivisions(source: string): Division[] {
  const marks: { at: number; lineEnd: number; marker: string; heading?: string }[] = [];
  let pos = 0;
  for (const line of source.split("\n")) {
    const lineEnd = pos + line.length;
    const heading = line.match(HEADING_LINE);
    if (heading) marks.push({ at: pos, lineEnd, marker: line.trim(), heading: heading[1] });
    else if (BREAK_LINE.test(line)) marks.push({ at: pos, lineEnd, marker: line.trim() });
    pos = lineEnd + 1;
  }
  if (marks.length === 0) return [];

  const divisions: Division[] = [];
  const usedIds = new Set<string>();
  let scene = 0;
  const add = (start: number, end: number, marker: string, heading?: string) => {
    if (source.slice(start, end).trim() === "") return;
    let id: string;
    let label: string;
    if (heading) {
      const base = heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "section";
      id = base;
      for (let k = 2; usedIds.has(id); k++) id = `${base}-${k}`;
      label = heading;
    } else {
      scene++;
      id = `scene-${scene}`;
      label = `Scene ${scene}`;
    }
    usedIds.add(id);
    divisions.push({ id, label, start, end, marker });
  };

  add(0, marks[0].at, "");
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].at : source.length;
    // A heading belongs to its section's text; a bare break line does not.
    add(m.heading ? m.at : m.lineEnd + 1, end, m.marker, m.heading);
  });
  return divisions;
}

/** Split [start, end) into pieces of at most maxChars, at paragraph, then sentence, boundaries. */
function splitRange(source: string, start: number, end: number, maxChars: number): [number, number][] {
  const pieces: [number, number][] = [];
  let s = start;
  while (end - s > maxChars) {
    const window = source.slice(s, s + maxChars);
    let cut = window.lastIndexOf("\n\n");
    if (cut < maxChars * 0.4) {
      const sentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "), window.lastIndexOf(".\n"));
      cut = sentence > maxChars * 0.4 ? sentence + 1 : maxChars;
    }
    pieces.push([s, s + cut]);
    s += cut;
  }
  if (source.slice(s, end).trim() !== "") pieces.push([s, end]);
  return pieces;
}

/**
 * Pack the source into chunks of at most maxChars, keeping divisions whole
 * where they fit and splitting oversized ones at paragraph boundaries.
 * maxChars <= 0 means one chunk.
 */
export function chunkSource(source: string, divisions: Division[], maxChars: number): Chunk[] {
  if (maxChars <= 0 || source.length <= maxChars) {
    return [{ index: 0, text: source, start: 0, end: source.length, divisionIds: divisions.map((d) => d.id) }];
  }
  const units: { start: number; end: number; divisionId?: string }[] = [];
  if (divisions.length === 0) {
    for (const [s, e] of splitRange(source, 0, source.length, maxChars)) units.push({ start: s, end: e });
  } else {
    for (const d of divisions) {
      for (const [s, e] of splitRange(source, d.start, d.end, maxChars)) units.push({ start: s, end: e, divisionId: d.id });
    }
  }
  const chunks: Chunk[] = [];
  let current: { start: number; end: number; ids: string[] } | null = null;
  for (const u of units) {
    if (current && u.end - current.start <= maxChars) {
      current.end = u.end;
      if (u.divisionId && !current.ids.includes(u.divisionId)) current.ids.push(u.divisionId);
      continue;
    }
    if (current) chunks.push({ index: chunks.length, text: source.slice(current.start, current.end), start: current.start, end: current.end, divisionIds: current.ids });
    current = { start: u.start, end: u.end, ids: u.divisionId ? [u.divisionId] : [] };
  }
  if (current) chunks.push({ index: chunks.length, text: source.slice(current.start, current.end), start: current.start, end: current.end, divisionIds: current.ids });
  return chunks;
}

/** Structure nodes and the containment relation, built from the divisions. */
export function structureFor(divisions: Division[]): RelationDocument {
  if (divisions.length === 0) return { nodes: [], relations: [] };
  const nodes: TopoNode[] = [
    { id: "source-text", kind: "node", label: "Source text", attrs: { "i2t:kind": "structure", description: "The whole source." } },
    ...divisions.map((d) => ({
      id: d.id,
      kind: "node" as const,
      label: d.label,
      attrs: { "i2t:kind": "structure", ...(d.marker ? { "i2t:evidence": d.marker } : {}) },
    })),
  ];
  const marker = divisions.find((d) => d.marker)?.marker;
  return {
    nodes,
    relations: [
      {
        predicate: "contains",
        category: "containment",
        mode: "asserted",
        directed: true,
        label: `The source contains ${divisions.length} parts`,
        ...(marker ? { evidence: marker } : {}),
        participants: [
          { node: "source-text", role: "container" },
          ...divisions.map((d) => ({ node: d.id, role: "contained" })),
        ],
      },
    ],
  };
}

// ── Merging ──────────────────────────────────────────────────────────

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function predicateStem(p: string): string {
  return p
    .toLowerCase()
    .split(/[_\s-]+/)
    .map((w) => w.replace(/(ing|ed|es|s)$/, ""))
    .join("_");
}

function evidenceOverlaps(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const x = normalizeForMatch(a).toLowerCase();
  const y = normalizeForMatch(b).toLowerCase();
  if (x.includes(y) || y.includes(x)) return true;
  const wx = new Set(x.split(" "));
  const wy = new Set(y.split(" "));
  let shared = 0;
  for (const w of wx) if (wy.has(w)) shared++;
  return shared / Math.min(wx.size, wy.size) >= 0.7;
}

/**
 * Accumulates nodes and relations across passes and parts. A node is the
 * same node if its id, label, or an alias matches; a relation is a
 * duplicate if it joins the same participants in the same category and
 * mode and either cites overlapping evidence or uses the same verb.
 */
export class Accumulator {
  readonly nodes: TopoNode[] = [];
  readonly relations: ExtractedRelation[] = [];
  /** Part index each relation came from. */
  readonly relationChunk: number[] = [];
  /** The first title a pass proposes. */
  title = "";
  private byName = new Map<string, string>();
  private readonly locked: Set<string>;

  constructor(structure: RelationDocument) {
    this.locked = new Set(structure.nodes.map((n) => n.id));
    this.add(structure, -1);
  }

  private index(node: TopoNode) {
    const aliases = node.attrs?.aliases;
    for (const name of [node.id, node.label, ...(Array.isArray(aliases) ? aliases : [])]) {
      if (typeof name === "string" && slug(name) && !this.byName.has(slug(name))) {
        this.byName.set(slug(name), node.id);
      }
    }
  }

  private resolve(ref: string): string {
    return this.byName.get(slug(ref)) ?? ref;
  }

  /** Merge a pass's output. Returns how many genuinely new items it added. */
  add(doc: Partial<RelationDocument>, chunkIndex: number): { nodes: number; relations: number } {
    let newNodes = 0;
    let newRelations = 0;
    const idMap = new Map<string, string>();
    const proposed = doc.metadata?.title;
    if (!this.title && typeof proposed === "string") this.title = proposed;

    for (const raw of doc.nodes ?? []) {
      if (!raw || typeof raw.id !== "string") continue;
      const node: TopoNode = { ...raw, kind: "node" };
      if (this.locked.has(node.id) && chunkIndex >= 0) continue; // structure is built in code
      const existingId =
        this.byName.get(slug(node.id)) ??
        (node.label ? this.byName.get(slug(node.label)) : undefined) ??
        (Array.isArray(node.attrs?.aliases)
          ? (node.attrs!.aliases as unknown[]).map((a) => (typeof a === "string" ? this.byName.get(slug(a)) : undefined)).find(Boolean)
          : undefined);
      if (existingId) {
        idMap.set(node.id, existingId);
        const existing = this.nodes.find((n) => n.id === existingId);
        if (existing && !this.locked.has(existingId)) {
          const merged = new Set<string>([
            ...((existing.attrs?.aliases as string[] | undefined) ?? []),
            ...((node.attrs?.aliases as string[] | undefined) ?? []),
          ]);
          if (node.label && node.label !== existing.label) merged.add(node.label);
          merged.delete(existing.label ?? "");
          if (merged.size > 0) {
            existing.attrs = { ...(existing.attrs ?? {}), aliases: [...merged] };
            this.index(existing);
          }
        }
        continue;
      }
      this.nodes.push(node);
      this.index(node);
      newNodes++;
    }

    for (const raw of doc.relations ?? []) {
      if (!raw || typeof raw.predicate !== "string" || !Array.isArray(raw.participants)) continue;
      const rel: ExtractedRelation = {
        ...raw,
        participants: raw.participants
          .filter((p) => p && typeof p.node === "string")
          .map((p) => ({ ...p, node: idMap.get(p.node) ?? this.resolve(p.node) })),
      };
      if (rel.participants.length < 2) continue;
      const key = participantKey(rel);
      const duplicate = this.relations.some(
        (r) =>
          participantKey(r) === key &&
          (evidenceOverlaps(r.evidence, rel.evidence) || predicateStem(r.predicate) === predicateStem(rel.predicate)),
      );
      if (duplicate) continue;
      this.relations.push(rel);
      this.relationChunk.push(chunkIndex);
      newRelations++;
    }
    return { nodes: newNodes, relations: newRelations };
  }

  document(metadata?: Record<string, unknown>): RelationDocument {
    return { metadata, nodes: [...this.nodes], relations: [...this.relations] };
  }
}

function participantKey(r: ExtractedRelation): string {
  return [r.category, r.mode ?? "asserted", ...r.participants.map((p) => p.node).sort()].join("|");
}

/** Set each relation's locus from where its evidence actually sits in the source. */
export function assignLoci(doc: RelationDocument, source: string, divisions: Division[]): void {
  if (divisions.length === 0) return;
  const valid = new Set(divisions.map((d) => d.id));
  for (const r of doc.relations) {
    if (r.participants.some((p) => p.node === "source-text")) continue;
    const at = r.evidence ? source.indexOf(r.evidence) : -1;
    if (at >= 0) {
      const d = divisions.find((x) => at >= x.start && at < x.end);
      if (d) {
        r.locus = d.id;
        continue;
      }
    }
    if (r.locus && !valid.has(r.locus)) delete r.locus;
  }
}

// ── Passes ───────────────────────────────────────────────────────────

export interface PassKind {
  id: string;
  label: string;
  question: string;
}

/** Follow-up questions, asked in this order after a part's first pass. */
export const FOCUSED_PASSES: PassKind[] = [
  {
    id: "modes",
    label: "modes",
    question:
      "Which events in this passage are not simply reported as happening? Events the narration foretells, things a character plans, intends, hopes for, or expects, things someone commands or requests, things that are only possible or hypothetical, claims a character makes that the narration does not confirm, alternative versions the text offers, and things the text says did not happen. A sentence saying someone did not plan, expect, or mean to do something that the story goes on to imply foretells the event itself. Add each one that is missing or recorded with the wrong mode, with the right \"mode\".",
  },
  {
    id: "changes",
    label: "changes and causes",
    question:
      "What moves, changes hands, is made, eaten, destroyed, decided, learned, or realized in this passage, and what causes, enables, funds, or results in what? Look for causal connectives (because, so, thanks to, which saved, will pay for, that's when). Add each state_change relation that is missing.",
  },
  {
    id: "speech",
    label: "speech",
    question:
      "List every speech act, message, question, answer, warning, and instruction in this passage. Each needs ONE relation with the speaker, the addressee, the topic as an entity node (never the words spoken), and the channel if one is named. Add the ones that are missing, and complete any listed one that lacks its addressee or topic.",
  },
  {
    id: "identity",
    label: "identity",
    question:
      "Check identity. Which names, nicknames, usernames, and handles refer to the same individual (record them as aliases by re-declaring the node with an \"aliases\" list)? Which unnamed or generic mentions might be a named node (add claimed_identical_to with mode \"unresolved\")? Which group mentions should be individual nodes? Inside games, dreams, or stories within the story, which avatars and inhabitants act on which? Add what is missing.",
  },
];

export const MISSED_PASS: PassKind = {
  id: "missed",
  label: "anything missed",
  question:
    "Re-read the passage. What entities and relations does it support that are not in the list above? Return only those.",
};

/** The pass sequence for `followUps` follow-up passes. */
export function followUpSequence(followUps: number): PassKind[] {
  const seq: PassKind[] = [];
  for (let i = 0; i < followUps; i++) {
    seq.push(i < FOCUSED_PASSES.length ? FOCUSED_PASSES[i] : MISSED_PASS);
  }
  return seq;
}

function nodeLines(nodes: TopoNode[]): string {
  return nodes
    .map((n) => {
      const aliases = Array.isArray(n.attrs?.aliases) && (n.attrs!.aliases as string[]).length > 0
        ? ` | aka ${(n.attrs!.aliases as string[]).join(", ")}`
        : "";
      return `${n.id} | ${n.label ?? n.id} | ${n.attrs?.["i2t:kind"] ?? "?"}${aliases}`;
    })
    .join("\n");
}

function relationLines(relations: ExtractedRelation[]): string {
  return relations
    .map((r) => `${r.predicate} [${r.category}, ${r.mode ?? "asserted"}] ${r.participants.map((p) => `${p.node}(${p.role ?? "?"})`).join(" ")}`)
    .join("\n");
}

function passageHeader(chunk: Chunk, chunkCount: number, divisions: Division[]): string {
  const where = chunkCount > 1 ? ` (part ${chunk.index + 1} of ${chunkCount})` : "";
  const structure =
    divisions.length > 0
      ? `\nSTRUCTURE: the structure nodes already exist (source-text, ${divisions.map((d) => d.id).join(", ")}). Do not declare structure nodes. This passage covers ${chunk.divisionIds.join(", ") || "part of the source"}; set "locus" to the one each relation's evidence comes from.\n`
      : "\nSTRUCTURE: the source has no marked divisions. Do not declare structure nodes and omit \"locus\".\n";
  return `SOURCE PASSAGE${where}:\n<<<\n${chunk.text}\n>>>\n${structure}`;
}

export function firstPassMessage(chunk: Chunk, chunkCount: number, divisions: Division[], known: TopoNode[]): string {
  const knownBlock = known.length > 0
    ? `\nKNOWN NODES from earlier parts (id | label | kind). Reuse these ids for the same entities; declare a node again only to add aliases:\n${nodeLines(known)}\n`
    : "";
  return `${passageHeader(chunk, chunkCount, divisions)}${knownBlock}\nExtract the nodes and relations in this passage, following the instructions. Return the JSON object.`;
}

export function followUpMessage(
  chunk: Chunk,
  chunkCount: number,
  divisions: Division[],
  known: TopoNode[],
  found: ExtractedRelation[],
  pass: PassKind,
): string {
  return `${passageHeader(chunk, chunkCount, divisions)}
ALREADY EXTRACTED.
Nodes (id | label | kind):
${nodeLines(known)}

Relations from this passage:
${relationLines(found) || "(none yet)"}

FOCUSED QUESTION: ${pass.question}

Reuse the node ids above; declare a node only for an entity that is not listed. Return ONLY additions or corrections as {"nodes": [...], "relations": [...]}, following the instructions. Do not repeat anything already listed. If there is nothing to add, return {"nodes": [], "relations": []}.`;
}

// ── The loop ─────────────────────────────────────────────────────────

export interface PassRecord {
  chunk: number;
  pass: number;
  kind: string;
  newNodes: number;
  newRelations: number;
  ms: number;
  usage?: ChatUsage;
  error?: string;
}

export interface ExtractProgress {
  chunk: number;
  chunkCount: number;
  pass: number;
  passCount: number;
  passLabel: string;
  /** Tokens received so far in the running pass (streaming providers). */
  tokens?: number;
  totalNodes: number;
  totalRelations: number;
  /** Set when a pass finishes. */
  finished?: PassRecord;
}

export interface ExtractOptions {
  chat: ChatFn;
  systemPrompt: string;
  sourceText: string;
  /** Max characters per part; <= 0 sends the whole source at once. */
  chunkChars: number;
  /** Follow-up passes per part after the first (0 = single pass). */
  followUps: number;
  signal?: AbortSignal;
  onProgress?: (p: ExtractProgress) => void;
}

export interface ExtractOutcome {
  document: RelationDocument;
  passes: PassRecord[];
  chunkCount: number;
  chunksCompleted: number;
  /** False when a pass failed or the run was cancelled. */
  complete: boolean;
  error?: string;
}

export async function extractIteratively(opts: ExtractOptions): Promise<ExtractOutcome> {
  const { chat, systemPrompt, sourceText, signal, onProgress } = opts;
  const divisions = findDivisions(sourceText);
  const chunks = chunkSource(sourceText, divisions, opts.chunkChars);
  const acc = new Accumulator(structureFor(divisions));
  const sequence = followUpSequence(Math.max(0, opts.followUps));
  const passes: PassRecord[] = [];
  let chunksCompleted = 0;
  let error: string | undefined;

  const contentNodes = () => acc.nodes.filter((n) => n.attrs?.["i2t:kind"] !== "structure");

  outer: for (const chunk of chunks) {
    const plan = [null, ...sequence] as (PassKind | null)[];
    for (let p = 0; p < plan.length; p++) {
      const kind = plan[p];
      const label = kind ? kind.label : "first pass";
      onProgress?.({
        chunk: chunk.index,
        chunkCount: chunks.length,
        pass: p,
        passCount: plan.length,
        passLabel: label,
        tokens: 0,
        totalNodes: acc.nodes.length,
        totalRelations: acc.relations.length,
      });
      const user = kind
        ? followUpMessage(
            chunk,
            chunks.length,
            divisions,
            contentNodes(),
            acc.relations.filter((_, i) => acc.relationChunk[i] === chunk.index),
            kind,
          )
        : firstPassMessage(chunk, chunks.length, divisions, contentNodes());
      const started = Date.now();
      const record: PassRecord = { chunk: chunk.index, pass: p, kind: kind?.id ?? "first", newNodes: 0, newRelations: 0, ms: 0 };
      const call = () =>
        chat(systemPrompt, user, {
          signal,
          onTokens: (tokens) =>
            onProgress?.({
              chunk: chunk.index,
              chunkCount: chunks.length,
              pass: p,
              passCount: plan.length,
              passLabel: label,
              tokens,
              totalNodes: acc.nodes.length,
              totalRelations: acc.relations.length,
            }),
        });
      try {
        // Malformed output is the model's, not the connection's: retry the
        // pass once, then skip it and keep going. Anything else (network,
        // auth, cancel) ends the run with what has been gathered.
        let parsed: Partial<RelationDocument> | null = null;
        let parseError: string | null = null;
        for (let attempt = 0; attempt < 2 && parsed === null; attempt++) {
          const result = await call();
          record.usage = result.usage;
          try {
            parsed = parseModelJson(result.content) as Partial<RelationDocument>;
          } catch (err) {
            if (!(err instanceof ExtractionError && err.code === "parse")) throw err;
            parseError = err.message;
          }
        }
        if (parsed === null) {
          record.error = `skipped after 2 tries: ${parseError}`;
        } else {
          const added = acc.add(parsed, chunk.index);
          record.newNodes = added.nodes;
          record.newRelations = added.relations;
        }
      } catch (err) {
        const aborted = err instanceof DOMException && err.name === "AbortError";
        record.error = aborted ? "cancelled" : err instanceof Error ? err.message : String(err);
        record.ms = Date.now() - started;
        passes.push(record);
        error = aborted ? "Cancelled." : `Part ${chunk.index + 1}, ${label}: ${record.error}`;
        onProgress?.({ chunk: chunk.index, chunkCount: chunks.length, pass: p, passCount: plan.length, passLabel: label, totalNodes: acc.nodes.length, totalRelations: acc.relations.length, finished: record });
        break outer;
      }
      record.ms = Date.now() - started;
      passes.push(record);
      onProgress?.({ chunk: chunk.index, chunkCount: chunks.length, pass: p, passCount: plan.length, passLabel: label, totalNodes: acc.nodes.length, totalRelations: acc.relations.length, finished: record });

      // "Anything missed" sweeps repeat only while they keep finding things.
      if (kind?.id === MISSED_PASS.id && record.newNodes + record.newRelations === 0) break;
    }
    chunksCompleted++;
  }

  const document = acc.document({ title: acc.title || "Extracted topology", source: "user-input" });
  assignLoci(document, sourceText, divisions);
  return { document, passes, chunkCount: chunks.length, chunksCompleted, complete: !error, error };
}

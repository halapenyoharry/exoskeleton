import { test } from "node:test";
import assert from "node:assert";
import {
  Accumulator,
  assignLoci,
  chunkSource,
  extractIteratively,
  findDivisions,
  followUpSequence,
  structureFor,
} from "./extract.ts";
import { parseModelJson, type ChatFn } from "./transport.ts";

const STORY = `Marta told her brother Tomas that the river would flood.
##
By morning the river had carried two hives to the mill.
# The Mill
Ivo fished them out.`;

test("findDivisions splits at break lines and headings", () => {
  const ds = findDivisions(STORY);
  assert.deepStrictEqual(ds.map((d) => [d.id, d.label]), [
    ["scene-1", "Scene 1"],
    ["scene-2", "Scene 2"],
    ["the-mill", "The Mill"],
  ]);
  assert.ok(STORY.slice(ds[0].start, ds[0].end).startsWith("Marta"));
  assert.ok(!STORY.slice(ds[1].start, ds[1].end).includes("##"));
  assert.ok(STORY.slice(ds[2].start, ds[2].end).startsWith("# The Mill"));
  assert.deepStrictEqual(findDivisions("no markers here"), []);
});

test("chunkSource keeps divisions whole when they fit and splits oversized text at paragraphs", () => {
  const ds = findDivisions(STORY);
  assert.strictEqual(chunkSource(STORY, ds, 0).length, 1);
  const parts = chunkSource(STORY, ds, 80);
  assert.ok(parts.length >= 2);
  assert.ok(parts.every((c) => c.text.length <= 80));
  assert.deepStrictEqual(parts.flatMap((c) => c.divisionIds), ["scene-1", "scene-2", "the-mill"]);

  const long = Array.from({ length: 10 }, (_, i) => `Paragraph ${i} ${"word ".repeat(20)}`).join("\n\n");
  const pieces = chunkSource(long, [], 300);
  assert.ok(pieces.length > 1);
  assert.ok(pieces.every((c) => c.text.length <= 300));
  assert.strictEqual(pieces.map((c) => c.text).join(""), long, "no text lost or duplicated");
});

test("structureFor builds source-text containing every division", () => {
  const s = structureFor(findDivisions(STORY));
  assert.deepStrictEqual(s.nodes.map((n) => n.id), ["source-text", "scene-1", "scene-2", "the-mill"]);
  assert.strictEqual(s.relations[0].participants.length, 4);
  assert.strictEqual(s.relations[0].evidence, "##");
});

test("Accumulator merges nodes by label or alias and drops duplicate relations", () => {
  const acc = new Accumulator({ nodes: [], relations: [] });
  acc.add({
    nodes: [
      { id: "zayne", kind: "node", label: "Zayne", attrs: { aliases: ["Z"] } },
      { id: "eli", kind: "node", label: "Eli" },
    ],
    relations: [
      {
        predicate: "responds_to", category: "interactivity", mode: "asserted",
        evidence: "\"bet,\" is all Zayne sent back.",
        participants: [{ node: "zayne", role: "speaker" }, { node: "eli", role: "addressee" }],
      },
    ],
  }, 0);
  const added = acc.add({
    nodes: [{ id: "u-ghostintheml", kind: "node", label: "Z" }],
    relations: [
      // Paraphrase of the same relation through the alias: duplicate.
      {
        predicate: "responded_with", category: "interactivity", mode: "asserted",
        evidence: "\"bet,\" is all Zayne sent back",
        participants: [{ node: "u-ghostintheml", role: "speaker" }, { node: "Eli", role: "addressee" }],
      },
      // Same participants, different moment and verb: kept.
      {
        predicate: "warns", category: "interactivity", mode: "asserted",
        evidence: "What's out, Zayne, CREEPER",
        participants: [{ node: "eli", role: "speaker" }, { node: "zayne", role: "addressee" }],
      },
    ],
  }, 0);
  assert.deepStrictEqual(added, { nodes: 0, relations: 1 });
  assert.strictEqual(acc.nodes.length, 2);
  assert.strictEqual(acc.relations.length, 2);
});

test("Accumulator keeps code-built structure and ignores model-declared copies", () => {
  const acc = new Accumulator(structureFor(findDivisions(STORY)));
  const added = acc.add({ nodes: [{ id: "scene-1", kind: "node", label: "Opening" }], relations: [] }, 0);
  assert.strictEqual(added.nodes, 0);
  assert.strictEqual(acc.nodes.find((n) => n.id === "scene-1")?.label, "Scene 1");
});

test("assignLoci places relations by where their evidence sits", () => {
  const ds = findDivisions(STORY);
  const doc = {
    nodes: [],
    relations: [
      { predicate: "fishes_out", category: "state_change" as const, locus: "scene-1", evidence: "Ivo fished them out.", participants: [{ node: "ivo" }, { node: "hives" }] },
      { predicate: "x", category: "reference" as const, locus: "nowhere", evidence: "not in the text", participants: [{ node: "a" }, { node: "b" }] },
    ],
  };
  assignLoci(doc, STORY, ds);
  assert.strictEqual(doc.relations[0].locus, "the-mill");
  assert.strictEqual(doc.relations[1].locus, undefined);
});

test("followUpSequence asks the focused questions first, then repeats 'anything missed'", () => {
  assert.deepStrictEqual(followUpSequence(6).map((p) => p.id), ["modes", "changes", "speech", "identity", "missed", "missed"]);
  assert.deepStrictEqual(followUpSequence(0), []);
});

function scriptedChat(responses: (string | Error)[]): { chat: ChatFn; calls: string[] } {
  const calls: string[] = [];
  const chat: ChatFn = async (_system, user) => {
    calls.push(user);
    const next = responses.shift();
    if (next === undefined) return { content: '{"nodes": [], "relations": []}' };
    if (next instanceof Error) throw next;
    return { content: next };
  };
  return { chat, calls };
}

const rel = (predicate: string, a: string, b: string, evidence: string) =>
  JSON.stringify({ predicate, category: "interactivity", mode: "asserted", evidence, participants: [{ node: a, role: "x" }, { node: b, role: "y" }] });

test("extractIteratively stops the 'anything missed' sweeps once one finds nothing new", async () => {
  const text = "Marta told Tomas. Tomas ignored Marta.";
  const { chat, calls } = scriptedChat([
    `{"metadata": {"title": "Siblings"}, "nodes": [{"id": "marta", "label": "Marta"}, {"id": "tomas", "label": "Tomas"}], "relations": [${rel("tells", "marta", "tomas", "Marta told Tomas.")}]}`,
    '{"nodes": [], "relations": []}', // modes
    '{"nodes": [], "relations": []}', // changes
    '{"nodes": [], "relations": []}', // speech
    '{"nodes": [], "relations": []}', // identity
    `{"nodes": [], "relations": [${rel("ignores", "tomas", "marta", "Tomas ignored Marta.")}]}`, // missed: new
    '{"nodes": [], "relations": []}', // missed: nothing new -> stop
  ]);
  const out = await extractIteratively({ chat, systemPrompt: "sys", sourceText: text, chunkChars: 0, followUps: 10 });
  assert.strictEqual(calls.length, 7);
  assert.ok(out.complete);
  assert.strictEqual(out.document.metadata?.title, "Siblings");
  assert.deepStrictEqual(out.document.relations.map((r) => r.predicate), ["tells", "ignores"]);
  assert.ok(calls[1].includes("FOCUSED QUESTION"), "follow-ups carry a focused question");
  assert.ok(calls[1].includes("tells [interactivity, asserted]"), "follow-ups list what was found");
});

test("extractIteratively keeps earlier parts when a later pass fails", async () => {
  const text = "First part sentence.\n##\nSecond part sentence.";
  const { chat } = scriptedChat([
    `{"nodes": [{"id": "a", "label": "A"}, {"id": "b", "label": "B"}], "relations": [${rel("meets", "a", "b", "First part sentence.")}]}`,
    new Error("upstream 503"),
  ]);
  const out = await extractIteratively({ chat, systemPrompt: "sys", sourceText: text, chunkChars: 25, followUps: 0 });
  assert.strictEqual(out.complete, false);
  assert.strictEqual(out.chunkCount, 2);
  assert.strictEqual(out.chunksCompleted, 1);
  assert.match(out.error ?? "", /Part 2.*upstream 503/);
  assert.ok(out.document.relations.some((r) => r.predicate === "meets"));
  assert.strictEqual(out.document.relations.find((r) => r.predicate === "meets")?.locus, "scene-1");
});

test("parseModelJson tolerates fences and output missing its closing brackets", () => {
  assert.deepStrictEqual(parseModelJson('```json\n{"a": [1, 2]}\n```'), { a: [1, 2] });
  assert.deepStrictEqual(parseModelJson('{"nodes": [], "relations": [{"p": "x"}]'), { nodes: [], relations: [{ p: "x" }] });
  assert.deepStrictEqual(parseModelJson('{"a": "has } and ] inside", "b": ['), { a: "has } and ] inside", b: [] });
  assert.throws(() => parseModelJson("not json"), /invalid JSON/);
});

test("parseModelJson salvages output cut off mid-string", () => {
  const cut = '{"nodes": [{"id": "a", "label": "A"}], "relations": [{"predicate": "meets", "evidence": "First par';
  assert.deepStrictEqual(parseModelJson(cut), {
    nodes: [{ id: "a", label: "A" }],
    relations: [{ predicate: "meets", evidence: "First par" }],
  });
});

test("a malformed pass is retried once, then skipped while later passes still run", async () => {
  const text = "Marta told Tomas. Tomas ignored Marta.";
  const { chat, calls } = scriptedChat([
    "garbage", // first pass, attempt 1
    `{"nodes": [{"id": "marta", "label": "Marta"}, {"id": "tomas", "label": "Tomas"}], "relations": [${rel("tells", "marta", "tomas", "Marta told Tomas.")}]}`, // retry succeeds
    "still garbage", // modes, attempt 1
    "and again", // modes, attempt 2 -> skipped
    `{"nodes": [], "relations": [${rel("ignores", "tomas", "marta", "Tomas ignored Marta.")}]}`, // changes
  ]);
  const out = await extractIteratively({ chat, systemPrompt: "sys", sourceText: text, chunkChars: 0, followUps: 2 });
  assert.strictEqual(calls.length, 5);
  assert.ok(out.complete, "a skipped pass does not end the run");
  assert.deepStrictEqual(out.passes.map((p) => [p.kind, p.error ? "skipped" : "ok"]), [["first", "ok"], ["modes", "skipped"], ["changes", "ok"]]);
  assert.deepStrictEqual(out.document.relations.map((r) => r.predicate), ["tells", "ignores"]);
});

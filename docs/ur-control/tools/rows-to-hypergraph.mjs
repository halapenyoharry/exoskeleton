#!/usr/bin/env node
// ur-control: the profile rows as a TopoThink hypergraph, and back.
//
// Rows (profiles/*.json) are what a hand edits. The hypergraph is what the
// layer thinks in. This is the adapter between them, both ways, plus the two
// checks only the hypergraph makes cheap:
//
//   1. a row binds a gesture none of the profile's devices can produce
//   2. a profile leaves a core action (move, zoom, activate, back) unreachable
//      from the devices it lists
//
// Usage:
//   node rows-to-hypergraph.mjs            write hypergraph/*.json and REPORT.md
//   node rows-to-hypergraph.mjs --check    also round-trip every profile and exit 1 on loss
//
// Format: hypergraph.topothink.spec.md (information2topology). Three
// primitives, every edge reified as a node, incidences with roles, open
// attribute vocabulary under the urc: prefix. No coordinates. No deps.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const PROFILES = join(ROOT, "profiles");
const OUT = join(ROOT, "hypergraph");
const CATALOGUE = JSON.parse(readFileSync(join(ROOT, "catalogue.json"), "utf8"));

const ID = {
  profile: (n) => `urc:profile/${n}`,
  row: (p, i) => `urc:row/${p}/${i}`,
  device: (d) => `urc:device/${d}`,
  gesture: (g) => `urc:gesture/${g}`,
  target: (t) => `urc:target/${t}`,
  action: (a) => `urc:action/${a}`,
  context: (c) => `urc:context/${c}`,
  extends: (c, p) => `urc:extends/${c}/${p}`,
  hasRow: (p, i) => `urc:has-row/${p}/${i}`,
  appliesTo: (p, d) => `urc:applies-to/${p}/${d}`,
  produces: (d, g) => `urc:produces/${d}/${g}`,
};

// Roles on a binds edge are the structural fields of a row. Everything else
// a row carries rides on the edge as a urc:-prefixed attribute, so the
// inverse can put it back without knowing the key.
const ROLE_FIELDS = new Set(["gesture", "action", "target", "device", "when"]);
const RESERVED = new Set(["urc:order", "i2t:predicate", "i2t:category", "dcterms:source"]);

// ─── load ───

export function loadProfiles(dir = PROFILES) {
  const profiles = new Map();
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    const p = JSON.parse(readFileSync(join(dir, f), "utf8"));
    p.__file = `profiles/${f}`;
    profiles.set(p.name, p);
  }
  return profiles;
}

// ─── rows → hypergraph ───

export function toHypergraph(profiles, catalogue = CATALOGUE) {
  const nodes = new Map();
  const edges = [];
  const incidences = [];
  const node = (id, attrs = {}) => {
    if (!nodes.has(id)) nodes.set(id, { id, attrs: {} });
    Object.assign(nodes.get(id).attrs, attrs);
    return id;
  };
  const edge = (id, predicate, category, attrs = {}, directed = true) => {
    edges.push({ id, directed, attrs: { "i2t:predicate": predicate, "i2t:category": category, ...attrs } });
    return id;
  };
  const inc = (e, n, role, attrs) => incidences.push(attrs ? { edge: e, node: n, role, attrs } : { edge: e, node: n, role });

  // Devices and what they produce (the catalogue), interactivity: signals flow.
  const gestureNodes = new Set();
  const produces = [];
  for (const [d, spec] of Object.entries(catalogue.devices)) {
    node(ID.device(d), { "schema:name": d, "urc:kind": "device", "urc:section": spec.section, ...(spec.ambient ? { "urc:ambient": true } : {}) });
    for (const g of spec.produces) produces.push([d, g]);
  }

  for (const p of profiles.values()) {
    const pid = node(ID.profile(p.name), {
      "schema:name": p.name,
      "urc:kind": "profile",
      ...(p.comment ? { "urc:comment": p.comment } : {}),
      ...(p.thresholds ? { "urc:thresholds": p.thresholds } : {}),
      "dcterms:source": p.__file,
    });
    if (p.extends) {
      // Type-hierarchy enclosure: the child is a kind of its parent (containment).
      const e = edge(ID.extends(p.name, p.extends), "urc:extends", "containment");
      inc(e, pid, "source");
      inc(e, node(ID.profile(p.extends), { "urc:kind": "profile" }), "target");
    }
    (p.devices ?? []).forEach((d, i) => {
      const e = edge(ID.appliesTo(p.name, d), "urc:applies-to", "reference", { "urc:order": i });
      inc(e, pid, "source");
      inc(e, node(ID.device(d), { "schema:name": d, "urc:kind": "device" }), "target");
    });
    (p.rows ?? []).forEach((r, i) => {
      const rid = ID.row(p.name, i);
      // The row is a reified edge: a node too, so a later edge can say who set it.
      node(rid, { "urc:kind": "row", "schema:name": `${p.name} #${i}: ${r.gesture} → ${r.action}` });
      const attrs = { "urc:order": i, "dcterms:source": p.__file };
      for (const [k, v] of Object.entries(r)) if (!ROLE_FIELDS.has(k)) attrs[`urc:${k}`] = v;
      // A gesture flows to an action: interactivity.
      edge(rid, "urc:binds", "interactivity", attrs);
      inc(rid, node(ID.gesture(r.gesture), { "schema:name": r.gesture, "urc:kind": "gesture" }), "gesture");
      gestureNodes.add(r.gesture);
      inc(rid, node(ID.action(r.action), { "schema:name": r.action, "urc:kind": "action" }), "action");
      if (r.target) inc(rid, node(ID.target(r.target), { "schema:name": r.target, "urc:kind": "target" }), "target");
      if (r.device) inc(rid, node(ID.device(r.device), { "schema:name": r.device, "urc:kind": "device" }), "device");
      for (const w of r.when ?? []) {
        const neg = w.startsWith("!");
        const c = neg ? w.slice(1) : w;
        inc(rid, node(ID.context(c), { "schema:name": c, "urc:kind": "context" }), "when", neg ? { "urc:negated": true } : undefined);
      }
      // Set membership: the profile holds the row (containment).
      const h = edge(ID.hasRow(p.name, i), "urc:has-row", "containment");
      inc(h, pid, "source");
      inc(h, rid, "target");
    });
  }

  // Produces edges, resolved against every gesture any profile names plus the
  // catalogue's own exact entries, so prefix entries expand to real nodes.
  for (const [d, pat] of produces) {
    const matches = pat.endsWith("*")
      ? [...gestureNodes].filter((g) => g.startsWith(pat.slice(0, -1)))
      : [pat];
    for (const g of matches) {
      node(ID.gesture(g), { "schema:name": g, "urc:kind": "gesture" });
      const e = edge(ID.produces(d, g), "urc:produces", "interactivity", pat.endsWith("*") ? { "urc:pattern": pat } : {});
      inc(e, ID.device(d), "source");
      inc(e, ID.gesture(g), "target");
    }
  }

  return {
    metadata: {
      "topothink-version": "0.1",
      "urc:generator": "docs/ur-control/tools/rows-to-hypergraph.mjs",
      "urc:profiles": [...profiles.keys()],
      "urc:note": "Rows are the authoring form; this is the canonical form. Round-trip with --check.",
    },
    nodes: [...nodes.values()],
    edges,
    incidences,
  };
}

// ─── hypergraph → rows (the inverse projection) ───

export function toRows(graph, profileName) {
  const pid = ID.profile(profileName);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const edgesById = new Map(graph.edges.map((e) => [e.id, e]));
  const incOf = new Map();
  for (const i of graph.incidences) {
    if (!incOf.has(i.edge)) incOf.set(i.edge, []);
    incOf.get(i.edge).push(i);
  }
  const pnode = byId.get(pid);
  if (!pnode) throw new Error(`no profile ${profileName}`);
  const out = { name: profileName };
  for (const e of graph.edges) {
    if (e.attrs["i2t:predicate"] !== "urc:extends") continue;
    const ii = incOf.get(e.id);
    if (ii.find((x) => x.role === "source").node === pid) out.extends = ii.find((x) => x.role === "target").node.slice("urc:profile/".length);
  }
  const devices = graph.edges
    .filter((e) => e.attrs["i2t:predicate"] === "urc:applies-to" && incOf.get(e.id).find((x) => x.role === "source").node === pid)
    .sort((a, b) => a.attrs["urc:order"] - b.attrs["urc:order"])
    .map((e) => incOf.get(e.id).find((x) => x.role === "target").node.slice("urc:device/".length));
  if (devices.length) out.devices = devices;
  if (pnode.attrs["urc:comment"] !== undefined) out.comment = pnode.attrs["urc:comment"];
  if (pnode.attrs["urc:thresholds"] !== undefined) out.thresholds = pnode.attrs["urc:thresholds"];
  const rowIds = graph.edges
    .filter((e) => e.attrs["i2t:predicate"] === "urc:has-row" && incOf.get(e.id).find((x) => x.role === "source").node === pid)
    .map((e) => incOf.get(e.id).find((x) => x.role === "target").node);
  const rows = rowIds.map((rid) => {
    const e = edgesById.get(rid);
    const r = {};
    const ii = incOf.get(rid) ?? [];
    for (const i of ii) {
      const name = i.node.slice(i.node.indexOf("/") + 1);
      if (i.role === "when") (r.when ??= []).push((i.attrs?.["urc:negated"] ? "!" : "") + name);
      else r[i.role] = name;
    }
    for (const [k, v] of Object.entries(e.attrs)) {
      if (RESERVED.has(k) || !k.startsWith("urc:")) continue;
      r[k.slice(4)] = v;
    }
    return [e.attrs["urc:order"], r];
  });
  rows.sort((a, b) => a[0] - b[0]);
  if (rows.length) out.rows = rows.map(([, r]) => r);
  return out;
}

// ─── the checks ───

function matches(pattern, gesture) {
  return pattern.endsWith("*") ? gesture.startsWith(pattern.slice(0, -1)) : pattern === gesture;
}

// A row's identity for the inheritance rule: the structural fields plus the
// source specifier and the modifiers and contexts. Two rows with the same
// identity in child and parent: the child's replaces the parent's.
function rowKey(r) {
  const pick = ["device", "target", "gesture", "key", "code", "keys", "button", "index", "region", "modifiers", "when"];
  return JSON.stringify(pick.map((k) => r[k] ?? null));
}

export function effective(profiles, name, seen = new Set()) {
  const p = profiles.get(name);
  if (!p) throw new Error(`profile ${name} extends unknown ${name}`);
  if (seen.has(name)) throw new Error(`cycle at ${name}`);
  seen.add(name);
  let rows = [];
  let devices = [];
  if (p.extends) ({ rows, devices } = effective(profiles, p.extends, seen));
  const own = p.rows ?? [];
  const keys = new Set(own.map(rowKey));
  const named = new Set(own.map((r) => r.action).filter((a) => a !== "none"));
  const kept = rows.filter((r) => !keys.has(rowKey(r)) && !named.has(r.action));
  return { rows: kept.concat(own), devices: p.devices?.length ? p.devices : devices };
}

export function check(profiles, catalogue = CATALOGUE) {
  const ambient = Object.entries(catalogue.devices).filter(([, s]) => s.ambient).map(([d]) => d);
  const report = [];
  for (const name of profiles.keys()) {
    const { rows, devices } = effective(profiles, name);
    const entry = { profile: name, devices, abstract: devices.length === 0, unproducible: [], unreachable: [] };
    if (!entry.abstract) {
      const avail = [...devices, ...ambient];
      const producible = (r) => {
        const ds = r.device ? [r.device] : avail;
        return ds.some((d) => (catalogue.devices[d]?.produces ?? []).some((pat) => matches(pat, r.gesture)));
      };
      for (const r of rows) {
        if (r.action === "none") continue;
        if (!producible(r)) entry.unproducible.push(`${r.gesture} → ${r.action}${r.device ? ` (device ${r.device})` : ""}`);
      }
      for (const [need, actions] of Object.entries(catalogue.core)) {
        if (need === "comment") continue;
        const ok = rows.some((r) => actions.includes(r.action) && producible(r));
        if (!ok) entry.unreachable.push(`${need} (${actions.join(" | ")})`);
      }
    }
    report.push(entry);
  }
  return report;
}

export function reportMarkdown(report) {
  const lines = ["# ur-control profile report", "", "Generated by `tools/rows-to-hypergraph.mjs`. A row is unproducible when no device the profile lists (nor an ambient one) can make its gesture. A core need is unreachable when no producible row answers it.", ""];
  lines.push("| profile | devices | unproducible rows | unreachable core needs |", "| --- | --- | --- | --- |");
  for (const e of report) {
    lines.push(`| ${e.profile} | ${e.abstract ? "(abstract)" : e.devices.join(", ")} | ${e.unproducible.length ? e.unproducible.join("<br>") : "none"} | ${e.unreachable.length ? e.unreachable.join("<br>") : "none"} |`);
  }
  return lines.join("\n") + "\n";
}

// ─── main ───

function stable(o) {
  return JSON.stringify(o, (k, v) => (v && typeof v === "object" && !Array.isArray(v)) ? Object.fromEntries(Object.keys(v).sort().map((k2) => [k2, v[k2]])) : v);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const checkMode = process.argv.includes("--check");
  const profiles = loadProfiles();
  const graph = toHypergraph(profiles);
  writeFileSync(join(OUT, "ur-control.hypergraph.topothink.json"), JSON.stringify(graph, null, 2) + "\n");
  // One profile with its ancestors, as the readable example.
  const lineage = (n) => (n ? [n, ...lineage(profiles.get(n)?.extends)] : []);
  const sub = new Map(lineage("elinor-jones").map((n) => [n, profiles.get(n)]));
  writeFileSync(join(OUT, "elinor-jones.hypergraph.topothink.json"), JSON.stringify(toHypergraph(sub), null, 2) + "\n");
  const report = check(profiles);
  writeFileSync(join(OUT, "REPORT.md"), reportMarkdown(report));
  console.log(`nodes ${graph.nodes.length}, edges ${graph.edges.length}, incidences ${graph.incidences.length}`);
  for (const e of report) {
    const flags = [...e.unproducible.map((u) => `unproducible: ${u}`), ...e.unreachable.map((u) => `unreachable: ${u}`)];
    console.log(`${e.profile}: ${e.abstract ? "abstract" : e.devices.join(",")}${flags.length ? "\n  " + flags.join("\n  ") : ""}`);
  }
  if (checkMode) {
    let loss = 0;
    for (const [name, p] of profiles) {
      const { __file, ...orig } = p;
      const back = toRows(graph, name);
      if (stable(orig) !== stable(back)) {
        loss++;
        console.error(`round-trip loss in ${name}`);
        console.error(" orig:", stable(orig).slice(0, 400));
        console.error(" back:", stable(back).slice(0, 400));
      }
    }
    console.log(loss ? `round-trip: ${loss} profile(s) lost data` : `round-trip: all ${profiles.size} profiles lossless`);
    process.exit(loss ? 1 : 0);
  }
}

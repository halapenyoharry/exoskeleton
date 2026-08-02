import { test } from "node:test";
import assert from "node:assert";
import {
  retain,
  retainIfRegistered,
  getLast,
  getLastMatching,
  getMostRecent,
  clearRetained,
  retainedPatterns,
  resetRetainRules,
} from "./retainer.ts";
import type { OscArg } from "./types.ts";

function s(value: string): OscArg[] {
  return [{ type: "string", value }];
}

test("nothing is retained without a matching retain() rule", () => {
  resetRetainRules();
  retainIfRegistered("/json/default/select", s("node-1"));
  assert.strictEqual(getLast("/json/default/select"), undefined);
});

test("retain() opts an address pattern in", () => {
  resetRetainRules();
  retain("/json/*/select");
  retainIfRegistered("/json/default/select", s("node-1"));
  assert.deepStrictEqual(getLast("/json/default/select"), s("node-1"));
});

test("a retained address keeps only the latest value", () => {
  resetRetainRules();
  retain("/json/*/select");
  retainIfRegistered("/json/default/select", s("node-1"));
  retainIfRegistered("/json/default/select", s("node-2"));
  assert.deepStrictEqual(getLast("/json/default/select"), s("node-2"));
});

test("unmatched addresses stay out of the cache", () => {
  resetRetainRules();
  retain("/json/*/select");
  // The churn case the opt-in exists to exclude.
  retainIfRegistered("/exoskeleton/clock/tick", []);
  retainIfRegistered("/json/default/focus", s("node-1"));
  assert.strictEqual(getLast("/exoskeleton/clock/tick"), undefined);
  assert.strictEqual(getLast("/json/default/focus"), undefined);
});

test("wildcards do not cross a path separator", () => {
  resetRetainRules();
  retain("/json/*/select");
  retainIfRegistered("/json/a/b/select", s("nested"));
  assert.strictEqual(getLast("/json/a/b/select"), undefined);
});

test("retain() is idempotent", () => {
  resetRetainRules();
  retain("/json/*/select");
  retain("/json/*/select");
  assert.deepStrictEqual(retainedPatterns(), ["/json/*/select"]);
});

test("documents are retained independently", () => {
  resetRetainRules();
  retain("/json/*/select");
  retainIfRegistered("/json/a/select", s("from-a"));
  retainIfRegistered("/json/b/select", s("from-b"));
  assert.deepStrictEqual(getLast("/json/a/select"), s("from-a"));
  assert.deepStrictEqual(getLast("/json/b/select"), s("from-b"));
});

test("getMostRecent picks the latest write across documents", () => {
  resetRetainRules();
  retain("/json/*/select");
  retainIfRegistered("/json/a/select", s("from-a"));
  retainIfRegistered("/json/b/select", s("from-b"));
  assert.deepStrictEqual(getMostRecent("/json/*/select"), ["/json/b/select", s("from-b")]);

  // Re-writing an older address makes it most recent again — recency is by
  // write, not by address.
  retainIfRegistered("/json/a/select", s("from-a-again"));
  assert.deepStrictEqual(getMostRecent("/json/*/select"), [
    "/json/a/select",
    s("from-a-again"),
  ]);
});

test("getMostRecent is undefined when nothing matches", () => {
  resetRetainRules();
  retain("/json/*/select");
  assert.strictEqual(getMostRecent("/json/*/select"), undefined);
});

test("getLastMatching returns every match, most recent first", () => {
  resetRetainRules();
  retain("/json/*/select");
  retainIfRegistered("/json/a/select", s("from-a"));
  retainIfRegistered("/json/b/select", s("from-b"));
  assert.deepStrictEqual(getLastMatching("/json/*/select"), [
    ["/json/b/select", s("from-b")],
    ["/json/a/select", s("from-a")],
  ]);
});

test("clearRetained drops only matching addresses", () => {
  resetRetainRules();
  retain("/json/*/select");
  retain("/json/active");
  retainIfRegistered("/json/a/select", s("from-a"));
  retainIfRegistered("/json/active", s("a"));
  clearRetained("/json/*/select");
  assert.strictEqual(getLast("/json/a/select"), undefined);
  assert.deepStrictEqual(getLast("/json/active"), s("a"));
});

test("clearRetained with no pattern empties the cache but keeps the rules", () => {
  resetRetainRules();
  retain("/json/*/select");
  retainIfRegistered("/json/a/select", s("from-a"));
  clearRetained();
  assert.strictEqual(getLast("/json/a/select"), undefined);
  // Rule survives, so the next send is still retained.
  retainIfRegistered("/json/a/select", s("again"));
  assert.deepStrictEqual(getLast("/json/a/select"), s("again"));
});

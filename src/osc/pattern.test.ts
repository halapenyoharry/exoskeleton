import { test } from "node:test";
import assert from "node:assert";
import { oscPatternToRegExp } from "./pattern.ts";

function matches(pattern: string, address: string): boolean {
  return oscPatternToRegExp(pattern).test(address);
}

test("a literal pattern matches only itself", () => {
  assert.ok(matches("/json/active", "/json/active"));
  assert.ok(!matches("/json/active", "/json/actives"));
  assert.ok(!matches("/json/active", "/json/activ"));
  assert.ok(!matches("/json/active", "/x/json/active"));
});

test("* matches within a segment but never across one", () => {
  assert.ok(matches("/json/*/select", "/json/default/select"));
  assert.ok(matches("/json/*/select", "/json//select"));
  assert.ok(!matches("/json/*/select", "/json/a/b/select"));
  assert.ok(!matches("/json/*/select", "/json/default/focus"));
});

test("? matches exactly one character within a segment", () => {
  assert.ok(matches("/json/?/select", "/json/a/select"));
  assert.ok(!matches("/json/?/select", "/json/ab/select"));
  assert.ok(!matches("/json/?/select", "/json//select"));
});

test("regex metacharacters in a pattern are literal", () => {
  assert.ok(matches("/json/a.b/select", "/json/a.b/select"));
  assert.ok(!matches("/json/a.b/select", "/json/axb/select"));
  assert.ok(matches("/json/a+b/select", "/json/a+b/select"));
  assert.ok(!matches("/json/a+b/select", "/json/aab/select"));
});

test("the anchor is exact — no prefix or suffix matching", () => {
  assert.ok(!matches("/json", "/json/active"));
  assert.ok(!matches("/json/*", "/json/a/b"));
});

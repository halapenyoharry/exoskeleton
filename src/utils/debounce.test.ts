import { test } from "node:test";
import assert from "node:assert";
import { createDebounce } from "./debounce.ts";

test("createDebounce invokes function after delay", async () => {
  let count = 0;
  const debounced = createDebounce(() => {
    count++;
  }, 50);

  debounced();
  assert.strictEqual(count, 0);

  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.strictEqual(count, 1);
});

test("createDebounce flush() invokes pending function immediately and exactly once", () => {
  let count = 0;
  let lastArg = "";
  const debounced = createDebounce((msg: string) => {
    count++;
    lastArg = msg;
  }, 500);

  debounced("first");
  debounced("second");
  assert.strictEqual(count, 0);

  debounced.flush();
  assert.strictEqual(count, 1);
  assert.strictEqual(lastArg, "second");

  // Second flush with nothing pending is a no-op
  debounced.flush();
  assert.strictEqual(count, 1);
});

test("createDebounce flush() with nothing pending is a no-op", () => {
  let count = 0;
  const debounced = createDebounce(() => {
    count++;
  }, 500);

  debounced.flush();
  assert.strictEqual(count, 0);
});

test("createDebounce cancel() clears pending calls without invoking function", async () => {
  let count = 0;
  const debounced = createDebounce(() => {
    count++;
  }, 50);

  debounced();
  debounced.cancel();

  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.strictEqual(count, 0);

  // Flush after cancel is also a no-op
  debounced.flush();
  assert.strictEqual(count, 0);
});

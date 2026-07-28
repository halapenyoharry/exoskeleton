import { test } from "node:test";
import assert from "node:assert";
import { resolveShell } from "./terminal-shell.ts";

test("resolveShell returns SHELL env var when set on darwin", () => {
  const shell = resolveShell("darwin", { SHELL: "/opt/homebrew/bin/fish" });
  assert.strictEqual(shell, "/opt/homebrew/bin/fish");
});

test("resolveShell falls back to /bin/zsh when SHELL is unset on darwin", () => {
  const shell = resolveShell("darwin", {});
  assert.strictEqual(shell, "/bin/zsh");
});

test("resolveShell falls back to /bin/bash when SHELL is unset on linux", () => {
  const shell = resolveShell("linux", {});
  assert.strictEqual(shell, "/bin/bash");
});

test("resolveShell treats empty or whitespace-only SHELL env var as unset on linux", () => {
  const shellEmpty = resolveShell("linux", { SHELL: "" });
  assert.strictEqual(shellEmpty, "/bin/bash");

  const shellSpaces = resolveShell("linux", { SHELL: "   " });
  assert.strictEqual(shellSpaces, "/bin/bash");
});

test("resolveShell returns powershell.exe on win32 regardless of SHELL env var", () => {
  const shellWin = resolveShell("win32", { SHELL: "/bin/zsh" });
  assert.strictEqual(shellWin, "powershell.exe");

  const shellWinNav = resolveShell("Win32", {});
  assert.strictEqual(shellWinNav, "powershell.exe");
});

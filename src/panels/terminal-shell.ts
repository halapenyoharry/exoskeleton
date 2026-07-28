/**
 * Cross-platform shell resolution for PTY spawning.
 *
 * Resolves default shell by platform and environment context:
 * - Windows (win32 / Win): powershell.exe
 * - SHELL environment variable if present and non-empty
 * - macOS (darwin): /bin/zsh
 * - Linux / Unix fallback: /bin/bash
 */
export function resolveShell(
  platform: string,
  env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {},
): string {
  if (platform === "win32" || platform.includes("Win")) {
    return "powershell.exe";
  }
  const envShell = env.SHELL?.trim();
  if (envShell) {
    return envShell;
  }
  if (platform === "darwin") {
    return "/bin/zsh";
  }
  return "/bin/bash";
}

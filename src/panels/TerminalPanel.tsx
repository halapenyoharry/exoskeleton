import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { spawn, type IPty } from "tauri-pty";
import "./TerminalPanel.css";

const SHELL = navigator.platform.includes("Win") ? "powershell.exe" : "/bin/zsh";

export default function TerminalPanel() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const ptyRef = useRef<IPty | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, "Cascadia Mono", monospace',
      fontSize: 13,
      theme: {
        background: "#0d1326",
        foreground: "#c5e8ee",
        cursor: "#18ffff",
        selectionBackground: "#18ffff44",
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    termRef.current = term;

    let pty: IPty | null = null;
    try {
      fit.fit();
      pty = spawn(SHELL, [], {
        cols: term.cols,
        rows: term.rows,
        cwd: undefined,
        env: undefined,
      });
      ptyRef.current = pty;

      const decoder = new TextDecoder();
      pty.onData((data) => term.write(data));
      term.onData((data) => {
        const text = typeof data === "string" ? data : decoder.decode(data);
        pty?.write(text);
      });
      pty.onExit(({ exitCode }: { exitCode: number }) => {
        term.write(`\r\n\x1b[2;36m[shell exited: ${exitCode}]\x1b[0m\r\n`);
      });
    } catch (err) {
      term.write(`\r\n\x1b[31mfailed to spawn pty: ${err}\x1b[0m\r\n`);
      term.write("ensure tauri-plugin-pty is enabled in src-tauri/src/lib.rs\r\n");
    }

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        if (pty) pty.resize(term.cols, term.rows);
      } catch {
        /* container not measurable yet */
      }
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      try { pty?.kill(); } catch { /* */ }
      term.dispose();
      termRef.current = null;
      ptyRef.current = null;
    };
  }, []);

  // Pure content — the host wraps this in PanelRoot via exoPanel().
  return (
    <>
      <div className="panel-header">terminal</div>
      <div ref={hostRef} className="terminal-host" />
    </>
  );
}

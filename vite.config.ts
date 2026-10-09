import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage } from "node:http";

const host = process.env.TAURI_DEV_HOST;

/** Hosts the Ollama relay may forward to: loopback, private LAN, Tailscale. */
function isLocalNetworkTarget(target: string): boolean {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const h = url.hostname;
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".ts.net")) return true;
  const ip = h.split(".").map(Number);
  if (ip.length !== 4 || ip.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = ip;
  return (
    a === 127 ||
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 100 && b >= 64 && b <= 127) // Tailscale / CGNAT
  );
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Dev-server relay for Ollama. Ollama answers CORS only for its allowed
// origins (localhost, tauri://, app://), so a page opened from another
// machine at http://<ip>:1420 gets a 403 calling it directly. The page
// calls /__ollama/<api path> with the Ollama base URL in the
// x-exo-ollama-target header; this forwards the request without the Origin
// header and streams the response back. Targets are limited to loopback,
// private-LAN, and Tailscale addresses.
function ollamaRelay(): Plugin {
  return {
    name: "exo-ollama-relay",
    configureServer(server) {
      server.middlewares.use("/__ollama", async (req, res) => {
        const target = String(req.headers["x-exo-ollama-target"] ?? "").replace(/\/+$/, "");
        if (!isLocalNetworkTarget(target)) {
          res.statusCode = 400;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: `Ollama relay: "${target}" is not a local-network address` }));
          return;
        }
        const controller = new AbortController();
        res.on("close", () => controller.abort()); // browser cancelled
        try {
          const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
          const upstream = await fetch(`${target}${req.url ?? "/"}`, {
            method: req.method,
            headers: { "content-type": "application/json" },
            body,
            signal: controller.signal,
          });
          res.statusCode = upstream.status;
          res.setHeader("content-type", upstream.headers.get("content-type") ?? "application/json");
          if (!upstream.body) {
            res.end();
            return;
          }
          const reader = upstream.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } catch (err) {
          if (controller.signal.aborted) return;
          if (!res.headersSent) {
            res.statusCode = 502;
            res.setHeader("content-type", "application/json");
          }
          res.end(
            JSON.stringify({
              error: `Ollama relay could not reach ${target}: ${err instanceof Error ? err.message : String(err)}`,
            }),
          );
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), ollamaRelay()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));

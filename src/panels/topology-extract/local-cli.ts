import { Command } from "@tauri-apps/plugin-shell";
import { writeTextFile, readTextFile, remove, mkdir, exists } from "@tauri-apps/plugin-fs";
import { homeDir, join } from "@tauri-apps/api/path";

export interface LocalCliParams {
  apiKey: string;
  model: string;
  adapter?: string;
}

export type InputSource = 
  | { type: "text"; data: string }
  | { type: "file"; path: string };

export async function runLocalInfo2TopoCli(
  input: InputSource,
  params: LocalCliParams,
  onProgress?: (msg: string) => void
): Promise<any> {
  const ts = Date.now();
  const outputFileName = `i2t-output-${ts}.hypergraph.topothink.json`;
  const dyadicFileName = `i2t-output-${ts}.normalized-dyadic.json`;

  try {
    const home = await homeDir();
    const tmpDir = await join(home, ".exo-tmp");
    
    if (!(await exists(tmpDir))) {
      await mkdir(tmpDir);
    }

    const outputPath = await join(tmpDir, outputFileName);
    const dyadicPath = await join(tmpDir, dyadicFileName);
    
    let inputPath: string;
    let createdTempInput = false;

    if (input.type === "text") {
      inputPath = await join(tmpDir, `i2t-input-${ts}.txt`);
      await writeTextFile(inputPath, input.data);
      createdTempInput = true;
    } else {
      inputPath = input.path;
    }

    const adapter = params.adapter || "extract";

    const args = [
      "/Users/harold/Projects/information2topology/i2t_cli.py",
      adapter,
      inputPath,
      "--out",
      outputPath,
      "--api-key",
      params.apiKey,
    ];

    if (params.model) {
      args.push("--model", params.model);
    }
    
    args.push("--project");

    console.log("[Local CLI] Executing python3 with args:", args);
    const command = Command.create("run-info2topo", args);

    if (onProgress) {
      command.stdout.on('data', line => {
        onProgress(line);
      });
      command.stderr.on('data', line => {
        // Some Python loggers write to stderr
        onProgress(`[log] ${line}`);
      });
    }

    const result = await new Promise<{code: number | null, signal: number | null}>((resolve, reject) => {
      command.on('close', data => {
        resolve(data);
      });
      command.on('error', error => {
        reject(error);
      });
      command.spawn().catch(reject);
    });

    if (result.code !== 0) {
      throw new Error(`info2topo CLI failed (exit ${result.code}, signal ${result.signal})`);
    }

    // Read the generated dyadic projection
    console.log("[Local CLI] CLI success. Reading projection from", dyadicPath);
    const dyadicContent = await readTextFile(dyadicPath);
    
    // Cleanup temporary files
    if (createdTempInput) {
      await remove(inputPath).catch(console.error);
    }
    await remove(outputPath).catch(console.error);
    await remove(dyadicPath).catch(console.error);

    return JSON.parse(dyadicContent);
  } catch (e) {
    console.error("[Local CLI] Failed to run info2topo:", e);
    throw e;
  }
}

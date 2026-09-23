import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_TIMEOUT_MS = 2_400_000;

// Spawna uma CLI de agente em modo print e devolve o exit e o stdout. O log é gravado enquanto a
// fase roda: num timeout de 40 min ele é o único rastro do que houve.
export function runHeadless(
  bin: string,
  args: string[],
  opts: { cwd: string; logPath: string; timeout_ms: number }
): Promise<{ exitCode: number | null; stdout: string }> {
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(opts.logPath), { recursive: true });
    fs.writeFileSync(opts.logPath, "", "utf-8");
    const log = (text: string) => fs.appendFileSync(opts.logPath, text, "utf-8");
    let stdout = "";
    let settled = false;
    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      resolve({ exitCode, stdout });
    };
    const child = spawn(bin, args, {
      cwd: opts.cwd,
      env: process.env,
      timeout: opts.timeout_ms,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (data) => {
      const text = String(data);
      stdout += text;
      log(text);
    });
    child.stderr.on("data", (data) => log(String(data)));
    child.on("error", (error) => {
      log(`\n[spawn error] ${String(error)}`);
      finish(1);
    });
    child.on("close", (code) => finish(code));
  });
}

// O JSON final do modo print. Algumas CLIs imprimem avisos antes dele; vale a última linha que parseia.
export function lastJson(stdout: string): Record<string, unknown> | null {
  const lines = stdout.trim().split("\n").reverse();
  for (const line of [stdout.trim(), ...lines]) {
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      // tenta a próxima
    }
  }
  return null;
}

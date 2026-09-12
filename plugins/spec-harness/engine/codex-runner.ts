import { spawn } from "node:child_process";
import fs from "node:fs";

export interface CodexJob {
  cwd: string;
  prompt: string;
  logPath: string;
  model?: string;
  timeout_ms?: number;
}

export function codexArgs(job: CodexJob): string[] {
  const args = ["exec", "--sandbox", "workspace-write", "--ephemeral", "--color", "never"];
  if (job.model) args.push("--model", job.model);
  // stdin avoids command-line size limits and interpreting prompts as CLI flags.
  return [...args, "-"];
}

export function runCodex(job: CodexJob): Promise<number> {
  return new Promise((resolve) => {
    const chunks: string[] = [];
    const child = spawn("codex", codexArgs(job), {
      cwd: job.cwd,
      env: process.env,
      timeout: job.timeout_ms ?? 2_400_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdout.on("data", (data) => chunks.push(String(data)));
    child.stderr.on("data", (data) => chunks.push(String(data)));
    child.on("error", (error) => chunks.push(`\n[spawn error] ${String(error)}`));
    child.stdin.on("error", (error) => chunks.push(`\n[stdin error] ${String(error)}`));
    child.stdin.end(job.prompt);
    child.on("close", (code) => {
      fs.writeFileSync(job.logPath, chunks.join(""), "utf-8");
      resolve(code ?? 1);
    });
  });
}

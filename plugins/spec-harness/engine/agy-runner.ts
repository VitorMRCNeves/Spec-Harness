import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface AgyJob {
  cwd: string;
  prompt: string;
  logPath: string;
  model?: string;
  timeout_ms?: number;
  conversationId?: string;
  skip_permissions?: boolean;
}

export function agyArgs(job: AgyJob): string[] {
  const args = ["-p", job.prompt, "--output-format", "json"];
  if (job.conversationId) args.push("--conversation", job.conversationId);
  if (job.model) args.push("--model", job.model);
  if (job.skip_permissions) args.push("--dangerously-skip-permissions");
  return args;
}

export function interpretAgyOutput(
  exitCode: number | null,
  stdout: string
): { code: number; conversationId?: string } {
  const text = stdout.trim();
  if (!text) return { code: 1 };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { code: exitCode ?? 1 };
  }
  const conversationId = typeof parsed.conversation_id === "string" ? parsed.conversation_id : undefined;
  const status = typeof parsed.status === "string" ? parsed.status : undefined;
  if (status === "SUCCESS") return { code: 0, conversationId };
  if (status) {
    return { code: exitCode && exitCode !== 0 ? exitCode : 1, conversationId };
  }
  return { code: exitCode ?? 1, conversationId };
}

export function runAntigravity(job: AgyJob): Promise<{ code: number; conversationId?: string }> {
  return new Promise((resolve) => {
    const chunks: string[] = [];
    let stdout = "";
    let settled = false;
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      fs.mkdirSync(path.dirname(job.logPath), { recursive: true });
      fs.writeFileSync(job.logPath, chunks.join(""), "utf-8");
      resolve(interpretAgyOutput(code, stdout));
    };
    const child = spawn("agy", agyArgs(job), {
      cwd: job.cwd,
      env: process.env,
      timeout: job.timeout_ms ?? 2_400_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (data) => {
      const text = String(data);
      stdout += text;
      chunks.push(text);
    });
    child.stderr.on("data", (data) => chunks.push(String(data)));
    child.on("error", (error) => {
      chunks.push(`\n[spawn error] ${String(error)}`);
      finish(1);
    });
    child.on("close", (code) => finish(code));
  });
}

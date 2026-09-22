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

const DEFAULT_TIMEOUT_MS = 2_400_000;

// `agy -p` não trabalha no cwd: sem --add-dir ele escreve em ~/.gemini/antigravity-cli/scratch,
// devolve SUCCESS e o worktree fica intocado. E o modo print desiste sozinho em 5 min
// (--print-timeout), bem antes do timeout da fase.
export function agyArgs(job: AgyJob): string[] {
  const timeoutSeconds = Math.ceil((job.timeout_ms ?? DEFAULT_TIMEOUT_MS) / 1000);
  const args = [
    "-p", job.prompt,
    "--output-format", "json",
    "--add-dir", job.cwd,
    "--print-timeout", `${timeoutSeconds}s`,
  ];
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
    return { code: exitCode || 1 }; // stdout que não é o JSON final não aprova, nem com exit 0
  }
  const conversationId = typeof parsed.conversation_id === "string" ? parsed.conversation_id : undefined;
  const status = typeof parsed.status === "string" ? parsed.status : undefined;
  // Aprovação exige as duas coisas: status SUCCESS e um processo que não saiu com erro.
  // exit null (morto por timeout/sinal) com SUCCESS no stdout ainda conta: o JSON final já saiu.
  if (exitCode !== null && exitCode !== 0) return { code: exitCode, conversationId };
  return { code: status === "SUCCESS" ? 0 : 1, conversationId };
}

export function runAntigravity(job: AgyJob): Promise<{ code: number; conversationId?: string }> {
  return new Promise((resolve) => {
    // O log é gravado enquanto a fase roda: num timeout de 40 min ele é o único rastro do que houve.
    fs.mkdirSync(path.dirname(job.logPath), { recursive: true });
    fs.writeFileSync(job.logPath, "", "utf-8");
    const log = (text: string) => fs.appendFileSync(job.logPath, text, "utf-8");
    let stdout = "";
    let settled = false;
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      resolve(interpretAgyOutput(code, stdout));
    };
    const child = spawn("agy", agyArgs(job), {
      cwd: job.cwd,
      env: process.env,
      timeout: (job.timeout_ms ?? DEFAULT_TIMEOUT_MS) + 30_000, // folga para o agy encerrar sozinho
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

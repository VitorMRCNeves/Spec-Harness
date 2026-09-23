import { DEFAULT_TIMEOUT_MS, runHeadless } from "./headless.ts";

export interface AgyJob {
  cwd: string;
  prompt: string;
  logPath: string;
  model?: string;
  timeout_ms?: number;
  conversationId?: string;
  skip_permissions?: boolean;
}

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
  const timeout_ms = (job.timeout_ms ?? DEFAULT_TIMEOUT_MS) + 30_000; // folga para o agy encerrar sozinho
  return runHeadless("agy", agyArgs(job), { cwd: job.cwd, logPath: job.logPath, timeout_ms }).then(
    ({ exitCode, stdout }) => interpretAgyOutput(exitCode, stdout)
  );
}

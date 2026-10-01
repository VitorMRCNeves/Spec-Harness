import { DEFAULT_TIMEOUT_MS, lastJson, runHeadless } from "./headless.ts";

export interface CursorJob {
  cwd: string;
  prompt: string;
  logPath: string;
  model?: string;
  timeout_ms?: number;
  sessionId?: string;
  skip_permissions?: boolean;
}

// `cursor-agent -p` roda headless com os hooks de projeto (.cursor/hooks.json do workspace) valendo.
// --workspace fixa o worktree como raiz: é de lá que o Cursor lê o hook copiado. --trust evita o
// prompt interativo de confiança, que travaria o modo print. --force (aprovar shell sem perguntar)
// só com implementer.skip_permissions: o hook continua negando o que está fora do packet.
export function cursorArgs(job: CursorJob): string[] {
  const args = ["-p", job.prompt, "--output-format", "json", "--trust", "--workspace", job.cwd];
  if (job.sessionId) args.push("--resume", job.sessionId);
  if (job.model) args.push("--model", job.model);
  if (job.skip_permissions) args.push("--force");
  return args;
}

// Aprovação exige exit 0 e o resultado final com subtype success e is_error false. Stdout vazio ou
// que não é o JSON final não aprova.
export function interpretCursorOutput(exitCode: number | null, stdout: string): { code: number; sessionId?: string } {
  const parsed = lastJson(stdout);
  if (!parsed) return { code: exitCode || 1 };
  const sessionId = typeof parsed.session_id === "string" ? parsed.session_id : undefined;
  if (exitCode !== null && exitCode !== 0) return { code: exitCode, sessionId };
  const ok = parsed.type === "result" && parsed.subtype === "success" && parsed.is_error === false;
  return { code: ok ? 0 : 1, sessionId };
}

export function runCursor(job: CursorJob): Promise<{ code: number; sessionId?: string }> {
  const timeout_ms = job.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  return runHeadless("cursor-agent", cursorArgs(job), { cwd: job.cwd, logPath: job.logPath, timeout_ms }).then(
    ({ exitCode, stdout }) => interpretCursorOutput(exitCode, stdout)
  );
}

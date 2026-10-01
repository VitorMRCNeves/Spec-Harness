// Decisão única de path scoping. Cada host só normaliza o payload e traduz a resposta.
// A regra em si é a do hook Claude: leitura nos globs de read+write, escrita só nos de write,
// Bash por prefixo, segmento a segmento. Não afrouxe isto ao adicionar um host.

import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type HookHost = "claude" | "cursor" | "antigravity";

export interface Capabilities {
  read: string[];
  write: string[];
  bash: string[];
}

export interface NormalizedCall {
  cwd: string;
  tool: string;
  kind: "read" | "write" | "bash" | "other";
  path: string | null;
  command: string | null;
  input: Record<string, unknown>;
}

export interface Decision {
  allowed: boolean;
  reason: string;
}

const READ_TOOLS = new Set([
  "read",
  "glob",
  "grep",
  "notebookedit",
  "view_file",
  "grep_search",
  "find_by_name",
  "list_dir",
]);

const WRITE_TOOLS = new Set([
  "write",
  "edit",
  "delete",
  "strreplace",
  "write_to_file",
  "replace_file_content",
  "multi_replace_file_content",
]);

const BASH_TOOLS = new Set(["bash", "shell", "run_command"]);

// Eventos que só o Cursor emite. O Claude também manda hook_event_name, mas em PascalCase
// ("PreToolUse"): confundir os dois faz o Claude receber JSON do Cursor com exit 0 e liberar tudo.
const CURSOR_EVENTS = new Set(["beforeReadFile", "beforeShellExecution", "beforeMCPExecution", "preToolUse"]);

// Só o motor de verdade: instalação manual ou o engine do plugin. O prefixo solto
// `\S*(engine|spec_harness)/harness.ts` deixava o agente gravar `app/engine/harness.ts`
// (dentro do glob de escrita) e executá-lo fora da allowlist.
const ENGINE_SCRIPT = /(?:^|\/)(?:plugins\/spec-harness\/engine\/harness\.ts|\.claude\/spec_harness\/harness\.ts)$/;
// O motor que está rodando este hook. É o caminho que o CLI imprime para o agente; no plugin fica
// no cache versionado (~/.claude/plugins/cache/<marketplace>/spec-harness/<versão>/engine/), que o
// regex acima não cobre.
const SELF_ENGINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "harness.ts");

export function globToRegex(pattern: string): RegExp {
  let re = "";
  let i = 0;
  const n = pattern.length;
  while (i < n) {
    const c = pattern[i++];
    if (c === "*") {
      re += ".*";
    } else if (c === "?") {
      re += ".";
    } else if (c === "[") {
      let j = i;
      if (j < n && (pattern[j] === "!" || pattern[j] === "^")) j++;
      if (j < n && pattern[j] === "]") j++;
      while (j < n && pattern[j] !== "]") j++;
      if (j >= n) {
        re += "\\[";
      } else {
        let stuff = pattern.slice(i, j).replace(/\\/g, "\\\\");
        i = j + 1;
        if (stuff.startsWith("!")) stuff = "^" + stuff.slice(1);
        else if (stuff.startsWith("^")) stuff = "\\" + stuff;
        re += `[${stuff}]`;
      }
    } else {
      re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(relPath: string, patterns: string[]): boolean {
  return patterns.some((p) => globToRegex(p).test(relPath));
}

export function detectHost(raw: Record<string, unknown>, envHost?: string): HookHost {
  if (envHost === "cursor" || envHost === "antigravity" || envHost === "claude") return envHost;
  // Se não tem variável de ambiente, é o hook do Claude CLI, que não a exporta.
  // Ignoramos o payload porque um comando forjado com eventos do Cursor faria a guarda 
  // do Claude responder no formato do Cursor (exit 0), o que o Claude interpreta como permissão concedida.
  return "claude";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function kindFor(tool: string): NormalizedCall["kind"] {
  const name = tool.toLowerCase();
  if (READ_TOOLS.has(name)) return "read";
  if (WRITE_TOOLS.has(name)) return "write";
  if (BASH_TOOLS.has(name)) return "bash";
  return "other";
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return null;
}

// Paths relativos (o preToolUse do Cursor manda relativo a working_directory) viram absolutos,
// senão o hook não acha a run do worktree e libera.
function absolute(value: string | null, base: string): string | null {
  return value && !path.isAbsolute(value) ? path.resolve(base, value) : value;
}

export function normalizeCall(host: HookHost, raw: Record<string, unknown>, fallbackCwd: string): NormalizedCall {
  if (host === "antigravity") {
    const toolCall = asRecord(raw.toolCall);
    const args = asRecord(toolCall.args);
    const tool = asString(toolCall.name) ?? "";
    const workspaces = Array.isArray(raw.workspacePaths) ? raw.workspacePaths : [];
    const cwd = firstString(args, ["Cwd", "cwd"]) ?? asString(workspaces[0]) ?? asString(raw.cwd) ?? fallbackCwd;
    return {
      cwd,
      tool,
      kind: kindFor(tool),
      path: absolute(
        firstString(args, ["AbsolutePath", "TargetFile", "SearchPath", "SearchDirectory", "DirectoryPath", "file_path", "path"]),
        cwd
      ),
      command: firstString(args, ["CommandLine", "command"]),
      input: args,
    };
  }

  const event = asString(raw.hook_event_name) ?? "";
  if (host === "cursor" && event === "beforeShellExecution") {
    return {
      cwd: asString(raw.cwd) ?? fallbackCwd,
      tool: "Shell",
      kind: "bash",
      path: null,
      command: asString(raw.command),
      input: { command: raw.command },
    };
  }
  if (host === "cursor" && event === "beforeReadFile") {
    const cwd = asString(raw.cwd) ?? fallbackCwd;
    const file = firstString(raw, ["file_path", "path"]);
    return { cwd, tool: "Read", kind: "read", path: absolute(file, cwd), command: null, input: { file_path: file } };
  }

  const toolInput = asRecord(raw.tool_input ?? raw.toolInput);
  const tool = asString(raw.tool_name ?? raw.toolName) ?? "";
  const cwd = asString(toolInput.working_directory) ?? asString(raw.cwd) ?? fallbackCwd;
  return {
    cwd,
    tool,
    kind: kindFor(tool),
    path: absolute(firstString(toolInput, ["file_path", "path", "notebook_path", "target_file"]), cwd),
    command: asString(toolInput.command),
    input: toolInput,
  };
}

// Quebra o comando nos operadores de controle para que `pytest && curl ...` não passe só porque
// começa com um prefixo permitido. Respeita aspas: `git commit -m "a; b <x>"` é um segmento só — o
// Cursor injeta `--trailer "Co-authored-by: Cursor <...>"` em todo commit. Substituição de comando
// (`$(`, crase — também dentro de aspas duplas) e redirecionamento para arquivo não têm como ser
// checados por prefixo: null recusa o comando inteiro. Duplicar fd (`2>&1`) e mandar para
// /dev/null não escrevem em arquivo nenhum e passam.
export function shellSegments(command: string): string[] | null {
  const segments: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      current += c;
      continue;
    }
    if (c === "`" || (c === "$" && command[i + 1] === "(")) return null;
    if (quote === '"') {
      if (c === "\\") {
        current += c + (command[i + 1] ?? "");
        i++;
        continue;
      }
      if (c === '"') quote = null;
      current += c;
      continue;
    }
    if (c === "\\") {
      current += c + (command[i + 1] ?? "");
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      current += c;
      continue;
    }
    if (c === ">" || c === "<") {
      const rest = command.slice(i);
      const dup = /^>&\d/.exec(rest);
      const devnull = /^>{1,2}\s*\/dev\/null(?=[\s;&|)]|$)/.exec(rest);
      if (c === ">" && (dup || devnull)) {
        const match = (dup ?? devnull) as RegExpExecArray;
        current += match[0];
        i += match[0].length - 1;
        continue;
      }
      return null;
    }
    const two = command.slice(i, i + 2);
    if (two === "&&" || two === "||") {
      segments.push(current);
      current = "";
      i++;
      continue;
    }
    if (c === "&" && command[i + 1] === ">") {
      current += c; // &>/dev/null: o > seguinte decide
      continue;
    }
    if (c === ";" || c === "|" || c === "&" || c === "\n") {
      segments.push(current);
      current = "";
      continue;
    }
    current += c;
  }
  if (quote) return null; // aspa aberta: o shell não rodaria isso como a gente leu
  segments.push(current);
  return segments.map((part) => part.trim()).filter(Boolean);
}

// Sempre liberados: builtins que não leem nem gravam arquivo — o redirecionamento já foi barrado
// em shellSegments. git tem regra própria (gitAllowed).
const ALWAYS_ALLOWED = ["cd", "echo", "pwd", "true", "false"];

// git entra por subcomando, não por prefixo: `git -c alias.x='!sh' x` roda qualquer coisa, e
// restore/checkout/rm/mv/clean mexem na árvore por fora dos globs de escrita. Fica o que lê e o
// add/commit dos checkpoints do GREEN (hooks em .git/ estão fora de qualquer glob de escrita).
const GIT_SUBCOMMANDS = new Set(["status", "diff", "log", "show", "rev-parse", "ls-files", "blame", "grep", "add", "commit"]);
// Opções que executam programa, trocam a config, leem arquivo arbitrário (--no-index)
// ou gravam um path escolhido (--output).
const GIT_EXEC_OPTION = /(^|\s)(-O|--open-files-in-pager|--ext-diff|--textconv|--upload-pack|--receive-pack|--no-index|--output)(\s|=|$)/;

function pathWithin(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function gitAllowed(part: string, cwd: string): boolean {
  const words = part.split(/\s+/);
  if (words[0] !== "git") return false;
  if (GIT_EXEC_OPTION.test(part)) return false;
  let i = 1;
  // Opções globais aceitas antes do subcomando; qualquer outra recusa.
  // -C fica restrito ao cwd do comando: `git -C /outro add` escreve noutro repositório.
  while (i < words.length && words[i].startsWith("-")) {
    if (words[i] === "-C") {
      const target = words[i + 1];
      if (!target || !pathWithin(path.resolve(cwd, target), cwd)) return false;
      i += 2;
    } else if (words[i] === "--no-pager") i += 1;
    else return false;
  }
  return GIT_SUBCOMMANDS.has(words[i] ?? "");
}

function engineCommandAllowed(part: string, cwd: string, writeGlobs: string[]): boolean {
  const match = /^node\s+(\S+)(?:\s|$)/.exec(part);
  if (!match) return false;
  const script = match[1].startsWith("~/") ? path.join(os.homedir(), match[1].slice(2)) : match[1];
  const resolved = path.resolve(cwd, script);
  if (resolved !== SELF_ENGINE && !ENGINE_SCRIPT.test(match[1])) return false;
  const rel = path.relative(cwd, resolved);
  const inside = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  if (inside && matchesAny(rel, writeGlobs)) return false;
  return true;
}

function segmentAllowed(part: string, allowlist: string[], cwd: string, writeGlobs: string[]): boolean {
  const commandPrefix = (entry: string): boolean =>
    part === entry || (part.startsWith(entry) && /\s/.test(part[entry.length] ?? ""));
  if (ALWAYS_ALLOWED.some(commandPrefix)) return true;
  if (/^git(?:\s|$)/.test(part)) return gitAllowed(part, cwd);
  if (engineCommandAllowed(part, cwd, writeGlobs)) return true;
  return allowlist.some(commandPrefix);
}

// Instrução do repositório na raiz do worktree: todo host lê antes de trabalhar, e o prompt da
// fase manda seguir o AGENTS.md. Só leitura, e só na raiz.
const INSTRUCTION_FILES = ["AGENTS.md", "CLAUDE.md", "GEMINI.md"];

export function decide(call: NormalizedCall, caps: Capabilities): Decision {
  if (call.kind === "read") {
    if (call.path && path.isAbsolute(call.path)) {
      return { allowed: false, reason: `path fora do worktree: ${call.path}` };
    }
    if (call.path && !INSTRUCTION_FILES.includes(call.path) && !matchesAny(call.path, [...caps.read, ...caps.write])) {
      return { allowed: false, reason: `path fora de capabilities.read.paths: ${call.path}` };
    }
    return { allowed: true, reason: "" };
  }
  if (call.kind === "write") {
    if (call.path && path.isAbsolute(call.path)) {
      return { allowed: false, reason: `path fora do worktree: ${call.path}` };
    }
    if (call.path && !matchesAny(call.path, caps.write)) {
      return { allowed: false, reason: `path fora de capabilities.write.paths: ${call.path}` };
    }
    return { allowed: true, reason: "" };
  }
  if (call.kind === "bash") {
    const command = call.command ?? "";
    const parts = shellSegments(command);
    if (!parts) {
      return { allowed: false, reason: `comando com substituição ou redirecionamento de arquivo: ${command}` };
    }
    const denied = parts.find((part) => !segmentAllowed(part, caps.bash, call.cwd, caps.write));
    if (denied !== undefined) {
      return { allowed: false, reason: `comando fora de capabilities.bash.commands: ${denied}` };
    }
    return { allowed: true, reason: "" };
  }
  return { allowed: false, reason: `ferramenta '${call.tool}' sem regra declarada no packet — bloqueada por padrão` };
}

export function hookStdout(host: HookHost, decision: Decision): { code: number; body: string } {
  if (host === "cursor") {
    const body = decision.allowed
      ? { permission: "allow" }
      : { permission: "deny", user_message: decision.reason, agent_message: decision.reason };
    return { code: 0, body: JSON.stringify(body) };
  }
  if (host === "antigravity") {
    const body = decision.allowed ? { decision: "allow" } : { decision: "deny", reason: decision.reason };
    return { code: 0, body: JSON.stringify(body) };
  }
  return { code: decision.allowed ? 0 : 2, body: "" };
}

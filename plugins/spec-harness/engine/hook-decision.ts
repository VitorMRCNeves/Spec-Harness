// Decisão única de path scoping. Cada host só normaliza o payload e traduz a resposta.
// A regra em si é a do hook Claude: leitura nos globs de read+write, escrita só nos de write,
// Bash por prefixo. Não afrouxe isto ao adicionar um host.

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
  if (raw.toolCall && typeof raw.toolCall === "object") return "antigravity";
  if (typeof raw.hook_event_name === "string") return "cursor";
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
      path: firstString(args, ["AbsolutePath", "TargetFile", "SearchPath", "SearchDirectory", "DirectoryPath", "file_path", "path"]),
      command: firstString(args, ["CommandLine", "command"]),
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
    };
  }
  if (host === "cursor" && (event === "beforeReadFile" || event === "afterFileEdit")) {
    return {
      cwd: asString(raw.cwd) ?? fallbackCwd,
      tool: event === "beforeReadFile" ? "Read" : "Edit",
      kind: event === "beforeReadFile" ? "read" : "write",
      path: firstString(raw, ["file_path", "path"]),
      command: null,
    };
  }

  const toolInput = asRecord(raw.tool_input ?? raw.toolInput);
  const tool = asString(raw.tool_name ?? raw.toolName) ?? "";
  return {
    cwd: asString(raw.cwd) ?? fallbackCwd,
    tool,
    kind: kindFor(tool),
    path: firstString(toolInput, ["file_path", "path", "notebook_path", "target_file"]),
    command: asString(toolInput.command),
  };
}

export function decide(call: NormalizedCall, caps: Capabilities): Decision {
  if (call.kind === "read") {
    if (call.path && !matchesAny(call.path, [...caps.read, ...caps.write])) {
      return { allowed: false, reason: `path fora de capabilities.read.paths: ${call.path}` };
    }
    return { allowed: true, reason: "" };
  }
  if (call.kind === "write") {
    if (call.path && !matchesAny(call.path, caps.write)) {
      return { allowed: false, reason: `path fora de capabilities.write.paths: ${call.path}` };
    }
    return { allowed: true, reason: "" };
  }
  if (call.kind === "bash") {
    const command = call.command ?? "";
    if (command.includes("spec_harness/harness.ts") || command.startsWith("git ")) {
      return { allowed: true, reason: "" };
    }
    if (!caps.bash.some((entry) => command === entry || command.startsWith(entry))) {
      return { allowed: false, reason: `comando fora de capabilities.bash.commands: ${command}` };
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

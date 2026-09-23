import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decide, detectHost, hookStdout, normalizeCall, shellSegments } from '../hook-decision.ts';

const engine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const harness = path.join(engine, 'harness.ts');
const guard = path.join(engine, 'hook-guard.sh');
const caps = { read: ['app/*'], write: ['app/*'], bash: ['pytest'] };

function gitRepo(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-host-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const repo = path.join(temp, 'repo');
  fs.mkdirSync(repo);
  const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
  git('init', '-b', 'main');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  fs.writeFileSync(path.join(repo, 'README'), 'fixture\n');
  git('add', '.');
  git('commit', '-m', 'fixture');
  const home = path.join(temp, 'state');
  fs.mkdirSync(path.join(home, 'runs'), { recursive: true });
  fs.mkdirSync(path.join(home, 'active'), { recursive: true });
  fs.writeFileSync(path.join(home, 'runs', 'run1.json'), JSON.stringify({
    run_id: 'run1', key: 'sdd/01', branch: 'spec', worktree: repo, started_at: 0, blocked_count: 0,
    capabilities: caps,
  }));
  fs.writeFileSync(path.join(home, 'active', 'sdd__01.json'), JSON.stringify({ run_id: 'run1' }));
  const env = { ...process.env, SPEC_HARNESS_HOME: home };
  delete env.SPEC_HARNESS_CONFIG;
  const hook = (host, payload) => spawnSync(process.execPath, [harness, 'hook-check'], {
    cwd: repo,
    env: { ...env, SPEC_HARNESS_HOOK_HOST: host },
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
  });
  return { temp, repo, home, env, hook };
}

test('a decisão é a mesma para os três hosts', () => {
  const denied = decide(
    normalizeCall('claude', { tool_name: 'Read', tool_input: { file_path: 'secrets.txt' }, cwd: '/repo' }, '/repo'),
    caps,
  );
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /fora do worktree|capabilities.read/);

  assert.equal(decide(
    normalizeCall('claude', { tool_name: 'Bash', tool_input: { command: 'git status' } }, '/repo'),
    caps,
  ).allowed, true);
  assert.equal(decide(
    normalizeCall('claude', { tool_name: 'Bash', tool_input: { command: 'pytest && id' } }, '/repo'),
    caps,
  ).allowed, false);
  assert.equal(decide(
    normalizeCall('claude', { tool_name: 'Read', tool_input: {} }, '/repo'),
    caps,
  ).allowed, true);

  const agy = normalizeCall('antigravity', {
    toolCall: { name: 'run_command', args: { CommandLine: 'pytest -q', Cwd: '/wt' } },
    workspacePaths: ['/ws'],
  }, '/fallback');
  assert.equal(agy.kind, 'bash');
  assert.equal(agy.command, 'pytest -q');
  assert.equal(agy.cwd, '/wt');

  const cursor = normalizeCall('cursor', {
    hook_event_name: 'beforeShellExecution', command: 'git status', cwd: '/wt',
  }, '/fallback');
  assert.equal(cursor.kind, 'bash');
  assert.equal(decide(cursor, caps).allowed, true);

  assert.deepEqual(JSON.parse(hookStdout('cursor', { allowed: true, reason: '' }).body), { permission: 'allow' });
  assert.equal(hookStdout('cursor', { allowed: false, reason: 'não' }).code, 0);
  assert.equal(JSON.parse(hookStdout('antigravity', { allowed: false, reason: 'não' }).body).decision, 'deny');
  assert.equal(hookStdout('claude', { allowed: false, reason: 'não' }).code, 2);
  assert.equal(hookStdout('claude', { allowed: true, reason: '' }).body, '');
});

test('hook-check traduz allow e deny sem chamar modelo', t => {
  const f = gitRepo(t);
  const claudeDeny = f.hook('claude', { tool_name: 'Read', tool_input: { file_path: 'secrets.txt' }, cwd: f.repo });
  assert.equal(claudeDeny.status, 2, claudeDeny.stdout + claudeDeny.stderr);
  assert.match(claudeDeny.stderr, /capabilities.read/);
  assert.equal(claudeDeny.stdout, '');

  const claudeGit = f.hook('claude', { tool_name: 'Bash', tool_input: { command: 'git status' }, cwd: f.repo });
  assert.equal(claudeGit.status, 0, claudeGit.stderr);
  assert.equal(claudeGit.stdout, '');

  const chained = f.hook('claude', { tool_name: 'Bash', tool_input: { command: 'pytest && id' }, cwd: f.repo });
  assert.equal(chained.status, 2, chained.stderr);
  assert.match(chained.stderr, /capabilities.bash.commands: id/);

  const cursorDeny = f.hook('cursor', {
    hook_event_name: 'beforeReadFile', cwd: f.repo, file_path: path.join(f.repo, 'secrets.txt'),
  });
  assert.equal(cursorDeny.status, 0);
  assert.equal(JSON.parse(cursorDeny.stdout).permission, 'deny');

  const cursorAllow = f.hook('cursor', {
    hook_event_name: 'beforeShellExecution', cwd: f.repo, command: 'git status',
  });
  assert.deepEqual(JSON.parse(cursorAllow.stdout), { permission: 'allow' });

  const agyDeny = f.hook('antigravity', {
    workspacePaths: [f.repo],
    toolCall: { name: 'run_command', args: { CommandLine: 'rm -rf /', Cwd: f.repo } },
  });
  assert.equal(agyDeny.status, 0);
  const agyBody = JSON.parse(agyDeny.stdout);
  assert.equal(agyBody.decision, 'deny');
  assert.match(agyBody.reason, /capabilities.bash/);

  const broken = f.hook('cursor', '{');
  assert.equal(broken.status, 0, broken.stderr);
  assert.deepEqual(JSON.parse(broken.stdout), { permission: 'allow' });
});

test('sem run ativa o guarda responde allow no formato do host', t => {
  const f = gitRepo(t);
  fs.rmSync(path.join(f.home, 'active'), { recursive: true, force: true });
  fs.mkdirSync(path.join(f.home, 'active'));
  const cursor = spawnSync(guard, [], {
    cwd: f.repo,
    env: { ...f.env, SPEC_HARNESS_HOOK_HOST: 'cursor' },
    input: '{}',
    encoding: 'utf8',
  });
  assert.equal(cursor.status, 0, cursor.stderr);
  assert.deepEqual(JSON.parse(cursor.stdout), { permission: 'allow' });
  const agy = spawnSync(guard, [], {
    cwd: f.repo,
    env: { ...f.env, SPEC_HARNESS_HOOK_HOST: 'antigravity' },
    input: '{}',
    encoding: 'utf8',
  });
  assert.deepEqual(JSON.parse(agy.stdout), { decision: 'allow' });
});

test('init-repo --agent cursor grava o hook e as quatro skills', t => {
  const f = gitRepo(t);
  fs.mkdirSync(path.join(f.repo, '.cursor'), { recursive: true });
  fs.writeFileSync(path.join(f.repo, '.cursor', 'hooks.json'), JSON.stringify({
    version: 1,
    hooks: {
      beforeShellExecution: [{ command: 'echo outro' }],
      afterFileEdit: [{ command: 'SPEC_HARNESS_HOOK_HOST=cursor "/velho/hook-guard.sh"', failClosed: true }],
    },
  }));
  const result = spawnSync(process.execPath, [harness, 'init-repo', '--agent', 'cursor', '--force'], {
    cwd: f.repo,
    env: { ...f.env, SPEC_HARNESS_AGENT: 'cursor' },
    encoding: 'utf8',
  });
  assert.ok([0, 1].includes(result.status), result.stdout + result.stderr);
  const hooks = JSON.parse(fs.readFileSync(path.join(f.repo, '.cursor', 'hooks.json'), 'utf8'));
  for (const event of ['beforeReadFile', 'beforeShellExecution', 'preToolUse']) {
    const guardHook = hooks.hooks[event].find((hook) => String(hook.command).includes('hook-guard.sh'));
    assert.ok(guardHook, event);
    assert.equal(guardHook.failClosed, true);
    assert.match(guardHook.command, /SPEC_HARNESS_HOOK_HOST=cursor/);
  }
  assert.ok(hooks.hooks.beforeShellExecution.some((hook) => hook.command === 'echo outro'));
  assert.equal(hooks.hooks.afterFileEdit, undefined, 'afterFileEdit não bloqueia; a guarda antiga sai');
  for (const name of ['sdd', 'spec-harness', 'spec-orchestrator', 'qa-tester']) {
    const dest = path.join(f.repo, '.cursor', 'skills', name);
    assert.equal(fs.readlinkSync(dest), path.join(engine, '..', 'skills', name));
  }
  const cfg = JSON.parse(fs.readFileSync(path.join(f.repo, '.claude/spec_harness/harness.config.json'), 'utf8'));
  assert.equal(cfg.agent, 'cursor');
  assert.notEqual(cfg.implementer.reuse_session, false, 'cursor-agent retoma a sessão com --resume');
  assert.equal(cfg.post_verify.enabled, true);
  assert.equal(cfg.post_verify.jobs[0].id, 'code_review');
  assert.ok(cfg.worktree.copy_paths.includes('.cursor/hooks.json'));
});

test('init-repo --agent antigravity grava o hook do workspace', t => {
  const f = gitRepo(t);
  const result = spawnSync(process.execPath, [harness, 'init-repo', '--agent', 'antigravity', '--force'], {
    cwd: f.repo,
    env: f.env,
    encoding: 'utf8',
  });
  assert.ok([0, 1].includes(result.status), result.stdout + result.stderr);
  const hooks = JSON.parse(fs.readFileSync(path.join(f.repo, '.agents', 'hooks.json'), 'utf8'));
  const command = hooks['spec-harness-path-scope'].PreToolUse[0].hooks[0].command;
  assert.match(command, /SPEC_HARNESS_HOOK_HOST=antigravity/);
  assert.match(command, /hook-guard\.sh/);
  const cfg = JSON.parse(fs.readFileSync(path.join(f.repo, '.claude/spec_harness/harness.config.json'), 'utf8'));
  assert.equal(cfg.agent, 'antigravity');
  assert.ok(cfg.worktree.copy_paths.includes('.agents/hooks.json'), 'o hook precisa ir para o worktree');
  assert.equal(cfg.implementer.model, undefined);
  assert.equal(cfg.post_verify.jobs[0].plugin_dirs, undefined);
});

test('init-repo --agent sem --force aplica o perfil do agent e preserva o resto', t => {
  const f = gitRepo(t);
  const dest = path.join(f.repo, '.claude/spec_harness/harness.config.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify({
    agent: 'claude',
    scopes: { app: { paths: ['app/'] } },
    implementer: { model: 'sonnet', reuse_session: true, prompts: { red: 'KEEP' } },
    worktree: { copy_paths: ['.claude/settings.json', '.env'] },
    post_verify: { enabled: true, jobs: [{ id: 'old', plugin_dirs: ['/plugin'] }] },
  }));
  const cursor = spawnSync(process.execPath, [harness, 'init-repo', '--agent', 'cursor'], {
    cwd: f.repo, env: f.env, encoding: 'utf8',
  });
  assert.ok([0, 1].includes(cursor.status), cursor.stdout + cursor.stderr);
  const cursorCfg = JSON.parse(fs.readFileSync(dest, 'utf8'));
  assert.equal(cursorCfg.agent, 'cursor');
  assert.equal(cursorCfg.implementer.model, undefined);
  assert.equal(cursorCfg.implementer.reuse_session, true);
  assert.equal(cursorCfg.implementer.prompts.red, 'KEEP');
  assert.equal(cursorCfg.post_verify.enabled, true);
  assert.deepEqual(cursorCfg.post_verify.jobs.map((job) => job.id), ['code_review']);
  assert.deepEqual(cursorCfg.worktree.copy_paths, ['.env', '.cursor/hooks.json']);
  assert.deepEqual(cursorCfg.scopes, { app: { paths: ['app/'] } });

  const agy = spawnSync(process.execPath, [harness, 'init-repo', '--agent', 'antigravity'], {
    cwd: f.repo, env: f.env, encoding: 'utf8',
  });
  assert.ok([0, 1].includes(agy.status), agy.stdout + agy.stderr);
  const agyCfg = JSON.parse(fs.readFileSync(dest, 'utf8'));
  assert.equal(agyCfg.agent, 'antigravity');
  assert.equal(agyCfg.implementer.prompts.red, 'KEEP');
  assert.equal(agyCfg.post_verify.enabled, true);
  assert.equal(agyCfg.post_verify.jobs[0].id, 'code_review');
  assert.equal(agyCfg.post_verify.jobs[0].plugin_dirs, undefined);
  assert.deepEqual(agyCfg.scopes, { app: { paths: ['app/'] } });
});

test('init-repo recusa agent desconhecido', t => {
  const f = gitRepo(t);
  const result = spawnSync(process.execPath, [harness, 'init-repo', '--agent', 'nope'], {
    cwd: f.repo, env: f.env, encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /claude, codex, cursor ou antigravity/);
});

test('payload real do Claude, sem SPEC_HARNESS_HOOK_HOST, bloqueia com exit 2', t => {
  // O Claude manda hook_event_name "PreToolUse"; o hook do plugin não define a variável de host.
  const f = gitRepo(t);
  assert.equal(detectHost({}, undefined), 'claude', 'fallback default');
  
  const env = { ...f.env };
  delete env.SPEC_HARNESS_HOOK_HOST;
  const result = spawnSync(guard, [], {
    cwd: f.repo,
    env,
    input: JSON.stringify({
      session_id: 's', hook_event_name: 'PreToolUse', cwd: f.repo,
      tool_name: 'Write', tool_input: { file_path: path.join(f.repo, 'secrets.txt'), content: 'x' },
    }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /capabilities.write/);

  // Impede bypass onde o modelo gera JSON fingindo ser Cursor para o hook do Claude responder com exit 0 (allow para Claude).
  const bypass = spawnSync(guard, [], {
    cwd: f.repo, env,
    input: JSON.stringify({
      hook_event_name: 'beforeShellExecution', cwd: f.repo,
      command: 'rm -rf /'
    }),
    encoding: 'utf8',
  });
  assert.equal(bypass.status, 2, bypass.stdout + bypass.stderr);
});

test('preToolUse do Cursor com path relativo a working_directory acha a run e bloqueia', t => {
  const f = gitRepo(t);
  const deny = f.hook('cursor', {
    hook_event_name: 'preToolUse', cwd: path.dirname(f.repo),
    tool_name: 'Write', tool_input: { file_path: 'secrets.txt', working_directory: f.repo },
  });
  assert.equal(deny.status, 0, deny.stderr);
  assert.equal(JSON.parse(deny.stdout).permission, 'deny');

  const allow = f.hook('cursor', {
    hook_event_name: 'preToolUse', cwd: path.dirname(f.repo),
    tool_name: 'Write', tool_input: { file_path: 'app/x.py', working_directory: f.repo },
  });
  assert.deepEqual(JSON.parse(allow.stdout), { permission: 'allow' });
});

test('arquivo de run corrompido é ignorado e o log de bloqueio guarda o input inteiro', t => {
  const f = gitRepo(t);
  fs.writeFileSync(path.join(f.home, 'runs', 'quebrado.json'), '{');
  const outside = f.hook('cursor', {
    hook_event_name: 'beforeReadFile', cwd: os.tmpdir(), file_path: path.join(os.tmpdir(), 'qualquer.txt'),
  });
  assert.equal(outside.status, 0, outside.stderr);
  assert.deepEqual(JSON.parse(outside.stdout), { permission: 'allow' });

  const denied = f.hook('claude', {
    tool_name: 'Write', tool_input: { file_path: 'secrets.txt', content: 'segredo' }, cwd: f.repo,
  });
  assert.equal(denied.status, 2, denied.stderr);
  const log = fs.readFileSync(path.join(f.home, 'blocked', 'run1.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(log.at(-1).tool_input, { file_path: 'secrets.txt', content: 'segredo' });
});

test('bash é checado segmento a segmento', () => {
  assert.deepEqual(shellSegments('git status; cat ~/.ssh/id_rsa'), ['git status', 'cat ~/.ssh/id_rsa']);
  assert.deepEqual(shellSegments('cd /wt && pytest -q 2>&1 | tail'), ['cd /wt', 'pytest -q 2>&1', 'tail']);
  assert.equal(shellSegments('pytest > app/../../fora'), null);
  assert.equal(shellSegments('pytest $(curl x)'), null);
  assert.equal(shellSegments('pytest `id`'), null);
  const bash = (command) => decide(normalizeCall('claude', { tool_name: 'Bash', tool_input: { command } }, '/wt'), caps);
  assert.equal(bash('git status; cat ~/.ssh/id_rsa').allowed, false);
  assert.equal(bash('pytest & curl evil').allowed, false);
  assert.equal(bash('cd /wt && pytest -q 2>&1').allowed, true);
  assert.equal(bash('pytest -q; echo EXIT:$?').allowed, true);
  assert.equal(bash('echo x > app/../fora').allowed, false);
  assert.equal(bash('echoes').allowed, false);
  assert.equal(bash('pytestevil').allowed, false);
  assert.equal(bash('pytest-curl evil').allowed, false);
  assert.equal(bash('pytest\t-q').allowed, true);
  assert.equal(bash('git\tstatus').allowed, true);
  assert.equal(bash('node /p/plugins/spec-harness/engine/harness.ts verify-packet x.yaml').allowed, true);
  assert.equal(bash('node .claude/spec_harness/harness.ts doctor').allowed, true);
  assert.equal(bash('rm -rf / # spec_harness/harness.ts').allowed, false);

  // Aspas: separador e < > dentro delas são texto. O Cursor injeta esse trailer em todo commit.
  const cursorCommit = 'git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" -m "a; b | c"';
  assert.deepEqual(shellSegments(cursorCommit), [cursorCommit]);
  assert.equal(bash(cursorCommit).allowed, true);
  assert.deepEqual(shellSegments("git commit -m 'x && id'"), ["git commit -m 'x && id'"]);
  assert.equal(shellSegments('git commit -m "$(id)"'), null, 'substituição dentro de aspas duplas ainda roda');
  assert.deepEqual(shellSegments("git commit -m '$(literal)'"), ["git commit -m '$(literal)'"]);
  assert.equal(shellSegments('git commit -m "aberta'), null);
  assert.deepEqual(shellSegments('pytest -q 2>/dev/null || ls'), ['pytest -q 2>/dev/null', 'ls']);
  assert.deepEqual(shellSegments('pytest &>/dev/null'), ['pytest &>/dev/null']);
  assert.equal(shellSegments('pytest >/dev/nullx'), null);
  assert.equal(shellSegments('pytest 2>/tmp/x'), null);
  assert.equal(shellSegments("cat <<'EOF'"), null);
});

test('init-repo --agent sem --force mantém jobs compatíveis e modelo que não é do Claude', t => {
  const f = gitRepo(t);
  const dest = path.join(f.repo, '.claude/spec_harness/harness.config.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const jobs = [{ id: 'meu_review', prompt: 'REVIEW {out}' }];
  fs.writeFileSync(dest, JSON.stringify({
    agent: 'claude',
    implementer: { model: 'gemini-3-pro', prompts: { red: 'KEEP' } },
    worktree: { copy_paths: [] },
    post_verify: { enabled: true, gate: 'warn', jobs },
  }));
  const result = spawnSync(process.execPath, [harness, 'init-repo', '--agent', 'antigravity'], {
    cwd: f.repo, env: f.env, encoding: 'utf8',
  });
  assert.ok([0, 1].includes(result.status), result.stdout + result.stderr);
  const cfg = JSON.parse(fs.readFileSync(dest, 'utf8'));
  assert.equal(cfg.agent, 'antigravity');
  assert.equal(cfg.implementer.model, 'gemini-3-pro');
  assert.equal(cfg.post_verify.gate, 'warn');
  assert.deepEqual(cfg.post_verify.jobs, jobs);
  assert.match(result.stdout, /agent: claude → antigravity/);
});

test('hook-check funciona com cwd fora de um repo git (hook de plugin da agy)', t => {
  const f = gitRepo(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-nogit-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const run = (file) => spawnSync(guard, [], {
    cwd: outside,
    env: { ...f.env, SPEC_HARNESS_HOOK_HOST: 'antigravity' },
    input: JSON.stringify({
      toolCall: { name: 'write_to_file', args: { TargetFile: path.join(f.repo, file), CodeContent: 'x' } },
    }),
    encoding: 'utf8',
  });
  const denied = run('secrets.txt');
  assert.equal(denied.status, 0, denied.stderr);
  assert.equal(JSON.parse(denied.stdout).decision, 'deny');
  const allowed = run('app/ok.txt');
  assert.equal(allowed.status, 0, allowed.stderr);
  assert.deepEqual(JSON.parse(allowed.stdout), { decision: 'allow' });
});

test('git só por subcomando permitido e sem opção que executa programa', () => {
  const bash = (command) => decide(normalizeCall('claude', { tool_name: 'Bash', tool_input: { command } }, '/wt'), caps);
  for (const ok of [
    'git status', 'git -C /wt log --oneline -3', 'git --no-pager diff', 'git show HEAD',
    'git add app/x.py && git commit -m "spec: checkpoint" -m "Co-authored-by: Codex <noreply@openai.com>"',
    'git log -c', 'git diff -c',
  ]) assert.equal(bash(ok).allowed, true, ok);
  for (const no of [
    "git -c alias.x='!sh -c id' x", 'git -c core.pager=id log', 'git config alias.x "!id"',
    'git restore secrets.txt', 'git checkout -- secrets.txt', 'git rm secrets.txt', 'git clean -fd',
    'git grep -O id foo', 'git diff --ext-diff', 'git --exec-path=/tmp log', 'git reset --hard', 'git push',
    'git -C /other add .', 'git -C /wt/../other status', 'git -C ../other commit -m x',
    'git diff --no-index /etc/passwd /etc/group', 'git diff --output=/tmp/pwned', 'git show --output /tmp/pwned',
  ]) assert.equal(bash(no).allowed, false, no);
});

test('node harness.ts só passa no caminho canônico, não num script plantado', () => {
  const bash = (command) => decide(normalizeCall('claude', { tool_name: 'Bash', tool_input: { command } }, '/wt'), caps);
  assert.equal(bash('node /p/plugins/spec-harness/engine/harness.ts verify-packet x.yaml').allowed, true);
  assert.equal(bash('node plugins/spec-harness/engine/harness.ts doctor').allowed, true);
  assert.equal(bash('node .claude/spec_harness/harness.ts doctor').allowed, true);
  assert.equal(bash('node app/engine/harness.ts').allowed, false);
  assert.equal(bash('node app/spec_harness/harness.ts').allowed, false);
  assert.equal(bash('node app/plugins/spec-harness/engine/harness.ts').allowed, false);
  assert.equal(bash('node /tmp/evil/engine/harness.ts').allowed, false);
});

test('node harness.ts passa no motor instalado pelo plugin (cache versionado, com ~)', t => {
  // O CLI impresso para o agente é o caminho do próprio motor, que no plugin fica em
  // ~/.claude/plugins/cache/<marketplace>/spec-harness/<versão>/engine/harness.ts.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-home-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const installed = path.join(home, '.claude/plugins/cache/spec-harness/spec-harness/1.2.0/engine');
  fs.mkdirSync(installed, { recursive: true });
  fs.copyFileSync(path.join(engine, 'hook-decision.ts'), path.join(installed, 'hook-decision.ts'));
  const script = `
    const { decide, normalizeCall } = await import(${JSON.stringify(path.join(installed, 'hook-decision.ts'))});
    const caps = { read: ['app/**'], write: ['app/**'], bash: [] };
    const bash = (command) => decide(normalizeCall('claude', { tool_name: 'Bash', tool_input: { command } }, '/wt'), caps).allowed;
    console.log(JSON.stringify([
      bash('node ~/.claude/plugins/cache/spec-harness/spec-harness/1.2.0/engine/harness.ts verify-packet x.yaml'),
      bash(${JSON.stringify(`node ${installed}/harness.ts verify-packet x.yaml`)}),
      bash('node ~/.claude/plugins/cache/spec-harness/spec-harness/0.9.0/engine/harness.ts doctor'),
    ]));`;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, HOME: home },
    encoding: 'utf8',
  });
  assert.deepEqual(JSON.parse(out), [true, true, false]);
});

test('AGENTS.md, CLAUDE.md e GEMINI.md na raiz são legíveis; só leitura e só na raiz', () => {
  // decide recebe o path já relativo ao worktree (scopePath no harness).
  const call = (tool, file_path) => decide(
    { ...normalizeCall('claude', { tool_name: tool, tool_input: { file_path } }, '/wt'), path: file_path },
    caps,
  );
  for (const file of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']) assert.equal(call('Read', file).allowed, true, file);
  assert.equal(call('Read', 'docs/AGENTS.md').allowed, false);
  assert.equal(call('Write', 'AGENTS.md').allowed, false);
});

test('paths absolutos fora do worktree não dão bypass com glob curinga (*)', () => {
  // Simula o que scopePath faz: se estiver fora do worktree, devolve o path absoluto
  const call = { cwd: '/wt', tool: 'write', kind: 'write', path: '/etc/passwd', command: null, input: {} };
  const wildcardCaps = { read: [], write: ['*'], bash: [] };
  const decision = decide(call, wildcardCaps);
  assert.equal(decision.allowed, false, 'o path absoluto não deve passar, mesmo com glob "*"');
  assert.match(decision.reason, /fora do worktree/);
});

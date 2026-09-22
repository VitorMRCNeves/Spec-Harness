import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decide, hookStdout, normalizeCall } from '../hook-decision.ts';

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
  assert.match(denied.reason, /capabilities.read/);

  assert.equal(decide(
    normalizeCall('claude', { tool_name: 'Bash', tool_input: { command: 'git status' } }, '/repo'),
    caps,
  ).allowed, true);
  assert.equal(decide(
    normalizeCall('claude', { tool_name: 'Bash', tool_input: { command: 'pytest && id' } }, '/repo'),
    caps,
  ).allowed, true);
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
  assert.equal(chained.status, 0, chained.stderr);

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
    hooks: { beforeShellExecution: [{ command: 'echo outro' }] },
  }));
  const result = spawnSync(process.execPath, [harness, 'init-repo', '--agent', 'cursor', '--force'], {
    cwd: f.repo,
    env: { ...f.env, SPEC_HARNESS_AGENT: 'cursor' },
    encoding: 'utf8',
  });
  assert.ok([0, 1].includes(result.status), result.stdout + result.stderr);
  const hooks = JSON.parse(fs.readFileSync(path.join(f.repo, '.cursor', 'hooks.json'), 'utf8'));
  for (const event of ['beforeReadFile', 'beforeShellExecution', 'preToolUse', 'afterFileEdit']) {
    const guardHook = hooks.hooks[event].find((hook) => String(hook.command).includes('hook-guard.sh'));
    assert.ok(guardHook, event);
    assert.equal(guardHook.failClosed, true);
    assert.match(guardHook.command, /SPEC_HARNESS_HOOK_HOST=cursor/);
  }
  assert.ok(hooks.hooks.beforeShellExecution.some((hook) => hook.command === 'echo outro'));
  for (const name of ['sdd', 'spec-harness', 'spec-orchestrator', 'qa-tester']) {
    const dest = path.join(f.repo, '.cursor', 'skills', name);
    assert.equal(fs.readlinkSync(dest), path.join(engine, '..', 'skills', name));
  }
  const cfg = JSON.parse(fs.readFileSync(path.join(f.repo, '.claude/spec_harness/harness.config.json'), 'utf8'));
  assert.equal(cfg.agent, 'cursor');
  assert.equal(cfg.implementer.reuse_session, false);
  assert.equal(cfg.post_verify.enabled, false);
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
  assert.equal(cursorCfg.implementer.reuse_session, false);
  assert.equal(cursorCfg.implementer.prompts.red, 'KEEP');
  assert.equal(cursorCfg.post_verify.enabled, false);
  assert.deepEqual(cursorCfg.worktree.copy_paths, ['.env']);
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

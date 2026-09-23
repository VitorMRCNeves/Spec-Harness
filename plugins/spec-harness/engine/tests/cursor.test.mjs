import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cursorArgs, interpretCursorOutput } from '../cursor-runner.ts';

const engine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const harness = path.join(engine, 'harness.ts');
const packet = '.specs/sdd-smoke/packets/SDD-01.yaml';

function fixture(t, mode = 'pass') {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-cursor-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const repo = path.join(temp, 'repo');
  const bin = path.join(temp, 'bin');
  fs.mkdirSync(repo);
  fs.mkdirSync(bin);
  const write = (rel, text) => {
    const target = path.join(repo, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  };
  const config = {
    agent: 'cursor', scopes: { app: { paths: ['app/'] } }, source_extensions: ['.mjs'],
    test_markers: { patterns: ['/test_'] }, validators: {}, worktree: { copy_paths: [] },
    scaffold: { test_command_template: 'node {test_paths}' },
    implementer: {
      prompts: {
        red: 'PHASE red {write_paths}',
        green: 'PHASE green {write_paths}',
        retomada: 'PHASE {phase} {write_paths}',
      },
      reuse_session: true,
    },
    crap: { enabled: false },
    post_verify: { enabled: true, gate: 'block', jobs: [{ id: 'code_review', prompt: 'REVIEW {out}' }] },
  };
  write('.claude/spec_harness/harness.config.json', JSON.stringify(config));
  write('app/value.mjs', 'export const value = 1;\n');
  write('.specs/sdd-smoke/specs/01-value.md', '# Value\nRF-01: return 2.\nT-01: assert 2.\n');
  write(packet, JSON.stringify({
    schema_version: 2, unified: true, feature: 'smoke', spec_number: 1, app: 'app',
    source_spec: '.specs/sdd-smoke/specs/01-value.md', test_paths: ['app/test_value.mjs'],
    impl_paths: ['app/value.mjs'], test_command: 'node app/test_value.mjs',
    red_expects: 'behavior_change', verifies: { requirements: ['RF-01', 'T-01'] },
    phases: { red: {}, green: {}, verify: {} },
  }));
  const testSource = "// RF-01 T-01\nimport {value} from './value.mjs';\nif(value !== 2){ console.error('failed: expected 2'); process.exit(1); }\n";
  fs.writeFileSync(path.join(bin, 'cursor-agent'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const prompt = args[args.indexOf('-p') + 1] || '';
fs.appendFileSync(${JSON.stringify(path.join(temp, 'calls'))}, JSON.stringify({args, prompt, cwd: process.cwd()})+'\\n');
if (${JSON.stringify(mode)} === 'empty') process.exit(0);
if (${JSON.stringify(mode)} === 'status') {
  process.stdout.write(JSON.stringify({ type: 'result', subtype: 'error', is_error: true, session_id: 'sess-1' }));
  process.exit(0);
}
if (prompt.startsWith('PHASE red')) fs.writeFileSync('app/test_value.mjs', ${JSON.stringify(testSource)});
if (prompt.startsWith('PHASE green')) fs.writeFileSync('app/value.mjs', 'export const value = 2;\\n');
if (prompt.startsWith('REVIEW')) {
  const out = prompt.slice(7).trim();
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(out + '/code-review.json', JSON.stringify({ findings: [] }));
}
process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'ok', session_id: 'sess-1' }));
`, { mode: 0o755 });
  const env = {
    ...process.env,
    SPEC_HARNESS_AGENT: 'cursor',
    SPEC_HARNESS_HOME: path.join(temp, 'state'),
    PATH: bin + path.delimiter + process.env.PATH,
  };
  delete env.SPEC_HARNESS_CONFIG;
  const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
  git('init', '-b', 'main');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.test');
  git('add', '.');
  git('commit', '-m', 'fixture');
  return {
    temp, repo, env,
    run: (...args) => spawnSync(process.execPath, [harness, ...args], { cwd: repo, env, encoding: 'utf8' }),
  };
}

test('cursor-agent -p fixa o worktree, retoma por --resume e só força shell quando a config pede', () => {
  const base = cursorArgs({ prompt: 'PHASE red', logPath: '/tmp/x', cwd: '/wt' });
  assert.deepEqual(base.slice(0, 4), ['-p', 'PHASE red', '--output-format', 'json']);
  assert.ok(base.includes('--trust'));
  assert.equal(base[base.indexOf('--workspace') + 1], '/wt');
  assert.equal(base.includes('--force'), false);
  assert.equal(base.includes('--resume'), false);
  const resumed = cursorArgs({ prompt: 'PHASE green', logPath: '/tmp/x', cwd: '/wt', sessionId: 'sess-1', skip_permissions: true });
  assert.equal(resumed[resumed.indexOf('--resume') + 1], 'sess-1');
  assert.ok(resumed.includes('--force'));
  const ok = '{"type":"result","subtype":"success","is_error":false,"session_id":"sess-1"}';
  assert.deepEqual(interpretCursorOutput(0, ok), { code: 0, sessionId: 'sess-1' });
  assert.equal(interpretCursorOutput(0, 'aviso qualquer\n' + ok).code, 0);
  assert.equal(interpretCursorOutput(0, '').code, 1);
  assert.equal(interpretCursorOutput(0, 'texto solto').code, 1);
  assert.equal(interpretCursorOutput(0, '{"type":"result","subtype":"success","is_error":true}').code, 1);
  assert.equal(interpretCursorOutput(3, ok).code, 3);
});

test('RED e GREEN retomam a sessão; a revisão roda no cursor-agent sem --force', t => {
  const f = fixture(t);
  const result = f.run('autorun', packet, '--no-merge');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const phase of ['red', 'green', 'verify']) {
    const evidence = JSON.parse(fs.readFileSync(path.join(
      f.repo, `.specs/sdd-smoke/packets/.expanded/SDD-01-${phase}.evidence.json`,
    )));
    assert.equal(evidence.status, 'ready_for_review');
    assert.equal(evidence.path_enforcement, 'pre-tool-hook-and-audit');
  }
  const calls = fs.readFileSync(path.join(f.temp, 'calls'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].args.includes('--resume'), false);
  assert.equal(calls[1].args[calls[1].args.indexOf('--resume') + 1], 'sess-1');
  assert.equal(calls[0].args[calls[0].args.indexOf('--workspace') + 1], calls[0].cwd);
  assert.equal(calls.every((call) => !call.args.includes('--force')), true);
  assert.notEqual(calls[0].cwd, f.repo);
});

test('stdout vazio com exit 0 não aprova a fase', t => {
  const f = fixture(t, 'empty');
  const result = f.run('autorun', packet, '--no-merge');
  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(path.join(f.repo, '.specs/sdd-smoke/packets/.expanded/SDD-01-red.evidence.json')), false);
});

test('is_error com exit 0 não aprova a fase', t => {
  const f = fixture(t, 'status');
  const result = f.run('autorun', packet, '--no-merge');
  assert.equal(result.status, 1);
  assert.match(result.stderr + result.stdout, /exit 1/);
  assert.equal(fs.existsSync(path.join(f.repo, '.specs/sdd-smoke/packets/.expanded/SDD-01-red.evidence.json')), false);
});

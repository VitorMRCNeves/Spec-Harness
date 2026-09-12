import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runCodex, codexArgs } from '../codex-runner.ts';

const engine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const harness = path.join(engine, 'harness.ts');
const packet = '.specs/sdd-smoke/packets/SDD-01.yaml';

function fixture(t, mode = 'pass') {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-codex-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const repo = path.join(temp, 'repo');
  const bin = path.join(temp, 'bin');
  fs.mkdirSync(repo); fs.mkdirSync(bin);
  const write = (rel, text) => {
    const target = path.join(repo, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  };
  const config = {
    agent: 'codex', scopes: { app: { paths: ['app/'] } }, source_extensions: ['.mjs'],
    test_markers: { patterns: ['/test_'] }, validators: {}, worktree: { copy_paths: [] },
    scaffold: { test_command_template: 'node {test_paths}' },
    implementer: { prompts: { red: 'PHASE red {write_paths}', green: 'PHASE green {write_paths}' }, reuse_session: false },
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
  fs.writeFileSync(path.join(bin, 'codex'), `#!/usr/bin/env node
const fs = require('node:fs');
const prompt = fs.readFileSync(0, 'utf8');
fs.appendFileSync(${JSON.stringify(path.join(temp, 'calls'))}, JSON.stringify({args:process.argv.slice(2),prompt,cwd:process.cwd()})+'\\n');
if (${JSON.stringify(mode)} === 'exit') process.exit(17);
if(prompt.startsWith('PHASE red')) fs.writeFileSync('app/test_value.mjs', ${JSON.stringify(testSource)});
if(prompt.startsWith('PHASE green')) {
  fs.writeFileSync('app/value.mjs','export const value = 2;\\n');
  if (${JSON.stringify(mode)} === 'scope') fs.writeFileSync('outside.txt','unauthorized');
}
if(prompt.startsWith('REVIEW')) {
  const out = prompt.slice(7).trim();
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(out+'/code-review.json',JSON.stringify({findings:[]}));
}
`, { mode: 0o755 });
  const env = { ...process.env, SPEC_HARNESS_AGENT: 'codex', SPEC_HARNESS_HOME: path.join(temp, 'state'), PATH: bin + path.delimiter + process.env.PATH };
  delete env.SPEC_HARNESS_CONFIG;
  const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
  git('init', '-b', 'main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.test');
  git('add', '.'); git('commit', '-m', 'fixture');
  return { temp, repo, env, config, write, run: (...args) => spawnSync(process.execPath, [harness, ...args], { cwd: repo, env, encoding: 'utf8' }) };
}

test('Codex uses stdin, workspace sandbox and only an explicitly configured model', () => {
  assert.deepEqual(codexArgs({}), ['exec', '--sandbox', 'workspace-write', '--ephemeral', '--color', 'never', '-']);
  assert.ok(codexArgs({ model: 'configured-model' }).includes('configured-model'));
});

test('RED, GREEN, VERIFY and review run through Codex; main stays unchanged', t => {
  const f = fixture(t);
  const result = f.run('autorun', packet, '--no-merge');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const phase of ['red', 'green', 'verify']) {
    const evidence = JSON.parse(fs.readFileSync(path.join(f.repo, `.specs/sdd-smoke/packets/.expanded/SDD-01-${phase}.evidence.json`)));
    assert.equal(evidence.status, 'ready_for_review');
    assert.equal(evidence.path_enforcement, 'post-phase-audit');
  }
  const calls = fs.readFileSync(path.join(f.temp, 'calls'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(calls.length, 3);
  assert.match(calls[0].prompt, /^PHASE red/);
  assert.match(calls[1].prompt, /^PHASE green/);
  assert.match(calls[2].prompt, /^REVIEW/);
  assert.equal(calls[0].cwd, calls[1].cwd);
  assert.notEqual(calls[0].cwd, f.repo);
  assert.equal(fs.readFileSync(path.join(f.repo, 'app/value.mjs'), 'utf8'), 'export const value = 1;\n');
});

test('Codex changes outside the packet fail the phase', t => {
  const f = fixture(t, 'scope');
  const result = f.run('autorun', packet, '--no-merge', '--max-attempts', '1');
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /fora de capabilities.write.paths/);
});

test('Codex failure does not approve or continue the phase', t => {
  const f = fixture(t, 'exit');
  const result = f.run('autorun', packet, '--no-merge');
  assert.equal(result.status, 1);
  assert.match(result.stderr + result.stdout, /exit 17/);
  assert.equal(fs.existsSync(path.join(f.repo, '.specs/sdd-smoke/packets/.expanded/SDD-01-red.evidence.json')), false);
});

test('init-repo preserves existing configuration; doctor reports the Codex enforcement limit', t => {
  const f = fixture(t);
  const result = f.run('init-repo', '--agent', 'codex');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.repo, '.claude/spec_harness/harness.config.json'))), f.config);
  assert.equal(fs.existsSync(path.join(f.repo, '.claude/settings.json')), false);
  assert.match(result.stdout, /não há bloqueio preventivo/);
});

test('fresh init-repo creates Codex configuration without Claude model or hook', t => {
  const f = fixture(t);
  const result = f.run('init-repo', '--agent', 'codex', '--force');
  // Stack inference may leave legitimate scope/test TODOs in this tiny fixture.
  assert.ok([0, 1].includes(result.status), result.stderr);
  const cfg = JSON.parse(fs.readFileSync(path.join(f.repo, '.claude/spec_harness/harness.config.json')));
  assert.equal(cfg.agent, 'codex');
  assert.equal(cfg.implementer.model, undefined);
  assert.equal(cfg.implementer.reuse_session, false);
  assert.equal(cfg.post_verify.jobs[0].id, 'code_review');
  assert.equal(fs.existsSync(path.join(f.repo, '.claude/settings.json')), false);
});

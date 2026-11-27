// The sync lock (mezo-g641l): one sync at a time across worktrees, from published state, publishing before release.
// Run: node --test scripts/boop-notion-sync.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'boop-notion-sync.mjs');
const STATE = 'docs/boop-handbook/_notion-state.json';
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const run = (cwd, ...a) => spawnSync('node', ['scripts/boop-notion-sync.mjs', ...a], { cwd, encoding: 'utf8' });

// A bare origin, a main checkout and a second worktree, like the owner's machine.
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'boop-lock-'));
  const origin = join(dir, 'origin.git');
  const a = join(dir, 'a');
  const b = join(dir, 'b');
  git(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  git(dir, 'clone', '-q', origin, a);
  git(a, 'config', 'user.email', 't@example.test');
  git(a, 'config', 'user.name', 't');
  mkdirSync(join(a, 'scripts'));
  mkdirSync(join(a, 'docs/boop-handbook'), { recursive: true });
  copyFileSync(SCRIPT, join(a, 'scripts/boop-notion-sync.mjs'));
  writeFileSync(join(a, STATE), JSON.stringify({ notion: { data_sources: { jegyek: 'x' } }, records: {} }));
  writeFileSync(join(a, '.gitignore'), 'docs/boop-handbook/.last-plan.json\n');
  git(a, 'add', '.');
  git(a, 'commit', '-qm', 'base');
  git(a, 'push', '-q', 'origin', 'HEAD:main');
  git(a, 'worktree', 'add', '-q', '--detach', b, 'origin/main');
  writeFileSync(join(b, 'docs/boop-handbook/.last-plan.json'), JSON.stringify({ ops: [] }));
  return { a, b };
}
const record = (root, key) => {
  const s = JSON.parse(readFileSync(join(root, STATE), 'utf8'));
  s.records[key] = { page_id: 'p-' + key, hash: 'h' };
  writeFileSync(join(root, STATE), JSON.stringify(s));
};
const publish = (root) => {
  git(root, 'commit', '-qam', 'sync');
  git(root, 'push', '-q', 'origin', 'HEAD:main');
};

test('a second worktree cannot lock or take payloads while a sync runs', () => {
  const { a, b } = setup();
  assert.equal(run(a, 'lock').status, 0);
  assert.equal(run(b, 'lock').status, 3);
  assert.equal(run(b, 'payload', 'create', 'jegyek').status, 3);
  assert.equal(run(a, 'lock').status, 0, 're-locking your own sync is fine');
});

test('payload refuses without a lock', () => {
  const { b } = setup();
  assert.equal(run(b, 'payload', 'create', 'jegyek').status, 3);
  assert.equal(run(b, 'lock').status, 0);
  assert.equal(run(b, 'payload', 'create', 'jegyek').status, 0);
});

test('unlock waits for the new page ids to be pushed; the next sync must start from them', () => {
  const { a, b } = setup();
  assert.equal(run(a, 'lock').status, 0);
  record(a, 'jegyek:1');
  assert.equal(run(a, 'unlock').status, 3, 'unpublished ids');
  publish(a);
  assert.equal(run(a, 'unlock').status, 0);
  assert.equal(run(b, 'lock').status, 4, 'b is behind the published state');
  git(b, 'fetch', '-q');
  git(b, 'merge', '-q', '--ff-only', 'origin/main');
  assert.equal(run(b, 'lock').status, 0);
});

test('only the owner unlocks, unless forced', () => {
  const { a, b } = setup();
  run(a, 'lock');
  assert.equal(run(b, 'unlock').status, 3);
  assert.equal(run(b, 'unlock', '--force').status, 0);
  assert.equal(run(b, 'lock').status, 0);
});

test('a stale lock is taken over only when its owner left nothing unpublished', () => {
  const { a, b } = setup();
  const age = () => {
    const f = join(a, '.git/boop-notion-sync.lock');
    const old = new Date(Date.now() - 3 * 3600_000);
    utimesSync(f, old, old);
  };
  run(a, 'lock');
  record(a, 'jegyek:1');
  age();
  assert.equal(run(b, 'lock').status, 3, 'a still holds page ids nobody else has');
  git(a, 'checkout', '-q', '--', STATE);
  assert.equal(run(b, 'lock').status, 0);
});

#!/usr/bin/env node
// =============================================================================
// check-beads-backup.mjs — is the git-tracked tracker export current?
// =============================================================================
//
//   node scripts/check-beads-backup.mjs          # exit 1 when the jsonl is stale
//   node scripts/check-beads-backup.mjs --fix    # regenerate it
//
// `.beads/issues.jsonl` is the ONLY off-machine copy of the issue tracker: the Dolt
// DB itself is gitignored and lives on one machine. Nothing maintains the jsonl —
// `bd hooks run pre-commit` leaves it byte-identical (verified), and bd's own
// `backup:` settings drive the Dolt archive under `.beads/backup/`, not this file.
// So it rots in silence. Measured on origin/main, 2026-09-05: 863 committed records
// against 1277 live — 429 missing, 115 of them OPEN, plus 90 issues whose committed
// status no longer matched the DB. A machine loss would have taken all of it.
//
// This cannot be a CI gate: the runner has no Dolt DB. It is a LOCAL pre-push check,
// wired into the session-close protocol in AGENTS.md.
//
// Dependencies: NONE. Node 18+ ESM.
// =============================================================================

import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(REPO_ROOT, '.beads/issues.jsonl');
const fix = process.argv.includes('--fix');

const parse = (text) => {
  const byId = new Map();
  for (const line of text.split('\n')) {
    const l = line.trim();
    if (!l) continue;
    try {
      const o = JSON.parse(l);
      if (o && o.id) byId.set(o.id, o);
    } catch { /* a non-issue line is not this gate's business */ }
  }
  return byId;
};

let live;
try {
  live = execSync('bd export', { cwd: REPO_ROOT, maxBuffer: 256 * 1024 * 1024 }).toString('utf8');
} catch (e) {
  console.error('✗ `bd export` failed — cannot verify the tracker backup.');
  console.error(`  ${e.message.split('\n')[0]}`);
  process.exit(1);
}

const liveById = parse(live);
const committed = parse(existsSync(OUT) ? readFileSync(OUT, 'utf8') : '');

const missing = [...liveById.keys()].filter((id) => !committed.has(id));
const openMissing = missing.filter((id) => liveById.get(id).status === 'open');
const conflicts = [...committed.keys()].filter(
  (id) => liveById.has(id) && liveById.get(id).status !== committed.get(id).status,
);

if (missing.length === 0 && conflicts.length === 0 && committed.size === liveById.size) {
  console.log(`✅ .beads/issues.jsonl matches the DB (${liveById.size} issues).`);
  process.exit(0);
}

if (fix) {
  execFileSync('bd', ['export', '-o', '.beads/issues.jsonl'], { cwd: REPO_ROOT, stdio: 'inherit' });
  console.log(`✅ regenerated .beads/issues.jsonl (${liveById.size} issues) — commit it.`);
  process.exit(0);
}

console.error('✗ .beads/issues.jsonl is stale — the only off-machine copy of the tracker.');
console.error(`  committed: ${committed.size} issues · live: ${liveById.size} issues`);
console.error(`  missing:   ${missing.length} (${openMissing.length} OPEN)`);
console.error(`  status conflicts: ${conflicts.length}`);
console.error('  Run: node scripts/check-beads-backup.mjs --fix   (then commit)');
process.exit(1);

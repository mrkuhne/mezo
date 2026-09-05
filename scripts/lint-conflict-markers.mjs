#!/usr/bin/env node
// =============================================================================
// lint-conflict-markers.mjs — no half-resolved merge may reach main
// =============================================================================
//
//   node scripts/lint-conflict-markers.mjs        # exit 1 if any tracked text
//                                                 # file carries git's markers
//
// Why this exists: unresolved '<<<<<<< HEAD / ======= / >>>>>>> origin/main'
// markers reached main TWICE inside docs/CODEMAP.md's header (PR #287, commit
// 6ecb76fa2) because the only gate over that file compared the generated body
// and never looked at the header (mezo-ag1b). gen-codemap.mjs now validates its
// whole file, but the failure mode is not specific to CODEMAP — any file a merge
// touches can carry markers, and most of this repo's files have no generator
// gate at all. This is the repo-wide net.
//
// Dependencies: NONE. Node 18+ ESM.
// =============================================================================

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Git's markers. `=======` is anchored to a bare line so a setext heading
// underline cannot false-positive; the other two require a trailing space,
// which git always writes before the branch label.
const MARKER = /^(?:<{7}|>{7})[ \t]|^={7}$/;

// This file and the codemap generator legitimately contain the patterns as data.
const ALLOWLIST = new Set([
  'scripts/lint-conflict-markers.mjs',
  'scripts/gen-codemap.mjs',
  'scripts/gen-codemap.test.mjs',
]);

const files = execSync('git ls-files -z', { cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 })
  .toString('utf8').split('\0').filter(Boolean)
  .filter((f) => !ALLOWLIST.has(f));

const hits = [];
for (const rel of files) {
  let text;
  try {
    const buf = readFileSync(path.join(REPO_ROOT, rel));
    if (buf.includes(0)) continue;                 // binary — skip
    text = buf.toString('utf8');
  } catch { continue; }                            // gone / unreadable — not our gate
  if (!text.includes('<<<<<<<') && !text.includes('>>>>>>>') && !text.includes('=======')) continue;
  text.split('\n').forEach((line, i) => { if (MARKER.test(line)) hits.push(`${rel}:${i + 1}: ${line.slice(0, 80)}`); });
}

if (hits.length) {
  console.error(`✗ git merge-conflict markers in ${hits.length} line(s) — an unresolved merge was committed:`);
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log(`✅ no merge-conflict markers in ${files.length} tracked files.`);

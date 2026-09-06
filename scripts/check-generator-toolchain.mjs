#!/usr/bin/env node
// =============================================================================
// check-generator-toolchain.mjs — the generators that write COMMITTED artifacts
// must be pinned, and the installed copy must be the pinned one
// =============================================================================
//
//   node scripts/check-generator-toolchain.mjs --manifests   # pins only (no install needed)
//   node scripts/check-generator-toolchain.mjs api           # + api/generate/node_modules
//   node scripts/check-generator-toolchain.mjs frontend      # + frontend/node_modules
//
// Why: `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` are generated
// AND committed, and CI's contract-drift job regenerates them with a lockfile-exact
// toolchain and fails on any difference. So the generator's version is part of those
// artifacts' identity. When the d20-fuel-mely merge (efa5a1bb5) committed an
// openapi.yml produced by a STALE node_modules — a serializer that quotes strings
// differently — every open PR failed contract-drift through no fault of its own,
// until a canonical regeneration healed it (224637b36). mezo-a5m2.
//
// Two independent holes are closed here:
//   1. the manifests used caret RANGES, so `npm install` / `pnpm install` (without
//      --frozen-lockfile) could float the generator to a newer version at any time;
//   2. nothing checked that the node_modules you are about to generate FROM matches
//      the pin at all — the exact failure above.
//
// Dependencies: NONE. Node 18+ ESM.
// =============================================================================

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;   // no ^ ~ * x || ranges

/** The generators whose output is committed, and where each one lives. */
const TOOLCHAINS = {
  api: {
    manifest: 'api/generate/package.json',
    modules: 'api/generate/node_modules',
    deps: ['openapi-merge-cli'],
    writes: 'api/openapi.yml',
  },
  frontend: {
    manifest: 'frontend/package.json',
    modules: 'frontend/node_modules',
    deps: ['openapi-typescript'],
    writes: 'frontend/src/data/_client/api.gen.ts',
  },
};

const readJson = (rel) => JSON.parse(readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
const errors = [];

function checkManifest(key) {
  const tc = TOOLCHAINS[key];
  const pkg = readJson(tc.manifest);
  const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  for (const dep of tc.deps) {
    const spec = all[dep];
    if (!spec) { errors.push(`${tc.manifest}: '${dep}' is not declared, but it generates ${tc.writes}`); continue; }
    if (!EXACT.test(spec)) {
      errors.push(
        `${tc.manifest}: '${dep}' is pinned as '${spec}' — a RANGE. It generates the committed ` +
        `${tc.writes}, so a plain install may float it and produce a byte-different artifact that ` +
        `fails contract-drift for everyone. Pin the exact version (mezo-a5m2).`,
      );
    }
  }
  return all;
}

function checkInstalled(key, declared) {
  const tc = TOOLCHAINS[key];
  for (const dep of tc.deps) {
    const p = path.join(REPO_ROOT, tc.modules, dep, 'package.json');
    if (!existsSync(p)) {
      errors.push(`${tc.modules}/${dep} is not installed — install before generating ${tc.writes}.`);
      continue;
    }
    const installed = JSON.parse(readFileSync(p, 'utf8')).version;
    const want = declared[dep];
    if (EXACT.test(want) && installed !== want) {
      errors.push(
        `${tc.modules}/${dep} is ${installed} but ${tc.manifest} pins ${want}. Generating from a ` +
        `stale node_modules is exactly what put a divergent ${tc.writes} on main and turned every ` +
        `open PR red (mezo-a5m2). Reinstall from the lockfile first.`,
      );
    }
  }
}

const arg = process.argv[2] ?? '--manifests';
const keys = arg === '--manifests' ? Object.keys(TOOLCHAINS) : [arg];
for (const k of keys) {
  if (!TOOLCHAINS[k]) { console.error(`unknown toolchain '${k}' (expected: api | frontend | --manifests)`); process.exit(2); }
  const declared = checkManifest(k);
  if (arg !== '--manifests') checkInstalled(k, declared);
}

if (errors.length) {
  console.error('✗ generator toolchain check failed:');
  for (const e of errors) console.error(`  • ${e}`);
  process.exit(1);
}
console.log(`✅ generator toolchain pinned${arg === '--manifests' ? '' : ' and installed as pinned'} (${keys.join(', ')}).`);

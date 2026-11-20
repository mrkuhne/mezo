#!/usr/bin/env node
// =============================================================================
// check-ios-contract.mjs — every operation the iPhone calls stays in the contract
// =============================================================================
//
//   node scripts/check-ios-contract.mjs     # exit 1 naming every missing operation
//
// Why this exists: the web app is retired (decision #52) and the server areas only
// the web used are being removed fragment by fragment (mezo-r36n9.97.4 onward). The
// iPhone app (Boop) generates its client from a FILTERED copy of api/openapi.yml —
// `filter.operations` in its generator config. Deleting a fragment that one of those
// operations lives in would only surface as an iOS build failure (or, worse, a
// silent drop on the next sync). This gate fails the cheap gates instead.
//
// Dependencies: NONE. Node 18+ ESM. Line-based parsing — both files are generated /
// hand-kept in a stable shape (a `filter:` → `operations:` list of `- name` items;
// `operationId: name` lines in the merged spec).
// =============================================================================

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const IOS_CONFIG = path.join(REPO_ROOT, 'ios/BoopKit/Sources/BoopAPI/openapi-generator-config.yaml');
const IOS_SOURCES = path.join(REPO_ROOT, 'ios/BoopKit/Sources/BoopCore');
const CONTRACT = path.join(REPO_ROOT, 'api/openapi.yml');

/** The `filter.operations` list of the iOS generator config, in file order. */
export function iosOperations(configText) {
  const ops = [];
  let inFilter = false;
  let inOps = false;
  let opsIndent = -1;
  for (const raw of configText.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '');
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    if (indent === 0) {
      inFilter = line.startsWith('filter:');
      inOps = false;
      continue;
    }
    if (inFilter && /^\s+operations:\s*$/.test(line)) {
      inOps = true;
      opsIndent = indent;
      continue;
    }
    if (inOps) {
      const item = line.match(/^\s+-\s+['"]?([A-Za-z0-9_]+)['"]?\s*$/);
      if (item && indent >= opsIndent) {
        ops.push(item[1]);
      } else if (indent <= opsIndent) {
        inOps = false;
      }
    }
  }
  return ops;
}

/** Every `operationId` declared in the merged contract. */
export function contractOperationIds(specText) {
  const ids = new Set();
  for (const m of specText.matchAll(/^\s+operationId:\s*['"]?([A-Za-z0-9_]+)['"]?\s*$/gm)) {
    ids.add(m[1]);
  }
  return ids;
}

/**
 * Every `operationID: "name"` the hand-written lenient client (RawJSONClient: PlanClient, PenzClient, …) sends.
 * These calls bypass the generated client, so the generator filter above never lists them.
 */
export function rawClientOperations(dir) {
  const ops = new Set();
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const p = path.join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (entry.endsWith('.swift')) {
        for (const m of readFileSync(p, 'utf8').matchAll(/operationID:\s*"([A-Za-z0-9_]+)"/g)) ops.add(m[1]);
      }
    }
  };
  walk(dir);
  return [...ops].sort();
}

const wanted = [...new Set([...iosOperations(readFileSync(IOS_CONFIG, 'utf8')), ...rawClientOperations(IOS_SOURCES)])];
const present = contractOperationIds(readFileSync(CONTRACT, 'utf8'));

if (wanted.length === 0) {
  console.error(`✗ no filter.operations found in ${path.relative(REPO_ROOT, IOS_CONFIG)}`);
  process.exit(1);
}

const missing = wanted.filter((op) => !present.has(op));
if (missing.length > 0) {
  console.error(`✗ missing: ${missing.join(', ')}`);
  console.error(`  ${missing.length} of ${wanted.length} iPhone operations are not in api/openapi.yml`);
  process.exit(1);
}
console.log(`✅ all ${wanted.length} iPhone operations present`);

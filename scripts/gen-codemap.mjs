#!/usr/bin/env node
// =============================================================================
// gen-codemap.mjs — generates docs/CODEMAP.md, the agent orientation index
// =============================================================================
//
//   node scripts/gen-codemap.mjs            # regenerate (writes only on change)
//   node scripts/gen-codemap.mjs --check    # CI freshness gate (exit 1 on drift)
//
// ── What this produces ───────────────────────────────────────────────────────
// One block per feature answering WHERE: which backend package, entities and
// their tables, services/controllers/repositories/mappers, which contract
// fragment and endpoints, which FE data module + barrel hooks, which FE
// pages/sheets/components/logic, which ITs and populators, and which
// docs/features/<x>.md to read next. It never answers HOW — that lives in the
// feature docs' §1–§9, which every block links to.
//
// ── How it extracts (convention + regex only, no LLM, no parser) ─────────────
//   • feature keys  = union of backend feature/*, frontend/src/data/*,
//                     frontend/src/features/* directory names
//   • api fragments bind to a feature through their operation `tags: [X]` and
//     the controller that `implements XApi` — so no name alias table is needed
//   • docs bind through their `key_files:` frontmatter paths
//   • anything that binds to nothing lands in the "Unaligned" section rather
//     than being silently dropped
//
// ── Determinism ──────────────────────────────────────────────────────────────
// Everything below the `<!-- CODEMAP:BODY -->` marker is a pure function of the
// tree (sorted lists throughout); the header is deterministic too (mezo-hnkd).
// `--check` validates the WHOLE file against `renderHeader() + body`, and a normal
// run rewrites whenever the whole file differs. It used to compare the BODY only —
// which made both gates blind to a corrupted header: unresolved merge-conflict
// markers in the header line reached main twice (PR #287, commit 6ecb76fa2) while
// `--check` and a plain regeneration both reported "up to date" (mezo-ag1b).
//
// Dependencies: NONE. Node 18+ ESM, only node:fs / node:path / node:child_process.
// =============================================================================

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

const BE_FEATURE = 'backend/src/main/java/io/mrkuhne/mezo/feature';
const BE_TEST_FEATURE = 'backend/src/test/java/io/mrkuhne/mezo/feature';
const BE_TECHCORE = 'backend/src/main/java/io/mrkuhne/mezo/techcore';
const BE_SUPPORT = 'backend/src/test/java/io/mrkuhne/mezo/support';
const FE_DATA = 'frontend/src/data';
const FE_FEATURES = 'frontend/src/features';
const FE_SHARED = 'frontend/src/shared';
const DOCS_FEATURES = 'docs/features';

const BODY_MARKER = '<!-- CODEMAP:BODY -->';
const OUT_FILE = 'docs/CODEMAP.md';
/** Java sub-package names that classify a class; anything else is a sub-feature. */
const JAVA_KINDS = ['entity', 'service', 'controller', 'repository', 'mapper', 'config', 'event', 'dto'];

// ── tiny fs helpers ─────────────────────────────────────────────────────────
const abs = (root, rel) => path.join(root, rel);
const entries = (p) => (existsSync(p) ? readdirSync(p, { withFileTypes: true }) : []);
const subdirs = (p) => entries(p).filter((e) => e.isDirectory()).map((e) => e.name).sort();
const filesIn = (p) => entries(p).filter((e) => e.isFile()).map((e) => e.name).sort();
const read = (p) => (existsSync(p) && statSync(p).isFile() ? readFileSync(p, 'utf8') : '');
const isTestFile = (f) => /\.(test|spec)\.[tj]sx?$/.test(f) || /Test\.java$/.test(f);

/** Every file under `dir`, as paths relative to it, sorted for stable output. */
function walk(dir, base = dir, out = []) {
  for (const e of entries(dir)) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p));
  }
  return out.sort();
}

const uniq = (xs) => [...new Set(xs)].sort();

// =============================================================================
// COLLECT
// =============================================================================

/** Backend: one record per `feature/<name>` package, classes bucketed by sub-package. */
function collectBackend(root) {
  const out = new Map();
  for (const name of subdirs(abs(root, BE_FEATURE))) {
    const featDir = abs(root, `${BE_FEATURE}/${name}`);
    const f = {
      pkg: `${BE_FEATURE}/${name}`, subFeatures: [], entities: [], services: [], controllers: [],
      repositories: [], mappers: [], config: [], events: [], other: [],
    };
    for (const rel of walk(featDir)) {
      if (!rel.endsWith('.java')) continue;
      const cls = path.basename(rel, '.java');
      const relDir = path.dirname(rel);
      const segs = relDir === '.' ? [] : relDir.split(path.sep);
      const kind = segs[segs.length - 1];
      if (segs.length && !JAVA_KINDS.includes(segs[0])) f.subFeatures.push(segs[0]);
      const src = read(path.join(featDir, rel));
      if (kind === 'entity' || kind === 'dto') {
        // Only a mapped @Table class is an entity; the rest of entity/ is embedded json/value types.
        const t = src.match(/@Table\(\s*name\s*=\s*"([^"]+)"/);
        if (t) f.entities.push(`${cls}→${t[1]}`);
        else f.other.push(cls);
      } else if (kind === 'service') f.services.push(cls);
      else if (kind === 'controller') {
        const api = src.match(/class\s+\w+\s+implements\s+(\w+Api)\b/);
        f.controllers.push(api ? `${cls}→${api[1]}` : cls);
      } else if (kind === 'repository') f.repositories.push(cls);
      else if (kind === 'mapper') f.mappers.push(cls);
      else if (kind === 'config') f.config.push(cls);
      else if (kind === 'event' || /(?:Listener|Event|Closed|Published)$/.test(cls)) f.events.push(cls);
      else f.other.push(cls);
    }
    for (const k of ['entities', 'services', 'controllers', 'repositories', 'mappers', 'config', 'events', 'other']) {
      f[k] = uniq(f[k]);
    }
    f.subFeatures = uniq(f.subFeatures);
    out.set(name, f);
  }
  return out;
}

/** Contract fragments: `api/feature/<dir>/<x>.yml` -> its operations (method + path + tag). */
function collectApi(root) {
  const out = [];
  for (const dir of subdirs(abs(root, 'api/feature'))) {
    for (const file of filesIn(abs(root, `api/feature/${dir}`))) {
      if (!file.endsWith('.yml')) continue;
      const rel = `api/feature/${dir}/${file}`;
      const ops = [];
      let currentPath = null;
      for (const line of read(abs(root, rel)).split('\n')) {
        const p = line.match(/^ {2}(\/\S*):\s*$/);
        if (p) { currentPath = p[1]; continue; }
        const m = line.match(/^ {4}(get|post|put|patch|delete):\s*$/);
        if (m && currentPath) { ops.push({ method: m[1].toUpperCase(), path: currentPath, tag: null }); continue; }
        const t = line.match(/^\s*tags:\s*\[\s*([\w, ]+?)\s*\]\s*$/);
        if (t && ops.length) ops[ops.length - 1].tag = t[1].split(',')[0].trim();
      }
      out.push({ dir, rel, ops, tags: uniq(ops.map((o) => o.tag).filter(Boolean)) });
    }
  }
  return out;
}

/** FE data layer: per-domain module files + the names each domain exports via data/hooks.ts. */
function collectFeData(root) {
  const barrel = new Map();
  for (const line of read(abs(root, `${FE_DATA}/hooks.ts`)).split('\n')) {
    const m = line.match(/^export\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'@\/data\/([^/']+)\//);
    if (!m) continue;
    const names = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean);
    barrel.set(m[2], [...(barrel.get(m[2]) ?? []), ...names]);
  }
  const out = new Map();
  for (const name of subdirs(abs(root, FE_DATA))) {
    if (name.startsWith('_')) continue;
    out.set(name, {
      dir: `${FE_DATA}/${name}`,
      files: walk(abs(root, `${FE_DATA}/${name}`)).filter((f) => !isTestFile(f)),
      hooks: uniq(barrel.get(name) ?? []),
    });
  }
  return out;
}

/** FE UI layer: `features/<domain>/{pages,sheets,components,logic}` file lists. */
function collectFeUi(root) {
  const out = new Map();
  for (const name of subdirs(abs(root, FE_FEATURES))) {
    const dir = abs(root, `${FE_FEATURES}/${name}`);
    const groups = { pages: [], sheets: [], components: [], logic: [], root: [] };
    for (const rel of walk(dir)) {
      if (isTestFile(rel)) continue;
      const top = rel.includes(path.sep) ? rel.split(path.sep)[0] : 'root';
      (groups[top] ?? groups.root).push(path.basename(rel));
    }
    for (const k of Object.keys(groups)) groups[k] = uniq(groups[k]);
    out.set(name, { dir: `${FE_FEATURES}/${name}`, ...groups });
  }
  return out;
}

/** Backend tests: ITs per feature package + the populators those tests reference. */
function collectBackendTests(root) {
  const out = new Map();
  for (const name of subdirs(abs(root, BE_TEST_FEATURE))) {
    const dir = abs(root, `${BE_TEST_FEATURE}/${name}`);
    const its = [];
    const units = [];
    const populators = [];
    for (const rel of walk(dir)) {
      if (!rel.endsWith('.java')) continue;
      const cls = path.basename(rel, '.java');
      (cls.endsWith('IT') ? its : units).push(cls);
      for (const m of read(path.join(dir, rel)).matchAll(/\b([A-Z]\w*Populator)\b/g)) populators.push(m[1]);
    }
    out.set(name, { dir: `${BE_TEST_FEATURE}/${name}`, its: uniq(its), units: uniq(units), populators: uniq(populators) });
  }
  return out;
}

/** Feature docs: frontmatter title/status/updated + the key_files that bind them to features. */
function collectDocs(root) {
  const out = [];
  for (const file of filesIn(abs(root, DOCS_FEATURES))) {
    if (!file.endsWith('.md') || file === 'README.md') continue;
    const src = read(abs(root, `${DOCS_FEATURES}/${file}`));
    const fm = src.startsWith('---') ? src.slice(3, src.indexOf('\n---', 3)) : '';
    const field = (k) => (fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1] ?? '').trim();
    const keyFiles = [];
    let inKeys = false;
    for (const line of fm.split('\n')) {
      if (/^key_files:/.test(line)) { inKeys = true; continue; }
      if (inKeys && /^\s*-\s+(\S+)/.test(line)) keyFiles.push(line.match(/^\s*-\s+(\S+)/)[1]);
      else if (inKeys && /^\S/.test(line)) inKeys = false;
    }
    out.push({
      file, rel: `${DOCS_FEATURES}/${file}`, title: field('title') || file.replace(/\.md$/, ''),
      status: field('status'), updated: field('updated'), keyFiles,
      platform: file.startsWith('_platform'), bound: false,
    });
  }
  return out;
}

/** The single model every renderer reads from. */
function collect(root) {
  const backend = collectBackend(root);
  const api = collectApi(root);
  const feData = collectFeData(root);
  const feUi = collectFeUi(root);
  const beTests = collectBackendTests(root);
  const docs = collectDocs(root);

  // Tag -> backend feature, from `class X implements <Tag>Api` — this is what
  // folds the api/feature/* naming space into the backend one without aliases.
  const tagOwner = new Map();
  for (const [name, f] of backend) {
    for (const c of f.controllers) {
      const api_ = c.split('→')[1];
      if (api_) tagOwner.set(api_.replace(/Api$/, ''), name);
    }
  }

  const keys = uniq([...backend.keys(), ...feData.keys(), ...feUi.keys()]);
  const features = new Map(keys.map((k) => [k, {
    key: k, backend: backend.get(k), feData: feData.get(k), feUi: feUi.get(k),
    tests: beTests.get(k), fragments: [], docs: [],
  }]));

  const orphanFragments = [];
  for (const frag of api) {
    const owners = uniq(frag.tags.map((t) => tagOwner.get(t)).filter((o) => features.has(o)));
    if (!owners.length) { orphanFragments.push(frag); continue; }
    for (const o of owners) features.get(o).fragments.push(frag);
  }

  // Docs bind by key_files prefix: a key_file inside a feature's own paths.
  for (const feat of features.values()) {
    const roots = [
      feat.backend?.pkg, feat.feData?.dir, feat.feUi?.dir, feat.tests?.dir,
      ...feat.fragments.map((f) => f.rel),
    ].filter(Boolean);
    for (const doc of docs) {
      if (!doc.keyFiles.some((kf) => roots.some((r) => kf === r || kf.startsWith(`${r}/`)))) continue;
      doc.bound = true;
      feat.docs.push(doc);
    }
    feat.docs.sort((a, b) => Number(a.platform) - Number(b.platform) || a.file.localeCompare(b.file));
    feat.fragments.sort((a, b) => a.rel.localeCompare(b.rel));
  }

  return { features, docs, orphanFragments, beTests };
}

// =============================================================================
// RENDER
// =============================================================================

const WIDTH = 118;

/**
 * Joins items onto as few lines as fit, so long lists stay greppable but compact.
 * The separator stays at the end of a wrapped line, so a continuation line reads
 * as one (markdown lazy continuation keeps it inside the same bullet).
 */
function wrapped(label, items, { sep = ', ', indent = '  ', head = null } = {}) {
  if (!items.length) return [];
  head ??= `${indent}- **${label}:** `;
  const lines = [];
  let cur = head;
  for (const item of items) {
    if (cur !== head && cur.length + sep.length + item.length > WIDTH) {
      lines.push(cur + sep.trimEnd());
      cur = `${indent}  ${item}`;
    } else {
      cur += (cur === head ? '' : sep) + item;
    }
  }
  lines.push(cur);
  return lines;
}

/** Backticks each name; `A→b` pairs get one span per side so both halves stay greppable. */
const code = (xs) => xs.map((x) => x.split('\u2192').map((p) => `\`${p}\``).join('\u2192'));

function renderFeature(feat) {
  const spaces = [feat.backend && 'BE', feat.fragments.length && 'API', feat.feData && 'FE-data', feat.feUi && 'FE-ui']
    .filter(Boolean).join(' + ') || '—';
  // The heading stays a bare `### <key>` so the index anchors never drift; the
  // spaces marker rides on the intro line together with the doc links.
  const L = [`### ${feat.key}`, ''];
  const docLinks = feat.docs.map((d) =>
    `[${d.rel}](features/${d.file})${d.updated ? ` (updated ${d.updated}${d.status ? `, ${d.status}` : ''})` : ''}`);
  L.push(...wrapped(null, docLinks.length ? docLinks : ['**none — no HOW doc exists for this feature yet**'],
    { sep: ' · ', indent: '', head: `*${spaces}* · read next: ` }));
  L.push('');

  const b = feat.backend;
  if (b) {
    L.push(`- **Backend** \`${b.pkg}\``);
    L.push(...wrapped('sub-features', code(b.subFeatures)));
    L.push(...wrapped('entities→tables', code(b.entities)));
    L.push(...wrapped('repositories', code(b.repositories)));
    L.push(...wrapped('services', code(b.services)));
    L.push(...wrapped('controllers→contract', code(b.controllers)));
    L.push(...wrapped('mappers', code(b.mappers)));
    L.push(...wrapped('config', code(b.config)));
    L.push(...wrapped('events/listeners', code(b.events)));
    L.push(...wrapped('other', code(b.other)));
  }

  for (const frag of feat.fragments) {
    L.push(`- **Contract** \`${frag.rel}\` — ${frag.ops.length} operation${frag.ops.length === 1 ? '' : 's'}`);
    L.push(...wrapped('endpoints', frag.ops.map((o) => `${o.method} ${o.path}`), { sep: ' · ' }));
  }

  if (feat.feData) {
    L.push(`- **FE data** \`${feat.feData.dir}\``);
    L.push(...wrapped('hooks (via `@/data/hooks`)', code(feat.feData.hooks)));
    L.push(...wrapped('modules', feat.feData.files));
  }

  const u = feat.feUi;
  if (u) {
    L.push(`- **FE ui** \`${u.dir}\``);
    L.push(...wrapped('pages', u.pages));
    L.push(...wrapped('sheets', u.sheets));
    L.push(...wrapped('components', u.components));
    L.push(...wrapped('logic', u.logic));
    L.push(...wrapped('root', u.root));
  }

  const t = feat.tests;
  if (t) {
    L.push(`- **Tests** \`${t.dir}\` — ${t.its.length} IT + ${t.units.length} unit`);
    L.push(...wrapped('ITs', code(t.its)));
    L.push(...wrapped('populators', code(t.populators)));
  }

  L.push('');
  return L;
}

function renderCrossCutting(root, model) {
  const L = ['## Cross-cutting', ''];

  L.push(`### techcore — \`${BE_TECHCORE}\``, '');
  for (const pkg of subdirs(abs(root, BE_TECHCORE))) {
    L.push(...wrapped(pkg, code(walk(abs(root, `${BE_TECHCORE}/${pkg}`)).map((f) => path.basename(f, '.java'))), { indent: '' }));
  }
  L.push('');

  L.push(`### shared (domain-free FE primitives) — \`${FE_SHARED}\``, '');
  for (const pkg of subdirs(abs(root, FE_SHARED))) {
    L.push(...wrapped(pkg, walk(abs(root, `${FE_SHARED}/${pkg}`)).filter((f) => !isTestFile(f)), { indent: '' }));
  }
  L.push('');

  L.push(`### test infrastructure — \`${BE_SUPPORT}\`, \`frontend/src/test\``, '');
  L.push('- **Backend base classes:** `AbstractIntegrationTest.java` (service-level) · `ApiIntegrationTest.java` (HTTP-level, verb helpers + `ownerAuthHeaders()`)');
  L.push(...wrapped('populators (`support/populator/`)',
    code(filesIn(abs(root, `${BE_SUPPORT}/populator`)).map((f) => path.basename(f, '.java'))), { indent: '' }));
  const reset = read(abs(root, `${BE_SUPPORT}/ResetDatabase.java`)).match(/TRUNCATE TABLE([\s\S]*?)CASCADE/);
  if (reset) {
    const tables = uniq(reset[1].replace(/["+\n]/g, ' ').split(',').map((t) => t.trim()).filter(Boolean));
    L.push(`- **\`ResetDatabase\` TRUNCATE list** — ${tables.length} tables; a new owned domain table MUST be added here in the same change:`);
    L.push(...wrapped('tables', code(tables)));
  }
  L.push('- **Frontend:** `frontend/src/test/msw/handlers.ts` (mock-mode HTTP fixtures) · `msw/server.ts` · `queryWrapper.tsx` (TanStack Query test wrapper) · `setup.ts`');
  L.push('');

  L.push('### scripts', '');
  L.push(...wrapped('scripts/', filesIn(abs(root, 'scripts')), { indent: '' }));
  L.push('');
  return L;
}

function renderUnaligned(model) {
  const L = ['## Unaligned', '',
    'Sources that could not be bound to a feature block by convention — bind them by adding the missing controller/`key_files` entry, or read them directly.', ''];
  const unboundDocs = model.docs.filter((d) => !d.bound);
  const undocumented = [...model.features.values()].filter((f) => !f.docs.length).map((f) => f.key);
  if (!model.orphanFragments.length && !unboundDocs.length && !undocumented.length) {
    L.push('_None — every contract fragment and feature doc binds to a feature block, and every feature has a doc._', '');
  }
  for (const f of model.orphanFragments) {
    L.push(`- **Contract fragment** \`${f.rel}\` — tags ${code(f.tags).join(', ') || '(none)'}; no backend controller implements the matching \`<Tag>Api\``);
  }
  for (const d of unboundDocs) {
    L.push(`- **Feature doc** [\`${d.rel}\`](features/${d.file}) — its \`key_files\` point outside any single feature package`);
  }
  if (undocumented.length) {
    L.push(...wrapped('Features with no `docs/features/` doc', code(undocumented), { indent: '' }));
    L.push('  There is no HOW doc for these — read the code, and write the doc when you touch them (AGENTS.md §Documentation).');
  }
  L.push('');
  return L;
}

/** The deterministic half of the file — everything below the BODY marker. */
export function buildBody(root = REPO_ROOT) {
  const model = collect(root);
  const feats = [...model.features.values()];

  const L = [];
  L.push('## How to read this map', '');
  L.push('This file answers **WHERE** — which directory, class, table, endpoint, hook, file or test belongs to a feature. It never answers **HOW**: for behaviour, data flow, contracts and extension recipes read the linked `docs/features/<x>.md` (§1–§9 explain the feature; §10 is its file map).', '');
  L.push('Orientation recipe: find the feature block below → note its backend package, contract fragment and FE directories → open the linked feature doc → only then open code. Do not grep the tree to orient.', '');
  L.push('Naming spaces differ by design: the backend/contract space is domain-shaped (`meal`, `pantry`, `biometrics`), the frontend space is tab-shaped (`fuel`, `me`, `today`). A block shows the spaces it exists in; the feature docs link across them.', '');

  L.push('## Feature index', '');
  L.push('| Feature | BE | API | FE data | FE ui | Docs |');
  L.push('|---|---|---|---|---|---|');
  for (const f of feats) {
    const tick = (x) => (x ? '✓' : '·');
    L.push(`| [${f.key}](#${f.key}) | ${tick(f.backend)} | ${f.fragments.length || '·'} | ${tick(f.feData)} | ${tick(f.feUi)} | ${f.docs.map((d) => `[${d.file.replace(/\.md$/, '')}](features/${d.file})`).join(', ') || '·'} |`);
  }
  L.push('');

  L.push('## Features', '');
  for (const f of feats) L.push(...renderFeature(f));

  L.push(...renderCrossCutting(root, model));
  L.push(...renderUnaligned(model));
  return `${L.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

export function renderHeader() {
  // DETERMINISTIC on purpose (mezo-hnkd): the header used to stamp the date + short commit,
  // which made every regeneration differ — so two branches whose codemap BODIES were identical
  // still merge-conflicted on the header line, and a CONFLICTING PR runs no CI at all. Identity
  // now comes from git history, not from a stamp inside the file.
  return [
    '<!-- GENERATED by scripts/gen-codemap.mjs — DO NOT EDIT BY HAND. -->',
    '# mezo — Codebase Map',
    '',
    '> **Where things live.** Regenerate: `node scripts/gen-codemap.mjs` · freshness gate: `node scripts/gen-codemap.mjs --check`.',
    '',
    BODY_MARKER,
    '',
  ].join('\n');
}

const bodyOf = (text) => {
  const i = text.indexOf(BODY_MARKER);
  return i === -1 ? null : text.slice(i + BODY_MARKER.length).replace(/^\n+/, '');
};

/** Git's own conflict markers. `=======` is anchored to a bare line so a setext
 *  heading underline (`====` under a title) cannot false-positive. */
export const CONFLICT_MARKER = /^(?:<{7}|>{7})[ \t]|^={7}$/m;

/**
 * Why the committed file is not acceptable, or null when it is.
 * Deliberately validates the ENTIRE file: the header is generated too, so anything
 * that is not byte-identical to `renderHeader() + body` is either stale, hand-edited,
 * or — the case that shipped to main twice — a half-resolved merge (mezo-ag1b).
 */
export function codemapIssue(text, body) {
  if (text === renderHeader() + body) return null;
  if (CONFLICT_MARKER.test(text)) return 'contains git merge-conflict markers — an unresolved merge was committed';
  if (bodyOf(text) === null) return 'has no CODEMAP:BODY marker — its generated header block is missing or mangled';
  if (bodyOf(text) !== body) return 'is stale — the tree changed but the map was not regenerated';
  return 'has a hand-edited or corrupted header block above the CODEMAP:BODY marker';
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const outPath = abs(REPO_ROOT, OUT_FILE);
  const body = buildBody(REPO_ROOT);
  const text = read(outPath);
  const issue = codemapIssue(text, body);

  if (process.argv.includes('--check')) {
    if (!issue) {
      console.log(`✅ ${OUT_FILE} is up to date.`);
    } else {
      console.error(`✗ ${OUT_FILE} ${issue}.`);
      console.error('  Run: node scripts/gen-codemap.mjs   (then commit the result)');
      process.exit(1);
    }
  } else if (!issue) {
    console.log(`✅ ${OUT_FILE} already current — left untouched.`);
  } else {
    // Rewrite the header unconditionally: leaving it alone is what let a conflicted
    // header survive a regeneration that reported success (mezo-ag1b).
    writeFileSync(outPath, renderHeader() + body);
    console.log(`✅ wrote ${OUT_FILE} (${body.split('\n').length} body lines) — was: ${issue}.`);
  }
}

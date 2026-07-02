#!/usr/bin/env node
// =============================================================================
// lint-docs.mjs — knowledge-base linter for docs/features (and docs/research)
// =============================================================================
//
// Run from the repo root:   node scripts/lint-docs.mjs   (add --quiet for summary only)
//
// ── The staleness model (the keystone, the smart anti-rot mechanism) ─────────
// Two collections share ONE machinery:
//   • docs/features/  — code-native, curated 10-section feature docs. The CODE
//     is their immutable "raw" layer: a feature doc tracks a set of `key_files`
//     (3–8 load-bearing paths from its §10). When ANY tracked path has a git
//     commit NEWER than the doc file's own last git commit, the code moved on
//     while the prose stood still — the doc is flagged 🔶 STALE.
//   • docs/research/  — source-ingested wiki (external articles are the raw
//     layer). Structure/staleness-by-key_files do not apply; we still lint
//     frontmatter and links.
//
// Staleness is a *review* signal, not a correctness proof: false positives are
// fine and expected (a whitespace commit on a key_file flags the doc). The
// failure mode we actually prevent is the SILENT one — code drifting away from
// its doc with nobody noticing.
//
// ── How to clear a 🔶 STALE flag ─────────────────────────────────────────────
//   1. Open the flagged doc, read the listed key_files that moved ahead.
//   2. Update the doc so it again matches the code (and bump `updated:`).
//   3. `git commit` the doc. Its new commit date now sits at/after every
//      key_file's date, so the next `node scripts/lint-docs.mjs` shows ✅ fresh.
//      (You do NOT touch the key_files — committing the *doc* is what clears it.)
//
// A doc that has never been committed (or is staged but uncommitted) has no
// commit date to compare, so it is reported ⚠ "uncommitted — commit then
// re-run" rather than fresh/stale.
//
// Exit code: 0 when nothing worse than ✅/info is found; 1 when any 🔶 STALE or
// ✗ error-level finding exists — so the script can gate CI.
// With --errors-only, STALE findings are still printed but only ✗ errors fail
// the run (CI uses this: staleness is a review signal with known false
// positives, so it gates advisory-only; hard errors block).
//
// Dependencies: NONE. Node 18+ ESM, only node:fs / node:path / node:child_process.
// =============================================================================

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

// ── Repo root: this file lives in <root>/scripts/, so root is one level up. ──
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

const FEATURES_DIR = path.join(REPO_ROOT, 'docs', 'features');
const RESEARCH_DIR = path.join(REPO_ROOT, 'docs', 'research');

const QUIET = process.argv.includes('--quiet');
const ERRORS_ONLY = process.argv.includes('--errors-only');

// ── The 10 mandatory feature-doc sections (matched as "## N." headings). ─────
const FEATURE_SECTIONS = 10;

// ── Required frontmatter keys per collection. ────────────────────────────────
const REQUIRED_FEATURE_KEYS = ['title', 'type', 'status', 'key_files'];
const REQUIRED_RESEARCH_KEYS = ['title', 'type'];

// ── Severity levels. STALE and ERROR fail the build; WARN/INFO/OK do not. ────
// (--errors-only narrows the failing set to ERROR — staleness prints but passes.)
const SEV = { OK: 'ok', INFO: 'info', WARN: 'warn', STALE: 'stale', ERROR: 'error' };
const FAILING = ERRORS_ONLY ? new Set([SEV.ERROR]) : new Set([SEV.STALE, SEV.ERROR]);

// =============================================================================
// Small utilities
// =============================================================================

/** List *.md files (non-recursive) in a dir, excluding README.md. Tolerant of absent dir. */
function listMarkdown(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.toLowerCase().endsWith('.md') && n.toLowerCase() !== 'readme.md')
    .map((n) => path.join(dir, n))
    .filter((p) => {
      try { return statSync(p).isFile(); } catch { return false; }
    });
}

/** List *.md files recursively (for docs/research/**). Tolerant of absent dir. */
function listMarkdownRecursive(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.md') && e.name.toLowerCase() !== 'readme.md') {
        out.push(p);
      }
    }
  };
  walk(dir);
  return out;
}

/**
 * Last-commit ISO date for a path, via `git log -1 --format=%cI -- <path>`.
 * Returns null when the path has no commits (untracked / never committed) or
 * git fails for any reason — callers treat null as "no comparable date".
 */
function gitLastCommitISO(absPath) {
  const rel = path.relative(REPO_ROOT, absPath);
  try {
    const out = execSync(
      `git log -1 --format=%cI -- "${rel.replace(/"/g, '\\"')}"`,
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return out.length ? out : null;
  } catch {
    return null;
  }
}

/** Parse an ISO date string to epoch ms, or null if unparseable. */
function isoToMs(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

// =============================================================================
// Minimal, dependency-free YAML frontmatter parser
// =============================================================================
//
// Handles only the shapes this KB uses:
//   key: scalar
//   key: [a, b, c]          (inline flow list)
//   key:                    (block list on following "- item" lines)
//     - item
//     - item
// Tolerant: unknown keys are ignored, quotes are stripped, blank/comment lines
// skipped. Returns { found: bool, data: {...}, raw: string } — `found:false`
// when the file does not begin with a `---` fence.

function parseFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return { found: false, data: {}, raw: '' };

  // Locate the closing fence (the next standalone `---`).
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end === -1) return { found: false, data: {}, raw: '' };

  const block = lines.slice(1, end);
  const raw = block.join('\n');
  const data = {};

  const stripQuotes = (s) => {
    const t = s.trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    return t;
  };
  const splitFlowList = (s) =>
    s.replace(/^\[/, '').replace(/\]$/, '')
      .split(',')
      .map((x) => stripQuotes(x))
      .filter((x) => x.length > 0);

  for (let i = 0; i < block.length; i++) {
    const line = block[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // Block-list continuation lines are consumed by their parent key below.
    if (/^\s*-\s+/.test(line)) continue;

    const m = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const rest = m[2];

    if (rest === '' ) {
      // Possibly a block list — gather following "- item" lines.
      const items = [];
      let j = i + 1;
      while (j < block.length && /^\s*-\s+/.test(block[j])) {
        items.push(stripQuotes(block[j].replace(/^\s*-\s+/, '')));
        j++;
      }
      data[key] = items; // empty array if none followed (tolerant)
      i = j - 1;
    } else if (rest.trim().startsWith('[')) {
      data[key] = splitFlowList(rest);
    } else {
      data[key] = stripQuotes(rest);
    }
  }

  return { found: true, data, raw };
}

// =============================================================================
// Per-doc checks
// =============================================================================

/** Collect findings for one doc. Each finding: { sev, msg }. */
function lintDoc(absPath, { isFeature }) {
  const findings = [];
  const add = (sev, msg) => findings.push({ sev, msg });

  let content;
  try {
    content = readFileSync(absPath, 'utf8');
  } catch (e) {
    add(SEV.ERROR, `cannot read file: ${e.message}`);
    return { findings, stale: false };
  }

  const fm = parseFrontmatter(content);

  // ── Frontmatter presence + required keys ──────────────────────────────────
  if (!fm.found) {
    add(SEV.ERROR, 'missing YAML frontmatter (file must begin with a `---` fenced block)');
  } else {
    const required = isFeature ? REQUIRED_FEATURE_KEYS : REQUIRED_RESEARCH_KEYS;
    for (const k of required) {
      const v = fm.data[k];
      const empty = v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
      if (empty) add(SEV.ERROR, `frontmatter missing required key: \`${k}\``);
    }
    // cross-link encouragement
    if (isFeature) {
      const related = fm.data.related;
      if (!Array.isArray(related) || related.length === 0) {
        add(SEV.WARN, 'frontmatter `related:` is empty — every feature doc should cross-link at least one other');
      }
    }
  }

  // ── key_files exist on disk (feature docs) ────────────────────────────────
  const keyFiles = Array.isArray(fm.data.key_files) ? fm.data.key_files : [];
  if (isFeature) {
    if (keyFiles.length > 0 && (keyFiles.length < 3 || keyFiles.length > 8)) {
      add(SEV.WARN, `key_files has ${keyFiles.length} entries — convention is 3–8 load-bearing paths`);
    }
    for (const kf of keyFiles) {
      const abs = path.resolve(REPO_ROOT, kf);
      if (!existsSync(abs)) add(SEV.ERROR, `key_files path does not exist on disk: \`${kf}\``);
    }
  }

  // ── Structure: 10 mandatory sections (feature docs only) ──────────────────
  if (isFeature) {
    const headings = content.split(/\r?\n/).filter((l) => /^##\s+\d+\./.test(l));
    const present = new Set(
      headings
        .map((h) => h.match(/^##\s+(\d+)\./))
        .filter(Boolean)
        .map((m) => Number(m[1])),
    );
    const missing = [];
    for (let n = 1; n <= FEATURE_SECTIONS; n++) if (!present.has(n)) missing.push(n);
    if (missing.length) {
      add(SEV.ERROR, `missing template section(s): ${missing.map((n) => `## ${n}.`).join(', ')}`);
    }
  }

  // ── Broken internal links: markdown links + related: slugs ────────────────
  for (const f of checkLinks(absPath, content, fm)) findings.push(f);

  // ── Staleness (the core check) — feature docs only ────────────────────────
  let stale = false;
  if (isFeature) {
    const docMs = isoToMs(gitLastCommitISO(absPath));
    if (docMs === null) {
      add(SEV.WARN, 'uncommitted — commit then re-run (no doc commit date to compare against)');
    } else if (keyFiles.length > 0) {
      const moved = [];
      for (const kf of keyFiles) {
        const abs = path.resolve(REPO_ROOT, kf);
        if (!existsSync(abs)) continue; // already reported as a key_files error
        const kfMs = isoToMs(gitLastCommitISO(abs));
        if (kfMs === null) continue; // path has no commits — skip
        if (kfMs > docMs) {
          moved.push({ kf, iso: new Date(kfMs).toISOString().slice(0, 10) });
        }
      }
      if (moved.length) {
        stale = true;
        add(
          SEV.STALE,
          `STALE — ${moved.length} key_file(s) committed after the doc (doc: ${new Date(docMs).toISOString().slice(0, 10)}):`,
        );
        for (const m of moved) add(SEV.STALE, `    ↳ ${m.kf}  (last change ${m.iso})`);
      }
    }
  }

  return { findings, stale };
}

/**
 * Scan markdown links to relative .md / docs/... targets, plus `related:` slugs,
 * and flag any that don't resolve to a file. External (http/mailto) and pure
 * in-page anchors (#...) are ignored. A link target may carry an #anchor.
 */
function checkLinks(absPath, content, fm) {
  const findings = [];
  const docDir = path.dirname(absPath);
  const seen = new Set();
  const report = (target) => {
    if (seen.has(target)) return;
    seen.add(target);
    findings.push({ sev: SEV.ERROR, msg: `broken internal link: \`${target}\`` });
  };

  // Strip fenced code blocks AND inline code spans so we don't validate links
  // that are merely *illustrating syntax* (e.g. `[x](entities/x.md)` in prose
  // that documents the link convention itself). Only "live" links are checked.
  const noCode = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');

  const linkRe = /\]\(([^)]+)\)/g;
  let m;
  while ((m = linkRe.exec(noCode)) !== null) {
    let target = m[1].trim();
    // strip optional "title"
    target = target.replace(/\s+["'].*["']$/, '');
    if (!target) continue;
    if (/^(https?:|mailto:|tel:|#)/i.test(target)) continue; // external / anchor
    const noAnchor = target.split('#')[0];
    if (!noAnchor) continue; // pure anchor
    // Only validate links that look like file paths to docs/code (.md or docs/...).
    const looksLikeFile =
      noAnchor.endsWith('.md') ||
      noAnchor.startsWith('docs/') ||
      noAnchor.startsWith('../') ||
      noAnchor.startsWith('./');
    if (!looksLikeFile) continue;

    const resolved = noAnchor.startsWith('docs/')
      ? path.resolve(REPO_ROOT, noAnchor)
      : path.resolve(docDir, noAnchor);
    if (!existsSync(resolved)) report(target);
  }

  // related: cross-links. Two accepted shapes (one machinery, both collections):
  //   • bare slug          → a sibling doc <slug>.md in the same dir (features).
  //   • relative path .md   → resolved like a link, may reach sibling dirs
  //                           (research uses `SCHEMA.md`, `../features/README.md`).
  // Placeholder slugs containing `<` (template stubs) are skipped, not failed.
  const related = Array.isArray(fm.data?.related) ? fm.data.related : [];
  for (const slug of related) {
    if (slug.includes('<')) continue; // unfilled template placeholder
    const isPath = slug.endsWith('.md') || slug.includes('/');
    const candidate = isPath
      ? path.resolve(docDir, slug)
      : path.join(docDir, `${slug}.md`);
    if (!existsSync(candidate)) {
      findings.push({
        sev: SEV.ERROR,
        msg: `related: does not resolve to a doc: \`${slug}\` (expected ${path.relative(REPO_ROOT, candidate)})`,
      });
    }
  }

  return findings;
}

// =============================================================================
// Reporting
// =============================================================================

const ICON = {
  [SEV.OK]: '✅',
  [SEV.INFO]: 'ℹ️ ',
  [SEV.WARN]: '⚠️ ',
  [SEV.STALE]: '🔶',
  [SEV.ERROR]: '✗',
};

function docStatusIcon(findings) {
  if (findings.some((f) => f.sev === SEV.STALE)) return '🔶';
  if (findings.some((f) => f.sev === SEV.ERROR)) return '✗';
  if (findings.some((f) => f.sev === SEV.WARN)) return '⚠️ ';
  return '✅';
}

function main() {
  const featureDocs = listMarkdown(FEATURES_DIR);
  const researchDocs = listMarkdownRecursive(RESEARCH_DIR);

  if (featureDocs.length === 0 && researchDocs.length === 0) {
    console.error('lint-docs: no docs found under docs/features or docs/research.');
    process.exit(1);
  }

  const results = [];
  for (const f of featureDocs) results.push({ file: f, isFeature: true, ...lintDoc(f, { isFeature: true }) });
  for (const f of researchDocs) results.push({ file: f, isFeature: false, ...lintDoc(f, { isFeature: false }) });

  // ── Per-doc grouped report ────────────────────────────────────────────────
  if (!QUIET) {
    console.log('');
    console.log('  mezo-kb docs lint');
    console.log('  ' + '─'.repeat(60));
    for (const r of results) {
      const rel = path.relative(REPO_ROOT, r.file);
      const icon = docStatusIcon(r.findings);
      const clean = r.findings.length === 0 || r.findings.every((f) => f.sev === SEV.OK || f.sev === SEV.INFO);
      console.log(`\n  ${icon} ${rel}`);
      if (clean && r.findings.length === 0) {
        console.log('       (no findings)');
      }
      for (const f of r.findings) {
        // Continuation lines (indented "↳") print without an icon.
        if (f.msg.startsWith('    ↳')) console.log(`       ${f.msg.trim()}`);
        else console.log(`       ${ICON[f.sev] ?? '•'} ${f.msg}`);
      }
    }
    console.log('');
    console.log('  ' + '─'.repeat(60));
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const total = results.length;
  const staleDocs = results.filter((r) => r.findings.some((f) => f.sev === SEV.STALE)).length;
  const errorDocs = results.filter((r) => r.findings.some((f) => f.sev === SEV.ERROR)).length;
  const warnDocs = results.filter(
    (r) => r.findings.some((f) => f.sev === SEV.WARN) && !r.findings.some((f) => FAILING.has(f.sev)),
  ).length;
  const cleanDocs = results.filter((r) => !r.findings.some((f) => f.sev === SEV.WARN || FAILING.has(f.sev))).length;

  const fail = results.some((r) => r.findings.some((f) => FAILING.has(f.sev)));

  console.log(
    `  summary: ${total} doc(s) — ✅ ${cleanDocs} clean · ⚠️  ${warnDocs} warn · 🔶 ${staleDocs} stale · ✗ ${errorDocs} error`,
  );
  const failLabel = ERRORS_ONLY ? 'FAIL (error findings — see above)' : 'FAIL (stale or error findings — see above)';
  console.log(`  result: ${fail ? failLabel : `PASS${ERRORS_ONLY && staleDocs > 0 ? ' (stale findings advisory under --errors-only)' : ''}`}`);
  console.log('');

  process.exit(fail ? 1 : 0);
}

main();

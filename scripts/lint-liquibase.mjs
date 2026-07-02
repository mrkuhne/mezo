#!/usr/bin/env node
// =============================================================================
// lint-liquibase.mjs — migration-convention linter for backend Liquibase scripts
// =============================================================================
//
// Run from the repo root:   node scripts/lint-liquibase.mjs   (--quiet for summary only)
//
// Enforces docs/references/liquibase_conventions.md mechanically:
//   1. Script filename:  {YYYYMMDDHHMM}_{bd-id}_{snake_desc}.sql
//   2. No seed data:     INSERT INTO fails the lint. Backfill DML that migrates
//      EXISTING rows is the one sanctioned exception — mark the file with a
//      `-- lint-liquibase: allow-insert` comment to opt out (reviewed, explicit).
//   3. Explicit constraint names with the right prefix:
//        PRIMARY KEY → pk_ · FOREIGN KEY → fk_ · UNIQUE → uq_ · CHECK → ck_
//        CREATE [UNIQUE] INDEX → idx_ (uq_ accepted for unique indexes)
//      Inline column-level constraints (e.g. `id UUID PRIMARY KEY`) are unnamed
//      by definition → violation.
//   4. Version master ymls reference exactly the script files that exist, and
//      each changeSet id is `{version}:{filename-without-.sql}`.
//
// GRANDFATHERED: released changesets are immutable, so pre-existing violations
// are allowlisted below instead of "fixed" — do NOT add new entries for new work.
//
// Exit code: 0 = pass, 1 = any error. Dependencies: NONE (Node 18+, node:fs/path).
// =============================================================================

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const CHANGELOG_DIR = path.join(REPO_ROOT, 'backend', 'src', 'main', 'resources', 'db', 'changelog');

const QUIET = process.argv.includes('--quiet');

// Released-changeset immutability means these can never be renamed in place;
// they are exempted per-file + per-rule. Never extend this list for new files.
const GRANDFATHERED = {
  // mezo-ah18.14(d): the only two unnamed PKs in the schema (app_user.id,
  // user_profiles.created_by) — shipped in v1.0.0, left as-is by decision.
  '202606101200_mezo-v67_create_auth.sql': new Set(['inline-primary-key']),
};

const FILENAME_RE = /^\d{12}_mezo-[a-z0-9]+(?:\.\d+)?_[a-z0-9_]+\.sql$/;
const ALLOW_INSERT_MARKER = /--\s*lint-liquibase:\s*allow-insert/;

// ── Findings collector ────────────────────────────────────────────────────────
const results = []; // { file, findings: [{ msg }] }
function fileResult(file) {
  let r = results.find((x) => x.file === file);
  if (!r) { r = { file, findings: [] }; results.push(r); }
  return r;
}
const report = (file, msg) => fileResult(file).findings.push({ msg });

// ── SQL helpers ───────────────────────────────────────────────────────────────

/** Strip -- line comments and /* *​/ block comments (string-literal-naive; fine for DDL). */
function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

/** Split a parenthesized body on top-level commas (paren-depth aware). */
function splitTopLevel(body) {
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.replace(/\s+/g, ' ').trim());
}

/** Extract the (...) body starting at openIdx (index of the '(' char). */
function parenBody(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return text.slice(openIdx + 1, i);
    }
  }
  return null; // unbalanced — caller reports
}

const PREFIX_BY_KIND = { 'PRIMARY KEY': 'pk_', 'FOREIGN KEY': 'fk_', 'UNIQUE': 'uq_', 'CHECK': 'ck_' };

function checkConstraintDef(file, def, allow) {
  const named = def.match(/^CONSTRAINT\s+(\S+)\s+(PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK)/i);
  if (named) {
    const [, name, kindRaw] = named;
    const prefix = PREFIX_BY_KIND[kindRaw.toUpperCase()];
    if (!name.toLowerCase().startsWith(prefix)) {
      report(file, `constraint \`${name}\` should carry the \`${prefix}\` prefix (${kindRaw.toUpperCase()})`);
    }
    if (name.length > 63) report(file, `constraint name \`${name}\` exceeds the 63-char Postgres limit`);
    return;
  }
  // Column definition — any embedded constraint keyword here is unnamed/inline.
  const inline = [
    { re: /\bPRIMARY KEY\b/i, kind: 'PRIMARY KEY', rule: 'inline-primary-key' },
    { re: /\bREFERENCES\b/i, kind: 'FOREIGN KEY (inline REFERENCES)', rule: 'inline-foreign-key' },
    { re: /\bUNIQUE\b/i, kind: 'UNIQUE', rule: 'inline-unique' },
    { re: /\bCHECK\s*\(/i, kind: 'CHECK', rule: 'inline-check' },
  ];
  for (const { re, kind, rule } of inline) {
    if (re.test(def) && !allow.has(rule)) {
      report(file, `unnamed inline ${kind} constraint — use \`CONSTRAINT ${PREFIX_BY_KIND[kind.split(' (')[0]] ?? ''}...\` instead: \`${def.slice(0, 70)}\``);
    }
  }
}

function lintSql(file, absPath) {
  const raw = readFileSync(absPath, 'utf8');
  const allowInsert = ALLOW_INSERT_MARKER.test(raw);
  const sql = stripComments(raw);
  const allow = GRANDFATHERED[file] ?? new Set();

  // ── Rule 2: seed-data ban ──────────────────────────────────────────────────
  if (/\bINSERT\s+INTO\b/i.test(sql) && !allowInsert) {
    report(file, 'INSERT INTO found — seed data belongs in Java @Profile("demodata"); for a genuine backfill add `-- lint-liquibase: allow-insert`');
  }

  // ── Rule 3a: CREATE TABLE bodies ───────────────────────────────────────────
  const tableRe = /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)\s*\(/gi;
  let m;
  while ((m = tableRe.exec(sql)) !== null) {
    const body = parenBody(sql, tableRe.lastIndex - 1);
    if (body === null) { report(file, `unbalanced parentheses after CREATE TABLE ${m[1]}`); continue; }
    for (const def of splitTopLevel(body)) checkConstraintDef(file, def, allow);
  }

  // ── Rule 3b: ALTER TABLE ... ADD [CONSTRAINT] ──────────────────────────────
  const alterRe = /\bALTER\s+TABLE\s+\S+\s+ADD\s+(CONSTRAINT\s+\S+\s+)?(PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK)/gi;
  while ((m = alterRe.exec(sql)) !== null) {
    if (m[1]) {
      checkConstraintDef(file, `CONSTRAINT ${m[1].replace(/^CONSTRAINT\s+/i, '')} ${m[2]}`.replace(/\s+/g, ' '), allow);
    } else {
      report(file, `ALTER TABLE ADD ${m[2].toUpperCase()} without an explicit CONSTRAINT name`);
    }
  }

  // ── Rule 3c: index names ───────────────────────────────────────────────────
  const idxRe = /\bCREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)\s+ON\b/gi;
  while ((m = idxRe.exec(sql)) !== null) {
    const [, unique, name] = m;
    const ok = unique ? /^(uq_|idx_)/.test(name.toLowerCase()) : /^idx_/.test(name.toLowerCase());
    if (!ok) report(file, `index \`${name}\` should carry the \`${unique ? 'uq_/idx_' : 'idx_'}\` prefix`);
    if (name.length > 63) report(file, `index name \`${name}\` exceeds the 63-char Postgres limit`);
  }
}

// ── Walk version folders ──────────────────────────────────────────────────────
function main() {
  if (!existsSync(CHANGELOG_DIR)) {
    console.error(`lint-liquibase: changelog dir not found: ${path.relative(REPO_ROOT, CHANGELOG_DIR)}`);
    process.exit(1);
  }

  const versions = readdirSync(CHANGELOG_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d+\.\d+\.\d+$/.test(e.name))
    .map((e) => e.name)
    .sort();

  let scanned = 0;
  for (const version of versions) {
    const scriptDir = path.join(CHANGELOG_DIR, version, 'script');
    const masterPath = path.join(CHANGELOG_DIR, version, `${version}_master.yml`);
    const scripts = existsSync(scriptDir)
      ? readdirSync(scriptDir).filter((n) => n.endsWith('.sql')).sort()
      : [];

    // ── Rule 1: filenames ────────────────────────────────────────────────────
    for (const file of scripts) {
      scanned++;
      if (!FILENAME_RE.test(file)) {
        report(file, 'filename must match `{YYYYMMDDHHMM}_{bd-id}_{snake_desc}.sql` (e.g. 202606101300_mezo-v67_create_weight_log.sql)');
      }
      lintSql(file, path.join(scriptDir, file));
    }

    // ── Rule 4: master yml cross-check ───────────────────────────────────────
    if (!existsSync(masterPath)) {
      report(`${version}/`, `missing version master: ${version}_master.yml`);
      continue;
    }
    const master = readFileSync(masterPath, 'utf8');
    const referenced = [...master.matchAll(/path:\s*script\/(\S+\.sql)/g)].map((x) => x[1]);
    const ids = [...master.matchAll(/id:\s*(\S+)/g)].map((x) => x[1].replace(/^["']|["']$/g, ''));

    for (const ref of referenced) {
      if (!scripts.includes(ref)) report(`${version}/${version}_master.yml`, `references missing script: \`${ref}\``);
    }
    for (const file of scripts) {
      const refCount = referenced.filter((r) => r === file).length;
      if (refCount === 0) report(file, `not referenced by ${version}_master.yml — orphan script`);
      if (refCount > 1) report(file, `referenced ${refCount}× by ${version}_master.yml`);
      const expectedId = `${version}:${file.replace(/\.sql$/, '')}`;
      if (referenced.includes(file) && !ids.includes(expectedId)) {
        report(`${version}/${version}_master.yml`, `changeSet id for \`${file}\` should be \`${expectedId}\``);
      }
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const bad = results.filter((r) => r.findings.length > 0);
  if (!QUIET) {
    console.log('\n  mezo liquibase lint');
    console.log('  ' + '─'.repeat(60));
    for (const r of bad) {
      console.log(`\n  ✗ ${r.file}`);
      for (const f of r.findings) console.log(`       ✗ ${f.msg}`);
    }
    if (bad.length === 0) console.log('  (no findings)');
    console.log('\n  ' + '─'.repeat(60));
  }
  console.log(`  summary: ${scanned} script(s) — ✅ ${scanned - bad.length} clean · ✗ ${bad.length} with errors`);
  console.log(`  result: ${bad.length ? 'FAIL' : 'PASS'}\n`);
  process.exit(bad.length ? 1 : 0);
}

main();

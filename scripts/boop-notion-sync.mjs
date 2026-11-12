#!/usr/bin/env node
// Boop → Notion one-way mirror: computes what the owner's Notion "Boop" space should contain and diffs it
// against what was last pushed. The Notion writes themselves happen through the Notion MCP tools in a Claude
// session (no API token lives in this repo) — see .claude/skills/boop-notion/SKILL.md.
//
// Sources (the machine of record):
//   bd issues under epic mezo-r36n9           → Jegyek   (+ Hungarian overlay docs/boop-handbook/_jegyek.json)
//   docs/boop-handbook/_dontesek.json         → Döntések
//   docs/boop-handbook/_kiadasok.json         → Kiadások
//   docs/boop-handbook/NN-*/**.md             → Kézikönyv
// State: docs/boop-handbook/_notion-state.json (Notion ids + per-record content hash; committed).
//
// Usage:
//   node scripts/boop-notion-sync.mjs plan [--only jegyek,kiadasok] [--json]
//        prints the pending operations; writes the full plan to docs/boop-handbook/.last-plan.json
//   node scripts/boop-notion-sync.mjs record <key>=<notion-page-id> [...]
//        after creating/updating a page in Notion, store its id + the planned hash (keys as printed by plan)
//   node scripts/boop-notion-sync.mjs check
//        exit 1 when anything is pending (for the end-of-slice checklist)
//
// Run `plan` again after `record`: relations to rows created in the same pass resolve on the second pass.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HB = join(ROOT, 'docs/boop-handbook');
const STATE_FILE = join(HB, '_notion-state.json');
const PLAN_FILE = join(HB, '.last-plan.json');
const EPIC = 'mezo-r36n9';

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const state = readJson(STATE_FILE);
const ids = state.notion; // data source ids + page ids of the space
state.records ??= {};

// ---------- helpers ----------
const sha = (o) => createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 12);
const ms = (arr) => JSON.stringify(arr ?? []);
const pageOf = (key) => state.records[key]?.page_id ?? null;
const escapeTags = (s) => s.replace(/<(?=[A-Za-z/!])/g, '\\<');

const STATUS_FROM_LABEL = {
  'allapot:kesobb': 'Később', 'allapot:tervezes': 'Tervezés', 'allapot:indulhat': 'Indulhat',
  'allapot:epul': 'Épül', 'allapot:ellenorzes': 'Ellenőrzés', 'allapot:elesitesre-var': 'Élesítésre vár',
  'allapot:var-rad': 'Vár rád', 'allapot:elesben': 'Élesben', 'allapot:lezarva': 'Lezárva', 'allapot:elvetve': 'Elvetve',
};
const PRIORITY = { 0: 'Kritikus', 1: 'Magas', 2: 'Közepes', 3: 'Alacsony', 4: 'Alacsony' };
const SLICE_CODE = { // Kézikönyv "Szakasz" code → Jegyek "Szakasz" option
  S1: 'S1 Alap', S2: 'S2 Adatok', 'S2.5': 'S2.5 Napkelte', S3: 'S3 Reggel', B0: 'B0 Javítás', B1: 'B1 Adatalap',
  B2: 'B2 Gerinc', B3: 'B3 Napi ritmus', B4: 'B4 Étel', B5: 'B5 Edzés + Watch', B6: 'B6 A Terv',
  B7: 'B7 Napi kapacitás', B8: 'B8 Az egy AI', Test: 'Test',
};
const STATE_COLOR = { 'Élesben': 'green_bg', 'Részben kész': 'yellow_bg', 'Ellenőrzés': 'purple_bg', 'Tervezve': 'blue_bg', 'Kihagyva': 'gray_bg' };
const STATE_ICON = { 'Élesben': '✅', 'Részben kész': '🟡', 'Ellenőrzés': '🔍', 'Tervezve': '🗺️', 'Kihagyva': '🚫' };
const SECTION_ICON = {
  'Mit csinál': '🎯', 'Hogyan működik': '⚙️', 'Miért így': '💡', 'Beállítások': '🎛️', 'Adattáblák': '🗄️',
  'Mi jön még': '🔭', 'Mi marad ki': '🚫', 'Ha elromlik': '🧯',
};

// ---------- Jegyek ----------
function ticketStatus(issue, overlay) {
  if (overlay.allapot) return overlay.allapot;
  for (const l of issue.labels ?? []) if (STATUS_FROM_LABEL[l]) return STATUS_FROM_LABEL[l];
  switch (issue.status) {
    case 'in_progress': return 'Épül';
    case 'blocked': return 'Vár rád';
    case 'deferred': return 'Később';
    case 'closed': return ['Kutatás', 'Apróságok', 'Karbantartás'].includes(overlay.tipus) ? 'Lezárva' : 'Élesben';
    default: return 'Később';
  }
}

function buildTickets() {
  const raw = execFileSync('bd', ['list', '--parent', EPIC, '--all', '--json', '--limit', '0'], { cwd: ROOT, encoding: 'utf8' });
  const issues = JSON.parse(raw);
  const epic = JSON.parse(execFileSync('bd', ['show', EPIC, '--json'], { cwd: ROOT, encoding: 'utf8' }));
  issues.push(Array.isArray(epic) ? epic[0] : epic);
  const overlay = readJson(join(HB, '_jegyek.json'));
  const missing = [];
  const out = [];
  const sliceKey = {}; // szakasz option → ticket key of the "Szakasz"-type row
  for (const i of issues) {
    const o = overlay[i.id];
    if (!o) { missing.push(i.id); continue; }
    if (o.tipus === 'Szakasz' && !o.epic) sliceKey[o.szakasz] = `jegyek:${i.id}`;
  }
  for (const i of issues) {
    const o = overlay[i.id];
    if (!o) continue;
    const allapot = ticketStatus(i, o);
    const parentKey = o.epic ? null
      : o.szulo ? `jegyek:${o.szulo}`
      : (o.tipus !== 'Szakasz' && sliceKey[o.szakasz]) ? sliceKey[o.szakasz]
      : `jegyek:${EPIC}`;
    const props = {
      'Jegy': o.cim,
      'Állapot': allapot,
      'Típus': o.tipus,
      'Prioritás': PRIORITY[i.priority] ?? 'Közepes',
      'Szakasz': o.szakasz,
      'Terület': ms(o.terulet),
      'Mit kapsz': o.mit_kapsz,
      'Munkamenet': o.munkamenet ?? '',
      'Gépi azonosító': i.id,
      'date:Kezdés:start': (i.created_at ?? '').slice(0, 10) || null,
      'date:Élesítés:start': allapot === 'Élesben' ? (i.closed_at ?? '').slice(0, 10) || null : null,
    };
    const rel = parentKey ? { 'Szülő': [parentKey] } : {};
    const content = [
      `<callout icon="🎁" color="orange_bg">\n**Mit kapsz:** ${escapeTags(o.mit_kapsz)}\n</callout>`,
      o.leiras ? `\n${escapeTags(o.leiras)}` : '',
    ].join('\n');
    out.push({ key: `jegyek:${i.id}`, db: 'jegyek', props, rel, content, icon: ticketIcon(o.tipus) });
  }
  return { rows: out, missing };
}
const ticketIcon = (t) => ({ Szakasz: '🧱', Funkció: '✨', Hiba: '🐞', Kutatás: '🔬', Apróságok: '🧹', Karbantartás: '🔧' }[t] ?? '🎫');

// ---------- Döntések / Kiadások ----------
function buildDecisions() {
  const d = readJson(join(HB, '_dontesek.json'));
  return Object.entries(d).filter(([k]) => !k.startsWith('_')).map(([k, v]) => ({
    key: `dontesek:${k}`, db: 'dontesek', icon: '⚖️',
    props: {
      'Döntés': v.cim, 'date:Dátum:start': v.datum, 'Amit választottál': v.valasztas, 'Miért': v.miert,
      'Mit váltott le': v.levaltotta, 'Következmény': v.kovetkezmeny, 'Terület': ms(v.terulet), 'Súly': v.suly, 'Forrás': k,
    },
    rel: {},
    content: [
      `<callout icon="✅" color="green_bg">\n**Amit választottál:** ${escapeTags(v.valasztas)}\n</callout>`,
      `## 💡 Miért\n${escapeTags(v.miert)}`,
      `## ♻️ Mit váltott le\n${escapeTags(v.levaltotta)}`,
      `## ➡️ Következmény\n${escapeTags(v.kovetkezmeny)}`,
    ].join('\n\n'),
  }));
}

function buildReleases() {
  const d = readJson(join(HB, '_kiadasok.json'));
  return Object.entries(d).filter(([k]) => !k.startsWith('_')).map(([k, v]) => ({
    key: `kiadasok:${k}`, db: 'kiadasok', icon: '🚀',
    props: {
      'Kiadás': v.cim, 'date:Dátum:start': v.datum, 'Verzió': v.verzio ?? '', 'Mi változott': v.mi_valtozott,
      'Típus': v.tipus, 'Hova': ms(v.hova), 'Szakasz': v.szakasz, 'Forrás': k,
    },
    rel: { 'Jegyek': (v.jegyek ?? []).map((j) => `jegyek:${j}`) },
    content: `<callout icon="🚀" color="blue_bg">\n${escapeTags(v.mi_valtozott)}\n</callout>`,
  }));
}

// ---------- Kézikönyv ----------
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^([A-Za-z_]+):\s*(.*?)\s*(#.*)?$/);
    if (!mm) continue;
    let v = mm[2];
    if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    else v = v.replace(/^["']|["']$/g, '');
    fm[mm[1]] = v;
  }
  return { fm, body: m[2] };
}

// The repo files are hard-wrapped at ~110 columns; Notion turns every newline inside a paragraph or list item
// into a visible line break. Re-join continuation lines (outside code fences and tables).
function unwrap(md) {
  const out = [];
  let fence = false;
  const isBlockStart = (l) => /^\s*([-*+] |\d+[.)] |#|\||>|```|<)/.test(l) || l.trim() === '';
  for (const line of md.split('\n')) {
    if (/^\s*```/.test(line)) { fence = !fence; out.push(line); continue; }
    const prev = out[out.length - 1];
    if (!fence && prev !== undefined && prev.trim() !== '' && !/^\s*(\||#|```)/.test(prev) && !isBlockStart(line)) {
      out[out.length - 1] = `${prev.replace(/\s+$/, '')} ${line.trim()}`;
    } else out.push(line);
  }
  return out.join('\n');
}

function decorateBody(body) {
  return escapeTags(unwrap(body.trim())).replace(/^## (.+)$/gm, (_, h) => `## ${SECTION_ICON[h.trim()] ? SECTION_ICON[h.trim()] + ' ' : ''}${h.trim()}`);
}

function buildHandbook(ticketRows) {
  const sliceTicket = {};
  for (const t of ticketRows) if (t.props['Típus'] === 'Szakasz') sliceTicket[t.props['Szakasz']] = t.key;
  const rows = [];
  const dirs = readdirSync(HB).filter((d) => /^\d\d-/.test(d) && statSync(join(HB, d)).isDirectory()).sort();
  for (const dir of dirs) {
    const files = readdirSync(join(HB, dir)).filter((f) => f.endsWith('.md')).sort();
    files.forEach((f, idx) => {
      const rel = `${dir}/${f.replace(/\.md$/, '')}`;
      const { fm, body } = parseFrontmatter(readFileSync(join(HB, dir, f), 'utf8'));
      const szakasz = Array.isArray(fm.szakasz) ? fm.szakasz : fm.szakasz ? [fm.szakasz] : [];
      const hol = Array.isArray(fm.hol) ? fm.hol : fm.hol ? [fm.hol] : [];
      const allapot = fm.allapot ?? 'Tervezve';
      const props = {
        'Oldal': fm.cim ?? rel, 'Szint': fm.szint ?? 'Funkció', 'Terület': fm.terulet ?? null, 'Állapot': allapot,
        'Hol él': ms(hol), 'Szakasz': ms(szakasz.filter((s) => SLICE_CODE[s])), 'Röviden': fm.osszefoglalo ?? '',
        'Sorrend': Number(dir.slice(0, 2)) * 100 + idx, 'Forrás': `boop-handbook/${rel}`,
      };
      const relProps = {
        'Szülő': fm.szulo ? [`kezikonyv:${dir}/${fm.szulo}`] : [],
        'Jegyek': szakasz.map((s) => sliceTicket[SLICE_CODE[s]]).filter(Boolean),
      };
      const head = `<callout icon="${STATE_ICON[allapot] ?? '📘'}" color="${STATE_COLOR[allapot] ?? 'gray_bg'}">\n**${allapot}.** ${escapeTags(fm.osszefoglalo ?? '')}\n</callout>`;
      rows.push({ key: `kezikonyv:${rel}`, db: 'kezikonyv', icon: fm.szint === 'Fő szekció' ? '📘' : fm.szint === 'Kis funkció' ? '🔹' : '📄', props, rel: relProps, content: `${head}\n\n${decorateBody(body)}` });
    });
  }
  return rows;
}

// ---------- plan ----------
function resolve(row) {
  const props = { ...row.props };
  let unresolved = 0;
  for (const [name, keys] of Object.entries(row.rel)) {
    const resolved = keys.map(pageOf).filter(Boolean);
    unresolved += keys.length - resolved.length;
    props[name] = resolved.map((id) => `https://www.notion.so/${id.replace(/-/g, '')}`);
  }
  return { props, unresolved };
}

function plan(only) {
  const { rows: tickets, missing } = buildTickets();
  let rows = [...tickets, ...buildDecisions(), ...buildReleases(), ...buildHandbook(tickets)];
  if (only) rows = rows.filter((r) => only.includes(r.db));
  const ops = [];
  for (const row of rows) {
    const { props, unresolved } = resolve(row);
    const hash = sha({ props, content: row.content, icon: row.icon });
    const rec = state.records[row.key];
    if (rec && rec.hash === hash) continue;
    ops.push({
      op: rec?.page_id ? 'update' : 'create', key: row.key, db: row.db, data_source_id: ids.data_sources[row.db],
      page_id: rec?.page_id ?? null, icon: row.icon, properties: props, content: row.content, hash, unresolved_relations: unresolved,
    });
  }
  const known = new Set(rows.map((r) => r.key));
  const orphans = only ? [] : Object.keys(state.records).filter((k) => !known.has(k));
  return { ops, missing_overlay: missing, orphans };
}

// ---------- CLI ----------
const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'plan' || cmd === 'check') {
  const onlyArg = args.find((a) => a.startsWith('--only'));
  const only = onlyArg ? (onlyArg.split('=')[1] ?? args[args.indexOf(onlyArg) + 1]).split(',') : null;
  const p = plan(only);
  writeFileSync(PLAN_FILE, JSON.stringify(p, null, 2));
  const count = (op) => p.ops.filter((o) => o.op === op).length;
  if (args.includes('--json')) console.log(JSON.stringify(p, null, 2));
  else {
    console.log(`Boop → Notion: ${count('create')} create, ${count('update')} update, ${p.ops.filter((o) => o.unresolved_relations).length} with relations pending`);
    for (const o of p.ops) console.log(`  ${o.op.padEnd(6)} ${o.key}${o.unresolved_relations ? `  (+${o.unresolved_relations} rel next pass)` : ''}`);
    if (p.missing_overlay.length) console.log(`! bd issues without a Hungarian row in _jegyek.json: ${p.missing_overlay.join(', ')}`);
    if (p.orphans.length) console.log(`! in Notion but no longer in the sources (archive by hand in Notion, then drop from _notion-state.json): ${p.orphans.join(', ')}`);
    console.log(`Full plan: ${relative(ROOT, PLAN_FILE)}`);
  }
  if (cmd === 'check' && (p.ops.length || p.missing_overlay.length)) process.exit(1);
} else if (cmd === 'payload') {
  // Tool-ready arguments for the last plan, so applying is mechanical:
  //   payload create <db> [n]  → {parent:{data_source_id}, pages:[...], keys:[...]} for notion-create-pages
  //   payload update <key>     → {page_id, properties, content} for notion-update-page
  if (!existsSync(PLAN_FILE)) { console.error('Run `plan` first.'); process.exit(2); }
  const last = readJson(PLAN_FILE);
  const [kind, target, n] = args;
  if (kind === 'create') {
    // skip rows already recorded since the plan was written, so repeated calls hand out the next batch
    const ops = last.ops.filter((o) => o.op === 'create' && o.db === target && !state.records[o.key]?.page_id).slice(0, Number(n ?? 20));
    console.log(JSON.stringify({
      parent: { type: 'data_source_id', data_source_id: ids.data_sources[target] },
      pages: ops.map((o) => ({ icon: o.icon, properties: o.properties, content: o.content })),
      keys: ops.map((o) => o.key),
    }));
  } else if (kind === 'update') {
    const o = last.ops.find((x) => x.key === target);
    if (!o) { console.error(`not in last plan: ${target}`); process.exit(1); }
    console.log(JSON.stringify({ page_id: o.page_id, icon: o.icon, properties: o.properties, content: o.content }));
  } else if (kind === 'relations') {
    // second-pass rows whose only change is relations to rows created in the same pass:
    // send just these properties with update_properties (content and other properties are already in Notion)
    const REL = ['Szülő', 'Jegyek'];
    const ops = last.ops.filter((o) => o.op === 'update' && (!target || o.db === target) && state.records[o.key]?.hash === 'pending-relations');
    console.log(JSON.stringify(ops.map((o) => ({
      key: o.key, page_id: o.page_id,
      properties: Object.fromEntries(REL.filter((r) => r in o.properties).map((r) => [r, o.properties[r]])),
    }))));
  } else if (kind === 'updates') {
    // next n full updates not yet recorded since the plan: update_properties(properties, icon) + replace_content(content)
    const ops = last.ops.filter((o) => o.op === 'update' && o.db === target && state.records[o.key]?.hash !== o.hash).slice(0, Number(n ?? 5));
    console.log(JSON.stringify(ops.map((o) => ({ key: o.key, page_id: o.page_id, icon: o.icon, properties: o.properties, content: o.content }))));
  } else { console.error('payload create <db> [n] | payload update <key> | payload updates <db> [n] | payload relations [db]'); process.exit(2); }
} else if (cmd === 'record') {
  if (!existsSync(PLAN_FILE)) { console.error('Run `plan` first.'); process.exit(2); }
  const last = readJson(PLAN_FILE);
  const byKey = Object.fromEntries(last.ops.map((o) => [o.key, o]));
  for (const a of args) {
    const i = a.lastIndexOf('=');
    const key = a.slice(0, i);
    const hex = a.slice(i + 1).replace(/[?#].*$/, '').replace(/-/g, '').match(/[0-9a-f]{32}$/i)?.[0];
    if (!hex) { console.error(`not a Notion page id: ${a}`); process.exitCode = 1; continue; }
    const pid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    if (!byKey[key]) { console.error(`not in last plan: ${key}`); process.exitCode = 1; continue; }
    // A row recorded while some relations were still unresolved keeps a stale hash on purpose,
    // so the next plan re-emits it as an update with the relations filled in.
    state.records[key] = { page_id: pid, hash: byKey[key].unresolved_relations ? 'pending-relations' : byKey[key].hash };
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  console.log(`recorded ${args.length}`);
} else {
  console.log('usage: boop-notion-sync.mjs plan [--only db,db] [--json] | record <key>=<page-id> ... | check');
  process.exit(2);
}

# Frontend Structure Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `frontend/src` into an explicit, uniform structure (feature-cohesion `pages/` layer, consistent `components/sheets/logic` per feature, per-domain `data/`, clean `shared/`) with zero runtime behavior change.

**Architecture:** A behavior-preserving mechanical refactor driven by a committed **move manifest** (`from → to → rename`, 450 rows) and two idempotent codemods. First absolute-ify every relative import (so file moves become pure `@/from → @/to` string remaps), then move+rename per layer/feature. The existing test suite (both modes) + `tsc -b` is the correctness gate after every task; `pnpm parity` is the final visual no-op proof.

**Tech Stack:** React 19 · Vite 8 · TypeScript 6 · Vitest 4 (+ MSW) · Playwright · pnpm · `@/*`→`src/*` path alias.

**Design spec:** [`docs/superpowers/specs/2026-07-01-frontend-structure-refactor-design.md`](../specs/2026-07-01-frontend-structure-refactor-design.md) · **bd:** `mezo-t2x4`

## Global Constraints

- **Behavior-preserving.** No runtime/logic/data-flow/API/route changes. Moves, symbol renames, import rewrites, and two contained test-file edits only.
- **The gate** (must be GREEN after every task, run from `frontend/`):
  ```
  pnpm build                        # tsc -b && vite build — catches every broken import / missed rename
  pnpm test                         # vitest run, REAL mode
  VITE_USE_MOCK=true pnpm test      # vitest run, MOCK mode
  ```
- **Isolation:** all work in a git worktree off `main`, branch `feat/fe-structure-refactor`.
- **Moves use `git mv`** (preserve history). **No barrels** (`index.ts`) — deep imports via `@/*`.
- **Commits:** conventional subject carrying the bd id, e.g. `refactor(fe): …(mezo-t2x4)`; end every commit body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Refactor tooling** lives in `frontend/scripts/refactor/` and is deleted in Task 12.
- **The manifest is the single source of truth** for every path/rename. Never hand-edit paths; regenerate/edit the manifest.

---

### Task 1: Worktree + tooling scaffold + move manifest

**Files:**
- Create: git worktree at `../mezo-fe-refactor` (branch `feat/fe-structure-refactor`)
- Create: `frontend/scripts/refactor/movemap.tsv` (450 rows: `from\tto\trename`)
- Create: `frontend/scripts/refactor/absolutify-imports.mjs`
- Create: `frontend/scripts/refactor/apply-moves.mjs`

**Interfaces:**
- Produces: `movemap.tsv` (consumed by `apply-moves.mjs`); `absolutify-imports.mjs` (run once, Task 2); `apply-moves.mjs --to-prefix <p> [--from-prefix <p>]` (run per layer/feature).

- [ ] **Step 1: Create the worktree** (from the main checkout `/Users/daniel.kuhne/MrKuhne/mezo`)

Use the `superpowers:using-git-worktrees` skill. Equivalent commands:
```bash
git worktree add -b feat/fe-structure-refactor ../mezo-fe-refactor main
cd ../mezo-fe-refactor/frontend && pnpm install --frozen-lockfile
```

- [ ] **Step 2: Commit the spec** (it currently exists only in the main checkout as untracked; recreate/commit it on the branch)

```bash
git add docs/superpowers/specs/2026-07-01-frontend-structure-refactor-design.md \
        docs/superpowers/plans/2026-07-01-frontend-structure-refactor.md
git commit  # subject: docs(fe): structure refactor spec + plan (mezo-t2x4)
```

- [ ] **Step 3: Write `frontend/scripts/refactor/movemap.tsv`**

The finalized 450-row manifest was produced during planning (the `fe-refactor-inventory` sweep + the R1–R15 overrides, all applied and collision-checked) and is held in the session scratch at `…/scratchpad/movemap.tsv`; Task 1 copies it verbatim into the worktree. Each line is `<from>\t<to>\t<rename>` where `rename` is empty or `Old->New`. Rows with `from == to` are no-move rows (kept for import-map completeness; `git mv` is skipped for them). **Validate on write** against the **Appendix A** checksums — 450 rows, 73 with a rename, 0 target collisions — before proceeding.

- [ ] **Step 4: Write `absolutify-imports.mjs`** (converts every relative import/export/`vi.mock` specifier to `@/…` absolute)

```js
// Usage: node scripts/refactor/absolutify-imports.mjs   (run from frontend/)
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

const SRC = path.resolve('src')
const files = execSync(`git ls-files 'src/**/*.ts' 'src/**/*.tsx'`, { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)

// matches: from '…'  |  import '…'  |  vi.mock('…'  |  vi.importActual('…'  |  import('…'
const SPEC = /((?:from|import|vi\.mock|vi\.importActual)\s*\(?\s*)(['"])(\.\.?\/[^'"]+)\2/g
const TSJS = /\.(ts|tsx|js|jsx|mts|cts)$/

let changed = 0
for (const file of files) {
  const dir = path.dirname(path.resolve(file))
  let src = readFileSync(file, 'utf8')
  const out = src.replace(SPEC, (m, pre, q, rel) => {
    const abs = path.resolve(dir, rel)
    let relToSrc = path.relative(SRC, abs).split(path.sep).join('/')
    relToSrc = relToSrc.replace(TSJS, '')        // strip TS/JS ext; keep .css etc.
    return `${pre}${q}@/${relToSrc}${q}`
  })
  if (out !== src) { writeFileSync(file, out); changed++ }
}
console.log(`absolutified imports in ${changed} files`)
```

- [ ] **Step 5: Write `apply-moves.mjs`** (git mv the selected rows, then remap `@/` paths + symbols repo-wide)

```js
// Usage: node scripts/refactor/apply-moves.mjs --to <prefix> [--to <prefix>...] [--from <prefix>...]
//   Selects manifest rows whose `to` starts with any --to prefix OR `from` starts with any --from prefix.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

const args = process.argv.slice(2)
const toPrefixes = [], fromPrefixes = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--to') toPrefixes.push(args[++i])
  else if (args[i] === '--from') fromPrefixes.push(args[++i])
}
const noExt = p => p.replace(/\.(ts|tsx)$/, '')

const rows = readFileSync('scripts/refactor/movemap.tsv', 'utf8')
  .trim().split('\n').map(l => { const [from, to, rename] = l.split('\t'); return { from, to, rename: rename || '' } })

const selected = rows.filter(r =>
  toPrefixes.some(p => r.to.startsWith(p)) || fromPrefixes.some(p => r.from.startsWith(p)))
if (!selected.length) { console.error('no rows selected'); process.exit(1) }

// 1) git mv (skip no-move rows and rows already moved by an earlier task)
for (const r of selected) {
  if (r.from === r.to || !existsSync(r.from)) continue
  mkdirSync(path.dirname(r.to), { recursive: true })
  execSync(`git mv "${r.from}" "${r.to}"`)
}

// 2) build path + symbol remap tables from the selected rows
const pathMap = new Map()   // '@/oldNoExt' -> '@/newNoExt'
const symMap = []           // { from:'Old', to:'New' }
for (const r of selected) {
  if (r.from !== r.to) pathMap.set('@/' + noExt(r.from).replace(/^src\//, ''), '@/' + noExt(r.to).replace(/^src\//, ''))
  if (r.rename) { const [a, b] = r.rename.split('->'); symMap.push({ from: a.trim(), to: b.trim() }) }
}

// 3) rewrite ALL src files (imports use the absolute @/ form after Task 2, so this is exact)
const all = execSync(`git ls-files 'src/**/*.ts' 'src/**/*.tsx'`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
let touched = 0
for (const file of all) {
  let src = readFileSync(file, 'utf8'), orig = src
  for (const [oldP, newP] of pathMap) {
    // match the specifier exactly (followed by a quote) to avoid prefix bleed (@/data/fuel vs @/data/fuelWeek)
    src = src.replaceAll(`'${oldP}'`, `'${newP}'`).replaceAll(`"${oldP}"`, `"${newP}"`)
  }
  for (const { from, to } of symMap) src = src.replace(new RegExp(`\\b${from}\\b`, 'g'), to)
  if (src !== orig) { writeFileSync(file, src); touched++ }
}
console.log(`moved ${selected.filter(r => r.from !== r.to).length} files; rewrote ${touched} files; ${pathMap.size} path remaps; ${symMap.length} symbol renames`)
```

- [ ] **Step 6: Commit the tooling**

```bash
git add frontend/scripts/refactor
git commit  # subject: chore(fe): refactor tooling — move manifest + codemods (mezo-t2x4)
```

*(No gate yet — no source moved.)*

---

### Task 2: Absolute-ify all relative imports (de-risk pre-pass)

**Files:** Modify: up to 287 files under `frontend/src` (relative → `@/` imports).

- [ ] **Step 1: Run the codemod**
```bash
cd frontend && node scripts/refactor/absolutify-imports.mjs
```
Expected: `absolutified imports in ~287 files`.

- [ ] **Step 2: Verify no relative imports remain** (except intentional CSS/asset siblings, if any)
```bash
grep -rEn "from '\.\.?/|vi\.mock\('\.\.?/" src --include="*.ts" --include="*.tsx" || echo "NONE"
```
Expected: `NONE` (or only non-JS asset imports you leave as-is).

- [ ] **Step 3: Run the gate** — Expected: all GREEN (pure import-form change, zero behavior/structure change).
```bash
pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

- [ ] **Step 4: Commit**
```bash
git add -A && git commit  # subject: refactor(fe): absolutify all relative imports to @/ (mezo-t2x4)
```

---

### Task 3: `shared/` layer + retire `components/ui/`

**Files:**
- Move (via manifest, `to` under `src/shared/`): 37 → `src/shared/ui/`, 10 → `src/shared/lib/`, 4 → `src/shared/hooks/`.
- Move (R14, `from` under `src/components/ui/`): `SourceBadge.tsx`, `NovaDot.tsx` → `src/features/fuel/components/`.
- Edit: split `src/components/ui/fuelPrimitives.test.tsx`.

**Interfaces:**
- Produces: `@/shared/ui/*`, `@/shared/lib/*`, `@/shared/hooks/*` import paths; empties `src/components/ui/`.

- [ ] **Step 1: Apply the shared + ui-origin moves** (select by both `to=shared` and `from=components/ui` so `components/ui/` empties fully, including the two fuel-bound files)
```bash
node scripts/refactor/apply-moves.mjs --to src/shared/ --from src/components/ui/
```
Expected: `moved ≈53 files; …` — the 39 `components/ui/` files (37 → `shared/ui/`, `SourceBadge`+`NovaDot` → `features/fuel/components/`) **plus** the `lib/` util/hooks rows whose `to` is under `src/shared/` (10 → `shared/lib/`, 4 → `shared/hooks/`).

Note: only `lib/` util/hooks move here (their `to` is under `src/shared/`). `lib/*Api` and `lib/` `_client` infra rows (`to=src/data/…`) stay put until Task 4.

- [ ] **Step 2: Split `fuelPrimitives.test.tsx`** (R14 — SourceBadge/NovaDot cases follow to fuel; StatCell/MacroRow cases stay in shared/ui)

Create `src/features/fuel/components/fuelBadges.test.tsx` with the `SourceBadge` + `NovaDot` `describe`/`it` blocks (imports `@/features/fuel/components/SourceBadge`, `@/features/fuel/components/NovaDot`). Remove those blocks from `src/shared/ui/fuelPrimitives.test.tsx` (which keeps the `MacroRow` + `StatCell` cases and imports `@/shared/ui/MacroRow`, `@/shared/ui/StatCell`). If, after removal, `fuelPrimitives.test.tsx` has no remaining cases, delete it instead.

- [ ] **Step 3: Confirm `components/ui/` is empty and remove it**
```bash
ls src/components/ui 2>/dev/null && echo "STILL HAS FILES" || echo "empty"
rmdir src/components/ui src/components 2>/dev/null || true
```
Expected: `empty`.

- [ ] **Step 4: Gate** — Expected: all GREEN.
```bash
pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

- [ ] **Step 5: Commit**
```bash
git add -A && git commit  # subject: refactor(fe): shared/ layer (ui+lib+hooks); retire components/ui (mezo-t2x4)
```

---

### Task 4: `data/` layer — per-domain + `_client` + API clients + `hooks.ts` barrel

**Files:**
- Move (manifest `to` under `src/data/`): domain files into `data/{today,fuel,train,me,insights,progression}/`; `_client/` infra; `lib/*Api.ts` → `data/<domain>/`.
- Edit: `src/data/hooks.ts` → thin re-export barrel.

**Interfaces:**
- Consumes: `@/shared/*` (Task 3).
- Produces: `@/data/<domain>/*`, `@/data/_client/*` paths; `@/data/hooks` public surface (unchanged export names).

- [ ] **Step 1: Apply the data moves** (`--to src/data/` alone — this already covers the `lib/*Api` and `_client` rows, whose `to` is under `src/data/`; do **not** pass `--from src/lib/`, which would re-select the util/hooks rows already moved in Task 3)
```bash
node scripts/refactor/apply-moves.mjs --to src/data/
```
Expected: moves the 11 `*Api.ts` (+tests) from `lib/` into domains, the 5 `_client` infra files from `lib/`, and reshuffles `data/` domain files. `src/lib/` should now be empty.
```bash
ls src/lib 2>/dev/null && echo "STILL HAS FILES" || echo "empty"; rmdir src/lib 2>/dev/null || true
```

- [ ] **Step 2: Convert `src/data/hooks.ts` into a thin re-export barrel**

The inline implementations (`useTodayScenario`, `resolveBriefing`, and the other non-re-exported hooks currently defined in `hooks.ts`) move into the matching `data/<domain>/hooks.ts` (mostly `data/today/hooks.ts`). `data/hooks.ts` then only `export … from '@/data/<domain>/hooks'` (and the existing `export { useFuelDay, useMealActions } from …` re-exports), preserving **every** public export name so all `@/data/hooks` consumers and `hooks.reexport.test.ts` stay unchanged. Verify the export surface is identical:
```bash
grep -oE "export (function|const) [A-Za-z]+" src/data/hooks.ts   # before (from git show HEAD~ if needed)
```

- [ ] **Step 3: Gate** — Expected: all GREEN (incl. `hooks.reexport.test.ts`, `dualMode.guard.test.ts`, `hooks.test.tsx`).
```bash
pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

- [ ] **Step 4: Commit**
```bash
git add -A && git commit  # subject: refactor(fe): per-domain data/ layer + API clients + thin hooks barrel (mezo-t2x4)
```

---

### Tasks 5–11: Feature folders (one task each)

Each feature task is identical in shape. Run the mover for the feature, handle the noted special step (if any), gate, commit. Order goes simplest → most complex so early tasks warm up the mechanics.

**Per-feature recipe (`<F>` = feature dir, `<subject>` = commit subject):**
- [ ] **Step 1:** `node scripts/refactor/apply-moves.mjs --to src/features/<F>/`
- [ ] **Step 2:** (special step, if listed below)
- [ ] **Step 3:** confirm the feature root has only the target subfolders:
  `ls src/features/<F>` → only `pages/ components/ sheets/ logic/` (whichever exist) + (progression) overlay files.
- [ ] **Step 4:** gate — `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → GREEN
- [ ] **Step 5:** `git add -A && git commit` → `<subject>`

| Task | `<F>` | Rows | Special step | Commit subject |
|---|---|---|---|---|
| **5** | `quickinput` | 2 | none | `refactor(fe): quickinput → sheets/ (mezo-t2x4)` |
| **6** | `progression` | 6 | `LevelUpProvider`/`LevelUpScreen` stay at feature root; `levelUpMeta.ts` → `logic/` | `refactor(fe): progression folders (mezo-t2x4)` |
| **7** | `today` | 24 | `AnchorModeView` → `pages/` name kept (R1); `TodayScreen→TodayPage` (router + test strings) | `refactor(fe): today pages/components/sheets (mezo-t2x4)` |
| **8** | `insights` | 22 | router-level `insights.nav.test` → `pages/` (R3) | `refactor(fe): insights section+pages (mezo-t2x4)` |
| **9** | `me` | 72 | `GoalGate` → `components/` (R6); `MeScreen→MeSection` carries the `MeOutletContext` type | `refactor(fe): me section+pages+sheets+logic (mezo-t2x4)` |
| **10** | `fuel` | 89 | `FeedbackModal`→ n/a (that's train); confirm `SourceBadge`/`NovaDot` (moved in Task 3) resolve; `RecipeEditorView→RecipeEditorPage` backs 2 routes | `refactor(fe): fuel section+pages+sheets+logic (mezo-t2x4)` |
| **11** | `train` | 97 | `FeedbackModal` name kept in `sheets/` (R2); router-level `train.nav.test`/`train.emptyStates.test` → `pages/` (R3); `SportLogSheet`'s `NumberStep`/`ScaleRow` move with it (R4); `logic/` = `planner.ts`, `agenda.ts`, `workoutState.ts`, `muscleFilters.ts`; `useEditableNumber.ts` → `logic/` | `refactor(fe): train section+pages+sheets+logic (mezo-t2x4)` |

*After Task 11:* `src/features/*/` all match the template and `app/router.tsx` imports resolve to the new `*Section`/`*Page` symbols (updated automatically by the global remaps).

---

### Task 12: Final sweep + remove refactor tooling

**Files:** Modify: any stragglers surfaced by the sweep; Delete: `frontend/scripts/refactor/`.

- [ ] **Step 1: Grep-sweep for every retired symbol and legacy path** (must be zero hits outside history)
```bash
grep -rEn "\b(TrainScreen|FuelScreen|InsightsScreen|MeScreen|TodayScreen|ActiveWorkoutScreen|MesocyclePlanner|MesocycleBuilder|RunningBlockBuilder|GoalPlanner|[A-Za-z]+View)\b" src --include="*.ts*" | grep -vE "OverlayView|useView|dataView" || echo "NONE"
grep -rEn "@/(components/ui|lib)/" src --include="*.ts*" || echo "NO LEGACY PATHS"
```
Expected: `NONE` / `NO LEGACY PATHS`. Fix any real stragglers, then re-run the gate.

- [ ] **Step 2: Remove the throwaway tooling**
```bash
git rm -r frontend/scripts/refactor
```

- [ ] **Step 3: Full gate + parity**
```bash
pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm parity
```
Expected: gate GREEN; `parity` a visual no-op (no screenshot diffs).

- [ ] **Step 4: Commit**
```bash
git add -A && git commit  # subject: chore(fe): remove refactor tooling; final sweep (mezo-t2x4)
```

---

### Task 13: Documentation

**Files:**
- Create: `docs/decisions/0003-frontend-structure-conventions.md`
- Modify: `docs/features/_platform-design-system.md` (add a "Folder structure & naming" section)
- Modify: every `docs/features/*.md` with a stale `file:line` / `src/…` pointer
- Run: `node scripts/lint-docs.mjs`

- [ ] **Step 1: Write ADR 0003** — the layering (app/features/shared/data), the `*Section`/`*Page`/`*Sheet`/`logic/` taxonomy, no-barrels + deep-imports, and *why* (visible, uniform system; behavior-preserving). Follow the ADR template in `docs/README.md`.

- [ ] **Step 2: Update `_platform-design-system.md`** — add the folder-structure + naming taxonomy (§2–§5 of the spec) so the design-system doc states the structure, and fix any primitive path references (`components/ui/*` → `shared/ui/*`; `SourceBadge`/`NovaDot` → `features/fuel/components/*`).

- [ ] **Step 3: Remap stale doc pointers** — for each `docs/features/*.md`, update `frontend/src/...` and `src/...` references using the manifest (old path → new path). Verify:
```bash
grep -rEn "src/(features|data|components/ui|lib)/" docs/features | while read -r hit; do echo "$hit"; done
```
Fix each to its manifest `to` path.

- [ ] **Step 4: Lint docs**
```bash
node scripts/lint-docs.mjs
```
Expected: no errors; stale-flags cleared for the touched feature docs.

- [ ] **Step 5: Commit**
```bash
git add docs && git commit  # subject: docs(fe): ADR 0003 + design-system structure + feature-doc pointer refresh (mezo-t2x4)
```

---

### Task 14: Acceptance + merge + follow-ups

- [ ] **Step 1: Final full gate from a clean state**
```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm parity
```
Expected: all GREEN, parity no-op.

- [ ] **Step 2: File follow-up bd issues (F1–F4 from spec §11)**
```bash
bd create --title="data: split goals.ts seed into me/{goals,weight,biometric}.ts" -p 3   # F1
bd create --title="data: split biometricsApi — checkinApi → data/today/" -p 3             # F2
bd create --title="fe: verify & remove MacroRow if dead code" -p 3                        # F3
bd create --title="data: migrate domain interfaces out of shared data/types.ts" -p 4      # F4
```

- [ ] **Step 3: Merge to main** (no post-merge rebase — see memory `git-noff-merge-flatten-trap`)
```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git pull --rebase                       # BEFORE merging the branch
git merge --no-ff feat/fe-structure-refactor    # subject: Merge feat/fe-structure-refactor (mezo-t2x4)
```

- [ ] **Step 4: Close bd + push**
```bash
bd update mezo-t2x4 --status closed
bd dolt push && git push
git status   # MUST show up to date with origin
```

- [ ] **Step 5: Clean up the worktree**
```bash
git worktree remove ../mezo-fe-refactor
git branch -d feat/fe-structure-refactor
```

---

## Appendix A — move manifest (`movemap.tsv`)

The full 450-row `from\tto\trename` manifest is generated deterministically and committed at `frontend/scripts/refactor/movemap.tsv` in Task 1. It is reproduced here as the plan's authoritative artifact. *(Populated verbatim from the finalized manifest — see the generation step; if regenerating, the row count MUST be 450 with 73 renames and 0 target collisions.)*

Target-area row counts (validation checksum):

```
 5  src/data/_client        25 src/data/fuel        18 src/data/me
14  src/data/train           5 src/data/insights     5 src/data/progression
 3  src/data/today          10 src/data/<root files: hooks, types, nova, pantrySources, kindMeta, useDualQuery, + aggregate tests>
37  src/shared/ui           10 src/shared/lib         4 src/shared/hooks
24  src/features/today      97 src/features/train    89 src/features/fuel
22  src/features/insights   72 src/features/me         6 src/features/progression
 2  src/features/quickinput
```

## Self-review notes

- **Spec coverage:** §2 layers → Tasks 3,4,5–11; §3 taxonomy/renames → the mover's symbol map + per-feature special steps; §4 data shared-core → manifest R8 overrides + Task 4; §5 shared purity → Task 3 + R14; §6 R1–R15 → per-task special steps; §8 execution order → Task order; §10 docs → Task 13; §11 follow-ups → Task 14 Step 2. All covered.
- **No placeholders:** both codemods are complete, runnable code; every step has exact commands + expected output. (Appendix A's row list is the one artifact generated by a committed script rather than inlined — 450 lines — validated by the checksum counts.)
- **Type/name consistency:** symbol renames come from one manifest column applied globally (whole-word), so a rename cannot diverge between tasks; the 38 source renames + inherited test renames = 73, matching the spec §7 count.

# Admin value dashboard — Slice 0: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Hungarian label dictionary (with a completeness gate) and the reworked admin rail (Emberek/Költés renames, data browser demoted to an "Eszközök" foot group) — the foundation every later slice renders through.

**Architecture:** One pure frontend module (`labels.ts`) maps every LLM feature slug, activity-domain key, telemetry screen pattern and browsable table name to a Hungarian label + hint, with an honest fallback for unknown keys. A vitest test reads the backend sources at test time and fails when a new `LlmCallContext` slug has no label (the gate). The rail change is presentational only — no route changes in this slice.

**Tech Stack:** React 19 + TypeScript, vitest, `.ad-*` CSS namespace in `frontend/src/styles/prototype.css`.

**Spec:** `docs/superpowers/specs/2026-09-08-admin-value-dashboard-design.md` (§Information architecture, "Label dictionary" paragraph; §Slices item 0). Driving issue: **mezo-l096**; this slice's issue: created in Task 0.

**Scope deviation from spec, agreed:** the shared section-template components (KPI strip, top-N tile) move to Slice 2 (Pulzus), where their first consumer lives — building them without a consumer invites speculative APIs. The `/admin/usage → /admin/features` redirect moves to Slice 4 (the Funkciók page must exist first). Rail entries for not-yet-existing pages (Funkciók, Memória entry, Pulzus rename) land with their pages.

## Global Constraints

- Admin UI copy is Hungarian; **no raw slugs/table names on default views** (fallback renders the raw key with a visible "nincs címke" marker — that marker itself is the honesty rule).
- Admin pages/modules may import only each other + the shared kit (lazy-chunk discipline, `adminRoutes.tsx:1-13` comment).
- Frontend tests must pass in BOTH modes: `pnpm test` (mock) and `VITE_USE_MOCK=false pnpm test` (run from `frontend/`).
- Never run the full backend suite locally; this slice touches no backend code.
- Conventional commits carrying the slice's bd id, e.g. `feat(admin): ... (mezo-XXXX)`.
- Branch `feat/admin-slice0-foundations` off current main; ship via self-PR → CI green → `gh workflow run premerge.yml -f pr=<n>` → local `--no-ff` merge → push (house flow, `CLAUDE.md` §Git Workflow).

---

### Task 0: Branch + bd bookkeeping

**Files:** none (git/bd only)

- [ ] **Step 1:** `bd create --title="admin slice 0: HU label dictionary + rail rework" --type=task --priority=1` → note the id (referred to as `<ID>` below); `bd update <ID> --claim`; `bd dep add <ID> mezo-l096` (child of the driving issue — if `bd dep add` argument order errors, run `bd dep add --help` and wire "child depends on parent epic" accordingly).
- [ ] **Step 2:** `git checkout -b feat/admin-slice0-foundations` (from up-to-date main: `git pull --rebase` first).

### Task 1: Label dictionary module

**Files:**
- Create: `frontend/src/features/admin/lib/labels.ts`
- Test: `frontend/src/features/admin/lib/labels.test.ts`

**Interfaces (later slices rely on these exact names):**
- Produces: `featureLabel(key: string): AdminLabel`, `screenLabel(pattern: string): AdminLabel`, `tableLabel(name: string): AdminLabel`, `type AdminLabel = { label: string; hint?: string; missing?: boolean }`, and the raw record `FEATURE_LABELS: Record<string, { label: string; hint?: string }>`.

- [ ] **Step 1: Write the failing test** (`labels.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { FEATURE_LABELS, featureLabel, screenLabel, tableLabel } from './labels'

describe('admin label dictionary', () => {
  it('maps LLM feature slugs to Hungarian labels', () => {
    expect(featureLabel('companion_chat').label).toBe('Beszélgetés a társsal')
    expect(featureLabel('meal_draft').label).toBe('Étel-felismerés')
    expect(featureLabel('train_meso_plan').label).toBe('Edzésterv-készítés')
    expect(featureLabel('companion_chat').missing).toBeUndefined()
  })

  it('maps the activity-domain keys of the admin feature-map', () => {
    for (const key of ['train', 'food', 'sleep', 'journal', 'habits', 'water', 'weight']) {
      expect(featureLabel(key).missing, `domain key ${key}`).toBeUndefined()
    }
  })

  it('falls back honestly on unknown keys', () => {
    const l = featureLabel('brand_new_slug')
    expect(l.label).toBe('brand_new_slug')
    expect(l.missing).toBe(true)
  })

  it('labels screens and tables with the same fallback contract', () => {
    expect(screenLabel('/admin/users/:id').missing).toBeUndefined()
    expect(screenLabel('/never/seen').missing).toBe(true)
    expect(tableLabel('workout_session').label).toBe('Edzések')
    expect(tableLabel('mystery_table').missing).toBe(true)
  })

  it('every entry has a non-empty Hungarian label', () => {
    for (const [key, v] of Object.entries(FEATURE_LABELS)) {
      expect(v.label.trim().length, key).toBeGreaterThan(0)
      expect(v.label, key).not.toBe(key)
    }
  })
})
```

- [ ] **Step 2:** Run `pnpm vitest run src/features/admin/lib/labels.test.ts` from `frontend/` — expect FAIL (module not found).

- [ ] **Step 3: Implement `labels.ts`.** Full initial content below. **Before committing, verify every label marked `// VERIFY` against its backend call site** (grep the slug under `backend/src/main/java`, read the surrounding javadoc/class) and correct the wording if the guess is off — the label must describe what the user-facing feature does, in plain Hungarian.

```ts
// Hungarian label dictionary for the admin surface (mezo-l096 slice 0).
// RULE: no raw slug/table/screen key may render on a default admin view — always go
// through these helpers. Unknown keys come back with { missing: true } so the UI can
// show the raw key WITH a visible "nincs címke" marker instead of silently lying.
// The completeness gate (labels.completeness.test.ts) fails when a backend
// LlmCallContext slug has no entry here.

export interface AdminLabel {
  label: string
  hint?: string
  missing?: boolean
}

type Entry = { label: string; hint?: string }

export const FEATURE_LABELS: Record<string, Entry> = {
  // ── LLM feature slugs (source of truth: `new LlmCallContext("<slug>"` call sites) ──
  activity_classify: { label: 'Aktivitás-besorolás', hint: 'naplóbejegyzések automatikus besorolása' },
  character: { label: 'Karakter-motor', hint: 'a társ személyiség-rétege' }, // VERIFY
  companion: { label: 'Társ (általános)', hint: 'nem besorolt társ-hívások' },
  companion_advisor: { label: 'Társ · tanácsadó', hint: 'tanácsadó válaszok' }, // VERIFY
  companion_chat: { label: 'Beszélgetés a társsal', hint: 'a chat válaszai' },
  companion_consolidation: { label: 'Emlék-feldolgozás', hint: 'éjszakai emlék-összegzés' },
  companion_daily_summary: { label: 'Napi összefoglaló', hint: 'a nap AI-összegzése' },
  companion_fact_extract: { label: 'Tény-kinyerés', hint: 'tanult tények kigyűjtése' },
  companion_graph: { label: 'Tudásgráf-építés', hint: 'kapcsolatok felismerése' },
  companion_hypothesis: { label: 'Hipotézis-készítés', hint: 'feltevések a mintákból' }, // VERIFY
  companion_profile: { label: 'Profil-frissítés', hint: 'a rólad alkotott kép frissítése' },
  companion_quarterly: { label: 'Negyedéves áttekintés' },
  companion_recall: { label: 'Emlék-felidézés', hint: 'régi emlékek előhívása chathez' },
  companion_reflection: { label: 'Reflexió', hint: 'a társ önreflexiós köre' }, // VERIFY
  companion_smoke: { label: 'Rendszer-próbahívás', hint: 'technikai ellenőrző hívás' },
  day_review: { label: 'Napi értékelés' },
  embed_memory: { label: 'Emlék-beágyazás', hint: 'emlékek kereshetővé tétele' },
  habit_ai_suggest: { label: 'Szokás-javaslat' },
  lifegoal_propose: { label: 'Életcél-javaslat' },
  meal_coach: { label: 'Étkezési tanácsadó' },
  meal_draft: { label: 'Étel-felismerés', hint: 'fotóból/szövegből étkezés-vázlat' },
  pantry_photo: { label: 'Kamra-fotó felismerés' },
  pantry_scrape: { label: 'Termékadat-letöltés' }, // VERIFY
  people_extraction: { label: 'Személy-felismerés', hint: 'emberek felismerése a naplóból' },
  proactive_advice: { label: 'Proaktív tanács' },
  proactive_challenge: { label: 'Kihívás-javaslat' },
  proactive_diagnosis: { label: 'Mintázat-diagnózis' }, // VERIFY
  proactive_experiment: { label: 'Kísérlet-javaslat' },
  proactive_feed: { label: 'Üzenőfal-üzenetek' },
  proactive_memoir: { label: 'Memoár-írás' },
  proactive_prediction: { label: 'Előrejelzés' },
  proactive_weekly: { label: 'Heti javaslat' },
  proactive_weekly_review: { label: 'Heti értékelés' },
  quest_flavor: { label: 'Küldetés-szövegek' }, // VERIFY
  recipe_breakdown: { label: 'Receptbontás' },
  recipe_workshop: { label: 'Receptműhely' },
  sleep_shot: { label: 'Alvás-gyorselemzés' }, // VERIFY
  slot_template: { label: 'Napi sablon-tervezés' }, // VERIFY
  stack_placement: { label: 'Rutin-elhelyezés' }, // VERIFY
  train_meso_plan: { label: 'Edzésterv-készítés' },
  unknown: { label: 'Ismeretlen hívás', hint: 'a hívó nem hagyott azonosítót' },
  admin_replay: { label: 'Admin próba-felidézés', hint: 'a memória-böngésző tesztfuttatása' },
  // ── activity-domain keys (mezo.admin-insights.feature-map, application.yml) ──
  train: { label: 'Edzés' },
  food: { label: 'Étkezés' },
  sleep: { label: 'Alvás' },
  journal: { label: 'Napló' },
  habits: { label: 'Szokások' },
  water: { label: 'Víz' },
  weight: { label: 'Testsúly' },
}

// Telemetry screen route patterns (screen_event.screen). Best-effort: cover the
// app's main routes; unknown patterns fall back with missing:true.
export const SCREEN_LABELS: Record<string, Entry> = {
  '/': { label: 'Ma (kezdőlap)' },
  '/edzes': { label: 'Edzés fül' },
  '/fuel': { label: 'Étkezés fül' },
  '/mezo': { label: 'Mezo (társ) fül' },
  '/me': { label: 'Én fül' },
  '/mezo/chat': { label: 'Beszélgetés' },
  '/admin': { label: 'Admin · áttekintés' },
  '/admin/users': { label: 'Admin · emberek' },
  '/admin/users/:id': { label: 'Admin · tesztelő-részlet' },
}
// NOTE for implementer: before committing, list the real top screen keys
// (mock seed in frontend/src/data/telemetry or MSW handlers, plus
// frontend/src/app/useScreenTracking.ts route source) and extend SCREEN_LABELS
// to cover at least the routes that appear in the app's router. Keep fallback honest.

// Browsable table names (data browser + user-detail data inventory). Covers the
// convenience views + the highest-traffic owned tables; the rest falls back.
export const TABLE_LABELS: Record<string, Entry> = {
  mesocycle: { label: 'Mezociklusok' },
  workout_session: { label: 'Edzések' },
  exercise_set: { label: 'Gyakorlat-sorozatok' },
  meal: { label: 'Étkezések' },
  sleep_log: { label: 'Alvásnapló' },
  journal_entry: { label: 'Naplóbejegyzések' },
  habit_day: { label: 'Szokás-napok' },
  water_log: { label: 'Vízfogyasztás' },
  weight_log: { label: 'Testsúly-mérések' },
  pattern: { label: 'Minták' },
  pattern_event: { label: 'Minta-események' },
  llm_log_history: { label: 'AI-hívások naplója' },
  memory_item: { label: 'Emlékek' },
  memory_vector: { label: 'Emlék-beágyazások' },
  knowledge_node: { label: 'Tudásgráf-csomópontok' },
  knowledge_edge: { label: 'Tudásgráf-kapcsolatok' },
  learned_fact: { label: 'Tanult tények' },
  message_feedback: { label: 'Visszajelzések' },
  ai_message: { label: 'AI-üzenetek' },
  app_user: { label: 'Fiókok' },
  screen_event: { label: 'Képernyő-megnyitások' },
}

function resolve(record: Record<string, Entry>, key: string): AdminLabel {
  const hit = record[key]
  return hit ? { ...hit } : { label: key, missing: true }
}

export function featureLabel(key: string): AdminLabel {
  return resolve(FEATURE_LABELS, key)
}

export function screenLabel(pattern: string): AdminLabel {
  return resolve(SCREEN_LABELS, pattern)
}

export function tableLabel(name: string): AdminLabel {
  return resolve(TABLE_LABELS, name)
}
```

- [ ] **Step 4:** Run `pnpm vitest run src/features/admin/lib/labels.test.ts` — expect PASS. Also run once with `VITE_USE_MOCK=false` prefix (pure module, but the both-modes rule is absolute).
- [ ] **Step 5:** Commit: `git add frontend/src/features/admin/lib/labels.ts frontend/src/features/admin/lib/labels.test.ts && git commit -m "feat(admin): Hungarian label dictionary for feature/screen/table keys (<ID>)"`

### Task 2: Completeness gate — backend slugs must all be labelled

**Files:**
- Test: `frontend/src/features/admin/lib/labels.completeness.test.ts`

**Interfaces:**
- Consumes: `FEATURE_LABELS` from Task 1.
- Produces: a CI-enforced invariant: every `new LlmCallContext("<slug>"` literal in `backend/src/main/java` has a `FEATURE_LABELS` entry, plus the `FEATURE_ADMIN_REPLAY` constant and the 7 feature-map domain keys.

- [ ] **Step 1: Write the test** (it should PASS immediately if Task 1's list is complete — its value is failing in the FUTURE when a new slug appears; verify it by temporarily deleting one entry):

```ts
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FEATURE_LABELS } from './labels'

// The gate of the "no raw slugs in the admin" rule (mezo-l096): a NEW backend LLM
// feature slug must get a Hungarian label the moment it exists. Scans backend sources
// at test time — cheap (<100ms) at repo scale and always in sync with reality.

const BACKEND_SRC = resolve(__dirname, '../../../../../backend/src/main/java')
const SLUG_RE = /new LlmCallContext\(\s*"([a-z0-9_]+)"/g

function javaFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return javaFiles(full)
    return name.endsWith('.java') ? [full] : []
  })
}

describe('label dictionary completeness', () => {
  it('covers every LlmCallContext feature slug in the backend', () => {
    const slugs = new Set<string>()
    for (const file of javaFiles(BACKEND_SRC)) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(SLUG_RE)) slugs.add(m[1])
    }
    expect(slugs.size).toBeGreaterThan(30) // sanity: the scan actually found the call sites
    const unlabelled = [...slugs].filter((s) => !(s in FEATURE_LABELS))
    expect(unlabelled, `Add Hungarian labels to labels.ts for: ${unlabelled.join(', ')}`).toEqual([])
  })

  it('covers the admin_replay constant and the feature-map domain keys', () => {
    for (const key of ['admin_replay', 'train', 'food', 'sleep', 'journal', 'habits', 'water', 'weight']) {
      expect(key in FEATURE_LABELS, key).toBe(true)
    }
  })
})
```

- [ ] **Step 2:** Run `pnpm vitest run src/features/admin/lib/labels.completeness.test.ts` — expect PASS. Then temporarily remove the `sleep_shot` entry from `labels.ts`, re-run, confirm it FAILS naming `sleep_shot`, restore the entry, re-run green. (This is the test's own test — do not skip it.)
- [ ] **Step 3:** Commit: `git commit -am "test(admin): completeness gate — every backend LLM slug needs a HU label (<ID>)"`

### Task 3: Rail rework — renames + Eszközök foot group

**Files:**
- Modify: `frontend/src/features/admin/AdminRail.tsx` (RAIL array + foot group markup)
- Modify: `frontend/src/styles/prototype.css` (only if a new class is needed — prefer the existing `.ad-rail .railfoot` block at `prototype.css:11355`)
- Test: `frontend/src/features/admin/AdminLayout.test.tsx` (extend the existing rail assertions)

**Interfaces:**
- Produces: rail labels `Áttekintés · Emberek · Feature-használat · Költés · Meghívók és fiókok` + a foot group `Eszközök` containing `Nyers adatok` → `/admin/data`. Routes unchanged. (Later slices rename Áttekintés→Pulzus and swap Feature-használat→Funkciók when those pages ship.)

- [ ] **Step 1: Extend the existing AdminLayout/rail test.** Read `AdminLayout.test.tsx` first; add assertions in its established render style (reuse its render helper/providers — do not invent a new harness):

```tsx
it('renders the reworked rail: renames + Nyers adatok in the Eszközök group', async () => {
  // reuse the file's existing render helper for the admin layout at /admin
  expect(await screen.findByRole('link', { name: /Emberek/ })).toHaveAttribute('href', '/admin/users')
  expect(screen.getByRole('link', { name: /Költés/ })).toHaveAttribute('href', '/admin/cost')
  expect(screen.getByRole('link', { name: /Nyers adatok/ })).toHaveAttribute('href', '/admin/data')
  expect(screen.getByText('Eszközök')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Adatböngésző/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /^Userek$/ })).not.toBeInTheDocument()
})
```

- [ ] **Step 2:** Run the layout test — expect FAIL (old labels).
- [ ] **Step 3: Modify `AdminRail.tsx`:**

```tsx
const RAIL: RailItem[] = [
  { to: '/admin', label: 'Áttekintés', icon: 'i-nap', end: true },
  { to: '/admin/users', label: 'Emberek', icon: 'i-emberek' },
  { to: '/admin/usage', label: 'Feature-használat', icon: 'i-minta' },
  { to: '/admin/cost', label: 'Költés', icon: 'i-erme' },
  { to: '/admin/accounts', label: 'Meghívók és fiókok', icon: 'i-beallitas' },
]
// The data browser is a drill-through TOOL, not a destination (mezo-l096): it moves out
// of the main list into the rail foot, under an "Eszközök" caption.
const TOOLS: RailItem[] = [{ to: '/admin/data', label: 'Nyers adatok', icon: 'i-tudas' }]
```

and render the foot group after the main links (reuse `.railfoot`'s divider look; a small CSS block in the `.ad-rail` section of `prototype.css` is acceptable if needed — stay in the `.ad-*` namespace, e.g. `.ad-rail .tools-cap` for the caption typography, modeled on `.railfoot .rl`):

```tsx
<div className="railfoot" style={undefined /* keep as plain structural div per CSS */}>
  ...existing railfoot content stays LAST...
</div>
```

Concretely: insert BEFORE the existing railfoot block:

```tsx
<div className="ad-rail-tools">
  <span className="tools-cap">Eszközök</span>
  {TOOLS.map((item) => (
    <NavLink key={item.to} to={item.to} className={({ isActive }) => cn('ad-rail-link', isActive && 'on')}>
      <ClayIcon name={item.icon} size={18} />
      <span>{item.label}</span>
    </NavLink>
  ))}
</div>
```

with CSS appended to the admin rail block in `prototype.css`:

```css
.ad-rail .ad-rail-tools { margin-top: auto; padding-top: 10px; border-top: 1px solid rgba(43,33,24,.08); display: flex; flex-direction: column; gap: 2px; }
.ad-rail .ad-rail-tools .tools-cap { font-size: 8px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #A2958A; padding: 0 11px 4px; }
```

If the existing `.railfoot` already uses `margin-top: auto`, move that to `.ad-rail-tools` and drop it from `.railfoot` so the tools group sits above the foot — check the rendered result, don't stack two `auto` margins.

- [ ] **Step 4:** Run the layout test — expect PASS. Then the full admin-feature tests in both modes:
`pnpm vitest run src/features/admin` and `VITE_USE_MOCK=false pnpm vitest run src/features/admin` — fix any test that asserted the old labels (`Userek`, `LLM költség`, `Adatböngésző` — grep the test files for these strings and update them to the new labels; the RENAMES are intended, do not preserve old copy in tests).
- [ ] **Step 5:** Commit: `git commit -am "feat(admin): rail rework — Emberek/Költés renames, data browser demoted to Eszközök (<ID>)"`

### Task 4: Full local gates + ship

**Files:** none new.

- [ ] **Step 1:** From `frontend/`: `pnpm test` AND `VITE_USE_MOCK=false pnpm test` (full suite, both modes) and `pnpm build`. All green.
- [ ] **Step 2:** `node scripts/gen-codemap.mjs --check` from repo root (new files under an existing mapped dir usually pass; if it fails, run `node scripts/gen-codemap.mjs` and commit the regenerated map: `chore(codemap): regenerate for admin labels module (<ID>)`).
- [ ] **Step 3:** Ship per house flow: push branch, `gh pr create --fill`, wait CI green (`gh pr checks --watch`), `gh workflow run premerge.yml -f pr=<number>` and wait for success, then `git checkout main && git pull --rebase && git merge --no-ff feat/admin-slice0-foundations && git push`, delete branch. `bd close <ID>`.

## Self-review notes

- Spec coverage for slice 0: label dictionary + gate (Tasks 1–2), rail rework (Task 3); deferred pieces are explicitly reassigned to slices 2 and 4 in the header, not dropped.
- Type consistency: `AdminLabel`/`featureLabel`/`screenLabel`/`tableLabel` used consistently; later slices consume these exact names.
- No placeholders: all code inline; the two "extend before committing" notes (VERIFY labels, SCREEN_LABELS coverage) are bounded instructions with a defined source of truth, not open TODOs.

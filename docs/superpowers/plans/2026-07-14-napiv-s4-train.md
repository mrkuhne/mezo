# Napív Redesign — S4 Train Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Train domain to the Napív vocabulary — scrollable coral pill sub-nav, Napív page heads, the Mai screen rebuilt per the mockup (coral-gradient train hero, weekly load tiles, day-card weekly plan with type tags, "MA" row ringed coral, dashed rest days), and in-vocabulary re-skins of Sport (rose) / Futás (sky) / Gym (coral) / Gyakorlatok / Mesociklusok. Content model, routes, hooks, and behavior unchanged; both test modes green after every task.

**Architecture:** New shared Napív classes (`.np-pills`, `.pghead-np`, `.stag-*`, `.loadrow/.loadtile`, `.dayrow`, `.trainhero`) append to the Napív section of `prototype.css`, driven by new train-type accent tokens (`--wash-gym/-sport/-run`, `--tag-gym/-sport/-run`). Pure load-summary math goes in `features/train/logic/weeklyLoad.ts`; a new `LoadTiles` presentational component in `features/train/components/`. Existing pages/components are restyled in place — no file moves, no prop/contract changes. The pill nav + page head classes are built accent-parametric (`--pill-accent`) so S6 Fuel (sage) and S7 Me (lavender) adopt them later without rework.

**Tech Stack:** React 19, TanStack Query hooks via `@/data/hooks` (signatures untouched), plain CSS in `frontend/src/styles/prototype.css`, Vitest + RTL. Driving spec §4.3: `docs/superpowers/specs/2026-07-13-napiv-frontend-redesign-design.md`. Interactive reference: `docs/superpowers/specs/2026-07-13-napiv-redesign-mockup.html` (Train screen, `#v-train`, lines ~460–540).

## Global Constraints

- Worktree `/Users/daniel.kuhne/MrKuhne/mezo/.worktrees/frontend-design-rethink`, branch `feat/frontend-design-rethink`, bd **mezo-8141**. Verify `git rev-parse --show-toplevel` before every commit; NEVER touch the main checkout.
- Commit with hooks disabled: `git -c core.hooksPath=/dev/null commit -m "... (mezo-8141)"`. Stage explicit paths only — never `git add .` or `-a` (a bd-managed `.beads/issues.jsonl` change may sit in the working tree).
- Gate after EVERY task: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (both modes green) + `node scripts/lint-docs.mjs` PASS when a doc/key_file was touched.
- Conventions: no `*Screen`/`*View`; data hooks only from `@/data/hooks`; no barrels; deep `@/*` imports; colocated tests; `shared/ui` untouched (Train pages stop importing `Eyebrow`/`PageTitle` where re-skinned, but those primitives stay for other features).
- Hungarian copy, sentence case, active verbs. Exact strings given below are binding.
- **Gutter rule (S3 lesson):** the app's `.screen-content` has NO horizontal padding — every new full-width Napív block must carry its own **24px** horizontal gutter (margin or padding). The mockup's 18px container gutter translates to the house 24px.
- **jsdom hazard:** any node with `.np-anim` starts at `opacity:0` and jsdom never completes keyframes — tests MUST assert presence (`getByText`/`querySelector`), never `toBeVisible()` on `.np-anim` nodes.
- Dual-mode honesty: real mode must never show mock-seed data; ghost/skeleton/error triads stay exactly as they are (`TrainTodaySkeleton`, `GhostState` empty states, `activeMeso`-null ghosting).
- Accent discipline (design-system doc §9): **washes** (backgrounds) get `:root[data-theme="dark"]` overrides; **fg accents stay theme-invariant**.

---

### Task 1: Napív pill sub-nav + page-head vocabulary (CSS + TrainSubNav)

**Files:**
- Modify: `frontend/src/styles/prototype.css` (Napív section, before the trailing safe-area block)
- Modify: `frontend/src/features/train/pages/tabs.ts` (label `GYM` → `Gym`)
- Modify: `frontend/src/features/train/pages/TrainSubNav.tsx` + `TrainSubNav.test.tsx`
- Modify: `frontend/src/features/train/pages/train.nav.test.tsx` (`GYM` link name + `.subnav` selectors)

**Interfaces:**
- Produces CSS classes later tasks rely on verbatim: `.np-pills`, `.np-pill`, `.np-pill.on`, `.pghead-np` (+ `.over`, `h1`), `.pgact-np`, `.stag`/`.stag-gym`/`.stag-sport`/`.stag-run`, tokens `--wash-gym/-sport/-run`, `--tag-gym/-sport/-run`, `--pill-accent`.
- `TrainSubNav()` keeps its no-prop signature and `aria-label="Train alnavigáció"`; active state class changes `.subnav-item.active` → `.np-pill.on`.

- [ ] **Step 1: Append the token + component CSS** to the Napív section of `prototype.css` (after the S3 blocks, before the safe-area `@media`):

```css
/* ===== Napív S4 — train-type accent tokens (mockup stag/lic palette) ===== */
:root {
  --wash-gym: #FFEDE6;
  --wash-sport: #FBE9EC;
  --wash-run: #E7F0F8;
  --tag-gym: #C4622F;
  --tag-sport: #B14B5E;
  --tag-run: #3E6E9E;
}
:root[data-theme="dark"] {
  --wash-gym: rgba(255,107,74,.16);
  --wash-sport: rgba(226,122,139,.16);
  --wash-run: rgba(111,167,216,.16);
}

/* ===== Napív pill sub-nav (spec §4.3; Fuel/Me adopt later via --pill-accent) ===== */
.np-pills { display: flex; gap: 7px; padding: 8px 24px 10px; overflow-x: auto; scrollbar-width: none; position: sticky; top: 0; z-index: 5; background: var(--canvas); -webkit-mask-image: linear-gradient(to right, black 92%, transparent); mask-image: linear-gradient(to right, black 92%, transparent); }
.np-pills::-webkit-scrollbar { display: none; }
.np-pill { flex-shrink: 0; border-radius: 999px; padding: 10px 16px; font-size: 13px; font-weight: 700; color: var(--sub); background: rgba(255,255,255,.75); border: 1px solid rgba(43,33,24,.05); white-space: nowrap; }
:root[data-theme="dark"] .np-pill { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.08); }
.np-pill.on { color: #fff; border-color: transparent; background: var(--pill-accent, var(--coral)); }

/* ===== Napív page head (pgheadrow — Train sub-pages; Fuel/Me adopt later) ===== */
.pghead-np { display: flex; justify-content: space-between; align-items: flex-end; padding: 10px 24px 0; }
.pghead-np .over { font-size: 11px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--coral-deep); }
.pghead-np h1 { font-family: var(--ff-display); font-weight: 800; letter-spacing: -.4px; font-size: 27px; color: var(--ink); }
.pgact-np { border: 0; cursor: pointer; font: inherit; border-radius: 999px; padding: 8px 14px; font-size: 12px; font-weight: 800; background: var(--warm); color: var(--coral-deep); white-space: nowrap; }

/* ===== Napív session type tags (weekly plan + session rows) ===== */
.stag { display: inline-block; border-radius: 8px; padding: 3px 7px; font-size: 9px; font-weight: 800; letter-spacing: .5px; flex-shrink: 0; text-transform: uppercase; }
.stag-gym { background: var(--wash-gym); color: var(--tag-gym); }
.stag-sport { background: var(--wash-sport); color: var(--tag-sport); }
.stag-run { background: var(--wash-run); color: var(--tag-run); }
```

- [ ] **Step 2:** In `tabs.ts` change `{ id: 'gym', to: '/train/gym', label: 'GYM' }` → `label: 'Gym'` (mockup copy). Update the two test files that reference the `GYM` link name (`TrainSubNav.test.tsx`, `train.nav.test.tsx`) — do it test-first so the label change is pinned:

`TrainSubNav.test.tsx` becomes:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TrainSubNav } from '@/features/train/pages/TrainSubNav'

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><TrainSubNav /></MemoryRouter>)
}

test('renders all six pills with verbatim labels', () => {
  renderAt('/train')
  for (const label of ['Mai', 'Gym', 'Sport', 'Futás', 'Gyakorlatok', 'Mesociklusok']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  }
})

test('marks the active sub-view from the URL', () => {
  const { container } = renderAt('/train/sport')
  expect(container.querySelector('.np-pill.on')).toHaveTextContent('Sport')
})

test('Mai (index) is active only on exact /train', () => {
  const { container } = renderAt('/train/gym')
  expect(container.querySelector('.np-pill.on')).toHaveTextContent('Gym')
})
```

In `train.nav.test.tsx`: the click target `{ name: 'GYM' }` → `{ name: 'Gym' }`; every `container.querySelector('.subnav')` assertion → `.np-pills`.

- [ ] **Step 3:** Run the two test files → FAIL (old labels/classes still rendered).
- [ ] **Step 4: Rewrite `TrainSubNav.tsx`:**

```tsx
import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { TRAIN_TABS } from '@/features/train/pages/tabs'

export function TrainSubNav() {
  return (
    <nav className="np-pills" aria-label="Train alnavigáció">
      {TRAIN_TABS.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => cn('np-pill np-press', isActive && 'on')}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 5:** Both test files → PASS. Grep for other tests asserting `subnav-item` or the `GYM` label (`grep -rn "subnav-item\|'GYM'" frontend/src`) and fix any stragglers the same way. Full gate both modes → PASS.
- [ ] **Step 6: Commit** — `git add frontend/src/styles/prototype.css frontend/src/features/train/pages/tabs.ts frontend/src/features/train/pages/TrainSubNav.tsx frontend/src/features/train/pages/TrainSubNav.test.tsx frontend/src/features/train/pages/train.nav.test.tsx && git -c core.hooksPath=/dev/null commit -m "feat(fe/train): Napiv coral pill sub-nav + page-head/type-tag vocabulary (mezo-8141)"`

---

### Task 2: `weeklyLoad` pure logic

**Files:**
- Create: `frontend/src/features/train/logic/weeklyLoad.ts`
- Test: `frontend/src/features/train/logic/weeklyLoad.test.ts`

**Interfaces:**
- Consumes: `WeeklyAgendaDay` from `@/features/train/components/WeeklyDayRow` (existing; only the `gym`/`volleyball`/`running` fields).
- Produces (Task 3 + Task 5 consume exactly these):
  - `type LoadTile = { kind: 'gym' | 'sport' | 'run'; label: string; icon: string; value: string }`
  - `weeklyLoad(agenda: Pick<WeeklyAgendaDay, 'gym' | 'volleyball' | 'running'>[]): LoadTile[]` — one tile per active modality, `[]` when the week is empty.

- [ ] **Step 1: Write the failing test** (`weeklyLoad.test.ts`):

```ts
import { weeklyLoad } from '@/features/train/logic/weeklyLoad'
import type { WeeklyAgendaDay } from '@/features/train/components/WeeklyDayRow'

type Day = Pick<WeeklyAgendaDay, 'gym' | 'volleyball' | 'running'>
const gym = (duration: number | null): Day['gym'] => ({ day: 'Hét', type: 'Push', time: '07:30', duration, active: true }) as unknown as Day['gym']
const vb = (duration: number): Day['volleyball'] => ({ day: 'Hét', time: '18:15', duration }) as unknown as Day['volleyball']
const run = (kind: 'sprint' | 'pyramid'): Day['running'][number] => ({ key: `r-${kind}`, label: 'Futás', kind, rpeTarget: { min: 8, max: 9 } }) as unknown as Day['running'][number]
const day = (p: Partial<Day>): Day => ({ gym: null, volleyball: null, running: [], ...p })

test('summarizes the mockup week: 5 gym @75p, 4 röpi totaling 6,5h, 2 sprint runs', () => {
  const agenda: Day[] = [
    day({ gym: gym(75), volleyball: vb(90) }),
    day({ gym: gym(75), volleyball: vb(90), running: [run('sprint')] }),
    day({ gym: gym(75) }),
    day({ gym: gym(75), volleyball: vb(90), running: [run('sprint')] }),
    day({ gym: gym(75), volleyball: vb(120) }),
  ]
  expect(weeklyLoad(agenda)).toEqual([
    { kind: 'gym', label: 'Gym', icon: '🏋️', value: '5× · 75p' },
    { kind: 'sport', label: 'Röplabda', icon: '🏐', value: '4× · 6,5h' },
    { kind: 'run', label: 'Futás', icon: '🏃', value: '2× · sprint' },
  ])
})

test('omits absent modalities and formats whole hours without a decimal', () => {
  const tiles = weeklyLoad([day({ volleyball: vb(60) }), day({ volleyball: vb(60) })])
  expect(tiles).toEqual([{ kind: 'sport', label: 'Röplabda', icon: '🏐', value: '2× · 2h' }])
})

test('gym without durations falls back to the bare count and empty week yields no tiles', () => {
  expect(weeklyLoad([day({ gym: gym(null) })])).toEqual([
    { kind: 'gym', label: 'Gym', icon: '🏋️', value: '1×' },
  ])
  expect(weeklyLoad([day({}), day({})])).toEqual([])
})
```

- [ ] **Step 2:** `cd frontend && pnpm vitest run src/features/train/logic/weeklyLoad.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `weeklyLoad.ts`:

```ts
import type { WeeklyAgendaDay } from '@/features/train/components/WeeklyDayRow'

/** Weekly load summary tiles (spec §4.3 — "GYM 5×·75p / RÖPLABDA 4×·6,5h / FUTÁS 2×"). */
export type LoadTile = { kind: 'gym' | 'sport' | 'run'; label: string; icon: string; value: string }

/** 390 → "6,5h" (hu decimal comma), 120 → "2h". */
function hoursHu(mins: number): string {
  const rounded = Math.round((mins / 60) * 10) / 10
  const s = rounded.toString().replace('.', ',')
  return `${s}h`
}

export function weeklyLoad(agenda: Pick<WeeklyAgendaDay, 'gym' | 'volleyball' | 'running'>[]): LoadTile[] {
  const tiles: LoadTile[] = []

  const gymDays = agenda.filter((a) => a.gym)
  if (gymDays.length) {
    const durs = gymDays.map((a) => a.gym!.duration).filter((d): d is number => d != null)
    const avg = durs.length ? Math.round(durs.reduce((x, y) => x + y, 0) / durs.length) : null
    tiles.push({ kind: 'gym', label: 'Gym', icon: '🏋️', value: avg ? `${gymDays.length}× · ${avg}p` : `${gymDays.length}×` })
  }

  const vbDays = agenda.filter((a) => a.volleyball)
  if (vbDays.length) {
    const total = vbDays.reduce((x, a) => x + (a.volleyball!.duration ?? 0), 0)
    tiles.push({ kind: 'sport', label: 'Röplabda', icon: '🏐', value: total ? `${vbDays.length}× · ${hoursHu(total)}` : `${vbDays.length}×` })
  }

  const runs = agenda.flatMap((a) => a.running)
  if (runs.length) {
    const kind = runs.some((r) => r.kind === 'sprint') ? 'sprint' : 'piramis'
    tiles.push({ kind: 'run', label: 'Futás', icon: '🏃', value: `${runs.length}× · ${kind}` })
  }

  return tiles
}
```

(Adapt the test factory casts to the real `GymScheduleDay`/`VolleyballSession`/`RunPrescribedSession` shapes — read `@/data/types` and `@/data/train/runningApi` first; if a cast can be dropped because the real shape is small, drop it and note it.)

- [ ] **Step 4:** Test file → PASS. Full gate both modes → PASS.
- [ ] **Step 5: Commit** — `git add frontend/src/features/train/logic/ && git -c core.hooksPath=/dev/null commit -m "feat(fe/train): weeklyLoad summary logic for the Mai load tiles (mezo-8141)"`

---

### Task 3: `LoadTiles` component + tile CSS

**Files:**
- Create: `frontend/src/features/train/components/LoadTiles.tsx`
- Test: `frontend/src/features/train/components/LoadTiles.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `LoadTile` from `@/features/train/logic/weeklyLoad` (Task 2).
- Produces: `LoadTiles({ tiles }: { tiles: LoadTile[] })` — Task 5 mounts it on Mai. Renders `null` for an empty array (real-mode ghost behavior); otherwise `.loadrow` of `.loadtile` items (icon chip `.lic.lic-{kind}` + `.lk` label + `.lva` value).

- [ ] **Step 1: Failing test** (`LoadTiles.test.tsx`):

```tsx
import { render, screen } from '@testing-library/react'
import { LoadTiles } from '@/features/train/components/LoadTiles'

const TILES = [
  { kind: 'gym' as const, label: 'Gym', icon: '🏋️', value: '5× · 75p' },
  { kind: 'sport' as const, label: 'Röplabda', icon: '🏐', value: '4× · 6,5h' },
]

test('renders one tile per modality with label and value', () => {
  const { container } = render(<LoadTiles tiles={TILES} />)
  expect(container.querySelectorAll('.loadtile')).toHaveLength(2)
  expect(screen.getByText('5× · 75p')).toBeInTheDocument()
  expect(screen.getByText('Röplabda')).toBeInTheDocument()
  expect(container.querySelector('.lic-gym')).not.toBeNull()
})

test('renders nothing when the week is empty', () => {
  const { container } = render(<LoadTiles tiles={[]} />)
  expect(container.firstChild).toBeNull()
})
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** `LoadTiles.tsx`:

```tsx
import type { LoadTile } from '@/features/train/logic/weeklyLoad'

const LIC: Record<LoadTile['kind'], string> = { gym: 'lic lic-gym', sport: 'lic lic-sport', run: 'lic lic-run' }

export function LoadTiles({ tiles }: { tiles: LoadTile[] }) {
  if (!tiles.length) return null
  return (
    <div className="loadrow">
      {tiles.map((t) => (
        <div key={t.kind} className="loadtile">
          <div className={LIC[t.kind]} aria-hidden="true">{t.icon}</div>
          <div>
            <div className="lk">{t.label}</div>
            <div className="lva">{t.value}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Append the tile CSS** (Napív section, before the safe-area block):

```css
/* ===== Napív weekly load tiles (Mai, spec §4.3) ===== */
.loadrow { display: flex; gap: 9px; margin: 14px 24px 0; }
.loadtile { flex: 1; border-radius: 18px; padding: 10px 11px; display: flex; align-items: center; gap: 9px; background: var(--surface); box-shadow: var(--np-shadow-row); min-width: 0; }
.loadtile .lic { width: 32px; height: 32px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.loadtile .lic-gym { background: var(--wash-gym); }
.loadtile .lic-sport { background: var(--wash-sport); }
.loadtile .lic-run { background: var(--wash-run); }
.loadtile .lk { font-size: 9.5px; font-weight: 800; color: var(--faint); letter-spacing: .3px; text-transform: uppercase; }
.loadtile .lva { font-size: 13.5px; font-weight: 800; font-family: var(--ff-display); margin-top: 1px; color: var(--ink); white-space: nowrap; }
```

- [ ] **Step 5:** Test → PASS; full gate both modes → PASS. **Step 6: Commit** — `git add frontend/src/features/train/components/LoadTiles.tsx frontend/src/features/train/components/LoadTiles.test.tsx frontend/src/styles/prototype.css && git -c core.hooksPath=/dev/null commit -m "feat(fe/train): LoadTiles weekly load summary component (mezo-8141)"`

---

### Task 4: `WeeklyDayRow` → Napív `.dayrow` day card

**Files:**
- Modify: `frontend/src/features/train/components/WeeklyDayRow.tsx` + `WeeklyDayRow.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- `WeeklyAgendaDay` type and ALL props (`agenda`, `gymLogged`, `vbLogged`, `isRunLogged`, `onStartGym`, `onLogVolleyball`, `onLogRun`) UNCHANGED — Task 5's page keeps passing them verbatim.
- Behavior contracts that MUST survive (they are tested): each session renders as a `<button>`; today's sessions are clickable (gym → `onStartGym`, volleyball → `onLogVolleyball`, run → `onLogRun`); done state shows `kész`, today-not-done volleyball/run shows `log`; empty day renders a rest row.

- [ ] **Step 1: Update the test FIRST** (failing): keep every behavior assertion (button clicks fire callbacks, `kész`/`log` chips, rest-day presence) and change only structure/class assertions: root is `.dayrow` (`.dayrow.today` when `isToday`, `.dayrow.rest` when no sessions); the day label sits in `.d` (with a nested `MA` marker when today); each session row carries a `.stag` type tag (`.stag-gym`/`.stag-sport`/`.stag-run`); rest day copy becomes `Pihenőnap` (replaces `rest day` — assert the new string).
- [ ] **Step 2:** Run → FAIL. **Step 3: Restyle the component.** Target structure (keep the existing `daySessions` ordering, done-state logic, and all callbacks — only markup/classes change):

```tsx
<div className={cn('dayrow', isToday && 'today', !hasContent && 'rest')}>
  <div className="d">
    {day}
    {isToday && <small>MA</small>}
  </div>
  <div className="sess">
    {!hasContent && <div className="s"><span className="meta">Pihenőnap</span></div>}
    {sessions.map(...)   /* each item: */}
      <button key={...} type="button" className="s" onClick={isToday ? handler : undefined}>
        <span className="stag stag-gym">GYM</span>       {/* sport → RÖPI · stag-sport, run → FUTÁS · stag-run */}
        {isToday ? <b>{title}</b> : title}
        <span className="meta">{metaLine}</span>          {/* pl. "07:30 · 75p · mell-fókusz" */}
        {doneOrLogChip}                                   {/* kész (sage) / log (type accent) — keep exact strings */}
      </button>
  </div>
  <span className="chev" aria-hidden="true">›</span>
</div>
```

Meta lines from the existing data joins: gym `[time, duration && `${duration}p`, type]`, volleyball `[time, `${duration}p`, role/intensity]`, run `[timeOfDay, RPE range, rounds]` — reuse the current join logic, just render into one `.meta` span. Done/log chips: reuse the existing conditional logic; restyle as small `.stag`-shaped spans — done: `background: #EAF0E3; color: var(--sage-deep)` (matches `.beat.done`), log: the row's wash/tag pair.

- [ ] **Step 4: Append the day-card CSS:**

```css
/* ===== Napív weekly plan day cards (Mai, spec §4.3) ===== */
.dayrow { display: flex; align-items: center; background: var(--surface); border-radius: 20px; padding: 12px 15px; box-shadow: var(--np-shadow-row); margin-bottom: 9px; }
.dayrow .d { width: 48px; font-size: 11px; font-weight: 800; color: var(--faint); flex-shrink: 0; text-transform: uppercase; }
.dayrow .d small { display: block; font-size: 9px; color: var(--coral-deep); }
.dayrow .sess { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dayrow .sess .s { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--ink); background: none; border: 0; padding: 0; text-align: left; font-family: inherit; width: 100%; cursor: inherit; }
.dayrow .sess .s .meta { color: var(--faint); font-weight: 600; font-size: 11.5px; }
.dayrow .chev { color: var(--faint); }
.dayrow.today { box-shadow: 0 0 0 2px var(--coral), 0 10px 24px rgba(255,107,74,.16); }
.dayrow.today .chev { color: var(--coral-deep); }
.dayrow.rest { background: transparent; box-shadow: none; border: 1.5px dashed var(--line); }
.dayrow .done-chip { border-radius: 8px; padding: 3px 7px; font-size: 9px; font-weight: 800; margin-left: auto; flex-shrink: 0; background: #EAF0E3; color: var(--sage-deep); }
:root[data-theme="dark"] .dayrow .done-chip { background: rgba(127,164,138,.16); }
.dayrow .log-chip { border-radius: 8px; padding: 3px 7px; font-size: 9px; font-weight: 800; margin-left: auto; flex-shrink: 0; }
```

(`.log-chip` gets its wash/tag colors from the modality: gym `var(--wash-gym)`/`var(--tag-gym)` etc. — set via the same `stag-*` classes: `className="log-chip stag-sport"` composes fine since `.stag-*` only sets colors.)

- [ ] **Step 5:** Tests → PASS; full gate both modes → PASS. **Step 6: Commit** — `git add frontend/src/features/train/components/WeeklyDayRow.tsx frontend/src/features/train/components/WeeklyDayRow.test.tsx frontend/src/styles/prototype.css && git -c core.hooksPath=/dev/null commit -m "feat(fe/train): weekly plan day cards with Napiv type tags (mezo-8141)"`

---

### Task 5: Mai (`TrainTodayPage`) re-composition — pghead, train hero, load tiles, secthead

**Files:**
- Modify: `frontend/src/features/train/pages/TrainTodayPage.tsx` + `TrainTodayPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (trainhero CSS)

**Interfaces:**
- Consumes: `weeklyLoad` (Task 2), `LoadTiles` (Task 3), restyled `WeeklyDayRow` (Task 4), existing hooks (`useTrain`, `useRunning`) — hook usage unchanged.
- ALL behavior stays: skeleton on pending, ghost without `activeMeso`, three hero kinds in time-of-day order, done-states (`loggedGym`/`loggedVb`/`runLoggedFor`), `SportLogSheet`/`RunLogSheet` mounts, level-up wiring, rest-day card.

**New render order:**
1. `.pghead-np`: `.over` = `` `Edzés · ${today ? DAY_LABELS[today.day] : ''} · W${activeMeso.currentWeek}` `` (CSS uppercases it), `h1` = `Mai nap`
2. Hero cards (time-of-day order, as now):
   - **gym** → `.trainhero np-anim`: eyebrow `` `MA ${gym.time ?? ''} · ${currentPhase}` `` in `.trainhero-over`; `.h2row` with `<h2>{workout.title}</h2>` + `<span className="typetag typetag-gym">🏋️ GYM</span>`; `.chips` row: `{n} gyakorlat` / `{n} szett` / `~{durationEst} perc` (+ `{gym.type}` when present); `loggedGym` → keep the sage "Mai edzés logolva" strip, else `.np-cta np-press` **`Indítsuk →`** (navigate `/train/session`).
   - **volleyball** → `.np-eventrow`-style card (S3 class): `<span className="typetag typetag-sport">🏐 RÖPI</span>` + `Volleyball · {time}` + meta line; keep the `Logold a session-t` / logged-summary button pair exactly.
   - **run** → same pattern with `typetag-run`, `🏃 FUTÁS` tag; keep `Naplózd a futást` / logged-summary pair.
3. `<LoadTiles tiles={weeklyLoad(agenda)} />`
4. `.secthead-np` (S3 class): `<h3>Heti terv</h3>` + `<span>{sessionCount} session</span>`
5. The `agenda.map(WeeklyDayRow)` list (unchanged wiring), wrapped in the existing `0 24px` gutter
6. Rest-day card, provenance note card, sheets — unchanged content, `.card` surfaces keep tokens

- [ ] **Step 1: Update the test FIRST** (failing): keep every behavior test (ghost without meso, skeleton, done-states, sheet opens); change structural assertions: `Mai nap` h1 renders; `Indítsuk →` CTA; a `.trainhero` exists on gym-hero days; `.loadtile` count matches the mock seed's modalities; `Heti terv` secthead; `Pihenőnap` rest rows. NO `toBeVisible()` anywhere near `.np-anim` — presence only.
- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** the re-composition (markup swap only — every data derivation, handler, and conditional stays; delete the `Eyebrow`/`PageTitle`/`Display` imports if no longer used in this file).
- [ ] **Step 4: Append the hero CSS:**

```css
/* ===== Napív train hero (Mai, spec §4.3) ===== */
.trainhero { border-radius: 28px; padding: 19px; margin: 14px 24px 0; background: linear-gradient(150deg, #FFE9DF, #FFF9F3 65%); box-shadow: 0 14px 32px rgba(196,98,47,.12); position: relative; overflow: hidden; }
:root[data-theme="dark"] .trainhero { background: linear-gradient(150deg, rgba(255,107,74,.14), rgba(255,255,255,.03) 65%); }
.trainhero::after { content: ''; position: absolute; top: -46px; right: -46px; width: 160px; height: 160px; border-radius: 50%; background: radial-gradient(circle, rgba(255,107,74,.17), transparent 68%); }
.trainhero-over { font-size: 11px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; color: var(--coral-deep); }
.trainhero .h2row h2 { font-family: var(--ff-display); font-size: 30px; font-weight: 800; letter-spacing: -.5px; color: var(--ink); }
.trainhero .typetag { background: rgba(255,255,255,.9); color: var(--tag-gym); }
:root[data-theme="dark"] .trainhero .typetag { background: rgba(255,255,255,.12); }
.trainhero .chips { display: flex; gap: 7px; margin-top: 11px; flex-wrap: wrap; }
.trainhero .chip-np { background: rgba(255,255,255,.9); border-radius: 999px; padding: 7px 13px; font-size: 11.5px; font-weight: 800; color: var(--coral-deep); }
:root[data-theme="dark"] .trainhero .chip-np { background: rgba(255,255,255,.1); }
.trainhero .np-ctarow { margin-top: 14px; }
```

- [ ] **Step 5:** Tests → PASS; full gate both modes → PASS. Expect fallout in `train.emptyStates.test.tsx` and any test asserting the old `Edzés` PageTitle or `Week {n}` eyebrow — update those assertions to the new strings (`Mai nap`, the pghead over-line).
- [ ] **Step 6: Commit** — `git add frontend/src/features/train/pages/TrainTodayPage.tsx frontend/src/features/train/pages/TrainTodayPage.test.tsx frontend/src/features/train/pages/train.emptyStates.test.tsx frontend/src/styles/prototype.css && git -c core.hooksPath=/dev/null commit -m "feat(fe/train): Mai recomposed — Napiv pghead, train hero, load tiles, day cards (mezo-8141)"`

---

### Task 6: SportPage re-skin (rose)

**Files:**
- Modify: `frontend/src/features/train/pages/SportPage.tsx` + `SportPage.test.tsx`
- Modify (accent swaps only): `frontend/src/features/train/components/SportSessionCard.tsx`, `SportStat.tsx`

**Scope — in-vocabulary re-skin, content model identical (spec §4.3):**
- `.page-header` (Eyebrow `Train · Sport` + PageTitle `Röplabda` + `+ Log` chip) → `.pghead-np`: `.over` = `Edzés · Sport`, `h1` = `Röplabda`, the `+ Log` action becomes `<button className="pgact-np np-press" style={{ background: 'var(--wash-sport)', color: 'var(--tag-sport)' }}>+ Log</button>` (same onClick).
- Every `var(--cat-tendency)` accent **inside these three files** → `var(--tag-sport)`; wash-style backgrounds derived from it → `var(--wash-sport)`. Do NOT touch `--cat-tendency` usages outside `features/train/`.
- Where a session row shows its type, add `<span className="stag stag-sport">RÖPI</span>` before the title (SportSessionCard list rows).
- Keep: all hooks, sheets, ghost/skeleton states, behavior tests.

- [ ] Steps: update class/copy assertions in `SportPage.test.tsx` first (pghead strings + `.stag-sport` presence; behavior assertions untouched) → FAIL → re-skin → PASS → full gate both modes → commit (`git add frontend/src/features/train/pages/SportPage.tsx frontend/src/features/train/pages/SportPage.test.tsx frontend/src/features/train/components/SportSessionCard.tsx frontend/src/features/train/components/SportStat.tsx && git -c core.hooksPath=/dev/null commit -m "feat(fe/train): SportPage re-skinned to Napiv rose vocabulary (mezo-8141)"`).

---

### Task 7: RunningPage re-skin (sky)

**Files:**
- Modify: `frontend/src/features/train/pages/RunningPage.tsx` + `RunningPage.test.tsx`
- Modify (accent swaps only): `frontend/src/features/train/components/RunWeekStrip.tsx`, `RunSessionCard.tsx`, `RunCrossLoadCard.tsx`

**Scope — same pattern as Task 6 with the run accent:**
- Header → `.pghead-np`: `.over` = `Edzés · Futás`, `h1` = `Intervallum` (keep the current title word).
- `var(--info)` accents **inside these four files** → `var(--tag-run)`; wash derivations → `var(--wash-run)`. `--info` elsewhere in the app untouched.
- Session rows/cards get `<span className="stag stag-run">FUTÁS</span>` where the type is displayed.
- Keep: `RunLogSheet` wiring, block builder link, ghost/skeleton states, all behavior tests.

- [ ] Steps: test-first class/copy updates in `RunningPage.test.tsx` → FAIL → re-skin → PASS → full gate → commit (`feat(fe/train): RunningPage re-skinned to Napiv sky vocabulary (mezo-8141)` — stage the five touched files explicitly).

---

### Task 8: GymPage re-skin (coral)

**Files:**
- Modify: `frontend/src/features/train/pages/GymPage.tsx` + `GymPage.test.tsx`
- Modify (accent swaps only, if they carry brand-teal accents): `frontend/src/features/train/components/MesoOverview.tsx`, `GymDayCard.tsx`, `GymStat.tsx`

**Scope:**
- Header → `.pghead-np`: `.over` = `Edzés · Gym`, `h1` = `Gym` (the current title content stays — re-skin only).
- `eyebrow brand` / `var(--brand-glow)` accents **inside these files** → `var(--coral-deep)` / `var(--tag-gym)`; chips stay content-identical.
- `PhaseCurveBars`, `MesoVolume`, `MesoExercises` are data-viz components — leave their internals alone unless they hardcode `--brand-glow` for the active bar (then swap to `var(--coral)`).
- Keep: all behavior (week switcher, day cards, exercise rows), ghost/skeleton, tests' behavior assertions.

- [ ] Steps: test-first (`GymPage.test.tsx` header/class assertions) → FAIL → re-skin → PASS → full gate → commit (`feat(fe/train): GymPage re-skinned to Napiv coral vocabulary (mezo-8141)` — stage touched files explicitly).

---

### Task 9: Gyakorlatok + Mesociklusok re-skin (headers + card accents)

**Files:**
- Modify: `frontend/src/features/train/pages/ExercisesPage.tsx` + `ExercisesPage.test.tsx`
- Modify: `frontend/src/features/train/pages/MesocycleLibraryPage.tsx` + `MesocycleLibraryPage.test.tsx`
- Modify (headers ONLY): `frontend/src/features/train/pages/MesocycleBuilderPage.tsx`, `MesocyclePlannerPage.tsx`, `RunningBlockBuilderPage.tsx` (+ their tests only if they assert header strings/classes)

**Scope:**
- ExercisesPage: header → `.pghead-np` (`.over` = `Edzés · Gyakorlatok`, `h1` = `Gyakorlatok`); catalog row cards keep structure, muscle-group chips keep content.
- MesocycleLibraryPage: header → `.pghead-np` (`.over` = `Edzés · Mesociklusok`, `h1` = `Mesociklusok`), the `+ Új` action → `.pgact-np np-press` (gym wash/tag colors), Active/Planned/Archived cards keep structure with token surfaces.
- Builder/Planner/RunningBlockBuilder: swap ONLY the `.page-header` block to `.pghead-np` with matching over-lines (`Edzés · Mesociklusok` / `Edzés · Futás`); everything below the header untouched (deep restyle is S8 polish scope if needed).
- Keep: navigation, sheets, ghost states, all behavior tests.

- [ ] Steps: test-first header/class updates in the two main test files → FAIL → re-skin → PASS → grep for stale `Train · ` eyebrow assertions across `frontend/src` and fix stragglers → full gate both modes → commit (`feat(fe/train): Gyakorlatok + Mesociklusok pages on Napiv page heads (mezo-8141)` — stage touched files explicitly).

---

### Task 10: Slice close — docs, gates, push

**Files:**
- Modify: `docs/features/train.md` (§2 Mai structure: pghead + hero + load tiles + day cards; §5 integrations unchanged-but-verify; §9 gotchas: `GYM`→`Gym` tab label rename, pill nav classes shared-for-S6/S7 via `--pill-accent`; §10 file map: `weeklyLoad.ts`, `LoadTiles.tsx` added)
- Modify: `docs/features/_platform-design-system.md` (§ new Napív S4 classes: `.np-pills/.np-pill`, `.pghead-np/.pgact-np`, `.stag-*`, `.loadrow/.loadtile`, `.dayrow`, `.trainhero`, wash/tag token pairs; staleness flags cleared)
- Check: `docs/features/today.md` staleness (prototype.css is a key_file — bump if flagged)

- [ ] Steps: edit docs → `node scripts/lint-docs.mjs` PASS → full gate both modes → commit (`docs(features): train + design-system docs updated for Napiv S4 (mezo-8141)`) → controller: `bd update mezo-8141 --notes "S4 Train landed: ..."` → push branch → open self-PR (CI gate) → after green, `git pull --rebase` on main → merge `--no-ff` → push main.

---

## Out of scope (later plans)

S5 Active workout (`/train/session` execution card, giant steppers, rest Live-Activity island — ActiveWorkoutPage untouched in S4) → S6 Fuel (pill nav adopts `--pill-accent: var(--sage)`) → S7 Me (lavender pills) → S8 Insights re-skin + Pulse dark + cleanup (legacy `.subnav`/`.subnav-item` styles retire once Fuel/Me leave them; deep Builder/Planner restyle if needed; S3+S4 deferred minors: orphaned `.checkin-strip` CSS, `useInsightsTeaser`, `QuickStatItem.delta`, reggel hex accents → tokens, `Gym · hipertrófia` copy vs real phases).

# Napív Redesign — S5 Active Workout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `/train/session` to the Napív execution vocabulary — full-screen (tab bar hidden), `wk-top` header with back pill + per-exercise progress dots, one big exercise card (eyebrow, name, last-week ghost line, set circles, giant −/+ steppers, full-width `Szett kész ✓`), and the NEW rest Live-Activity: after each logged set the in-frame dynamic island expands into a dark capsule with countdown ring + `PIHENŐ m:ss` + next exercise, then collapses. All existing functionality survives (warmup phase, RIR/side, notes, challenges, reorder/skip/add-set, feedback, PR toast, complete recap); both test modes green after every task.

**Architecture:** A `LiveActivityProvider` context lands in `app/providers/` (AppLayout wraps PhoneFrame with it); PhoneFrame's static island div becomes a `DynamicIsland` component that self-ticks off an `endsAt` timestamp — the page only starts/clears the rest. Pure timer math in `features/train/logic/restTimer.ts`. A new `SetStepper` (giant mockup stepper) joins `features/train/components/`; `CompactStepper` stays for RunWeekEditor. ActiveWorkoutPage is restyled in place: the logging panel moves from the set-list's current row up into the exercise card; the set list demotes to read-only status rows. New CSS appends to the Napív section of `prototype.css`.

**Tech Stack:** React 19, TanStack Query hooks via `@/data/hooks` (signatures untouched), plain CSS in `frontend/src/styles/prototype.css`, Vitest + RTL (fake timers for the countdown). Driving spec §4.5: `docs/superpowers/specs/2026-07-13-napiv-frontend-redesign-design.md`. Interactive reference: `docs/superpowers/specs/2026-07-13-napiv-redesign-mockup.html` (`#v-workout` + `.island` CSS/JS, lines ~46-57, 237-262, 631-676, 799-812).

## Global Constraints

- Worktree `/Users/daniel.kuhne/MrKuhne/mezo/.worktrees/frontend-design-rethink`, branch `feat/frontend-design-rethink`, bd **mezo-8141**. Verify `git rev-parse --show-toplevel` before every commit; NEVER touch the main checkout.
- Commit with hooks disabled: `git -c core.hooksPath=/dev/null commit -m "... (mezo-8141)"`. Stage explicit paths only — never `git add .` or `-a`. After every commit run `git show --stat HEAD` and verify only intended files; strip a stray `issues.jsonl` with `git reset --soft HEAD~1 && git restore --staged issues.jsonl && git -c core.hooksPath=/dev/null commit -m "<same message>"`.
- Gate after EVERY task: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (both modes green) + `node scripts/lint-docs.mjs` PASS when a doc/key_file was touched.
- Conventions: no `*Screen`/`*View`; data hooks only from `@/data/hooks`; no barrels; deep `@/*` imports; colocated tests; `shared/ui` untouched.
- Hungarian copy, sentence case, active verbs. Exact strings given below are binding: `Szett kész ✓`, `Pihenő`, `Következő`, `Pihenő átugrása`, `Súly`, `Ismétlés`, `múlt héten:`.
- **Gutter rule:** new full-width blocks carry their own **24px** horizontal gutter.
- **jsdom hazard:** `.np-anim` nodes start at `opacity:0` — presence-only assertions, never `toBeVisible()`. Countdown tests use `vi.useFakeTimers()` + `act(() => vi.advanceTimersByTime(...))`.
- Dual-mode honesty: real mode never shows mock-seed data; skeleton/ghost/error triads stay exactly as they are.
- Accent discipline: washes get `:root[data-theme="dark"]` overrides; fg accents theme-invariant. The island capsule is intentionally always-dark (`#0F0D0B` family) in BOTH themes — no dark guard needed on it.
- **No functionality lost (spec §5):** warmup phase, RIR selector, side selector, per-exercise notes, challenge accept/banner, reorder/skip/add-set sheet, feedback modal, PR toast, WorkoutComplete recap, VideoDemo — all survive restyled. A reviewer finding "X was removed" is Critical.
- **CI reality:** GitHub Actions free-tier minutes are exhausted (see mezo-8141 notes). The close task replicates CI locally (FE both modes + lint-docs + lint-liquibase + contract-drift) and merges with the owner-approved no-CI exception unless the quota has reset — check `gh pr checks` first.

---

### Task 1: `restTimer` pure logic

**Files:**
- Create: `frontend/src/features/train/logic/restTimer.ts`
- Test: `frontend/src/features/train/logic/restTimer.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (Tasks 2 and 6 consume exactly these):
  - `restSecondsFor(type: string): number` — `'compound'` → `150`, everything else (`'isolation'`, `'plyo'`, unknown) → `90`. (Rationale: the mockup's island shows 2:30 for a compound row; the legacy UI's inert timer chip said 90s — no rest field exists in the data model, so these are the two grounded values.)
  - `fmtMMSS(s: number): string` — `150` → `'2:30'`, `5` → `'0:05'`, `0` → `'0:00'`; negative clamps to `'0:00'`.

- [ ] **Step 1: Write the failing test** (`restTimer.test.ts`):

```ts
import { restSecondsFor, fmtMMSS } from '@/features/train/logic/restTimer'

test('compound rests 150s, everything else 90s', () => {
  expect(restSecondsFor('compound')).toBe(150)
  expect(restSecondsFor('isolation')).toBe(90)
  expect(restSecondsFor('plyo')).toBe(90)
  expect(restSecondsFor('anything')).toBe(90)
})

test('fmtMMSS formats mm:ss with zero-padded seconds and clamps at zero', () => {
  expect(fmtMMSS(150)).toBe('2:30')
  expect(fmtMMSS(90)).toBe('1:30')
  expect(fmtMMSS(61)).toBe('1:01')
  expect(fmtMMSS(5)).toBe('0:05')
  expect(fmtMMSS(0)).toBe('0:00')
  expect(fmtMMSS(-3)).toBe('0:00')
})
```

- [ ] **Step 2:** `cd frontend && pnpm vitest run src/features/train/logic/restTimer.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `restTimer.ts`:

```ts
/** Rest Live-Activity timing (spec §4.5). No rest field exists in the data model:
    150s matches the mockup's compound rest (2:30), 90s the legacy timer chip. */
export function restSecondsFor(type: string): number {
  return type === 'compound' ? 150 : 90
}

export function fmtMMSS(s: number): string {
  const c = Math.max(0, s)
  return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`
}
```

- [ ] **Step 4:** Test file → PASS. Full gate both modes → PASS.
- [ ] **Step 5: Commit** — `git add frontend/src/features/train/logic/restTimer.ts frontend/src/features/train/logic/restTimer.test.ts && git -c core.hooksPath=/dev/null commit -m "feat(fe/train): rest timer pure logic for the Live-Activity island (mezo-8141)"`

---

### Task 2: `LiveActivityProvider` + `DynamicIsland` component + island CSS

**Files:**
- Create: `frontend/src/app/providers/LiveActivityProvider.tsx`
- Create: `frontend/src/app/DynamicIsland.tsx`
- Test: `frontend/src/app/DynamicIsland.test.tsx`
- Modify: `frontend/src/app/PhoneFrame.tsx:17` (`<div className="dynamic-island" />` → `<DynamicIsland />`)
- Modify: `frontend/src/app/AppLayout.tsx` (wrap `<PhoneFrame>` with `<LiveActivityProvider>`)
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: `fmtMMSS` from `@/features/train/logic/restTimer` (Task 1).
- Produces (Task 6 consumes exactly these):
  - `type RestActivity = { endsAt: number; total: number; next: string | null }`
  - `LiveActivityProvider({ children })`
  - `useLiveActivity(): { rest: RestActivity | null; startRest: (a: { seconds: number; next: string | null }) => void; clearRest: () => void }` — throws outside the provider.
  - `useLiveActivityOptional()` — same shape or `null` when no provider (lets `DynamicIsland` render the static island in bare-PhoneFrame tests).
- `DynamicIsland()` renders: no rest → `<div className="dynamic-island" />` (byte-identical to today); active rest → `<button type="button" className="dynamic-island live" aria-label="Pihenő átugrása">` with an SVG countdown ring (r=15, circumference ≈94.2, coral arc draining as time passes), `.lt1` `Pihenő` + `.lt2` `m:ss`, and — when `next` is non-null — `.lnext` with `.ln1` `Következő` + `.ln2` next-exercise name. Tapping it calls `clearRest()` (skip). At 0 remaining it self-clears.

- [ ] **Step 1: Write the failing test** (`DynamicIsland.test.tsx`):

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { DynamicIsland } from '@/app/DynamicIsland'
import { LiveActivityProvider, useLiveActivity } from '@/app/providers/LiveActivityProvider'

function Starter({ seconds, next }: { seconds: number; next: string | null }) {
  const { startRest } = useLiveActivity()
  return <button type="button" onClick={() => startRest({ seconds, next })}>go</button>
}

const setup = (seconds = 150, next: string | null = 'Lat Pulldown') => {
  vi.useFakeTimers()
  const utils = render(
    <LiveActivityProvider>
      <DynamicIsland />
      <Starter seconds={seconds} next={next} />
    </LiveActivityProvider>,
  )
  fireEvent.click(screen.getByText('go'))
  return utils
}

afterEach(() => vi.useRealTimers())

test('renders the static island without a rest, expands with ring + countdown + next when one starts', () => {
  vi.useFakeTimers()
  const { container } = render(<LiveActivityProvider><DynamicIsland /></LiveActivityProvider>)
  expect(container.querySelector('.dynamic-island')).not.toBeNull()
  expect(container.querySelector('.dynamic-island.live')).toBeNull()
})

test('counts down and self-collapses at zero', () => {
  const { container } = setup(150, 'Lat Pulldown')
  expect(container.querySelector('.dynamic-island.live')).not.toBeNull()
  expect(screen.getByText('2:30')).toBeInTheDocument()
  expect(screen.getByText('Lat Pulldown')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(60_000))
  expect(screen.getByText('1:30')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(91_000))
  expect(container.querySelector('.dynamic-island.live')).toBeNull()
})

test('tap skips the rest', () => {
  const { container } = setup(90, null)
  fireEvent.click(screen.getByRole('button', { name: 'Pihenő átugrása' }))
  expect(container.querySelector('.dynamic-island.live')).toBeNull()
  expect(screen.queryByText('Következő')).not.toBeInTheDocument()
})
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** `LiveActivityProvider.tsx`:

```tsx
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/** In-shell rest Live-Activity state (spec §4.5) — the island self-ticks off endsAt;
    pages only start/clear. Real Live Activities are a PWA no-go; this drives the
    PhoneFrame's fake dynamic island instead. */
export type RestActivity = { endsAt: number; total: number; next: string | null }

type LiveActivityValue = {
  rest: RestActivity | null
  startRest: (a: { seconds: number; next: string | null }) => void
  clearRest: () => void
}

const Ctx = createContext<LiveActivityValue | null>(null)

export function LiveActivityProvider({ children }: { children: ReactNode }) {
  const [rest, setRest] = useState<RestActivity | null>(null)
  const startRest = useCallback(({ seconds, next }: { seconds: number; next: string | null }) => {
    setRest({ endsAt: Date.now() + seconds * 1000, total: seconds, next })
  }, [])
  const clearRest = useCallback(() => setRest(null), [])
  const value = useMemo(() => ({ rest, startRest, clearRest }), [rest, startRest, clearRest])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLiveActivityOptional(): LiveActivityValue | null {
  return useContext(Ctx)
}

export function useLiveActivity(): LiveActivityValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLiveActivity must be used within LiveActivityProvider')
  return ctx
}
```

`DynamicIsland.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useLiveActivityOptional } from '@/app/providers/LiveActivityProvider'
import { fmtMMSS } from '@/features/train/logic/restTimer'

const RING_R = 15
const RING_C = 2 * Math.PI * RING_R // ≈ 94.2, matches the mockup

export function DynamicIsland() {
  const activity = useLiveActivityOptional()
  const rest = activity?.rest ?? null
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!rest) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [rest])
  const remaining = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0
  useEffect(() => {
    if (rest && remaining === 0) activity?.clearRest()
  }, [rest, remaining, activity])
  if (!rest || remaining === 0) return <div className="dynamic-island" />
  const frac = rest.total > 0 ? remaining / rest.total : 0
  return (
    <button type="button" className="dynamic-island live" aria-label="Pihenő átugrása" onClick={activity?.clearRest}>
      <svg className="ring" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r={RING_R} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="3" />
        <circle
          cx="17" cy="17" r={RING_R} fill="none" stroke="var(--coral)" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${RING_C}`} strokeDashoffset={`${RING_C * (1 - frac)}`} transform="rotate(-90 17 17)"
        />
      </svg>
      <div>
        <div className="lt1">Pihenő</div>
        <div className="lt2">{fmtMMSS(remaining)}</div>
      </div>
      {rest.next && (
        <div className="lnext">
          <div className="ln1">Következő</div>
          <div className="ln2">{rest.next}</div>
        </div>
      )}
    </button>
  )
}
```

- [ ] **Step 4: Wire the shell.** `PhoneFrame.tsx`: replace `<div className="dynamic-island" />` with `<DynamicIsland />` (import it). `AppLayout.tsx`: wrap the `<PhoneFrame ...>` element with `<LiveActivityProvider>...</LiveActivityProvider>` (outermost, so the Outlet pages and the island share it).
- [ ] **Step 5: Append the island CSS** to the Napív section of `prototype.css` — READ the existing `.dynamic-island` base rule and the full-bleed media query that hides the phone chrome FIRST, then append (adapting selector specifics if the base differs):

```css
/* ===== Napív rest Live-Activity island (spec §4.5 — always-dark capsule, both themes) ===== */
button.dynamic-island { border: 0; padding: 0; font: inherit; }
.dynamic-island.live { width: calc(100% - 28px); height: 62px; border-radius: 31px; display: flex; align-items: center; gap: 11px; padding: 0 16px; cursor: pointer; z-index: 60; background: #0F0D0B; }
.dynamic-island.live .ring { flex-shrink: 0; }
.dynamic-island.live .lt1 { font-size: 10px; font-weight: 800; letter-spacing: 1px; color: #B7A899; text-transform: uppercase; }
.dynamic-island.live .lt2 { font-family: var(--ff-display); font-size: 18px; font-weight: 800; color: #FBF6EF; font-variant-numeric: tabular-nums; text-align: left; }
.dynamic-island.live .lnext { margin-left: auto; text-align: right; }
.dynamic-island.live .ln1 { font-size: 9px; font-weight: 800; letter-spacing: .8px; color: #8A7A6A; text-transform: uppercase; }
.dynamic-island.live .ln2 { font-size: 11.5px; font-weight: 700; color: #E8DDCE; margin-top: 1px; }
@media (prefers-reduced-motion: no-preference) {
  .dynamic-island { transition: width .3s ease, height .3s ease, border-radius .3s ease; }
}
```

If the full-bleed media query (`max-width: 519px` / `display-mode: standalone`) hides `.dynamic-island`, add inside your new block: `@media (max-width: 519px), (display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui) { .dynamic-island.live { display: flex; top: calc(10px + env(safe-area-inset-top)); } }` so a live rest stays visible on real devices; if it doesn't hide it, skip this and note it in the report.

- [ ] **Step 6:** Tests → PASS; full gate both modes → PASS (AppLayout-based suites must stay green — the provider is additive).
- [ ] **Step 7: Commit** — `git add frontend/src/app/providers/LiveActivityProvider.tsx frontend/src/app/DynamicIsland.tsx frontend/src/app/DynamicIsland.test.tsx frontend/src/app/PhoneFrame.tsx frontend/src/app/AppLayout.tsx frontend/src/styles/prototype.css && git -c core.hooksPath=/dev/null commit -m "feat(fe/shell): rest Live-Activity dynamic island with countdown ring (mezo-8141)"`

---

### Task 3: `SetStepper` giant stepper component

**Files:**
- Create: `frontend/src/features/train/components/SetStepper.tsx`
- Test: `frontend/src/features/train/components/SetStepper.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Produces (Task 5 consumes exactly this): `SetStepper({ label, value, step, onChange, unit?, integer?, min?, max? }: { label: string; value: number; step: number; onChange: (v: number) => void; unit?: string; integer?: boolean; min?: number; max?: number })` — renders `.stepper` (mockup): `.k` label, `.row` with `−` button / `.n` value (+`<small>` unit) / `+` button. Value displays with Hungarian decimal comma (`107.5` → `107,5`); integer mode never shows decimals. Buttons clamp at min/max and carry aria-labels `` `${label} csökkentése` `` / `` `${label} növelése` ``.
- `CompactStepper` is NOT touched (RunWeekEditor keeps it).

- [ ] **Step 1: Failing test** (`SetStepper.test.tsx`):

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { SetStepper } from '@/features/train/components/SetStepper'

test('renders hu-decimal value with unit and steps by ±step', () => {
  const onChange = vi.fn()
  render(<SetStepper label="Súly" value={107.5} step={2.5} unit="kg" min={0} max={999} onChange={onChange} />)
  expect(screen.getByText('107,5')).toBeInTheDocument()
  expect(screen.getByText('kg')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Súly növelése' }))
  expect(onChange).toHaveBeenCalledWith(110)
  fireEvent.click(screen.getByRole('button', { name: 'Súly csökkentése' }))
  expect(onChange).toHaveBeenCalledWith(105)
})

test('integer mode and min clamp', () => {
  const onChange = vi.fn()
  render(<SetStepper label="Ismétlés" value={1} step={1} integer min={1} max={100} onChange={onChange} />)
  expect(screen.getByText('1')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Ismétlés csökkentése' }))
  expect(onChange).toHaveBeenCalledWith(1) // clamped at min
})
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** `SetStepper.tsx`:

```tsx
/** Napív giant stepper (spec §4.5 mockup .stepper) — the active-workout logging pair. */
export function SetStepper({ label, value, step, onChange, unit, integer, min = 0, max = 999 }: {
  label: string
  value: number
  step: number
  onChange: (v: number) => void
  unit?: string
  integer?: boolean
  min?: number
  max?: number
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const display = integer ? String(value) : value.toLocaleString('hu-HU')
  return (
    <div className="stepper">
      <div className="k">{label}</div>
      <div className="row">
        <button type="button" className="b np-press" aria-label={`${label} csökkentése`} onClick={() => onChange(clamp(value - step))}>−</button>
        <div className="n">
          {display}
          {unit && <small> {unit}</small>}
        </div>
        <button type="button" className="b np-press" aria-label={`${label} növelése`} onClick={() => onChange(clamp(value + step))}>+</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Append the stepper CSS** (Napív section, before the safe-area block):

```css
/* ===== Napív giant set steppers (active workout, spec §4.5) ===== */
.steprow { display: flex; gap: 11px; margin-top: 18px; }
.stepper { flex: 1; background: var(--canvas); border-radius: 22px; padding: 13px 12px 12px; text-align: center; border: 1.5px solid var(--line); }
.stepper .k { font-size: 10px; font-weight: 800; color: var(--faint); letter-spacing: 1px; text-transform: uppercase; }
.stepper .row { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
.stepper .b { width: 40px; height: 40px; border-radius: 50%; background: var(--surface); box-shadow: 0 4px 12px rgba(43,33,24,.10); font-size: 19px; color: var(--coral-deep); display: flex; align-items: center; justify-content: center; font-weight: 800; border: 0; cursor: pointer; font-family: inherit; }
.stepper .n { font-family: var(--ff-display); font-size: 28px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -.5px; color: var(--ink); }
.stepper .n small { font-size: 12px; color: var(--faint); font-weight: 800; }
```

- [ ] **Step 5:** Tests → PASS; full gate both modes → PASS. **Step 6: Commit** — `git add frontend/src/features/train/components/SetStepper.tsx frontend/src/features/train/components/SetStepper.test.tsx frontend/src/styles/prototype.css && git -c core.hooksPath=/dev/null commit -m "feat(fe/train): SetStepper giant stepper for the execution card (mezo-8141)"`

---

### Task 4: Full-screen session — tab bar hidden + `wk-top` header with exercise dots

**Files:**
- Modify: `frontend/src/app/AppLayout.tsx` (hide TabBar on `/train/session`)
- Modify: `frontend/src/app/navigation.test.tsx` or `shell.test.tsx` (whichever asserts tab-bar presence — read both first; add the session-route absence case)
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx:661-688` (the sticky header block) + `ActiveWorkoutPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (wk-top CSS)

**Interfaces:**
- AppLayout: `const hideTabBar = location.pathname === '/train/session'` → `{!hideTabBar && <TabBar />}`. Also suppress the tab-bar's scroll clearance if `ScreenContent` pads for it unconditionally — read `ScreenContent.tsx`; if padding is CSS-only (`.screen-content` padding-bottom), leave it (harmless scroll room) and note it.
- ActiveWorkoutPage header (replaces the sticky Bezárás row + progress bar; the ⋯ actions chip SURVIVES in the new row):

```tsx
<div className="wk-top np-anim" style={{ '--i': 0 } as React.CSSProperties}>
  <button type="button" className="back np-press" aria-label="Vissza" onClick={onExit}>‹</button>
  <div className="tt">
    <div className="t1">{W.title}</div>
    <div className="t2">{currentIdx + 1}/{W.exercises.length} gyakorlat · {doneSets}/{totalSets} szett</div>
  </div>
  <div className="exdots" aria-hidden="true">
    {W.exercises.map((e, i) => (
      <i key={e.id} className={i < currentIdx ? 'don' : i === currentIdx ? 'cur' : undefined} />
    ))}
  </div>
  <button type="button" aria-label="Gyakorlat műveletek" disabled={!!feedbackEx} onClick={() => setActionSheetOpen(true)} className="back np-press" style={{ fontSize: 15 }}>⋯</button>
</div>
```

(Keep the niggle banner block below it, restyled onto `.warmstrip` — the S3 class.)

**CSS (append):**

```css
/* ===== Napív active-workout header (spec §4.5) ===== */
.wk-top { display: flex; align-items: center; gap: 12px; padding: 12px 24px 0; position: sticky; top: 0; z-index: 5; background: var(--canvas); }
.wk-top .back { width: 42px; height: 42px; border-radius: 50%; background: var(--surface); box-shadow: var(--np-shadow-row); display: flex; align-items: center; justify-content: center; color: var(--sub); font-size: 18px; border: 0; cursor: pointer; flex-shrink: 0; font-family: inherit; }
.wk-top .tt { min-width: 0; }
.wk-top .tt .t1 { font-family: var(--ff-display); font-size: 18px; font-weight: 800; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wk-top .tt .t2 { font-size: 10.5px; color: var(--faint); font-weight: 800; letter-spacing: .6px; text-transform: uppercase; }
.exdots { margin-left: auto; display: flex; gap: 5px; flex-shrink: 0; }
.exdots i { width: 8px; height: 8px; border-radius: 50%; background: var(--line); }
.exdots i.don { background: var(--sage); }
.exdots i.cur { background: var(--coral); box-shadow: 0 0 0 3px rgba(255,107,74,.22); }
```

- [ ] Steps: update tests FIRST — (a) shell/navigation test: TabBar absent at `/train/session`, present at `/train`; (b) ActiveWorkoutPage.test: header asserts `W.title` (`Pull Day` from the mock seed), the `n/n gyakorlat` string, `.exdots i` count equals exercise count, `Vissza` + `Gyakorlat műveletek` buttons present; the old progress-bar assertion (if any) removed. Run → FAIL → implement (AppLayout conditional + header swap + CSS) → PASS → full gate → commit (`feat(fe/train): full-screen session with wk-top header and exercise dots (mezo-8141)` — stage the 4-5 touched files explicitly).

---

### Task 5: Execution card — exo/name/prev, set circles, giant steppers, `Szett kész ✓`

**Files:**
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (the ACTIVE-phase exercise card ~:709-814 and the prescribed-set list ~:816-960) + `ActiveWorkoutPage.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (excard/setdots/donebtn/nextex CSS)

**Interfaces:**
- Consumes: `SetStepper` (Task 3). All existing state/handlers stay: `weight/setWeight`, `reps/setReps`, `rir/setRir`, `side/setSide`, the set-logging submit path (find the current `Szett` log button's onClick — reuse it VERBATIM as `Szett kész ✓`'s handler), `effectiveSetCount`, `prescribedAt`, `session.setIdx`, `session.logged`.
- The excard becomes (structure — adapt data wiring from the existing code):

```tsx
<div className="excard np-anim" style={{ '--i': 1 } as React.CSSProperties}>
  {/* challenge banner block stays first, restyled: className="warmstrip" with the sparkle + copy content unchanged */}
  <div className="exo">{currentIdx + 1}. gyakorlat · {current.muscle}</div>
  <h2>{current.name}</h2>
  {current.lastWeek && (
    <div className="prev">múlt héten: {current.lastWeek.weight.toLocaleString('hu-HU')} kg × {current.lastWeek.reps} @ RIR {current.lastWeek.rir}</div>
  )}
  {/* VideoDemo + note pill stay here, restyled surfaces only; the rationale line MOVES
      below the nextex row as the .aistrip (see after the card) */}
  <div className="setdots">
    {Array.from({ length: currentSetCount }, (_, i) => {
      const warm = prescribedAt(session, current.id, i)?.kind === 'warmup'
      const cls = i < session.setIdx ? 'sd don' : i === session.setIdx ? 'sd cur' : 'sd'
      return <div key={i} className={cls + (warm ? ' wu' : '')}>{i < session.setIdx ? '✓' : warm ? `B${i + 1}` : i + 1 - warmupCount}</div>
    })}
  </div>
  <div className="steprow">
    {current.type !== 'plyo' && <SetStepper label="Súly" value={weight} step={2.5} unit="kg" min={0} max={999} onChange={setWeight} />}
    <SetStepper label="Ismétlés" value={reps} step={1} integer min={1} max={100} onChange={setReps} />
  </div>
  {/* RIR selector row + isolation Side selector stay BELOW the steprow — same handlers/aria (aria-pressed, `RIR ${n}`), restyled to .rirrow pills */}
  <button type="button" className="donebtn np-press" onClick={/* the existing set-log submit handler, verbatim */}>Szett kész ✓</button>
</div>
{/* nextex row — next exercise, presentational. Derive from the existing `remaining`
    reorder segment (it already lists the future exercises in session.order):
    const nextEx = remaining[0] ? W.exercises.find((e) => e.id === remaining[0].id) ?? null : null */}
{nextEx && (
  <div className="nextex">
    <div>
      <div className="k">Következő</div>
      <div className="n">{nextEx.name} — {effectiveSetCount(session, nextEx.id)} × {nextEx.repMin}-{nextEx.repMax}</div>
    </div>
    <span className="chev" aria-hidden="true">›</span>
  </div>
)}
{/* aistrip — the engine rationale MOVES OUT of the card here (mockup's warm AI strip),
    below the nextex row; content unchanged, ✨ prefix: */}
{current.rationale && (
  <div className="aistrip">
    <span aria-hidden="true">✨</span>
    <p>{current.rationale}</p>
  </div>
)}
```

- The prescribed-set LIST below the card demotes to read-only status rows (no expanding logging panel — logging now lives in the excard): each row keeps `setLabel`, kind chip (`Bemel.`/`Working` — restyle to `.stag`-style), the TARGET values for pending rows and the LOGGED ACTUALS (`kg × reps @ RIR`) for done rows. No information disappears; only the input controls move.
- The inert tool row (`90s` + Voice chips, ~:906-911) is REMOVED — the 90s chip's promise is now the real island rest timer (Task 6), Voice stays Phase-3 (note the removal in docs).

**CSS (append):**

```css
/* ===== Napív execution card (spec §4.5) ===== */
.excard { background: var(--surface); border-radius: 30px; padding: 22px 19px; box-shadow: 0 3px 6px rgba(43,33,24,.04), 0 20px 44px rgba(43,33,24,.10); margin: 16px 24px 0; }
.excard .exo { font-size: 11px; font-weight: 800; color: var(--coral-deep); letter-spacing: 1px; text-transform: uppercase; }
.excard h2 { font-family: var(--ff-display); font-size: 27px; font-weight: 800; margin-top: 6px; letter-spacing: -.4px; color: var(--ink); }
.excard .prev { font-size: 12.5px; color: var(--faint); font-weight: 600; margin-top: 4px; }
.setdots { display: flex; gap: 8px; margin-top: 15px; }
.setdots .sd { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 800; background: var(--warm); color: var(--faint); }
.setdots .sd.don { background: #EAF0E3; color: var(--sage-deep); }
:root[data-theme="dark"] .setdots .sd.don { background: rgba(127,164,138,.16); }
.setdots .sd.cur { background: var(--coral); color: #fff; box-shadow: 0 6px 14px rgba(255,107,74,.38); }
.setdots .sd.wu:not(.don):not(.cur) { background: rgba(255,179,71,.16); color: #8F5514; }
:root[data-theme="dark"] .setdots .sd.wu:not(.don):not(.cur) { color: #E8B36B; }
.donebtn { margin-top: 16px; width: 100%; background: linear-gradient(135deg, #FF7A55, #FF5B36); color: #fff; border-radius: 999px; padding: 16px 0; text-align: center; font-weight: 800; font-size: 16px; border: 0; cursor: pointer; font-family: inherit; box-shadow: 0 10px 24px rgba(255,91,54,.35), inset 0 1px 0 rgba(255,255,255,.25); }
.nextex { display: flex; align-items: center; background: var(--surface); border-radius: 20px; padding: 13px 16px; box-shadow: var(--np-shadow-row); margin: 12px 24px 0; }
.nextex .k { font-size: 9.5px; font-weight: 800; color: var(--faint); letter-spacing: .5px; text-transform: uppercase; }
.nextex .n { font-size: 13px; font-weight: 700; color: var(--ink); margin-top: 2px; }
.nextex .chev { margin-left: auto; color: var(--faint); }
.rirrow { display: flex; gap: 6px; margin-top: 12px; align-items: center; }
.rirrow .rk { font-size: 10px; font-weight: 800; color: var(--faint); letter-spacing: .6px; text-transform: uppercase; margin-right: 4px; }
.rirrow button { flex: 1; padding: 8px 0; border-radius: 12px; border: 1.5px solid var(--line); background: var(--canvas); color: var(--sub); font-family: var(--ff-display); font-size: 14px; font-weight: 800; cursor: pointer; }
.rirrow button[aria-pressed="true"] { border-color: var(--coral); color: var(--coral-deep); background: var(--surface); box-shadow: 0 0 0 1px var(--coral); }
.aistrip { display: flex; gap: 9px; background: rgba(255,179,71,.16); border-radius: 20px; padding: 13px 15px; margin: 12px 24px 0; }
.aistrip p { font-size: 12.5px; line-height: 1.55; color: #7A4A18; font-weight: 500; }
:root[data-theme="dark"] .aistrip p { color: #E8B36B; }
```

- [ ] Steps: update `ActiveWorkoutPage.test.tsx` FIRST — keep every behavior test (logging advances sets, RIR selection, side selection, skip/reorder/add-set, feedback, complete, PR toast, challenge accept) and swap structural assertions: `Szett kész ✓` button logs a set; `.setdots .sd` count = current exercise's set count; `.excard h2` shows the exercise name; `múlt héten:` line present when lastWeek exists; steppers assert via the `Súly növelése`/`Ismétlés növelése` aria labels; the removed `90s`/Voice chips' assertions deleted. Run → FAIL → implement → PASS → full gate → commit (`feat(fe/train): Napiv execution card — set circles, giant steppers, Szett kész (mezo-8141)`).

---

### Task 6: Rest wiring — `Szett kész` starts the island rest

**Files:**
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` + `ActiveWorkoutPage.test.tsx`

**Interfaces:**
- Consumes: `useLiveActivity` (Task 2), `restSecondsFor` (Task 1).
- Behavior contract:
  - When a set is logged (the `Szett kész ✓` handler) AND the exercise continues (more sets remain, no feedback modal opening), call `startRest({ seconds: restSecondsFor(current.type), next: nextLabel })` where `nextLabel` = the next exercise's name when this was the current exercise's LAST set... — for mid-exercise sets pass the CURRENT exercise's name (`current.name`), since that's what's next in reality. Concretely: `next: session.setIdx + 1 < currentSetCount ? current.name : (nextEx?.name ?? null)` (`nextEx` is the Task 5 derivation from `remaining[0]`).
  - When the logged set COMPLETES the exercise (feedback modal opens) or the workout: do NOT start a rest.
  - `clearRest()` on: workout exit (`onExit`), phase change to `complete`, and component unmount (`useEffect` cleanup).
  - Logging the next set while a rest is still live: the new `startRest` simply replaces it (context overwrite — no special code needed; assert it).

- [ ] Steps: tests FIRST (extend `ActiveWorkoutPage.test.tsx`, wrap renders with `LiveActivityProvider` — check how the test renders the page today and add the provider to its wrapper; use fake timers): (a) logging a mid-exercise set → `.dynamic-island.live` appears with `Pihenő` (render `<DynamicIsland />` inside the test wrapper alongside the page to observe it); (b) logging the exercise's final set (feedback opens) → NO live island; (c) exiting clears a live rest. Run → FAIL → wire per the contract → PASS → full gate → commit (`feat(fe/train): Szett kész starts the island rest countdown (mezo-8141)`).
- Note: if the page's test file renders via a route harness that already mounts AppLayout, the provider is already there — adapt, don't double-wrap.

---

### Task 7: Warmup phase + secondary surfaces restyle

**Files:**
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (warmup phase block ~:380-470, FeedbackModal, NoteEditSheet, ExerciseActionSheet, add-set sheet — token/class pass only) + `ActiveWorkoutPage.test.tsx` (class assertions only)
- Modify: `frontend/src/features/train/components/WorkoutComplete.tsx` + `WorkoutComplete.test.tsx` (surface tokens only), `frontend/src/features/train/components/PRToast.tsx` (accent swap only)

**Scope — in-vocabulary re-skin, content and behavior identical:**
- Warmup phase: cards → Napív surfaces (`.card`-equivalents on `--surface`/`--warm`, 20px+ radii); the warm-up item rows keep content; the phase's CTA adopts `.np-cta np-press` (keep its exact label and handler).
- `eyebrow brand` / `var(--brand-glow)` accents inside these blocks → `var(--coral-deep)` (text) / `var(--coral)` (accents); `notch-*` classes on touched elements → plain rounded (the notch classes are already border-radius aliases — replace with nothing where the card class covers it, keep where semantic).
- FeedbackModal / sheets: keep `Sheet` semantics + aria; buttons already on `cta-primary`/`cta-ghost` stay (those primitives were re-skinned in S1) — only swap literal `--brand-glow` inline accents.
- `WorkoutComplete`: surface/accent tokens only; recap content, XP, buttons unchanged. `PRToast`: accent → coral family.
- Grep at the end: zero `--brand-glow` left in `ActiveWorkoutPage.tsx`, `WorkoutComplete.tsx`, `PRToast.tsx` (BRAND_TINT_* constants included — replace with coral-tint equivalents, e.g. `rgba(255,107,74,.08)`).

- [ ] Steps: class/copy test updates FIRST where structural assertions exist → FAIL → re-skin → PASS → full gate → commit (`feat(fe/train): warmup phase + workout sheets/recap on Napiv tokens (mezo-8141)` — stage touched files explicitly).

---

### Task 8: Slice close — docs, gates, merge

**Files:**
- Modify: `docs/features/train.md` (§2 session flow: wk-top/excard/setdots/steppers/island rest; §5 integrations: LiveActivityProvider shell seam [app/providers], tab-bar hidden on `/train/session`; §9 gotchas: rest defaults 150/90 hardcoded [no data field], inert 90s/Voice tool chips removed [Voice = Phase 3], island always-dark both themes, island self-clears at 0; §10 file map: restTimer.ts, SetStepper.tsx, DynamicIsland.tsx, LiveActivityProvider.tsx added)
- Modify: `docs/features/_platform-design-system.md` (S5 classes: `.dynamic-island.live`, `.wk-top`/`.exdots`, `.excard`/`.setdots`/`.steprow`/`.stepper`/`.donebtn`/`.nextex`/`.rirrow`; island theme-invariance note)
- Check: `docs/features/today.md` staleness (prototype.css key_file)

- [ ] Steps: edit docs → `node scripts/lint-docs.mjs` PASS → full gate both modes → commit (`docs(features): train + design-system docs updated for Napiv S5 (mezo-8141)`) → controller: `bd update mezo-8141 --notes "S5 Active workout landed: ..."` → push branch → **check `gh pr checks` on a fresh PR: if Actions minutes have reset, standard CI-gate flow; if still billing-blocked, replicate CI locally (FE both modes + lint-docs + lint-liquibase + contract-drift per the S4 precedent) and merge --no-ff with the owner-approved no-CI exception** → push main.

---

## Out of scope (later plans)

S6 Fuel (pill nav sage, kcal gauge, macro bars, enriched timeline) → S7 Me (avatar header, goal track, lavender pills) → S8 Insights re-skin + Pulse dark + cleanup basket (bd `mezo-mifi`: sheets/ChallengeCard token migration, typetag→token unification, ExercisesPage pgact, rest-row chevron, cursor affordance, dead `label-mono brand`, builder-header visual spot-checks, S3 leftovers). The active workout's Voice tool remains Phase 3; per-exercise configurable rest durations need a data-model field (backend) — file under Phase 2 backlog if wanted.

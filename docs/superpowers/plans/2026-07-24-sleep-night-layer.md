# Sleep Slice C-éj (Evening Wind-Down + Night Toolkit + Circadian Theme) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved slice C-éj spec ([`2026-07-24-sleep-night-layer-design.md`](../specs/2026-07-24-sleep-night-layer-design.md), bd `mezo-d71m`): the time-gated `WindDownBanner` on Today, the full-screen extra-dark `NightPage` with the unified 20-minute flow + 3 calm tools, the localStorage night-trace with morning `SleepLogSheet` prefill, and the circadian auto-theme (default).

**Architecture:** Pure FE slice — no backend/contract/migration change. One pure time module (`windDown.ts`) is the single source of truth for every phase window (banner phases AND the dark-theme window). The banner rides the existing habit API (`wind_down` check via the shared `['habitDay', date]` cache); NightPage is a sibling full-screen route (the `train/session` idiom) with literal-dark CSS; the theme gains a third `auto` mode resolved by an app-level effect component.

**Tech Stack:** React 19 + TS, TanStack Query (existing hooks only), react-router, vitest + @testing-library/react, plain CSS in `prototype.css`.

**Reference mockup (approved):** [`2026-07-24-sleep-night-layer-mockup.html`](../specs/2026-07-24-sleep-night-layer-mockup.html)

## Global Constraints

- **Worktree commits MUST bypass the bd hook:** `git -c core.hooksPath=/dev/null commit …` (never plain `git commit` — the hook stages `.beads/issues.jsonl`).
- **All commands run from `frontend/`** unless the step says otherwise. Repo root: `/Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/parallel-session-2`.
- **UI copy Hungarian, code/comments English.** Commit subjects end with `(mezo-d71m)`.
- **FE conventions (mandatory, [`frontend_conventions.md`](../../references/frontend_conventions.md)):** data hooks ONLY from `@/data/hooks`; deep absolute `@/*` imports, no relative `../`; no new barrels; routed leaf = `*Page`; tests colocated next to sources.
- **No backend / `api/` / migration changes anywhere in this plan.**
- **Time constants (exact values):** `DIM_LEAD_MIN = 90`, `WINDDOWN_LEAD_MIN = 60`, `MORNING_LEAD_MIN = 30`, `NIGHT_WATCHDOG_MIN = 20`.
- **CSS:** all new styles are APPENDED to the end of `frontend/src/styles/prototype.css` (single-stylesheet house pattern). Light-context styles use the Napív aliases (`--ink`, `--sub`, `--faint`, `--warm`, `--line`, `--surface`, `--wash-lav`, `--lav-deep`, `--wash-sage`, `--sage-deep`, `--wash-amber`, `--amber-deep`). Night styles use LITERAL colors (theme-independent, spec D4).
- **Test idiom:** `QueryWrapper` from `@/test/queryWrapper`; mock mode via `vi.stubEnv('VITE_USE_MOCK', 'true')` in `beforeEach` + `vi.unstubAllEnvs()` in `afterEach`; time-dependent tests use `vi.useFakeTimers()` + `vi.setSystemTime(...)` and `fireEvent` for clicks (not `userEvent`, which fights fake timers).
- **Mock anchor values** (from `data/me/sleepGoal.ts`): mock goal bed **23:15** / wake **06:45**; real-mode ghost bed **22:00** / wake **06:00**. The `wind_down` mock habit (`data/habit/habitMock.ts:36-38`) is MANUAL, `pending`, xp **5**, title `Wind-down, képernyő le`, anchorCopy `konyhazárás után`.
- **Gate per task:** the named vitest file(s) pass in BOTH modes where the component is dual-mode; the full-suite gate runs once in Task 8.

---

### Task 1: `windDown.ts` — the pure phase/time module

**Files:**
- Create: `frontend/src/features/today/logic/windDown.ts`
- Test: `frontend/src/features/today/logic/windDown.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces (used by Tasks 2, 6):
  - `type WindDownPhase = 'none' | 'dim' | 'winddown' | 'night'`
  - `interface AnchorTimes { bedTime: string; wakeTime: string }` (HH:mm strings — the `SleepGoal` shape's relevant subset)
  - `DIM_LEAD_MIN = 90`, `WINDDOWN_LEAD_MIN = 60`, `MORNING_LEAD_MIN = 30`
  - `windDownPhase(now: Date, goal: AnchorTimes): WindDownPhase`
  - `minsToBed(now: Date, bedTime: string): number` (forward circular distance, 0–1439)
  - `fmtMinsToBed(mins: number): string` (`72` → `"1 ó 12 p"`, `38` → `"38 p"`)
  - `isDarkWindow(now: Date, goal: AnchorTimes): boolean` (≡ `windDownPhase(...) !== 'none'`)

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/today/logic/windDown.test.ts
import { describe, expect, test } from 'vitest'
import {
  windDownPhase, minsToBed, fmtMinsToBed, isDarkWindow,
} from '@/features/today/logic/windDown'

const at = (hhmm: string) => new Date(`2026-07-24T${hhmm}:00`)
const GOAL = { bedTime: '22:00', wakeTime: '06:00' }        // ghost anchor
const WRAP = { bedTime: '00:15', wakeTime: '08:00' }        // past-midnight bed

describe('windDownPhase', () => {
  test('daytime is none', () => {
    expect(windDownPhase(at('15:00'), GOAL)).toBe('none')
    expect(windDownPhase(at('20:29'), GOAL)).toBe('none')
  })
  test('dim window is [bed-90, bed-60)', () => {
    expect(windDownPhase(at('20:30'), GOAL)).toBe('dim')
    expect(windDownPhase(at('20:59'), GOAL)).toBe('dim')
    expect(windDownPhase(at('21:00'), GOAL)).toBe('winddown')
  })
  test('winddown window is [bed-60, bed)', () => {
    expect(windDownPhase(at('21:59'), GOAL)).toBe('winddown')
    expect(windDownPhase(at('22:00'), GOAL)).toBe('night')
  })
  test('night window is [bed, wake-30)', () => {
    expect(windDownPhase(at('03:00'), GOAL)).toBe('night')
    expect(windDownPhase(at('05:29'), GOAL)).toBe('night')
    expect(windDownPhase(at('05:30'), GOAL)).toBe('none')
  })
  test('past-midnight bed wraps correctly', () => {
    expect(windDownPhase(at('22:44'), WRAP)).toBe('none')
    expect(windDownPhase(at('22:45'), WRAP)).toBe('dim')
    expect(windDownPhase(at('23:45'), WRAP)).toBe('winddown')
    expect(windDownPhase(at('00:14'), WRAP)).toBe('winddown')
    expect(windDownPhase(at('00:15'), WRAP)).toBe('night')
    expect(windDownPhase(at('07:29'), WRAP)).toBe('night')
    expect(windDownPhase(at('07:30'), WRAP)).toBe('none')
  })
})

describe('minsToBed / fmtMinsToBed', () => {
  test('forward circular distance to bed', () => {
    expect(minsToBed(at('20:30'), '22:00')).toBe(90)
    expect(minsToBed(at('21:22'), '22:00')).toBe(38)
    expect(minsToBed(at('23:40'), '00:15')).toBe(35)
  })
  test('formats hours + minutes in Hungarian', () => {
    expect(fmtMinsToBed(72)).toBe('1 ó 12 p')
    expect(fmtMinsToBed(90)).toBe('1 ó 30 p')
    expect(fmtMinsToBed(38)).toBe('38 p')
  })
})

describe('isDarkWindow', () => {
  test('dark exactly while any phase is active', () => {
    expect(isDarkWindow(at('15:00'), GOAL)).toBe(false)
    expect(isDarkWindow(at('20:30'), GOAL)).toBe(true)
    expect(isDarkWindow(at('03:00'), GOAL)).toBe(true)
    expect(isDarkWindow(at('05:30'), GOAL)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/today/logic/windDown.test.ts`
Expected: FAIL — `Cannot find module '@/features/today/logic/windDown'`

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/features/today/logic/windDown.ts
/**
 * The single source of truth for the evening/night phase windows (spec D2/D8/D9,
 * 2026-07-24-sleep-night-layer-design.md). Everything is minute-of-day math, wrap-aware,
 * so a past-midnight bed (00:15) works: dim 22:45-23:15, winddown 23:15-00:15.
 * The circadian dark-theme window (D9) is exactly "any phase active" — one clock, no drift.
 */
export type WindDownPhase = 'none' | 'dim' | 'winddown' | 'night'
export interface AnchorTimes { bedTime: string; wakeTime: string }

export const DIM_LEAD_MIN = 90
export const WINDDOWN_LEAD_MIN = 60
export const MORNING_LEAD_MIN = 30

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const wrap = (m: number) => ((m % 1440) + 1440) % 1440
/** Half-open [start, end) containment on the circular 24h clock. */
const inWindow = (now: number, start: number, end: number) =>
  start <= end ? now >= start && now < end : now >= start || now < end

export function windDownPhase(now: Date, goal: AnchorTimes): WindDownPhase {
  const n = now.getHours() * 60 + now.getMinutes()
  const bed = toMin(goal.bedTime)
  const morningEnd = wrap(toMin(goal.wakeTime) - MORNING_LEAD_MIN)
  if (inWindow(n, wrap(bed - DIM_LEAD_MIN), wrap(bed - WINDDOWN_LEAD_MIN))) return 'dim'
  if (inWindow(n, wrap(bed - WINDDOWN_LEAD_MIN), bed)) return 'winddown'
  if (inWindow(n, bed, morningEnd)) return 'night'
  return 'none'
}

export function minsToBed(now: Date, bedTime: string): number {
  const n = now.getHours() * 60 + now.getMinutes()
  return wrap(toMin(bedTime) - n)
}

export function fmtMinsToBed(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h} ó ${m} p` : `${m} p`
}

export function isDarkWindow(now: Date, goal: AnchorTimes): boolean {
  return windDownPhase(now, goal) !== 'none'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/today/logic/windDown.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/today/logic/windDown.ts src/features/today/logic/windDown.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(today): windDown phase module - wrap-aware evening/night windows (mezo-d71m)"
```

---

### Task 2: `WindDownBanner` on Today

**Files:**
- Create: `frontend/src/features/today/components/WindDownBanner.tsx`
- Test: `frontend/src/features/today/components/WindDownBanner.test.tsx`
- Modify: `frontend/src/features/today/pages/TodayPage.tsx` (import + mount directly under `<IntentionBanner />`, currently line 54)
- Modify: `frontend/src/styles/prototype.css` (append the `.wdb*` family)

**Interfaces:**
- Consumes: Task 1 (`windDownPhase`, `minsToBed`, `fmtMinsToBed`, `WindDownPhase`); existing hooks `useSleepGoal()` (`{ goal: SleepGoal, isPending }` — `goal` is ALWAYS an object: mock seed or ghost), `useHabitDay(date)` (`{ habits: HabitItem[] }`), `useHabitActions(date)` (`{ check(key): Promise<LevelUpResult[] | undefined>, pending }`), `useLevelUp()` (`{ showLevelUp }`), `localDateString()` from `@/shared/lib/dates`.
- Produces: `<WindDownBanner />` (no props) — later tasks don't consume it; the `/me/sleep/night` Link target becomes real in Task 5.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/today/components/WindDownBanner.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { WindDownBanner } from '@/features/today/components/WindDownBanner'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Mock goal: bed 23:15 / wake 06:45 (data/me/sleepGoal.ts) ->
// dim 21:45-22:15 · winddown 22:15-23:15 · night 23:15-06:15.
const renderBanner = () =>
  render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter>
          <WindDownBanner />
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )

const setClock = (iso: string) => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(iso))
}

describe('WindDownBanner', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  test('renders nothing during the day', () => {
    setClock('2026-07-24T15:00:00')
    const { container } = renderBanner()
    expect(container.querySelector('.wdb')).toBeNull()
    expect(container.querySelector('.wdb-night')).toBeNull()
  })

  test('dim phase: title, three tips, REM stat, countdown pill', () => {
    setClock('2026-07-24T22:00:00')
    renderBanner()
    expect(screen.getByText('Tompítsd a fényeket')).toBeInTheDocument()
    expect(screen.getByText(/30 lux alá/)).toBeInTheDocument()
    expect(screen.getByText(/18 °C felé/)).toBeInTheDocument()
    expect(screen.getByText(/\+18% REM/)).toBeInTheDocument()
    expect(screen.getByText(/még 1 ó 15 p/)).toBeInTheDocument()
  })

  test('winddown phase: Kapcsolj le + the wind_down habit row with Pipa', () => {
    setClock('2026-07-24T22:30:00')
    renderBanner()
    expect(screen.getByText('Kapcsolj le')).toBeInTheDocument()
    expect(screen.getByText('Wind-down, képernyő le')).toBeInTheDocument()
    expect(screen.getByText('+5 XP')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pipálása/ })).toBeInTheDocument()
  })

  test('Pipa checks the habit and flips to the done state', async () => {
    setClock('2026-07-24T22:30:00')
    renderBanner()
    fireEvent.click(screen.getByRole('button', { name: /pipálása/ }))
    expect(await screen.findByText(/Leállás megvolt/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pipálása/ })).toBeNull()
  })

  test('night phase renders the dark entry row linking to /me/sleep/night', () => {
    setClock('2026-07-24T23:30:00')
    renderBanner()
    const link = screen.getByRole('link', { name: /Éjszakai mód/ })
    expect(link).toHaveAttribute('href', '/me/sleep/night')
  })

  test('disappears after wake-30', () => {
    setClock('2026-07-24T06:20:00')
    const { container } = renderBanner()
    expect(container.querySelector('.wdb')).toBeNull()
    expect(container.querySelector('.wdb-night')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/today/components/WindDownBanner.test.tsx`
Expected: FAIL — `Cannot find module '@/features/today/components/WindDownBanner'`

- [ ] **Step 3: Write the component**

```tsx
// frontend/src/features/today/components/WindDownBanner.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useHabitActions, useHabitDay, useSleepGoal } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import {
  fmtMinsToBed, minsToBed, windDownPhase,
} from '@/features/today/logic/windDown'
import { localDateString } from '@/shared/lib/dates'

const TICK_MS = 30_000

/**
 * The Today evening/night band (slice C-éj, spec D2/D3): dim -> winddown -> night entry,
 * all derived from the sleep anchor. Carries the wind_down MANUAL habit's check in the
 * winddown phase — same ['habitDay', date] cache as RoutineCard, so the two stay in sync.
 */
export function WindDownBanner() {
  const date = localDateString()
  const { goal, isPending } = useSleepGoal()
  const { habits } = useHabitDay(date)
  const { check, pending } = useHabitActions(date)
  const { showLevelUp } = useLevelUp()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  if (isPending) return null // real mode before the goal resolves — no flash
  const phase = windDownPhase(now, goal)
  if (phase === 'none') return null

  if (phase === 'night') {
    return (
      <Link to="/me/sleep/night" className="wdb-night">
        <span className="wdb-night-moon" aria-hidden="true">🌙</span>
        <span className="wdb-night-tx">
          <span className="wdb-night-t1">Éjszakai mód</span>
          <span className="wdb-night-t2">Felébredtél? Ne nézd az órát — gyere ide.</span>
        </span>
        <span className="wdb-night-chev" aria-hidden="true">›</span>
      </Link>
    )
  }

  const pill = `🛏️ még ${fmtMinsToBed(minsToBed(now, goal.bedTime))}`
  const windDownHabit = habits.find((h) => h.key === 'wind_down')

  if (phase === 'dim') {
    return (
      <section className="wdb" aria-label="Esti ráhangolódás">
        <div className="wdb-hd">
          <span aria-hidden="true">🕯️</span>
          <span className="wdb-eye">Esti ráhangolódás</span>
          <span className="wdb-pill">{pill}</span>
        </div>
        <div className="wdb-title">Tompítsd a fényeket</div>
        <div className="wdb-list">
          <div className="wdb-tip"><span className="wdb-tip-ic" aria-hidden="true">💡</span><span><b>30 lux alá</b> — félhomály, nem sötét</span></div>
          <div className="wdb-tip"><span className="wdb-tip-ic" aria-hidden="true">🔶</span><span><b>Meleg, sárga fény</b> — hideg-fehér le</span></div>
          <div className="wdb-tip"><span className="wdb-tip-ic" aria-hidden="true">❄️</span><span><b>Hűtsd a szobát</b> — 18 °C felé</span></div>
        </div>
        <div className="wdb-foot">
          <div className="wdb-stat">A tompított, meleg este <b>+18% REM</b>-et ad — Walker mérése.</div>
        </div>
      </section>
    )
  }

  // winddown phase
  const doCheck = () => {
    check('wind_down').then((lu) => lu?.[0] && showLevelUp(lu[0]))
  }
  return (
    <section className="wdb" aria-label="Esti leállás">
      <div className="wdb-hd">
        <span aria-hidden="true">🌙</span>
        <span className="wdb-eye">Esti leállás</span>
        <span className="wdb-pill">{pill}</span>
      </div>
      <div className="wdb-title">Kapcsolj le</div>
      <div className="wdb-list">
        <div className="wdb-tip"><span className="wdb-tip-ic" aria-hidden="true">📵</span><span><b>Képernyők le</b> — az agy hadd unatkozzon</span></div>
        <div className="wdb-tip"><span className="wdb-tip-ic" aria-hidden="true">🕯️</span><span><b>Fények tompítva</b> maradnak</span></div>
      </div>
      {windDownHabit && (
        <div className="wdb-foot">
          {windDownHabit.status === 'done' ? (
            <div className="wdb-done">✓ Leállás megvolt — már csak az ágy van hátra.</div>
          ) : (
            <div className="wdb-hab">
              <div className="wdb-hab-tx">
                <div className="wdb-hab-t1">{windDownHabit.title}</div>
                <div className="wdb-hab-t2">{windDownHabit.anchorCopy}</div>
              </div>
              <span className="wdb-hab-xp">+{windDownHabit.xp} XP</span>
              <button className="wdb-pipa" disabled={pending}
                aria-label={`${windDownHabit.title} pipálása`} onClick={doCheck}>
                Pipa
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Append the `.wdb*` CSS family to `frontend/src/styles/prototype.css`**

```css
/* ===== WindDownBanner — the Today evening/night band (mezo-d71m, spec D2/D3) ===== */
.wdb { border-radius: 22px; padding: 20px 18px; margin: 8px 24px;
       background: linear-gradient(150deg, var(--wash-lav) 0%, var(--surface) 70%);
       box-shadow: 0 1px 3px rgba(43,33,24,.06), 0 8px 22px rgba(122,109,168,.14); }
.wdb-hd { display: flex; align-items: center; gap: 8px; }
.wdb-eye { font: 700 10.5px/1 var(--ff-body); letter-spacing: .11em; color: var(--lav-deep); text-transform: uppercase; }
.wdb-pill { margin-left: auto; background: var(--wash-lav); color: var(--lav-deep);
            font: 700 11.5px/1 var(--ff-body); padding: 7px 12px; border-radius: 999px; white-space: nowrap; }
.wdb-title { font: 600 20px/1.3 var(--ff-display); color: var(--ink); margin-top: 14px; }
.wdb-list { margin-top: 14px; display: flex; flex-direction: column; gap: 10px; }
.wdb-tip { display: flex; align-items: center; gap: 11px; font: 500 13px/1.45 var(--ff-body); color: var(--sub); }
.wdb-tip b { color: var(--ink); font-weight: 600; }
.wdb-tip-ic { width: 32px; height: 32px; border-radius: 10px; background: var(--warm);
              display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
.wdb-foot { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); }
.wdb-stat { font: 500 12px/1.6 var(--ff-body); color: var(--faint); }
.wdb-stat b { color: var(--sage-deep); font-weight: 700; }
.wdb-hab { display: flex; align-items: center; gap: 12px; background: var(--surface);
           border: 1px solid var(--line); border-radius: 16px; padding: 12px 14px; }
.wdb-hab-tx { flex: 1; }
.wdb-hab-t1 { font: 600 13.5px/1.3 var(--ff-body); color: var(--ink); }
.wdb-hab-t2 { font: 500 10.5px/1.5 var(--ff-body); color: var(--faint); }
.wdb-hab-xp { font: 700 10.5px/1 var(--ff-body); color: var(--amber-deep); background: var(--wash-amber);
              padding: 5px 8px; border-radius: 999px; }
.wdb-pipa { background: var(--lav-deep); color: var(--text-inverse); font: 700 12.5px/1 var(--ff-body);
            padding: 11px 18px; border-radius: 999px; box-shadow: 0 2px 8px rgba(122,109,168,.32); }
.wdb-pipa:disabled { opacity: .6; }
.wdb-done { display: flex; align-items: center; gap: 9px; background: var(--wash-sage);
            border-radius: 16px; padding: 12px 14px; font: 600 13px/1.4 var(--ff-body); color: var(--sage-deep); }
/* night entry row — literal dark (theme-independent, like NightPage) */
.wdb-night { display: flex; align-items: center; gap: 14px; margin: 8px 24px; padding: 20px 18px;
             border-radius: 22px; text-decoration: none;
             background: linear-gradient(140deg, #1A1622 0%, #221E1B 82%);
             box-shadow: 0 2px 8px rgba(0,0,0,.28); }
.wdb-night-moon { font-size: 22px; filter: drop-shadow(0 0 7px rgba(185,172,217,.45)); }
.wdb-night-tx { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.wdb-night-t1 { font: 600 16px/1.3 var(--ff-display); color: #F5EFE6; }
.wdb-night-t2 { font: 500 11.5px/1.55 var(--ff-body); color: #B7A899; }
.wdb-night-chev { color: #B9ACD9; font-size: 17px; }
```

- [ ] **Step 5: Mount in `TodayPage.tsx`**

Add the import after line 7 (`IntentionBanner` import):

```tsx
import { WindDownBanner } from '@/features/today/components/WindDownBanner'
```

Insert after `<IntentionBanner />` (line 54):

```tsx
      <IntentionBanner />
      <WindDownBanner />
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run src/features/today/components/WindDownBanner.test.tsx`
Expected: PASS. Then a quick regression: `pnpm vitest run src/features/today` — all Today tests still green (the banner renders `null` in tests that run at vitest's default daytime clock; if any Today snapshot-ish test fixes the clock into the evening window, update that test's expectations to tolerate the banner).

- [ ] **Step 7: Commit**

```bash
git add src/features/today/components/WindDownBanner.tsx src/features/today/components/WindDownBanner.test.tsx src/features/today/pages/TodayPage.tsx src/styles/prototype.css
git -c core.hooksPath=/dev/null commit -m "feat(today): WindDownBanner - dim/winddown/night phases carrying the wind_down check (mezo-d71m)"
```

---

### Task 3: Night content + the three calm-tool components

**Files:**
- Create: `frontend/src/features/me/logic/nightContent.ts`
- Create: `frontend/src/features/me/components/NightBreathing.tsx`
- Create: `frontend/src/features/me/components/NightBodyScan.tsx`
- Create: `frontend/src/features/me/components/NightWalk.tsx`
- Test: `frontend/src/features/me/components/nightTools.test.tsx` (one file for the three presentational tools)
- Modify: `frontend/src/styles/prototype.css` (append the `.nb-*` / `.ns-*` / `.nw-*` tool styles)

**Interfaces:**
- Consumes: nothing outside this task.
- Produces (used by Task 5):
  - `NightBreathing({ onStop }: { onStop: () => void })`
  - `NightBodyScan({ onStop }: { onStop: () => void })`
  - `NightWalk({ onStop }: { onStop: () => void })`
  - From `nightContent.ts`: `BODY_SCAN_STEPS: ScanStep[]` (`{ part: string; text: string }`, 10 items), `BODY_SCAN_STEP_MS = 40_000`, `WALK_CARDS: string[]` (3 items), `WALK_CARD_MS = 90_000`

- [ ] **Step 1: Write `nightContent.ts`** (content-first — the tests assert on this copy)

```ts
// frontend/src/features/me/logic/nightContent.ts
/** HU copy + pacing for the NightPage calm tools (spec D6). No audio assets by design. */

export interface ScanStep { part: string; text: string }

export const BODY_SCAN_STEP_MS = 40_000
export const BODY_SCAN_STEPS: ScanStep[] = [
  { part: 'A fejbőröd', text: 'Kezdd legfelül. Érezd a fejbőröd — engedd, hogy a homlokod kisimuljon.' },
  { part: 'Az arcod', text: 'Lazítsd el az állkapcsod, a nyelved essen el a szájpadlásról. A szemhéjad nehéz.' },
  { part: 'A vállaid', text: 'Engedd le őket a füledtől. Vedd észre, hol tartasz feszültséget — és kilégzéssel hagyd, hogy kioldódjon.' },
  { part: 'A karjaid', text: 'A felkartól az ujjbegyekig. Nehezek, melegek, elengedettek.' },
  { part: 'A mellkasod', text: 'Figyeld a légzésed — nem irányítod, csak nézed, ahogy jön és megy.' },
  { part: 'A hasad', text: 'Engedd el a hasfalad. A lélegzet hulláma szabadon mozog.' },
  { part: 'A hátad', text: 'Érezd, ahogy a matrac megtart. Minden kilégzéssel jobban belesüllyedsz.' },
  { part: 'A csípőd és a combjaid', text: 'Nehezek és melegek. Az ágy tart téged — neked már nem kell.' },
  { part: 'A lábszárad', text: 'A vádlid puha, a bokád laza. A feszültség lefelé csorog és elfogy.' },
  { part: 'A lábfejed', text: 'A talpadtól a lábujjakig. Az egész tested nehéz, meleg, nyugodt.' },
]

export const WALK_CARD_MS = 90_000
export const WALK_SETUP = {
  title: 'Válassz egy jól ismert utat',
  text: 'A séta a házatok körül, az út a régi iskolába, egy ösvény, amit ezerszer bejártál. Indulj el rajta — fejben, lépésről lépésre.',
}
export const WALK_CARDS: string[] = [
  '„Meséld magadnak, mint egy filmet — 4K-ban. Milyen színű a kapu? Mit hallasz? Milyen a levegő?"',
  '„Haladj lassan. Egy-egy részletnél időzz el — a járda mintázata, egy ismerős fa, a fény az ablakokon."',
  '„Ha elkalandozol, csak térj vissza az útra. Nem baj — ez a séta lényege."',
]
```

- [ ] **Step 2: Write the failing tests**

```tsx
// frontend/src/features/me/components/nightTools.test.tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { NightBreathing } from '@/features/me/components/NightBreathing'
import { NightBodyScan } from '@/features/me/components/NightBodyScan'
import { NightWalk } from '@/features/me/components/NightWalk'
import { BODY_SCAN_STEP_MS, BODY_SCAN_STEPS, WALK_CARD_MS, WALK_CARDS } from '@/features/me/logic/nightContent'

describe('NightBreathing', () => {
  test('renders the three phase labels and the 5-6-7 eyebrow', () => {
    render(<NightBreathing onStop={() => {}} />)
    expect(screen.getByText('Be…')).toBeInTheDocument()
    expect(screen.getByText('Tartsd…')).toBeInTheDocument()
    expect(screen.getByText('Ki…')).toBeInTheDocument()
    expect(screen.getByText(/5 – 6 – 7/)).toBeInTheDocument()
  })
  test('stop button calls onStop', () => {
    const onStop = vi.fn()
    render(<NightBreathing onStop={onStop} />)
    fireEvent.click(screen.getByRole('button', { name: /megállítom/i }))
    expect(onStop).toHaveBeenCalled()
  })
})

describe('NightBodyScan', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('starts on step 1 and auto-advances after BODY_SCAN_STEP_MS', () => {
    render(<NightBodyScan onStop={() => {}} />)
    expect(screen.getByText(BODY_SCAN_STEPS[0].part)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(BODY_SCAN_STEP_MS))
    expect(screen.getByText(BODY_SCAN_STEPS[1].part)).toBeInTheDocument()
  })
  test('tap advances manually and stops at the last step', () => {
    render(<NightBodyScan onStop={() => {}} />)
    const stage = screen.getByRole('button', { name: /következő lépés/i })
    for (let i = 0; i < BODY_SCAN_STEPS.length + 2; i++) fireEvent.click(stage)
    expect(screen.getByText(BODY_SCAN_STEPS[BODY_SCAN_STEPS.length - 1].part)).toBeInTheDocument()
  })
})

describe('NightWalk', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('starts on the setup card, then advances to reminder cards', () => {
    render(<NightWalk onStop={() => {}} />)
    expect(screen.getByText('Válassz egy jól ismert utat')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(WALK_CARD_MS))
    expect(screen.getByText(WALK_CARDS[0])).toBeInTheDocument()
  })
  test('tap advances and clamps at the last card', () => {
    render(<NightWalk onStop={() => {}} />)
    const stage = screen.getByRole('button', { name: /következő kártya/i })
    for (let i = 0; i < WALK_CARDS.length + 3; i++) fireEvent.click(stage)
    expect(screen.getByText(WALK_CARDS[WALK_CARDS.length - 1])).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/features/me/components/nightTools.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 4: Write the three components**

```tsx
// frontend/src/features/me/components/NightBreathing.tsx
/** 5-6-7 breathing pacer (spec D6). The 18s cycle is pure CSS animation; with
 *  prefers-reduced-motion the orb stays static and only the labels cycle (also CSS). */
export function NightBreathing({ onStop }: { onStop: () => void }) {
  return (
    <div className="nb">
      <div className="night-eye">Légzés · 5 – 6 – 7</div>
      <div className="nb-stage" aria-hidden="true">
        <div className="nb-orb" />
        <div className="nb-labels">
          <span className="nb-in">Be…</span>
          <span className="nb-hold">Tartsd…</span>
          <span className="nb-out">Ki…</span>
        </div>
      </div>
      <div className="nb-hint">Kövesd a kört a légzéseddel.<br />A hosszú kilégzés nyugtatja az idegrendszert.</div>
      <button className="night-quiet" onClick={onStop}>megállítom ›</button>
    </div>
  )
}
```

```tsx
// frontend/src/features/me/components/NightBodyScan.tsx
import { useEffect, useState } from 'react'
import { BODY_SCAN_STEP_MS, BODY_SCAN_STEPS } from '@/features/me/logic/nightContent'

/** Head-to-toe body scan: slow auto-advance, tap to step, clamps at the last step (spec D6). */
export function NightBodyScan({ onStop }: { onStop: () => void }) {
  const [idx, setIdx] = useState(0)
  const last = BODY_SCAN_STEPS.length - 1
  useEffect(() => {
    if (idx >= last) return
    const id = setInterval(() => setIdx((i) => Math.min(i + 1, last)), BODY_SCAN_STEP_MS)
    return () => clearInterval(id)
  }, [idx, last])
  const step = BODY_SCAN_STEPS[idx]
  return (
    <div className="ns">
      <div className="night-eye">Testpásztázás</div>
      <button className="ns-card" aria-label="Következő lépés"
        onClick={() => setIdx((i) => Math.min(i + 1, last))}>
        <div className="ns-part">{step.part}</div>
        <div className="ns-tx">{step.text}</div>
      </button>
      <div className="ns-dots" aria-hidden="true">
        {BODY_SCAN_STEPS.map((s, i) => (
          <span key={s.part} className={i === idx ? 'ns-dot on' : 'ns-dot'} />
        ))}
      </div>
      <div className="ns-hint">Magától lép tovább (~40 mp) — koppintásra is léphetsz.</div>
      <button className="night-quiet" onClick={onStop}>megállítom ›</button>
    </div>
  )
}
```

```tsx
// frontend/src/features/me/components/NightWalk.tsx
import { useEffect, useState } from 'react'
import { WALK_CARD_MS, WALK_CARDS, WALK_SETUP } from '@/features/me/logic/nightContent'

/** The 4K mental-walk self-narration frame (Alison Harvey's method, spec D6):
 *  a setup card, then very slowly advancing gentle reminders. */
export function NightWalk({ onStop }: { onStop: () => void }) {
  // idx 0 = setup, 1..WALK_CARDS.length = reminder cards
  const [idx, setIdx] = useState(0)
  const last = WALK_CARDS.length
  useEffect(() => {
    if (idx >= last) return
    const id = setInterval(() => setIdx((i) => Math.min(i + 1, last)), WALK_CARD_MS)
    return () => clearInterval(id)
  }, [idx, last])
  return (
    <div className="nw">
      <div className="night-eye">4K-séta</div>
      <button className="nw-stage" aria-label="Következő kártya"
        onClick={() => setIdx((i) => Math.min(i + 1, last))}>
        {idx === 0 ? (
          <span className="nw-setup">
            <span className="nw-t">{WALK_SETUP.title}</span>
            <span className="nw-tx">{WALK_SETUP.text}</span>
          </span>
        ) : (
          <span className="nw-remind"><span className="nw-rtx">{WALK_CARDS[idx - 1]}</span></span>
        )}
      </button>
      <div className="nw-note">A kártyák nagyon lassan, maguktól váltanak.</div>
      <button className="night-quiet" onClick={onStop}>megállítom ›</button>
    </div>
  )
}
```

- [ ] **Step 5: Append the tool CSS to `frontend/src/styles/prototype.css`**

```css
/* ===== NightPage calm tools (mezo-d71m, spec D6) — literal dark, theme-independent ===== */
.nb, .ns, .nw { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.nb-stage { position: relative; height: 250px; display: flex; align-items: center; justify-content: center; }
.nb-orb { width: 180px; height: 180px; border-radius: 50%;
          background: radial-gradient(circle at 50% 42%, rgba(185,172,217,.34), rgba(185,172,217,.06) 70%);
          box-shadow: 0 0 52px rgba(185,172,217,.18);
          animation: nb-breath 18s ease-in-out infinite; }
@keyframes nb-breath {
  0% { transform: scale(.52); } 27.8% { transform: scale(1); }
  61.1% { transform: scale(1); } 100% { transform: scale(.52); }
}
.nb-labels { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.nb-labels span { position: absolute; font: 600 21px/1 var(--ff-display); color: #F5EFE6; opacity: 0; }
.nb-in { animation: nb-lb-in 18s linear infinite; }
.nb-hold { animation: nb-lb-hold 18s linear infinite; }
.nb-out { animation: nb-lb-out 18s linear infinite; }
@keyframes nb-lb-in { 0% { opacity: .9; } 25% { opacity: .9; } 29% { opacity: 0; } 100% { opacity: 0; } }
@keyframes nb-lb-hold { 0% { opacity: 0; } 27% { opacity: 0; } 31% { opacity: .9; } 58% { opacity: .9; } 63% { opacity: 0; } 100% { opacity: 0; } }
@keyframes nb-lb-out { 0% { opacity: 0; } 60% { opacity: 0; } 64% { opacity: .9; } 97% { opacity: .9; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .nb-orb { animation: none; }
  /* labels keep cycling — the pacing survives without motion */
}
.nb-hint, .ns-hint, .nw-note { font: 500 12px/1.7 var(--ff-body); color: #6E6156; text-align: center; margin-top: 12px; }
.ns-card, .nw-stage { display: block; width: 100%; text-align: center; margin-top: 24px;
                      background: #1A1613; border: 1px solid rgba(245,239,230,.05); border-radius: 20px; padding: 26px 20px; }
.ns-part { font: 600 20px/1.3 var(--ff-display); color: #F5EFE6; margin-bottom: 12px; }
.ns-tx { font: 500 13.5px/1.75 var(--ff-body); color: #B7A899; }
.ns-dots { display: flex; gap: 7px; justify-content: center; margin-top: 22px; }
.ns-dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(245,239,230,.14); }
.ns-dot.on { background: #B9ACD9; }
.nw-setup, .nw-remind { display: block; }
.nw-t { display: block; font: 600 17px/1.35 var(--ff-display); color: #F5EFE6; margin-bottom: 10px; }
.nw-tx { display: block; font: 500 13px/1.7 var(--ff-body); color: #B7A899; }
.nw-rtx { display: block; font: 500 13px/1.7 var(--ff-body); color: #B7A899; font-style: italic; }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run src/features/me/components/nightTools.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/features/me/logic/nightContent.ts src/features/me/components/NightBreathing.tsx src/features/me/components/NightBodyScan.tsx src/features/me/components/NightWalk.tsx src/features/me/components/nightTools.test.tsx src/styles/prototype.css
git -c core.hooksPath=/dev/null commit -m "feat(me): night calm tools - breathing pacer, body scan, 4K walk (mezo-d71m)"
```

---

### Task 4: `nightFlow.ts` + `nightTrace.ts` — the pure night logic pair

**Files:**
- Create: `frontend/src/features/me/logic/nightFlow.ts`
- Create: `frontend/src/features/me/logic/nightTrace.ts`
- Test: `frontend/src/features/me/logic/nightFlow.test.ts`
- Test: `frontend/src/features/me/logic/nightTrace.test.ts`

**Interfaces:**
- Consumes: `localDateString(d?: Date)` from `@/shared/lib/dates`.
- Produces (used by Tasks 5, 7):
  - `nightFlow.ts`: `type NightPhase = 'idle' | 'waiting' | 'getup'`, `type NightTool = 'breathing' | 'bodyscan' | 'walk' | null`, `NIGHT_WATCHDOG_MIN = 20`, `WATCHDOG_TICK_MS = 15_000`, `watchdogDone(startedAtMs: number, nowMs: number): boolean`
  - `nightTrace.ts`: `interface NightTrace { count: number; lastAt: string }`, `traceDateFor(now: Date): string`, `recordNightWake(now?: Date): void`, `readNightWake(date: string): NightTrace | null`, `clearNightWake(date: string): void`

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/features/me/logic/nightFlow.test.ts
import { describe, expect, test } from 'vitest'
import { NIGHT_WATCHDOG_MIN, watchdogDone } from '@/features/me/logic/nightFlow'

describe('watchdogDone', () => {
  const MIN = 60_000
  test('false before the 20-minute mark', () => {
    expect(watchdogDone(0, (NIGHT_WATCHDOG_MIN - 1) * MIN)).toBe(false)
  })
  test('true at and after the 20-minute mark', () => {
    expect(watchdogDone(0, NIGHT_WATCHDOG_MIN * MIN)).toBe(true)
    expect(watchdogDone(0, NIGHT_WATCHDOG_MIN * MIN + 5 * MIN)).toBe(true)
  })
  test('survives a large sleep gap (timestamp-based, not tick-counted)', () => {
    const start = 1_000_000
    expect(watchdogDone(start, start + 3 * 60 * MIN)).toBe(true)
  })
})
```

```ts
// frontend/src/features/me/logic/nightTrace.test.ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  clearNightWake, readNightWake, recordNightWake, traceDateFor,
} from '@/features/me/logic/nightTrace'

describe('nightTrace', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-24T03:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  test('traceDateFor: after 18:00 the wake belongs to TOMORROW morning', () => {
    expect(traceDateFor(new Date('2026-07-24T23:30:00'))).toBe('2026-07-25')
    expect(traceDateFor(new Date('2026-07-24T03:00:00'))).toBe('2026-07-24')
    expect(traceDateFor(new Date('2026-07-24T17:59:00'))).toBe('2026-07-24')
  })

  test('record + read + increment', () => {
    recordNightWake()
    expect(readNightWake('2026-07-24')).toMatchObject({ count: 1 })
    recordNightWake()
    expect(readNightWake('2026-07-24')).toMatchObject({ count: 2 })
    expect(readNightWake('2026-07-23')).toBeNull()
  })

  test('clear removes the entry', () => {
    recordNightWake()
    clearNightWake('2026-07-24')
    expect(readNightWake('2026-07-24')).toBeNull()
  })

  test('recording prunes entries older than 3 days', () => {
    localStorage.setItem('mezo-night-wake:2026-07-19', JSON.stringify({ count: 1, lastAt: 'x' }))
    localStorage.setItem('mezo-night-wake:2026-07-23', JSON.stringify({ count: 1, lastAt: 'x' }))
    recordNightWake()
    expect(localStorage.getItem('mezo-night-wake:2026-07-19')).toBeNull()
    expect(readNightWake('2026-07-23')).not.toBeNull()
  })

  test('corrupt stored JSON reads as null', () => {
    localStorage.setItem('mezo-night-wake:2026-07-24', 'not-json')
    expect(readNightWake('2026-07-24')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/me/logic/nightFlow.test.ts src/features/me/logic/nightTrace.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the implementations**

```ts
// frontend/src/features/me/logic/nightFlow.ts
/** NightPage state machine vocabulary + the silent 20-minute watchdog (spec D5).
 *  The watchdog compares TIMESTAMPS (not tick counts) so a slept screen catches up
 *  on its next interval tick. No countdown is ever rendered — Walker's rule. */
export type NightPhase = 'idle' | 'waiting' | 'getup'
export type NightTool = 'breathing' | 'bodyscan' | 'walk' | null

export const NIGHT_WATCHDOG_MIN = 20
export const WATCHDOG_TICK_MS = 15_000

export function watchdogDone(startedAtMs: number, nowMs: number): boolean {
  return nowMs - startedAtMs >= NIGHT_WATCHDOG_MIN * 60_000
}
```

```ts
// frontend/src/features/me/logic/nightTrace.ts
import { localDateString } from '@/shared/lib/dates'

/** Soft night-wake trace (spec D7): localStorage only, keyed by the MORNING the wake
 *  belongs to (an evening wake >= 18:00 belongs to tomorrow's log). SleepLogSheet
 *  prefills awakenings from it and clears it on a successful save. */
export interface NightTrace { count: number; lastAt: string }

const PREFIX = 'mezo-night-wake:'
const KEEP_DAYS = 3

export function traceDateFor(now: Date): string {
  if (now.getHours() >= 18) {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return localDateString(tomorrow)
  }
  return localDateString(now)
}

export function readNightWake(date: string): NightTrace | null {
  try {
    const raw = localStorage.getItem(PREFIX + date)
    if (!raw) return null
    const parsed = JSON.parse(raw) as NightTrace
    return typeof parsed?.count === 'number' ? parsed : null
  } catch {
    return null
  }
}

export function recordNightWake(now: Date = new Date()): void {
  try {
    const date = traceDateFor(now)
    const prev = readNightWake(date)
    const next: NightTrace = { count: (prev?.count ?? 0) + 1, lastAt: now.toISOString() }
    localStorage.setItem(PREFIX + date, JSON.stringify(next))
    prune(now)
  } catch { /* storage unavailable — the trace is best-effort */ }
}

export function clearNightWake(date: string): void {
  try { localStorage.removeItem(PREFIX + date) } catch { /* ignore */ }
}

function prune(now: Date): void {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - KEEP_DAYS)
  const cutoffIso = localDateString(cutoff)
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i)
    if (k?.startsWith(PREFIX) && k.slice(PREFIX.length) < cutoffIso) localStorage.removeItem(k)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/me/logic/nightFlow.test.ts src/features/me/logic/nightTrace.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/me/logic/nightFlow.ts src/features/me/logic/nightFlow.test.ts src/features/me/logic/nightTrace.ts src/features/me/logic/nightTrace.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(me): nightFlow watchdog + nightTrace localStorage morning trace (mezo-d71m)"
```

---

### Task 5: `NightPage` — route, chrome, the unified flow

**Files:**
- Create: `frontend/src/features/me/pages/NightPage.tsx`
- Test: `frontend/src/features/me/pages/NightPage.test.tsx`
- Modify: `frontend/src/app/router.tsx` (import + sibling route after the `me/goals/new` line)
- Modify: `frontend/src/app/AppLayout.tsx:17` (extend `hideTabBar`)
- Modify: `frontend/src/styles/prototype.css` (append the `.night*` page family)

**Interfaces:**
- Consumes: Task 3 components (`NightBreathing`/`NightBodyScan`/`NightWalk`, each `{ onStop: () => void }`); Task 4 (`NightPhase`, `NightTool`, `WATCHDOG_TICK_MS`, `watchdogDone`, `recordNightWake`).
- Produces: the routed page at `/me/sleep/night` (Task 2's night Link and Task 7's SleepPage row navigate here).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/me/pages/NightPage.test.tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { NightPage } from '@/features/me/pages/NightPage'
import { NIGHT_WATCHDOG_MIN, WATCHDOG_TICK_MS } from '@/features/me/logic/nightFlow'

const renderPage = () =>
  render(<MemoryRouter initialEntries={['/me/sleep/night']}><NightPage /></MemoryRouter>)

describe('NightPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-24T03:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  test('idle: intro copy + Ébren vagyok CTA, no clock anywhere', () => {
    renderPage()
    expect(screen.getByText('Felébredtél?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ébren vagyok' })).toBeInTheDocument()
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).toBeNull() // never render a clock
  })

  test('Ébren vagyok -> waiting with the three tools, and records the night trace', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Ébren vagyok' }))
    expect(screen.getByText('Én figyelem az időt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Légzés/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Testpásztázás/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /4K-séta/ })).toBeInTheDocument()
    expect(localStorage.getItem('mezo-night-wake:2026-07-24')).not.toBeNull()
  })

  test('a tool opens from waiting and megállítom returns to waiting', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Ébren vagyok' }))
    fireEvent.click(screen.getByRole('button', { name: /Légzés/ }))
    expect(screen.getByText('Be…')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /megállítom/ }))
    expect(screen.getByText('Én figyelem az időt')).toBeInTheDocument()
  })

  test('after ~20 minutes waiting flips to the getUp prompt (even while a tool is open)', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Ébren vagyok' }))
    fireEvent.click(screen.getByRole('button', { name: /Testpásztázás/ }))
    act(() => vi.advanceTimersByTime(NIGHT_WATCHDOG_MIN * 60_000 + WATCHDOG_TICK_MS))
    expect(screen.getByText(/Kelj fel/)).toBeInTheDocument()
  })

  test('Visszafeküdtem starts a fresh waiting round', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Ébren vagyok' }))
    act(() => vi.advanceTimersByTime(NIGHT_WATCHDOG_MIN * 60_000 + WATCHDOG_TICK_MS))
    fireEvent.click(screen.getByRole('button', { name: 'Visszafeküdtem' }))
    expect(screen.getByText('Én figyelem az időt')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(NIGHT_WATCHDOG_MIN * 60_000 + WATCHDOG_TICK_MS))
    expect(screen.getByText(/Kelj fel/)).toBeInTheDocument() // the fresh round also completes
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/me/pages/NightPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the page**

```tsx
// frontend/src/features/me/pages/NightPage.tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { NightBreathing } from '@/features/me/components/NightBreathing'
import { NightBodyScan } from '@/features/me/components/NightBodyScan'
import { NightWalk } from '@/features/me/components/NightWalk'
import {
  WATCHDOG_TICK_MS, watchdogDone, type NightPhase, type NightTool,
} from '@/features/me/logic/nightFlow'
import { recordNightWake } from '@/features/me/logic/nightTrace'

/**
 * Full-screen night surface (/me/sleep/night, spec D4/D5): forced extra-dark regardless
 * of theme, no clock or countdown anywhere. The unified 20-minute rule: "Ébren vagyok"
 * starts a silent timestamp-based watchdog; the calm tools run inside the waiting frame;
 * at ~20 minutes the screen gently flips to the get-out-of-bed prompt.
 */
export function NightPage() {
  const [phase, setPhase] = useState<NightPhase>('idle')
  const [tool, setTool] = useState<NightTool>(null)
  const startedAt = useRef(0)

  const startWaiting = () => {
    startedAt.current = Date.now()
    setTool(null)
    setPhase('waiting')
  }

  useEffect(() => {
    if (phase !== 'waiting') return
    const id = setInterval(() => {
      if (watchdogDone(startedAt.current, Date.now())) {
        setTool(null)
        setPhase('getup')
      }
    }, WATCHDOG_TICK_MS)
    return () => clearInterval(id)
  }, [phase])

  return (
    <div className="night">
      <Link to="/me/sleep" className="night-back">← vissza</Link>

      {phase === 'idle' && (
        <div className="night-body">
          <div className="night-eye">Éjszakai mód</div>
          <div className="night-moon" aria-hidden="true">🌙</div>
          <h1 className="night-title">Felébredtél?</h1>
          <p className="night-tx">
            Ne nézd meg az órát — nem számít, mennyi az idő.
            <br /><br />
            Ha úgy érzed, már jó ideje ébren fekszel, szólj — innentől én figyelem az időt helyetted.
          </p>
          <button className="night-cta" onClick={() => { recordNightWake(); startWaiting() }}>
            Ébren vagyok
          </button>
        </div>
      )}

      {phase === 'waiting' && tool === null && (
        <div className="night-body">
          <div className="night-eye">Én figyelem az időt</div>
          <div className="night-orb" aria-hidden="true" />
          <p className="night-tx">Maradj az ágyban, lazíts.<br />Ha segít, válassz egyet:</p>
          <div className="night-tools">
            <button className="night-tool" onClick={() => setTool('breathing')}>
              <span aria-hidden="true">🫁</span>
              <span className="night-tool-tx"><b>Légzés</b><i>be 5 · tartsd 6 · ki 7 — vezetett ütem</i></span>
              <span aria-hidden="true">›</span>
            </button>
            <button className="night-tool" onClick={() => setTool('bodyscan')}>
              <span aria-hidden="true">🧘</span>
              <span className="night-tool-tx"><b>Testpásztázás</b><i>fejtől lábujjig, lassú vezetéssel</i></span>
              <span aria-hidden="true">›</span>
            </button>
            <button className="night-tool" onClick={() => setTool('walk')}>
              <span aria-hidden="true">🚶</span>
              <span className="night-tool-tx"><b>4K-séta</b><i>járj végig fejben egy jól ismert utat</i></span>
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <Link to="/me/sleep" className="night-quiet">elalszom · kilépek</Link>
        </div>
      )}

      {phase === 'waiting' && tool === 'breathing' && <NightBreathing onStop={() => setTool(null)} />}
      {phase === 'waiting' && tool === 'bodyscan' && <NightBodyScan onStop={() => setTool(null)} />}
      {phase === 'waiting' && tool === 'walk' && <NightWalk onStop={() => setTool(null)} />}

      {phase === 'getup' && (
        <div className="night-body">
          <div className="night-eye">Ideje felkelni</div>
          <div className="night-glow" aria-hidden="true">🕯️</div>
          <h1 className="night-title night-title-sm">Kelj fel — ez most a jobb út</h1>
          <ul className="night-steps">
            <li><b>Menj át</b> egy másik, félhomályos helyre.</li>
            <li><b>Csinálj valami csendeset</b> — olvass papírról, hallgass halk podcastot.</li>
            <li><b>Csak akkor gyere vissza,</b> ha tényleg álmos vagy. Az ágy az alvásé.</li>
          </ul>
          <button className="night-cta" onClick={startWaiting}>Visszafeküdtem</button>
          <Link to="/me/sleep" className="night-quiet">elalszom · kilépek</Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire the route and the tab-bar hide**

`frontend/src/app/router.tsx` — add to the me-page import block:

```tsx
import { NightPage } from '@/features/me/pages/NightPage'
```

and add the sibling route right after `{ path: 'me/goals/new', element: <GoalPlannerPage /> }`:

```tsx
      { path: 'me/goals/new', element: <GoalPlannerPage /> },
      // Full-screen night surface (train/session idiom) — no Me sub-nav chrome.
      { path: 'me/sleep/night', element: <NightPage /> },
```

`frontend/src/app/AppLayout.tsx` — replace line 17:

```tsx
  const hideTabBar = location.pathname === '/train/session'
```

with:

```tsx
  // Full-screen surfaces where the tab bar is dead chrome: the active workout session
  // and the extra-dark night page (its light would defeat the <30 lux point).
  const hideTabBar = ['/train/session', '/me/sleep/night'].includes(location.pathname)
```

- [ ] **Step 5: Append the `.night*` page CSS to `frontend/src/styles/prototype.css`**

```css
/* ===== NightPage — full-screen, forced extra-dark, no clock (mezo-d71m, spec D4/D5) ===== */
.night { display: flex; flex-direction: column; min-height: 100%; padding: 26px 20px 24px;
         background: #0E0B09; }
.night-back { font: 600 11px/1 var(--ff-body); color: #6E6156; text-decoration: none; margin-bottom: 20px; }
.night-body { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.night-eye { font: 700 10px/1 var(--ff-body); letter-spacing: .14em; color: #6E6156;
             text-transform: uppercase; text-align: center; margin-bottom: 10px; }
.night-moon { text-align: center; font-size: 34px; margin: 26px 0 18px;
              filter: drop-shadow(0 0 14px rgba(185,172,217,.35)); }
.night-glow { text-align: center; font-size: 30px; margin: 24px 0 16px;
              filter: drop-shadow(0 0 12px rgba(255,190,96,.28)); }
.night-title { font: 600 26px/1.25 var(--ff-display); color: #F5EFE6; text-align: center; margin-bottom: 14px; }
.night-title-sm { font-size: 23px; }
.night-tx { font: 500 13.5px/1.75 var(--ff-body); color: #B7A899; text-align: center; margin: 0 8px 26px; }
.night-cta { display: block; width: 100%; padding: 18px; border-radius: 999px; text-align: center;
             background: rgba(185,172,217,.14); border: 1px solid rgba(185,172,217,.32);
             font: 700 16px/1 var(--ff-body); color: #B9ACD9; margin-top: auto; }
.night-quiet { display: block; width: 100%; text-align: center; font: 600 12px/1 var(--ff-body);
               color: #6E6156; margin-top: 16px; background: none; border: none; text-decoration: none; }
.night-orb { width: 118px; height: 118px; border-radius: 50%; margin: 22px auto 20px;
             background: radial-gradient(circle at 50% 42%, rgba(185,172,217,.30), rgba(185,172,217,.05) 68%);
             box-shadow: 0 0 42px rgba(185,172,217,.16); animation: nb-breath 18s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .night-orb { animation: none; } }
.night-tools { display: flex; flex-direction: column; gap: 12px; margin-top: 6px; }
.night-tool { display: flex; align-items: center; gap: 14px; padding: 16px; text-align: left;
              background: #1A1613; border-radius: 18px; border: 1px solid rgba(245,239,230,.05); }
.night-tool-tx { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.night-tool-tx b { font: 600 14px/1.2 var(--ff-body); color: #F5EFE6; }
.night-tool-tx i { font: 500 10.5px/1.5 var(--ff-body); color: #6E6156; font-style: normal; }
.night-steps { list-style: none; display: flex; flex-direction: column; gap: 14px; margin: 4px 6px 24px; padding: 0; }
.night-steps li { position: relative; padding-left: 18px; font: 500 13px/1.65 var(--ff-body); color: #B7A899; }
.night-steps li::before { content: ''; position: absolute; left: 0; top: 7px; width: 6px; height: 6px;
                          border-radius: 50%; background: rgba(255,190,96,.75); }
.night-steps b { color: #F5EFE6; font-weight: 600; }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run src/features/me/pages/NightPage.test.tsx`
Expected: PASS. Also run `pnpm vitest run src/app` — the router/AppLayout tests must stay green.

- [ ] **Step 7: Commit**

```bash
git add src/features/me/pages/NightPage.tsx src/features/me/pages/NightPage.test.tsx src/app/router.tsx src/app/AppLayout.tsx src/styles/prototype.css
git -c core.hooksPath=/dev/null commit -m "feat(me): NightPage - full-screen night surface with the unified 20-minute flow (mezo-d71m)"
```

---

### Task 6: Circadian auto-theme (default)

**Files:**
- Modify: `frontend/src/shared/lib/theme.ts` (add `ThemeMode`, mode storage; keep `Theme`/`applyTheme` as-is)
- Modify: `frontend/src/shared/lib/theme.test.ts` (extend)
- Modify: `frontend/src/app/ThemeProvider.tsx` (mode + resolved theme; DROP `toggle`)
- Modify: `frontend/src/app/ThemeProvider.test.tsx` (rewrite for the mode API)
- Create: `frontend/src/app/CircadianTheme.tsx`
- Test: `frontend/src/app/CircadianTheme.test.tsx`
- Modify: `frontend/src/app/AppLayout.tsx` (mount `<CircadianTheme />`)
- Modify: `frontend/src/features/me/sheets/SettingsSheet.tsx` (3-option selector)
- Modify: `frontend/src/features/me/sheets/SettingsSheet.test.tsx` (rewrite the theme interaction test)

**Interfaces:**
- Consumes: Task 1 `isDarkWindow(now, goal)`; existing `useSleepGoal()`.
- Produces: `useTheme(): { theme: Theme; mode: ThemeMode; setMode(m: ThemeMode): void; setAutoTheme(t: Theme): void }` — `toggle` is REMOVED (its only consumer was SettingsSheet, updated here). `theme.ts` exports `type ThemeMode = 'light' | 'dark' | 'auto'`, `DEFAULT_MODE: ThemeMode = 'auto'`, `readStoredMode(): ThemeMode | null`, `writeStoredMode(m: ThemeMode): void` (same `mezo-theme` key — legacy stored 'light'/'dark' remain valid manual modes).

- [ ] **Step 1: Extend `theme.ts` + its test**

Append to `frontend/src/shared/lib/theme.ts` (keep everything existing):

```ts
/** Circadian mode (spec D9): 'auto' resolves dark inside [bed-90, wake-30) — the same
 *  windows the WindDownBanner uses (features/today/logic/windDown.ts). Default: auto. */
export type ThemeMode = Theme | 'auto'
export const DEFAULT_MODE: ThemeMode = 'auto'

export function readStoredMode(): ThemeMode | null {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return t === 'light' || t === 'dark' || t === 'auto' ? t : null
  } catch {
    return null
  }
}
export function writeStoredMode(mode: ThemeMode): void {
  try { localStorage.setItem(THEME_KEY, mode) } catch { /* ignore */ }
}
```

Add to `frontend/src/shared/lib/theme.test.ts`:

```ts
import { DEFAULT_MODE, readStoredMode, writeStoredMode, THEME_KEY } from '@/shared/lib/theme'

describe('theme mode storage (mezo-d71m)', () => {
  beforeEach(() => localStorage.clear())

  test('default mode is auto', () => {
    expect(DEFAULT_MODE).toBe('auto')
  })
  test('round-trips all three modes, legacy values stay valid', () => {
    for (const m of ['light', 'dark', 'auto'] as const) {
      writeStoredMode(m)
      expect(readStoredMode()).toBe(m)
    }
    localStorage.setItem(THEME_KEY, 'garbage')
    expect(readStoredMode()).toBeNull()
  })
})
```

(Import `describe/test/expect/beforeEach` the same way the file already does; export `THEME_KEY` from `theme.ts` if it isn't exported — it is.)

- [ ] **Step 2: Rework `ThemeProvider.tsx`**

Replace the file body with:

```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  applyTheme, DEFAULT_MODE, readStoredMode, writeStoredMode, type Theme, type ThemeMode,
} from '@/shared/lib/theme'

interface ThemeContextValue {
  theme: Theme
  mode: ThemeMode
  setMode: (m: ThemeMode) => void
  /** Fed by CircadianTheme while mode === 'auto'; ignored otherwise. */
  setAutoTheme: (t: Theme) => void
}
const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode() ?? DEFAULT_MODE)
  // Light until the circadian resolver reports in — matches the CSS base theme (no attribute).
  const [autoTheme, setAutoTheme] = useState<Theme>('light')
  const theme: Theme = mode === 'auto' ? autoTheme : mode

  useEffect(() => { writeStoredMode(mode) }, [mode])
  useEffect(() => { applyTheme(theme) }, [theme])

  const setMode = useCallback((m: ThemeMode) => setModeState(m), [])
  const setAuto = useCallback((t: Theme) => setAutoTheme(t), [])

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, setAutoTheme: setAuto }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
```

Rewrite `frontend/src/app/ThemeProvider.test.tsx` with this content (replace the old toggle-based tests):

```tsx
// frontend/src/app/ThemeProvider.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { ThemeProvider, useTheme } from '@/app/ThemeProvider'

function Probe() {
  const { theme, mode, setMode, setAutoTheme } = useTheme()
  return (
    <div>
      <span data-testid="state">{mode}/{theme}</span>
      <button onClick={() => setMode('dark')}>mode-dark</button>
      <button onClick={() => setMode('light')}>mode-light</button>
      <button onClick={() => setMode('auto')}>mode-auto</button>
      <button onClick={() => setAutoTheme('dark')}>auto-dark</button>
    </div>
  )
}
const renderProbe = () => render(<ThemeProvider><Probe /></ThemeProvider>)

describe('ThemeProvider (mode API, mezo-d71m)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => document.documentElement.removeAttribute('data-theme'))

  test('defaults to auto mode with light applied', () => {
    renderProbe()
    expect(screen.getByTestId('state')).toHaveTextContent('auto/light')
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })

  test('setMode(dark) applies + persists the manual mode', () => {
    renderProbe()
    fireEvent.click(screen.getByText('mode-dark'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('mezo-theme')).toBe('dark')
  })

  test('legacy stored light boots as manual light', () => {
    localStorage.setItem('mezo-theme', 'light')
    renderProbe()
    expect(screen.getByTestId('state')).toHaveTextContent('light/light')
  })

  test('setAutoTheme drives the applied theme only in auto mode', () => {
    renderProbe()
    fireEvent.click(screen.getByText('auto-dark'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    fireEvent.click(screen.getByText('mode-light'))
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
    fireEvent.click(screen.getByText('auto-dark')) // ignored while manual
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })
})
```

- [ ] **Step 3: Write `CircadianTheme.tsx` + its test**

```tsx
// frontend/src/app/CircadianTheme.tsx
import { useEffect, useState } from 'react'
import { useSleepGoal } from '@/data/hooks'
import { useTheme } from '@/app/ThemeProvider'
import { isDarkWindow } from '@/features/today/logic/windDown'

const TICK_MS = 60_000

/**
 * The circadian resolver (spec D9): while mode === 'auto', dark inside [bed-90, wake-30),
 * light otherwise — the exact WindDownBanner windows (one clock source, windDown.ts).
 * Renders nothing; mounted once in AppLayout under the data providers.
 */
export function CircadianTheme() {
  const { mode, setAutoTheme } = useTheme()
  const { goal } = useSleepGoal()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (mode !== 'auto') return
    setAutoTheme(isDarkWindow(now, goal) ? 'dark' : 'light')
  }, [mode, now, goal, setAutoTheme])

  return null
}
```

```tsx
// frontend/src/app/CircadianTheme.test.tsx
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CircadianTheme } from '@/app/CircadianTheme'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Mock goal bed 23:15 / wake 06:45 -> dark window 21:45-06:15.
const renderIt = () =>
  render(
    <QueryWrapper>
      <ThemeProvider>
        <CircadianTheme />
      </ThemeProvider>
    </QueryWrapper>,
  )

describe('CircadianTheme', () => {
  beforeEach(() => {
    localStorage.clear() // default mode: auto
    vi.stubEnv('VITE_USE_MOCK', 'true')
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  test('applies dark inside the evening window', () => {
    vi.setSystemTime(new Date('2026-07-24T22:30:00'))
    renderIt()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
  test('applies light during the day', () => {
    vi.setSystemTime(new Date('2026-07-24T11:00:00'))
    renderIt()
    expect(document.documentElement.getAttribute('data-theme')).toBeNull()
  })
  test('manual mode wins: stored dark stays dark at noon', () => {
    localStorage.setItem('mezo-theme', 'dark')
    vi.setSystemTime(new Date('2026-07-24T11:00:00'))
    renderIt()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
```

Mount it in `frontend/src/app/AppLayout.tsx` — first child inside `<LiveActivityProvider>`:

```tsx
    <LiveActivityProvider>
      <CircadianTheme />
      <PhoneFrame anchor={anchor}>
```

with the import `import { CircadianTheme } from '@/app/CircadianTheme'`.

- [ ] **Step 4: Rework the SettingsSheet theme card into the 3-option selector**

In `frontend/src/features/me/sheets/SettingsSheet.tsx`, replace `const { theme, toggle } = useTheme()` and the whole `Téma` card with:

```tsx
  const { mode, setMode } = useTheme()
  const OPTIONS: { key: ThemeMode; icon: 'sun' | 'moon' | 'sparkle'; label: string; desc: string }[] = [
    { key: 'light', icon: 'sun', label: 'Világos', desc: 'Mindig nappali felület' },
    { key: 'dark', icon: 'moon', label: 'Sötét', desc: 'Mindig sötét felület' },
    { key: 'auto', icon: 'sparkle', label: 'Cirkadián', desc: 'Este a tompítással (lefekvés −90 p) sötétre vált, ébredés előtt 30 perccel vissza világosra. Az alváscélodat követi.' },
  ]
```

and render inside the `Téma` section:

```tsx
          <div className="col gap-sm">
            <span style={SECTION_LABEL}>Téma</span>
            <div className="col gap-sm">
              {OPTIONS.map((o) => (
                <button key={o.key} className="card row" aria-pressed={mode === o.key}
                  onClick={() => setMode(o.key)}
                  style={{
                    justifyContent: 'space-between', padding: 14, gap: 12, textAlign: 'left',
                    borderColor: mode === o.key ? 'var(--lav-deep)' : 'var(--border-subtle)',
                    background: mode === o.key ? 'var(--wash-lav)' : undefined,
                  }}>
                  <div className="row gap-md" style={{ alignItems: 'flex-start' }}>
                    <span style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, background: mode === o.key ? 'var(--wash-lav)' : 'var(--surface-2)' }}>
                      <Icon name={o.icon} size={16} color={mode === o.key ? 'var(--lav-deep)' : 'var(--text-tertiary)'} />
                    </span>
                    <div className="col">
                      <span>{o.label}</span>
                      <span style={SECTION_LABEL}>{o.desc}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
```

Add `import type { ThemeMode } from '@/shared/lib/theme'`; remove the now-unused `Toggle` import. In `SettingsSheet.test.tsx`, replace the toggle-interaction test(s) with (keep the file's existing render wiring, but ensure the sheet is wrapped in `ThemeProvider`):

```tsx
  test('renders the three theme options', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: /Világos/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sötét/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cirkadián/ })).toBeInTheDocument()
  })

  test('Sötét applies dark and persists the manual mode', () => {
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: /Sötét/ }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('mezo-theme')).toBe('dark')
  })

  test('Cirkadián persists auto mode and marks the option selected', () => {
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: /Cirkadián/ }))
    expect(localStorage.getItem('mezo-theme')).toBe('auto')
    expect(screen.getByRole('button', { name: /Cirkadián/ })).toHaveAttribute('aria-pressed', 'true')
  })
```

(Also add `beforeEach(() => localStorage.clear())` + an `afterEach` removing `data-theme` from `document.documentElement`, mirroring the ThemeProvider test.)

- [ ] **Step 5: Run the affected tests**

Run: `pnpm vitest run src/shared/lib/theme.test.ts src/app/ThemeProvider.test.tsx src/app/CircadianTheme.test.tsx src/features/me/sheets/SettingsSheet.test.tsx`
Expected: PASS. Then `pnpm exec tsc -b` (a dropped `toggle` consumer would surface here).
Expected: clean compile — the only `toggle` consumer was SettingsSheet.

- [ ] **Step 6: Commit**

```bash
git add src/shared/lib/theme.ts src/shared/lib/theme.test.ts src/app/ThemeProvider.tsx src/app/ThemeProvider.test.tsx src/app/CircadianTheme.tsx src/app/CircadianTheme.test.tsx src/app/AppLayout.tsx src/features/me/sheets/SettingsSheet.tsx src/features/me/sheets/SettingsSheet.test.tsx
git -c core.hooksPath=/dev/null commit -m "feat(app): circadian auto-theme - dark [bed-90, wake-30), default mode auto (mezo-d71m)"
```

---

### Task 7: SleepPage night entry + SleepLogSheet morning prefill

**Files:**
- Modify: `frontend/src/features/me/pages/SleepPage.tsx` (entry row after the goal-card `</section>`, line 88)
- Modify: `frontend/src/features/me/sheets/SleepLogSheet.tsx` (awakenings prefill + hint + clear-on-save)
- Test: extend `frontend/src/features/me/sheets/SleepLogSheet.test.tsx` (exists — add a describe block) and `frontend/src/features/me/pages/SleepPage.test.tsx` (exists — add the entry-row test)

**Interfaces:**
- Consumes: Task 4 `readNightWake(date)`, `clearNightWake(date)`; `localDateString()`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing tests**

Add to `SleepPage.test.tsx` (inside the existing describe, mock-mode setup already present):

```tsx
  test('renders the night-mode entry row linking to /me/sleep/night', () => {
    renderPage() // the file's existing helper
    const link = screen.getByRole('link', { name: /Éjszakai mód/ })
    expect(link).toHaveAttribute('href', '/me/sleep/night')
  })
```

Add to `SleepLogSheet.test.tsx` (use the file's existing render helper + mock-mode setup):

```tsx
describe('night-trace prefill (mezo-d71m)', () => {
  const today = new Intl.DateTimeFormat('en-CA').format(new Date())
  const KEY = `mezo-night-wake:${today}`

  beforeEach(() => localStorage.clear())

  test('prefills awakenings from the trace and shows the hint', () => {
    localStorage.setItem(KEY, JSON.stringify({ count: 2, lastAt: 'x' }))
    renderSheet()
    expect(screen.getByText(/Az éjjel 2× jártál az éjszakai módban/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('clamps the prefill at 4', () => {
    localStorage.setItem(KEY, JSON.stringify({ count: 7, lastAt: 'x' }))
    renderSheet()
    expect(screen.getByRole('button', { name: '4+' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('no trace: default awakenings, no hint', () => {
    renderSheet()
    expect(screen.queryByText(/éjszakai módban/)).toBeNull()
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('saving clears the trace', () => {
    localStorage.setItem(KEY, JSON.stringify({ count: 1, lastAt: 'x' }))
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
```

Note: the awakenings buttons currently have NO `aria-pressed` — Step 3 adds it (an a11y gap worth closing while touching the row).

- [ ] **Step 2: Run to verify the new tests fail**

Run: `pnpm vitest run src/features/me/sheets/SleepLogSheet.test.tsx src/features/me/pages/SleepPage.test.tsx`
Expected: the new tests FAIL (hint absent, aria-pressed absent, link absent); pre-existing tests still pass.

- [ ] **Step 3: Implement**

`SleepPage.tsx` — add the import:

```tsx
import { Link } from 'react-router-dom'
```

Insert directly after the goal-card `</section>` (line 88), before the rings row:

```tsx
        {/* Night-mode entry — always visible (spec D3); the Today banner is the timed twin. */}
        <Link to="/me/sleep/night" className="wdb-night" style={{ margin: '8px 0 0' }}>
          <span className="wdb-night-moon" aria-hidden="true">🌙</span>
          <span className="wdb-night-tx">
            <span className="wdb-night-t1">Éjszakai mód</span>
            <span className="wdb-night-t2">Eszközök éjszakai ébredéshez — 20 perces szabály, légzés, 4K-séta.</span>
          </span>
          <span className="wdb-night-chev" aria-hidden="true">›</span>
        </Link>
```

`SleepLogSheet.tsx` — add imports:

```tsx
import { clearNightWake, readNightWake } from '@/features/me/logic/nightTrace'
import { localDateString } from '@/shared/lib/dates'
```

Replace the awakenings init (line 45):

```tsx
  const [awakenings, setAwakenings] = useState(1)
```

with:

```tsx
  // Soft night-trace prefill (spec D7): read once on mount; manual edits simply override.
  const [nightTrace] = useState(() => readNightWake(localDateString()))
  const [awakenings, setAwakenings] = useState(nightTrace ? Math.min(nightTrace.count, 4) : 1)
```

In `save(...)` and `saveShot(...)`, add as the first line after `onSave({...})`:

```tsx
    clearNightWake(localDateString())
```

In the awakenings button row (line 207), add `aria-pressed`:

```tsx
                      <button key={n} onClick={() => setAwakenings(val)} className="flex-1 chip"
                        aria-pressed={awakenings === val}
```

After the awakenings button row's closing `</div>` (line 215), add the hint:

```tsx
                {nightTrace && (
                  <div className="row gap-sm" style={{ alignItems: 'flex-start', background: 'var(--wash-lav)', borderRadius: 14, padding: '11px 13px' }}>
                    <span aria-hidden="true" style={{ fontSize: 13 }}>🌙</span>
                    <span style={{ fontSize: 11.5, lineHeight: 1.55, color: 'var(--lav-deep)', flex: 1 }}>
                      Az éjjel {nightTrace.count}× jártál az éjszakai módban — előtöltöttem. Írd felül, ha máshogy emlékszel.
                    </span>
                  </div>
                )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/me/sheets/SleepLogSheet.test.tsx src/features/me/pages/SleepPage.test.tsx`
Expected: PASS (new + pre-existing). Also `VITE_USE_MOCK=true pnpm vitest run src/features/me` for the mock-mode sweep of the touched domain.

- [ ] **Step 5: Commit**

```bash
git add src/features/me/pages/SleepPage.tsx src/features/me/sheets/SleepLogSheet.tsx src/features/me/sheets/SleepLogSheet.test.tsx src/features/me/pages/SleepPage.test.tsx
git -c core.hooksPath=/dev/null commit -m "feat(me): SleepPage night entry + SleepLogSheet night-trace prefill (mezo-d71m)"
```

---

### Task 8: Living docs + full gate

**Files:**
- Modify: `docs/features/me.md` (§2 Alvás: NightPage + entry row + SleepLogSheet prefill; Settings theme selector in the Profil §; §10 key files)
- Modify: `docs/features/today.md` (§2/§10: WindDownBanner + its phase logic)
- Modify: `docs/features/habit.md` (§5 integrations + §9: the banner as the wind_down habit's second surface)
- Modify: `docs/features/_platform-design-system.md` (the `.wdb*`/`.night*` CSS families; the theme `auto` mode)
- Modify: `docs/superpowers/specs/2026-07-23-sleep-routine-cluster-notes.md` (§0: C-éj implemented on `feat/sleep-night`)
- Run: `node scripts/lint-docs.mjs` (repo root) — clears staleness flags
- Full gate (in `frontend/`): `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`

**Interfaces:** none — documentation + verification only.

- [ ] **Step 1: Update the five docs**

Content requirements (edit the named sections in place, `file:line` pointers over pasted code, overwrite-in-place policy):
- `me.md` §2 `Alvás`: add the always-visible „Éjszakai mód" entry row under the goal card; a new paragraph describing `NightPage` (`/me/sleep/night`, sibling full-screen route, `hideTabBar`, idle→waiting→getup, `NIGHT_WATCHDOG_MIN = 20`, the 3 tools, no-clock rule) and the `SleepLogSheet` night-trace prefill (`nightTrace.ts` key `mezo-night-wake:<date>`, 18:00 date rule, clear-on-save). §2 `Profil`/SettingsSheet: the 3-option theme selector (Világos/Sötét/Cirkadián, default `auto`). §10: the new files.
- `today.md`: `WindDownBanner` in the §2 surface list (mounted under `IntentionBanner`, `TodayPage.tsx`), phases from `logic/windDown.ts` (`[bed−90, bed−60) / [bed−60, bed) / [bed, wake−30)`), the wind_down check sharing `['habitDay', date]`, and the night-entry third phase; §10 file map.
- `habit.md` §5 (`→ Today / Growth surfaces`): note the `WindDownBanner` as the wind_down habit's second check surface (same cache, level-up surfaced); §9 gotcha: after midnight the banner checks the NEW day's row — RoutineCard-consistent.
- `_platform-design-system.md`: register the `.wdb*` family (Today evening band) and the `.night*`/`.nb-*`/`.ns-*`/`.nw-*` literal-dark families + the `ThemeMode`/`auto` addition (CircadianTheme, `applyTheme` unchanged).
- Cluster-notes §0: flip the C-éj line from "spec approved" to "implemented on `feat/sleep-night` (PR pending)".

- [ ] **Step 2: Lint the docs**

Run (repo root): `node scripts/lint-docs.mjs`
Expected: no errors for the touched docs (pre-existing `me.md` staleness noted in `mezo-t80p` may persist — do not chase unrelated flags).

- [ ] **Step 3: Full FE gate**

Run (in `frontend/`): `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build clean, BOTH test modes fully green.

- [ ] **Step 4: Commit**

```bash
git add docs/features/me.md docs/features/today.md docs/features/habit.md docs/features/_platform-design-system.md docs/superpowers/specs/2026-07-23-sleep-routine-cluster-notes.md
git -c core.hooksPath=/dev/null commit -m "docs(sleep): living docs for slice C-ej - banner, NightPage, circadian theme (mezo-d71m)"
```

---

## After the tasks (session-level, not per-task)

1. Whole-branch review (subagent-driven-development final review pass).
2. Runtime-verify on the mock FE via the `verify` skill / chrome-devtools (drive: evening banner phases via temporary clock override, NightPage flow, theme switch, morning prefill).
3. `git push -u origin feat/sleep-night` → self-PR → CI green → `gh pr merge --merge` (worktree landing memory) → bd close `mezo-d71m` + notes + `bd dolt push` (from `~/MrKuhne/mezo`).

# Rest Timer Inline CTA-morph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the header-overlapping rest Live-Activity island with an in-card countdown bar that morphs out of the `Szett kész ✓` CTA (pause/resume + skip), and delete the redundant `Bemelegítő · B{n}` / `Working · {k}/{n}` chip under the set dots.

**Architecture:** A page-local `useRestTimer` hook (`features/train/logic/`) replaces the app-shell `LiveActivityProvider`; a presentational `RestTimerBar` (`features/train/components/`) renders in the excard's CTA slot while a rest is active. `DynamicIsland` + `LiveActivityProvider` are deleted; `PhoneFrame` gets back its inert notch div. Spec: `docs/superpowers/specs/2026-07-24-rest-timer-inline-cta-design.md`.

**Tech Stack:** React 19 + Vite + Tailwind v4 tokens in `prototype.css`, Vitest + Testing Library (fake timers for the hook), pnpm.

## Global Constraints

- Branch `feat/rest-timer-inline`, driving bd issue **`mezo-xt65`** in every commit subject: `feat(train): … (mezo-xt65)`.
- House conventions (`docs/references/frontend_conventions.md`): deep absolute `@/*` imports only, no barrels, colocated tests, hook in `logic/`, presentational component in `components/`, CSS colors via `var(--token)` only.
- UI copy Hungarian (`Pihenő`, `Szünetel`, `Pihenő kihagyása`…); code/comments/commits English.
- Gate for every task: the named focused tests; final gate `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (both modes green).
- Rest durations stay `restSecondsFor(type)` — 150s compound / 90s other. No ±15s, no sounds, no "Következő" label on the bar.
- The visual-regression suite (`frontend/tests/visual/`) covers `/train` + `/train/gym` only, NOT `/train/session` — no baseline regeneration needed.

---

### Task 1: `useRestTimer` hook

**Files:**
- Create: `frontend/src/features/train/logic/useRestTimer.ts`
- Test: `frontend/src/features/train/logic/useRestTimer.test.ts`

**Interfaces:**
- Consumes: nothing (self-contained; `Date.now()` + 500ms interval like the old `DynamicIsland`).
- Produces: `useRestTimer(): RestTimer` where `RestTimer = { status: 'idle'|'running'|'paused', remaining: number, total: number, start(seconds: number): void, pause(): void, resume(): void, skip(): void }`. `remaining`/`total` are whole seconds, both `0` when idle. Task 3 relies on these exact names.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/train/logic/useRestTimer.test.ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useRestTimer } from '@/features/train/logic/useRestTimer'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('start -> running with the full duration', () => {
  const { result } = renderHook(() => useRestTimer())
  expect(result.current.status).toBe('idle')
  act(() => result.current.start(90))
  expect(result.current.status).toBe('running')
  expect(result.current.remaining).toBe(90)
  expect(result.current.total).toBe(90)
})

test('the 500ms tick counts remaining down', () => {
  const { result } = renderHook(() => useRestTimer())
  act(() => result.current.start(90))
  act(() => vi.advanceTimersByTime(3000))
  expect(result.current.remaining).toBe(87)
})

test('pause freezes remaining; resume continues from the frozen value', () => {
  const { result } = renderHook(() => useRestTimer())
  act(() => result.current.start(90))
  act(() => vi.advanceTimersByTime(10_000))
  act(() => result.current.pause())
  expect(result.current.status).toBe('paused')
  expect(result.current.remaining).toBe(80)
  act(() => vi.advanceTimersByTime(60_000)) // time passes while paused…
  expect(result.current.remaining).toBe(80) // …remaining is frozen
  act(() => result.current.resume())
  act(() => vi.advanceTimersByTime(5000))
  expect(result.current.status).toBe('running')
  expect(result.current.remaining).toBe(75)
})

test('skip returns to idle immediately', () => {
  const { result } = renderHook(() => useRestTimer())
  act(() => result.current.start(90))
  act(() => result.current.skip())
  expect(result.current.status).toBe('idle')
  expect(result.current.remaining).toBe(0)
  expect(result.current.total).toBe(0)
})

test('natural expiry self-clears to idle', () => {
  const { result } = renderHook(() => useRestTimer())
  act(() => result.current.start(2))
  act(() => vi.advanceTimersByTime(2500))
  expect(result.current.status).toBe('idle')
})

test('pause after the deadline (before the tick lands) ends the rest', () => {
  const { result } = renderHook(() => useRestTimer())
  act(() => result.current.start(1))
  act(() => vi.setSystemTime(Date.now() + 5000)) // clock past endsAt, no tick yet
  act(() => result.current.pause())
  expect(result.current.status).toBe('idle')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/train/logic/useRestTimer.test.ts`
Expected: FAIL — `Cannot find module '@/features/train/logic/useRestTimer'` (or equivalent resolve error).

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/features/train/logic/useRestTimer.ts
import { useCallback, useEffect, useState } from 'react'

/** In-page rest countdown (CTA-morph redesign, mezo-xt65 — replaces the shell
    rest Live-Activity). Self-ticks off endsAt while running (500ms, same cadence
    the island used); pause freezes a whole-second remaining, resume re-anchors
    endsAt from it. State is page-local: it dies with the session screen. */
type RestState =
  | { status: 'idle' }
  | { status: 'running'; endsAt: number; total: number }
  | { status: 'paused'; pausedRemaining: number; total: number }

export type RestTimer = {
  status: RestState['status']
  /** Whole seconds left (0 when idle). */
  remaining: number
  /** Full duration of the current rest in seconds (0 when idle). */
  total: number
  start: (seconds: number) => void
  pause: () => void
  resume: () => void
  skip: () => void
}

export function useRestTimer(): RestTimer {
  const [state, setState] = useState<RestState>({ status: 'idle' })
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (state.status !== 'running') return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [state])
  const remaining =
    state.status === 'running'
      ? Math.max(0, Math.ceil((state.endsAt - now) / 1000))
      : state.status === 'paused'
        ? state.pausedRemaining
        : 0
  // Natural expiry: the tick drives remaining to 0 -> revert to the idle CTA.
  useEffect(() => {
    if (state.status === 'running' && remaining === 0) setState({ status: 'idle' })
  }, [state, remaining])
  const start = useCallback((seconds: number) => {
    const t = Date.now() // single capture: a second Date.now() would round remaining up
    setNow(t)
    setState({ status: 'running', endsAt: t + seconds * 1000, total: seconds })
  }, [])
  const pause = useCallback(() => {
    setState((s) => {
      if (s.status !== 'running') return s
      const left = Math.ceil((s.endsAt - Date.now()) / 1000)
      // Pausing a rest the clock already finished just ends it (never a frozen 0:00).
      return left > 0 ? { status: 'paused', pausedRemaining: left, total: s.total } : { status: 'idle' }
    })
  }, [])
  const resume = useCallback(() => {
    const t = Date.now()
    setNow(t)
    setState((s) =>
      s.status === 'paused' ? { status: 'running', endsAt: t + s.pausedRemaining * 1000, total: s.total } : s,
    )
  }, [])
  const skip = useCallback(() => setState({ status: 'idle' }), [])
  return {
    status: state.status,
    remaining,
    total: state.status === 'idle' ? 0 : state.total,
    start,
    pause,
    resume,
    skip,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/train/logic/useRestTimer.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/logic/useRestTimer.ts frontend/src/features/train/logic/useRestTimer.test.ts
git commit -m "feat(train): useRestTimer page-local rest countdown hook (mezo-xt65)"
```

---

### Task 2: `RestTimerBar` component + CSS

**Files:**
- Create: `frontend/src/features/train/components/RestTimerBar.tsx`
- Test: `frontend/src/features/train/components/RestTimerBar.test.tsx`
- Modify: `frontend/src/styles/prototype.css` — add the `.restbar` block directly AFTER the `.donebtn` rule (currently line 1412)

**Interfaces:**
- Consumes: `fmtMMSS` from `@/features/train/logic/restTimer` (unchanged), `cn` from `@/shared/lib/cn`.
- Produces: `RestTimerBar({ remaining, total, paused, onPause, onResume, onSkip })` — Task 3 renders it with exactly these props.
- **Spec deviation (documented):** the label color is `var(--ink)`, not white — white text would strand on the cream track once the fill drains past the label; ink is readable over both the coral fill and the warm track in both themes. (The approved mockup only showed high-fill states.)

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/train/components/RestTimerBar.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { RestTimerBar } from '@/features/train/components/RestTimerBar'

const noop = () => {}

test('running: shows the Pihenő eyebrow, mm:ss and a proportional fill', () => {
  const { container } = render(
    <RestTimerBar remaining={90} total={150} paused={false} onPause={noop} onResume={noop} onSkip={noop} />,
  )
  expect(screen.getByText('Pihenő')).toBeInTheDocument()
  expect(screen.getByText('1:30')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pihenő szüneteltetése' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pihenő kihagyása' })).toBeInTheDocument()
  expect((container.querySelector('.restbar .fill') as HTMLElement).style.width).toBe('60%')
})

test('paused: shows Szünetel + the resume button instead of pause', () => {
  render(<RestTimerBar remaining={80} total={150} paused onPause={noop} onResume={noop} onSkip={noop} />)
  expect(screen.getByText('Szünetel')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pihenő folytatása' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Pihenő szüneteltetése' })).toBeNull()
})

test('buttons fire their callbacks; the bar body does nothing (accidental-skip guard)', async () => {
  const user = userEvent.setup()
  const onPause = vi.fn()
  const onSkip = vi.fn()
  const { container } = render(
    <RestTimerBar remaining={90} total={150} paused={false} onPause={onPause} onResume={noop} onSkip={onSkip} />,
  )
  await user.click(screen.getByRole('button', { name: 'Pihenő szüneteltetése' }))
  expect(onPause).toHaveBeenCalledOnce()
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  expect(onSkip).toHaveBeenCalledOnce()
  await user.click(container.querySelector('.restbar .lay') as HTMLElement)
  expect(onPause).toHaveBeenCalledOnce() // unchanged — body click is inert
  expect(onSkip).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/train/components/RestTimerBar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// frontend/src/features/train/components/RestTimerBar.tsx
import { cn } from '@/shared/lib/cn'
import { fmtMMSS } from '@/features/train/logic/restTimer'

/** CTA-morph rest countdown (mezo-xt65): swaps in for the excard's .donebtn while
    a rest is active — same pill radius + rendered height, so the morph causes zero
    layout shift. The bar body is deliberately NOT tappable (the old island's
    tap-to-skip was an accidental-skip hazard); only the explicit buttons act. */
export function RestTimerBar({
  remaining,
  total,
  paused,
  onPause,
  onResume,
  onSkip,
}: {
  remaining: number
  total: number
  paused: boolean
  onPause: () => void
  onResume: () => void
  onSkip: () => void
}) {
  const frac = total > 0 ? remaining / total : 0
  return (
    <div className={cn('restbar', paused && 'paused')} role="timer" aria-label={`Pihenő: ${fmtMMSS(remaining)}`}>
      <div className="fill" style={{ width: `${frac * 100}%` }} aria-hidden="true" />
      <div className="lay">
        <span className="t">
          <small>{paused ? 'Szünetel' : 'Pihenő'}</small>
          {fmtMMSS(remaining)}
        </span>
        <span className="btns">
          {paused ? (
            <button type="button" aria-label="Pihenő folytatása" onClick={onResume}>▶</button>
          ) : (
            <button type="button" aria-label="Pihenő szüneteltetése" onClick={onPause}>⏸</button>
          )}
          <button type="button" aria-label="Pihenő kihagyása" onClick={onSkip}>⏭</button>
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add the CSS block**

In `frontend/src/styles/prototype.css`, directly after the `.donebtn` rule (line 1412), insert:

```css
/* ===== In-card rest timer bar (CTA-morph, mezo-xt65) — swaps in for .donebtn while a
   rest runs. Same pill radius + rendered height as .donebtn => zero layout shift on the
   morph. Label is var(--ink): readable over BOTH the coral fill and the exposed warm
   track (a white label would strand on cream once the fill drains past it). ===== */
.restbar { position: relative; margin-top: 16px; border-radius: 999px; overflow: hidden; background: var(--warm); box-shadow: inset 0 1px 3px rgba(43,33,24,.08); }
.restbar .fill { position: absolute; top: 0; bottom: 0; left: 0; background: linear-gradient(135deg, var(--cta-g1), var(--cta-g2)); transition: width .5s linear; }
.restbar.paused .fill { background: var(--faint); transition: none; }
.restbar .lay { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 7px 6px 18px; min-height: 53px; box-sizing: border-box; }
.restbar .t { text-align: left; font-weight: 800; font-size: 16px; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1.1; }
.restbar .t small { display: block; font-size: 8px; letter-spacing: 1px; text-transform: uppercase; opacity: .75; font-weight: 800; }
.restbar .btns { display: flex; gap: 7px; flex: none; }
.restbar .btns button { width: 40px; height: 40px; border-radius: 50%; border: 0; background: var(--surface); color: var(--coral-deep); font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 6px rgba(43,33,24,.18); font-family: inherit; }
@media (prefers-reduced-motion: reduce) { .restbar .fill { transition: none; } }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/train/components/RestTimerBar.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/components/RestTimerBar.tsx frontend/src/features/train/components/RestTimerBar.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(train): RestTimerBar CTA-morph countdown component (mezo-xt65)"
```

---

### Task 3: Wire the bar into `ActiveWorkoutPage` + delete the kind chip

**Files:**
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx`
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx`

**Interfaces:**
- Consumes: `useRestTimer` (Task 1 — `rest.status/remaining/total/start/pause/resume/skip`), `RestTimerBar` (Task 2), `restSecondsFor` (existing, unchanged).
- Produces: the page no longer imports `@/app/providers/LiveActivityProvider` — Task 4's shell deletion depends on this.

- [ ] **Step 1: Rewrite the rest-wiring tests (failing first)**

In `ActiveWorkoutPage.test.tsx`:

1. Delete the imports of `LiveActivityProvider` (line 8) and `DynamicIsland` (line 9); remove both from the `setup()` JSX (lines 27-30 → just `<ActiveWorkoutPage />` inside `LevelUpProvider`) and delete the harness comment (lines 19-21).
2. Replace the `completeExerciseSets` helper (lines 40-45) with a rest-aware version:

```tsx
// Set counts vary per exercise (warmup + working sets), so a fixed loop is fragile.
// Click "Szett kész ✓" until the exercise's debrief CTA appears (always the last set).
// CTA-morph (mezo-xt65): a mid-exercise log swaps the CTA for the rest bar, so skip
// the rest each round to get the button back.
async function completeExerciseSets(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 12; i++) {
    await user.click(screen.getByText('Szett kész ✓'))
    if (screen.queryByText(/Mentés · tovább|Edzés vége →/)) return
    const skip = screen.queryByRole('button', { name: 'Pihenő kihagyása' })
    if (skip) await user.click(skip)
  }
}
```

3. Replace the whole `// ---- rest wiring …` section (lines 118-223) with:

```tsx
// ---- rest wiring: "Szett kész ✓" morphs into the in-card rest bar (mezo-xt65) ----

test('mock mode: logging a mid-exercise set morphs the CTA into the rest bar', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(container.querySelector('.restbar')).toBeNull()
  // ex1 (Chest Supported Row, compound): 2 warmup + 3 working = 5 planned sets.
  // Logging the first (a warmup) leaves 4 sets remaining -> the exercise continues.
  await user.click(screen.getByText('Szett kész ✓'))
  expect(container.querySelector('.restbar')).not.toBeNull()
  expect(screen.getByText('Pihenő')).toBeInTheDocument()
  // The morph: while resting there is no Szett kész CTA.
  expect(screen.queryByText('Szett kész ✓')).toBeNull()
})

test('mock mode: skip restores the Szett kész CTA', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓'))
  await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  expect(container.querySelector('.restbar')).toBeNull()
  expect(screen.getByText('Szett kész ✓')).toBeInTheDocument()
})

test('mock mode: pause freezes the bar into Szünetel; resume brings Pihenő back', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓'))
  await user.click(screen.getByRole('button', { name: 'Pihenő szüneteltetése' }))
  expect(screen.getByText('Szünetel')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Pihenő folytatása' }))
  expect(screen.getByText('Pihenő')).toBeInTheDocument()
})

test('mock mode: logging an exercise\'s final set (opens the feedback modal) starts no rest', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // Drive through ex1's 4 non-final sets, skipping each rest to re-reveal the CTA.
  for (let i = 0; i < 4; i++) {
    await user.click(screen.getByText('Szett kész ✓'))
    await user.click(screen.getByRole('button', { name: 'Pihenő kihagyása' }))
  }
  // The 5th (last) set completes the exercise -> feedback modal opens, no rest.
  await user.click(screen.getByText('Szett kész ✓'))
  expect(await screen.findByText(/Mentés · tovább|Edzés vége →/)).toBeInTheDocument()
  expect(container.querySelector('.restbar')).toBeNull()
})

test('mock mode: the rest bar rides along when navigating to another exercise', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByText('Szett kész ✓')) // rest starts on ex1
  expect(container.querySelector('.restbar')).not.toBeNull()
  // Free navigation: page to ex2 — the rest is the user's, so the bar stays.
  await user.click(screen.getByRole('button', { name: 'Következő: Lat Pulldown · Pronated' }))
  expect(await screen.findByText('Lat Pulldown · Pronated')).toBeInTheDocument()
  expect(container.querySelector('.restbar')).not.toBeNull()
})

test('mock mode: reaching the summary screen (workout end) shows no rest bar', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // Skip ex0 (no rest on skip), then drive the remaining 4 exercises to completion.
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Kihagyás'))
  await screen.findByText('Lat Pulldown · Pronated')
  for (let ex = 0; ex < 4; ex++) {
    await completeExerciseSets(user)
    const cta = await screen.findByText(/Mentés · tovább|Edzés vége →/)
    await user.click(cta)
    if (ex < 3) await waitFor(() => expect(document.querySelector('.setdots .sd.don')).toBeNull())
  }
  expect(await screen.findByText(/Edzés vége ·/)).toBeInTheDocument()
  await waitFor(() => expect(container.querySelector('.restbar')).toBeNull())
})
```

Notes: the old "exit clears a live rest" and "unmount clears a live rest" tests are **deleted** — the bar lives inside the page, so navigation/unmount destroying it is React semantics, not wiring; the old "a new rest replaces an already-live one" test is deleted because the state is unreachable (no CTA while resting). The old mid-loop `.dynamic-island.live` assertion in the summary test is dropped with the island.

4. Add the chip-removal regression test right after the existing `'the current set-dot shows a B-prefixed label on a warmup set'` test (line 235):

```tsx
test('the kind chip under the set-dots is gone — the dots alone carry warmup/working (mezo-xt65)', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await screen.findByRole('button', { name: 'Súly növelése' })
  expect(container.querySelector('.setdots .sd.cur')).toHaveTextContent('B1')
  expect(container.querySelector('.excard .stag')).toBeNull()
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd frontend && pnpm vitest run src/features/train/pages/ActiveWorkoutPage.test.tsx`
Expected: FAIL — `.restbar` never appears (island code still in place), chip test fails on the present `.stag`.

- [ ] **Step 3: Implement the page changes**

In `ActiveWorkoutPage.tsx`:

1. Imports: delete `import { useLiveActivity } from '@/app/providers/LiveActivityProvider'` (line 19); add:

```tsx
import { useRestTimer } from '@/features/train/logic/useRestTimer'
import { RestTimerBar } from '@/features/train/components/RestTimerBar'
```

2. Replace lines 139-145 (`const { startRest, clearRest } = useLiveActivity()` + `onExit`) with:

```tsx
const rest = useRestTimer()
// Exiting the session (Bezárás / back / Mentés — all route through here) drops any
// running rest; the state is page-local so unmount alone would clear it too.
const onExit = () => {
  rest.skip()
  navigate('/train')
}
```

3. Replace the clear-on-phase effects (lines 214-219) with (the separate unmount-cleanup effect is deleted — page-local state dies with the page):

```tsx
// A rest must not survive into the summary/recap phase.
useEffect(() => {
  if (phase === 'complete' || phase === 'summary') rest.skip()
}, [phase, rest.skip])
```

4. In `completeSet`, replace the `startRest({...})` else-branch (lines 388-393) with:

```tsx
} else {
  // In-card rest (mezo-xt65): the CTA slot morphs into the RestTimerBar. No "next"
  // label anywhere — mid-exercise the next set is visible right above the bar.
  rest.start(restSecondsFor(current.type))
}
```

5. In `handleSkip` (line 454), replace `clearRest()` with `rest.skip()` (keep the comment's intent: abandoning the exercise must not leave a rest counting toward it).
6. Delete the current-set kind chip block — the whole `{currentTarget && (...)}` JSX (lines 951-969, from the `{/* Current-set kind tag (mezo-eerq)…` comment through its closing `)}`). Keep `currentTarget`/`isWarmupSet` (lines 248-249) — they still drive the RIR-row visibility and the logged `kind`.
7. Replace the `donebtn` CTA (lines 1013-1015) with the morph:

```tsx
{rest.status === 'idle' ? (
  <button type="button" className="donebtn np-press" onClick={completeSet}>
    Szett kész ✓
  </button>
) : (
  <RestTimerBar
    remaining={rest.remaining}
    total={rest.total}
    paused={rest.status === 'paused'}
    onPause={rest.pause}
    onResume={rest.resume}
    onSkip={rest.skip}
  />
)}
```

- [ ] **Step 4: Run the page tests**

Run: `cd frontend && pnpm vitest run src/features/train/pages/ActiveWorkoutPage.test.tsx`
Expected: PASS (all, including the untouched prep/logging/note/challenge tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/pages/ActiveWorkoutPage.tsx frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx
git commit -m "feat(train): morph Szett kész CTA into in-card rest bar; drop kind chip (mezo-xt65)"
```

---

### Task 4: Delete the island + provider from the app shell

**Files:**
- Delete: `frontend/src/app/DynamicIsland.tsx`, `frontend/src/app/DynamicIsland.test.tsx`, `frontend/src/app/providers/LiveActivityProvider.tsx`
- Modify: `frontend/src/app/PhoneFrame.tsx`, `frontend/src/app/AppLayout.tsx`, `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes: Task 3 already removed the page's `useLiveActivity` import — after this task NO file references the provider or the island component (verify with grep).
- Produces: `PhoneFrame` renders the inert notch as a plain div; the base `.dynamic-island` CSS (mock chrome) stays.

- [ ] **Step 1: Shell edits**

`PhoneFrame.tsx`: delete `import { DynamicIsland } from '@/app/DynamicIsland'` (line 3) and swap line 18 `<DynamicIsland />` → `<div className="dynamic-island" />`.

`AppLayout.tsx`: delete `import { LiveActivityProvider } from '@/app/providers/LiveActivityProvider'` (line 3) and unwrap — lines 19 + 34 (`<LiveActivityProvider>`/`</LiveActivityProvider>`) go away, `PhoneFrame` becomes the top element of the returned JSX.

- [ ] **Step 2: Delete the files**

```bash
git rm frontend/src/app/DynamicIsland.tsx frontend/src/app/DynamicIsland.test.tsx frontend/src/app/providers/LiveActivityProvider.tsx
```

- [ ] **Step 3: Remove the dead CSS**

In `frontend/src/styles/prototype.css` delete:
- the whole `/* ===== Napív rest Live-Activity island … ===== */` block (lines 1346-1354: `button.dynamic-island` + `.dynamic-island.live` + `.ring/.lt1/.lt2/.lnext` rules),
- the `@media (prefers-reduced-motion: no-preference) { .dynamic-island { transition: … } }` block (line 1376-1378 — it only animated the island's live-morph),
- the PWA carve-out `@media … { .dynamic-island.live { display: flex; … } }` block with its comment (lines 1379-1384).

Keep the base `.dynamic-island` rule (line 168) and its `display: none` in the full-bleed block (line 311) — that's the mock device chrome.

- [ ] **Step 4: Verify nothing references the deleted modules**

Run: `grep -rn "LiveActivity\|DynamicIsland\|dynamic-island.live" frontend/src`
Expected: no hits (plain `.dynamic-island` string in `PhoneFrame.tsx`/CSS is fine — the grep pattern above must return nothing).

- [ ] **Step 5: Full frontend gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build green (tsc catches any missed import), both test modes green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/PhoneFrame.tsx frontend/src/app/AppLayout.tsx frontend/src/styles/prototype.css
git commit -m "refactor(app): drop rest Live-Activity island + provider (mezo-xt65)"
```

---

### Task 5: Living docs update

**Files:**
- Modify: `docs/features/train.md`, `docs/features/_platform-design-system.md`

**Interfaces:**
- Consumes: final implementation from Tasks 1-4 (`file:line` pointers must match the merged code).
- Produces: lint-clean docs (`node scripts/lint-docs.mjs`).

- [ ] **Step 1: Rewrite the island paragraphs in `train.md`**

- §Phase-3 list (line 35): "…replaced it with a real rest Live-Activity countdown island (§2/§9)" → "…replaced it with a rest countdown (since `mezo-xt65` an in-card CTA-morph bar, §2)"; keep the hardcoded-duration sentence.
- §2 layout paragraph (line 70): the closing sentence "**`Szett kész ✓` also starts the rest Live-Activity** (the shell's countdown island)…" → "**`Szett kész ✓` also morphs into the in-card rest countdown** whenever the exercise continues — see the Rest timer paragraph below." Also update the excard element list: the "current-set kind tag (`mezo-eerq` — a `.stag` chip…)" entry is **removed** (deleted by `mezo-xt65` — the set dots alone carry warmup/working).
- Replace the whole "Rest Live-Activity (island countdown…)" paragraph (line 74) with a "Rest timer (in-card CTA-morph, `mezo-xt65`)" paragraph: `useRestTimer` (`features/train/logic/useRestTimer.ts`) page-local state `{status: idle|running|paused}`; `completeSet`'s continue-branch calls `rest.start(restSecondsFor(current.type))` (150s/90s unchanged, still hardcoded); `RestTimerBar` (`features/train/components/RestTimerBar.tsx`) swaps in for `.donebtn` (`.restbar`, zero layout shift); ⏸/▶ + ⏭ buttons, bar body inert; label ink-on-both-surfaces rationale; one global rest shown on whichever exercise is viewed; skip/exit/summary clear it; no "next" label (the old dead-code finding is resolved by removal); mid-rest reload loses the rest (in-memory, unchanged).
- §9 seam table (line 219): delete the "Rest Live-Activity shell seam" row (the seam no longer exists — the timer is feature-local).
- §quirks: line 335 (dead `next` label) — delete, resolved by removal; line 336 — keep the skip-clears sentence (now `rest.skip()`), drop the `DynamicIsland` render-reset sentence; line 337 — reword "superseded by the real rest island" → "superseded by the in-card rest bar"; line 338 (always-dark island exemption) — delete.
- §FE seam file list (line 364 block): replace the shell-seam file rows with the two new feature-local files.

- [ ] **Step 2: Update `_platform-design-system.md`**

Find the §2 island note (`grep -n "island" docs/features/_platform-design-system.md`): keep the `.dynamic-island` mock-chrome description, delete the live-rest exception sentences (the "stays visible on real devices" carve-out died with the island).

- [ ] **Step 3: Lint**

Run: `node scripts/lint-docs.mjs`
Expected: 0 errors, no staleness flag for `train.md`.

- [ ] **Step 4: Commit**

```bash
git add docs/features/train.md docs/features/_platform-design-system.md
git commit -m "docs(train): rest timer bar + chip removal feature-doc update (mezo-xt65)"
```

---

### Task 6: Ship — self-PR, CI gate, merge, close

- [ ] **Step 1: Push the branch and open the self-PR**

```bash
git push -u origin feat/rest-timer-inline
gh pr create --title "feat(train): in-card rest timer CTA-morph + kind-chip removal (mezo-xt65)" --body "Spec: docs/superpowers/specs/2026-07-24-rest-timer-inline-cta-design.md. Replaces the header-overlapping rest island with an in-card CTA-morph countdown (pause/resume + skip), deletes DynamicIsland/LiveActivityProvider, removes the redundant warmup/working chip."
```

- [ ] **Step 2: Wait for CI green**

Run: `gh pr checks --watch`
Expected: all checks pass (backend IT suite untouched but runs; FE both modes + lint + contract-drift green).

- [ ] **Step 3: Merge locally with --no-ff and push**

```bash
git checkout main && git pull --rebase
git merge --no-ff feat/rest-timer-inline -m "Merge PR #<n>: in-card rest timer CTA-morph (mezo-xt65)"
git push
git branch -d feat/rest-timer-inline && git push origin --delete feat/rest-timer-inline
```

- [ ] **Step 4: Close the issue and sync beads**

```bash
bd close mezo-xt65
bd dolt push
git status   # MUST show "up to date with origin"
```

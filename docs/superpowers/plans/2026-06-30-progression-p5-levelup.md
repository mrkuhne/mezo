# Progression P5 — FE LevelUpScreen + capture sport/run/gym levelUp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The visual component (Task 4) additionally uses the **frontend-design** skill.

**Goal:** Capture the already-on-the-contract `levelUp` payload from the three workout finish flows (gym finish, run log, sport log) and present a hand-rolled, full-bleed animated **LevelUpScreen** portal overlay — reduced-motion first-class, no-level-up case never dead-ends — plus add the cross/TRX kind selector to the sport log sheet.

**Architecture:** `LevelUpResult` is **already generated** in `api.gen.ts` and attached to all three finish responses (`WorkoutInstanceResponse`, `RunSessionLogResponse`, `SportSessionResponse`), but the frontend has **zero usages** of it today — every flow discards the response (`.then(() => undefined)` / fire-and-forget / mock returns `undefined`). P5 is **pure frontend**: (1) widen the three mutation callbacks to forward the response, (2) render the overlay from a **single global host** (`LevelUpProvider` + `useLevelUp()` mounted once in `AppLayout`) so the 3-to-4 sheet mount parents just call `showLevelUp(r?.levelUp)`, (3) the `LevelUpScreen` **self-portals into `.phone-screen`** (the `Sheet` technique) to cover `TabBar`+`Fab`, (4) mock mutations return a **deterministic seeded `LevelUpResult` fixture**. Gym composes the overlay over the existing `WorkoutComplete` recap (overlay first, recap revealed on `Tovább`).

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4 + `prototype.css` design tokens, TanStack Query, Vitest + Testing Library, hand-rolled CSS `@keyframes` (NO framer-motion), `requestAnimationFrame` count-up.

## Global Constraints

- **Pure FE slice — NO backend, NO contract, NO `api.gen.ts` edits.** `levelUp?: LevelUpResult` is already present on all three finish responses (`api.gen.ts:1227`, `:1391`, `:1472`). Do not touch `api/`, `backend/`, or regenerate types.
- **Backend returns `gain.name = <raw skillKey>` and `gain.icon = null`** (`ProgressionService.java:278`). The FE OWNS the display name + emoji icon for all 12 athletic + 13 muscle skills. Reuse the existing `MUSCLE_LABELS` (`frontend/src/data/train.ts:8-13`) for muscle names; author the 12 athletic names + icons (canonical, from `skill-model-v3.html`).
- **`workoutLabel`** arrives as the HU type name only: `"Klasszik kondi"` | `"Sprint futás"` | `"Futás"` | `"Röplabda"` | `"Cross training"` | `"TRX köredzés"`. `durationMin` + `rpe` are separate optional fields. The mockup's `· PUSH` split-day subtitle is NOT in the payload — do not invent it.
- **`perks[]`** carry real HU `name` + `effectCopy` (from the backend `PerkCatalog`) — render verbatim, no extra prose.
- **Both FE modes must stay green** (`pnpm test` AND `VITE_USE_MOCK=true pnpm test`) plus `pnpm build`. Mock mode is the default (`VITE_USE_MOCK !== 'false'`); CI/dev run REAL by default.
- **`prefers-reduced-motion` is a first-class requirement** (not an afterthought): count-up jumps to the final value, rings/bars render filled, the top-to-bottom stagger collapses. Drive it with a shared `useReducedMotion()` hook (none exists today; the codebase only gates sheets via CSS `@media`).
- **Reuse app design tokens** (`--brand-glow`, `--primary`/teal, `--text-primary|secondary|tertiary`, `--surface-1|2`, `--border-subtle`, `--ff-display`, `--ff-mono`, `--warning`, `--success`) — do NOT hardcode the mockup's raw hex. Add the level-up keyframes to `frontend/src/styles/prototype.css`.
- **Single CTA `Tovább`** — the mockup's second `Megosztom` (share) button is dropped (single-user app, no social scope).
- **No-level-up case (the common one) always shows something** (totalXp count-up + the gains grid); the "Szintlépés" section is simply omitted and the headline adapts. Never a dead-end.
- **House FE conventions:** dual-mode hooks; mock writes for `useTrain` no-op (here: return a fixture), `useRunning` emulate via `setQueryData`; boundary cast idiom (`as X`) and `satisfies` on request bodies; the `dualMode.guard.test` forbids `const { data = SEED }` identifier defaults on reads (mutations unaffected).

---

## File Structure

**New files**
- `frontend/src/lib/useReducedMotion.ts` — shared `matchMedia('(prefers-reduced-motion: reduce)')` hook (reused by the radar in P6).
- `frontend/src/lib/useReducedMotion.test.ts`
- `frontend/src/features/progression/levelUpMeta.ts` — `skillDisplay(skillKey, kind, fallbackName?) → { name, icon }`; `HEADLINE_BY_SOURCE`, `CHIP_ICON_BY_SOURCE`; re-exported `LevelUpResult`/`LevelUpGain`/`LevelUpPerk` types.
- `frontend/src/features/progression/levelUpMeta.test.ts`
- `frontend/src/features/progression/LevelUpScreen.tsx` — the full-bleed self-portaling animated overlay (the main visual).
- `frontend/src/features/progression/LevelUpScreen.test.tsx`
- `frontend/src/features/progression/LevelUpProvider.tsx` — `LevelUpProvider`, `useLevelUp()` (exposes `showLevelUp(result?: LevelUpResult)`), and the host that renders `<LevelUpScreen>` when active.
- `frontend/src/features/progression/LevelUpProvider.test.tsx`
- `frontend/src/data/progressionMock.ts` — deterministic seeded `gymLevelUpMock` / `sportLevelUpMock` / `runLevelUpMock` fixtures.
- `frontend/src/data/progressionMock.test.ts`

**Modified files**
- `frontend/src/lib/trainApi.ts` — re-export `LevelUpResult`/`LevelUpGain`/`LevelUpPerk`/`LevelUpRobustness` (gen aliases).
- `frontend/src/styles/prototype.css` — `.levelup*` styles + `@keyframes` + reduced-motion gate.
- `frontend/src/app/AppLayout.tsx` — wrap the screen in `<LevelUpProvider>` and mount the host.
- `frontend/src/data/trainHooks.ts` — widen `finishWorkout` + `logSportSession` callbacks/mutations to forward the response (+ levelUp); mock branches return the fixture.
- `frontend/src/data/runningHooks.ts` — widen `logRunSession` callback/mutation to forward `RunSessionLogResponse`; mock returns the fixture.
- `frontend/src/features/train/ActiveWorkoutScreen.tsx` — finish `onSuccess` → `showLevelUp(r?.levelUp)` + capture PR; remove the 105 kg demo `hadPR` path.
- `frontend/src/features/train/components/SportLogSheet.tsx` — `onSave?: (input, done) => void` deferred close + saving guard; **cross/TRX kind selector** + `rounds`.
- `frontend/src/features/train/components/RunLogSheet.tsx` — `onSave?: (input, done) => void` deferred close + saving guard.
- `frontend/src/features/train/views/SportView.tsx` — wire the sport mount to the mutation + `showLevelUp`.
- `frontend/src/features/train/views/TrainTodayView.tsx` — wire BOTH the sport and run mounts.
- `frontend/src/features/train/views/RunningView.tsx` — wire the run mount (`RunWeekView` calls `useLevelUp()`).
- Test fixture updates: `ActiveWorkoutScreen.test.tsx`, `SportLogSheet.test.tsx`, `trainHooks.test.tsx`, `runningHooks.test.ts`, `SportView.test.tsx`, `RunningView.test.tsx`, `TrainTodayView.test.tsx`.

**Docs (Task 10)**
- `docs/features/train.md` (§2 active-workout complete-phase + §4 sport sheet + §5 + §10), `docs/features/_platform-api-backend.md` §4e (FE now consumes `levelUp`), `docs/milestones/roadmap.md`.

---

## Task 1: `useReducedMotion` shared hook

**Files:**
- Create: `frontend/src/lib/useReducedMotion.ts`
- Test: `frontend/src/lib/useReducedMotion.test.ts`

**Interfaces:**
- Produces: `export function useReducedMotion(): boolean` — `true` when the user prefers reduced motion; reactive to changes; SSR/test-safe when `matchMedia` is absent (returns `false`).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/lib/useReducedMotion.test.ts
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReducedMotion } from './useReducedMotion'

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

describe('useReducedMotion', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns true when the user prefers reduced motion', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it('returns false when motion is allowed', () => {
    stubMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('returns false when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test src/lib/useReducedMotion.test.ts`
Expected: FAIL — `useReducedMotion` not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/lib/useReducedMotion.ts
import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Shared reduced-motion gate. Drives the LevelUpScreen's count-up / ring / bar
 * animations and the stagger; reused by the P6 radar. Returns false when
 * matchMedia is unavailable (jsdom without a stub / SSR).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof matchMedia === 'function' ? matchMedia(QUERY).matches : false,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mql = matchMedia(QUERY)
    const onChange = () => setReduced(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return reduced
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test src/lib/useReducedMotion.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/useReducedMotion.ts frontend/src/lib/useReducedMotion.test.ts
git commit -m "feat(progression): useReducedMotion shared hook (mezo-te8k)"
```

---

## Task 2: Skill display meta + type re-exports

**Files:**
- Modify: `frontend/src/lib/trainApi.ts` (add the gen type re-exports near the other re-exports)
- Create: `frontend/src/features/progression/levelUpMeta.ts`
- Test: `frontend/src/features/progression/levelUpMeta.test.ts`

**Interfaces:**
- Consumes: `MUSCLE_LABELS` (`frontend/src/data/train.ts:8`), the gen `LevelUpGain` type.
- Produces:
  - `frontend/src/lib/trainApi.ts`: `export type LevelUpResult = components['schemas']['LevelUpResult']`, `LevelUpGain`, `LevelUpPerk`, `LevelUpRobustness`.
  - `levelUpMeta.ts`: `skillDisplay(skillKey: string, kind: 'ATHLETIC' | 'MUSCLE', fallbackName?: string) → { name: string; icon: string }`; `HEADLINE_BY_SOURCE: Record<'GYM'|'SPORT'|'RUN', string>`; `CHIP_ICON_BY_SOURCE: Record<'GYM'|'SPORT'|'RUN', string>`.

- [ ] **Step 1: Add the type re-exports to `trainApi.ts`**

Find where `trainApi.ts` re-exports gen response types (e.g. `export type WorkoutInstanceResponse = components['schemas']['WorkoutInstanceResponse']`) and add alongside:

```ts
export type LevelUpResult = components['schemas']['LevelUpResult']
export type LevelUpGain = components['schemas']['LevelUpGain']
export type LevelUpPerk = components['schemas']['LevelUpPerk']
export type LevelUpRobustness = components['schemas']['LevelUpRobustness']
```

- [ ] **Step 2: Write the failing test**

```ts
// frontend/src/features/progression/levelUpMeta.test.ts
import { describe, expect, it } from 'vitest'
import { skillDisplay, HEADLINE_BY_SOURCE, CHIP_ICON_BY_SOURCE } from './levelUpMeta'

describe('skillDisplay', () => {
  it('maps athletic skill keys to HU name + emoji', () => {
    expect(skillDisplay('max_strength', 'ATHLETIC')).toEqual({ name: 'Maximális erő', icon: '🏋️' })
    expect(skillDisplay('explosiveness', 'ATHLETIC')).toEqual({ name: 'Robbanékonyság', icon: '⚡' })
    expect(skillDisplay('anaerobic_capacity', 'ATHLETIC')).toEqual({ name: 'Anaerob kapacitás', icon: '🔥' })
  })

  it('maps muscle keys via MUSCLE_LABELS with a barbell-arm icon', () => {
    expect(skillDisplay('chest', 'MUSCLE')).toEqual({ name: 'Mell', icon: '💪' })
    expect(skillDisplay('back-mid', 'MUSCLE')).toEqual({ name: 'Hát (közép)', icon: '💪' })
  })

  it('falls back to the backend name then the raw key for unknown skills', () => {
    expect(skillDisplay('unknown_skill', 'ATHLETIC', 'Backend Name')).toEqual({ name: 'Backend Name', icon: '✨' })
    expect(skillDisplay('zzz', 'ATHLETIC')).toEqual({ name: 'zzz', icon: '✨' })
  })

  it('exposes per-source headline + chip-icon maps', () => {
    expect(CHIP_ICON_BY_SOURCE.GYM).toBe('🏋️')
    expect(CHIP_ICON_BY_SOURCE.RUN).toBe('🏃')
    expect(CHIP_ICON_BY_SOURCE.SPORT).toBe('🏐')
    expect(HEADLINE_BY_SOURCE.GYM).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && pnpm test src/features/progression/levelUpMeta.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

```ts
// frontend/src/features/progression/levelUpMeta.ts
import { MUSCLE_LABELS } from '@/data/train'
import type { LevelUpResult } from '@/lib/trainApi'

type Source = LevelUpResult['source'] // 'GYM' | 'SPORT' | 'RUN'

// Canonical 12-athletic name + emoji (from skill-model-v3.html, the chosen model).
const ATHLETIC_META: Record<string, { name: string; icon: string }> = {
  explosiveness: { name: 'Robbanékonyság', icon: '⚡' },
  vertical_jump: { name: 'Vertikális emelkedés', icon: '🦘' },
  sprint_speed: { name: 'Sprint-sebesség', icon: '💨' },
  aerobic_capacity: { name: 'Aerob kapacitás', icon: '🫁' },
  anaerobic_capacity: { name: 'Anaerob kapacitás', icon: '🔥' },
  strength_endurance: { name: 'Erő-állóképesség', icon: '🔁' },
  core_stability: { name: 'Core-stabilitás', icon: '🧱' },
  max_strength: { name: 'Maximális erő', icon: '🏋️' },
  coordination: { name: 'Koordináció', icon: '🤹' },
  mobility: { name: 'Mozgékonyság', icon: '🤸' },
  agility: { name: 'Agility', icon: '🎯' },
  robustness: { name: 'Robusztusság', icon: '🛡️' },
}

const MUSCLE_ICON = '💪'
const FALLBACK_ICON = '✨'

/**
 * Resolve a gain's display name + emoji from its skillKey + kind. The backend
 * sends gain.name = raw skillKey and gain.icon = null, so the FE owns this map.
 * Muscle names reuse the app-wide MUSCLE_LABELS; athletic names are canonical.
 */
export function skillDisplay(
  skillKey: string,
  kind: 'ATHLETIC' | 'MUSCLE',
  fallbackName?: string,
): { name: string; icon: string } {
  if (kind === 'MUSCLE') {
    return { name: MUSCLE_LABELS[skillKey] ?? fallbackName ?? skillKey, icon: MUSCLE_ICON }
  }
  const meta = ATHLETIC_META[skillKey]
  if (meta) return meta
  return { name: fallbackName ?? skillKey, icon: FALLBACK_ICON }
}

export const HEADLINE_BY_SOURCE: Record<Source, string> = {
  GYM: 'Erős nap volt.',
  RUN: 'Lett benne tempó.',
  SPORT: 'Megdolgoztattad.',
}

/** Headline when XP accrued but no level was crossed (the common case). */
export const HEADLINE_NO_LEVELUP = 'Szépen gyűlik.'

export const CHIP_ICON_BY_SOURCE: Record<Source, string> = {
  GYM: '🏋️',
  RUN: '🏃',
  SPORT: '🏐',
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `cd frontend && pnpm test src/features/progression/levelUpMeta.test.ts && pnpm build`
Expected: PASS (4 tests) + build green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/trainApi.ts frontend/src/features/progression/levelUpMeta.ts frontend/src/features/progression/levelUpMeta.test.ts
git commit -m "feat(progression): LevelUpResult type re-exports + skill display meta (mezo-te8k)"
```

---

## Task 3: Deterministic seeded mock `LevelUpResult` fixtures

**Files:**
- Create: `frontend/src/data/progressionMock.ts`
- Test: `frontend/src/data/progressionMock.test.ts`

**Interfaces:**
- Consumes: `LevelUpResult` (`@/lib/trainApi`).
- Produces: `export const gymLevelUpMock: LevelUpResult`, `sportLevelUpMock: LevelUpResult`, `runLevelUpMock: LevelUpResult`. All deterministic (no `Date`/`Math.random`/`performance.now`). `gymLevelUpMock` exercises the **rich** case (≥2 level-ups incl. a `max_strength` level-up, a muscle level-up, a perk, remaining gains, robustness). `runLevelUpMock` exercises the **no-level-up** case (gains present, `levelUps: []`, `perks: []`). `sportLevelUpMock` exercises a single athletic level-up.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/data/progressionMock.test.ts
import { describe, expect, it } from 'vitest'
import { gymLevelUpMock, sportLevelUpMock, runLevelUpMock } from './progressionMock'

describe('progression mock fixtures', () => {
  it('gym fixture is the rich multi-level-up case with a perk', () => {
    expect(gymLevelUpMock.source).toBe('GYM')
    expect(gymLevelUpMock.totalXp).toBeGreaterThan(0)
    expect(gymLevelUpMock.levelUps.length).toBeGreaterThanOrEqual(2)
    expect(gymLevelUpMock.levelUps).toContain('max_strength')
    expect(gymLevelUpMock.perks.length).toBeGreaterThanOrEqual(1)
    // every levelUp skillKey has a matching gain with levelAfter > levelBefore
    for (const key of gymLevelUpMock.levelUps) {
      const g = gymLevelUpMock.gains.find((x) => x.skillKey === key)
      expect(g).toBeDefined()
      expect(g!.levelAfter).toBeGreaterThan(g!.levelBefore)
    }
  })

  it('run fixture is the no-level-up case (gains, no levelUps/perks)', () => {
    expect(runLevelUpMock.source).toBe('RUN')
    expect(runLevelUpMock.gains.length).toBeGreaterThan(0)
    expect(runLevelUpMock.levelUps).toEqual([])
    expect(runLevelUpMock.perks).toEqual([])
  })

  it('sport fixture has a single athletic level-up', () => {
    expect(sportLevelUpMock.source).toBe('SPORT')
    expect(sportLevelUpMock.levelUps.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test src/data/progressionMock.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/data/progressionMock.ts
// Deterministic seeded LevelUpResult fixtures for mock mode: the no-op finish /
// sport / run mutations can't compute a real payload, so they return one of
// these. Values are fixed (no Date / Math.random) for stable tests + parity.
import type { LevelUpResult } from '@/lib/trainApi'

/** Rich gym case: 2 level-ups (a muscle + max_strength), a perk, more gains, streak. */
export const gymLevelUpMock: LevelUpResult = {
  source: 'GYM',
  workoutLabel: 'Klasszik kondi',
  durationMin: 58,
  rpe: 8,
  totalXp: 480,
  gains: [
    { skillKey: 'chest', kind: 'MUSCLE', name: 'chest', xpGained: 120, levelBefore: 5, levelAfter: 6, progressFromPct: 80, progressToPct: 22 },
    { skillKey: 'max_strength', kind: 'ATHLETIC', name: 'max_strength', xpGained: 150, levelBefore: 6, levelAfter: 7, progressFromPct: 78, progressToPct: 18 },
    { skillKey: 'strength_endurance', kind: 'ATHLETIC', name: 'strength_endurance', xpGained: 70, levelBefore: 5, levelAfter: 5, progressFromPct: 42, progressToPct: 60 },
    { skillKey: 'shoulder', kind: 'MUSCLE', name: 'shoulder', xpGained: 90, levelBefore: 4, levelAfter: 4, progressFromPct: 55, progressToPct: 72 },
    { skillKey: 'triceps', kind: 'MUSCLE', name: 'triceps', xpGained: 50, levelBefore: 3, levelAfter: 3, progressFromPct: 40, progressToPct: 54 },
  ],
  levelUps: ['chest', 'max_strength'],
  perks: [
    { skillKey: 'max_strength', perkKey: 'iron_core_2', name: 'Vas-törzs II', effectCopy: 'push-volumen tűrés +6%', milestoneLevel: 5 },
  ],
  robustness: { xpGained: 25, streakWeeks: 5 },
}

/** No-level-up case (the common one): XP accrued, nothing leveled, no perks. */
export const runLevelUpMock: LevelUpResult = {
  source: 'RUN',
  workoutLabel: 'Sprint futás',
  durationMin: 32,
  rpe: 9,
  totalXp: 180,
  gains: [
    { skillKey: 'sprint_speed', kind: 'ATHLETIC', name: 'sprint_speed', xpGained: 100, levelBefore: 3, levelAfter: 3, progressFromPct: 20, progressToPct: 52 },
    { skillKey: 'anaerobic_capacity', kind: 'ATHLETIC', name: 'anaerobic_capacity', xpGained: 60, levelBefore: 4, levelAfter: 4, progressFromPct: 40, progressToPct: 58 },
    { skillKey: 'explosiveness', kind: 'ATHLETIC', name: 'explosiveness', xpGained: 20, levelBefore: 4, levelAfter: 4, progressFromPct: 60, progressToPct: 66 },
  ],
  levelUps: [],
  perks: [],
  robustness: { xpGained: 25, streakWeeks: 5 },
}

/** Single athletic level-up (volleyball). */
export const sportLevelUpMock: LevelUpResult = {
  source: 'SPORT',
  workoutLabel: 'Röplabda',
  durationMin: 90,
  rpe: 7,
  totalXp: 240,
  gains: [
    { skillKey: 'vertical_jump', kind: 'ATHLETIC', name: 'vertical_jump', xpGained: 90, levelBefore: 3, levelAfter: 4, progressFromPct: 85, progressToPct: 12 },
    { skillKey: 'agility', kind: 'ATHLETIC', name: 'agility', xpGained: 60, levelBefore: 3, levelAfter: 3, progressFromPct: 44, progressToPct: 60 },
    { skillKey: 'coordination', kind: 'ATHLETIC', name: 'coordination', xpGained: 60, levelBefore: 3, levelAfter: 3, progressFromPct: 38, progressToPct: 54 },
    { skillKey: 'aerobic_capacity', kind: 'ATHLETIC', name: 'aerobic_capacity', xpGained: 30, levelBefore: 5, levelAfter: 5, progressFromPct: 66, progressToPct: 74 },
  ],
  levelUps: ['vertical_jump'],
  perks: [],
  robustness: { xpGained: 25, streakWeeks: 5 },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test src/data/progressionMock.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/progressionMock.ts frontend/src/data/progressionMock.test.ts
git commit -m "feat(progression): deterministic seeded LevelUpResult mock fixtures (mezo-te8k)"
```

---

## Task 4: `LevelUpScreen` component (the animated full-bleed portal overlay)

> **Use the `frontend-design` skill for this task.** Port the verbatim markup/styling from `.superpowers/brainstorm/24035-1782367340/content/levelup-v4.html`, mapping its raw hex/`--glow`/`--primary` to the app tokens (`--brand-glow`, teal `--primary`, `--text-*`, `--surface-*`, `--ff-display`, `--ff-mono`). The dynamic logic below is the contract; the static look comes from the mockup.

**Files:**
- Create: `frontend/src/features/progression/LevelUpScreen.tsx`
- Modify: `frontend/src/styles/prototype.css` (append a `.levelup` block + `@keyframes` + reduced-motion gate)
- Test: `frontend/src/features/progression/LevelUpScreen.test.tsx`

**Interfaces:**
- Consumes: `LevelUpResult` (`@/lib/trainApi`), `skillDisplay`/`HEADLINE_BY_SOURCE`/`HEADLINE_NO_LEVELUP`/`CHIP_ICON_BY_SOURCE` (`./levelUpMeta`), `useReducedMotion` (`@/lib/useReducedMotion`), the three mock fixtures (tests only).
- Produces: `export function LevelUpScreen({ result, onContinue }: { result: LevelUpResult; onContinue: () => void }): JSX.Element` — self-portals into `.phone-screen` (falls back to `document.body` in tests), `role="dialog" aria-modal="true"`, single `Tovább` CTA calling `onContinue`.

**Component logic (the contract — must be exact):**

```tsx
// frontend/src/features/progression/LevelUpScreen.tsx  (logic skeleton — port mockup markup for the rest)
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LevelUpResult, LevelUpGain } from '@/lib/trainApi'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { skillDisplay, HEADLINE_BY_SOURCE, HEADLINE_NO_LEVELUP, CHIP_ICON_BY_SOURCE } from './levelUpMeta'

const RING_R = 26
const RING_C = 2 * Math.PI * RING_R // ≈ 163.36 — matches the mockup's dasharray 163

// rAF count-up to `target`; jumps to final immediately when reduced.
function useCountUp(target: number, reduced: boolean, durationMs = 1100): number {
  const [val, setVal] = useState(reduced ? target : 0)
  useEffect(() => {
    if (reduced || typeof requestAnimationFrame !== 'function') { setVal(target); return }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced, durationMs])
  return val
}

export function LevelUpScreen({ result, onContinue }: { result: LevelUpResult; onContinue: () => void }) {
  const reduced = useReducedMotion()
  const [target] = useState<Element>(() => document.querySelector('.phone-screen') ?? document.body)
  const totalXp = useCountUp(result.totalXp, reduced)

  // Split gains: leveled (mini-ring rows) vs the rest (grid). Prefer the explicit
  // levelUps[] membership; fall back to levelAfter > levelBefore for safety.
  const leveled = result.gains.filter((g) => result.levelUps.includes(g.skillKey) || g.levelAfter > g.levelBefore)
  const leveledKeys = new Set(leveled.map((g) => g.skillKey))
  const rest = result.gains.filter((g) => !leveledKeys.has(g.skillKey))

  const headline = result.levelUps.length > 0 ? HEADLINE_BY_SOURCE[result.source] : HEADLINE_NO_LEVELUP
  const chip = [CHIP_ICON_BY_SOURCE[result.source], (result.workoutLabel ?? '').toUpperCase(),
                result.durationMin != null ? `${result.durationMin}'` : null].filter(Boolean).join(' · ')

  // ring fill offset for a leveled skill (within-level progress at the NEW level)
  const ringOffset = (g: LevelUpGain) => RING_C * (1 - Math.max(0, Math.min(100, g.progressToPct)) / 100)

  const overlay = (
    <div className={`levelup${reduced ? ' levelup--reduced' : ''}`} role="dialog" aria-modal="true" aria-label="Szintlépés">
      {/* glow + chip + headline + xp count-up hero */}
      {/* totalXp rendered with data-testid="levelup-xp">{totalXp}  */}
      {/* if leveled.length: section "Szintlépés · {n}" + a .lvrow per leveled gain
            (miniring svg: <circle .mr-track/> + <circle .mr-prog style={{ strokeDasharray: RING_C, strokeDashoffset: ringOffset(g) }}/>,
             .mr-num = g.levelAfter, .lvname = `${skillDisplay(...).icon} ${skillDisplay(...).name}`,
             .lvbadge = `LEVEL UP · Lv${g.levelBefore} → ${g.levelAfter}`, .muscle modifier when kind==='MUSCLE')
          + a .perk row per result.perks (★ <b>{p.name}</b> — <span class=eff>{p.effectCopy}</span>) */}
      {/* if rest.length: section "Még fejlődött · {n}" + .growgrid of .gcell
            (.gic = icon, .gname = name, .gxp = `+${g.xpGained}`,
             .gfill style={{ '--from': `${g.progressFromPct}%`, '--to': `${g.progressToPct}%` }}) */}
      {/* robustness row when result.robustness.xpGained > 0:
            🛡️ Robusztusság · {streakWeeks}. egymást követő héten edzel  +{xpGained} */}
      <button className="cta cta-p levelup-cta" onClick={onContinue}>Tovább ›</button>
    </div>
  )
  return createPortal(overlay, target)
}
```

**`prototype.css` additions (append near the sheet styles):** port the mockup's `.levelup` (full-bleed `position:absolute; inset:0; z-index:250; overflow-y:auto`), `.lvrow`/`.miniring`/`.mr-track`/`.mr-prog`/`.mr-num`/`.lvbadge`/`.perk`/`.growgrid`/`.gcell`/`.gfill`/`.robust`/`.levelup-cta` rules + the `@keyframes fadeUp`, `popIn`, `fillMini` (use the per-element `stroke-dashoffset` var, not the mockup's fixed `to{60}`), `barGrow` (`to { width: var(--to) }`), `breathe`. Stagger via `.levelup .anim`/`.pop` with explicit `animation-delay` top-to-bottom. **Reduced-motion gate:**

```css
@media (prefers-reduced-motion: reduce) {
  .levelup .anim, .levelup .pop { animation: none; opacity: 1; transform: none; }
  .levelup .mr-prog { animation: none; }       /* offset set inline → renders filled */
  .levelup .gfill { animation: none; width: var(--to); }
}
.levelup--reduced .anim, .levelup--reduced .pop { animation: none; opacity: 1; transform: none; }
.levelup--reduced .mr-prog { animation: none; }
.levelup--reduced .gfill { animation: none; width: var(--to); }
```

Z-index: `.levelup { z-index: 250; }` sits above sheets (200/201/211) and TabBar (40)/Fab (30); below `.toast` (300).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/progression/LevelUpScreen.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LevelUpScreen } from './LevelUpScreen'
import { gymLevelUpMock, runLevelUpMock } from '@/data/progressionMock'

// Force reduced-motion so the count-up jumps to its final value (deterministic).
function stubReduced(matches = true) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

describe('LevelUpScreen', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders the total XP (final value under reduced motion) and a single Tovább CTA', () => {
    stubReduced()
    const onContinue = vi.fn()
    render(<LevelUpScreen result={gymLevelUpMock} onContinue={onContinue} />)
    expect(screen.getByText('480')).toBeInTheDocument()
    const cta = screen.getByRole('button', { name: /Tovább/ })
    fireEvent.click(cta)
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('renders a level-up row per leveled skill with its new level + display name', () => {
    stubReduced()
    render(<LevelUpScreen result={gymLevelUpMock} onContinue={() => {}} />)
    // 2 level-ups: chest (Mell, Lv6) + max_strength (Maximális erő, Lv7)
    expect(screen.getByText('Mell')).toBeInTheDocument()
    expect(screen.getByText('Maximális erő')).toBeInTheDocument()
    expect(screen.getByText(/Lv5\s*→\s*6/)).toBeInTheDocument()
    expect(screen.getByText(/Lv6\s*→\s*7/)).toBeInTheDocument()
  })

  it('renders the perk card with the backend name + effect copy', () => {
    stubReduced()
    render(<LevelUpScreen result={gymLevelUpMock} onContinue={() => {}} />)
    expect(screen.getByText('Vas-törzs II')).toBeInTheDocument()
    expect(screen.getByText(/push-volumen tűrés \+6%/)).toBeInTheDocument()
  })

  it('no-level-up case: shows XP + gains grid but no Szintlépés section, adapted headline', () => {
    stubReduced()
    render(<LevelUpScreen result={runLevelUpMock} onContinue={() => {}} />)
    expect(screen.getByText('180')).toBeInTheDocument()
    expect(screen.getByText('Szépen gyűlik.')).toBeInTheDocument()
    expect(screen.queryByText(/Szintlépés/)).not.toBeInTheDocument()
    // gains still render (e.g. Sprint-sebesség)
    expect(screen.getByText('Sprint-sebesség')).toBeInTheDocument()
  })

  it('renders the robustness streak row', () => {
    stubReduced()
    render(<LevelUpScreen result={gymLevelUpMock} onContinue={() => {}} />)
    expect(screen.getByText(/Robusztusság/)).toBeInTheDocument()
    expect(screen.getByText(/5\./)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test src/features/progression/LevelUpScreen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `LevelUpScreen.tsx`** (logic above + mockup markup) and **append the `.levelup` CSS** to `prototype.css`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test src/features/progression/LevelUpScreen.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Visual sanity check + build**

Run: `cd frontend && pnpm build`
Expected: build green. (Optional: drive the app and screenshot the overlay via the `run` skill.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/progression/LevelUpScreen.tsx frontend/src/features/progression/LevelUpScreen.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(progression): LevelUpScreen full-bleed animated portal overlay (mezo-te8k)"
```

---

## Task 5: `LevelUpProvider` + `useLevelUp` + host, mounted in `AppLayout`

**Files:**
- Create: `frontend/src/features/progression/LevelUpProvider.tsx`
- Modify: `frontend/src/app/AppLayout.tsx`
- Test: `frontend/src/features/progression/LevelUpProvider.test.tsx`

**Interfaces:**
- Consumes: `LevelUpScreen` (Task 4), `LevelUpResult`.
- Produces:
  - `export function LevelUpProvider({ children }: { children: ReactNode }): JSX.Element` — provides the context AND renders the host (the active `<LevelUpScreen>`).
  - `export function useLevelUp(): { showLevelUp: (result?: LevelUpResult | null) => void }` — `showLevelUp(undefined|null)` is a no-op (switch-off path); `showLevelUp(result)` shows the overlay; the overlay's `Tovább` clears it. Throws if used outside the provider.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/progression/LevelUpProvider.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LevelUpProvider, useLevelUp } from './LevelUpProvider'
import { gymLevelUpMock } from '@/data/progressionMock'

function stubReduced() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: true, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

function Trigger({ value }: { value: typeof gymLevelUpMock | undefined }) {
  const { showLevelUp } = useLevelUp()
  return <button onClick={() => showLevelUp(value)}>fire</button>
}

describe('LevelUpProvider', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders nothing until showLevelUp is called', () => {
    stubReduced()
    render(<LevelUpProvider><Trigger value={gymLevelUpMock} /></LevelUpProvider>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the overlay on showLevelUp(result) and clears it on Tovább', () => {
    stubReduced()
    render(<LevelUpProvider><Trigger value={gymLevelUpMock} /></LevelUpProvider>)
    fireEvent.click(screen.getByText('fire'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Tovább/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('showLevelUp(undefined) is a no-op (switch-off path)', () => {
    stubReduced()
    render(<LevelUpProvider><Trigger value={undefined} /></LevelUpProvider>)
    fireEvent.click(screen.getByText('fire'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test src/features/progression/LevelUpProvider.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the provider**

```tsx
// frontend/src/features/progression/LevelUpProvider.tsx
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { LevelUpResult } from '@/lib/trainApi'
import { LevelUpScreen } from './LevelUpScreen'

type Ctx = { showLevelUp: (result?: LevelUpResult | null) => void }
const LevelUpContext = createContext<Ctx | null>(null)

/** Single host for the post-workout level-up overlay. Any flow (gym/sport/run)
 *  calls showLevelUp(r?.levelUp); undefined/null is a no-op (progression switch
 *  off). The overlay self-portals over the whole phone screen. */
export function LevelUpProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<LevelUpResult | null>(null)
  const showLevelUp = useCallback((result?: LevelUpResult | null) => {
    if (result) setCurrent(result)
  }, [])
  const value = useMemo(() => ({ showLevelUp }), [showLevelUp])
  return (
    <LevelUpContext.Provider value={value}>
      {children}
      {current && <LevelUpScreen result={current} onContinue={() => setCurrent(null)} />}
    </LevelUpContext.Provider>
  )
}

export function useLevelUp(): Ctx {
  const ctx = useContext(LevelUpContext)
  if (!ctx) throw new Error('useLevelUp must be used within a LevelUpProvider')
  return ctx
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test src/features/progression/LevelUpProvider.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Mount in `AppLayout`** — wrap inside `PhoneFrame` so `.phone-screen` exists for the portal:

```tsx
// frontend/src/app/AppLayout.tsx  (add import)
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
// ...
  return (
    <PhoneFrame anchor={anchor}>
      <LevelUpProvider>
        <ScreenContent>
          <Outlet />
        </ScreenContent>
        <Fab onClick={() => setQuickOpen(true)} />
        {quickOpen && <QuickInputSheet onClose={() => setQuickOpen(false)} />}
        <TabBar />
      </LevelUpProvider>
    </PhoneFrame>
  )
```

- [ ] **Step 6: Run the shell tests + build**

Run: `cd frontend && pnpm test src/app/shell.test.tsx src/app/navigation.test.tsx && pnpm build`
Expected: PASS + build green (provider adds no DOM until triggered).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/progression/LevelUpProvider.tsx frontend/src/features/progression/LevelUpProvider.test.tsx frontend/src/app/AppLayout.tsx
git commit -m "feat(progression): LevelUpProvider single host mounted in AppLayout (mezo-te8k)"
```

---

## Task 6: Gym seam — forward finish `levelUp` + present + replace demo PR

**Files:**
- Modify: `frontend/src/data/trainHooks.ts` (`finishMutation`, `finishWorkout` callback, `TrainData.finishWorkout` type)
- Modify: `frontend/src/features/train/ActiveWorkoutScreen.tsx` (`SessionProps.finishWorkout`, `useTrain` destructure passthrough, finish call sites, complete-phase `hadPR`)
- Test: `frontend/src/data/trainHooks.test.tsx`, `frontend/src/features/train/ActiveWorkoutScreen.test.tsx`

**Interfaces:**
- Consumes: `useLevelUp` (Task 5), `gymLevelUpMock` (Task 3), `WorkoutInstanceResponse.levelUp`.
- Produces: `finishWorkout: (workoutId: string, opts?: { onSuccess?: (r?: WorkoutInstanceResponse) => void }) => void` (widened on `TrainData` + `SessionProps`).

- [ ] **Step 1: Write the failing hook test** (append to `trainHooks.test.tsx`)

```tsx
it('finishWorkout forwards the levelUp on the response (mock fixture)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useTrain(), { wrapper })
  const seen: unknown[] = []
  act(() => result.current.finishWorkout('w1', { onSuccess: (r) => seen.push(r?.levelUp) }))
  await waitFor(() => expect(seen.length).toBe(1))
  expect((seen[0] as { source: string } | undefined)?.source).toBe('GYM')
})
```

- [ ] **Step 2: Run it — fails** (`finishWorkout` takes no opts; mock returns `undefined`).

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/data/trainHooks.test.tsx -t "forwards the levelUp"`
Expected: FAIL.

- [ ] **Step 3: Widen the gym mutation + callback in `trainHooks.ts`**

```ts
// import the gym fixture at the top of trainHooks.ts
import { gymLevelUpMock } from './progressionMock'

// finishMutation (≈:341): mock returns a fixture carrying levelUp; real returns the response
const finishMutation = useMutation({
  mutationFn: mock
    ? async (_id: string) => ({ levelUp: gymLevelUpMock } as WorkoutInstanceResponse)
    : (id: string) => trainApi.finishWorkout(id),
  onSuccess: invalidateToday,
})

// finishWorkout callback (≈:423): forward the response to onSuccess
const finishWorkout = useCallback(
  (workoutId: string, opts?: { onSuccess?: (r?: WorkoutInstanceResponse) => void }) =>
    finishMutation.mutate(workoutId, { onSuccess: (r) => opts?.onSuccess?.(r) }),
  [finishMutation],
)
```

Update the `TrainData` interface entry (`:222`): `finishWorkout: (workoutId: string, opts?: { onSuccess?: (r?: WorkoutInstanceResponse) => void }) => void`.

- [ ] **Step 4: Run the hook test — passes.**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/data/trainHooks.test.tsx -t "forwards the levelUp"`
Expected: PASS.

- [ ] **Step 5: Write the failing screen test** (append to `ActiveWorkoutScreen.test.tsx` — mock mode finishes a workout and asserts the overlay appears, then the recap is revealed on Tovább)

```tsx
it('shows the level-up overlay on finish, then the recap on Tovább (mock)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  // ... render ActiveWorkoutScreen within the app providers incl. LevelUpProvider,
  //     drive the existing finish flow used by the file's other tests ...
  // After finishing:
  expect(await screen.findByRole('dialog', { name: 'Szintlépés' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Tovább/ }))
  expect(screen.queryByRole('dialog', { name: 'Szintlépés' })).not.toBeInTheDocument()
  expect(screen.getByText(/Edzés vége ·/)).toBeInTheDocument() // WorkoutComplete recap underneath
})
```

> The existing finish-flow test (line ~321) already drives to `complete`; wrap the render in `LevelUpProvider` (or assert the screen renders the recap, with a separate provider-level test for the overlay if mounting the full app tree is heavy). Keep the existing recap assertion green.

- [ ] **Step 6: Wire `ActiveWorkoutScreen.tsx`**

Add the context + state, thread the result, and replace the demo `hadPR`:

```tsx
// imports
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import type { LevelUpResult } from '@/lib/trainApi'

// inside ActiveWorkoutSession (the inner component):
const { showLevelUp } = useLevelUp()
const [hadPrFromSignal, setHadPrFromSignal] = useState(false)

// finish call sites (advanceAfterFeedback ≈:252 AND handleSkip ≈:268) — replace
//   `if (workoutId) finishWorkout(workoutId)` with:
if (workoutId) finishWorkout(workoutId, {
  onSuccess: (r) => {
    if (r?.levelUp) { showLevelUp(r.levelUp); setHadPrFromSignal(r.levelUp.levelUps.includes('max_strength')) }
  },
})
// setPhase('complete') stays synchronous (optimistic) — the overlay portals OVER
// the recap and is revealed on Tovább; on switch-off/error no overlay shows.

// COMPLETE block (≈:445): replace the 105 kg demo path
const hadPR = !!showPR || hadPrFromSignal
```

Remove the now-unused `PR_DEMO_THRESHOLD_KG` reference in the complete block (keep the mid-workout `showPR` toast logic untouched — that demo is out of P5 scope; only the recap's `hadPR` source changes). The `SessionProps.finishWorkout` type (`:105`) widens to `(workoutId: string, opts?: { onSuccess?: (r?: WorkoutInstanceResponse) => void }) => void`.

- [ ] **Step 7: Run both-mode screen + hook tests**

Run: `cd frontend && pnpm test src/features/train/ActiveWorkoutScreen.test.tsx src/data/trainHooks.test.tsx && VITE_USE_MOCK=true pnpm test src/features/train/ActiveWorkoutScreen.test.tsx src/data/trainHooks.test.tsx`
Expected: PASS both modes.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/data/trainHooks.ts frontend/src/features/train/ActiveWorkoutScreen.tsx frontend/src/data/trainHooks.test.tsx frontend/src/features/train/ActiveWorkoutScreen.test.tsx
git commit -m "feat(progression): capture gym finish levelUp + present overlay, real PR signal (mezo-te8k)"
```

---

## Task 7: Run seam — forward `logRunSession` response + present + deferred sheet close

**Files:**
- Modify: `frontend/src/data/runningHooks.ts` (`logMock`, `logMutation`, `logRunSession` callback, `RunningData.logRunSession` type)
- Modify: `frontend/src/features/train/components/RunLogSheet.tsx` (`onSave` signature `(input, done)` + saving guard)
- Modify: `frontend/src/features/train/views/RunningView.tsx` (`RunWeekView` mount → `useLevelUp` + wire)
- Modify: `frontend/src/features/train/views/TrainTodayView.tsx` (run mount → wire)
- Test: `frontend/src/data/runningHooks.test.ts`, `frontend/src/features/train/views/RunningView.test.tsx`, `frontend/src/features/train/views/TrainTodayView.test.tsx`

**Interfaces:**
- Consumes: `useLevelUp`, `runLevelUpMock`, `RunSessionLogResponse.levelUp`.
- Produces: `logRunSession: (body: RunSessionLogRequest, opts?: { onSuccess?: (r?: RunSessionLogResponse) => void }) => void`; `RunLogSheet` `onSave?: (input: RunSessionLogRequest, done: () => void) => void`.

- [ ] **Step 1: Write the failing hook test** (append to `runningHooks.test.ts`)

```ts
it('logRunSession forwards the levelUp on the response (mock fixture)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useRunning(), { wrapper })
  const seen: unknown[] = []
  act(() => result.current.logRunSession(
    { blockId: 'b1', weekNumber: 1, sessionKey: 'k', date: '2026-06-29', completedRounds: 6, rpeActual: 9, hrRecoverySec: 45, sprintLandmark: null, durationMin: null, notes: null },
    { onSuccess: (r) => seen.push(r?.levelUp) },
  ))
  await waitFor(() => expect(seen.length).toBe(1))
  expect((seen[0] as { source: string } | undefined)?.source).toBe('RUN')
})
```

- [ ] **Step 2: Run it — fails** (`onSuccess` is zero-arg; mock `logMock` has no `levelUp`).

- [ ] **Step 3: Widen the run mutation + callback in `runningHooks.ts`**

```ts
import { runLevelUpMock } from './progressionMock'

// logMock (≈:79): tag the mock response with the levelUp fixture
const logMock = (body: RunSessionLogRequest): RunSessionLogResponse =>
  ({ id: `rs-${Math.round(performance.now())}`, ...body,
     completedRounds: body.completedRounds ?? null, rpeActual: body.rpeActual ?? null,
     hrRecoverySec: body.hrRecoverySec ?? null, sprintLandmark: body.sprintLandmark ?? null,
     durationMin: body.durationMin ?? null, notes: body.notes ?? null,
     levelUp: runLevelUpMock })

// logMutation (≈:84): forward the response (drop `.then(() => undefined)`); mock returns the tagged response
const logMutation = useMutation({
  mutationFn: (body: RunSessionLogRequest): Promise<RunSessionLogResponse> => {
    if (mock) {
      const logged = logMock(body)
      qc.setQueryData<RunSessionLogResponse[]>(['running', 'runSessions'], (prev = []) => [logged, ...prev])
      return Promise.resolve(logged)
    }
    return runningApi.logRunSession(body)
  },
  onSuccess: () => { if (!mock) qc.invalidateQueries({ queryKey: ['running', 'runSessions'] }) },
})

// logRunSession callback (≈:96): forward (mirror saveRunningBlock's `(b) => …`)
const logRunSession = useCallback((body: RunSessionLogRequest, opts?: { onSuccess?: (r?: RunSessionLogResponse) => void }) =>
  logMutation.mutate(body, { onSuccess: (r) => opts?.onSuccess?.(r) }), [logMutation])
```

Update `RunningData.logRunSession` type (`:18`) to `(body: RunSessionLogRequest, opts?: { onSuccess?: (r?: RunSessionLogResponse) => void }) => void`.

> Note: the mock branch appends to the cache (as today, for the Mai done-state flip) AND returns the response. `runSessionsMock` / `runningApi.runSessions` GET-list types are unchanged (`levelUp?` is optional).

- [ ] **Step 4: Run the hook test — passes.**

- [ ] **Step 5: `RunLogSheet.tsx` — deferred close + saving guard**

```tsx
// signature: onSave?: (input: RunSessionLogRequest, done: () => void) => void
const [saving, setSaving] = useState(false)
// CTA onClick:
onClick={() => {
  const body: RunSessionLogRequest = { /* ...existing body... */ }
  if (onSave) { setSaving(true); onSave(body, close) } else { close() }
}}
disabled={saving}
```

(The `close` passed to `onSave` runs only when the parent's mutation succeeds; on a no-`onSave` render it closes immediately. `saving` prevents double-submit.)

- [ ] **Step 6: Wire the two run mounts**

`RunningView.tsx` — `RunWeekView` (owns `logCtx`, mounts `RunLogSheet` ≈:227): call `useLevelUp()` in `RunWeekView`, and change the mount to:

```tsx
const { showLevelUp } = useLevelUp()
// mount:
{logCtx && <RunLogSheet ctx={logCtx} onClose={() => setLogCtx(null)}
  onSave={(body, done) => onLog(body, { onSuccess: (r) => { done(); setLogCtx(null); showLevelUp(r?.levelUp) } })} />}
```

(`onLog` is `logRunSession`, now opts-forwarding. `done()` animates the sheet closed; `setLogCtx(null)` unmounts; `showLevelUp` shows the overlay.)

`TrainTodayView.tsx` — run mount (≈:420): same shape via `useLevelUp()` and `runLogCtx`:

```tsx
{runLogCtx && <RunLogSheet ctx={runLogCtx} onClose={() => setRunLogCtx(null)}
  onSave={(body, done) => logRunSession(body, { onSuccess: (r) => { done(); setRunLogCtx(null); showLevelUp(r?.levelUp) } })} />}
```

- [ ] **Step 7: Update view tests** — `RunningView.test.tsx` / `TrainTodayView.test.tsx`: render within `LevelUpProvider`; after logging a run, assert the overlay dialog appears (mock fixture). Keep the existing "sheet opens" assertions green.

- [ ] **Step 8: Run both-mode tests + build**

Run: `cd frontend && pnpm test src/data/runningHooks.test.ts src/features/train/views/RunningView.test.tsx src/features/train/views/TrainTodayView.test.tsx src/features/train/components/RunLogSheet* && VITE_USE_MOCK=true pnpm test src/data/runningHooks.test.ts src/features/train/views/RunningView.test.tsx src/features/train/views/TrainTodayView.test.tsx && pnpm build`
Expected: PASS both modes + build green.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/data/runningHooks.ts frontend/src/features/train/components/RunLogSheet.tsx frontend/src/features/train/views/RunningView.tsx frontend/src/features/train/views/TrainTodayView.tsx frontend/src/data/runningHooks.test.ts frontend/src/features/train/views/RunningView.test.tsx frontend/src/features/train/views/TrainTodayView.test.tsx
git commit -m "feat(progression): capture run-log levelUp + present overlay, deferred sheet close (mezo-te8k)"
```

---

## Task 8: Sport seam — forward `logSportSession` response + present + deferred sheet close

**Files:**
- Modify: `frontend/src/data/trainHooks.ts` (`logSportMutation`, `logSportSession` callback, `TrainData.logSportSession` type)
- Modify: `frontend/src/features/train/components/SportLogSheet.tsx` (`onSave` signature `(input, done)` + saving guard)
- Modify: `frontend/src/features/train/views/SportView.tsx` (sport mount → `useLevelUp` + wire)
- Modify: `frontend/src/features/train/views/TrainTodayView.tsx` (sport mount → wire)
- Test: `frontend/src/data/trainHooks.test.tsx`, `frontend/src/features/train/components/SportLogSheet.test.tsx`, `frontend/src/features/train/views/SportView.test.tsx`, `frontend/src/features/train/views/TrainTodayView.test.tsx`

**Interfaces:**
- Consumes: `useLevelUp`, `sportLevelUpMock`, `SportSessionResponse.levelUp`.
- Produces: `logSportSession: (req: SportSessionCreateRequest, opts?: { onSuccess?: (r?: SportSessionResponse) => void }) => void`; `SportLogSheet` `onSave?: (input: SportSessionCreateRequest, done: () => void) => void`.

- [ ] **Step 1: Write the failing hook test** (append to `trainHooks.test.tsx`)

```tsx
it('logSportSession forwards the levelUp on the response (mock fixture)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useTrain(), { wrapper })
  const seen: unknown[] = []
  act(() => result.current.logSportSession(
    { duration: 90, setsPlayed: 5, rpe: 7, shoulderStrain: 6 },
    { onSuccess: (r) => seen.push(r?.levelUp) },
  ))
  await waitFor(() => expect(seen.length).toBe(1))
  expect((seen[0] as { source: string } | undefined)?.source).toBe('SPORT')
})
```

- [ ] **Step 2: Run it — fails** (real branch `.then(() => undefined)`; mock returns void; callback uses `MutateOpts` zero-arg).

- [ ] **Step 3: Widen the sport mutation + callback in `trainHooks.ts`**

```ts
import { sportLevelUpMock } from './progressionMock'
import type { SportSessionResponse } from '@/lib/trainApi' // if not already imported

// logSportMutation (≈:349): mock keeps the cache-append AND returns a response with levelUp; real forwards
const logSportMutation = useMutation({
  mutationFn: mock
    ? async (req: SportSessionCreateRequest): Promise<SportSessionResponse> => {
        qc.setQueryData<{ sessions: SportSession[]; week: SportWeek | null }>(
          ['train', 'sportSessions'],
          (prev) => { /* ...existing synthetic SportSession append, unchanged... */ },
        )
        return { /* minimal SportSessionResponse */ ...sportLevelUpMockResponseFields, levelUp: sportLevelUpMock } as SportSessionResponse
      }
    : (req: SportSessionCreateRequest) => trainApi.logSportSession(req),
  onSuccess: () => { if (!mock) qc.invalidateQueries({ queryKey: ['train', 'sportSessions'] }) },
})

// logSportSession callback (≈:427): forward the response
const logSportSession = useCallback(
  (req: SportSessionCreateRequest, opts?: { onSuccess?: (r?: SportSessionResponse) => void }) =>
    logSportMutation.mutate(req, { onSuccess: (r) => opts?.onSuccess?.(r) }),
  [logSportMutation],
)
```

> The mock branch can return `{ id: `ss-mock`, sport: req.sport ?? 'volleyball', date: '', duration: req.duration, rpe: req.rpe, setsPlayed: req.setsPlayed ?? null, shoulderStrain: req.shoulderStrain ?? null, rounds: req.rounds ?? null, jumpCount: null, intensity: null, notes: null, levelUp: sportLevelUpMock } as SportSessionResponse` — only `levelUp` is read downstream, so keep it minimal but type-clean. Update `TrainData.logSportSession` type (`:223`).

- [ ] **Step 4: Run the hook test — passes.**

- [ ] **Step 5: `SportLogSheet.tsx` — deferred close + saving guard** (same pattern as RunLogSheet)

```tsx
// signature: onSave?: (input: SportSessionCreateRequest, done: () => void) => void
const [saving, setSaving] = useState(false)
// CTA onClick (the volleyball body for now; Task 9 adds the kind branch):
onClick={() => {
  const body: SportSessionCreateRequest = { sport: 'volleyball', duration, setsPlayed: sets, rpe, shoulderStrain: shoulder }
  if (onSave) { setSaving(true); onSave(body, close) } else { close() }
}}
disabled={saving}
```

> Note: this also makes the volleyball payload **explicit** about `sport: 'volleyball'` (was implicit server default). Update `SportLogSheet.test.tsx` (line ~44): assert `onSave` is called with `({ sport: 'volleyball', duration, setsPlayed, rpe, shoulderStrain }, expect.any(Function))`.

- [ ] **Step 6: Wire the two sport mounts**

`SportView.tsx` (mount ≈:216): `useLevelUp()` + 
```tsx
{logOpen && <SportLogSheet onClose={() => setLogOpen(false)}
  onSave={(body, done) => logSportSession(body, { onSuccess: (r) => { done(); setLogOpen(false); showLevelUp(r?.levelUp) } })} />}
```
`TrainTodayView.tsx` (sport mount ≈:419): same shape with `vbLogOpen`/`setVbLogOpen`.

- [ ] **Step 7: Update view tests** — `SportView.test.tsx` / `TrainTodayView.test.tsx`: render within `LevelUpProvider`; after logging a sport session, assert the overlay dialog appears.

- [ ] **Step 8: Run both-mode tests + build**

Run: `cd frontend && pnpm test src/data/trainHooks.test.tsx src/features/train/components/SportLogSheet.test.tsx src/features/train/views/SportView.test.tsx src/features/train/views/TrainTodayView.test.tsx && VITE_USE_MOCK=true pnpm test src/data/trainHooks.test.tsx src/features/train/components/SportLogSheet.test.tsx src/features/train/views/SportView.test.tsx src/features/train/views/TrainTodayView.test.tsx && pnpm build`
Expected: PASS both modes + build green.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/data/trainHooks.ts frontend/src/features/train/components/SportLogSheet.tsx frontend/src/features/train/views/SportView.tsx frontend/src/features/train/views/TrainTodayView.tsx frontend/src/data/trainHooks.test.tsx frontend/src/features/train/components/SportLogSheet.test.tsx src/features/train/views/SportView.test.tsx frontend/src/features/train/views/TrainTodayView.test.tsx
git commit -m "feat(progression): capture sport-log levelUp + present overlay, deferred sheet close (mezo-te8k)"
```

---

## Task 9: Cross / TRX kind selector in `SportLogSheet`

**Files:**
- Modify: `frontend/src/features/train/components/SportLogSheet.tsx` (add a 3-way kind segmented control + `rounds`; branch the payload by kind)
- Test: `frontend/src/features/train/components/SportLogSheet.test.tsx`

**Interfaces:**
- Consumes: `SportSessionCreateRequest` (`sport?: 'volleyball'|'cross'|'trx'`, `setsPlayed?`, `shoulderStrain?`, `rounds?` — only `duration`+`rpe` required).
- Produces: the sheet sends a `sport`-discriminated payload: volleyball → `{ sport:'volleyball', duration, setsPlayed, rpe, shoulderStrain }`; cross/trx → `{ sport:'cross'|'trx', duration, rpe, rounds }`.

- [ ] **Step 1: Write the failing tests** (extend `SportLogSheet.test.tsx`)

```tsx
it('defaults to a volleyball payload', () => {
  const onSave = vi.fn()
  render(<SportLogSheet onClose={() => {}} onSave={onSave} />)
  fireEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalledWith(
    { sport: 'volleyball', duration: 90, setsPlayed: 5, rpe: 7, shoulderStrain: 6 },
    expect.any(Function),
  )
})

it('cross kind sends sport:cross + rounds, no volleyball fields', () => {
  const onSave = vi.fn()
  render(<SportLogSheet onClose={() => {}} onSave={onSave} />)
  fireEvent.click(screen.getByRole('button', { name: 'Cross' }))
  fireEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  const [body] = onSave.mock.calls[0]
  expect(body.sport).toBe('cross')
  expect(body.rounds).toBeGreaterThan(0)
  expect(body.setsPlayed).toBeUndefined()
  expect(body.shoulderStrain).toBeUndefined()
})

it('trx kind sends sport:trx + rounds', () => {
  const onSave = vi.fn()
  render(<SportLogSheet onClose={() => {}} onSave={onSave} />)
  fireEvent.click(screen.getByRole('button', { name: 'TRX' }))
  fireEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onSave.mock.calls[0][0].sport).toBe('trx')
})
```

- [ ] **Step 2: Run — fails** (no kind selector; default payload lacks `sport`/branching).

- [ ] **Step 3: Implement the kind selector**

```tsx
type SportKind = 'volleyball' | 'cross' | 'trx'
const KIND_LABELS: Record<SportKind, string> = { volleyball: 'Röpi', cross: 'Cross', trx: 'TRX' }
// state:
const [kind, setKind] = useState<SportKind>('volleyball')
const [rounds, setRounds] = useState(6)
// header eyebrow text: `Sport log · ${KIND_LABELS[kind]}` (de-hardcode "Volleyball")
// a segmented control above the fields:
<div className="seg-row" role="group" aria-label="Sport típus">
  {(['volleyball','cross','trx'] as const).map((k) => (
    <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_LABELS[k]}</button>
  ))}
</div>
// volleyball-only fields gated by `kind === 'volleyball'`:
{kind === 'volleyball' && <NumberStep label="Setek · összesen" ... />}
{kind === 'volleyball' && <ScaleRow label="Váll terhelés" ... />}
// cross/trx field:
{kind !== 'volleyball' && <NumberStep label="Körök · összesen" val={rounds} step={1} min={1} max={50} onChange={setRounds} />}
// RPE + duration always shown.
// payload branch in the CTA onClick:
const body: SportSessionCreateRequest = kind === 'volleyball'
  ? { sport: 'volleyball', duration, setsPlayed: sets, rpe, shoulderStrain: shoulder }
  : { sport: kind, duration, rpe, rounds }
```

Reuse an existing segmented-control style if `prototype.css` has one (mirror the `SportView`/`RunningView` 3-button switchers); otherwise a minimal `seg-row` of `.chip` buttons. The "Mezo observation" card's volleyball-specific copy (`shoulder >= 7` …) should only render for `kind === 'volleyball'`.

- [ ] **Step 4: Run — passes (both modes).**

Run: `cd frontend && pnpm test src/features/train/components/SportLogSheet.test.tsx && VITE_USE_MOCK=true pnpm test src/features/train/components/SportLogSheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/components/SportLogSheet.tsx frontend/src/features/train/components/SportLogSheet.test.tsx
git commit -m "feat(progression): cross/TRX kind selector in SportLogSheet (mezo-te8k)"
```

---

## Task 10: Docs, lint, and full verification gates

**Files:**
- Modify: `docs/features/train.md` (§2 active-workout COMPLETE phase now shows the level-up overlay; §2 Sport sheet now has the kind selector; §4 Sport DTO note: cross/TRX now loggable in the UI; §5 add the LevelUpScreen/progression seam row; §10 list the new `features/progression/*` files)
- Modify: `docs/features/_platform-api-backend.md` §4e (FE now consumes `levelUp` via the single `LevelUpProvider` host — P5 done; P6 = profile cards remains)
- Modify: `docs/milestones/roadmap.md` (Progression P5 shipped)

- [ ] **Step 1: Update `train.md`** — flip the P5 references ("the FE LevelUpScreen is P5") to "done"; document the COMPLETE-phase composition (overlay over recap, `Tovább` reveals recap), the `(input, done)` deferred-close sheet contract, the cross/TRX kind selector (retire the §4 🟣 "cross/TRX log-sheet UI is deferred to P5" note), and the single-host overlay seam. Run lint after.

- [ ] **Step 2: Update `_platform-api-backend.md` §4e** — add a short FE-consumer paragraph: the three finish responses' `levelUp` is now captured FE-side and shown via `features/progression/LevelUpProvider` (single host) + `LevelUpScreen` (self-portaling overlay, reduced-motion first-class); mock mode returns seeded `progressionMock` fixtures; profile cards (radar/muscle) remain P6.

- [ ] **Step 3: Update `roadmap.md`** — mark Progression P5 (mezo-te8k) shipped.

- [ ] **Step 4: Run the docs linter**

Run: `node scripts/lint-docs.mjs`
Expected: no orphans / broken links / staleness flags for the touched docs.

- [ ] **Step 5: Full FE verification (both modes + build)**

Run:
```bash
cd frontend
pnpm test
VITE_USE_MOCK=true pnpm test
pnpm build
```
Expected: all green in BOTH modes + build succeeds.

- [ ] **Step 6: Parity (if relevant)**

Run: `cd frontend && pnpm parity`
Expected: existing screens unchanged. The level-up overlay is net-new (no prototype baseline) — note in the commit if parity has no LevelUpScreen reference; the goal is no regression on existing captures.

- [ ] **Step 7: Commit docs**

```bash
git add docs/
git commit -m "docs(progression): P5 FE level-up overlay — train.md + _platform-api-backend.md §4e + roadmap (mezo-te8k)"
```

---

## Self-Review (run after drafting; fix inline)

- **Spec coverage** (`2026-06-25-progression-levelup-design.md` §4 + §5 + §8 P5):
  - 3 FE seams forwarding the response → Tasks 6 (gym), 7 (run), 8 (sport). ✓
  - Single host overlay, defer close to success → Task 5 (host) + Tasks 7/8 (deferred close). ✓
  - `LevelUpScreen` full-bleed portal, hand-rolled keyframes, rAF count-up, mini-rings, bars grid, perk card, robustness row, single `Tovább`, scales to multiple level-ups → Task 4. ✓
  - reduced-motion first-class + shared `useReducedMotion` reused by radar → Task 1 + Task 4. ✓
  - no-level-up case always shows → Task 4 (test) + `runLevelUpMock`. ✓
  - gym composition: level-up primary, recap on Tovább, real PR replaces demo → Task 6. ✓
  - mock seeded fixtures → Task 3. ✓
  - cross/TRX kind selector → Task 9. ✓
- **Placeholder scan:** the only deferred-detail is the LevelUpScreen's static markup (Task 4), explicitly delegated to the verbatim mockup + `frontend-design` skill; all dynamic logic, math, and tests are spelled out. ✓
- **Type consistency:** `finishWorkout`/`logRunSession`/`logSportSession` all widen to `opts?: { onSuccess?: (r?: <Response>) => void }`; both sheets' `onSave?: (input, done: () => void) => void`; `useLevelUp().showLevelUp(result?: LevelUpResult | null)`; `LevelUpScreen({ result, onContinue })`. Consistent across Tasks 4–9. ✓

## Execution notes

- One bd issue (mezo-te8k) + one branch (`feat/progression-p5-levelup`, already created). Commit per task.
- Before merge: adversarial review via a Workflow (dimensions × per-finding verify, the P3b/P4 pattern).
- Merge `--no-ff` into main, delete the branch, then `bd dolt push && git push`. **Do NOT `git pull --rebase` after the merge** (it flattens the `--no-ff` merge commit; the pre-merge rebase already synced — see the `git-noff-merge-flatten-trap` memory).

# Gamified Unified Header (AppHero) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One shared identity header (AppHero: avatar + XP ring + level badge, name, equipped title, per-tab utilities, 🔥/⚡/🪙 chips) on all 4 main tabs, backed by a new frontend-first `data/gamification/` domain (account XP, level curve, coins, titles, daily streak + saver).

**Architecture:** New `data/gamification/` domain follows the repo's dual-mode idiom (mock = TanStack cache mutated via `qc.setQueryData`, real = derived from `/api/progression/profile` until the backend slice `mezo-huzd`). A pure award engine (`awardGamificationEvent`) is called from the mock arms of every logging mutation. `AppHero` lives in `features/progression/` (like `LevelUpProvider`) and is mounted section-level on the 4 tab shells, replacing `BrandRow` and `MeHead`.

**Tech Stack:** React 19, TanStack Query, vitest + @testing-library/react + MSW, Tailwind v4 tokens in `prototype.css`.

**Spec:** `docs/superpowers/specs/2026-07-18-gamified-header-design.md` · **bd:** `mezo-k7rn` · **Branch:** `feat/gamified-header` (already checked out; spec committed on it)

## Global Constraints

- All work under `frontend/` — run all pnpm commands from `/Users/daniel.kuhne/MrKuhne/mezo/frontend`.
- House rules (docs/references/frontend_conventions.md): deep absolute `@/*` imports only (never `../`); features import data hooks ONLY from `@/data/hooks` (non-hook data modules like `gamificationStore` MAY be deep-imported); no new barrels; tests colocated; `shared/ui` must not import `@/data/*`.
- Code + comments ENGLISH; UI copy HUNGARIAN (exact strings given per task).
- Mode idiom: `isMockMode()` from `@/data/_client/mode` called INSIDE hook bodies. Tests must stub the mode explicitly per test file (`vi.stubEnv('VITE_USE_MOCK', 'true' | 'false')` + `afterEach(() => vi.unstubAllEnvs())`) so they pass under BOTH `pnpm test` and `VITE_USE_MOCK=true pnpm test`.
- Real mode must NEVER render mock seeds (dual-mode invariant, machine-enforced by `src/data/dualMode.guard.test.ts`).
- Test wrappers: `QueryWrapper` / `makeHookWrapper()` from `@/test/queryWrapper`; router context via `MemoryRouter` or `createMemoryRouter(routes)`; MSW: `server` from `@/test/msw/server`, `API_BASE` from `@/test/msw/handlers`.
- CSS additions go to `frontend/src/styles/prototype.css` using `var(--token)` colors (raw hex only where the existing file already does, e.g. avatar gradient).
- Commit after every task with the given conventional message; every message ends with the trailer line `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Existing types referenced throughout: `LevelUpResult` (generated, `data/_client/api.gen.ts:2091`), `ProgressionProfileResponse` (`api.gen.ts:3044`), `DailyQuest` (`data/types.ts:735`), `ApiError` (`data/_client/api.ts:12`).

---

### Task 1: Level curve

**Files:**
- Create: `frontend/src/data/gamification/levelCurve.ts`
- Test: `frontend/src/data/gamification/levelCurve.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `xpToNext(level: number): number`; `levelFromTotalXp(totalXp: number): { level: number; xpInLevel: number; xpForNext: number }`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/data/gamification/levelCurve.test.ts
import { levelFromTotalXp, xpToNext } from '@/data/gamification/levelCurve'

test('xpToNext grows linearly from 80 by 40 per level', () => {
  expect(xpToNext(1)).toBe(80)
  expect(xpToNext(2)).toBe(120)
  expect(xpToNext(12)).toBe(520)
})

test('levelFromTotalXp walks the cumulative thresholds', () => {
  expect(levelFromTotalXp(0)).toEqual({ level: 1, xpInLevel: 0, xpForNext: 80 })
  expect(levelFromTotalXp(79)).toEqual({ level: 1, xpInLevel: 79, xpForNext: 80 })
  expect(levelFromTotalXp(80)).toEqual({ level: 2, xpInLevel: 0, xpForNext: 120 })
  expect(levelFromTotalXp(560)).toEqual({ level: 5, xpInLevel: 0, xpForNext: 240 })
  expect(levelFromTotalXp(3140)).toEqual({ level: 12, xpInLevel: 60, xpForNext: 520 })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/data/gamification/levelCurve.test.ts`
Expected: FAIL — cannot resolve `@/data/gamification/levelCurve`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/data/gamification/levelCurve.ts
/** Account level curve (spec §5.2): Lv n→n+1 costs 80 + 40·(n−1) XP. */
export function xpToNext(level: number): number {
  return 80 + 40 * (level - 1)
}

export function levelFromTotalXp(totalXp: number): {
  level: number
  xpInLevel: number
  xpForNext: number
} {
  let level = 1
  let rest = totalXp
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level)
    level += 1
  }
  return { level, xpInLevel: rest, xpForNext: xpToNext(level) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/data/gamification/levelCurve.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/gamification/levelCurve.ts frontend/src/data/gamification/levelCurve.test.ts
git commit -m "feat(gamification): account level curve (mezo-k7rn)"
```

---

### Task 2: Types + XP values with daily caps

**Files:**
- Create: `frontend/src/data/gamification/gamificationTypes.ts`
- Create: `frontend/src/data/gamification/xpValues.ts`
- Test: `frontend/src/data/gamification/xpValues.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `XpEventType = 'MEAL'|'WEIGHT'|'SLEEP'|'CHECKIN'|'MEDICATION'|'GYM'|'RUN'|'SPORT'|'QUEST'|'ACTIVITY'`
  - `GamificationProfile`, `Title` types (below, exact fields)
  - `XP_VALUES`, `DAILY_CAPS: Record<XpEventType, number>`; `xpForEvent(type, countToday, xpOverride?): number`

- [ ] **Step 1: Write the types file** (no test of its own — exercised by every later test)

```ts
// frontend/src/data/gamification/gamificationTypes.ts
/** Account-wide gamification domain (spec §4.1). Frontend-first: mock lives in the
 *  TanStack cache; real mode is derived/ghost until the backend slice (mezo-huzd). */
export type XpEventType =
  | 'MEAL' | 'WEIGHT' | 'SLEEP' | 'CHECKIN' | 'MEDICATION'
  | 'GYM' | 'RUN' | 'SPORT' | 'QUEST' | 'ACTIVITY'

export type GamificationProfile = {
  level: number
  totalXp: number
  xpInLevel: number
  xpForNext: number
  coins: number
  streakDays: number
  /** Held streak savers, 0..2 (spec §6.2). */
  streakSavers: number
  activeTitleKey: string
  ownedShopTitleKeys: string[]
  /** Last day (local ISO date) that earned XP; null = seeded state (treated as yesterday). */
  lastActiveDate: string | null
  /** Per-day award counters for the daily caps (spec §5.1). */
  dayCounters: { date: string; counts: Partial<Record<XpEventType, number>> }
}

export type Title = {
  key: string
  name: string
  kind: 'LADDER' | 'SHOP'
  unlockLevel?: number
  priceCoins?: number
  owned: boolean
  equipped: boolean
}
```

- [ ] **Step 2: Write the failing test**

```ts
// frontend/src/data/gamification/xpValues.test.ts
import { DAILY_CAPS, XP_VALUES, xpForEvent } from '@/data/gamification/xpValues'

test('flat XP values match the spec table', () => {
  expect(XP_VALUES.MEAL).toBe(10)
  expect(XP_VALUES.MEDICATION).toBe(5)
  expect(XP_VALUES.GYM).toBe(40)
  expect(XP_VALUES.RUN).toBe(30)
})

test('xpForEvent returns 0 once the daily cap is reached', () => {
  expect(xpForEvent('WEIGHT', 0)).toBe(10)
  expect(xpForEvent('WEIGHT', DAILY_CAPS.WEIGHT)).toBe(0)
  expect(xpForEvent('MEAL', 4)).toBe(10)
  expect(xpForEvent('MEAL', 5)).toBe(0)
})

test('xpOverride wins for QUEST/ACTIVITY style events but caps still apply', () => {
  expect(xpForEvent('ACTIVITY', 0, 15)).toBe(15)
  expect(xpForEvent('QUEST', 0, 25)).toBe(25)
  expect(xpForEvent('ACTIVITY', DAILY_CAPS.ACTIVITY, 15)).toBe(0)
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/data/gamification/xpValues.test.ts`
Expected: FAIL — cannot resolve `@/data/gamification/xpValues`.

- [ ] **Step 4: Write the implementation**

```ts
// frontend/src/data/gamification/xpValues.ts
import type { XpEventType } from '@/data/gamification/gamificationTypes'

/** Flat XP per log event (spec §5.1). QUEST/ACTIVITY carry their own XP via xpOverride. */
export const XP_VALUES: Record<XpEventType, number> = {
  MEAL: 10, WEIGHT: 10, SLEEP: 10, CHECKIN: 10, MEDICATION: 5,
  GYM: 40, RUN: 30, SPORT: 30, QUEST: 0, ACTIVITY: 0,
}

/** Daily award caps — farming guard (spec §5.1). Counter resets at local midnight. */
export const DAILY_CAPS: Record<XpEventType, number> = {
  MEAL: 5, WEIGHT: 1, SLEEP: 1, CHECKIN: 1, MEDICATION: 3,
  GYM: 1, RUN: 2, SPORT: 2, QUEST: 3, ACTIVITY: 10,
}

export function xpForEvent(type: XpEventType, countToday: number, xpOverride?: number): number {
  if (countToday >= DAILY_CAPS[type]) return 0
  return xpOverride ?? XP_VALUES[type]
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/data/gamification/xpValues.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/gamification/gamificationTypes.ts frontend/src/data/gamification/xpValues.ts frontend/src/data/gamification/xpValues.test.ts
git commit -m "feat(gamification): domain types + xp values with daily caps (mezo-k7rn)"
```

---

### Task 3: Title catalog + mock seed + ghost

**Files:**
- Create: `frontend/src/data/gamification/titleCatalog.ts`
- Create: `frontend/src/data/gamification/gamificationMock.ts`
- Test: `frontend/src/data/gamification/titleCatalog.test.ts`

**Interfaces:**
- Consumes: `GamificationProfile` (Task 2).
- Produces:
  - `TitleDef = { key: string; name: string; kind: 'LADDER'|'SHOP'; unlockLevel?: number; priceCoins?: number }`
  - `TITLE_CATALOG: TitleDef[]` (9 ladder + 7 shop), `DEFAULT_TITLE_KEY = 'ujonc'`
  - `gamificationProfileMock: GamificationProfile`, `GHOST_GAMIFICATION: GamificationProfile`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/data/gamification/titleCatalog.test.ts
import { DEFAULT_TITLE_KEY, TITLE_CATALOG } from '@/data/gamification/titleCatalog'
import { GHOST_GAMIFICATION, gamificationProfileMock } from '@/data/gamification/gamificationMock'
import { levelFromTotalXp } from '@/data/gamification/levelCurve'

test('catalog: 9 ladder titles ascending, 7 priced shop titles, unique keys', () => {
  const ladder = TITLE_CATALOG.filter((t) => t.kind === 'LADDER')
  const shop = TITLE_CATALOG.filter((t) => t.kind === 'SHOP')
  expect(ladder).toHaveLength(9)
  expect(shop).toHaveLength(7)
  expect(new Set(TITLE_CATALOG.map((t) => t.key)).size).toBe(16)
  const levels = ladder.map((t) => t.unlockLevel!)
  expect(levels).toEqual([...levels].sort((a, b) => a - b))
  expect(shop.every((t) => (t.priceCoins ?? 0) > 0)).toBe(true)
  expect(TITLE_CATALOG.some((t) => t.key === DEFAULT_TITLE_KEY && t.unlockLevel === 1)).toBe(true)
})

test('mock seed is internally consistent with the level curve', () => {
  const { level, xpInLevel, xpForNext } = levelFromTotalXp(gamificationProfileMock.totalXp)
  expect(gamificationProfileMock.level).toBe(level)
  expect(gamificationProfileMock.xpInLevel).toBe(xpInLevel)
  expect(gamificationProfileMock.xpForNext).toBe(xpForNext)
  expect(GHOST_GAMIFICATION.level).toBe(1)
  expect(GHOST_GAMIFICATION.coins).toBe(0)
  expect(GHOST_GAMIFICATION.activeTitleKey).toBe(DEFAULT_TITLE_KEY)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/data/gamification/titleCatalog.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write both implementations**

```ts
// frontend/src/data/gamification/titleCatalog.ts
/** Static title catalog (spec §7, MIX tone: serious ladder / playful shop). */
export type TitleDef = {
  key: string
  name: string
  kind: 'LADDER' | 'SHOP'
  unlockLevel?: number
  priceCoins?: number
}

export const DEFAULT_TITLE_KEY = 'ujonc'

export const TITLE_CATALOG: TitleDef[] = [
  { key: 'ujonc', name: 'Az Újonc', kind: 'LADDER', unlockLevel: 1 },
  { key: 'lendulet', name: 'A Lendület', kind: 'LADDER', unlockLevel: 3 },
  { key: 'kovetkezetes', name: 'A Következetes', kind: 'LADDER', unlockLevel: 5 },
  { key: 'hajnalmadar', name: 'A Hajnalmadár', kind: 'LADDER', unlockLevel: 8 },
  { key: 'fegyelmezett', name: 'A Fegyelmezett', kind: 'LADDER', unlockLevel: 12 },
  { key: 'vasakarat', name: 'A Vasakarat', kind: 'LADDER', unlockLevel: 16 },
  { key: 'merfoldko', name: 'A Mérföldkő', kind: 'LADDER', unlockLevel: 20 },
  { key: 'gepezet', name: 'A Gépezet', kind: 'LADDER', unlockLevel: 25 },
  { key: 'legenda', name: 'A Legenda', kind: 'LADDER', unlockLevel: 30 },
  { key: 'kezdo-kanal', name: 'Kezdő Kanál', kind: 'SHOP', priceCoins: 100 },
  { key: 'csirkemell-csodaja', name: 'Csirkemell Csodája', kind: 'SHOP', priceCoins: 150 },
  { key: 'kardio-kapitany', name: 'Kardió Kapitány', kind: 'SHOP', priceCoins: 240 },
  { key: 'szenhidrat-szelidito', name: 'Szénhidrát Szelídítő', kind: 'SHOP', priceCoins: 240 },
  { key: 'protein-profeta', name: 'Protein Próféta', kind: 'SHOP', priceCoins: 400 },
  { key: 'bicepsz-baro', name: 'Bicepsz Báró', kind: 'SHOP', priceCoins: 400 },
  { key: 'gainz-nagyur', name: 'Gainz Nagyúr', kind: 'SHOP', priceCoins: 600 },
]
```

```ts
// frontend/src/data/gamification/gamificationMock.ts
import type { GamificationProfile } from '@/data/gamification/gamificationTypes'
import { DEFAULT_TITLE_KEY } from '@/data/gamification/titleCatalog'

/** Seed: Lv 12 (3 080 cumulative + 60), one log away from the 7-day streak milestone. */
export const gamificationProfileMock: GamificationProfile = {
  level: 12,
  totalXp: 3140,
  xpInLevel: 60,
  xpForNext: 520,
  coins: 240,
  streakDays: 6,
  streakSavers: 1,
  activeTitleKey: 'fegyelmezett',
  ownedShopTitleKeys: [],
  lastActiveDate: null,
  dayCounters: { date: '', counts: {} },
}

/** Real-mode empty (dual-mode invariant): never the mock seed. */
export const GHOST_GAMIFICATION: GamificationProfile = {
  level: 1,
  totalXp: 0,
  xpInLevel: 0,
  xpForNext: 80,
  coins: 0,
  streakDays: 0,
  streakSavers: 0,
  activeTitleKey: DEFAULT_TITLE_KEY,
  ownedShopTitleKeys: [],
  lastActiveDate: null,
  dayCounters: { date: '', counts: {} },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/data/gamification/titleCatalog.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/gamification/titleCatalog.ts frontend/src/data/gamification/gamificationMock.ts frontend/src/data/gamification/titleCatalog.test.ts
git commit -m "feat(gamification): title catalog + mock seed + ghost (mezo-k7rn)"
```

---

### Task 4: Award engine (`awardGamificationEvent`)

**Files:**
- Create: `frontend/src/data/gamification/gamificationStore.ts`
- Test: `frontend/src/data/gamification/gamificationStore.test.ts`

**Interfaces:**
- Consumes: `levelFromTotalXp` (T1), `xpForEvent` (T2), `gamificationProfileMock` (T3), `emitToast`/`onToast` from `@/shared/lib/toastBus`, `localDateString` from `@/shared/lib/dates`, `QueryClient` from `@tanstack/react-query`.
- Produces (used by Tasks 5, 7, 10):
  - `GAMIFICATION_KEY = ['gamification'] as const`
  - `SAVER_PRICE = 200`, `MAX_SAVERS = 2`, `LEVEL_UP_COINS = 50`, `STREAK_MILESTONE_COINS: Record<number, number>`
  - `awardGamificationEvent(qc: QueryClient, event: { type: XpEventType; date?: string; xpOverride?: number }): { xpAwarded: number; coinsAwarded: number; leveledUp: boolean; newLevel: number }`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/data/gamification/gamificationStore.test.ts
import { QueryClient } from '@tanstack/react-query'
import {
  GAMIFICATION_KEY,
  awardGamificationEvent,
} from '@/data/gamification/gamificationStore'
import { gamificationProfileMock } from '@/data/gamification/gamificationMock'
import type { GamificationProfile } from '@/data/gamification/gamificationTypes'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'

const D = '2026-07-18'
const qcWith = (patch: Partial<GamificationProfile> = {}) => {
  const qc = new QueryClient()
  qc.setQueryData(GAMIFICATION_KEY, { ...gamificationProfileMock, ...patch })
  return qc
}
const profile = (qc: QueryClient) => qc.getQueryData<GamificationProfile>(GAMIFICATION_KEY)!

test('awards flat XP and counts the event', () => {
  const qc = qcWith({ lastActiveDate: D }) // same-day: isolate XP from streak logic
  const res = awardGamificationEvent(qc, { type: 'WEIGHT', date: D })
  expect(res.xpAwarded).toBe(10)
  expect(profile(qc).totalXp).toBe(3150)
  expect(profile(qc).dayCounters).toEqual({ date: D, counts: { WEIGHT: 1 } })
})

test('daily cap: second WEIGHT the same day earns nothing', () => {
  const qc = qcWith({ lastActiveDate: D })
  awardGamificationEvent(qc, { type: 'WEIGHT', date: D })
  const res = awardGamificationEvent(qc, { type: 'WEIGHT', date: D })
  expect(res.xpAwarded).toBe(0)
  expect(profile(qc).totalXp).toBe(3150)
})

test('level-up grants +50 coins and toasts the new level', () => {
  const toasts: ToastMessage[] = []
  const off = onToast((t) => toasts.push(t))
  const qc = qcWith({ level: 12, totalXp: 3595, xpInLevel: 515, xpForNext: 520, lastActiveDate: D })
  const res = awardGamificationEvent(qc, { type: 'MEAL', date: D })
  off()
  expect(res.leveledUp).toBe(true)
  expect(res.newLevel).toBe(13)
  expect(profile(qc).coins).toBe(240 + 50)
  expect(toasts.at(-1)).toEqual({ kind: 'success', text: '🎉 Szint 13 — +50 🪙' })
})

test('streak: continues from yesterday and pays the 7-day milestone once', () => {
  const qc = qcWith({ lastActiveDate: '2026-07-17', streakDays: 6 })
  awardGamificationEvent(qc, { type: 'SLEEP', date: D })
  expect(profile(qc).streakDays).toBe(7)
  expect(profile(qc).coins).toBe(240 + 50) // 7-day milestone
  awardGamificationEvent(qc, { type: 'MEAL', date: D }) // same day: no double count
  expect(profile(qc).streakDays).toBe(7)
  expect(profile(qc).coins).toBe(240 + 50)
})

test('seeded lastActiveDate=null counts as yesterday', () => {
  const qc = qcWith() // seed: streakDays 6, lastActiveDate null
  awardGamificationEvent(qc, { type: 'WEIGHT', date: D })
  expect(profile(qc).streakDays).toBe(7)
})

test('one missed day + a saver: saver is consumed, streak survives', () => {
  const qc = qcWith({ lastActiveDate: '2026-07-16', streakDays: 9, streakSavers: 1 })
  awardGamificationEvent(qc, { type: 'MEAL', date: D })
  expect(profile(qc).streakDays).toBe(10)
  expect(profile(qc).streakSavers).toBe(0)
})

test('missed days without saver reset the streak to 1', () => {
  const qc = qcWith({ lastActiveDate: '2026-07-14', streakDays: 9, streakSavers: 2 })
  awardGamificationEvent(qc, { type: 'MEAL', date: D })
  expect(profile(qc).streakDays).toBe(1)
  expect(profile(qc).streakSavers).toBe(2) // saver only bridges exactly one missed day
})

test('a capped (0 XP) event does not touch the streak', () => {
  const qc = qcWith({ lastActiveDate: '2026-07-17', streakDays: 6 })
  awardGamificationEvent(qc, { type: 'WEIGHT', date: D })
  awardGamificationEvent(qc, { type: 'WEIGHT', date: D }) // capped
  expect(profile(qc).dayCounters.counts.WEIGHT).toBe(2)
  expect(profile(qc).streakDays).toBe(7)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/data/gamification/gamificationStore.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/src/data/gamification/gamificationStore.ts
import type { QueryClient } from '@tanstack/react-query'
import { levelFromTotalXp } from '@/data/gamification/levelCurve'
import { gamificationProfileMock } from '@/data/gamification/gamificationMock'
import type { GamificationProfile, XpEventType } from '@/data/gamification/gamificationTypes'
import { xpForEvent } from '@/data/gamification/xpValues'
import { localDateString } from '@/shared/lib/dates'
import { emitToast } from '@/shared/lib/toastBus'

export const GAMIFICATION_KEY = ['gamification'] as const
export const SAVER_PRICE = 200
export const MAX_SAVERS = 2
export const LEVEL_UP_COINS = 50
export const STREAK_MILESTONE_COINS: Record<number, number> = { 7: 50, 30: 150, 100: 500 }

export type AwardResult = {
  xpAwarded: number
  coinsAwarded: number
  leveledUp: boolean
  newLevel: number
}

const dayDiff = (fromIso: string, toIso: string): number =>
  Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000)

/** Mock-mode account progression: XP (capped), daily streak (+saver), coins, level-ups.
 *  Called from the mock arms of every logging mutation (spec §4.3). Emits ONE toast per
 *  award — level-up > streak milestone > saver notice > plain XP. Real mode never calls
 *  this; the backend will award server-side (mezo-huzd). */
export function awardGamificationEvent(
  qc: QueryClient,
  event: { type: XpEventType; date?: string; xpOverride?: number },
): AwardResult {
  const today = event.date ?? localDateString()
  const prev = qc.getQueryData<GamificationProfile>(GAMIFICATION_KEY) ?? gamificationProfileMock

  const counters = prev.dayCounters.date === today ? prev.dayCounters.counts : {}
  const countToday = counters[event.type] ?? 0
  const xp = xpForEvent(event.type, countToday, event.xpOverride)

  let next: GamificationProfile = {
    ...prev,
    dayCounters: { date: today, counts: { ...counters, [event.type]: countToday + 1 } },
  }

  if (xp === 0) {
    qc.setQueryData(GAMIFICATION_KEY, next)
    return { xpAwarded: 0, coinsAwarded: 0, leveledUp: false, newLevel: next.level }
  }

  let coinsAwarded = 0
  let milestone = 0
  let saverUsed = false
  if (next.lastActiveDate !== today) {
    const gap = next.lastActiveDate == null ? 1 : dayDiff(next.lastActiveDate, today)
    if (gap === 1) {
      next = { ...next, streakDays: next.streakDays + 1 }
    } else if (gap === 2 && next.streakSavers > 0) {
      next = { ...next, streakDays: next.streakDays + 1, streakSavers: next.streakSavers - 1 }
      saverUsed = true
    } else {
      next = { ...next, streakDays: 1 }
    }
    next = { ...next, lastActiveDate: today }
    milestone = STREAK_MILESTONE_COINS[next.streakDays] ?? 0
    coinsAwarded += milestone
  }

  const totalXp = next.totalXp + xp
  const { level, xpInLevel, xpForNext } = levelFromTotalXp(totalXp)
  const leveledUp = level > next.level
  if (leveledUp) coinsAwarded += LEVEL_UP_COINS

  next = { ...next, totalXp, level, xpInLevel, xpForNext, coins: next.coins + coinsAwarded }
  qc.setQueryData(GAMIFICATION_KEY, next)

  if (leveledUp) emitToast({ kind: 'success', text: `🎉 Szint ${level} — +${LEVEL_UP_COINS} 🪙` })
  else if (milestone > 0)
    emitToast({ kind: 'success', text: `🔥 ${next.streakDays} napos sorozat — +${milestone} 🪙` })
  else if (saverUsed)
    emitToast({ kind: 'info', text: '🧊 Streak-mentő elhasználva — a sorozat megmaradt' })
  else emitToast({ kind: 'success', text: `+${xp} XP` })

  return { xpAwarded: xp, coinsAwarded, leveledUp, newLevel: level }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/data/gamification/gamificationStore.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/gamification/gamificationStore.ts frontend/src/data/gamification/gamificationStore.test.ts
git commit -m "feat(gamification): award engine — xp, coins, streak, level-up (mezo-k7rn)"
```

---

### Task 5: Dual-mode hooks + barrel export

**Files:**
- Create: `frontend/src/data/gamification/gamificationApi.ts`
- Create: `frontend/src/data/gamification/gamificationHooks.ts`
- Modify: `frontend/src/data/hooks.ts` (append one line)
- Test: `frontend/src/data/gamification/gamificationHooks.test.tsx`

**Interfaces:**
- Consumes: T1–T4 exports; `useDualQuery` (`@/data/useDualQuery`); `progressionApi` + `ProgressionProfileResponse` (`@/data/progression/progressionApi`); `ApiError` (`@/data/_client/api`); `isMockMode` (`@/data/_client/mode`).
- Produces (used by Tasks 6–8):
  - `fetchDerivedGamification(): Promise<GamificationProfile>`
  - `useGamification(): { profile: GamificationProfile; isPending: boolean }`
  - `useTitles(): { titles: Title[] }`
  - `useGamificationActions(): { buyTitle(key: string): void; equipTitle(key: string): void; buyStreakSaver(): void; canMutate: boolean }`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/data/gamification/gamificationHooks.test.tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import {
  useGamification,
  useGamificationActions,
  useTitles,
} from '@/data/gamification/gamificationHooks'
import { makeHookWrapper } from '@/test/queryWrapper'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'

afterEach(() => vi.unstubAllEnvs())

describe('mock mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('profile seeds synchronously from the mock', () => {
    const { result } = renderHook(() => useGamification(), { wrapper: makeHookWrapper() })
    expect(result.current.profile.level).toBe(12)
    expect(result.current.profile.coins).toBe(240)
  })

  test('titles derive owned/equipped from the profile', () => {
    const { result } = renderHook(() => useTitles(), { wrapper: makeHookWrapper() })
    const byKey = Object.fromEntries(result.current.titles.map((t) => [t.key, t]))
    expect(byKey['fegyelmezett']).toMatchObject({ owned: true, equipped: true }) // Lv 12
    expect(byKey['vasakarat'].owned).toBe(false) // Lv 16 locked
    expect(byKey['csirkemell-csodaja'].owned).toBe(false) // shop, not bought
  })

  test('buyTitle deducts coins, owns and auto-equips; insufficient coins is a no-op', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(
      () => ({ g: useGamification(), t: useTitles(), a: useGamificationActions() }),
      { wrapper },
    )
    act(() => result.current.a.buyTitle('gainz-nagyur')) // 600 > 240
    expect(result.current.g.profile.coins).toBe(240)
    act(() => result.current.a.buyTitle('csirkemell-csodaja')) // 150
    await waitFor(() => expect(result.current.g.profile.coins).toBe(90))
    expect(result.current.g.profile.ownedShopTitleKeys).toContain('csirkemell-csodaja')
    expect(result.current.g.profile.activeTitleKey).toBe('csirkemell-csodaja')
    act(() => result.current.a.equipTitle('fegyelmezett'))
    await waitFor(() => expect(result.current.g.profile.activeTitleKey).toBe('fegyelmezett'))
  })

  test('buyStreakSaver caps at 2 and needs 200 coins', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(
      () => ({ g: useGamification(), a: useGamificationActions() }),
      { wrapper },
    )
    act(() => result.current.a.buyStreakSaver()) // 240 → 40, savers 1 → 2
    await waitFor(() => expect(result.current.g.profile.streakSavers).toBe(2))
    expect(result.current.g.profile.coins).toBe(40)
    act(() => result.current.a.buyStreakSaver()) // savers already max → no-op
    expect(result.current.g.profile.coins).toBe(40)
  })
})

describe('real mode (interim derivation, spec §8)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('derives level from Σ cumulativeXp of the real progression profile', async () => {
    server.use(
      http.get(`${API_BASE}/api/progression/profile`, () =>
        HttpResponse.json({
          athleteLevel: 3, streakWeeks: 2, savingsHuf30d: null, radarAxes: [], highlights: {},
          traits: { disciplinePct: null, consistencyWeeks: 2 },
          athletic: [{ skillKey: 'squat', kind: 'ATHLETIC', level: 3, cumulativeXp: 500, progressPct: 50 }],
          muscle: [],
          life: [{ skillKey: 'learning', kind: 'LIFE', level: 1, cumulativeXp: 60, progressPct: 75 }],
        }),
      ),
    )
    const { result } = renderHook(() => useGamification(), { wrapper: makeHookWrapper() })
    expect(result.current.profile.level).toBe(1) // realEmpty ghost while loading
    await waitFor(() => expect(result.current.profile.level).toBe(5)) // 560 XP
    expect(result.current.profile.totalXp).toBe(560)
    expect(result.current.profile.coins).toBe(0) // coins stay ghost until backend
  })

  test('actions are disabled (canMutate=false) and no-op', () => {
    const { result } = renderHook(() => useGamificationActions(), { wrapper: makeHookWrapper() })
    expect(result.current.canMutate).toBe(false)
  })

  test('404 → ghost profile', async () => {
    server.use(
      http.get(`${API_BASE}/api/progression/profile`, () =>
        HttpResponse.json({ message: 'not found' }, { status: 404 }),
      ),
    )
    const { result } = renderHook(() => useGamification(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.profile.level).toBe(1)
    expect(result.current.profile.totalXp).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/data/gamification/gamificationHooks.test.tsx`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write the implementations**

```ts
// frontend/src/data/gamification/gamificationApi.ts
import { ApiError } from '@/data/_client/api'
import { levelFromTotalXp } from '@/data/gamification/levelCurve'
import { GHOST_GAMIFICATION } from '@/data/gamification/gamificationMock'
import type { GamificationProfile } from '@/data/gamification/gamificationTypes'
import { progressionApi, type ProgressionProfileResponse } from '@/data/progression/progressionApi'

/** Real-mode interim (spec §8, until mezo-huzd): account XP/level derived from the real
 *  progression profile (Σ cumulativeXp over every skill); coins/streak/titles stay ghost.
 *  Mirrors the sanctioned useProfile static exception (mezo-lfw): documented, temporary. */
export async function fetchDerivedGamification(): Promise<GamificationProfile> {
  let p: ProgressionProfileResponse
  try {
    p = await progressionApi.getProfile()
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return GHOST_GAMIFICATION
    throw err
  }
  const totalXp = [...p.athletic, ...p.muscle, ...p.life].reduce((s, x) => s + x.cumulativeXp, 0)
  const { level, xpInLevel, xpForNext } = levelFromTotalXp(totalXp)
  return { ...GHOST_GAMIFICATION, level, totalXp, xpInLevel, xpForNext }
}
```

```ts
// frontend/src/data/gamification/gamificationHooks.ts
import { useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { fetchDerivedGamification } from '@/data/gamification/gamificationApi'
import { GHOST_GAMIFICATION, gamificationProfileMock } from '@/data/gamification/gamificationMock'
import {
  GAMIFICATION_KEY,
  MAX_SAVERS,
  SAVER_PRICE,
} from '@/data/gamification/gamificationStore'
import type { GamificationProfile, Title } from '@/data/gamification/gamificationTypes'
import { TITLE_CATALOG } from '@/data/gamification/titleCatalog'
import { useDualQuery } from '@/data/useDualQuery'

export function useGamification(): { profile: GamificationProfile; isPending: boolean } {
  const { data, isPending } = useDualQuery<GamificationProfile>({
    queryKey: [...GAMIFICATION_KEY],
    mockData: gamificationProfileMock,
    realFetch: fetchDerivedGamification,
    realEmpty: GHOST_GAMIFICATION,
    realStaleTime: 60_000,
  })
  return { profile: data, isPending }
}

export function useTitles(): { titles: Title[] } {
  const { profile } = useGamification()
  const titles = TITLE_CATALOG.map((t) => ({
    ...t,
    owned:
      t.kind === 'LADDER'
        ? profile.level >= (t.unlockLevel ?? 1)
        : profile.ownedShopTitleKeys.includes(t.key),
    equipped: t.key === profile.activeTitleKey,
  }))
  return { titles }
}

/** Mock-only mutations (spec §8: real mode disabled until mezo-huzd). buyTitle auto-equips. */
export function useGamificationActions(): {
  buyTitle: (key: string) => void
  equipTitle: (key: string) => void
  buyStreakSaver: () => void
  canMutate: boolean
} {
  const qc = useQueryClient()
  const mock = isMockMode()
  const patch = (fn: (p: GamificationProfile) => GamificationProfile) => {
    if (!mock) return
    qc.setQueryData<GamificationProfile>(GAMIFICATION_KEY, (p) =>
      fn(p ?? gamificationProfileMock),
    )
  }
  return {
    canMutate: mock,
    buyTitle: (key) =>
      patch((p) => {
        const t = TITLE_CATALOG.find((x) => x.key === key)
        if (!t || t.kind !== 'SHOP' || p.ownedShopTitleKeys.includes(key)) return p
        if (p.coins < (t.priceCoins ?? 0)) return p
        return {
          ...p,
          coins: p.coins - (t.priceCoins ?? 0),
          ownedShopTitleKeys: [...p.ownedShopTitleKeys, key],
          activeTitleKey: key,
        }
      }),
    equipTitle: (key) =>
      patch((p) => {
        const t = TITLE_CATALOG.find((x) => x.key === key)
        if (!t) return p
        const owned =
          t.kind === 'LADDER' ? p.level >= (t.unlockLevel ?? 1) : p.ownedShopTitleKeys.includes(key)
        return owned ? { ...p, activeTitleKey: key } : p
      }),
    buyStreakSaver: () =>
      patch((p) =>
        p.coins >= SAVER_PRICE && p.streakSavers < MAX_SAVERS
          ? { ...p, coins: p.coins - SAVER_PRICE, streakSavers: p.streakSavers + 1 }
          : p,
      ),
  }
}
```

- [ ] **Step 4: Append to the barrel** — `frontend/src/data/hooks.ts`, after the activity line:

```ts
export { useGamification, useTitles, useGamificationActions } from '@/data/gamification/gamificationHooks'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/data/gamification/`
Expected: PASS (all gamification test files).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/gamification/ frontend/src/data/hooks.ts
git commit -m "feat(gamification): dual-mode hooks + barrel exports (mezo-k7rn)"
```

---

### Task 6: TitleShopSheet

**Files:**
- Create: `frontend/src/features/progression/sheets/TitleShopSheet.tsx`
- Test: `frontend/src/features/progression/sheets/TitleShopSheet.test.tsx`

**Interfaces:**
- Consumes: `useGamification`, `useTitles`, `useGamificationActions` from `@/data/hooks`; `SAVER_PRICE`, `MAX_SAVERS` from `@/data/gamification/gamificationStore`; `Sheet` from `@/shared/ui/Sheet` (props: `children | (close)=>ReactNode`, `onClose`, `labelledBy` — NO `open` prop, opener conditionally mounts); `cn` from `@/shared/lib/cn`.
- Produces: `TitleShopSheet({ onClose }: { onClose: () => void })` — used by Task 8.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/progression/sheets/TitleShopSheet.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TitleShopSheet } from '@/features/progression/sheets/TitleShopSheet'
import { QueryWrapper } from '@/test/queryWrapper'

afterEach(() => vi.unstubAllEnvs())
const renderSheet = () =>
  render(
    <QueryWrapper>
      <TitleShopSheet onClose={() => {}} />
    </QueryWrapper>,
  )

describe('mock mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('ladder segment: unlocked titles equipable, locked ones marked', () => {
    renderSheet()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('🪙 240')).toBeInTheDocument()
    expect(screen.getByText('A Fegyelmezett')).toBeInTheDocument()
    expect(screen.getByText('Viselve')).toBeInTheDocument() // equipped seed title
    expect(screen.getByText('A Vasakarat')).toBeInTheDocument() // Lv 16 → locked 🔒
  })

  test('shop segment: buy flow deducts coins and equips', async () => {
    renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Bolt' }))
    const row = screen.getByText('Csirkemell Csodája').closest('.row') as HTMLElement
    await userEvent.click(within(row).getByRole('button', { name: 'Megveszem' }))
    await waitFor(() => expect(screen.getByText('🪙 90')).toBeInTheDocument())
    // Gainz Nagyúr (600) is now unaffordable → its buy button is disabled
    const gainz = screen.getByText('Gainz Nagyúr').closest('.row') as HTMLElement
    expect(within(gainz).getByRole('button', { name: 'Megveszem' })).toBeDisabled()
  })

  test('shop segment sells the streak saver', async () => {
    renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Bolt' }))
    expect(screen.getByText('🧊 Streak-mentő')).toBeInTheDocument()
    expect(screen.getByText(/nálad: 1\/2/)).toBeInTheDocument()
  })
})

describe('real mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('shop segment shows the backend-coming empty state', async () => {
    renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Bolt' }))
    expect(screen.getByText('A bolt a backend-szelettel érkezik.')).toBeInTheDocument()
  })
})
```

Add `import { within } from '@testing-library/react'` (merge into the existing import).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/progression/sheets/TitleShopSheet.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/features/progression/sheets/TitleShopSheet.tsx
import { useState } from 'react'
import { useGamification, useGamificationActions, useTitles } from '@/data/hooks'
import { MAX_SAVERS, SAVER_PRICE } from '@/data/gamification/gamificationStore'
import type { Title } from '@/data/gamification/gamificationTypes'
import { cn } from '@/shared/lib/cn'
import { Sheet } from '@/shared/ui/Sheet'

function TitleRow({ t, coins, canMutate, onBuy, onEquip }: {
  t: Title
  coins: number
  canMutate: boolean
  onBuy: (key: string) => void
  onEquip: (key: string) => void
}) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 13, color: t.owned ? 'var(--ink)' : 'var(--faint)' }}>
          {t.name}
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--faint)' }}>
          {t.kind === 'LADDER' ? `LV ${t.unlockLevel}` : `🪙 ${t.priceCoins}`}
        </div>
      </div>
      {t.equipped ? (
        <span className="chip brand">Viselve</span>
      ) : t.owned ? (
        <button type="button" className="chip np-press" disabled={!canMutate} onClick={() => onEquip(t.key)}>
          Felvesz
        </button>
      ) : t.kind === 'SHOP' ? (
        <button
          type="button"
          className="chip np-press"
          disabled={!canMutate || coins < (t.priceCoins ?? 0)}
          onClick={() => onBuy(t.key)}
        >
          Megveszem
        </button>
      ) : (
        <span className="chip" aria-label="Zárolva">🔒</span>
      )}
    </div>
  )
}

/** Title ladder + coin shop (spec §9). Opened from AppHero's title line / 🪙 chip. */
export function TitleShopSheet({ onClose }: { onClose: () => void }) {
  const [seg, setSeg] = useState<'ladder' | 'shop'>('ladder')
  const { profile } = useGamification()
  const { titles } = useTitles()
  const { buyTitle, equipTitle, buyStreakSaver, canMutate } = useGamificationActions()
  const shown = titles.filter((t) => (seg === 'ladder' ? t.kind === 'LADDER' : t.kind === 'SHOP'))
  return (
    <Sheet onClose={onClose} labelledBy="titleshop-title">
      <div className="col gap-md" style={{ padding: '4px 4px 8px' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="titleshop-title" className="h-display size-md">Title-ök</h2>
          <span className="chip">🪙 {profile.coins}</span>
        </div>
        <div className="row gap-sm">
          <button type="button" className={cn('chip np-press', seg === 'ladder' && 'brand')} onClick={() => setSeg('ladder')}>
            Létra
          </button>
          <button type="button" className={cn('chip np-press', seg === 'shop' && 'brand')} onClick={() => setSeg('shop')}>
            Bolt
          </button>
        </div>
        {seg === 'shop' && !canMutate ? (
          <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--sub)' }}>
            A bolt a backend-szelettel érkezik.
          </p>
        ) : (
          <div className="col gap-sm">
            {shown.map((t) => (
              <TitleRow key={t.key} t={t} coins={profile.coins} canMutate={canMutate} onBuy={buyTitle} onEquip={equipTitle} />
            ))}
            {seg === 'shop' && (
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>🧊 Streak-mentő</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--faint)' }}>
                    🪙 {SAVER_PRICE} · nálad: {profile.streakSavers}/{MAX_SAVERS}
                  </div>
                </div>
                <button
                  type="button"
                  className="chip np-press"
                  disabled={!canMutate || profile.coins < SAVER_PRICE || profile.streakSavers >= MAX_SAVERS}
                  onClick={buyStreakSaver}
                >
                  Megveszem
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/progression/sheets/TitleShopSheet.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/progression/sheets/
git commit -m "feat(progression): TitleShopSheet — ladder + coin shop + streak saver (mezo-k7rn)"
```

---

### Task 7: StreakSheet

**Files:**
- Create: `frontend/src/features/progression/sheets/StreakSheet.tsx`
- Test: `frontend/src/features/progression/sheets/StreakSheet.test.tsx`

**Interfaces:**
- Consumes: `useGamification`, `useGamificationActions` from `@/data/hooks`; `SAVER_PRICE`, `MAX_SAVERS`, `STREAK_MILESTONE_COINS` from `@/data/gamification/gamificationStore`; `Sheet`.
- Produces: `StreakSheet({ onClose }: { onClose: () => void })` — used by Task 8.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/progression/sheets/StreakSheet.test.tsx
import { render, screen } from '@testing-library/react'
import { StreakSheet } from '@/features/progression/sheets/StreakSheet'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('shows the streak, the next milestone and the saver stock', () => {
  render(
    <QueryWrapper>
      <StreakSheet onClose={() => {}} />
    </QueryWrapper>,
  )
  expect(screen.getByText('🔥 6 napos sorozat')).toBeInTheDocument()
  expect(screen.getByText('Következő mérföldkő: 7 nap — +50 🪙')).toBeInTheDocument()
  expect(screen.getByText(/nálad: 1\/2/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Megveszem' })).toBeEnabled() // 240 ≥ 200
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/progression/sheets/StreakSheet.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/src/features/progression/sheets/StreakSheet.tsx
import { useGamification, useGamificationActions } from '@/data/hooks'
import {
  MAX_SAVERS,
  SAVER_PRICE,
  STREAK_MILESTONE_COINS,
} from '@/data/gamification/gamificationStore'
import { Sheet } from '@/shared/ui/Sheet'

const MILESTONES = Object.keys(STREAK_MILESTONE_COINS).map(Number).sort((a, b) => a - b)

/** Daily-streak detail + saver purchase (spec §9). Opened from AppHero's 🔥 chip. */
export function StreakSheet({ onClose }: { onClose: () => void }) {
  const { profile } = useGamification()
  const { buyStreakSaver, canMutate } = useGamificationActions()
  const next = MILESTONES.find((m) => m > profile.streakDays)
  return (
    <Sheet onClose={onClose} labelledBy="streak-title">
      <div className="col gap-md" style={{ padding: '4px 4px 8px' }}>
        <h2 id="streak-title" className="h-display size-md">🔥 {profile.streakDays} napos sorozat</h2>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--coral-deep)' }}>
          {next != null
            ? `Következő mérföldkő: ${next} nap — +${STREAK_MILESTONE_COINS[next]} 🪙`
            : 'Minden mérföldkő megvan 💪'}
        </p>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--sub)' }}>
          A sorozatot bármilyen mai log életben tartja — étkezés, súly, alvás, edzés vagy quest.
          Ha kimarad egy nap, egy streak-mentő automatikusan megmenti.
        </p>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>🧊 Streak-mentő</div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--faint)' }}>
              🪙 {SAVER_PRICE} · nálad: {profile.streakSavers}/{MAX_SAVERS}
            </div>
          </div>
          <button
            type="button"
            className="chip np-press"
            disabled={!canMutate || profile.coins < SAVER_PRICE || profile.streakSavers >= MAX_SAVERS}
            onClick={buyStreakSaver}
          >
            Megveszem
          </button>
        </div>
      </div>
    </Sheet>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/progression/sheets/StreakSheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/progression/sheets/StreakSheet.tsx frontend/src/features/progression/sheets/StreakSheet.test.tsx
git commit -m "feat(progression): StreakSheet — milestones + saver purchase (mezo-k7rn)"
```

---

### Task 8: AppHero component + styles

**Files:**
- Create: `frontend/src/features/progression/components/AppHero.tsx`
- Modify: `frontend/src/styles/prototype.css` (append `.apphero` block at end of file)
- Test: `frontend/src/features/progression/components/AppHero.test.tsx`

**Interfaces:**
- Consumes: `useProfile`, `useGamification`, `useTitles`, `useDailyQuests` from `@/data/hooks`; `localDateString` from `@/shared/lib/dates`; `TitleShopSheet` (T6), `StreakSheet` (T7); `Link` from react-router.
- Produces: `AppHero({ utilities }: { utilities?: ReactNode })` — mounted by Task 9.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/progression/components/AppHero.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppHero } from '@/features/progression/components/AppHero'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderHero = (utilities?: React.ReactNode) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/today']}>
        <AppHero utilities={utilities} />
      </MemoryRouter>
    </QueryWrapper>,
  )

test('renders identity, level badge, equipped title and the three chips', () => {
  renderHero()
  expect(screen.getByText('Daniel')).toBeInTheDocument()
  expect(screen.getByText('A Fegyelmezett')).toBeInTheDocument()
  expect(screen.getByLabelText('Szint 12 — Growth')).toBeInTheDocument()
  expect(screen.getByText('🔥 6 nap')).toBeInTheDocument()
  expect(screen.getByText('⚡ 1/3 quest')).toBeInTheDocument() // mockQuestDay: 1 of 3 completed
  expect(screen.getByText('🪙 240')).toBeInTheDocument()
})

test('renders the per-tab utilities slot', () => {
  renderHero(<button aria-label="Keresés" />)
  expect(screen.getByLabelText('Keresés')).toBeInTheDocument()
})

test('🔥 chip opens the StreakSheet, 🪙 chip opens the TitleShopSheet', async () => {
  renderHero()
  await userEvent.click(screen.getByText('🔥 6 nap'))
  expect(await screen.findByText('🔥 6 napos sorozat')).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  await userEvent.click(screen.getByText('🪙 240'))
  expect(await screen.findByText('Title-ök')).toBeInTheDocument()
})

test('avatar links to /me, level badge and quest chip link to /me/growth', () => {
  renderHero()
  expect(screen.getByLabelText('Profil')).toHaveAttribute('href', '/me')
  expect(screen.getByLabelText('Szint 12 — Growth')).toHaveAttribute('href', '/me/growth')
  expect(screen.getByText('⚡ 1/3 quest')).toHaveAttribute('href', '/me/growth')
})
```

Note: if `mockQuestDay` completed-count differs, fix the expected `⚡ x/3 quest` string to the seed (count `status === 'completed'` entries in `data/quest/questMock.ts` — do NOT change the seed).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/progression/components/AppHero.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the component**

```tsx
// frontend/src/features/progression/components/AppHero.tsx
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useDailyQuests, useGamification, useProfile, useTitles } from '@/data/hooks'
import { StreakSheet } from '@/features/progression/sheets/StreakSheet'
import { TitleShopSheet } from '@/features/progression/sheets/TitleShopSheet'
import { localDateString } from '@/shared/lib/dates'

const RING_R = 28
const RING_C = 2 * Math.PI * RING_R

/** The unified identity header on all 4 main tabs (spec §3). Per-tab controls arrive
 *  via `utilities` (Today: search + Insights, Me: settings). */
export function AppHero({ utilities }: { utilities?: ReactNode }) {
  const { user } = useProfile()
  const { profile } = useGamification()
  const { titles } = useTitles()
  const { quests } = useDailyQuests(localDateString())
  const [sheet, setSheet] = useState<'titles' | 'streak' | null>(null)

  const initials = user.name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  const activeTitle = titles.find((t) => t.equipped)
  const done = quests.filter((q) => q.status === 'completed').length
  const progress = profile.xpForNext > 0 ? profile.xpInLevel / profile.xpForNext : 0

  return (
    <>
      <div className="apphero">
        {/* Two sibling links, not nested (invalid HTML): avatar → /me, level badge → /me/growth (spec §3.1). */}
        <div className="avwrap">
          <Link to="/me" className="avlink np-press" aria-label="Profil">
            <svg viewBox="0 0 62 62" width="62" height="62" aria-hidden="true">
              <circle cx="31" cy="31" r={RING_R} fill="none" stroke="var(--line)" strokeWidth="3.5" />
              <circle
                cx="31" cy="31" r={RING_R} fill="none" stroke="var(--coral)" strokeWidth="3.5"
                strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - progress)}
                transform="rotate(-90 31 31)"
              />
            </svg>
            <span className="avatar" aria-hidden="true">{initials}</span>
          </Link>
          <Link to="/me/growth" className="lvbadge np-press" aria-label={`Szint ${profile.level} — Growth`}>
            {profile.level}
          </Link>
        </div>
        <div>
          <Link to="/me" className="t1">{user.name}</Link>
          <button type="button" className="t2 np-press" onClick={() => setSheet('titles')}>
            {activeTitle?.name ?? ''}
          </button>
        </div>
        {utilities && <div className="util">{utilities}</div>}
      </div>
      <div className="apphero-chips">
        <button type="button" className="apphero-chip fire np-press" onClick={() => setSheet('streak')}>
          🔥 {profile.streakDays} nap
        </button>
        <Link to="/me/growth" className="apphero-chip quest np-press">
          ⚡ {done}/{quests.length} quest
        </Link>
        <button type="button" className="apphero-chip coin np-press" onClick={() => setSheet('titles')}>
          🪙 {profile.coins}
        </button>
      </div>
      {sheet === 'titles' && <TitleShopSheet onClose={() => setSheet(null)} />}
      {sheet === 'streak' && <StreakSheet onClose={() => setSheet(null)} />}
    </>
  )
}
```

- [ ] **Step 4: Append the CSS block** at the end of `frontend/src/styles/prototype.css`:

```css
/* ===== AppHero — unified gamified header on the 4 main tabs (mezo-k7rn) ===== */
.apphero { display: flex; align-items: center; gap: 12px; padding: 10px 24px 0; }
.apphero .avwrap { position: relative; width: 62px; height: 62px; flex-shrink: 0; }
.apphero .avlink { position: absolute; inset: 0; display: block; }
.apphero .avatar {
  position: absolute; inset: 6px; border-radius: 50%;
  background: linear-gradient(140deg, #EEEBF6, #E2DCF0); color: var(--lav-deep);
  font-family: var(--ff-display); font-weight: 800; font-size: 17px;
  display: flex; align-items: center; justify-content: center;
}
:root[data-theme="dark"] .apphero .avatar { background: linear-gradient(140deg, rgba(155,143,196,.25), rgba(122,109,168,.25)); }
.apphero .lvbadge {
  position: absolute; right: -3px; bottom: -3px; min-width: 22px; height: 22px;
  border-radius: 999px; background: var(--coral); color: #fff; font-size: 10.5px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; border: 2.5px solid var(--canvas);
  padding: 0 4px; font-family: var(--ff-display); text-decoration: none;
}
.apphero .t1 { display: block; font-family: var(--ff-display); font-size: 20px; font-weight: 800; letter-spacing: -.3px; color: var(--ink); text-decoration: none; }
.apphero .t2 { display: block; background: none; border: none; padding: 0; cursor: pointer; font-size: 11px; color: var(--lav-deep); font-weight: 800; margin-top: 1px; letter-spacing: .4px; text-transform: uppercase; text-align: left; font-family: var(--ff-body); }
.apphero .util { margin-left: auto; display: flex; gap: 7px; align-items: center; }
.apphero-chips { display: flex; gap: 6px; padding: 10px 24px 0; flex-wrap: wrap; }
.apphero-chip {
  display: inline-flex; align-items: center; gap: 4px; background: var(--surface);
  border-radius: 999px; padding: 5px 10px; font-size: 11px; font-weight: 800;
  box-shadow: var(--np-shadow-row); border: none; color: var(--ink);
  text-decoration: none; cursor: pointer; font-family: var(--ff-body);
}
.apphero-chip.fire { color: var(--amber-deep); }
.apphero-chip.quest { color: var(--coral-deep); }
.apphero-chip.coin { color: var(--sage-deep); }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/features/progression/components/AppHero.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/progression/components/ frontend/src/styles/prototype.css
git commit -m "feat(progression): AppHero — avatar XP ring, title, streak/quest/coin chips (mezo-k7rn)"
```

---

### Task 9: Mount AppHero on all 4 tabs; retire BrandRow + MeHead

**Files:**
- Modify: `frontend/src/features/today/pages/TodayPage.tsx:32-36` (replace `<BrandRow />`)
- Modify: `frontend/src/features/train/pages/TrainSection.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelSection.tsx`
- Modify: `frontend/src/features/me/pages/MeSection.tsx` (replace `<MeHead …/>`)
- Modify: `frontend/src/features/me/pages/ProfilePage.tsx` (insert `<MeBioRow />` first in the card column)
- Modify: `frontend/src/features/me/pages/MeSection.test.tsx` (`.mehead` → `.apphero` assertion)
- Create: `frontend/src/features/me/components/MeBioRow.tsx` + `MeBioRow.test.tsx`
- Create: `frontend/src/features/progression/components/appHeroMount.test.tsx`
- Delete: `frontend/src/features/today/components/BrandRow.tsx`, `frontend/src/features/today/components/topSections.test.tsx`, `frontend/src/features/me/components/MeHead.tsx`, `frontend/src/features/me/components/MeHead.test.tsx`

**Interfaces:**
- Consumes: `AppHero` (T8); `Icon` from `@/shared/ui/Icon` (names `search`, `sparkle`, `settings` exist); `SettingsSheet` (existing); `useBiometricProfile`, `useWeight` from `@/data/hooks`; `ageFromBirthDate` from `@/features/me/logic/biometricFields`; `hu1` from `@/shared/lib/huNum`.
- Produces: hero visible on `/today`, `/train/*`, `/fuel/*`, `/me/*`; NOT on `/insights/*`.

- [ ] **Step 1: Write the failing mount test**

```tsx
// frontend/src/features/progression/components/appHeroMount.test.tsx
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test.each(['/today', '/train', '/fuel', '/me'])('AppHero renders on %s', (path) => {
  renderAt(path)
  expect(document.querySelector('.apphero')).toBeInTheDocument()
})

test('AppHero does NOT render on /insights', () => {
  renderAt('/insights')
  expect(document.querySelector('.apphero')).not.toBeInTheDocument()
})

test('the Insights entry point survives on /today', () => {
  renderAt('/today')
  expect(document.querySelector('a[aria-label="Insights"]')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/features/progression/components/appHeroMount.test.tsx`
Expected: FAIL — `.apphero` not found (not mounted yet).

- [ ] **Step 3: Mount on Today.** In `TodayPage.tsx`: remove the `BrandRow` import; add imports; replace `<BrandRow />` with:

```tsx
import { Link } from 'react-router-dom'   // add if missing
import { AppHero } from '@/features/progression/components/AppHero'
import { Icon } from '@/shared/ui/Icon'
```

```tsx
<AppHero
  utilities={
    <>
      <button className="chip" aria-label="Keresés"><Icon name="search" size={12} /></button>
      <Link to="/insights" aria-label="Insights" className="icon-btn"><Icon name="sparkle" size={18} /></Link>
    </>
  }
/>
```

`<GreetingHeader …/>` and everything below stays unchanged.

- [ ] **Step 4: Mount on Train + Fuel.** In both `TrainSection.tsx` and `FuelSection.tsx`, add `import { AppHero } from '@/features/progression/components/AppHero'` and render `<AppHero />` as the first child, above the SubNav:

```tsx
export function TrainSection() {
  return (
    <>
      <AppHero />
      <TrainSubNav />
      <Outlet />
    </>
  )
}
```

(Same shape for `FuelSection`.)

- [ ] **Step 5: Mount on Me.** Rewrite `MeSection.tsx` — `MeHead` replaced 1:1, the ⚙️ becomes the hero utility (keep `aria-label="Beállítások"` so `MeSection.test.tsx`'s settings test keeps passing):

```tsx
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppHero } from '@/features/progression/components/AppHero'
import { MeSubNav } from '@/features/me/pages/MeSubNav'
import { SettingsSheet } from '@/features/me/sheets/SettingsSheet'
import { Icon } from '@/shared/ui/Icon'

export function MeSection() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <>
      <AppHero
        utilities={
          <button
            type="button"
            className="icon-btn np-press"
            onClick={() => setSettingsOpen(true)}
            aria-label="Beállítások"
          >
            <Icon name="settings" size={16} />
          </button>
        }
      />
      <MeSubNav />
      <Outlet />
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </>
  )
}
```

- [ ] **Step 6: MeBioRow** — the biometrics line moves into ProfilePage content (spec §3.2):

```tsx
// frontend/src/features/me/components/MeBioRow.tsx
import { useBiometricProfile, useWeight } from '@/data/hooks'
import { ageFromBirthDate } from '@/features/me/logic/biometricFields'
import { hu1 } from '@/shared/lib/huNum'

/** One-line biometrics (was MeHead's .t2; the AppHero header is biometrics-free). */
export function MeBioRow() {
  const { profile } = useBiometricProfile()
  const { weightLog } = useWeight()
  const latestKg = weightLog.length ? weightLog[weightLog.length - 1].value : null
  const bits = [
    profile ? `${ageFromBirthDate(profile.birthDate)} év` : null,
    profile ? `${profile.heightCm} cm` : null,
    latestKg != null ? `${hu1(latestKg)} kg` : null,
    profile?.bodyFatPct != null ? `${profile.bodyFatPct}%` : null,
  ].filter(Boolean)
  if (bits.length === 0) return null
  return (
    <div className="me-biorow" style={{ fontSize: 12.5, color: 'var(--sub)', fontWeight: 600 }}>
      {bits.join(' · ')}
    </div>
  )
}
```

```tsx
// frontend/src/features/me/components/MeBioRow.test.tsx
import { render, waitFor } from '@testing-library/react'
import { MeBioRow } from '@/features/me/components/MeBioRow'
import { QueryWrapper } from '@/test/queryWrapper'

test('renders the one-line biometrics once the profile resolves', async () => {
  const { container } = render(
    <QueryWrapper>
      <MeBioRow />
    </QueryWrapper>,
  )
  await waitFor(() => expect(container.querySelector('.me-biorow')).toHaveTextContent('cm'))
})
```

In `ProfilePage.tsx` add `import { MeBioRow } from '@/features/me/components/MeBioRow'` and render `<MeBioRow />` as the FIRST child of the `col gap-md` column (above `GoalMiniCard`).

- [ ] **Step 7: Deletions + test updates.**
  - Delete `frontend/src/features/today/components/BrandRow.tsx` and `frontend/src/features/today/components/topSections.test.tsx` (its two assertions are superseded by `appHeroMount.test.tsx`).
  - Delete `frontend/src/features/me/components/MeHead.tsx` and `MeHead.test.tsx` (identity/name → AppHero.test; biometrics → MeBioRow.test; settings → MeSection.test).
  - In `MeSection.test.tsx`, deep-link test: change `expect(document.querySelector('.mehead')).toBeInTheDocument()` to `expect(document.querySelector('.apphero')).toBeInTheDocument()` (and its comment from MeHead to AppHero).

- [ ] **Step 8: Run the full suite in both modes**

Run: `pnpm vitest run` then `VITE_USE_MOCK=true pnpm vitest run`
Expected: PASS in both. If any other test still references BrandRow/MeHead, fix the reference the same way as Step 7 (grep first: `grep -rn "BrandRow\|MeHead" src/`).

- [ ] **Step 9: Commit**

```bash
git add -A frontend/src
git commit -m "feat(app): mount AppHero on all four main tabs, retire BrandRow + MeHead (mezo-k7rn)"
```

---

### Task 10: Award XP from every logging mutation

**Files:**
- Modify: `frontend/src/data/fuel/fuelHooks.ts` (`useMealActions`, `logM` mock arm)
- Modify: `frontend/src/data/me/weightHooks.ts` (`useWeight`, mock `onSuccess`)
- Modify: `frontend/src/data/me/sleepHooks.ts` (`useSleep`, mock `onSuccess`)
- Modify: `frontend/src/data/today/checkinHooks.ts` (`saveCheckIn`, mock path)
- Modify: `frontend/src/data/fuel/medicationHooks.ts` (`logDose` mock arm)
- Modify: `frontend/src/data/train/trainHooks.ts` (`finishMutation` + `logSportMutation` mock arms)
- Modify: `frontend/src/data/train/runningHooks.ts` (`logMutation` mock arm)
- Modify: `frontend/src/data/activity/activityHooks.ts:55-65` (`logM` mock arm)
- Test: `frontend/src/data/gamification/awardIntegration.test.tsx`

**Interfaces:**
- Consumes: `awardGamificationEvent`, `GAMIFICATION_KEY` (T4). Every edit is the same one-liner added INSIDE the existing `if (mock)` / mock-ternary arm, after its cache write: `awardGamificationEvent(qc, { type: '<TYPE>' })` plus the import `import { awardGamificationEvent } from '@/data/gamification/gamificationStore'`. Real arms are untouched (server will award, mezo-huzd).
- Produces: every mock-mode log feeds the account XP/streak/coins loop.

- [ ] **Step 1: Write the failing integration test**

```tsx
// frontend/src/data/gamification/awardIntegration.test.tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { useGamification } from '@/data/gamification/gamificationHooks'
import { useWeight } from '@/data/me/weightHooks'
import { useActivityActions } from '@/data/activity/activityHooks'
import { makeHookWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('mock logWeight feeds account XP and the daily streak', async () => {
  const wrapper = makeHookWrapper()
  const { result } = renderHook(() => ({ w: useWeight(), g: useGamification() }), { wrapper })
  const before = result.current.g.profile.totalXp // 3140
  act(() => result.current.w.logWeight({ date: '2026-07-18', weightKg: 76.4 }))
  await waitFor(() => expect(result.current.g.profile.totalXp).toBe(before + 10))
  expect(result.current.g.profile.streakDays).toBe(7) // seed 6 + first log today
  expect(result.current.g.profile.coins).toBe(240 + 50) // 7-day milestone
})

test('mock logActivity awards the entry xpAwarded (15)', async () => {
  const wrapper = makeHookWrapper()
  const { result } = renderHook(
    () => ({ a: useActivityActions('2026-07-18'), g: useGamification() }),
    { wrapper },
  )
  const before = result.current.g.profile.totalXp
  await act(() => result.current.a.logActivity('Olvastam 30 percet'))
  await waitFor(() => expect(result.current.g.profile.totalXp).toBe(before + 15))
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/data/gamification/awardIntegration.test.tsx`
Expected: FAIL — totalXp unchanged (no award calls yet).

- [ ] **Step 3: Add the award calls.** In each file add the import, then the call in the mock arm (the `qc` from the hook's `useQueryClient()` is already in scope in every one):

| File · location | Add after the mock cache write |
|---|---|
| `fuelHooks.ts` `logM` mock arm (`mockLog(qc, date, input)`) | `awardGamificationEvent(qc, { type: 'MEAL' })` |
| `weightHooks.ts` `onSuccess` mock branch (after `qc.setQueryData(['weightLog'], …)`) | `awardGamificationEvent(qc, { type: 'WEIGHT' })` |
| `sleepHooks.ts` `onSuccess` mock branch | `awardGamificationEvent(qc, { type: 'SLEEP' })` |
| `checkinHooks.ts` `saveCheckIn` — in the mock-only path (where the real mutation is skipped) | `awardGamificationEvent(qc, { type: 'CHECKIN' })` |
| `medicationHooks.ts` `logDose` mock arm | `awardGamificationEvent(qc, { type: 'MEDICATION' })` |
| `trainHooks.ts` `finishMutation` mock arm (returns `gymLevelUpMock` fixture) | `awardGamificationEvent(qc, { type: 'GYM' })` |
| `trainHooks.ts` `logSportMutation` mock arm | `awardGamificationEvent(qc, { type: 'SPORT' })` |
| `runningHooks.ts` `logMutation` mock arm | `awardGamificationEvent(qc, { type: 'RUN' })` |
| `activityHooks.ts` `logM` mock arm (`:57-60`, after the `setQueryData` prepend) | `awardGamificationEvent(qc, { type: 'ACTIVITY', xpOverride: res.entry.xpAwarded ?? 0 })` |

Only mock arms change; do not touch real arms, `onSuccess` invalidations, or return values. `updateMeal`/`deleteMeal`/`removeDose`/`categorize`/reroll award nothing (edits are not new logs).

- [ ] **Step 4: Run to verify it passes, then the full both-mode suite**

Run: `pnpm vitest run src/data/gamification/awardIntegration.test.tsx`
Expected: PASS (2 tests).
Run: `pnpm vitest run` and `VITE_USE_MOCK=true pnpm vitest run`
Expected: PASS in both modes. Watch for pre-existing hook tests of the edited files — if one asserts an exact toast sequence or cache shape, the new award side-effect may surface; fix by scoping the assertion, never by removing the award call.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data
git commit -m "feat(gamification): award XP from every logging mutation in mock mode (mezo-k7rn)"
```

---

### Task 11: Docs, spec amendment, gates, ship

**Files:**
- Modify: `docs/superpowers/specs/2026-07-18-gamified-header-design.md` (§9 amendment)
- Modify: `docs/features/growth.md`, `docs/features/today.md`, `docs/features/train.md`, `docs/features/fuel.md`, `docs/features/me.md`, `docs/features/_platform-design-system.md`, `docs/features/_platform-data-layer.md`

**Interfaces:** none — documentation + release mechanics.

- [ ] **Step 1: Spec §9 amendment** (implementation finding): replace the sentence
  `Account level-up triggers the **existing** LevelUp overlay via useLevelUp().showLevelUp(...).` with:

> Account level-up celebrates via a success toast (`🎉 Szint N — +50 🪙`) emitted by the award engine through `toastBus`. The existing `LevelUpScreen` stays reserved for skill level-ups: its layout is gains-driven, and an account-level payload with empty `gains` would render the "no level-up" headline (`LevelUpScreen.tsx:61`).

  Also in §4.3, align the wording: the award function emits its own toast (level-up > milestone > saver > plain XP priority) rather than returning data "so callers can fire the overlay".

  Further implementation-driven spec touch-ups (same edit):
  - **§4.1:** add the three bookkeeping fields to `GamificationProfile`: `ownedShopTitleKeys: string[]`, `lastActiveDate: string | null`, `dayCounters: { date; counts }`.
  - **§6.1:** annotate the quest coin rows (per-quest +10, all-3 +20): quest completion is DERIVED server-side, so these awards land with the backend slice (`mezo-huzd`) — there is no mock-mode quest-completion event to hook.
  - **§6.3:** rollover happens on the **first award** of the day (not "first read").
  - **§9:** the "mentő elhasználva" notice surfaces as the award engine's info toast, not as StreakSheet-internal state.

- [ ] **Step 2: Feature docs** (living docs, overwrite in place; `file:line` pointers, no code dumps):
  - `growth.md`: new "Account progression (AppHero)" section — one XP stream, level curve, coins, daily streak + saver, title catalog, `data/gamification/` map, real-mode interim (`mezo-huzd` fast-follow).
  - `today.md`: header block — BrandRow retired, AppHero + utilities (search, ✨ `/insights` entry moved here).
  - `train.md` / `fuel.md`: section shell now renders AppHero above the SubNav.
  - `me.md`: MeHead → AppHero; biometrics line → `MeBioRow` in ProfilePage; ⚙️ is a hero utility.
  - `_platform-design-system.md` §1a: AppHero as the main-tab header pattern (+ `.apphero` CSS family).
  - `_platform-data-layer.md`: new `gamification` domain (hooks, store, mock-award seam).

- [ ] **Step 3: Lint the docs**

Run: `node scripts/lint-docs.mjs` (from repo root)
Expected: no staleness flags for the touched docs.

- [ ] **Step 4: Full gates**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: build green, both test modes green.

- [ ] **Step 5: Commit + ship per the repo git workflow**

```bash
git add -A
git commit -m "docs(features): gamified header + account progression docs, spec §9 amendment (mezo-k7rn)"
git push -u origin feat/gamified-header
gh pr create --title "feat: unified gamified header (AppHero) + account progression (mezo-k7rn)" --fill
# wait for CI green, then:
git checkout main && git pull --rebase
git merge --no-ff feat/gamified-header
bd dolt push && git push
git branch -d feat/gamified-header
bd close mezo-k7rn
```

Expected: CI green before merge; `git status` shows "up to date with origin" at the end. `mezo-huzd` (backend slice) stays open as the fast-follow.

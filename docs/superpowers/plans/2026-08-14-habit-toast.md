# Habit-pipa → DS reward toast — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Today minden „teljesítettem" visszajelzése (habit-pipa, derived habit, quest, activity-log) a design system §Notification reward toastját dobja a mai teljes képernyős `LevelUpScreen` helyett.

**Architecture:** Három réteg. (1) A `toastBus` `ToastMessage`-e diszkriminált unióvá válik egy `reward` variánssal — a mai `SimpleToast` alak bitre változatlan, így a 10 domén meglévő toastja érintetlen. (2) Egy új pure builder (`features/progression/logic/rewardToast.ts`) képezi le a backend `LevelUpResult`-ját a payloadra. (3) A meglévő egyetlen `ToastProvider` host megtanul stackelni (max 3 látható), reward kártyát renderelni és variánsonként eltérő ideig élni. Végül az 5 Today-oldali `showLevelUp` hívóhely átkötése. A Train-flow-k `LevelUpScreen`-je változatlan.

**Tech Stack:** React 19 + TypeScript + Vite, Tailwind v4 + `prototype.css` (DS tokenek), Vitest + React Testing Library, TanStack Query.

**Spec:** [`docs/superpowers/specs/2026-08-14-habit-toast-design.md`](../specs/2026-08-14-habit-toast-design.md) · **Mockup:** [`2026-08-14-habit-toast-mockup.html`](../specs/2026-08-14-habit-toast-mockup.html) · **bd:** `mezo-k5sa`

## Global Constraints

- **Frontend konvenciók kötelezők:** olvasd el [`docs/references/frontend_conventions.md`](../../references/frontend_conventions.md)-t, MIELŐTT `frontend/src` kódot írsz. Négy réteg (`app/` · `features/<domain>/{pages,components,sheets,logic}/` · `shared/{ui,lib,hooks}/` · `data/`), mély abszolút importok `@/*` aliason át, **nincs relatív `../`**, nincs barrel a `data/hooks.ts`-en kívül, tesztek kolokálva.
- **`shared/ui` domén-mentes** — nem importálhat `@/data/*`-ot. A `ToastProvider` a payload *alakját* ismeri (a `toastBus`-ból), a doménjeit nem.
- **A `SimpleToast` alakja és az `emitToast` API nem változhat**: `{ kind: 'error' | 'success' | 'info', text: string }`. 10 domén és a mutation-cache hibakezelése függ tőle.
- **A Train-flow-k érintetlenek:** `features/train/pages/{ActiveWorkoutPage,SportPage,TrainTodayPage,RunningPage}.tsx` és a `features/progression/{LevelUpProvider,LevelUpScreen}.tsx` egyetlen sora sem módosul. Ezek zöld tesztjei a hatókör-határ bizonyítéka.
- **Nem találunk ki adatot:** ha egy skill neve nem ismert (mock mód), a meter címkéje `'XP'` — sosem kitalált skill-név. Ha nincs gain, a toast meter nélkül jelenik meg, sosem `+undefined`.
- **DS-értékek pontosan** (design-system-mezo.html §Notification): anchor `top: calc(env(safe-area-inset-top, 0px) + 14px)` / `right: 14px`, szélesség `calc(100% - 28px)` max `296px`, `z-index: var(--z-toast, 70)`; stack `gap: 8px`, max 3 látható (idx1 → `scale(0.96)`/`opacity .78`, idx2 → `scale(0.93)`/`.55`), queue cap **20**; belépés `translateX(36px) translateY(-4px)` → `0`, **420ms**, `cubic-bezier(0.32, 0.72, 0.32, 1)`; kilépés `translateX(36px)` + fade, **450ms** unmount-késleltetés; auto-dismiss **reward 4000ms**, **error 6000ms**, **success/info 4000ms**.
- **Kapu minden task végén:** `cd frontend && pnpm test -- --run <érintett teszt>`. A **teljes** kapu (Task 8): `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — mindkét mód zöld.
- **Commit-üzenetek:** conventional commit + a bd id: `feat(today): ... (mezo-k5sa)`.

## File Structure

| Fájl | Felelősség | Task |
|---|---|---|
| `frontend/src/shared/lib/toastBus.ts` | **Módosul** — a `ToastMessage` diszkriminált unió lesz (`SimpleToast \| RewardToast`). React-mentes marad. | 1 |
| `frontend/src/features/progression/logic/rewardToast.ts` | **Új** — pure builder: `LevelUpResult` / mock adat → `RewardToast`. Nincs benne DOM, hook, import a `data/`-ból a típusokon kívül. | 2 |
| `frontend/src/features/progression/logic/rewardToast.test.ts` | **Új** — a builder táblázatos tesztje. | 2 |
| `frontend/src/styles/prototype.css` | **Módosul** — a `.toast` blokk helyére a stack + reward kártya CSS (`.toast-stack`, `.toast`, `.t-*`). | 3 |
| `frontend/src/shared/ui/ToastProvider.tsx` | **Módosul** — queue + stack + variáns-render + per-variáns auto-dismiss + ✕ + reduced motion. | 3, 4 |
| `frontend/src/shared/ui/ToastProvider.test.tsx` | **Módosul** — a meglévő 3 teszt igazítása + új stack/variáns/dismiss tesztek. | 3, 4 |
| `frontend/src/data/gamification/gamificationStore.ts` | **Módosul** — `silentXp` opció (csak a `+X XP` ágat némítja). | 5 |
| `frontend/src/data/gamification/gamificationStore.test.ts` | **Módosul** — `silentXp` tesztek. | 5 |
| `frontend/src/data/habit/habitHooks.ts` | **Módosul** — a mock check `silentXp: true`-t ad át. | 5 |
| `frontend/src/features/today/pages/TodayPage.tsx` | **Módosul** — 3 hívóhely (kézi pipa + 2 consume-effekt). | 6 |
| `frontend/src/features/today/pages/TodayPage.dispatch.test.tsx` | **Módosul** — az overlay-asszertek toast-asszertekké. | 6 |
| `frontend/src/features/today/components/DaypartEvening.tsx` | **Módosul** — `wind_down` pipa. | 7 |
| `frontend/src/features/today/components/DailyQuestsCard.tsx` | **Módosul** — quest consume-effekt. | 7 |
| `frontend/src/features/today/sheets/ActivityLogSheet.tsx` | **Módosul** — activity-naplózás. | 7 |
| `docs/features/{_platform-design-system,today,habit,growth}.md` | **Módosul** — élő dokumentáció. | 8 |

---

### Task 1: A `toastBus` payload — diszkriminált unió

A `RewardToast` alak minden későbbi task alapja. Ez a task **csak típust és egy runtime type-guardot** ad; a renderelés a Task 3/4.

**Files:**
- Modify: `frontend/src/shared/lib/toastBus.ts`
- Test: `frontend/src/shared/lib/toastBus.test.ts` (új)

**Interfaces:**
- Consumes: semmit (ez az első task).
- Produces:
  - `type ToastKind = 'error' | 'success' | 'info'`
  - `interface SimpleToast { kind: ToastKind; text: string }`
  - `interface RewardToast { kind: 'reward'; eyebrow: string; title: string; meta?: string; meter?: { label: string; delta: number }; levelUp?: { label: string; from: number; to: number } }`
  - `type ToastMessage = SimpleToast | RewardToast`
  - `function isRewardToast(t: ToastMessage): t is RewardToast`
  - változatlan: `emitToast(toast: ToastMessage): void`, `onToast(listener: (t: ToastMessage) => void): () => void`

- [ ] **Step 1: Írd meg a bukó tesztet**

Hozd létre: `frontend/src/shared/lib/toastBus.test.ts`

```ts
import { afterEach, expect, test, vi } from 'vitest'
import { emitToast, isRewardToast, onToast, type ToastMessage } from '@/shared/lib/toastBus'

let off: (() => void) | null = null
afterEach(() => { off?.(); off = null; vi.restoreAllMocks() })

const listen = () => {
  const seen: ToastMessage[] = []
  off = onToast((t) => seen.push(t))
  return seen
}

test('a simple toast megy át változatlanul', () => {
  const seen = listen()
  emitToast({ kind: 'success', text: 'Mentve' })
  expect(seen).toEqual([{ kind: 'success', text: 'Mentve' }])
})

test('a reward toast minden mezője átmegy', () => {
  const seen = listen()
  emitToast({
    kind: 'reward',
    eyebrow: 'Szokás · 2 / 3',
    title: 'Napi szándék',
    meter: { label: 'Mentális', delta: 15 },
    levelUp: { label: 'Mentális', from: 3, to: 4 },
  })
  expect(seen[0]).toMatchObject({
    kind: 'reward', eyebrow: 'Szokás · 2 / 3', title: 'Napi szándék',
    meter: { label: 'Mentális', delta: 15 }, levelUp: { label: 'Mentális', from: 3, to: 4 },
  })
})

test('isRewardToast a kind alapján szűr', () => {
  expect(isRewardToast({ kind: 'reward', eyebrow: 'Küldetés', title: 'Vízivás' })).toBe(true)
  expect(isRewardToast({ kind: 'success', text: 'Mentve' })).toBe(false)
  expect(isRewardToast({ kind: 'error', text: 'Hiba' })).toBe(false)
})
```

- [ ] **Step 2: Futtasd — buknia kell**

Futtasd: `cd frontend && pnpm test -- --run src/shared/lib/toastBus.test.ts`
Várt: FAIL — `isRewardToast` nem exportált (`does not provide an export named 'isRewardToast'`).

- [ ] **Step 3: Írd meg a minimális implementációt**

Cseréld le a `frontend/src/shared/lib/toastBus.ts` teljes tartalmát:

```ts
// React-free pub/sub bridge between non-React code (the QueryClient mutation cache,
// module-level helpers) and the ToastProvider host. Emitting without a mounted
// subscriber is a silent no-op — isolated component tests stay unaffected.
//
// A ToastMessage is a discriminated union: the plain `SimpleToast` (unchanged shape —
// ten domains' mock award helpers and the mutation cache's error path emit it) and the
// DS §Notification `RewardToast` (habit/quest completion — mezo-k5sa).
export type ToastKind = 'error' | 'success' | 'info'

export interface SimpleToast {
  kind: ToastKind
  text: string
}

/** DS §Notification reward variant. Every field beyond eyebrow/title is optional —
 *  a payload with no meter renders as eyebrow + title, never as `+undefined`. */
export interface RewardToast {
  kind: 'reward'
  /** „Szokás · 2 / 3" · „Küldetés" — uppercase eyebrow above the title */
  eyebrow: string
  /** the habit/quest name — Fraunces title */
  title: string
  /** italic addendum beside the title: „2000 ml" */
  meta?: string
  /** the meter row: the skill's display name (real mode) or 'XP' (mock) + the delta */
  meter?: { label: string; delta: number }
  /** only when levelAfter > levelBefore */
  levelUp?: { label: string; from: number; to: number }
}

export type ToastMessage = SimpleToast | RewardToast

export function isRewardToast(t: ToastMessage): t is RewardToast {
  return t.kind === 'reward'
}

type Listener = (t: ToastMessage) => void

const listeners = new Set<Listener>()

/** Subscribe to toast emissions; returns the unsubscribe function. */
export function onToast(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Emit a toast to every mounted host (normally the single app-level ToastProvider). */
export function emitToast(toast: ToastMessage): void {
  listeners.forEach((l) => l(toast))
}
```

- [ ] **Step 4: Futtasd — zöldnek kell lennie**

Futtasd: `cd frontend && pnpm test -- --run src/shared/lib/toastBus.test.ts`
Várt: PASS, 3 teszt.

- [ ] **Step 5: Ellenőrizd, hogy a típusbővítés nem tört el semmit**

Futtasd: `cd frontend && pnpm build`
Várt: sikeres `tsc -b` + build. A `ToastProvider.tsx` `KIND_BG[toast.kind]` sora **még fordul**, mert a Task 3-ig nem érinti a `reward` ágat — ha mégis típushibát jelez (`'reward'` nincs a `KIND_BG` kulcsai közt), az azt jelenti, hogy a `toast` változó típusa `ToastMessage`. Ez esetben **ne javítsd itt** — jegyezd fel, és a Task 3 amúgy is lecseréli azt a fájlt. Ha a build emiatt piros, ideiglenesen szűkítsd a rendert: `{toast && !isRewardToast(toast) && (` … `)}` és importáld az `isRewardToast`-ot.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/lib/toastBus.ts frontend/src/shared/lib/toastBus.test.ts frontend/src/shared/ui/ToastProvider.tsx
git commit -m "feat(shared): toastBus reward variáns — diszkriminált ToastMessage unió (mezo-k5sa)"
```

---

### Task 2: A payload-builder (pure)

**Files:**
- Create: `frontend/src/features/progression/logic/rewardToast.ts`
- Create: `frontend/src/features/progression/logic/rewardToast.test.ts`

**Interfaces:**
- Consumes: `RewardToast` a `@/shared/lib/toastBus`-ból (Task 1); `LevelUpResult` a `@/data/train/trainApi`-ból; `skillDisplay` a `@/features/progression/logic/levelUpMeta`-ból (meglévő, signature: `skillDisplay(skillKey: string, kind: 'ATHLETIC' | 'MUSCLE' | 'LIFE', fallbackName?: string): { name: string; icon: string }`).
- Produces:
  - `function buildHabitRewardToast(input: { title: string; chainDone: number; chainTotal: number; xp: number; levelUp?: LevelUpResult | null }): RewardToast`
  - `function buildQuestRewardToast(input: { title: string; meta?: string; eyebrow?: string; levelUp?: LevelUpResult | null }): RewardToast`

**Háttér, amit tudnod kell:** a `LevelUpResult.gains[]` elemei `{ skillKey, kind, name, xpGained, levelBefore, levelAfter, progressFromPct, progressToPct }`. A `name` a **nyers skill-kulcs** (pl. `'chest'`), a megjelenítendő magyar nevet a `skillDisplay(skillKey, kind, name).name` adja — a `LevelUpScreen` is így csinálja. A habit-award mindig **pontosan egy** gaint ír (`ProgressionService.applyHabit` egyetlen `skillKey`-t tesz a delta-mapbe), ezért a builder a `gains[0]`-t használja.

- [ ] **Step 1: Írd meg a bukó tesztet**

Hozd létre: `frontend/src/features/progression/logic/rewardToast.test.ts`

```ts
import { expect, test } from 'vitest'
import type { LevelUpResult } from '@/data/train/trainApi'
import { buildHabitRewardToast, buildQuestRewardToast } from '@/features/progression/logic/rewardToast'

const habitLevelUp: LevelUpResult = {
  source: 'HABIT', workoutLabel: 'Napi szándék', totalXp: 15,
  gains: [{ skillKey: 'mental', kind: 'LIFE', name: 'mental', xpGained: 15,
    levelBefore: 3, levelAfter: 4, progressFromPct: 90, progressToPct: 12 }],
  levelUps: ['mental'], perks: [], robustness: { xpGained: 0, streakWeeks: 0 },
}

const habitNoLevelUp: LevelUpResult = {
  ...habitLevelUp,
  gains: [{ ...habitLevelUp.gains[0], levelBefore: 3, levelAfter: 3, xpGained: 10 }],
  levelUps: [],
}

test('real mód: a meter a gain megjelenítendő skill-nevét és XP-jét hozza', () => {
  const t = buildHabitRewardToast({
    title: 'Napi szándék', chainDone: 1, chainTotal: 3, xp: 15, levelUp: habitNoLevelUp,
  })
  expect(t.kind).toBe('reward')
  expect(t.eyebrow).toBe('Szokás · 2 / 3')       // optimista done + 1
  expect(t.title).toBe('Napi szándék')
  expect(t.meter).toEqual({ label: 'Mentális', delta: 10 })
  expect(t.levelUp).toBeUndefined()
})

test('szintlépéskor a levelUp mező kitöltődik', () => {
  const t = buildHabitRewardToast({
    title: 'Napi szándék', chainDone: 1, chainTotal: 3, xp: 15, levelUp: habitLevelUp,
  })
  expect(t.levelUp).toEqual({ label: 'Mentális', from: 3, to: 4 })
})

test('mock mód (nincs LevelUpResult): a meter címkéje XP, deltája a habit xp-je', () => {
  const t = buildHabitRewardToast({ title: 'Reggeli súlymérés', chainDone: 0, chainTotal: 3, xp: 10 })
  expect(t.eyebrow).toBe('Szokás · 1 / 3')
  expect(t.meter).toEqual({ label: 'XP', delta: 10 })
  expect(t.levelUp).toBeUndefined()
})

test('üres gains: a toast meter nélkül jön, sosem +undefined', () => {
  const t = buildHabitRewardToast({
    title: 'Reggeli súlymérés', chainDone: 0, chainTotal: 3, xp: 0,
    levelUp: { ...habitLevelUp, gains: [], levelUps: [] },
  })
  expect(t.meter).toBeUndefined()
  expect(t.title).toBe('Reggeli súlymérés')
})

test('lánc-kontextus nélkül (chainTotal 0) az eyebrow számláló nélküli', () => {
  const t = buildHabitRewardToast({ title: 'Wind-down', chainDone: 0, chainTotal: 0, xp: 5 })
  expect(t.eyebrow).toBe('Szokás')
})

test('quest builder: saját eyebrow + meta, a meter a gainből', () => {
  const t = buildQuestRewardToast({
    title: 'Vízivás', meta: '2000 ml', levelUp: habitNoLevelUp,
  })
  expect(t.eyebrow).toBe('Küldetés')
  expect(t.title).toBe('Vízivás')
  expect(t.meta).toBe('2000 ml')
  expect(t.meter).toEqual({ label: 'Mentális', delta: 10 })
})

test('quest builder: az eyebrow felülírható (activity-napló)', () => {
  const t = buildQuestRewardToast({ title: 'Favágás', eyebrow: 'Naplózva' })
  expect(t.eyebrow).toBe('Naplózva')
  expect(t.meter).toBeUndefined()
})
```

- [ ] **Step 2: Futtasd — buknia kell**

Futtasd: `cd frontend && pnpm test -- --run src/features/progression/logic/rewardToast.test.ts`
Várt: FAIL — `Failed to resolve import "@/features/progression/logic/rewardToast"`.

- [ ] **Step 3: Írd meg a minimális implementációt**

Hozd létre: `frontend/src/features/progression/logic/rewardToast.ts`

```ts
// ============================================================
// Mezo · rewardToast — the payload-builder layer of the DS §Notification toast
// system (mezo-k5sa). PURE: no DOM, no hooks, no query client — it only maps what a
// call site already knows (+ the server's LevelUpResult when there is one) onto a
// RewardToast. The config layer the DS reference implementation describes lives in
// OUR backend (ProgressionService decides the XP and the level threshold), so there is
// deliberately no FE-side reward config here — that would be a second source of truth.
// ============================================================
import type { LevelUpResult } from '@/data/train/trainApi'
import { skillDisplay } from '@/features/progression/logic/levelUpMeta'
import type { RewardToast } from '@/shared/lib/toastBus'

/** The meter row + level-up badge, derived from the server's payload.
 *  A habit award always writes exactly ONE gain (ProgressionService.applyHabit puts a
 *  single skillKey in the delta map), so gains[0] is the whole story — no picking needed. */
function fromLevelUp(levelUp: LevelUpResult | null | undefined): Pick<RewardToast, 'meter' | 'levelUp'> {
  const gain = levelUp?.gains?.[0]
  if (!gain) return {}
  const { name } = skillDisplay(gain.skillKey, gain.kind, gain.name)
  return {
    meter: { label: name, delta: gain.xpGained },
    // Only a REAL level crossing earns the badge — a gain that merely accrued XP does not.
    ...(gain.levelAfter > gain.levelBefore
      ? { levelUp: { label: name, from: gain.levelBefore, to: gain.levelAfter } }
      : {}),
  }
}

/**
 * Habit check → reward toast.
 *
 * `chainDone` is the chain's completed count BEFORE this check; the eyebrow shows
 * `chainDone + 1` because the row this toast celebrates is now done — the same number the
 * list prints a moment later. `chainTotal === 0` means the call site has no chain context
 * (e.g. the wind-down banner), and the eyebrow drops the counter rather than printing „· 1 / 0".
 *
 * Mock mode resolves `check()` to undefined (no LevelUpResult exists), so the meter falls back
 * to `{ label: 'XP', delta: xp }` — 'XP' is literally what was awarded. We never invent a skill
 * name the mock data does not carry.
 */
export function buildHabitRewardToast(input: {
  title: string
  chainDone: number
  chainTotal: number
  xp: number
  levelUp?: LevelUpResult | null
}): RewardToast {
  const { title, chainDone, chainTotal, xp, levelUp } = input
  const fromServer = fromLevelUp(levelUp)
  const meter = fromServer.meter ?? (xp > 0 ? { label: 'XP', delta: xp } : undefined)
  return {
    kind: 'reward',
    eyebrow: chainTotal > 0 ? `Szokás · ${chainDone + 1} / ${chainTotal}` : 'Szokás',
    title,
    ...(meter ? { meter } : {}),
    ...(fromServer.levelUp ? { levelUp: fromServer.levelUp } : {}),
  }
}

/**
 * Quest completion / activity log → reward toast. No chain counter exists for these, so the
 * eyebrow is a fixed label („Küldetés", or „Naplózva" for the activity sheet). With no
 * LevelUpResult the toast is eyebrow + title alone — a complete, honest confirmation.
 */
export function buildQuestRewardToast(input: {
  title: string
  meta?: string
  eyebrow?: string
  levelUp?: LevelUpResult | null
}): RewardToast {
  const { title, meta, eyebrow = 'Küldetés', levelUp } = input
  const fromServer = fromLevelUp(levelUp)
  return {
    kind: 'reward',
    eyebrow,
    title,
    ...(meta ? { meta } : {}),
    ...(fromServer.meter ? { meter: fromServer.meter } : {}),
    ...(fromServer.levelUp ? { levelUp: fromServer.levelUp } : {}),
  }
}
```

- [ ] **Step 4: Futtasd — zöldnek kell lennie**

Futtasd: `cd frontend && pnpm test -- --run src/features/progression/logic/rewardToast.test.ts`
Várt: PASS, 7 teszt.

**Ha a „Mentális" asszert bukik:** a `skillDisplay` a `LIFE_META` táblából olvas (`features/progression/logic/levelUpMeta.ts`). Nyisd meg, és nézd meg, milyen kulcsokat ismer. Ha nincs `mental` kulcs, a `skillDisplay` a `fallbackName`-et (`'mental'`) adja vissza. Ez esetben **a tesztet igazítsd a valósághoz** — cseréld a fixture `skillKey`/`name` értékét egy létező `LIFE` kulcsra és a várt címkét annak magyar nevére. Ne a `skillDisplay`-t módosítsd.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/progression/logic/rewardToast.ts frontend/src/features/progression/logic/rewardToast.test.ts
git commit -m "feat(progression): pure LevelUpResult→reward toast payload builder (mezo-k5sa)"
```

---

### Task 3: `ToastProvider` v2 — queue, stack, kilépés

Ez a task a **működést** hozza (queue, sorrend, auto-dismiss, ✕), a reward-kártya *kinézete* a Task 4. Így egy reviewer külön ítélheti meg a viselkedést és a vizuált.

**Files:**
- Modify: `frontend/src/shared/ui/ToastProvider.tsx`
- Modify: `frontend/src/shared/ui/ToastProvider.test.tsx`
- Modify: `frontend/src/styles/prototype.css:768-782` (a `/* Toast (PR) */` blokk)

**Interfaces:**
- Consumes: `emitToast`, `onToast`, `isRewardToast`, `ToastMessage`, `RewardToast` a `@/shared/lib/toastBus`-ból (Task 1); `useReducedMotion` a `@/shared/hooks/useReducedMotion`-ből (meglévő, `(): boolean`).
- Produces: `ToastProvider({ children }: { children: ReactNode })` és `useToast(): { show: (t: ToastMessage) => void }` — **a publikus API változatlan**.

- [ ] **Step 1: Írd meg a bukó teszteket**

Cseréld le a `frontend/src/shared/ui/ToastProvider.test.tsx` teljes tartalmát:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emitToast } from '@/shared/lib/toastBus'
import { ToastProvider, useToast } from '@/shared/ui/ToastProvider'

function ShowButton() {
  const toast = useToast()
  return <button onClick={() => toast.show({ kind: 'success', text: 'Mentve' })}>trigger</button>
}

const items = () => screen.queryAllByTestId('toast-item')

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('ToastProvider — simple toasts (a mai viselkedés megőrzése)', () => {
  it('kirendereli a buszon érkező toastot és 4s után elengedi', () => {
    render(<ToastProvider>content</ToastProvider>)

    act(() => emitToast({ kind: 'error', text: 'Mentés sikertelen — próbáld újra' }))
    expect(screen.getByRole('status')).toHaveTextContent('Mentés sikertelen — próbáld újra')
    expect(items()[0]).toHaveAttribute('data-kind', 'error')

    // error = 6000ms; 4000-nél még él
    act(() => { vi.advanceTimersByTime(4100) })
    expect(items()).toHaveLength(1)

    act(() => { vi.advanceTimersByTime(2000 + 500) })  // 6000 + exit
    expect(items()).toHaveLength(0)
  })

  it('a success 4s után tűnik el', () => {
    render(<ToastProvider>content</ToastProvider>)
    act(() => emitToast({ kind: 'success', text: 'Mentve' }))
    act(() => { vi.advanceTimersByTime(4000 + 500) })
    expect(items()).toHaveLength(0)
  })

  it('a useToast().show() a buszon át emitál', () => {
    render(<ToastProvider><ShowButton /></ToastProvider>)
    fireEvent.click(screen.getByText('trigger'))
    expect(items()[0]).toHaveTextContent('Mentve')
  })

  it('provider nélküli emitToast csendes no-op', () => {
    expect(() => emitToast({ kind: 'info', text: 'senki sem hallja' })).not.toThrow()
  })
})

describe('ToastProvider — stack', () => {
  it('a legújabb toast van elöl, és egyik sem cseréli le a másikat', () => {
    render(<ToastProvider>content</ToastProvider>)
    act(() => emitToast({ kind: 'success', text: 'első' }))
    act(() => { vi.advanceTimersByTime(100) })
    act(() => emitToast({ kind: 'success', text: 'második' }))

    const rendered = items()
    expect(rendered).toHaveLength(2)
    expect(rendered[0]).toHaveTextContent('második')
    expect(rendered[1]).toHaveTextContent('első')
  })

  it('legfeljebb 3 látható; a 4. rejtett marad', () => {
    render(<ToastProvider>content</ToastProvider>)
    for (const text of ['a', 'b', 'c', 'd']) {
      act(() => emitToast({ kind: 'success', text }))
      act(() => { vi.advanceTimersByTime(50) })
    }
    const rendered = items()
    expect(rendered).toHaveLength(4)
    expect(rendered[0]).toHaveAttribute('data-idx', '0')
    expect(rendered[1]).toHaveAttribute('data-idx', '1')
    expect(rendered[2]).toHaveAttribute('data-idx', '2')
    expect(rendered[3]).toHaveAttribute('data-idx', 'hidden')
  })

  it('a queue 20 elemnél nem nő tovább', () => {
    render(<ToastProvider>content</ToastProvider>)
    for (let i = 0; i < 25; i += 1) {
      act(() => emitToast({ kind: 'success', text: `t${i}` }))
    }
    expect(items().length).toBeLessThanOrEqual(20)
    expect(items()[0]).toHaveTextContent('t24')
  })

  it('a ✕ azonnal zárja az adott toastot, a többit nem', () => {
    render(<ToastProvider>content</ToastProvider>)
    act(() => emitToast({ kind: 'success', text: 'marad' }))
    act(() => { vi.advanceTimersByTime(50) })
    act(() => emitToast({ kind: 'success', text: 'megy' }))

    fireEvent.click(screen.getAllByRole('button', { name: 'Bezárás' })[0])
    act(() => { vi.advanceTimersByTime(500) })

    const rendered = items()
    expect(rendered).toHaveLength(1)
    expect(rendered[0]).toHaveTextContent('marad')
  })
})
```

- [ ] **Step 2: Futtasd — buknia kell**

Futtasd: `cd frontend && pnpm test -- --run src/shared/ui/ToastProvider.test.tsx`
Várt: FAIL — nincs `toast-item` testid, a második toast lecseréli az elsőt, nincs `Bezárás` gomb.

- [ ] **Step 3: Cseréld le a `ToastProvider.tsx`-et**

Cseréld le a `frontend/src/shared/ui/ToastProvider.tsx` teljes tartalmát:

```tsx
import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react'
import { emitToast, isRewardToast, onToast, type ToastMessage } from '@/shared/lib/toastBus'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'

// Single global toast host (mounted once in AppLayout) + the useToast() imperative API.
// Components call useToast().show(...); non-React code (mutation cache, the mock award
// helpers) emits via the toastBus directly.
//
// Since mezo-k5sa this host STACKS (DS §Notification): toasts queue instead of replacing
// each other — the chain-completion celebration no longer wipes the last check's feedback.
// Max 3 are visible; older ones scale down and fade (CSS, keyed off data-idx). The queue
// itself caps at 20, oldest dropped on overflow.
// Purpose-built confirmations (FuelStackPage protocol card, MedalToast) stay feature-local
// by design; this host is for generic error/success/info feedback plus reward toasts.

const AUTO_HIDE_MS: Record<string, number> = {
  reward: 4000,
  error: 6000,   // more time to read a failure
  success: 4000,
  info: 4000,
}
const EXIT_MS = 500       // keep the node mounted while the exit transition plays
const MAX_VISIBLE = 3
const QUEUE_CAP = 20

type Entry = { id: number; toast: ToastMessage; leaving: boolean }

const ToastContext = createContext<{ show: (t: ToastMessage) => void }>({
  // Provider-less fallback (isolated tests): route through the bus, render nothing.
  show: emitToast,
})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([])   // newest first
  const nextId = useRef(0)
  const reduced = useReducedMotion()

  const dismiss = useCallback((id: number) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, leaving: true } : e)))
    setTimeout(() => setEntries((prev) => prev.filter((e) => e.id !== id)), EXIT_MS)
  }, [])

  useEffect(
    () =>
      onToast((toast) => {
        const id = nextId.current
        nextId.current += 1
        setEntries((prev) => [{ id, toast, leaving: false }, ...prev].slice(0, QUEUE_CAP))
        setTimeout(() => dismiss(id), AUTO_HIDE_MS[toast.kind] ?? 4000)
      }),
    [dismiss],
  )

  const show = useCallback((t: ToastMessage) => emitToast(t), [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {entries.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite">
          {entries.map((e, idx) => (
            <div
              key={e.id}
              data-testid="toast-item"
              data-kind={e.toast.kind}
              data-idx={idx < MAX_VISIBLE ? String(idx) : 'hidden'}
              className={`toast${e.leaving ? ' is-leaving' : ''}${reduced ? ' is-reduced' : ''}`}
            >
              <button
                type="button"
                className="t-close"
                aria-label="Bezárás"
                onClick={() => dismiss(e.id)}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              <div className="t-pad">
                {isRewardToast(e.toast)
                  ? <span className="t-simple-text">{e.toast.title}</span>
                  : <span className="t-simple-text">{e.toast.text}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}
```

> A reward-kártya teljes belseje szándékosan a Task 4 — itt még csak a címe renderelődik, hogy ez a task kizárólag a queue/stack viselkedést bizonyítsa.

- [ ] **Step 4: Írd meg a stack CSS-t**

A `frontend/src/styles/prototype.css`-ben cseréld le a teljes `/* Toast (PR) */` blokkot (a `.toast { … }` szabály, jelenleg ~768-782. sor) erre:

```css
/* Toast · DS §Notification (mezo-k5sa) — top-right stack, max 3 visible */
.toast-stack {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 14px);
  left: auto; right: 14px;
  width: calc(100% - 28px);
  max-width: 296px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: var(--z-toast, 70);
  pointer-events: none;
}
.toast {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  pointer-events: auto;
  color: #fff;
  background: var(--coral);
  box-shadow: 0 14px 32px rgba(0,0,0,0.42), 0 4px 10px rgba(0,0,0,0.18);
  transform-origin: top right;
  animation: toast-in 420ms cubic-bezier(0.32, 0.72, 0.32, 1);
  transition:
    transform 420ms cubic-bezier(0.32, 0.72, 0.32, 1),
    opacity 420ms cubic-bezier(0.32, 0.72, 0.32, 1);
}
@keyframes toast-in {
  from { transform: translateX(36px) translateY(-4px); opacity: 0; }
  to   { transform: translateX(0) translateY(0); opacity: 1; }
}
/* Stack depth — newest (idx 0) full size, older ones recede. */
.toast[data-idx="1"] { transform: scale(0.96); opacity: 0.78; }
.toast[data-idx="2"] { transform: scale(0.93); opacity: 0.55; }
.toast[data-idx="hidden"] { display: none; }
.toast.is-leaving { transform: translateX(36px); opacity: 0; }

.toast[data-kind="success"] { background: var(--success); }
.toast[data-kind="error"]   { background: var(--error); }
.toast[data-kind="info"]    { background: var(--coral); }

.t-close {
  position: absolute; top: 8px; right: 8px;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: rgba(0,0,0,0.10);
  border: none;
  display: grid; place-items: center;
  cursor: pointer;
  color: rgba(255,255,255,0.60);
}
.t-pad { padding: 12px 14px; }
/* DS caption floor: 14px for sentence-case feedback text */
.t-simple-text { font-size: 14px; font-weight: 600; padding-right: 20px; display: block; }

/* Reduced motion: the toast still appears, just without the slide (DS §Notification).
   Both paths matter — the class covers the useReducedMotion hook's runtime read, the
   media query covers a user who flips the OS setting while a toast is on screen. */
.toast.is-reduced { animation: none; transition: none; }
@media (prefers-reduced-motion: reduce) {
  .toast { animation: none; transition: none; }
}
```

- [ ] **Step 5: Futtasd — zöldnek kell lennie**

Futtasd: `cd frontend && pnpm test -- --run src/shared/ui/ToastProvider.test.tsx`
Várt: PASS, 9 teszt.

**Ha a „queue 20" teszt bukik** azzal, hogy 25 elem van: a `.slice(0, QUEUE_CAP)` az új elem beszúrása UTÁN fut — ellenőrizd, hogy a `setEntries` visszatérési értéke tényleg a `slice`-olt tömb.

- [ ] **Step 6: Ellenőrizd, hogy más tesztek nem törtek el**

Futtasd: `cd frontend && pnpm test -- --run src/features/today src/data/gamification`
Várt: PASS. Ha valamelyik teszt `getByRole('status')`-szal EGY toast szövegét kereste és most több `status` van — nem lesz több, mert a `role="status"` most a **konténeren** van, egyetlen példányban.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/shared/ui/ToastProvider.tsx frontend/src/shared/ui/ToastProvider.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(shared): ToastProvider v2 — stack, per-variáns auto-dismiss, ✕ (mezo-k5sa)"
```

---

### Task 4: A reward kártya renderelése

**Files:**
- Modify: `frontend/src/shared/ui/ToastProvider.tsx`
- Modify: `frontend/src/shared/ui/ToastProvider.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (a Task 3-ban írt Toast blokk bővül)

**Interfaces:**
- Consumes: `RewardToast` (Task 1), a Task 3 `ToastProvider` váza.
- Produces: nincs új export — a `reward` `kind`-ú toast a DS kártyát rendereli.

- [ ] **Step 1: Írd meg a bukó teszteket**

Fűzd hozzá a `frontend/src/shared/ui/ToastProvider.test.tsx` végéhez:

```tsx
describe('ToastProvider — reward variáns', () => {
  it('kirendereli az eyebrow-t, a címet, a metert és a level-up badge-et', () => {
    render(<ToastProvider>content</ToastProvider>)
    act(() =>
      emitToast({
        kind: 'reward',
        eyebrow: 'Szokás · 2 / 3',
        title: 'Napi szándék',
        meter: { label: 'Mentális', delta: 15 },
        levelUp: { label: 'Mentális', from: 3, to: 4 },
      }),
    )

    const item = items()[0]
    expect(item).toHaveAttribute('data-kind', 'reward')
    expect(item).toHaveTextContent('Szokás · 2 / 3')
    expect(item).toHaveTextContent('Napi szándék')
    expect(item).toHaveTextContent('Mentális')
    expect(item).toHaveTextContent('+15')
    expect(item).toHaveTextContent('LEVEL UP · Mentális · Lv3 → 4')
  })

  it('meter és level-up nélkül is teljes értékű: eyebrow + cím + meta', () => {
    render(<ToastProvider>content</ToastProvider>)
    act(() => emitToast({ kind: 'reward', eyebrow: 'Küldetés', title: 'Vízivás', meta: '2000 ml' }))

    const item = items()[0]
    expect(item).toHaveTextContent('Küldetés')
    expect(item).toHaveTextContent('Vízivás')
    expect(item).toHaveTextContent('2000 ml')
    expect(item.textContent).not.toContain('undefined')
    expect(item.textContent).not.toContain('LEVEL UP')
  })

  it('a reward 4s után tűnik el', () => {
    render(<ToastProvider>content</ToastProvider>)
    act(() => emitToast({ kind: 'reward', eyebrow: 'Szokás', title: 'Pipa' }))
    act(() => { vi.advanceTimersByTime(4000 + 500) })
    expect(items()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Futtasd — buknia kell**

Futtasd: `cd frontend && pnpm test -- --run src/shared/ui/ToastProvider.test.tsx`
Várt: FAIL — az eyebrow/meter/badge szöveg nincs a DOM-ban (a Task 3 csak a címet rendereli).

- [ ] **Step 3: Írd meg a render-ágat**

A `frontend/src/shared/ui/ToastProvider.tsx`-ben cseréld le a `<div className="t-pad">…</div>` blokkot erre, és vedd fel a `RewardToast` típusimportot:

```tsx
              {isRewardToast(e.toast) ? <RewardBody toast={e.toast} /> : (
                <div className="t-pad">
                  <span className="t-simple-text">{e.toast.text}</span>
                </div>
              )}
```

Az importsort egészítsd ki:

```tsx
import {
  emitToast, isRewardToast, onToast, type RewardToast, type ToastMessage,
} from '@/shared/lib/toastBus'
```

A fájl aljára, a `ToastProvider` UTÁN vedd fel a prezentációs alkomponenst:

```tsx
/** The DS §Notification reward card: eyebrow · Fraunces title (+ italic meta) · meter row
 *  (+N in gold) · an optional LEVEL UP badge. Every part below the title is optional — a
 *  payload with no meter renders as eyebrow + title, never as an empty pill or `+undefined`. */
function RewardBody({ toast }: { toast: RewardToast }) {
  return (
    <div className="t-pad">
      <div className="t-eyebrow">{toast.eyebrow}</div>
      <div className="t-title">
        {toast.title}
        {toast.meta && <span className="t-meta"> · {toast.meta}</span>}
      </div>
      {toast.meter && (
        <div className="t-meter">
          <span className="t-mdot" aria-hidden="true" />
          <span className="t-mlabel">{toast.meter.label}</span>
          <span className="t-mdelta">+{toast.meter.delta}</span>
        </div>
      )}
      {toast.levelUp && (
        <span className="t-lvup">
          <span aria-hidden="true">★</span> LEVEL UP · {toast.levelUp.label} ·
          {' '}Lv{toast.levelUp.from} → {toast.levelUp.to}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Írd meg a reward-kártya CSS-ét**

A `frontend/src/styles/prototype.css` Toast blokkjának végére (a `@media (prefers-reduced-motion…)` ELÉ) illeszd be:

```css
/* Reward variant — DS §Notification: sage→terracotta gradient card */
.toast[data-kind="reward"] {
  background: linear-gradient(135deg, rgba(123,143,107,0.96), rgba(196,131,106,0.88));
  border: 1px solid rgba(255,255,255,0.22);
}
.t-eyebrow {
  font-size: 11px; font-weight: 700; letter-spacing: 0.22em;
  text-transform: uppercase; color: rgba(255,255,255,0.80);
  margin-bottom: 6px; padding-right: 26px;
}
.t-title {
  font-family: 'Fraunces', 'Crimson Pro', serif;
  font-size: 16px; font-weight: 500; line-height: 1.25; letter-spacing: -0.005em;
}
.t-meta { font-style: italic; font-weight: 400; color: rgba(255,255,255,0.72); }
.t-meter {
  display: flex; align-items: center; gap: 9px;
  margin-top: 10px; padding: 7px 11px;
  border-radius: 12px; background: rgba(0,0,0,0.28);
}
.t-mdot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #b8cdaa; box-shadow: 0 0 7px rgba(184,205,170,0.85);
  flex-shrink: 0;
}
.t-mlabel { font-size: 11.5px; font-weight: 700; letter-spacing: 0.01em; }
.t-mdelta {
  margin-left: auto;
  font-size: 15px; font-weight: 800; letter-spacing: -0.01em; line-height: 1;
  color: #ffd87a; font-variant-numeric: tabular-nums;
  animation: toast-delta-pop 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes toast-delta-pop {
  0% { transform: scale(0.6); } 60% { transform: scale(1.18); } 100% { transform: scale(1); }
}
.t-lvup {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 8px; padding: 4px 10px; border-radius: 999px;
  background: rgba(0,0,0,0.30);
  border: 1px solid rgba(255,216,122,0.35);
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.08em; color: #ffd87a;
}
```

Egészítsd ki a reduced-motion szabályt, hogy a delta-pop is álljon:

```css
.toast.is-reduced .t-mdelta { animation: none; }
@media (prefers-reduced-motion: reduce) {
  .t-mdelta { animation: none; }
}
```

- [ ] **Step 5: Futtasd — zöldnek kell lennie**

Futtasd: `cd frontend && pnpm test -- --run src/shared/ui/ToastProvider.test.tsx`
Várt: PASS, 12 teszt.

**Ha a `LEVEL UP · Mentális · Lv3 → 4` asszert bukik** whitespace miatt: a `toHaveTextContent` normalizálja a szóközöket, de a JSX sortörései extra szóközt hozhatnak. Ez esetben tedd a badge szövegét egyetlen template literalba: `{`LEVEL UP · ${toast.levelUp.label} · Lv${toast.levelUp.from} → ${toast.levelUp.to}`}` a ★ span után.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/ui/ToastProvider.tsx frontend/src/shared/ui/ToastProvider.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(shared): DS reward toast kártya renderelése (mezo-k5sa)"
```

---

### Task 5: Mock mód — a dupla toast megszüntetése

Mock módban a habit-check ma egy generikus `+10 XP` toastot emitál a `gamificationStore`-ból. A reward toast ezt lefedi, tehát a habit-check hívása elnémítja **kizárólag azt az egy sort** — az account-szintlépés, a streak-mérföldkő és a streak-mentő toastja megmarad, mert más eseményről szólnak.

**Files:**
- Modify: `frontend/src/data/gamification/gamificationStore.ts:29-32` (signature) és `:76-81` (a toast-lánc)
- Modify: `frontend/src/data/gamification/gamificationStore.test.ts`
- Modify: `frontend/src/data/habit/habitHooks.ts:78`

**Interfaces:**
- Consumes: semmit az előző taskokból.
- Produces: `awardGamificationEvent(qc, event: { type: XpEventType; date?: string; xpOverride?: number; silentXp?: boolean }): AwardResult` — a visszatérési típus (`AwardResult`) változatlan.

- [ ] **Step 1: Írd meg a bukó teszteket**

Fűzd hozzá a `frontend/src/data/gamification/gamificationStore.test.ts` végéhez (a meglévő importokat és fixture-öket használva — nyisd meg a fájlt, és igazodj a benne lévő setup-mintához):

```ts
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'

describe('awardGamificationEvent — silentXp', () => {
  const listen = () => {
    const seen: ToastMessage[] = []
    const off = onToast((t) => seen.push(t))
    return { seen, off }
  }

  it('silentXp nélkül kiírja a sima +XP sort', () => {
    const qc = makeQc()   // a fájl meglévő helper-e; ha másképp hívják, azt használd
    const { seen, off } = listen()
    awardGamificationEvent(qc, { type: 'HABIT', xpOverride: 10 })
    off()
    expect(seen.some((t) => t.kind === 'success' && 'text' in t && t.text === '+10 XP')).toBe(true)
  })

  it('silentXp: true esetén a sima +XP sor elmarad', () => {
    const qc = makeQc()
    const { seen, off } = listen()
    awardGamificationEvent(qc, { type: 'HABIT', xpOverride: 10, silentXp: true })
    off()
    expect(seen.some((t) => 'text' in t && t.text === '+10 XP')).toBe(false)
  })

  it('silentXp a szintlépés toastot NEM némítja el', () => {
    const qc = makeQc()
    const { seen, off } = listen()
    // annyi XP, ami biztosan szintet léptet a mock profilon
    awardGamificationEvent(qc, { type: 'HABIT', xpOverride: 100_000, silentXp: true })
    off()
    expect(seen.some((t) => 'text' in t && t.text.includes('Szint'))).toBe(true)
  })

  it('a visszatérési érték változatlan silentXp mellett is', () => {
    const qc = makeQc()
    const r = awardGamificationEvent(qc, { type: 'HABIT', xpOverride: 10, silentXp: true })
    expect(r.xpAwarded).toBe(10)
  })
})
```

**Mielőtt futtatod:** nyisd meg a `gamificationStore.test.ts`-t, és nézd meg, hogyan hoz létre `QueryClient`-et (`makeQc`, `new QueryClient()`, vagy egy `beforeEach`-ben inicializált változó). Igazítsd a fenti `makeQc()` hívásokat ahhoz, ami ott van — **ne vezess be új helpert**, ha már van.

- [ ] **Step 2: Futtasd — buknia kell**

Futtasd: `cd frontend && pnpm test -- --run src/data/gamification/gamificationStore.test.ts`
Várt: FAIL — a `silentXp` nincs a paraméter típusában (TS hiba), és a némító teszt megkapja a `+10 XP` toastot.

- [ ] **Step 3: Vedd fel a `silentXp` opciót**

A `frontend/src/data/gamification/gamificationStore.ts`-ben módosítsd a signature-t (29-32. sor):

```ts
export function awardGamificationEvent(
  qc: QueryClient,
  event: { type: XpEventType; date?: string; xpOverride?: number; silentXp?: boolean },
): AwardResult {
```

És a doc-kommentet (25-28. sor) egészítsd ki egy mondattal:

```ts
/** Mock-mode account progression: XP (capped), daily streak (+saver), coins, level-ups.
 *  Called from the mock arms of every logging mutation (spec §4.3). Emits ONE toast per
 *  award — level-up > streak milestone > saver notice > plain XP. `silentXp` suppresses
 *  ONLY that last, plain `+N XP` line — for call sites that already emit their own richer
 *  reward toast (habit check, mezo-k5sa); the level-up / streak / saver notices are about
 *  DIFFERENT events and always still fire. Real mode never calls this; the backend awards
 *  server-side (mezo-huzd). */
```

Végül a toast-láncban (76-81. sor) csak az utolsó ágat kapuzd:

```ts
  if (leveledUp) emitToast({ kind: 'success', text: `🎉 Szint ${level} — +${LEVEL_UP_COINS} 🪙` })
  else if (milestone > 0)
    emitToast({ kind: 'success', text: `🔥 ${next.streakDays} napos sorozat — +${milestone} 🪙` })
  else if (saverUsed)
    emitToast({ kind: 'info', text: '🧊 Streak-mentő elhasználva — a sorozat megmaradt' })
  else if (!event.silentXp) emitToast({ kind: 'success', text: `+${xp} XP` })
```

- [ ] **Step 4: Add át a `silentXp`-t a habit-checkből**

A `frontend/src/data/habit/habitHooks.ts` 78. sorát:

```ts
        awardGamificationEvent(qc, { type: 'HABIT', xpOverride: xp })
```

cseréld erre:

```ts
        // The call site emits its own DS reward toast for the check (mezo-k5sa), so the
        // generic „+N XP" line would be a duplicate — the level/streak notices still fire.
        awardGamificationEvent(qc, { type: 'HABIT', xpOverride: xp, silentXp: true })
```

- [ ] **Step 5: Futtasd — zöldnek kell lennie**

Futtasd: `cd frontend && pnpm test -- --run src/data/gamification src/data/habit`
Várt: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/gamification/gamificationStore.ts frontend/src/data/gamification/gamificationStore.test.ts frontend/src/data/habit/habitHooks.ts
git commit -m "feat(data): silentXp — a habit-pipa saját reward toastja váltja a generikus XP sort (mezo-k5sa)"
```

---

### Task 6: `TodayPage` — a három hívóhely átkötése

**Files:**
- Modify: `frontend/src/features/today/pages/TodayPage.tsx:150-161` (a két consume-effekt) és `:289` (a `check` ág)
- Modify: `frontend/src/features/today/pages/TodayPage.dispatch.test.tsx:206-227`

**Interfaces:**
- Consumes: `buildHabitRewardToast`, `buildQuestRewardToast` (Task 2); `emitToast` (Task 1).
- Produces: nincs új export.

**Amit tudnod kell a fájlról:** a `TodayPage` már tartalmaz egy `chainProgress(chainKey: string): { done: number; total: number }` helper-t (~301. sor) — ez adja az eyebrow számlálóját. A `habits` tömb elemei `HabitItem`-ek (`{ key, chain, title, xp, status, … }`). Az `act()` dispatcher `a.habit` néven éri el a pipálandó habitet.

- [ ] **Step 1: Írd meg a bukó teszteket**

A `frontend/src/features/today/pages/TodayPage.dispatch.test.tsx`-ben cseréld le a teljes `describe('TodayPage — consume-once level-ups', …)` blokkot (206-227. sor) erre:

```tsx
describe('TodayPage — consume-once reward toasts', () => {
  const listen = () => {
    const seen: ToastMessage[] = []
    const off = onToast((t) => seen.push(t))
    return { seen, off }
  }

  test('egy habit level-up EGYSZER dob reward toastot és fogyasztódik', async () => {
    setup({ habitLevelUps: [gymLevelUpMock] })
    const { seen, off } = listen()
    renderToday()
    await waitFor(() => expect(consumeHabitLevelUps).toHaveBeenCalledTimes(1))
    off()
    expect(seen.filter((t) => t.kind === 'reward')).toHaveLength(1)
    // és NEM nyílt full-screen overlay
    expect(screen.queryByRole('dialog', { name: 'Szintlépés' })).toBeNull()
  })

  test('egy quest level-up EGYSZER dob reward toastot és fogyasztódik', async () => {
    setup({ questLevelUps: [gymLevelUpMock] })
    const { seen, off } = listen()
    renderToday()
    await waitFor(() => expect(consumeQuestLevelUps).toHaveBeenCalledTimes(1))
    off()
    expect(seen.filter((t) => t.kind === 'reward')).toHaveLength(1)
    expect(screen.queryByRole('dialog', { name: 'Szintlépés' })).toBeNull()
  })

  test('üres payload esetén nincs toast és nincs fogyasztás', () => {
    const { seen, off } = listen()
    renderToday()
    off()
    expect(seen.filter((t) => t.kind === 'reward')).toHaveLength(0)
    expect(consumeHabitLevelUps).not.toHaveBeenCalled()
    expect(consumeQuestLevelUps).not.toHaveBeenCalled()
  })
})

describe('TodayPage — a kézi pipa reward toastot dob', () => {
  test('a pipa a habit nevével és a lánc állásával jelez vissza', async () => {
    renderToday()
    const seen: ToastMessage[] = []
    const off = onToast((t) => seen.push(t))

    fireEvent.click(within(rowOf('MANUAL lánc')).getByRole('button'))
    await waitFor(() => expect(check).toHaveBeenCalledWith('caffeine_cutoff'))
    await waitFor(() => expect(seen.some((t) => t.kind === 'reward')).toBe(true))
    off()

    const reward = seen.find((t) => t.kind === 'reward')
    expect(reward).toMatchObject({ kind: 'reward', title: 'MANUAL lánc' })
    expect((reward as { eyebrow: string }).eyebrow).toMatch(/^Szokás/)
  })
})
```

Egészítsd ki a fájl importjait:

```tsx
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'
```

és győződj meg róla, hogy a `waitFor` szerepel a `@testing-library/react` importban (ha nincs, vedd fel a meglévő `fireEvent, render, screen, within` mellé).

- [ ] **Step 2: Futtasd — buknia kell**

Futtasd: `cd frontend && pnpm test -- --run src/features/today/pages/TodayPage.dispatch.test.tsx`
Várt: FAIL — nem érkezik `reward` toast (a lap még `showLevelUp`-ot hív).

- [ ] **Step 3: Kösd át a két consume-effektet**

A `frontend/src/features/today/pages/TodayPage.tsx` 147-161. sorát cseréld erre:

```tsx
  // Consume-once reward toasts: quest and habit completions are evaluated SERVER-side on a day
  // read, so their celebration arrives on the cached day rather than from a mutation's
  // resolution. Without the consume the payload replays on every remount within gcTime.
  // Since mezo-k5sa these celebrate in a DS toast, not the full-screen LevelUpScreen — that
  // overlay stays the Train flows' (gym/sport/run) alone.
  useEffect(() => {
    if (questLevelUps.length > 0) {
      const lu = questLevelUps[0]
      emitToast(buildQuestRewardToast({ title: lu.workoutLabel ?? 'Küldetés teljesítve', levelUp: lu }))
      consumeQuestLevelUps()
    }
  }, [questLevelUps, consumeQuestLevelUps])
  useEffect(() => {
    if (habitLevelUps.length > 0) {
      const lu = habitLevelUps[0]
      emitToast(buildHabitRewardToast({
        title: lu.workoutLabel ?? 'Szokás kész',
        chainDone: 0, chainTotal: 0,   // a server-evaluated row carries no chain context here
        xp: 0,
        levelUp: lu,
      }))
      consumeHabitLevelUps()
    }
  }, [habitLevelUps, consumeHabitLevelUps])
```

- [ ] **Step 4: Kösd át a kézi pipát**

A `TodayPage.tsx` `act()` dispatcherének `check` ágát (289. sor környéke):

```tsx
      case 'check':
        check(a.habit.key).then((lu) => lu?.[0] && showLevelUp(lu[0]))
        return
```

cseréld erre:

```tsx
      case 'check': {
        // The eyebrow counts this row as done already (`chainDone + 1` inside the builder) —
        // the same number the list prints once the day read lands.
        const { done, total } = chainProgress(a.habit.chain)
        check(a.habit.key).then((lu) =>
          emitToast(buildHabitRewardToast({
            title: a.habit.title,
            chainDone: done,
            chainTotal: total,
            xp: a.habit.xp,
            levelUp: lu?.[0],
          })),
        )
        return
      }
```

**Fontos:** a `chainProgress` a fájlban lentebb (~301. sor) van definiálva, mint az `act()`. Ha `const`-tal deklarált arrow function, akkor **hoisting nélkül** hívnád — de az `act()` csak eseménykor fut, addigra a `chainProgress` inicializálva van, tehát ez működik. Ha a TypeScript vagy az ESLint mégis panaszkodik („used before defined"), **mozgasd a `chainProgress` definícióját az `act()` ELÉ** — a `habits` és a `chainProgress` közé semmi más nem ékelődik.

Egészítsd ki a `TodayPage.tsx` importjait:

```tsx
import { buildHabitRewardToast, buildQuestRewardToast } from '@/features/progression/logic/rewardToast'
import { emitToast } from '@/shared/lib/toastBus'
```

Töröld a `const { showLevelUp } = useLevelUp()` sort (134.) és a `useLevelUp` importját — ha a `showLevelUp`-ra a fájlban már sehol nincs hivatkozás. Ellenőrizd: `grep -n "showLevelUp" frontend/src/features/today/pages/TodayPage.tsx` — üresnek kell lennie.

- [ ] **Step 5: Futtasd — zöldnek kell lennie**

Futtasd: `cd frontend && pnpm test -- --run src/features/today/pages/TodayPage.dispatch.test.tsx src/features/today/pages/TodayPage.test.tsx`
Várt: PASS.

**Ha a `TodayPage.test.tsx` bukik** azzal, hogy egy `LevelUpProvider` wrapper nélkül renderel: a `LevelUpProvider` továbbra is a `AppLayout`-ban van, és a `TodayPage` már nem használja — a teszt wrappere maradhat, csak feleslegessé válik. **Ne töröld** a `LevelUpProvider`-t a tesztből; a Task 7 után a Today teljes fájában senki nem hívja, de a provider mountolása ártalmatlan.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/today/pages/TodayPage.tsx frontend/src/features/today/pages/TodayPage.dispatch.test.tsx
git commit -m "feat(today): a pipa és a consume-once payloadok reward toastot dobnak (mezo-k5sa)"
```

---

### Task 7: A maradék három hívóhely

**Files:**
- Modify: `frontend/src/features/today/components/DaypartEvening.tsx:65, 108-110`
- Modify: `frontend/src/features/today/components/DailyQuestsCard.tsx:24, 27-32`
- Modify: `frontend/src/features/today/sheets/ActivityLogSheet.tsx:25, 31-34`
- Modify: `frontend/src/features/today/components/DaypartEvening.test.tsx`

**Interfaces:**
- Consumes: `buildHabitRewardToast`, `buildQuestRewardToast` (Task 2); `emitToast` (Task 1).
- Produces: nincs új export.

- [ ] **Step 1: Írd meg a bukó tesztet a wind-down pipára**

Fűzd hozzá a `frontend/src/features/today/components/DaypartEvening.test.tsx` végéhez (igazodva a fájl meglévő render-helperéhez — nyisd meg, és nézd meg, hogyan mountolja a komponenst és hogyan mockolja a `useHabitActions`-t):

```tsx
test('a wind-down pipa reward toastot dob, nem full-screent', async () => {
  const seen: ToastMessage[] = []
  const off = onToast((t) => seen.push(t))

  renderEvening({ phase: 'winddown' })   // a fájl meglévő helper-e / setupja
  fireEvent.click(screen.getByRole('button', { name: /pipa/i }))

  await waitFor(() => expect(seen.some((t) => t.kind === 'reward')).toBe(true))
  off()
  expect(screen.queryByRole('dialog', { name: 'Szintlépés' })).toBeNull()
})
```

Importáld: `import { onToast, type ToastMessage } from '@/shared/lib/toastBus'`.

- [ ] **Step 2: Futtasd — buknia kell**

Futtasd: `cd frontend && pnpm test -- --run src/features/today/components/DaypartEvening.test.tsx`
Várt: FAIL — nem érkezik `reward` toast.

- [ ] **Step 3: Kösd át a `DaypartEvening` wind-down pipáját**

A `frontend/src/features/today/components/DaypartEvening.tsx` 108-110. sorát:

```tsx
  const doWindDown = () => {
    check('wind_down').then((lu) => lu?.[0] && showLevelUp(lu[0]))
  }
```

cseréld erre:

```tsx
  const doWindDown = () => {
    // The banner owns a single habit, not a chain position — the eyebrow drops the counter
    // (chainTotal 0) rather than printing a number this surface cannot know.
    check('wind_down').then((lu) =>
      emitToast(buildHabitRewardToast({
        title: windDownHabit?.title ?? 'Wind-down',
        chainDone: 0,
        chainTotal: 0,
        xp: windDownHabit?.xp ?? 0,
        levelUp: lu?.[0],
      })),
    )
  }
```

Töröld a `const { showLevelUp } = useLevelUp()` sort (65.) és a `useLevelUp` importot (18.). Vedd fel:

```tsx
import { buildHabitRewardToast } from '@/features/progression/logic/rewardToast'
import { emitToast } from '@/shared/lib/toastBus'
```

- [ ] **Step 4: Kösd át a `DailyQuestsCard`-ot**

A `frontend/src/features/today/components/DailyQuestsCard.tsx` 27-32. sorát:

```tsx
  useEffect(() => {
    if (levelUps.length > 0) {
      showLevelUp(levelUps[0])
      consumeLevelUps() // clear from the cache — a remount must not replay the celebration
    }
  }, [levelUps, showLevelUp, consumeLevelUps])
```

cseréld erre:

```tsx
  useEffect(() => {
    if (levelUps.length > 0) {
      const lu = levelUps[0]
      emitToast(buildQuestRewardToast({ title: lu.workoutLabel ?? 'Küldetés teljesítve', levelUp: lu }))
      consumeLevelUps() // clear from the cache — a remount must not replay the celebration
    }
  }, [levelUps, consumeLevelUps])
```

Töröld a `const { showLevelUp } = useLevelUp()` sort (24.) és a `useLevelUp` importot (3.). Vedd fel:

```tsx
import { buildQuestRewardToast } from '@/features/progression/logic/rewardToast'
import { emitToast } from '@/shared/lib/toastBus'
```

Frissítsd a komponens doc-kommentjét (15-19. sor) — az utolsó mondat („…which is handed to the global overlay.") helyett: `…which is celebrated in a DS reward toast (mezo-k5sa), never the full-screen overlay.`

- [ ] **Step 5: Kösd át az `ActivityLogSheet`-et**

A `frontend/src/features/today/sheets/ActivityLogSheet.tsx` 31-34. sorát:

```tsx
  const surfaceLevelUps = (r: ActivityWriteResult) => {
    const payload = r.levelUps.find((l) => l.levelUps.length > 0) ?? r.levelUps[0]
    if (payload) showLevelUp(payload)
  }
```

cseréld erre:

```tsx
  const surfaceLevelUps = (r: ActivityWriteResult) => {
    const payload = r.levelUps.find((l) => l.levelUps.length > 0) ?? r.levelUps[0]
    if (payload) {
      emitToast(buildQuestRewardToast({
        eyebrow: 'Naplózva',
        title: payload.workoutLabel ?? 'Tevékenység',
        levelUp: payload,
      }))
    }
  }
```

Töröld a `const { showLevelUp } = useLevelUp()` sort (25.) és a `useLevelUp` importot (5.). Vedd fel:

```tsx
import { buildQuestRewardToast } from '@/features/progression/logic/rewardToast'
import { emitToast } from '@/shared/lib/toastBus'
```

- [ ] **Step 6: Futtasd — zöldnek kell lennie**

Futtasd: `cd frontend && pnpm test -- --run src/features/today`
Várt: PASS.

- [ ] **Step 7: Ellenőrizd a hatókör-határt**

Futtasd:

```bash
cd frontend && grep -rn "useLevelUp\|showLevelUp" src --include="*.tsx" | grep -v test
```

Várt kimenet: **kizárólag** a `features/progression/LevelUpProvider.tsx` és a négy Train-oldal (`features/train/pages/{ActiveWorkoutPage,SportPage,TrainTodayPage,RunningPage}.tsx`). Ha bármi más felbukkan a `features/today` alatt, azt a hívóhelyet kihagytad.

Futtasd: `cd frontend && pnpm test -- --run src/features/train src/features/progression`
Várt: PASS — a Train-flow-k és a `LevelUpScreen` tesztjei **változatlanul** zöldek. Ez a hatókör-határ bizonyítéka.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/today/components/DaypartEvening.tsx frontend/src/features/today/components/DaypartEvening.test.tsx frontend/src/features/today/components/DailyQuestsCard.tsx frontend/src/features/today/sheets/ActivityLogSheet.tsx
git commit -m "feat(today): wind-down, quest-kártya és activity-napló reward toastra (mezo-k5sa)"
```

---

### Task 8: Teljes kapu, futásidejű ellenőrzés és dokumentáció

**Files:**
- Modify: `docs/features/_platform-design-system.md`
- Modify: `docs/features/today.md`
- Modify: `docs/features/habit.md`
- Modify: `docs/features/growth.md`

**Interfaces:**
- Consumes: minden korábbi task.
- Produces: nincs kód.

- [ ] **Step 1: Futtasd a teljes kaput mindkét módban**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Várt: mindhárom sikeres. **Ha bármelyik piros, itt állj meg és javítsd** — dokumentálni csak zöld kód mellett szabad.

- [ ] **Step 2: Ellenőrizd futásidőben**

Használd a `verify` skill receptjét: indítsd mock módban a frontendet, nyisd meg a Today-t, és pipálj végig egy láncot. Ellenőrizd szemmel:
1. a toast jobbra fent jelenik meg, nem takarja a BottomNavot,
2. több pipa **egymás alá** kerül (nem cseréli le egymást), a régebbi kisebb és halványabb,
3. a toast ~4 másodperc után magától eltűnik, a ✕ azonnal zárja,
4. a lánc végén a „🌅 Tökéletes reggel" a legutolsó pipa toastja **fölé** kerül, nem helyette,
5. **nem** nyílik teljes képernyős overlay.

Ha valami nem stimmel, javítsd, és futtasd újra a Step 1 kapuját.

- [ ] **Step 3: Frissítsd a design system feature-doksit**

A `docs/features/_platform-design-system.md`-ben keresd meg a Toast primitív leírását (`grep -n "Toast" docs/features/_platform-design-system.md`), és írd át a v2 viselkedésre. Rögzítsd:
- a `ToastMessage` diszkriminált unió (`SimpleToast` | `RewardToast`) és hogy a `SimpleToast` alakja szándékosan változatlan,
- a stack (max 3 látható, `scale` 0.96/0.93, queue cap 20, legújabb elöl),
- az auto-dismiss idők (reward/success/info 4s, error 6s) és a ✕,
- hogy **egyetlen host van** és soha nem mountolunk másodikat,
- `file:line` mutatók: `frontend/src/shared/ui/ToastProvider.tsx`, `frontend/src/shared/lib/toastBus.ts`, a `.toast*` CSS a `frontend/src/styles/prototype.css`-ben.

- [ ] **Step 4: Frissítsd a Today, habit és growth doksikat**

- `docs/features/today.md` — a Today visszajelzési modellje: az öt forrás (kézi pipa, derived habit, quest, quest-kártya, activity-napló) reward toastot dob; a `LevelUpScreen` **kizárólag** a Train-flow-ké. Mutass a `features/progression/logic/rewardToast.ts` builderre.
- `docs/features/habit.md` — a pipa visszajelzése: eyebrow a lánc állásával (optimista `done + 1`), cím a habit neve, meter a skill neve (real) vagy `XP` (mock), level-up badge valódi szintlépéskor.
- `docs/features/growth.md` — az `awardGamificationEvent` hívási listánál jegyezd fel, hogy a habit-check `silentXp: true`-val hív, és hogy ez **csak** a sima `+N XP` sort némítja.

Mindegyik doksiban **a helyén írd át** a szöveget — ne fűzz hozzá changelogot, verziószámot vagy dátumozott bejegyzést (a git a history).

- [ ] **Step 5: Futtasd a doc-lintet**

```bash
node scripts/lint-docs.mjs
```

Várt: nincs hiba, és az érintett feature-doksik staleness-jelzése tiszta. Ha törött linket vagy elavult `key_files` bejegyzést jelez, javítsd.

- [ ] **Step 6: Zárd le a bd issue-t és commitolj**

```bash
bd close mezo-k5sa
git add docs/features/ .beads/
git commit -m "docs(features): reward toast — design-system, today, habit, growth (mezo-k5sa)"
```

- [ ] **Step 7: Nyisd meg a PR-t és várd meg a zöld CI-t**

```bash
git push -u origin claude/habitek-notification-toast-a7dc9a
```

Ezután nyiss self-PR-t, várd meg a CI zöldet, majd **lokálisan** mergelj `--no-ff`-fel a mainbe, és pushold a main-t (a PR magától záródik). A részletes folyamat a `CLAUDE.md` „Git Workflow" szakaszában.

---

## Self-Review

**Spec-lefedettség:**

| Spec szakasz | Task |
|---|---|
| §2 hatókör — 5 hívóhely | 6 (3 hívóhely) + 7 (3 hívóhely: wind-down, quest-kártya, activity) |
| §2 hatókör-határ (Train érintetlen) | 7 / Step 7 — explicit `grep` + a Train tesztek futtatása |
| §4 3-rétegű architektúra | 1 (bus) + 2 (builder) + 3-4 (render) |
| §5 payload alak | 1 |
| §6 render host (anchor, stack, animáció, dismiss, a11y, reduced motion) | 3 (viselkedés + stack CSS) + 4 (reward kártya) |
| §7 builder + a két mód + `silentXp` + eyebrow-számláló | 2 (builder) + 5 (`silentXp`) + 6 (`chainProgress` bekötése) |
| §8 hibakezelés (destruktív variáns, üres gains, provider-mentes no-op) | 1 (no-op teszt) + 2 (üres gains teszt) + 3 (error 6s + `data-kind` CSS) |
| §9 tesztelés (5 teszt-fájl + kapu + futásidejű ellenőrzés) | 1, 2, 3, 4, 5, 6, 7 tesztjei + 8 / Step 1-2 |
| §10 dokumentáció (4 feature-doksi + lint) | 8 / Step 3-5 |
| §11 kockázatok | a `SimpleToast` változatlansága az 1. taskban van rögzítve és a 3. task regressziós tesztjei őrzik |

**Placeholder-ellenőrzés:** nincs TBD/TODO; minden kódlépés valódi kódot tartalmaz; a „nézd meg a fájl meglévő helper-ét" utasítások (Task 5 Step 1, Task 7 Step 1) konkrét fájlt és konkrét keresendő dolgot neveznek meg, nem homályos irányt.

**Típus-konzisztencia:** `RewardToast` mezőnevei (`eyebrow`/`title`/`meta`/`meter{label,delta}`/`levelUp{label,from,to}`) azonosak az 1., 2., 4., 6. és 7. taskban. A builder nevei (`buildHabitRewardToast`/`buildQuestRewardToast`) és paraméterei (`title`/`chainDone`/`chainTotal`/`xp`/`levelUp`, illetve `title`/`meta`/`eyebrow`/`levelUp`) végig egyeznek. `isRewardToast` az 1. taskban definiált, a 3.-ban használt. `silentXp` az 5. taskban definiált és ott is használt.

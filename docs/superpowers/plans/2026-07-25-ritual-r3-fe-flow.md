# Ritual R3 — Napzárás FE Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The full-screen five-act Napzárás flow at `/ritual` — arrival, day story, open-loop closing, XP/coin harvest, release-with-handoff — plus the Today `RitualCard` entry point.

**Architecture:** New `features/ritual/` + `data/ritual/` per the house four-layer rule. The recap is pure composition over existing hooks (zero new fetches beside the ritual day read); act 3 reuses the existing sheets; act 4 reads `useGamificationDay` (R1) + fires the idempotent close (R2). Animations are CSS-first (`rz-*` family extending the Napív `np-*` vocabulary) + one shared `CountUp` primitive. Spec: `docs/superpowers/specs/2026-07-24-daily-closing-ritual-design.md` §4/§7; approved visual mockups (local design reference): `.superpowers/brainstorm/96484-1784893145/content/ritual-flow.html` + `evening-timing.html`.

**Tech Stack:** React 19, TanStack Query dual-mode hooks, Tailwind v4 + `prototype.css` custom classes, Vitest+RTL, MSW.

**bd:** `mezo-ilsj` (claim: `bd update mezo-ilsj --claim`). **Branch:** `feat/ritual-flow` off main.

## Global Constraints

- Frontend conventions are LAW (`docs/references/frontend_conventions.md`): four layers; routed leaf = `*Page`; modals = `*Sheet`; pure logic in `logic/`; hooks ONLY from `@/data/hooks`; deep absolute `@/*` imports, no new barrels; tests colocated; `shared/ui` domain-free.
- **Dual-mode invariant:** real mode never falls back to a mock seed (`useDualQuery`, `realEmpty` honest-empty); both `pnpm test` modes + `pnpm build` green at every task end.
- **Midnight-wrap (BINDING, from the R2 final review):** the window's `opensAt`/`prepStartsAt`/`bedTime` are `HH:mm` strings that wrap at midnight — NEVER compare lexically; all window math goes through the pure `ritualWindowState` (Task 1) which handles wrap explicitly.
- **ADR 0010 tone:** exit ✕ anytime writes nothing (close fires only on entering act 4); expired quests dim, never red; bad-day softening (thin data → warm copy, no gap lists); no hard gate on the sleep-prep flow.
- The ritual is its OWN celebration: the global `LevelUpScreen` overlay does NOT fire inside the flow — habit levelUps produced by the close are consumed silently (`consumeLevelUps`) and their content is rendered by the Harvest stage itself.
- Ritual window/close API (R2, live): `GET /api/ritual/day/{date}` → `{date, closed, closedAt?, window{opensAt, prepStartsAt, bedTime}}`; `POST /api/ritual/close {date}` idempotent, today-only. Harvest read (R1, live): `useGamificationDay(date)` → `{xpBySource[{source,xp}], xpTotal, coinEvents[{reason,amount}], coinTotal, streakDays, streakAlive}`.
- Every animation behind `prefers-reduced-motion` guards (the `prototype.css` idiom); component tests stub `matchMedia` (the `LevelUpScreen.test.tsx` `stubReduced` pattern).
- HU copy exactly as given in each task (fixed ritual lines are part of the psychology design — do not paraphrase).
- Evening ecosystem coherence: the flow HANDS OFF to the existing wind-down world (`WindDownBanner` phases / evening `RoutineCard`) — it never duplicates their function.

---

### Task 1: Data layer — `data/ritual/` + pure window logic

**Files:**
- Create: `frontend/src/data/ritual/ritualApi.ts`
- Create: `frontend/src/data/ritual/ritualMock.ts`
- Create: `frontend/src/data/ritual/ritualHooks.ts`
- Create: `frontend/src/features/ritual/logic/ritualWindow.ts`
- Modify: `frontend/src/data/types.ts` (RitualDay/RitualWindow types), `frontend/src/data/hooks.ts` (barrel line)
- Modify: `frontend/src/test/msw/handlers.ts` (2 fixtures)
- Test: `frontend/src/data/ritual/ritualHooks.test.tsx`, `frontend/src/features/ritual/logic/ritualWindow.test.ts`

**Interfaces:**
- Consumes: generated `components['schemas']['RitualDayResponse']` from `api.gen.ts`; `useDualQuery`; `apiFetch` (`@/data/_client/api`); `awardGamificationEvent` (`@/data/gamification/gamificationStore`); `localDateString`.
- Produces (later tasks rely on these exact shapes):
  - `types.ts`: `RitualWindow { opensAt: string; prepStartsAt: string; bedTime: string }`; `RitualDay { date: string; closed: boolean; closedAt: string | null; window: RitualWindow }`
  - `useRitualDay(date: string): { data: RitualDay; isPending: boolean }` — query key `['ritualDay', date]`
  - `useRitualActions(date: string): { close: () => Promise<RitualDay>; pending: boolean }`
  - `ritualWindowState(now: Date, w: RitualWindow): 'waiting' | 'open'` + `minutesUntil(now: Date, hhmm: string): number`

- [ ] **Step 1: Failing window-logic test** (`ritualWindow.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { minutesUntil, ritualWindowState } from '@/features/ritual/logic/ritualWindow'

const W = { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' }
const at = (h: number, m: number) => new Date(2026, 6, 25, h, m)

describe('ritualWindowState', () => {
  it('waiting before opensAt', () => expect(ritualWindowState(at(20, 0), W)).toBe('waiting'))
  it('open from opensAt', () => expect(ritualWindowState(at(21, 15), W)).toBe('open'))
  it('stays open after bedTime (soft window — the day is still closable)', () =>
    expect(ritualWindowState(at(23, 30), W)).toBe('open'))
  it('midnight-wrap: bed 00:30 → opensAt 23:15 opens late evening, still waiting at 21:00', () => {
    const wrap = { opensAt: '23:15', prepStartsAt: '23:45', bedTime: '00:30' }
    expect(ritualWindowState(at(21, 0), wrap)).toBe('waiting')
    expect(ritualWindowState(at(23, 20), wrap)).toBe('open')
    expect(ritualWindowState(at(0, 10), wrap)).toBe('open')
  })
})

describe('minutesUntil', () => {
  it('same evening', () => expect(minutesUntil(at(20, 0), '21:15')).toBe(75))
  it('wraps past midnight', () => expect(minutesUntil(at(23, 50), '00:30')).toBe(40))
})
```

Run: `cd frontend && pnpm test -- src/features/ritual/logic/ritualWindow.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement `ritualWindow.ts`** — anchor everything to minutes-relative-to-`opensAt` so the wrap is handled once:

```ts
/** Pure evening-window math. HH:mm strings wrap at midnight (R2 final-review binding
 *  constraint): never compare lexically — everything is minutes relative to opensAt. */
import type { RitualWindow } from '@/data/types'

const toMins = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Minutes from `now` forward to the next occurrence of `hhmm` (0..1439). */
export function minutesUntil(now: Date, hhmm: string): number {
  const nowM = now.getHours() * 60 + now.getMinutes()
  return (toMins(hhmm) - nowM + 1440) % 1440
}

/** The window opens at opensAt and stays open for the rest of the evening (soft window —
 *  ADR 0010: the CTA nudges, never locks). "Open" = we are within 12h AFTER opensAt,
 *  measured forward from opensAt with wrap; otherwise the evening hasn't arrived yet. */
export function ritualWindowState(now: Date, w: RitualWindow): 'waiting' | 'open' {
  const nowM = now.getHours() * 60 + now.getMinutes()
  const sinceOpen = (nowM - toMins(w.opensAt) + 1440) % 1440
  return sinceOpen < 12 * 60 ? 'open' : 'waiting'
}
```

Run the test → PASS.

- [ ] **Step 3: Failing hooks test** (`ritualHooks.test.tsx`, mirror `data/intention/intentionHooks.test.tsx`'s dual-mode structure): mock mode returns the seed synchronously (open window, `closed: false`); real mode returns the honest-empty day while unresolved and the MSW fixture after; mock `close()` patches the cache (`closed: true`) + calls `awardGamificationEvent` with `{type:'HABIT', xpOverride: 10}` exactly once (repeat close → no second award); real `close()` POSTs and invalidates `['ritualDay',date]`, `['habitDay',date]`, `['dailyQuests',date]`, `['gamificationDay',date]`, `['gamification']`, `['progressionProfile']` (assert with a spy on `queryClient.invalidateQueries`, the intention-test idiom).

- [ ] **Step 4: Implement the data layer.**

`types.ts` (append near the intention types):
```ts
export interface RitualWindow { opensAt: string; prepStartsAt: string; bedTime: string }
export interface RitualDay { date: string; closed: boolean; closedAt: string | null; window: RitualWindow }
```

`ritualApi.ts`:
```ts
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { RitualDay } from '@/data/types'

type Wire = components['schemas']['RitualDayResponse']

const toDay = (w: Wire): RitualDay => ({
  date: w.date,
  closed: w.closed,
  closedAt: w.closedAt ?? null,
  window: { opensAt: w.window.opensAt, prepStartsAt: w.window.prepStartsAt, bedTime: w.window.bedTime },
})

export const ritualApi = {
  day: async (date: string) => toDay(await apiFetch<Wire>(`/api/ritual/day/${date}`)),
  close: async (date: string) =>
    toDay(await apiFetch<Wire>('/api/ritual/close', { method: 'POST', body: JSON.stringify({ date }) })),
}
```
(Check `apiFetch`'s exact POST/body idiom in `data/_client/api.ts` and mirror `intentionApi`'s write calls — if it takes a `json:` option or sets headers itself, follow that form.)

`ritualMock.ts`:
```ts
import type { RitualDay } from '@/data/types'

/** Seed: the demo evening — 22:30 bed anchor, window open, day not yet closed. */
export const mockRitualDay = (date: string): RitualDay => ({
  date,
  closed: false,
  closedAt: null,
  window: { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' },
})

/** Real-mode empty (dual-mode invariant): never the seed; ghost window mirrors the backend's
 *  no-goal config default (bed 22:00). */
export const EMPTY_RITUAL_DAY = (date: string): RitualDay => ({
  date,
  closed: false,
  closedAt: null,
  window: { opensAt: '20:45', prepStartsAt: '21:15', bedTime: '22:00' },
})
```

`ritualHooks.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import { EMPTY_RITUAL_DAY, mockRitualDay } from '@/data/ritual/ritualMock'
import { ritualApi } from '@/data/ritual/ritualApi'
import type { RitualDay } from '@/data/types'
import { useDualQuery } from '@/data/useDualQuery'

export function useRitualDay(date: string): { data: RitualDay; isPending: boolean } {
  return useDualQuery<RitualDay>({
    queryKey: ['ritualDay', date],
    mockData: mockRitualDay(date),
    realFetch: () => ritualApi.day(date),
    realEmpty: EMPTY_RITUAL_DAY(date),
  })
}

export function useRitualActions(date: string): { close: () => Promise<RitualDay>; pending: boolean } {
  const qc = useQueryClient()
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: async (): Promise<RitualDay> => {
      if (mock) {
        const prev = qc.getQueryData<RitualDay>(['ritualDay', date]) ?? mockRitualDay(date)
        if (prev.closed) return prev // idempotent: no second award
        const next = { ...prev, closed: true, closedAt: new Date().toISOString() }
        qc.setQueryData(['ritualDay', date], next)
        awardGamificationEvent(qc, { type: 'HABIT', xpOverride: 10 }) // the evening_ritual catalog XP
        return next
      }
      const day = await ritualApi.close(date)
      for (const key of [['ritualDay', date], ['habitDay', date], ['dailyQuests', date],
        ['gamificationDay', date], ['gamification'], ['progressionProfile']]) {
        qc.invalidateQueries({ queryKey: key })
      }
      return day
    },
  })
  return { close: () => mutation.mutateAsync(), pending: mutation.isPending }
}
```

Barrel (`data/hooks.ts`, after the gamification line): `export { useRitualDay, useRitualActions } from '@/data/ritual/ritualHooks'`.

MSW (`test/msw/handlers.ts`, next to the gamification fixtures): `http.get(\`${API_BASE}/api/ritual/day/:date\`, ...)` returning `{date, closed: false, closedAt: null, window: {opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30'}}` and `http.post(\`${API_BASE}/api/ritual/close\`, ...)` returning the same with `closed: true, closedAt: '2026-07-25T20:24:00Z'`.

- [ ] **Step 5: Both modes green + commit**

```bash
cd frontend && pnpm test -- src/data/ritual src/features/ritual && VITE_USE_MOCK=true pnpm test -- src/data/ritual src/features/ritual
git add frontend/src && git commit -m "feat(ritual-fe): data layer — ritual day read, idempotent close, wrap-safe window math (mezo-ilsj)"
```

---

### Task 2: Recap composition (`useDayRecap`) + harvest staging logic

**Files:**
- Create: `frontend/src/data/ritual/recapHooks.ts` (+ barrel line)
- Create: `frontend/src/features/ritual/logic/harvestStages.ts`
- Test: `frontend/src/data/ritual/recapHooks.test.tsx`, `frontend/src/features/ritual/logic/harvestStages.test.ts`

**Interfaces:**
- Consumes (all via their existing modules): `useCheckins`, `useDailyQuests`, `useActivities`, `useIntentionDay`, `useHabitDay`, `useFuelDay`, `useTrain`, `useSleep`, `useWeight`, `useCompanionNote`, `growthTodaySummary`.
- Produces:
```ts
export interface RecapEvent { icon: string; label: string; meta: string; done: boolean }
export interface DayRecap {
  events: RecapEvent[]          // chronology-flavored ordering: training → fuel → biometrics → journal → foci
  checkinsDone: number          // of 4
  thinDay: boolean              // < 2 events done AND < 2 check-ins → bad-day softening
  closingNote: string | null    // the companion 'closing' note text (kind === 'closing' only)
}
export function useDayRecap(date: string): DayRecap
```
```ts
// harvestStages.ts — the reward choreography order + delays (ms), pure:
export interface HarvestStage { kind: 'xp-total' | 'source' | 'coin' | 'skill' | 'streak'; delayMs: number }
export function harvestStages(input: { sources: number; coins: number; hasSkillHighlight: boolean }): HarvestStage[]
```

- [ ] **Step 1: Failing recap test** — with MSW fixtures / mock seeds, assert: a completed workout yields a `🏋️ … done:true` event; meals aggregate to one `🍽` event with `p` grams in `meta`; the intention foci render as `✦` events; `checkinsDone` counts `state==='done'`; `thinDay` flips on an empty day; `closingNote` is non-null ONLY when `useCompanionNote()` returns `kind: 'closing'`.
- [ ] **Step 2: Implement `useDayRecap`** — pure derivation over the hooks (no new fetch). Event derivations:
  - training: `useTrain().completedTodayWorkout` (real) / `workout` with mock done-state → `{icon:'🏋️', label: workout title, meta: '✓', done}` ; if none and a sport session is flagged today, a `🏐` event.
  - fuel: `useFuelDay().fuel` → one event `{icon:'🍽', label: \`${mealsLogged} étkezés\`, meta: \`${consumed.p} g fehérje\`, done: mealsLogged > 0}` (read the actual `FuelDay` field names — `consumed`/`targets`/`meals` — from `data/types.ts` and adapt).
  - supplements: from `useFuelDay().fuel.supplements` if the shape carries taken/total; if it does not, SKIP the event (honest absence — check the type first, do not fabricate).
  - biometrics: last `useWeight().weightLog` entry dated today → `⚖️` event; `useSleep().lastNight` → `😴` event with duration meta.
  - journal: each `useActivities(date).data` entry → `✍️` event (text truncated 40 chars, meta `+{xpAwarded} XP` when > 0).
  - intention: each focus → `✦` event, `done` = reflection set.
  - `events` ordered: training, sport, fuel, biometrics, journal, foci. `thinDay = events.filter(e => e.done).length < 2 && checkinsDone < 2`.
- [ ] **Step 3: `harvestStages`** — deterministic stagger: xp-total at 400ms; each source chip +250ms; coins start 300ms after the last source, +250ms each; skill highlight +400ms; streak last +400ms. Table-test the delays for a 4-source/2-coin input.
- [ ] **Step 4: Both modes + commit** — `git commit -m "feat(ritual-fe): day recap composition + harvest stage choreography (mezo-ilsj)"`

---

### Task 3: Route, page shell, act state machine + Arrival/Release acts + rz-* CSS

**Files:**
- Create: `frontend/src/features/ritual/pages/RitualPage.tsx`
- Create: `frontend/src/features/ritual/components/ArrivalStep.tsx`, `ReleaseStep.tsx`
- Modify: `frontend/src/app/router.tsx` (`{ path: 'ritual', element: <RitualPage /> }` before the `*` catch-all, the `me/sleep/night` idiom + comment), `frontend/src/app/AppLayout.tsx` (add `'/ritual'` to the `hideTabBar` array)
- Modify: `frontend/src/styles/prototype.css` (append the `/* ===== Ritual — Napzárás (mezo-ilsj) ===== */` block after L1969)
- Test: `frontend/src/features/ritual/pages/RitualPage.test.tsx`; extend `frontend/src/app/navigation.test.tsx` (tab bar hides on `/ritual` — copy the `/train/session` test)

**Interfaces:**
- Consumes: `useRitualDay`/`useRitualActions` (Task 1), `useDayRecap` (Task 2, acts 2-3 get wired in Tasks 4-5), `useNavigate`.
- Produces: `RitualPage` — act state machine `const [act, setAct] = useState(1)`; act props contract used by Tasks 4-6:
```ts
// act components 1/2/4 receive: { onNext: () => void }
// LoopsStep (act 3) receives:   { onNext, onOpenCheckIn, onOpenJournal } (Task 5)
// ReleaseStep (act 5) receives: { prepStartsAt: string; bedTime: string; closingNote: string | null; onFinish: () => void }
// HarvestStep reads its hooks itself — no data props (Task 6)
```

- [ ] **Step 1: Failing page test** — render `/ritual` via the `createMemoryRouter(routes, …)` app-wrapper idiom (`navigation.test.tsx`): act 1's fixed line „A nap véget ért." renders; clicking „Kezdjük" advances (act 2 placeholder text appears); the ✕ (`aria-label="Kilépés"`) navigates to `/today`; the tab bar is absent. Stub matchMedia reduced (`stubReduced` pattern) so `np-anim`-style entrances don't hide content in jsdom.
- [ ] **Step 2: Implement the shell.** `RitualPage`: reads `useRitualDay(localDateString())`; five acts as a switch; a top status row with 5 progress dots (`.rz-dots`, filled up to the current act) and the ✕ exit (plain `<button aria-label="Kilépés" onClick={() => navigate('/today')}>`); Acts 2/3 render placeholder `<div>` stubs (`data-testid="act-2"`) until Tasks 4-5 replace them. NOTHING is written before act 4.

`ArrivalStep.tsx` (from the approved mockup — `ritual-flow.html` phone 1):
```tsx
export function ArrivalStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="rz-act rz-arrival">
      <div className="rz-moon" aria-hidden="true" />
      <h1 className="rz-line1">A nap véget ért.</h1>
      <p className="rz-line2">Zárjuk le együtt.</p>
      <button className="rz-cta" onClick={onNext}>Kezdjük 🌙</button>
    </div>
  )
}
```

`ReleaseStep.tsx` (mockup: `evening-timing.html` phone 3 — the handoff variant): the closing circle SVG (stroke-dashoffset draw, `np-draw` reuse), the fixed line „A nap le van zárva. Elengedheted. 🌙", the companion `closingNote` paragraph when present (quiet italic, eyebrow `MEZO · NAPZÁRÁS`), then the handoff panel: eyebrow `MOST JÖN · ALVÁS-ELŐKÉSZÍTÉS`, up to three lines derived from props `{ prepStartsAt, bedTime }` (`🌌 Lecsendesítés — képernyők le · {prepStartsAt}`, `🛏 Villanyoltás · {bedTime}`), and the CTA `Esti rutin indítása →` → `onFinish()` (navigates `/today`, where `WindDownBanner` + the evening `RoutineCard` own the sleep-prep phase — integration, not duplication).

- [ ] **Step 3: CSS block** (append to `prototype.css`; tokens only — `--lav`, `--lav-deep`, `--ink`, `--faint`, `--warm`; dark-first surface using the existing dark-theme values so both themes hold):

```css
/* ===== Ritual — Napzárás full-screen flow (mezo-ilsj, spec §4) ===== */
.rz-screen { position: absolute; inset: 0; display: flex; flex-direction: column; overflow-y: auto;
  background: radial-gradient(120% 90% at 50% -10%, #2A2521 0%, #241f1c 55%, #1a1614 100%); color: #F5EFE6; z-index: 30; }
.rz-top { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px 0; }
.rz-dots { display: flex; gap: 6px; }
.rz-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(245,239,230,.18); }
.rz-dot.on { background: var(--lav); }
.rz-act { flex: 1; display: flex; flex-direction: column; padding: 0 20px 28px; }
.rz-moon { width: 84px; height: 84px; border-radius: 50%; margin: 72px auto 0;
  background: radial-gradient(circle at 34% 30%, #efe9dc 0%, #cfc4e2 55%, var(--lav) 100%);
  box-shadow: 0 0 40px 6px rgba(171,159,210,.35); animation: rz-breath 4.2s ease-in-out infinite; }
@keyframes rz-breath { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
.rz-line1 { font-family: var(--ff-display); font-size: 24px; text-align: center; margin-top: 40px; }
.rz-line2 { color: rgba(245,239,230,.55); text-align: center; margin-top: 8px; }
.rz-cta { margin: 56px auto 0; padding: 13px 34px; border-radius: 999px; border: 0;
  background: linear-gradient(120deg, var(--lav), var(--lav-deep)); color: #1d1927; font-weight: 700;
  animation: rz-glowp 3s ease-in-out infinite; }
@keyframes rz-glowp { 0%, 100% { box-shadow: 0 0 18px 2px rgba(171,159,210,.35); } 50% { box-shadow: 0 0 30px 8px rgba(171,159,210,.55); } }
@keyframes rz-fall { 0% { opacity: 0; transform: translateY(0) rotate(0); } 8% { opacity: 1; }
  100% { opacity: 0; transform: translateY(520px) rotate(560deg); } }
@media (prefers-reduced-motion: reduce) {
  .rz-moon, .rz-cta { animation: none; }
}
```
(The block grows in Tasks 4-6 — event rows, harvest chips, confetti particles, always extending the same section and the same reduced-motion guard.)

- [ ] **Step 4: Gate + commit** — `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → green. `git commit -m "feat(ritual-fe): /ritual shell — act machine, arrival + release, rz CSS foundation (mezo-ilsj)"`

---

### Task 4: Act 2 — DayStoryStep (a napod íve)

**Files:**
- Create: `frontend/src/features/ritual/components/DayStoryStep.tsx`
- Modify: `RitualPage.tsx` (replace the act-2 stub), `prototype.css` (event-row styles)
- Test: `frontend/src/features/ritual/components/DayStoryStep.test.tsx`

**Interfaces:**
- Consumes: `useDayRecap` (Task 2), `buildArcPoints`/`pointXY` from `@/features/today/logic/dayArc`, `useCheckins`, `useTrain` (workoutTime via `useToday()` is Today-shaped — instead pass nothing: DayStoryStep reads `useCheckins()` + recap itself).
- Produces: `DayStoryStep({ onNext }: { onNext: () => void })`.

- [ ] **Step 1: Failing test** — with seeds: header „A napod íve"; the arc SVG present (`role="img"`, `aria-label="A napod íve — összegzés"`); one `.rz-ev` row per recap event with icon+label+meta; done rows carry `.ok`; `thinDay` renders the soft line „Ma ennyi fért bele. Az is számít." instead of listing zero-done chatter; „Tovább" advances.
- [ ] **Step 2: Implement** — reuse the arc: an SVG `viewBox="0 0 364 120"` path (the `dayArc.ts` Bézier: P0(22,100) C(182,-28) P2(342,100)) drawn with the `np-draw` stroke animation; beats from `buildArcPoints({checkins, workoutTime: null})` plotted via `pointXY` as `.rz-arc-dot` circles with staggered `np-pop` (`style={{ animationDelay }}`, index-based). Below: recap events as `.rz-ev` rows with staggered rise. All entrance animations disabled under reduced motion (rows visible immediately — the CSS guard, not JS).
- [ ] **Step 3: Both modes + commit** — `git commit -m "feat(ritual-fe): act 2 — day story arc + event reveal (mezo-ilsj)"`

---

### Task 5: Act 3 — LoopsStep (nyitott hurkok)

**Files:**
- Create: `frontend/src/features/ritual/components/LoopsStep.tsx`
- Create: `frontend/src/features/ritual/logic/openLoops.ts` (+ test)
- Modify: `RitualPage.tsx` (replace stub; mount the reused sheets at page level), `prototype.css`
- Test: `frontend/src/features/ritual/components/LoopsStep.test.tsx`

**Interfaces:**
- Consumes: `useCheckins` (+ the next-open-slot derivation from `TodayPage.tsx:42`: `checkins.findIndex(c => c.state === 'now' || c.state === 'pending')`), `useIntentionDay`/`useIntentionActions(date).reflect`, `useActivities`; reused sheets `CheckInSheet` (props `{slot, slotIdx, onClose, onSave}`) and `ActivityLogSheet` (`{onClose}`); `Reflection` type.
- Produces: `LoopsStep({ onNext, onOpenCheckIn, onOpenJournal }: { onNext: () => void; onOpenCheckIn: () => void; onOpenJournal: () => void })` — the SHEETS live on `RitualPage` (the TodayPage wiring precedent), LoopsStep only signals.
- Pure: `openLoops({checkins, intention}: {checkins: CheckinSlot[]; intention: IntentionDay}): { checkinOpen: boolean; reflectOpen: boolean }`.

- [ ] **Step 1: Failing tests** — `openLoops` table-test (pending/now slot → checkinOpen; reflection null with ≥1 focus → reflectOpen; all closed → both false). Component: an open check-in renders the glowing row „{time} check-in kimaradt" + `Koppints` (fires `onOpenCheckIn`); the reflect row renders the inline `Igen / Részben / Nem` buttons (each calls `reflect(v)` — the `IntentionBanner` inline precedent, NOT ReflectSheet) and collapses to `✓ …reflektáltál` once `reflection` is set; the journal row „Történt még valami ma?" + `Napló` fires `onOpenJournal`; closed items list dim with ✓ („Minden hurok zárva ✓" beat when nothing is open); „Tovább" always available (soft — nothing is mandatory).
- [ ] **Step 2: Implement** — first open row gets `.rz-loop.glow` (the `--wash-lav` single-next-action nudge idiom); `RitualPage` mounts `{checkInIdx !== null && <CheckInSheet slot={checkins[checkInIdx]} slotIdx={checkInIdx} onClose={...} onSave={d => saveCheckIn(checkInIdx, d)} />}` and `{journalOpen && <ActivityLogSheet onClose={() => setJournalOpen(false)} />}` — the sheets portal above the flow (`Sheet` portals to `.phone-screen`).
- [ ] **Step 3: Both modes + commit** — `git commit -m "feat(ritual-fe): act 3 — open-loop closing with reused sheets (mezo-ilsj)"`

---

### Task 6: Act 4 — HarvestStep (termés) + `CountUp` primitive + close-on-enter

**Files:**
- Create: `frontend/src/shared/ui/CountUp.tsx` (+ `CountUp.test.tsx`)
- Create: `frontend/src/features/ritual/components/HarvestStep.tsx`
- Modify: `RitualPage.tsx` (fire `close()` once on entering act 4 — ref-guarded; consume habit levelUps silently), `prototype.css` (chips, bars, confetti particles, twinkles)
- Test: `frontend/src/features/ritual/components/HarvestStep.test.tsx`

**Interfaces:**
- Consumes: `useGamificationDay(date)` (exact `GamificationDay` shape), `useGamification` (streak), `useProgressionProfile` (`life`/`athletic` `SkillLevel[]` — `{skillKey, kind, level, cumulativeXp, progressPct}`), `useHabitDay(date)` + `useHabitActions(date).consumeLevelUps`, `harvestStages` (Task 2), `skillDisplay` from `@/features/progression/logic/levelUpMeta`.
- Produces: `HarvestStep({ onNext }: { onNext: () => void })`; `CountUp({ to, durationMs = 1800, className }: { to: number; durationMs?: number; className?: string })` — rAF ease-out count-up rendering `Math.round`, tabular-nums; under reduced motion (or jsdom) renders `to` immediately.

- [ ] **Step 1: `CountUp` test-first** — reduced-motion stub → renders the final value synchronously; normal path smoke (rAF mocked or a `waitFor` to the final value).
- [ ] **Step 2: Failing HarvestStep test** (reduced-motion stubbed so stages render immediately): with the mock `GamificationDay` seed (QUEST 45 / HABIT 35 / ACTIVITY 15 / GYM 20, coins +10/+20, streak 12 alive): eyebrow „A MAI TERMÉS"; the XP total 115 present; one chip per source with HU labels (`📜 Küldetések +45`, `☀️ Rutin +35`, `✍️ Napló +15`, `🏋️ Edzés +20` — label map in the component: QUEST→Küldetések 📜, HABIT→Rutin ☀️, ACTIVITY→Napló ✍️, GYM→Edzés 🏋️, RUN→Futás 🏃, SPORT→Sport 🏐; unknown source → skip, defensive against the wire's open string type); coin chips `🪙 +10` `🪙 +20`; a skill highlight row (the LIFE skill with the highest `progressPct` < 100 → bar + „még N XP a Lv M-ig" where N derives from `progressPct` — if the math needs the curve, show only the bar + `Lv {level}` and drop the hint: never fabricate); `🔥 12 napos sorozat él` (dim + „— megszakadt" when `streakAlive` false); confetti container present only when NOT thinDay-equivalent (xpTotal > 0). DELIBERATE spec trim: the spec's "title unlock if due" beat is deferred (ladder unlocks already surface via AppHero/TitleShopSheet; duplicating the derivation here is post-v1 polish — note it in the ritual.md doc's deferred list, Task 8).
- [ ] **Step 3: Implement.** `RitualPage`: `useEffect` on `act === 4` with a `closedRef` guard → `close()`; after the close resolves, `consumeLevelUps()` from `useHabitDay` (silent — the stage is the celebration; add the one-line comment explaining the suppressed overlay). Stage delays from `harvestStages` applied as `animationDelay` inline styles; confetti = 10 absolutely-positioned `.rz-conf i` spans (varied `left`/`animation-delay` inline, token colors), `rz-fall` once (`forwards`), inside the reduced-motion guard.
- [ ] **Step 4: Both modes + commit** — `git commit -m "feat(ritual-fe): act 4 — harvest stage with CountUp, coins, skill bar, streak (mezo-ilsj)"`

---

### Task 7: Today `RitualCard` + scenario param

**Files:**
- Create: `frontend/src/features/today/components/RitualCard.tsx` (+ test)
- Modify: `frontend/src/features/today/pages/TodayPage.tsx` (mount in „Teendők ma" between `TodayQuestsCard` and `RoutineCard`), `frontend/src/data/today/todayHooks.ts` (`useTodayScenario` gains `ritual: 'waiting' | 'open' | 'done' | null` from `params.get('ritual')`, whitelist-validated, default null), `frontend/src/data/types.ts` (`TodayScenario.ritual`), `prototype.css` (`.ritcard` styles from the approved `evening-timing.html` mockup phones 1-2)
- Test: extend `TodayPage.test.tsx` (mount order), `RitualCard.test.tsx`

**Interfaces:**
- Consumes: `useRitualDay(localDateString())`, `ritualWindowState`/`minutesUntil` (Task 1), `useTodayScenario().ritual` (URL override), `Link`/`useNavigate`.
- Produces: `RitualCard()` — three states:
  - **waiting** (`ritualWindowState === 'waiting'` && !closed): quiet card, moon `🌘`, sub „{opensAt}-kor nyílik — villanyoltás {bedTime}."; muted CTA (disabled-looking but still a link — soft gate).
  - **open** (!closed): glow card `🌙`, sub „A nap kész. Zárd le, mielőtt az alvás-előkészítés indul ({prepStartsAt})."; CTA „Zárjuk le a napot ✨" → `/ritual`.
  - **done** (closed): one quiet row `🌙 Napzárás kész ✓` (no CTA).
  - URL override `?ritual=waiting|open|done` wins over the derived state (the `?day=` demo-affordance precedent, survives real mode by design).

- [ ] **Step 1: Failing tests** — three states via the URL override; the derived-state branch with a fixed `now` prop override (`RitualCard({ now }: { now?: Date })`, default `new Date()` — the `GreetingHeader` test-override precedent); TodayPage order test extended: `TodayQuestsCard` → `RitualCard` → `RoutineCard` (the `compareDocumentPosition` idiom).
- [ ] **Step 2: Implement + gate + commit** — `git commit -m "feat(today): RitualCard — waiting/open/done entry point + ?ritual= scenario (mezo-ilsj)"`

---

### Task 8: Living docs + full gates

**Files:**
- Create: `docs/features/ritual.md` (the 10-section living doc for the WHOLE ritual feature: R2 backend + R1 Harvest read seam + this FE flow — key_files: `backend/.../feature/ritual`, `frontend/src/features/ritual`, `frontend/src/data/ritual`, `api/feature/ritual/ritual.yml`, `frontend/src/features/today/components/RitualCard.tsx`; follow `docs/features/README.md`'s template; status: FE+BE done, visual goldens pending R4)
- Modify: `docs/features/today.md` (§2 RitualCard + §10 key files; the habitAction interim-redirect sentence now describes the LIVE route), `docs/features/habit.md` (evening_ritual's CTA now lands on the real flow), `docs/features/growth.md` (§5: the ritual as the `GET /api/gamification/day` consumer), `docs/features/_platform-design-system.md` ONLY if it enumerates feature CSS blocks (add the Ritual block line)
- Run: `node scripts/lint-docs.mjs` — no branch-induced staleness left (the R2/R1 lesson: sweep everything our branch drifted)

- [ ] **Step 1: Write/update the docs** (living-doc policy: current state only, no changelog phrasing).
- [ ] **Step 2: Full gates:**
```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
node scripts/lint-docs.mjs
```
- [ ] **Step 3: Commit** — `git commit -m "docs(ritual): living feature doc + today/habit/growth seams (mezo-ilsj)"`

(Ship — push/PR/CI/merge/bd-close — happens after the final whole-branch review, per the run's established pattern.)

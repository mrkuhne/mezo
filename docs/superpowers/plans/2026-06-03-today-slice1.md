# Today (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Today home screen — morning briefing, reta phase bar, check-in strip + sheet, workout teaser, conditional sport/vulnerability cards, fuel timeline preview, quick stats, insights teaser, the QuickInput sheet, and the AnchorMode variant — to pixel-parity with the prototype, running on typed mock data with URL-driven dynamic states.

**Architecture:** React 19 + TS feature slice under `src/features/today/` (+ `src/features/quickinput/`), composing Foundation primitives. Two new shared widgets in `components/ui/` (RetaPhaseBar, QuickStat). A typed mock-data layer in `src/data/` exposes hooks (`useToday`, `useCheckins`, `useFuelPreview`, `useTodayScenario`); dynamic states come from URL search params. Cross-slice CTAs navigate via react-router. No backend, no AI generation, no active-workout-mode.

**Tech Stack:** Vite · React 19 · TypeScript (strict) · react-router-dom v7 (`useNavigate`, `useSearchParams`) · Tailwind v4 (ported prototype classes) · Vitest + RTL · Playwright (parity).

**Source of truth (the locked design — read the exact section while implementing):**
- `/Users/daniel.kuhne/Downloads/design_handoff_mezo/prototype/src/today.jsx` — Today + QuickStat + VolleyballTodayCard + AnchorModeView + FuelTimelinePreview + KIND_META fallback.
- `.../prototype/src/checkin.jsx` — CheckInSheet, CheckInObservation, CHECKIN_DIMS.
- `.../prototype/src/quickinput.jsx` — QuickInputSheet.
- `.../prototype/src/frame.jsx` — RetaPhaseBar.
- `.../prototype/src/data.js` — mock shapes (`window.MezoData`).
- `.../prototype/styles.css` — already ported verbatim to `src/styles/prototype.css` (all classes exist).

**Conventions:** TypeScript strict, no `any`, no `dangerouslySetInnerHTML` (use `SafeMarkdown`). Keep Hungarian copy verbatim. Reuse Foundation primitives; port the prototype's inline-styled markup faithfully (same values/copy) — the prototype is the visual contract, the parity harness (Task 15) verifies it. Commit after each task, English message ending with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (single serialized commit; the beads pre-commit hook runs `bd export`). Work from `/Users/daniel.kuhne/MrKuhne/mezo` on the slice's feature branch.

**Reused Foundation primitives** (import, do not rebuild): `NotchCard` (`@/components/ui/NotchCard`), `Chip`, `ToolChip`, `ToolChipRow`, `RefTag`, `Eyebrow`, `LabelMono`, `Display`, `PageTitle`, `CtaPrimary`/`CtaGhost` (`@/components/ui/Cta`), `ProgressBar`, `Sheet`, `Icon`/`BrandGlyph` (`@/components/ui/Icon`), `SafeMarkdown` (`@/lib/safeMarkdown`), `cn` (`@/lib/cn`); shell: `PhoneFrame`, `ScreenContent`, `Fab`, `AppLayout` (`@/app/*`).

---

## Task 1: RetaPhaseBar widget

**Files:** Create `src/components/ui/RetaPhaseBar.tsx`; Test `src/components/ui/RetaPhaseBar.test.tsx`. Contract: `frame.jsx` `RetaPhaseBar` + `.reta-bar`/`.reta-seg` classes.

- [ ] **Step 1: Failing test** — `src/components/ui/RetaPhaseBar.test.tsx`:
```tsx
import { render } from '@testing-library/react'
import { RetaPhaseBar } from './RetaPhaseBar'

test('renders 7 segments', () => {
  const { container } = render(<RetaPhaseBar day={3} />)
  expect(container.querySelectorAll('.reta-seg')).toHaveLength(7)
})
test('marks the current day active and earlier days past', () => {
  const { container } = render(<RetaPhaseBar day={3} />)
  const segs = container.querySelectorAll('.reta-seg')
  expect(segs[2].className).toContain('active')   // day 3 (index 2)
  expect(segs[0].className).toContain('past')     // day 1
  expect(segs[4].className).not.toContain('active')
  expect(segs[4].className).not.toContain('past') // future
})
```
- [ ] **Step 2: Run → FAIL** — `pnpm test src/components/ui/RetaPhaseBar.test.tsx`
- [ ] **Step 3: Implement** — `src/components/ui/RetaPhaseBar.tsx` (port of `frame.jsx` RetaPhaseBar):
```tsx
const RETA_COLORS = [
  'var(--reta-d1)', 'var(--reta-d2)', 'var(--reta-d3)',
  'var(--reta-d4)', 'var(--reta-d5)', 'var(--reta-d6)', 'var(--reta-d7)',
] as const

export function RetaPhaseBar({ day }: { day: number }) {
  return (
    <div className="reta-bar" title={`Retatrutide · Day ${day}/7`}>
      {[1, 2, 3, 4, 5, 6, 7].map(d => (
        <div
          key={d}
          className={'reta-seg' + (d === day ? ' active' : '') + (d < day ? ' past' : '')}
          style={{ background: d <= day ? RETA_COLORS[d - 1] : 'var(--surface-2)', color: RETA_COLORS[d - 1] }}
        />
      ))}
    </div>
  )
}
```
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(today): RetaPhaseBar widget` + trailer.

---

## Task 2: QuickStat widget

**Files:** Create `src/components/ui/QuickStat.tsx`; Test `src/components/ui/QuickStat.test.tsx`. Contract: `today.jsx` `QuickStat` + `.card.notch-4`.

- [ ] **Step 1: Failing test**:
```tsx
import { render, screen } from '@testing-library/react'
import { QuickStat } from './QuickStat'

test('renders label, value, unit, delta', () => {
  render(<QuickStat label="Alvás" value="7.2" unit="h" delta="+0.4" />)
  expect(screen.getByText('Alvás')).toBeInTheDocument()
  expect(screen.getByText('7.2')).toBeInTheDocument()
  expect(screen.getByText('h')).toBeInTheDocument()
  expect(screen.getByText('+0.4')).toBeInTheDocument()
})
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `src/components/ui/QuickStat.tsx`:
```tsx
export function QuickStat({ label, value, unit, delta }: { label: string; value: string; unit: string; delta: string }) {
  return (
    <div className="flex-1 card notch-4" style={{ padding: 12 }}>
      <div className="label-mono" style={{ fontSize: 9 }}>{label}</div>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, marginTop: 4 }}>
        {value}<span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 2 }}>{unit}</span>
      </div>
      <div className="text-tertiary" style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, marginTop: 2 }}>{delta}</div>
    </div>
  )
}
```
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** — `feat(today): QuickStat widget`.

---

## Task 3: Mock data layer + types + hooks

**Files:** Create `src/data/types.ts`, `src/data/kindMeta.ts`, `src/data/today.ts`, `src/data/checkins.ts`, `src/data/hooks.ts`; Test `src/data/hooks.test.tsx`.

Port ONLY the slices Today consumes from `data.js`. Use the EXACT values from `data.js` (lines ~562–701 for `today`/`briefing`/`briefingVariants`/`checkins`/`workout`; ~7–16 for `user`; ~250–263 for the volleyball sessions; ~350–411 for `fuelPlan.today`; ~406–415 for `KIND_META`).

- [ ] **Step 1: Types** — `src/data/types.ts`:
```ts
export type DayState = 'good' | 'medium' | 'rough'
export interface CheckinValues { energy: number; stress: number; body: number; mental: number }
export type CheckinState = 'done' | 'now' | 'skipped' | 'pending'
export interface CheckinSlot { time: string; state: CheckinState; values: CheckinValues | null; note: string | null; savedAt?: string }
export interface BriefingRef { kind: string; id?: string; label: string }
export interface BriefingPara { type: 'p'; text: string }
export interface Briefing { eyebrow: string; body: BriefingPara[]; refs: BriefingRef[]; confidence: number; tone?: string }
export interface WorkoutExercise { id: string; name: string; sets: number; targetReps: string; targetRIR: number; type: string; muscle: string }
export interface NiggleWarning { muscle: string; muscleLabel: string; detail: string }
export interface Workout { title: string; tag: string; durationEst: number; exercises: WorkoutExercise[]; niggleWarning: NiggleWarning }
export interface VolleyballSession { day: string; time: string; duration: number; court: string; intensity: string; role: string; today?: boolean }
export type FuelKind = 'wake' | 'meal' | 'midday' | 'snack' | 'preworkout' | 'workout' | 'sport' | 'evening'
export interface FuelSlot { time: string; kind: FuelKind; label: string; state: 'done' | 'now' | 'pending'; mealName?: string; mezoNote?: string; items?: { done?: boolean }[] }
export interface TodayMeta { dayLabel: string; dateLabel: string; workoutType: string; workoutTime: string; retaDay: number; mesoPhase: string }
export interface UserMeta { weekInMeso: number; dayInWeek: number; mesoLabel: string }
export interface TodayScenario { dayState: DayState; retaDay: number; niggle: boolean; vulnerable: boolean; anchorMode: boolean }
```
- [ ] **Step 2: KIND_META** — `src/data/kindMeta.ts` (verbatim from `today.jsx` fallback):
```ts
import type { FuelKind } from './types'
export const KIND_META: Record<FuelKind, { color: string; label: string }> = {
  wake:       { color: 'var(--text-secondary)', label: 'Wake' },
  meal:       { color: 'var(--brand-glow)',     label: 'Étkezés' },
  midday:     { color: 'var(--info)',           label: 'Stack' },
  snack:      { color: 'var(--brand-primary)',  label: 'Snack' },
  preworkout: { color: 'var(--warning)',        label: 'Pre-workout' },
  workout:    { color: 'var(--brand-glow)',     label: 'Gym' },
  sport:      { color: 'var(--cat-tendency)',   label: 'Sport' },
  evening:    { color: 'var(--cat-preference)', label: 'Esti stack' },
}
```
- [ ] **Step 3: Mock data** — `src/data/today.ts` and `src/data/checkins.ts`. Port the exact objects from `data.js` into typed consts: `today: TodayMeta`, `user: UserMeta`, `briefing: Briefing`, `briefingVariants: { good: Partial<Briefing>; medium: null; rough: Partial<Briefing> }`, `workout: Workout`, `volleyballSessions: VolleyballSession[]` (the 5 sessions; note NONE has `today:true` in the data — see Task 7 note), `fuelToday: { slots: FuelSlot[] }`. In `checkins.ts`: `initialCheckins: CheckinSlot[]` (the 4 slots from `data.js` lines ~618–623). Copy values verbatim (Hungarian text exact).
- [ ] **Step 4: Failing hook test** — `src/data/hooks.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useTodayScenario, useCheckins } from './hooks'

const wrap = (path: string) => ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
)

test('useTodayScenario defaults: medium, retaDay 3, niggle on, vulnerable off, not anchor', () => {
  const { result } = renderHook(() => useTodayScenario(), { wrapper: wrap('/today') })
  expect(result.current).toEqual({ dayState: 'medium', retaDay: 3, niggle: true, vulnerable: false, anchorMode: false })
})
test('useTodayScenario parses params: rough → anchor, overrides', () => {
  const { result } = renderHook(() => useTodayScenario(), { wrapper: wrap('/today?day=rough&niggle=off&vulnerable=on&retaDay=6') })
  expect(result.current).toEqual({ dayState: 'rough', retaDay: 6, niggle: false, vulnerable: true, anchorMode: true })
})
test('useCheckins.saveCheckIn marks a slot done with values', () => {
  const { result } = renderHook(() => useCheckins())
  act(() => result.current.saveCheckIn(2, { state: 'done', values: { energy: 8, stress: 3, body: 7, mental: 8 }, note: null }))
  expect(result.current.checkins[2].state).toBe('done')
  expect(result.current.checkins[2].values?.energy).toBe(8)
})
```
- [ ] **Step 5: Run → FAIL**
- [ ] **Step 6: Implement hooks** — `src/data/hooks.ts`:
```ts
import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { today, user, briefing, briefingVariants, workout, volleyballSessions, fuelToday } from './today'
import { initialCheckins } from './checkins'
import type { Briefing, CheckinSlot, DayState, TodayScenario } from './types'

export function useTodayScenario(): TodayScenario {
  const [params] = useSearchParams()
  const day = params.get('day')
  const dayState: DayState = day === 'good' || day === 'rough' ? day : 'medium'
  const retaRaw = parseInt(params.get('retaDay') ?? '', 10)
  const retaDay = Number.isFinite(retaRaw) ? Math.min(7, Math.max(1, retaRaw)) : today.retaDay
  const niggle = params.get('niggle') !== 'off'
  const vulnerable = params.get('vulnerable') === 'on'
  return { dayState, retaDay, niggle, vulnerable, anchorMode: dayState === 'rough' }
}

export function resolveBriefing(dayState: DayState): Briefing {
  const variant = briefingVariants[dayState]
  return variant ? { ...briefing, ...variant } : briefing
}

export function useToday() {
  return { today, user, briefing, workout, volleyballSessions, fuelToday }
}

export function useCheckins() {
  const [checkins, setCheckins] = useState<CheckinSlot[]>(initialCheckins)
  const saveCheckIn = useCallback((idx: number, data: Partial<CheckinSlot>) => {
    setCheckins(prev => prev.map((c, i) => (i === idx ? { ...c, ...data } : c)))
  }, [])
  return { checkins, saveCheckIn }
}

export function useFuelPreview() {
  const slots = fuelToday.slots
  const nowIdx = slots.findIndex(s => s.state === 'now')
  const start = Math.max(0, nowIdx)
  const visible = slots.slice(start, start + 3)
  const nextStack = slots.find(s => s.state !== 'done' && (s.items ?? []).some(it => !it.done))
  return { visible, nextStack }
}
```
- [ ] **Step 7: Run → PASS** (`pnpm test src/data`)
- [ ] **Step 8: Commit** — `feat(today): typed mock data layer + hooks (scenario, checkins, fuel preview)`.

> Note on `niggle` default `true`: matches the prototype's Tweaks default (`niggle:"shoulder"`). `resolveBriefing` merges the variant over the base (medium → base `briefing`).

---

## Task 4: Today top sections — BrandRow, RetaPhaseSection, DateMesoHeader

**Files:** Create `src/features/today/components/BrandRow.tsx`, `RetaPhaseSection.tsx`, `DateMesoHeader.tsx`; Test `src/features/today/components/topSections.test.tsx`. Contract: `today.jsx` lines 24–53.

- [ ] **Step 1: Failing test**:
```tsx
import { render, screen } from '@testing-library/react'
import { BrandRow } from './BrandRow'
import { RetaPhaseSection } from './RetaPhaseSection'
import { DateMesoHeader } from './DateMesoHeader'
import { today, user } from '@/data/today'

test('BrandRow shows the Mezo wordmark', () => {
  render(<BrandRow />)
  expect(screen.getByText('Mezo')).toBeInTheDocument()
})
test('RetaPhaseSection shows the D{n}/7 eyebrow', () => {
  const { container } = render(<RetaPhaseSection day={3} />)
  expect(screen.getByText('Retatrutide · D3/7')).toBeInTheDocument()
  expect(container.querySelectorAll('.reta-seg')).toHaveLength(7)
})
test('DateMesoHeader shows date, workout type, meso chips', () => {
  render(<DateMesoHeader today={today} user={user} />)
  expect(screen.getByText(/Pull Day/)).toBeInTheDocument()
  expect(screen.getByText(`Week ${user.weekInMeso} · Day ${user.dayInWeek}`)).toBeInTheDocument()
})
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** the three components, porting `today.jsx` 24–53 (use `BrandGlyph`, `Icon`, `RetaPhaseBar`, `Eyebrow`, `PageTitle`, `Chip`):
  - `BrandRow.tsx`: the brand row (BrandGlyph 20 + "Mezo" h-display + a search `chip` button with `<Icon name="search" size={12}/>`). Reproduce the exact inline styles from lines 25–33.
  - `RetaPhaseSection.tsx` (`{ day }: { day: number }`): `<RetaPhaseBar day={day}/>` then the eyebrow row (`Retatrutide · D{day}/7` left, phase descriptor right: `day<=2 ? 'Peak · étvágy stabil' : day<=4 ? 'Mid · étvágy lefulladás' : 'Trough · stabilizálódik'`). Lines 36–42.
  - `DateMesoHeader.tsx` (`{ today, user }`): eyebrow `{today.dayLabel} · {today.dateLabel}` (brand), `<PageTitle>` "Ma · " + glow workoutType span, then 3 chips (`Week {weekInMeso} · Day {dayInWeek}` brand, `{today.mesoPhase}`, `{user.mesoLabel}`). Lines 45–53.
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** — `feat(today): brand row, reta phase section, date/meso header`.

---

## Task 5: BriefingCard (SafeMarkdown + refs)

**Files:** Create `src/features/today/components/BriefingCard.tsx`; Test `BriefingCard.test.tsx`. Contract: `today.jsx` 56–79 — but REPLACE `dangerouslySetInnerHTML` with `SafeMarkdown`.

- [ ] **Step 1: Failing test**:
```tsx
import { render, screen } from '@testing-library/react'
import { BriefingCard } from './BriefingCard'
import { resolveBriefing } from '@/data/hooks'

test('renders eyebrow, confidence, body paragraphs and ref tags — no raw HTML', () => {
  const b = resolveBriefing('good') // body has **bold**
  const { container } = render(<BriefingCard briefing={b} />)
  expect(screen.getByText(/Confidence/)).toBeInTheDocument()
  expect(container.querySelector('.accent-strip')).toBeTruthy()
  expect(container.querySelector('strong')).toBeTruthy()      // bold rendered safely
  expect(container.querySelector('[dangerouslySetInnerHTML]')).toBeNull()
  expect(container.querySelectorAll('.toolchip').length).toBeGreaterThan(0) // RefTags
})
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `BriefingCard.tsx` (`{ briefing }: { briefing: Briefing }`): NotchCard-equivalent `card notch-12` with `position:relative; overflow:hidden`, an `.accent-strip`, a header row (`Eyebrow brand` = `briefing.eyebrow || 'Reggeli briefing'` + `label-mono` `Confidence {Math.round(confidence*100)}%`), the body paragraphs each `<p style={{fontSize:14,lineHeight:1.55,color:'var(--text-primary)'}}><SafeMarkdown text={p.text} /></p>`, and the footer (`Hivatkozott` eyebrow + `briefing.refs.map(r => <RefTag kind={r.kind} label={r.label}/>)`). Port styles from lines 57–77. Import `SafeMarkdown`, `RefTag`, `Eyebrow`, `LabelMono`.
  > Note: the prototype's bold span is glow-colored. `SafeMarkdown` renders `<strong>`; add a CSS rule or wrap so bold text uses `color: var(--brand-glow); font-weight: 500`. Implement by styling `strong` within the briefing body via a wrapping `className="briefing-body"` and a one-line rule appended to `src/index.css`: `.briefing-body strong{color:var(--brand-glow);font-weight:500}`.
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** — `feat(today): BriefingCard with SafeMarkdown (no innerHTML)`.

---

## Task 6: WorkoutTeaser + NiggleBanner + CTA

**Files:** Create `src/features/today/components/WorkoutTeaser.tsx`; Test `WorkoutTeaser.test.tsx`. Contract: `today.jsx` 113–166.

- [ ] **Step 1: Failing test**:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { WorkoutTeaser } from './WorkoutTeaser'
import { workout } from '@/data/today'

function renderTeaser(niggle = true) {
  return render(
    <MemoryRouter initialEntries={['/today']}>
      <Routes>
        <Route path="/today" element={<WorkoutTeaser workout={workout} niggle={niggle} />} />
        <Route path="/train" element={<div>TRAIN ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}
test('shows title, niggle banner when niggle on, and navigates to /train on CTA', async () => {
  renderTeaser(true)
  expect(screen.getByText(workout.title)).toBeInTheDocument()
  expect(screen.getByText(/aktív niggle/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Indítsuk/ }))
  expect(screen.getByText('TRAIN ROUTE')).toBeInTheDocument()
})
test('hides niggle banner when niggle off', () => {
  renderTeaser(false)
  expect(screen.queryByText(/aktív niggle/)).not.toBeInTheDocument()
})
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `WorkoutTeaser.tsx` (`{ workout, niggle }: { workout: Workout; niggle: boolean }`): use `const navigate = useNavigate()`; the eyebrow row (`Mai edzés · 17:00` + `~{workout.durationEst} perc`), the tappable `card notch-12` button (`onClick={() => navigate('/train')}`) containing the conditional NiggleBanner (when `niggle`, amber banner with `<Icon name="warning"/>` + `workout.niggleWarning.muscleLabel · aktív niggle` + the detail line "Cable Pull-Around előrébb, Lat Pulldown pronated."), the title (`h-display size-md`), counts (`{exercises.length} gyakorlat · {sum sets} sorozat`), first-3 exercise chips + `+{n-3}` chip, and the Prediction footer (`Prediction · 0.72` eyebrow brand + "Chest Row PR 107.5 × 8" + chevron-right). Then the `CtaPrimary` "Indítsuk · {workout.title}" with `onClick={() => navigate('/train')}`. Port styles/copy from lines 113–164.
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** — `feat(today): WorkoutTeaser + niggle banner + start CTA (nav to Train)`.

---

## Task 7: VolleyballCard + VulnerabilityCard (conditional)

**Files:** Create `src/features/today/components/VolleyballCard.tsx`, `VulnerabilityCard.tsx`; Test `conditionalCards.test.tsx`. Contract: `today.jsx` 172–181 (vulnerability) + 232–270 (volleyball).

> Data note: in `data.js` no volleyball session has `today:true`, so `VolleyballCard` renders null by default. To make it demonstrable, `VolleyballCard` takes a `session: VolleyballSession | undefined` prop and renders null when undefined; `TodayScreen` passes `volleyballSessions.find(s => s.today)`. (Keep parity behavior: hidden unless a session is flagged today.)

- [ ] **Step 1: Failing test**:
```tsx
import { render, screen } from '@testing-library/react'
import { VolleyballCard } from './VolleyballCard'
import { VulnerabilityCard } from './VulnerabilityCard'

test('VolleyballCard renders null without a session', () => {
  const { container } = render(<VolleyballCard session={undefined} />)
  expect(container.firstChild).toBeNull()
})
test('VolleyballCard renders details with a session', () => {
  render(<VolleyballCard session={{ day: 'Csü', time: '19:30', duration: 90, court: 'BVSC', intensity: 'magas', role: 'edzés', today: true }} />)
  expect(screen.getByText(/Sport · 19:30/)).toBeInTheDocument()
  expect(screen.getByText(/Stacked day/)).toBeInTheDocument()
})
test('VulnerabilityCard renders the warmer companion message', () => {
  render(<VulnerabilityCard />)
  expect(screen.getByText(/sebezhetőbb hangnem/)).toBeInTheDocument()
})
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** both, porting the exact markup/copy:
  - `VolleyballCard.tsx` (`{ session }`): null when no session; else the pink `--cat-tendency` accented card (left 2px bar, "Röplabda · BVSC" + `{court} · {role}`, chevron, and the "Stacked day" sparkle note). Lines 236–270.
  - `VulnerabilityCard.tsx`: the warm `rgba(217,119,87,...)` card with eyebrow "Mezo · sebezhetőbb hangnem" + the paragraph. Lines 173–180.
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** — `feat(today): conditional volleyball + vulnerability cards`.

---

## Task 8: FuelTimelinePreview

**Files:** Create `src/features/today/components/FuelTimelinePreview.tsx`; Test `FuelTimelinePreview.test.tsx`. Contract: `today.jsx` 338–401 + `KIND_META`.

- [ ] **Step 1: Failing test**:
```tsx
import { render, screen } from '@testing-library/react'
import { FuelTimelinePreview } from './FuelTimelinePreview'

test('shows the fuel header and a MOST chip on the active slot', () => {
  const { container } = render(<FuelTimelinePreview />)
  expect(screen.getByText('Mai fuel · timeline')).toBeInTheDocument()
  expect(screen.getByText('MOST')).toBeInTheDocument()
  expect(container.querySelector('.accent-strip, [style*="--brand-glow"]')).toBeTruthy()
})
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `FuelTimelinePreview.tsx`: call `useFuelPreview()`; render the header (`Mai fuel · timeline` + `Fuel → Terv` brand eyebrow), a `card notch-12` with a glow left-bar, the `visible` slots (time / colored dot via `KIND_META[s.kind]` / `s.mealName || s.label`, `MOST` chip when `s.state==='now'`), and the `nextStack.mezoNote` sparkle footer (first sentence). Port lines 350–397. (The `Fuel → Terv` is a static chip here; cross-nav for it is added in Task 10's TodayScreen if desired — keep it as the brand eyebrow per prototype.)
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** — `feat(today): fuel timeline preview`.

---

## Task 9: QuickStatsRow + InsightsTeaser

**Files:** Create `src/features/today/components/QuickStatsRow.tsx`, `InsightsTeaser.tsx`; Test `bottomSections.test.tsx`. Contract: `today.jsx` 187–207.

- [ ] **Step 1: Failing test**:
```tsx
import { render, screen } from '@testing-library/react'
import { QuickStatsRow } from './QuickStatsRow'
import { InsightsTeaser } from './InsightsTeaser'

test('QuickStatsRow shows the three stats', () => {
  render(<QuickStatsRow />)
  expect(screen.getByText('Alvás')).toBeInTheDocument()
  expect(screen.getByText('Súly')).toBeInTheDocument()
  expect(screen.getByText('HRV')).toBeInTheDocument()
})
test('InsightsTeaser shows the pattern + link chip', () => {
  render(<InsightsTeaser />)
  expect(screen.getByText(/Új minta/)).toBeInTheDocument()
  expect(screen.getByText('Insights → Patterns')).toBeInTheDocument()
})
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**:
  - `QuickStatsRow.tsx`: eyebrow "Most" + a row of three `QuickStat` (Alvás 7.2 h +0.4 / Súly 78.6 kg -0.2 / HRV 64 ms +3). Lines 187–194 (values hardcoded as in prototype).
  - `InsightsTeaser.tsx`: `card notch-8` with `Eyebrow brand` "Új minta · 0.85 konfidencia", the paragraph, and a `Chip brand` "Insights → Patterns". Lines 197–207.
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** — `feat(today): quick stats row + insights teaser`.

---

## Task 10: TodayScreen composition + route wiring

**Files:** Create `src/features/today/TodayScreen.tsx`; Modify `src/app/router.tsx` (point `/today` at the real `TodayScreen`); Test `src/features/today/TodayScreen.test.tsx`.

- [ ] **Step 1: Failing test**:
```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TodayScreen } from './TodayScreen'

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><TodayScreen /></MemoryRouter>)

test('default (medium) renders briefing, workout, quick stats — not AnchorMode', () => {
  renderAt('/today')
  expect(screen.getByText(/Reggeli briefing|briefing/i)).toBeInTheDocument()
  expect(screen.getByText('Most')).toBeInTheDocument()
  expect(screen.queryByText(/Anchor mode/)).not.toBeInTheDocument()
})
test('vulnerable=on shows the vulnerability card', () => {
  renderAt('/today?vulnerable=on')
  expect(screen.getByText(/sebezhetőbb hangnem/)).toBeInTheDocument()
})
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `TodayScreen.tsx`: read `useTodayScenario()`, `useToday()`, `useCheckins()`. If `scenario.anchorMode` return `<AnchorModeView/>` (Task 14). Else render (in `ScreenContent` is supplied by AppLayout's Outlet — so TodayScreen renders the sections directly, NOT another ScreenContent): `BrandRow`, `RetaPhaseSection day={scenario.retaDay}`, `DateMesoHeader`, `BriefingCard briefing={resolveBriefing(scenario.dayState)}`, `CheckInStrip checkins+onCheckIn` (Task 11; opens CheckInSheet — manage `checkInIdx` state + render `CheckInSheet` when set), `WorkoutTeaser workout niggle={scenario.niggle}`, `VolleyballCard session={volleyballSessions.find(s=>s.today)}`, `scenario.vulnerable && <VulnerabilityCard/>`, `FuelTimelinePreview`, `QuickStatsRow`, `InsightsTeaser`. (FAB/QuickInput is in AppLayout, not here.)
  > Wrap the section list in a `<>...</>`; AppLayout's `ScreenContent` provides the scroll container. The prototype wrapped its own `.screen-content` — here that's the shell's job, so do NOT add another `.screen-content`.
- [ ] **Step 4: Wire route** — in `src/app/router.tsx` replace `{ path: 'today', element: <TodayScreen/> }` import from the placeholder to `@/features/today/TodayScreen`. Remove the old placeholder file `src/features/today/` placeholder if it was a different file (the Foundation placeholder was `src/features/today/TodayScreen.tsx` — this task REPLACES its contents; keep the path).
- [ ] **Step 5: Run → PASS** (`pnpm test` full suite green; `pnpm build` ok). Visually `pnpm dev` → `/today` renders the full screen.
- [ ] **Step 6: Commit** — `feat(today): TodayScreen composition + route wiring`.

---

## Task 11: CheckInStrip

**Files:** Create `src/features/today/CheckInStrip.tsx`; Test `CheckInStrip.test.tsx`. Contract: `today.jsx` 82–110.

- [ ] **Step 1: Failing test**:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CheckInStrip } from './CheckInStrip'
import { initialCheckins } from '@/data/checkins'

test('renders 4 slots, the N/4 count, and calls onCheckIn on tap', async () => {
  const onCheckIn = vi.fn()
  const { container } = render(<CheckInStrip checkins={initialCheckins} onCheckIn={onCheckIn} />)
  expect(container.querySelectorAll('.checkin-slot')).toHaveLength(4)
  expect(screen.getByText(/\/4 ma/)).toBeInTheDocument()
  await userEvent.click(container.querySelectorAll('.checkin-slot')[2])
  expect(onCheckIn).toHaveBeenCalledWith(2)
})
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `CheckInStrip.tsx` (`{ checkins, onCheckIn }`): eyebrow row (`Heartbeat · 4×/nap` + `{done count}/4 ma`), `.checkin-strip` grid of `.checkin-slot notch-4 {state}` buttons; each shows `c.time` and the icon area: done with values → avg `Math.round((energy + (11-stress) + body + mental)/4)` in glow Antonio; done w/o values → "✓ in"; now → "tap"; skipped → "—"; pending → "•". `onClick={() => onCheckIn(i)}`. Port lines 82–110.
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** — `feat(today): check-in strip`.

---

## Task 12: CheckInSheet (5-step wizard)

**Files:** Create `src/features/today/CheckInSheet.tsx`; Test `CheckInSheet.test.tsx`. Contract: `checkin.jsx` (CHECKIN_DIMS, CheckInSheet, CheckInObservation). Build on the `Sheet` primitive.

- [ ] **Step 1: Failing test**:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CheckInSheet } from './CheckInSheet'
import { initialCheckins } from '@/data/checkins'

test('advances through dims and saves values', async () => {
  const onSave = vi.fn(); const onClose = vi.fn()
  render(<CheckInSheet slot={initialCheckins[2]} slotIdx={2} onClose={onClose} onSave={onSave} />)
  expect(screen.getByText(/Hogy vagyunk/)).toBeInTheDocument()
  // pick energy = 8 (advances), then continue skipping to summary
  await userEvent.click(screen.getByRole('button', { name: '8' }))
  // skip remaining dims to reach summary
  for (let i = 0; i < 4; i++) {
    const skip = screen.queryByRole('button', { name: /Kihagy/ })
    if (skip) await userEvent.click(skip)
  }
  await userEvent.click(await screen.findByRole('button', { name: /Mentés/ }))
  expect(onSave).toHaveBeenCalled()
  expect(onSave.mock.calls[0][0].state).toBe('done')
})
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — port `checkin.jsx` to TSX: export `CHECKIN_DIMS` (the 4 dims verbatim), `CheckInSheet` ({ slot, slotIdx, onClose, onSave }) using the `Sheet` primitive for the backdrop/panel (pass `onClose`); internal `step` state (0..4), `values` state (default `{energy:7,stress:4,body:7,mental:7}`), `note` state; the 1-10 scale buttons (notch via the inline clip-path as in prototype), step progress bar, summary grid, optional note textarea (200 cap), `CheckInObservation` (the reactive `useMemo` message), and the save button calling `onSave({ state:'done', values, note: note.trim()||null, savedAt: new Date().toISOString() })` then `onClose()`. Keep all Hungarian copy verbatim. Replace the prototype's own `.sheet-backdrop/.sheet/.sheet-handle` markup with the `Sheet` primitive wrapper.
  > `savedAt` uses `new Date().toISOString()` at runtime (fine in app code; tests don't assert it).
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Wire into TodayScreen** — in `TodayScreen` manage `const [checkInIdx, setCheckInIdx] = useState<number|null>(null)`, pass `onCheckIn={setCheckInIdx}` to `CheckInStrip`, and render `{checkInIdx !== null && <CheckInSheet slot={checkins[checkInIdx]} slotIdx={checkInIdx} onClose={()=>setCheckInIdx(null)} onSave={(d)=>saveCheckIn(checkInIdx, d)} />}`. Re-run `pnpm test` + the TodayScreen test still green.
- [ ] **Step 6: Commit** — `feat(today): CheckInSheet 5-step wizard wired to the strip`.

---

## Task 13: QuickInputSheet + wire to the FAB

**Files:** Create `src/features/quickinput/QuickInputSheet.tsx`; Modify `src/app/AppLayout.tsx`; Test `QuickInputSheet.test.tsx`. Contract: `quickinput.jsx`.

- [ ] **Step 1: Failing test**:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickInputSheet } from './QuickInputSheet'

test('shows modality selector and switches to text mode', async () => {
  render(<QuickInputSheet onClose={() => {}} />)
  expect(screen.getByText(/Mi van veled/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Szöveg/ }))
  expect(screen.getByPlaceholderText(/Free note/)).toBeInTheDocument()
})
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — port `quickinput.jsx` to TSX (`{ onClose, onCommit? }`) using the `Sheet` primitive: the 5 modality chips (voice/photo/szám/választ/szöveg), the voice simulation (`useState` for mode/voiceState/transcript/parsed/text + the `setInterval` record sim + cleanup `useEffect`), and the photo/number/chip/text panels. Keep copy verbatim. Replace the prototype's own backdrop/sheet markup with the `Sheet` primitive. Commit = `onClose()` (Phase 1; `onCommit` optional, unused for now).
- [ ] **Step 4: Wire to FAB** — in `AppLayout.tsx` replace the Slice-0 placeholder `<Sheet>...QuickInput placeholder...</Sheet>` with `<QuickInputSheet onClose={() => setQuickOpen(false)} />` (keep the `quickOpen` state + `Fab onClick`). Update the Slice-0 `navigation.test.tsx` expectation that asserted "QuickInput placeholder" → assert the real sheet header `/Mi van veled/` instead.
- [ ] **Step 5: Run → PASS** (full suite, incl. updated navigation test; `pnpm build` ok)
- [ ] **Step 6: Commit** — `feat(today): QuickInputSheet (5 modalities) wired to the FAB`.

---

## Task 14: AnchorModeView + scenario wiring

**Files:** Create `src/features/today/AnchorModeView.tsx`; Modify `src/app/AppLayout.tsx` (pass `anchor` to PhoneFrame from scenario); Test `AnchorModeView.test.tsx`. Contract: `today.jsx` 274–335.

- [ ] **Step 1: Failing test**:
```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnchorModeView } from './AnchorModeView'

test('renders the anchor message and the three anchors', () => {
  render(<MemoryRouter><AnchorModeView /></MemoryRouter>)
  expect(screen.getByText(/Anchor mode · csendben/)).toBeInTheDocument()
  expect(screen.getByText('Egy pohár víz')).toBeInTheDocument()
  expect(screen.getByText(/Heti terv · szünetel/)).toBeInTheDocument()
})
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** — `AnchorModeView.tsx`: port `today.jsx` AnchorModeView (274–335) — anchor eyebrow + "Kilépés" chip (on click `navigate('/today')` to drop the `?day=rough` param, via `useNavigate`), the two-line title, the companion message card, "Mai három horgony" (3 action cards: víz/fehérje/séta), and the "Heti terv · szünetel" dashed card. Warm palette via the `--anchor-*` tokens. (The screen renders inside AppLayout's ScreenContent; AppLayout supplies the warm canvas via PhoneFrame `anchor` — Step 4.)
- [ ] **Step 4: Wire anchor canvas** — `AppLayout.tsx`: read `useTodayScenario()` and pass `anchor={scenario.anchorMode}` to `PhoneFrame` ONLY when on the Today route. Simplest: in AppLayout call `useTodayScenario()` and `useLocation()`; `const anchor = scenario.anchorMode && location.pathname.startsWith('/today')`. Pass `<PhoneFrame anchor={anchor}>`.
  > AppLayout is inside the RouterProvider tree, so `useSearchParams`/`useLocation` work there.
- [ ] **Step 5: Run → PASS** (full suite; `/today?day=rough` shows AnchorMode with warm canvas in `pnpm dev`)
- [ ] **Step 6: Commit** — `feat(today): AnchorMode variant + scenario-driven warm canvas`.

---

## Task 15: Extend the parity harness (Today + variants + sheets)

**Files:** Modify `tests/parity/foundation.spec.ts`.

- [ ] **Step 1: Add Today + variant + sheet screenshots** — append tests that screenshot our app at `/today`, `/today?day=good`, `/today?day=rough` (anchor), `/today?niggle=off`, `/today?vulnerable=on`, plus one that opens the CheckInSheet (click the `now` slot) and one that opens QuickInput (click the FAB), each `await page.waitForTimeout(400)` then `page.screenshot({ path: 'tests/parity/__shots__/app-today-<variant>.png' })`. Keep the existing 6 tests + the prototype baseline.
- [ ] **Step 2: Run** — `pnpm parity`. Confirm new PNGs are written and non-empty (`ls -la tests/parity/__shots__/`). Visually compare `app-today-*.png` against the prototype's matching states (the prototype's Tweaks panel set rough/good/niggle in the baseline; compare the shell + sections).
- [ ] **Step 3: Run full suite + build** — `pnpm test` (all green) and `pnpm build` (ok).
- [ ] **Step 4: Commit** — `test(today): parity screenshots for Today + variants + sheets`.

---

## Definition of Done (Slice 1)

- `pnpm test` green; `pnpm build` succeeds; `pnpm parity` writes Today + variant + sheet screenshots.
- `/today` renders all sections to parity on default mock; `?day=good|rough`, `?niggle=off`, `?vulnerable=on` switch the briefing variant / niggle banner / vulnerability card / AnchorMode.
- Check-in: tapping a slot opens the 5-step CheckInSheet; saving updates the strip.
- FAB opens the real QuickInputSheet (5 modalities); closes on backdrop/Escape.
- Cross-slice CTAs navigate (workout → /train, etc.).
- No `dangerouslySetInnerHTML` (BriefingCard uses SafeMarkdown); tokens not stray rgba where the prototype flagged it.
- Dark + light both correct on Today.

**Next slice:** Me (simplest tab) → Fuel → Insights → Train.

---

## Self-Review

**Spec coverage:** T1 → Tasks 1–2; T2 → Task 3; T3 → Tasks 4–10; T4 → Tasks 11–12; T5 → Task 13; T6 → Tasks 14 (+ scenario in Task 3, variant switching in Tasks 5/6/10). Verification → Task 15 + per-task unit tests. Every spec section maps to a task.

**Placeholder scan:** No "TBD/handle edge cases". Markup-heavy ports cite exact prototype line ranges as the contract and specify the adaptations (hooks instead of `window.MezoData`, `SafeMarkdown` instead of innerHTML, `useNavigate` instead of callbacks, `Sheet` primitive instead of inline backdrop) — concrete, not placeholders. Code-bearing steps show code; ports give explicit component contracts + source refs.

**Type consistency:** Types defined once in `src/data/types.ts` (Task 3) and consumed everywhere: `Workout`/`WorkoutExercise`/`NiggleWarning` (Tasks 3,6), `Briefing` (Tasks 3,5), `CheckinSlot`/`CheckinValues` (Tasks 3,11,12), `VolleyballSession` (Tasks 3,7), `FuelSlot`/`FuelKind`/`KIND_META` (Tasks 3,8), `TodayScenario`/`DayState` (Tasks 3,10,14). Hook names consistent: `useTodayScenario`, `useToday`, `useCheckins` (`{checkins, saveCheckIn}`), `useFuelPreview` (`{visible, nextStack}`), `resolveBriefing`. `CheckInSheet` onSave payload shape matches `saveCheckIn`'s `Partial<CheckinSlot>`.

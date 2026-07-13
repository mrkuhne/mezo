# Napív Redesign — S3 Today Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Today into the Napív "Mi van most?" screen — daypart-aware greeting, the napív (day-arc) signature, one hero action card, collapsed briefing, beats-style heartbeat, "Ma eddig" mini-rings, and a one-row Growth summary — with quests/activity-log relocated to `/me/growth`, the Insights teaser removed, and AnchorMode restyled. No functionality lost; both test modes green after every task.

**Architecture:** TodayPage's flat card stack is re-composed. New presentational components live in `features/today/components/`; pure arc math in `features/today/logic/dayArc.ts`; quests + activity-log cards MOVE (files unchanged) to render inside `features/me/pages/GrowthPage.tsx` under a new "Ma" section. All styling uses the Napív tokens + motion utilities from S1/S2 (`--coral`, `--warm`, `.np-anim`, `.np-press`); new CSS classes append to the Napív section of `prototype.css`.

**Tech Stack:** React 19, TanStack Query hooks via `@/data/hooks` (signatures untouched), plain CSS in `frontend/src/styles/prototype.css`, Vitest + RTL. Driving spec §4.2: `docs/superpowers/specs/2026-07-13-napiv-frontend-redesign-design.md`. Interactive reference: `docs/superpowers/specs/2026-07-13-napiv-redesign-mockup.html` (Today screen).

## Global Constraints

- Worktree `/Users/daniel.kuhne/MrKuhne/mezo/.worktrees/frontend-design-rethink`, branch `feat/frontend-design-rethink`, bd **mezo-8141**. Verify `git rev-parse --show-toplevel` before every commit; NEVER touch the main checkout.
- Commit with hooks disabled: `git -c core.hooksPath=/dev/null commit -m "... (mezo-8141)"`.
- Gate after EVERY task: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (both modes green) + `node scripts/lint-docs.mjs` PASS when a doc/key_file was touched.
- Conventions: no `*Screen`/`*View`; data hooks only from `@/data/hooks`; no barrels; deep `@/*` imports; colocated tests; `shared/ui` untouched.
- Hungarian copy, sentence case, active verbs. Exact strings given below are binding.
- **jsdom hazard:** any component using `.np-anim` starts at `opacity:0` and jsdom never completes keyframes — its tests MUST stub reduced-motion (copy the `matchMedia` stub pattern from `frontend/src/features/progression/LevelUpScreen.test.tsx`) OR assert presence via `getByText` (works regardless of opacity) — never `toBeVisible()` on `.np-anim` nodes.
- Dual-mode honesty: real mode must never show mock-seed data; ghost/hide when a backing hook returns null/empty (`useDualQuery` idioms already in the hooks — consume `pending`/null contracts as-is).

---

### Task 1: `dayArc` pure logic

**Files:**
- Create: `frontend/src/features/today/logic/dayArc.ts`
- Test: `frontend/src/features/today/logic/dayArc.test.ts`

**Interfaces:**
- Consumes: `Daypart` type from `@/shared/lib/daypart`; `CheckinSlot` from `@/data/types`.
- Produces (Task 2 consumes exactly these):
  - `type ArcPoint = { t: number; kind: 'checkin-done' | 'checkin-now' | 'checkin-pending' | 'workout' | 'sleep'; label: string }` (`t` = 0..1 position along the arc)
  - `buildArcPoints(input: { checkins: CheckinSlot[]; workoutTime: string | null }): ArcPoint[]`
  - `arcProgress(now: Date): number` (0..1, day mapped 04:00→23:59; before 04:00 → 1)
  - `pointXY(t: number): { x: number; y: number }` (quadratic Bézier `M 22 100 Q 182 -28 342 100` sampled at t, viewBox 364×112)

- [ ] **Step 1: Write the failing test** (`dayArc.test.ts`):

```ts
import { buildArcPoints, arcProgress, pointXY } from '@/features/today/logic/dayArc'
import type { CheckinSlot } from '@/data/types'

const slot = (time: string, state: CheckinSlot['state']): CheckinSlot =>
  ({ time, state, values: null, note: '' }) as unknown as CheckinSlot

test('buildArcPoints maps check-ins, workout and sleep close onto the day span', () => {
  const pts = buildArcPoints({
    checkins: [slot('06:30', 'done'), slot('10:00', 'done'), slot('14:00', 'now'), slot('20:00', 'pending')],
    workoutTime: '17:00',
  })
  expect(pts).toHaveLength(6) // 4 checkins + workout + sleep(23:00)
  expect(pts[0]).toMatchObject({ kind: 'checkin-done', label: '06:30' })
  expect(pts[2]).toMatchObject({ kind: 'checkin-now', label: '14:00' })
  expect(pts[4]).toMatchObject({ kind: 'workout', label: '17:00' })
  expect(pts[5]).toMatchObject({ kind: 'sleep', label: '23:00' })
  const ts = pts.map(p => p.t)
  expect([...ts].sort((a, b) => a - b)).toEqual(ts) // monotonic along the day
  expect(ts[0]).toBeGreaterThanOrEqual(0)
  expect(ts[5]).toBeLessThanOrEqual(1)
})

test('buildArcPoints omits the workout point when there is no workout today', () => {
  const pts = buildArcPoints({ checkins: [slot('06:30', 'done')], workoutTime: null })
  expect(pts.map(p => p.kind)).toEqual(['checkin-done', 'sleep'])
})

test('arcProgress maps the 04:00–24:00 day window to 0..1', () => {
  expect(arcProgress(new Date('2026-07-13T04:00:00'))).toBeCloseTo(0, 2)
  expect(arcProgress(new Date('2026-07-13T14:00:00'))).toBeCloseTo(0.5, 2)
  expect(arcProgress(new Date('2026-07-13T23:59:00'))).toBeCloseTo(1, 1)
  expect(arcProgress(new Date('2026-07-13T02:00:00'))).toBe(1) // after midnight = day over
})

test('pointXY follows the arc geometry (endpoints and apex)', () => {
  expect(pointXY(0)).toEqual({ x: 22, y: 100 })
  expect(pointXY(1)).toEqual({ x: 342, y: 100 })
  expect(pointXY(0.5).y).toBeLessThan(50) // apex region is high
})
```

- [ ] **Step 2:** `cd frontend && pnpm vitest run src/features/today/logic/dayArc.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement** `dayArc.ts`:

```ts
import type { CheckinSlot } from '@/data/types'

/** Napív geometry+data (spec §3.4). The day window is 04:00–24:00 mapped to t∈[0,1]
    along the quadratic Bézier M 22 100 Q 182 -28 342 100 (viewBox 364×112). */
export type ArcPoint = {
  t: number
  kind: 'checkin-done' | 'checkin-now' | 'checkin-pending' | 'workout' | 'sleep'
  label: string
}

const DAY_START = 4 * 60
const DAY_END = 24 * 60
const SLEEP_LABEL = '23:00'

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
function tOf(hhmm: string): number {
  const clamped = Math.min(Math.max(minutesOf(hhmm), DAY_START), DAY_END)
  return (clamped - DAY_START) / (DAY_END - DAY_START)
}

export function buildArcPoints(input: { checkins: CheckinSlot[]; workoutTime: string | null }): ArcPoint[] {
  const pts: ArcPoint[] = input.checkins.map(c => ({
    t: tOf(c.time),
    kind: c.state === 'done' ? 'checkin-done' : c.state === 'now' ? 'checkin-now' : 'checkin-pending',
    label: c.time,
  }))
  if (input.workoutTime) pts.push({ t: tOf(input.workoutTime), kind: 'workout', label: input.workoutTime })
  pts.push({ t: tOf(SLEEP_LABEL), kind: 'sleep', label: SLEEP_LABEL })
  return pts.sort((a, b) => a.t - b.t)
}

export function arcProgress(now: Date): number {
  const mins = now.getHours() * 60 + now.getMinutes()
  if (mins < DAY_START) return 1
  return Math.min((mins - DAY_START) / (DAY_END - DAY_START), 1)
}

/** Quadratic Bézier point at t for P0(22,100) C(182,-28) P2(342,100). */
export function pointXY(t: number): { x: number; y: number } {
  const u = 1 - t
  return {
    x: Math.round((u * u * 22 + 2 * u * t * 182 + t * t * 342) * 100) / 100,
    y: Math.round((u * u * 100 + 2 * u * t * -28 + t * t * 100) * 100) / 100,
  }
}
```

- [ ] **Step 4:** Re-run the test file → PASS. Full gate (both modes) → PASS.
- [ ] **Step 5: Commit** — `git add frontend/src/features/today/logic/ && git -c core.hooksPath=/dev/null commit -m "feat(fe/today): dayArc pure logic for the napiv (mezo-8141)"`

---

### Task 2: `DayArc` component + arc CSS

**Files:**
- Create: `frontend/src/features/today/components/DayArc.tsx`
- Test: `frontend/src/features/today/components/DayArc.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (Napív section, before the trailing safe-area block)

**Interfaces:**
- Consumes: Task 1 exports; `daypartNow` from `@/shared/lib/daypart`.
- Produces: `DayArc({ checkins, workoutTime, now? }: { checkins: CheckinSlot[]; workoutTime: string | null; now?: Date })` — Task 8 mounts it in TodayPage. Renders `<div class="dayarc" role="img" aria-label="A napod íve">` with an SVG: gray base path, gradient progress path (stroke-dasharray from `arcProgress`), one `<circle class="arc-dot arc-{kind}">` per point, the sun/moon `<circle class="arc-sun">` at the progress position; below it a `.arclbl` label row (each point's label; the label after the current progress gets `<b>`).

- [ ] **Step 1: Failing test** (`DayArc.test.tsx`) — note: no `.np-anim` visibility assertions, presence only:

```tsx
import { render, screen } from '@testing-library/react'
import { DayArc } from '@/features/today/components/DayArc'
import type { CheckinSlot } from '@/data/types'

const slot = (time: string, state: CheckinSlot['state']): CheckinSlot =>
  ({ time, state, values: null, note: '' }) as unknown as CheckinSlot

const CHECKINS = [slot('06:30', 'done'), slot('10:00', 'done'), slot('14:00', 'now'), slot('20:00', 'pending')]

test('renders the arc with one dot per point plus the sun marker', () => {
  const { container } = render(
    <DayArc checkins={CHECKINS} workoutTime="17:00" now={new Date('2026-07-13T14:00:00')} />,
  )
  expect(screen.getByRole('img', { name: 'A napod íve' })).toBeInTheDocument()
  expect(container.querySelectorAll('.arc-dot')).toHaveLength(6)
  expect(container.querySelectorAll('.arc-sun')).toHaveLength(1)
  expect(container.querySelector('.arc-checkin-done')).not.toBeNull()
  expect(container.querySelector('.arc-workout')).not.toBeNull()
})

test('labels every point and no workout point on rest days', () => {
  const { container } = render(
    <DayArc checkins={CHECKINS} workoutTime={null} now={new Date('2026-07-13T09:00:00')} />,
  )
  expect(screen.getByText('06:30')).toBeInTheDocument()
  expect(screen.getByText('23:00')).toBeInTheDocument()
  expect(container.querySelector('.arc-workout')).toBeNull()
})
```

- [ ] **Step 2:** Run it → FAIL.
- [ ] **Step 3: Implement** `DayArc.tsx`:

```tsx
import { buildArcPoints, arcProgress, pointXY } from '@/features/today/logic/dayArc'
import type { CheckinSlot } from '@/data/types'

const ARC = 'M 22 100 Q 182 -28 342 100'
const ARC_LEN = 400 // ≥ real path length; progress uses fraction of this

const DOT_CLASS: Record<string, string> = {
  'checkin-done': 'arc-dot arc-checkin-done',
  'checkin-now': 'arc-dot arc-checkin-now',
  'checkin-pending': 'arc-dot arc-checkin-pending',
  workout: 'arc-dot arc-workout',
  sleep: 'arc-dot arc-sleep',
}

export function DayArc({ checkins, workoutTime, now = new Date() }: {
  checkins: CheckinSlot[]
  workoutTime: string | null
  now?: Date
}) {
  const points = buildArcPoints({ checkins, workoutTime })
  const progress = arcProgress(now)
  const sun = pointXY(progress)
  return (
    <div className="dayarc" role="img" aria-label="A napod íve">
      <svg viewBox="0 0 364 112" width="100%">
        <defs>
          <linearGradient id="arc-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--amber)" />
            <stop offset=".55" stopColor="var(--coral)" />
            <stop offset="1" stopColor="var(--lav)" />
          </linearGradient>
        </defs>
        <path d={ARC} fill="none" className="arc-base" />
        <path
          d={ARC} fill="none" className="arc-progress" stroke="url(#arc-grad)"
          strokeDasharray={`${Math.round(progress * ARC_LEN)} ${ARC_LEN}`}
        />
        {points.map(p => {
          const { x, y } = pointXY(p.t)
          return <circle key={`${p.kind}-${p.label}`} className={DOT_CLASS[p.kind]} cx={x} cy={y} r="6" />
        })}
        <circle className="arc-sun" cx={sun.x} cy={sun.y} r="7.5" />
      </svg>
      <div className="arclbl">
        {points.map(p => (
          <span key={`l-${p.kind}-${p.label}`}>{p.t >= progress && p.kind === 'checkin-now' ? <b>{p.label}</b> : p.label}</span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Append the arc CSS** to the Napív section of `prototype.css` (before the safe-area block):

```css
/* ===== Napív day-arc (Today signature, spec §3.4) ===== */
.dayarc { margin: 4px 0 2px; }
.arc-base { stroke: var(--line); stroke-width: 5; stroke-linecap: round; }
.arc-progress { stroke-width: 5; stroke-linecap: round; }
.arc-dot { transform-box: fill-box; transform-origin: center; }
.arc-checkin-done { fill: var(--sage); }
.arc-checkin-now { fill: var(--surface); stroke: var(--coral); stroke-width: 2.5; }
.arc-checkin-pending { fill: var(--surface); stroke: var(--faint); stroke-width: 2.5; }
.arc-workout { fill: var(--surface); stroke: var(--coral); stroke-width: 2.5; }
.arc-sleep { fill: var(--surface); stroke: var(--lav); stroke-width: 2.5; }
.arc-sun { fill: var(--coral); filter: drop-shadow(0 0 8px rgba(255, 150, 60, .7)); }
[data-day="este"] .arc-sun { fill: var(--lav); filter: drop-shadow(0 0 8px rgba(155, 143, 196, .8)); }
.arclbl { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--faint); font-weight: 700; padding: 0 18px; margin-top: -4px; }
.arclbl b { color: var(--coral-deep); }
```

- [ ] **Step 5:** Test file → PASS; full gate both modes → PASS.
- [ ] **Step 6: Commit** — `git add frontend/src/features/today/components/DayArc.tsx frontend/src/features/today/components/DayArc.test.tsx frontend/src/styles/prototype.css && git -c core.hooksPath=/dev/null commit -m "feat(fe/today): DayArc napiv component with progress sun and point dots (mezo-8141)"`

---

### Task 3: `GreetingHeader` (daypart-aware) replaces `DateMesoHeader` + `RetaPhaseSection`

**Files:**
- Create: `frontend/src/features/today/components/GreetingHeader.tsx` + `GreetingHeader.test.tsx`
- Delete (in Task 8, after TodayPage swaps): nothing yet — this task only ADDS.
- Modify: `frontend/src/styles/prototype.css` (greet CSS)

**Interfaces:**
- Consumes: `daypartNow` (`@/shared/lib/daypart`); `TodayMeta`, `UserMeta` from `@/data/types`.
- Produces: `GreetingHeader({ today, user, retaDay, now? }: { today: TodayMeta; user: UserMeta; retaDay: number; now?: Date })` — renders `.greet` with a `.greet-day` line `` `${today.dayLabel} · ${today.dateLabel} · Reta D${retaDay}` `` (uppercase via CSS) and an `<h1>` greeting: reggel `Szép reggelt, {user.name} — <em>induljunk.</em>` · délután `Szia {user.name} — <em>jó napod lesz.</em>` · este `Szép estét — <em>zárjuk a napot.</em>`. (Check `UserMeta` for the name field — the Explore brief says `user` exists on `useToday()`; if the field is `user.name` use it, if it's `user.firstName` adapt and note in the report.)

- [ ] **Step 1: Failing test:**

```tsx
import { render, screen } from '@testing-library/react'
import { GreetingHeader } from '@/features/today/components/GreetingHeader'
import { today, user } from '@/data/today/today'

test('renders the day line with reta day and the daypart greeting', () => {
  render(<GreetingHeader today={today} user={user} retaDay={3} now={new Date('2026-07-13T14:00:00')} />)
  expect(screen.getByText(content => content.includes('Reta D3'))).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('jó napod lesz.')
})

test('morning and evening greetings follow the daypart', () => {
  const { rerender } = render(
    <GreetingHeader today={today} user={user} retaDay={3} now={new Date('2026-07-13T06:30:00')} />,
  )
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('induljunk.')
  rerender(<GreetingHeader today={today} user={user} retaDay={3} now={new Date('2026-07-13T21:00:00')} />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('zárjuk a napot.')
})
```

(Adapt the `today`/`user` import to the actual export names in `frontend/src/data/today/today.ts` — read it first.)

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement:**

```tsx
import { daypartNow } from '@/shared/lib/daypart'
import type { TodayMeta, UserMeta } from '@/data/types'

export function GreetingHeader({ today, user, retaDay, now = new Date() }: {
  today: TodayMeta; user: UserMeta; retaDay: number; now?: Date
}) {
  const dp = daypartNow(now)
  return (
    <div className="greet">
      <div className="greet-day">{today.dayLabel} · {today.dateLabel} · Reta D{retaDay}</div>
      <h1>
        {dp === 'reggel' && <>Szép reggelt, {user.name} — <em>induljunk.</em></>}
        {dp === 'delutan' && <>Szia {user.name} — <em>jó napod lesz.</em></>}
        {dp === 'este' && <>Szép estét — <em>zárjuk a napot.</em></>}
      </h1>
    </div>
  )
}
```

CSS (Napív section):

```css
.greet { padding: 8px 6px 0; }
.greet-day { font-size: 12.5px; font-weight: 700; color: var(--coral-deep); letter-spacing: .4px; text-transform: uppercase; }
[data-day="reggel"] .greet-day { color: #B2690F; }
[data-day="este"] .greet-day { color: var(--lav-deep); }
.greet h1 { font-family: var(--ff-display); font-size: 26px; font-weight: 700; letter-spacing: -.3px; margin-top: 2px; color: var(--ink); }
.greet h1 em { font-style: normal; color: var(--coral); }
[data-day="reggel"] .greet h1 em { color: #E8890C; }
[data-day="este"] .greet h1 em { color: var(--lav-deep); }
```

- [ ] **Step 4:** Test → PASS; gate both modes → PASS. **Step 5: Commit** (`feat(fe/today): daypart-aware GreetingHeader (mezo-8141)`).

---

### Task 4: Hero rework — `WorkoutTeaser` becomes the Napív hero

**Files:**
- Modify: `frontend/src/features/today/components/WorkoutTeaser.tsx` + `WorkoutTeaser.test.tsx`
- Modify: `frontend/src/features/today/components/VolleyballCard.tsx` (restyle to a secondary event row with a `RÖPI` type tag; keep props/conditional-null contract and the note row)
- Modify: `frontend/src/styles/prototype.css` (hero CSS)

**Interfaces:**
- Consumes: existing props `{ workout, niggle, time, prediction }` — UNCHANGED (TodayPage keeps passing them).
- Produces: same component name/file; renders `.np-hero` structure: eyebrow `KÖVETKEZŐ · MA {time} · {today's meso context is NOT available here — keep eyebrow to `Következő · ma {time}`}`, `.h2row` with `<h2>{workout.title}</h2>` + `<span class="typetag typetag-gym">🏋️ Gym · hipertrófia</span>`, meta line `<b>{exercises.length} gyakorlat · ~{durationEst} perc</b>` + prediction (`prediction.label` when present), warm niggle strip **using `workout.niggleWarning.detail`** (fixes the hardcoded-copy gotcha; render only when `niggle && workout.niggleWarning`), CTA row: `.np-cta.np-press` "Indítsuk →" (navigate `/train`, keep behavior) + `.alt-btn.np-press` "⋯" (navigate `/train` too).

- [ ] **Step 1: Update the test FIRST** (failing): keep the existing test intents (title renders, niggle banner on/off, CTA navigates) and add: (a) the niggle strip text equals `workout.niggleWarning.detail` from the mock seed (import the mock workout from `@/data/today/today` and assert its `.detail` string appears); (b) a `typetag` with text matching /Gym/i renders. Remember: no `toBeVisible` on `.np-anim` nodes — use `getByText`.
- [ ] **Step 2:** Run → FAIL on the new assertions.
- [ ] **Step 3: Implement the rework.** Structure (adapt the file's existing navigate/test hooks):

```tsx
<section className="np-hero np-anim" style={{ '--i': 2 } as React.CSSProperties}>
  <div className="np-hero-eyebrow"><span className="dotp" />Következő · ma {time ?? '—'}</div>
  <div className="h2row">
    <h2>{workout.title}</h2>
    <span className="typetag typetag-gym">🏋️ Gym · hipertrófia</span>
  </div>
  <div className="np-hero-meta">
    <b>{workout.exercises.length} gyakorlat · ~{workout.durationEst} perc</b>
    {prediction ? <> · {prediction.label}</> : null}
  </div>
  {niggle && workout.niggleWarning && (
    <div className="warmstrip">⚠️ {workout.niggleWarning.detail}</div>
  )}
  <div className="np-ctarow">
    <button type="button" className="np-cta np-press" onClick={goTrain}>Indítsuk →</button>
    <button type="button" className="alt-btn np-press" aria-label="Részletek" onClick={goTrain}>⋯</button>
  </div>
</section>
```

(Read the current file first: `workout.niggleWarning` shape — if `.detail` doesn't exist, use the field that carries the human copy and note it. Keep `Workout|WorkoutPlan` union handling as-is.)

CSS (Napív section):

```css
/* ===== Napív Today hero ===== */
.np-hero { position: relative; background: var(--surface); border-radius: 26px; padding: 18px; box-shadow: var(--np-shadow-card); overflow: hidden; margin-top: 10px; }
.np-hero::after { content: ''; position: absolute; top: -52px; right: -52px; width: 170px; height: 170px; border-radius: 50%; background: radial-gradient(circle, rgba(255,107,74,.13), transparent 68%); }
.np-hero-eyebrow { display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 800; color: var(--coral-deep); letter-spacing: .5px; text-transform: uppercase; }
.np-hero-eyebrow .dotp { width: 8px; height: 8px; border-radius: 50%; background: var(--coral); box-shadow: 0 0 0 4px rgba(255,107,74,.16); }
.h2row { display: flex; align-items: center; gap: 10px; margin-top: 7px; flex-wrap: wrap; }
.h2row h2 { font-family: var(--ff-display); font-size: 29px; font-weight: 800; letter-spacing: -.4px; color: var(--ink); }
.typetag { display: inline-block; border-radius: 999px; padding: 5px 11px; font-size: 10px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; }
.typetag-gym { background: #FFEDE6; color: var(--coral-deep); }
.typetag-sport { background: #FBE9EC; color: #B14B5E; }
.typetag-run { background: #E7F0F8; color: #3E6E9E; }
:root[data-theme="dark"] .typetag-gym { background: rgba(255,107,74,.16); }
:root[data-theme="dark"] .typetag-sport { background: rgba(226,122,139,.16); }
:root[data-theme="dark"] .typetag-run { background: rgba(111,167,216,.16); }
.np-hero-meta { font-size: 13.5px; color: var(--sub); margin-top: 4px; }
.np-hero-meta b { color: var(--ink); font-weight: 700; }
.warmstrip { display: flex; align-items: center; gap: 8px; background: rgba(255,179,71,.16); border-radius: 14px; padding: 10px 12px; font-size: 12px; color: #8F5514; margin-top: 12px; font-weight: 600; }
:root[data-theme="dark"] .warmstrip { color: #E8B36B; }
.np-ctarow { display: flex; gap: 10px; margin-top: 14px; position: relative; z-index: 1; }
.np-cta { flex: 1; border: 0; cursor: pointer; font: inherit; background: linear-gradient(135deg, #FF7A55, #FF5B36); color: #fff; border-radius: 999px; padding: 15px 0; text-align: center; font-weight: 800; font-size: 15.5px; box-shadow: 0 10px 24px rgba(255,91,54,.35), inset 0 1px 0 rgba(255,255,255,.25); }
.alt-btn { width: 52px; height: 52px; border: 1.5px solid var(--line); border-radius: 50%; background: var(--surface); color: var(--sub); font-size: 17px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
```

- [ ] **Step 4:** VolleyballCard restyle: keep the component contract; swap its pink `notch` styling to a `.dayrow`-like secondary card with `<span class="typetag typetag-sport">RÖPI</span>` before the title; keep tests passing (update class assertions only if they exist).
- [ ] **Step 5:** Tests → PASS; gate both modes → PASS. **Step 6: Commit** (`feat(fe/today): Napiv hero rework of WorkoutTeaser + Volleyball secondary event row (mezo-8141)`).

---

### Task 5: BriefingCard collapse (2 lines + „bővebben")

**Files:**
- Modify: `frontend/src/features/today/components/BriefingCard.tsx` + `BriefingCard.test.tsx`
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- Consumes/produces: props `{ briefing, demo }` UNCHANGED. Collapsed state renders `.brief` (warm inset, ✨ prefix, body clamped to 2 lines via CSS `-webkit-line-clamp: 2`), a `bővebben` button; expanded state renders the full existing card body (all paragraphs via `SafeMarkdown`, refs row, confidence/demo chip) + `összecsuk` button. Local `useState(false)`, default collapsed.

- [ ] **Step 1: Update tests first** (failing): default state shows the FIRST paragraph text (presence) and a `bővebben` button, but NOT the refs row; clicking `bővebben` reveals refs (`RefTag` labels from the mock briefing) and the confidence chip; `demo` label logic unchanged (assert in expanded state). Keep existing bold-via-strong assertion in the expanded state.
- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** (keep `SafeMarkdown`; collapsed shows only `briefing.body[0]` inside a `.brief-clamp` div):

CSS:

```css
.brief { display: flex; gap: 10px; background: var(--warm); border-radius: 20px; padding: 13px 15px; margin-top: 12px; }
.brief-clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 12.5px; line-height: 1.55; color: var(--sub); }
.brief-more { border: 0; background: none; cursor: pointer; font: inherit; color: var(--coral-deep); font-weight: 800; white-space: nowrap; font-size: 12px; align-self: flex-end; }
```

- [ ] **Step 4:** Tests → PASS; gate → PASS. **Step 5: Commit** (`feat(fe/today): briefing collapses to two lines with bővebben expander (mezo-8141)`).

---

### Task 6: Heartbeat beats + "Ma eddig" mini-rings

**Files:**
- Modify: `frontend/src/features/today/components/CheckInStrip.tsx` + test (restyle only — props/behavior unchanged)
- Modify: `frontend/src/features/today/components/QuickStatsRow.tsx` + `bottomSections.test.tsx` (restyle to ring cards)
- Modify: `frontend/src/styles/prototype.css`

**Interfaces:**
- `CheckInStrip({ checkins, onCheckIn })` UNCHANGED behavior: 4 `.beat` buttons — done → `.beat done` with time + avg value; now → `.beat now` with time + `koppints`; skipped → `—`; pending → `·`. Section header renders `Hogy vagy ma?` + `N/4` (replaces the mono "Heartbeat · 4×/nap" eyebrow; update test strings accordingly — the count assertion stays).
- `QuickStatsRow()` renders `.snap` of `.scard` items: each an SVG mini-ring (34×34, `--warm` track + colored progress) + label + value, colors: kcal→`--coral`, fehérje→`--sage`, alvás→`--lav`, súly→`--sage`, hrv→`--lav`. Ring fill: derive pct where the stat has a natural target, else render a full ring at 100% (visual chip). Real-mode behavior (sleep+weight only, HRV dropped) UNCHANGED — the test's mode split stays.

CSS:

```css
.beats { display: flex; gap: 8px; }
.beat { flex: 1; border: 0; cursor: pointer; font: inherit; border-radius: 16px; padding: 9px 0 8px; text-align: center; background: var(--warm); color: var(--faint); }
.beat .t { font-size: 10.5px; font-weight: 800; }
.beat .v { font-size: 16px; font-weight: 800; margin-top: 1px; font-family: var(--ff-display); }
.beat.done { background: #EAF0E3; color: var(--sage-deep); }
:root[data-theme="dark"] .beat.done { background: rgba(127,164,138,.16); }
.beat.now { background: var(--surface); color: var(--coral-deep); box-shadow: 0 0 0 2px var(--coral), 0 6px 14px rgba(255,107,74,.22); position: relative; }
.beat.now .v { font-size: 11px; font-weight: 800; padding-top: 4px; }
.beat.now::after { content: ''; position: absolute; inset: -2px; border-radius: 16px; box-shadow: 0 0 0 2px var(--coral); opacity: 0; animation: beatpulse 2.4s ease-out infinite; }
@keyframes beatpulse { 0% { opacity: .7; transform: scale(1); } 70% { opacity: 0; transform: scale(1.1); } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .beat.now::after { animation: none; } }
.secthead-np { display: flex; justify-content: space-between; align-items: baseline; margin: 16px 6px 9px; }
.secthead-np h3 { font-size: 14.5px; font-weight: 800; color: var(--ink); }
.secthead-np span { font-size: 12px; color: var(--faint); font-weight: 700; }
.snap { display: flex; gap: 9px; }
.scard { flex: 1; background: var(--surface); border-radius: 18px; padding: 11px; box-shadow: var(--np-shadow-row); display: flex; align-items: center; gap: 8px; }
.scard .l { font-size: 9.5px; color: var(--faint); font-weight: 800; letter-spacing: .4px; text-transform: uppercase; }
.scard .n { font-size: 14px; font-weight: 800; font-family: var(--ff-display); margin-top: 1px; font-variant-numeric: tabular-nums; color: var(--ink); }
```

- [ ] Steps: update tests first (strings `Hogy vagy ma?`, ring presence via `container.querySelectorAll('.scard svg')`), run FAIL → implement → PASS → full gate → commit (`feat(fe/today): heartbeat beats row + Ma eddig mini-rings (mezo-8141)`).

---

### Task 7: Growth relocation — quests + activity log move to `/me/growth`, Today gets `GrowthTodayRow`

**Files:**
- Create: `frontend/src/features/today/components/GrowthTodayRow.tsx` + test
- Modify: `frontend/src/features/me/pages/GrowthPage.tsx` + its test (mount `DailyQuestsCard` + `ActivityLogCard` in a new "Ma" block at the top of the SKILLEK tab — read the page first and place them per its structure; imports from `@/features/today/components/...` are cross-feature but legal)
- Modify: `frontend/src/styles/prototype.css` (growrow CSS)
- Note: `DailyQuestsCard.tsx`/`ActivityLogCard.tsx` files DO NOT move (their tests stay green untouched).

**Interfaces:**
- `GrowthTodayRow()` — hooks: `useDailyQuests(todayIso)` + `useActivities(todayIso)` (both already exported from `@/data/hooks`; use the same date the cards use — read `DailyQuestsCard.tsx` for the date derivation and reuse it). Renders a `Link to="/me/growth"` styled `.growrow np-press`: 🌱 + `Növekedés ma` + sub-line `` `${done}/${total} küldetés · +${xpToday} XP` `` (xpToday = sum of `xp` on completed quests + awarded activity XP — derive with a small pure helper `growthTodaySummary(quests, entries)` in `features/today/logic/growthToday.ts` with its own unit test) + chevron. Renders `null` when both sources are empty (real-mode ghost behavior).
- GrowthPage: level-up consumption (`DailyQuestsCard`'s `useEffect`) now fires on the Growth page — note this behavior change in the docs task.

CSS:

```css
.growrow { display: flex; align-items: center; gap: 11px; background: var(--surface); border-radius: 18px; padding: 12px 14px; box-shadow: var(--np-shadow-row); margin-top: 9px; text-decoration: none; color: inherit; }
.growrow .t1 { font-size: 13px; font-weight: 800; color: var(--ink); }
.growrow .t2 { font-size: 11.5px; color: var(--faint); font-weight: 700; margin-top: 1px; }
.growrow .chev { margin-left: auto; color: var(--faint); }
```

- [ ] Steps: TDD the `growthTodaySummary` helper first (test: 1 done of 3 quests at 15 XP + one awarded 18 XP activity → `{ done: 1, total: 3, xp: 33 }`), then `GrowthTodayRow` render test (MemoryRouter; mock-mode seed shows `1/3 küldetés`-style text — derive the exact expected numbers from the mock seed by reading `data/progression` mocks first), then GrowthPage mounting (its test gains: quests card + activity card render on Growth), gate both modes, commit (`feat(fe/growth): quests + activity log relocate to Growth, Today gets one-row summary (mezo-8141)`).

---

### Task 8: TodayPage re-composition + removals

**Files:**
- Modify: `frontend/src/features/today/pages/TodayPage.tsx` + `TodayPage.test.tsx` (and `topSections.test.tsx`/`bottomSections.test.tsx`/`conditionalCards.test.tsx` as they split per section)
- Delete: `frontend/src/features/today/components/DateMesoHeader.tsx` + test, `RetaPhaseSection.tsx` + test, `InsightsTeaser.tsx` + test
- Modify: `frontend/src/app/shell.test.tsx` if the `/` redirect assertion greps briefing text (it asserts `getByText(/briefing/i)` — update to the greeting or hero text)

**New render order (non-anchor):**
1. `<BrandRow />` (unchanged — ✨ Insights entry lives here)
2. `<GreetingHeader today={today} user={user} retaDay={scenario.retaDay} />`
3. `<DayArc checkins={checkins} workoutTime={workoutTime} />`
4. `{workout && <WorkoutTeaser ... />}` (the hero) — on rest days render the volleyball session as the hero-slot event if present, else nothing extra
5. `<BriefingCard briefing={...} demo={briefingDemo} />` (collapsed)
6. `{companionNote && <CompanionNoteCard note={companionNote} />}`
7. `{scenario.vulnerable && <VulnerabilityCard />}`
8. `<CheckInStrip checkins={checkins} onCheckIn={setCheckInIdx} />`
9. `{todaySport && <VolleyballCard session={todaySport} note={volleyballNote} />}` (when not already hero)
10. `<QuickStatsRow />` (Ma eddig)
11. `<FuelTimelinePreview />` (kept — spec doesn't remove it; restyle rides on tokens)
12. `<GrowthTodayRow />`
13. CheckInSheet mount (unchanged)

**Removals:** `RetaPhaseSection` (reta day lives in the greeting line; the full bar remains on Fuel/Mai + Gyógyszer), `DateMesoHeader` (meso context moves nowhere — W/D + phase chips are Train-domain info available on Train; note the relocation in docs), `InsightsTeaser` (spec §4.2; entry = ✨).

- [ ] Steps: update the page + tests (each removed component's page-level assertions deleted; new order asserted by role/text presence; `hooks.test.tsx` untouched — `useTodayScenario` unchanged), run both modes, fix fallout listed by the suite (expect `shell.test.tsx` redirect assertion + `topSections.test.tsx`), full gate, commit (`feat(fe/today): Napiv Today re-composition — greeting, dayarc, hero-first order, teaser removals (mezo-8141)`).

---

### Task 9: AnchorMode restyle (S2 leftover)

**Files:**
- Modify: `frontend/src/features/today/pages/AnchorModeView.tsx` + test
- Modify: `frontend/src/styles/prototype.css` (retire `--anchor-*` consumers here; keep the tokens for now)

Keep the page's content and behavior identical (header + exit chip, message card, 3 anchors, paused note). Restyle: standard Napív cards (`.card`-equivalents with `--warm`/`--surface`), muted contrast, NO `.np-anim` (calm page — no entrance motion), and the existing `.phone-screen.anchor` sky-muting stays. Test updates: class assertions only.

- [ ] Steps: restyle → tests pass → gate → commit (`feat(fe/today): AnchorMode restyled to muted Napiv (mezo-8141)`).

---

### Task 10: Slice close — docs, gates, push

**Files:**
- Modify: `docs/features/today.md` (§2 new section order + removals/relocations; §5 integrations: InsightsTeaser seam removed, Growth relocation seam added; §9 gotchas: niggle copy now from `niggleWarning.detail`, quests level-up consumption moved to Growth; §10 file map: DayArc/GreetingHeader/GrowthTodayRow added, DateMesoHeader/RetaPhaseSection/InsightsTeaser removed)
- Modify: `docs/features/growth.md` (quests + activity cards now render on `/me/growth`; Today summary row seam)
- Modify: `docs/features/insights.md` §5.2 (Today teaser seam removed — entry via ✨ only)
- Check: `docs/features/_platform-design-system.md` staleness (prototype.css touched repeatedly — bump/one-liner if flagged)

- [ ] Steps: edit docs → `node scripts/lint-docs.mjs` PASS → full gate both modes → `bd update mezo-8141 --notes "S3 Today landed: ..."` (controller runs bd) → commit (`docs(features): today/growth/insights docs updated for Napiv S3 (mezo-8141)`) → push branch → open PR (CI gate) → after green, merge --no-ff per house flow (controller).

---

## Out of scope (later plans)

S4 Train (pill nav, load tiles, day cards) → S5 Active workout (Live-Activity island) → S6 Fuel (gauge, macro bars, enriched timeline — the FuelTimelinePreview gets its full Napív treatment here) → S7 Me → S8 Insights re-skin + Pulse dark + Deep-Current cleanup (incl. legacy `.tab-bar`/`.tab-item` styles, `--anchor-*` tokens, orphaned comments, stale parity mentions) + visual self-baselines.

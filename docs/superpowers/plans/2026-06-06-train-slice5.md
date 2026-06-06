# Train (Slice 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the **Train** tab — the largest, most complex Phase-1 slice — to pixel-parity on typed mock data: a four-item sub-nav (**Mai · GYM · Sport · Mesociklusok**), a three-view **mesocycle builder** (Áttekintés / Volumen / Gyakorlatok) with the signature **VolumeBar provenance widget**, a **4-step AI mesocycle planner**, and a full-screen **active workout mode** (prep → active set-logging → complete).

**Architecture:** New code under `src/features/train/`. The 4 sub-tabs follow the Insights/Me/Fuel pattern: `train` becomes a **parent route** rendering chrome (page-header with dynamic title + `TrainSubNav` + `<Outlet/>`) with one nested child route per sub-tab (`/train` index = Mai, `/train/gym`, `/train/sport`, `/train/mesocycles`). The three **full-screen takeover flows** (active workout, 4-step planner, mesocycle builder) are declared as **sibling top-level routes** so they render WITHOUT the Train sub-nav, each with its own back-button header: `/train/session` (active workout), `/train/mesocycles/new` (planner), `/train/mesocycles/:id` (builder). A new `src/data/train.ts` (+ types + a read-only `useTrain()` hook) feeds every view. All interactive state (logged sets, planner selections, builder edits, sport-log inputs) lives in **local React state** — never a backend, never `window.MezoData`.

**Tech Stack:** Vite · React 19 · TypeScript (strict, no `any`) · react-router-dom v7 (nested routes + `Outlet` + `NavLink` + `useLocation` + `useNavigate` + `useParams`) · Tailwind v4 `@theme` + the hand-written global classes in `src/styles/prototype.css` · Vitest + React Testing Library + `@testing-library/user-event` · Playwright (parity).

**Source of truth (the locked design — read the exact prototype file while implementing):** All paths under `/Users/daniel.kuhne/Downloads/design_handoff_mezo/prototype/src/`.
- `app.jsx` — `TrainSubNav` + `TrainOverview` sub-router (the view/state machine that the routes replace).
- `train-views.jsx` — `TrainTodayView` (Mai), `WeeklyDayRow`, `GymView`, `GymStat`, `PhaseDots`, `GymDayCard`, `GymDaySheet`, `GymExRow`.
- `sport.jsx` — `SportView`, `SportStat`, `MiniBar`, `CrossLoadRow`, `SportSessionCard`, `SportWeekView`, `SportLogView`, `SportCrossloadView`, `SportLogSheet`, `NumberStep`, `ScaleRow`.
- `mesocycles.jsx` — `MesocycleLibrary`, `ActiveMesoCard`, `PlannedMesoCard`, `ArchivedMesoCard`, `MetaStat`, `MesocycleBuilder`, `MesoOverview`, `MesoVolume`, `VolumeBar`, `FinalStat`, `MesoExercises`, `DayExerciseSection`, `ExerciseEditRow`, `EditorChip`, `ExercisePickerSheet`, `DayDetailSheet`, and the module constants `MESOCYCLE_PHASE_COLORS`, `MUSCLE_LABELS`.
- `meso-planner.jsx` — `MesocyclePlanner`, `Step0Goal`/`Step1Length`/`Step2Split`/`Step3Program`, `PlannerDaySection`, `PlannerExerciseRow`, `MiniStat`, `generateProgram`, `addWeeks`, `getSeason`, `GOAL_PRESETS`, `SPLITS`.
- `train.jsx` — active workout: `TrainScreen` (proto name; **ours is `ActiveWorkoutScreen`**), `CompactStepper`, `LastWeekStat`, `PRToast`, `FeedbackModal`, `FeedbackRow`, `WorkoutComplete`, `CompleteStat`.
- `challenges.jsx` — `ChallengesCarousel`, `ChallengeCard`.
- `data.js` — Train data (line anchors): `user` (7-18), `mesocycles` (19-249; `volumeRecompute` 33-42, `volumePerMuscle` 43-130, `days` ~132-200), `sport` (250-322; `schedule` 251-266, `sessions` 267-271, `week` ~272-282, `crossLoad` 283-321), `gymSchedule` (324-351), `exerciseLibrary` (538-560), `workout` (626-…, `challenges` 642-…).
- Design docs: `02-screens.md` (TAB 2 Train), `03-components.md`, `04-data-model.md`, `README.md` §5–6.

**Conventions (apply in EVERY task):**
- TypeScript strict, **no `any`**, **no `dangerouslySetInnerHTML`**. Keep all Hungarian copy **verbatim**.
- This codebase styles with **global utility classes** (`src/styles/prototype.css`) + inline `style={{}}` + `notch-*`/`accent-strip` classes — **NOT** Tailwind utility classes in feature code. Port the prototype's inline-styled markup faithfully.
- **Named exports only** (no default exports). PascalCase components/files. Tests colocated `.test.tsx`.
- **Reuse** Foundation primitives — never rebuild them (inventory below). Cross-feature/`data`/`lib`/`components` imports use the `@/` alias; intra-feature imports are relative (`./tabs`, `../components/X`).
- `window.MezoData.*` → typed read-only `useTrain()` hook.
- Prototype's `tweaks.niggle` design-time toggle → a real data-driven flag from the mock (`workout.niggleWarning` present ⇒ niggle active). The PR-demo trigger (set 3 of exercise 0 with weight ≥ 105) is kept as-is (it is the prototype's scripted demo moment).
- Commit after each task; English message, scope `(train)`, ending with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (the beads pre-commit hook runs `bd export`).
- Work from `/Users/daniel.kuhne/MrKuhne/mezo` on branch `slice5-train`.

**Reused Foundation primitives (import, do NOT rebuild):**
`Eyebrow` (`@/components/ui/Eyebrow`, prop `brand?`), `PageTitle` (`@/components/ui/PageTitle`), `Chip` (`@/components/ui/Chip`, `variant?: 'default'|'brand'|'warning'|'error'`), `LabelMono` (`@/components/ui/LabelMono`), `NotchCard` (`@/components/ui/NotchCard`, `notch?: 4|8|12`, `accent?`, `glass?`), `CtaPrimary`/`CtaGhost` (`@/components/ui/Cta`), `ProgressBar` (`@/components/ui/ProgressBar`, `value` 0-100, `tone?`, `color?`, `glow?`), `Icon` (`@/components/ui/Icon`, `name: IconName`, `size?`, `color?`), `ToolChipRow` + `type Tool` (`@/components/ui/ToolChipRow` / `@/components/ui/ToolChip`), `RefTag` (`@/components/ui/RefTag`, `kind`, `label`), `Toggle` (`@/components/ui/Toggle`, `on`, `onToggle`, `ariaLabel`), `Display` (`@/components/ui/Display`, `size?`), `Sheet` (`@/components/ui/Sheet`, `onClose`, children may be `(close)=>ReactNode`, `labelledBy?`), `cn` (`@/lib/cn`), `SafeMarkdown` (`@/lib/safeMarkdown`, `{ text }`).

**Icons audit:** Train uses `train, today, fuel, me, insights, sparkle, warning, check, x, plus, minus, chevron-right, chevron-down, chevron-up, tool, mic, search, anchor, bookmark, settings`. **All already exist in `Icon.tsx` — NO new icons needed.**

**CSS audit:** All Train-specific global classes already exist in `prototype.css` (confirmed): `.train-subnav`, `.subnav`/`.subnav-item`/`.subnav-item.active`, `.set-dots`/`.set-dot`(`.done`/`.active`), `.rir-row`/`.rir-cell`, `.stepper`/`.stepper-display`, `.bar`/`.bar-fill`/`.bar-fill.glow`, `.critique-grid`, `.toolchip`(`.read`/`.compute`/`.write`), `.cta-primary`/`.cta-ghost`, `.notch-4`/`.notch-8`/`.notch-12`, `.card`, `.chip`(`.brand`/`.warning`/`.error`), `.accent-strip`, `.with-subnav`, `.screen-content`, `.col`/`.row`/`.gap-*`/`.flex-1`/`.flex-wrap`/`.mt-*`, `.page-header`/`.page-title`, `.eyebrow`(`.brand`)/`.label-mono`/`.lbl`, `.text-secondary`/`.text-tertiary`/`.text-brand`/`.text-warning`/`.text-error`/`.text-success`. **No new CSS needed** (if a screen needs a one-off, use inline `style`).

**Design-fidelity port fixes (apply consistently):**
- Hardcoded volleyball/sport pinks (`rgba(244,114,182,*)`) → token `var(--cat-tendency)` (README §6).
- `Sport · Napló` averages `jumpCount`, a field **absent** from `sport.sessions` in `data.js` → in our `train.ts` mock, **add a `jumpCount` number to every sport session** (representative values: 38, 52, 31, 35, 48) so the "avg N ugrás" header renders an integer, not `NaN`.
- The Mai "today's volleyball block" only renders when a volleyball session is `today`. The mock "today" is **Csütörtök**, which has **no** volleyball session → the block correctly does not render. Port faithfully (do **not** invent a today volleyball session). The Mai gym block DOES render (Csü = Pull Day, `today:true`).
- `DayDetailSheet` body has an English fragment ("…Open the day to edit."). Port **verbatim** for parity (flag noted in `mezo-1cs`-style a11y/i18n polish backlog if strict HU is later required — out of scope here).

**Routing model (final):** In `src/app/router.tsx`, replace the stub `{ path: 'train', element: <TrainScreen /> }` with FOUR route objects at the AppLayout-children level:
```tsx
{ path: 'train', element: <TrainScreen />, children: [
  { index: true, element: <TrainTodayView /> },
  { path: 'gym', element: <GymView /> },
  { path: 'sport', element: <SportView /> },
  { path: 'mesocycles', element: <MesocycleLibraryView /> },
] },
{ path: 'train/session', element: <ActiveWorkoutScreen /> },
{ path: 'train/mesocycles/new', element: <MesocyclePlanner /> },
{ path: 'train/mesocycles/:id', element: <MesocycleBuilder /> },
```
react-router matches the most specific path, so `/train/mesocycles` hits the nested child (with sub-nav) while `/train/mesocycles/new` and `/train/mesocycles/abc` hit the full-screen siblings (no sub-nav). Entry into full-screen flows uses `useNavigate()`; exit uses `navigate(-1)` or `navigate('/train')`.

**Pre-flight (run once before Task 1 — already done if branch exists):**
```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git rev-parse --abbrev-ref HEAD   # expect: slice5-train
pnpm test                          # baseline: all green (199 tests) before starting
```

---

## Task 1: Data layer — Train types + `train.ts` + `useTrain` + tests

**Files:** Modify `src/data/types.ts` (append a `// --- Train ---` section); create `src/data/train.ts`; modify `src/data/hooks.ts` (add `useTrain`); create `src/data/trainData.test.tsx`. Contract: `data.js` Train sections (anchors in header). Read `04-data-model.md` for shape intent.

This is a faithful **data port**. Transcribe the real objects/values from `data.js` verbatim. Below are the TypeScript interfaces (authoritative — match the data to them) and the verbatim values for the small/critical consts; for the large arrays (`volumePerMuscle`, `mesocycles[].days`, `exerciseLibrary`) port the values directly from `data.js` at the given line ranges.

- [ ] **Step 1: Failing test** — `src/data/trainData.test.tsx`:

```tsx
import {
  mesocycles, activeMeso, workout, gymSchedule, sport, exerciseLibrary,
  GOAL_PRESETS, SPLITS, MUSCLE_LABELS, DAY_LABELS, DAY_ORDER,
  MESOCYCLE_PHASE_COLORS, phaseBarHeight,
} from './train'

test('mesocycles: one active, two planned, one archived', () => {
  expect(mesocycles).toHaveLength(4)
  expect(mesocycles.filter((m) => m.status === 'active')).toHaveLength(1)
  expect(mesocycles.filter((m) => m.status === 'planned')).toHaveLength(2)
  expect(mesocycles.filter((m) => m.status === 'archived')).toHaveLength(1)
  expect(activeMeso.shortTitle).toBe('Hypertrophy 04')
  expect(activeMeso.currentWeek).toBe(3)
  expect(activeMeso.phaseCurve).toEqual(['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'])
})

test('active workout: 5 exercises, niggle warning, 3 pre-workout challenges', () => {
  expect(workout.title).toBe('Pull Day')
  expect(workout.exercises).toHaveLength(5)
  expect(workout.exercises[0].name).toBe('Chest Supported Row')
  expect(workout.exercises[0].lastWeek).toEqual({ weight: 102.5, reps: 9, rir: 2 })
  expect(workout.niggleWarning?.muscleLabel).toBe('Jobb váll')
  expect(workout.challenges).toHaveLength(3)
  expect(workout.challenges[0].type).toBe('PR')
})

test('gym weekly schedule: Csütörtök is today + Pull Day', () => {
  const csu = gymSchedule.weeklyTimes.find((d) => d.day === 'Csü')
  expect(csu?.today).toBe(true)
  expect(csu?.type).toBe('Pull Day')
  expect(csu?.duration).toBe(78)
})

test('sport: volleyball schedule, recent sessions with jumpCount, crossLoad', () => {
  expect(sport.schedule.volleyball.team).toBe('BVSC · Felnőtt II.')
  expect(sport.sessions.length).toBeGreaterThanOrEqual(5)
  expect(sport.sessions.every((s) => typeof s.jumpCount === 'number')).toBe(true)
  expect(sport.week.avgRPE).toBeCloseTo(7.1)
  expect(sport.crossLoad.length).toBeGreaterThanOrEqual(5)
})

test('exercise library + planner presets + label maps', () => {
  expect(exerciseLibrary.length).toBeGreaterThanOrEqual(15)
  expect(GOAL_PRESETS).toHaveLength(5)
  expect(GOAL_PRESETS[0].id).toBe('hypertrophy')
  expect(SPLITS.length).toBeGreaterThanOrEqual(5)
  expect(MUSCLE_LABELS.chest).toBe('Mell')
  expect(DAY_LABELS.Csü).toBe('Csütörtök')
  expect(DAY_ORDER).toEqual(['Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas'])
  expect(MESOCYCLE_PHASE_COLORS.MAV).toBe('var(--brand-primary)')
  expect(phaseBarHeight('MRV')).toBeGreaterThan(phaseBarHeight('MEV'))
})
```

- [ ] **Step 2: Run → FAIL** — `pnpm test src/data/trainData.test.tsx` (cannot resolve `./train`).

- [ ] **Step 3: Append Train types** to `src/data/types.ts` (new `// --- Train ---` section). Reuse the existing `Tool` import if already present at top; otherwise `import type { Tool } from '@/components/ui/ToolChip'`.

```ts
// --- Train (mesocycles, workouts, sport) ---
export type MesoPhase = 'MEV' | 'MAV' | 'MRV' | 'Deload'
export type MesoStatus = 'active' | 'planned' | 'archived'
export type ExerciseKind = 'compound' | 'isolation'

export interface GymExercise {
  id: string
  name: string
  muscle: string
  sets: number
  targetReps: string
  targetRIR: number
  type: ExerciseKind
  warning?: string
}
export interface MesoDay {
  day: string            // 'Hét'..'Vas'
  type: string           // 'Pull Day' | 'Rest' | ...
  muscle: string
  exerciseCount: number
  exercises: GymExercise[]
  note?: string
  current?: boolean
  muscleAccent?: boolean
}
export interface VolumeBaseline { name: string; mev: number; mav: number; mrv: number }
export interface VolumeAdjustment {
  kind: string           // 'pattern' | 'recovery' | 'niggle' | 'sport-cross'
  label: string
  delta: Partial<Record<'mev' | 'mav' | 'mrv', number>>
  warning?: boolean
}
export interface VolumeSource {
  baseline: VolumeBaseline
  adjustments: VolumeAdjustment[]
  confidence: number
  note?: string
}
export interface VolumeProfile {
  mev: number; mav: number; mrv: number; current: number
  source: VolumeSource
}
export interface VolumeChange { muscle: string; change: string; reason: string; warning?: boolean }
export interface VolumeRecompute { lastRun: string; nextRun: string; trigger: string; changes: VolumeChange[] }

export interface Mesocycle {
  id: string
  status: MesoStatus
  title: string
  shortTitle: string
  goal: string
  startDate: string
  endDate: string
  weeks: number
  currentWeek: number
  split: string          // 'Pull / Push / Legs · 5×/hét'
  style: string          // 'RP · 6 hét'
  phaseCurve: MesoPhase[]
  notes?: string
  summary?: string
  volumeRecompute?: VolumeRecompute
  volumePerMuscle?: Record<string, VolumeProfile>
  days?: MesoDay[]
}

export interface LastWeekSet { weight: number; reps: number; rir: number }
export interface WorkoutExercise {
  id: string
  name: string
  sets: number
  targetReps: string
  targetRIR: number
  type: ExerciseKind
  muscle: string
  lastWeek: LastWeekSet
}
export interface ChallengeRef { kind: string; label: string }
export type ChallengeType = 'PR' | 'Depth' | 'Volume' | 'Tempo'
export interface Challenge {
  id: string
  type: ChallengeType
  typeLabel: string
  exerciseId: string
  exercise?: string
  target: string
  confidence: number
  risk: 'low' | 'mid'
  why: string
  refs: ChallengeRef[]
  tools: Tool[]
  glory: string
}
export interface NiggleWarning { muscle: string; muscleLabel: string; detail: string }
export interface WorkoutPlan {
  title: string
  tag: string
  durationEst: number
  exercises: WorkoutExercise[]
  niggleWarning?: NiggleWarning
  challenges: Challenge[]
}

export interface GymScheduleDay {
  day: string
  type: string | null
  time: string | null
  duration: number | null
  active: boolean
  today?: boolean
}
export interface GymSchedule { weeklyTimes: GymScheduleDay[] }

export interface VolleyballSession {
  day: string; time: string; duration: number
  court: string; intensity: string; role: string; flex?: boolean
}
export interface SportSchedule {
  volleyball: { team: string; sessions: VolleyballSession[]; season: string; weeklyHours: number }
}
export interface SportSession {
  id: string; sport: string; date: string; time: string; duration: number
  setsPlayed: number; intensity: number; rpe: number; shoulderStrain: number
  jumpCount: number; notes: string | null
}
export interface SportWeek {
  label: string; sessions: number; hoursPlayed: number
  avgRPE: number; avgShoulderStrain: number; shoulderLoadTrend: string
}
export interface CrossLoadRow {
  target: string; impact: string; why: string; system: string; warning?: boolean
}
export interface Sport {
  schedule: SportSchedule
  sessions: SportSession[]
  week: SportWeek
  crossLoad: CrossLoadRow[]
}

export interface ExerciseLibraryItem {
  id: string; name: string; muscle: string; type: ExerciseKind; stim: number; fatigue: number
}

export interface GoalPreset {
  id: string; label: string; sub: string; description: string
  defaultWeeks: number; split: string; days: number; style: string
  phaseTemplate: MesoPhase[]; color: string
}
export interface SplitOption { label: string; days: number[]; best: string | null }
```

- [ ] **Step 4: Implement `src/data/train.ts`** — port the data verbatim from `data.js`. The file structure (fill the large arrays from the prototype at the noted line ranges):

```ts
import type {
  Mesocycle, WorkoutPlan, GymSchedule, Sport, ExerciseLibraryItem,
  GoalPreset, SplitOption, MesoPhase,
} from './types'

// --- label / colour maps (mesocycles.jsx module constants) ---
export const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Mell', back: 'Hát', 'back-mid': 'Hát (közép)', lats: 'Lat', shoulder: 'Váll',
  'rear-delt': 'Hátsó váll', biceps: 'Bicep', triceps: 'Tricep',
  quad: 'Comb', ham: 'Lábhajlító', glute: 'Far',
}
export const DAY_LABELS: Record<string, string> = {
  Hét: 'Hétfő', Kedd: 'Kedd', Sze: 'Szerda', Csü: 'Csütörtök', Pén: 'Péntek', Szo: 'Szombat', Vas: 'Vasárnap',
}
export const DAY_ORDER = ['Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas'] as const

// Cross-load system labels (sport.jsx SYSTEM_LABELS): label + token colour + icon name
export const SYSTEM_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  Train: { label: 'Edzés', color: 'var(--brand-glow)', icon: 'train' },
  Fuel: { label: 'Étkezés', color: 'var(--info, var(--brand-primary))', icon: 'fuel' },
  Sleep: { label: 'Alvás', color: 'var(--cat-preference)', icon: 'today' },
  Weight: { label: 'Súly', color: 'var(--text-secondary)', icon: 'me' },
  Insights: { label: 'Patterns', color: 'var(--cat-physiology)', icon: 'insights' },
}

export const MESOCYCLE_PHASE_COLORS: Record<MesoPhase, string> = {
  MEV: 'var(--brand-deep, var(--brand-primary))',
  MAV: 'var(--brand-primary)',
  MRV: 'var(--brand-glow)',
  Deload: 'var(--text-tertiary)',
}
// Bar heights per phase, used by the phase-curve mini bars (small variant).
export function phaseBarHeight(p: MesoPhase): number {
  return { MEV: 12, MAV: 24, MRV: 36, Deload: 8 }[p]
}

// --- mesocycles (data.js:19-249) — port the 4 objects verbatim, incl.
//     volumeRecompute (33-42), volumePerMuscle (43-130, 8 muscles), days (~132-200). ---
export const mesocycles: Mesocycle[] = [ /* meso-hyp-04 (active), meso-str-02 (planned),
  meso-maint-01 (planned), meso-rec-03 (archived) — verbatim from data.js */ ]

export const activeMeso: Mesocycle = mesocycles.find((m) => m.status === 'active')!

// --- active workout (data.js:626-…; challenges 642-…) ---
export const workout: WorkoutPlan = { /* title 'Pull Day', tag 'Week 3 · MAV', durationEst 78,
  5 exercises with lastWeek, niggleWarning (right-shoulder/'Jobb váll'/detail),
  challenges [ch1 PR, ch2 Depth, ch3 Volume] — verbatim from data.js */ }

// --- weekly gym schedule (data.js:324-351) ---
export const gymSchedule: GymSchedule = { weeklyTimes: [
  { day: 'Hét',  type: 'Push Day',     time: '07:30', duration: 75, active: true },
  { day: 'Kedd', type: 'Legs',         time: '07:30', duration: 75, active: true },
  { day: 'Sze',  type: 'Pull Day',     time: '07:30', duration: 75, active: true },
  { day: 'Csü',  type: 'Pull Day',     time: '07:30', duration: 78, active: true, today: true },
  { day: 'Pén',  type: 'Push · light', time: '07:30', duration: 60, active: true },
  { day: 'Szo',  type: null, time: null, duration: null, active: false },
  { day: 'Vas',  type: null, time: null, duration: null, active: false },
] }

// --- sport (data.js:250-322) — ADD jumpCount to each session (port fix) ---
export const sport: Sport = {
  schedule: { volleyball: { team: 'BVSC · Felnőtt II.', season: 'Tavasz · 2026 · Április - Június',
    weeklyHours: 7.5, sessions: [ /* 5 VolleyballSession verbatim from data.js:251-266 */ ] } },
  sessions: [
    { id: 'vb-2026-05-20', sport: 'volleyball', date: 'Máj 20 · Kedd', time: '18:00', duration: 90, setsPlayed: 5, intensity: 7, rpe: 6.8, shoulderStrain: 6, jumpCount: 38, notes: 'Smashek tisztábbak, jobb váll után érzem délután' },
    { id: 'vb-2026-05-18', sport: 'volleyball', date: 'Máj 18 · Szo', time: '10:00', duration: 120, setsPlayed: 6, intensity: 8, rpe: 7.2, shoulderStrain: 7, jumpCount: 52, notes: 'Hosszú meccs · maradt erő utána' },
    { id: 'vb-2026-05-15', sport: 'volleyball', date: 'Máj 15 · Csü', time: '19:30', duration: 90, setsPlayed: 4, intensity: 7, rpe: 6.5, shoulderStrain: 5, jumpCount: 31, notes: null },
    { id: 'vb-2026-05-13', sport: 'volleyball', date: 'Máj 13 · Kedd', time: '18:00', duration: 90, setsPlayed: 5, intensity: 7, rpe: 6.9, shoulderStrain: 6, jumpCount: 35, notes: null },
    { id: 'vb-2026-05-11', sport: 'volleyball', date: 'Máj 11 · Szo', time: '10:00', duration: 120, setsPlayed: 6, intensity: 8, rpe: 7.5, shoulderStrain: 8, jumpCount: 48, notes: 'Sok smash · vasárnap pihentem' },
  ],
  week: { label: 'Hét 21 · Máj 18-24', sessions: 4, hoursPlayed: 6.5, avgRPE: 7.1, avgShoulderStrain: 6.5, shoulderLoadTrend: 'stabil' },
  crossLoad: [ /* 6 CrossLoadRow verbatim from data.js:283-321 (systems Train×2/Fuel/Sleep/Weight/Insights) */ ],
}

// --- exercise library (data.js:538-560) — port all ~21 items verbatim ---
export const exerciseLibrary: ExerciseLibraryItem[] = [ /* verbatim */ ]

// --- planner presets (meso-planner.jsx GOAL_PRESETS + SPLITS) ---
export const GOAL_PRESETS: GoalPreset[] = [
  { id: 'hypertrophy', label: 'Hypertrophy', sub: 'Izomtömeg építés', defaultWeeks: 6, split: 'Pull / Push / Legs', days: 5, style: 'RP', phaseTemplate: ['MEV','MEV','MAV','MAV','MRV','Deload'], color: 'var(--brand-glow)', description: 'Volumen-driven · MAV/MRV progresszió · klasszikus RP hypertrophy blokk' },
  { id: 'strength', label: 'Strength', sub: '1RM növelés', defaultWeeks: 7, split: 'Upper / Lower', days: 4, style: 'Linear', phaseTemplate: ['MEV','MEV','MAV','MAV','MRV','MRV','Deload'], color: 'var(--info, var(--brand-primary))', description: 'Intenzitás-driven · 3-6 reps · alacsonyabb volumen · hosszabb pihenő' },
  { id: 'cut-prep', label: 'Pre-cut prep', sub: 'Karbantartás · zsírvesztés előtt', defaultWeeks: 3, split: 'Full body', days: 4, style: 'Maintenance', phaseTemplate: ['MAV','MAV','MAV'], color: 'var(--warning)', description: 'Volumen-tartás · izom-megőrzés · deficit nélkül' },
  { id: 'recovery', label: 'Recovery', sub: 'Niggle után · újraépítés', defaultWeeks: 4, split: 'Custom', days: 3, style: 'Rehab', phaseTemplate: ['MEV','MEV','MAV','MAV'], color: 'var(--anchor-accent, var(--cat-preference))', description: 'Isoláció-fokú · alacsony fatigue · niggle-aware substitúció' },
  { id: 'sport', label: 'Sport-specific', sub: 'Volleyball-driven blokk', defaultWeeks: 5, split: 'Upper / Lower / Sport', days: 5, style: 'Conjugate', phaseTemplate: ['MEV','MAV','MAV','MRV','Deload'], color: 'var(--cat-tendency)', description: 'Vertikális teljesítmény · vállstabilitás · plyo-integráció' },
]
export const SPLITS: SplitOption[] = [
  { label: 'Pull / Push / Legs', days: [4, 5, 6], best: 'hypertrophy' },
  { label: 'Upper / Lower', days: [3, 4], best: 'strength' },
  { label: 'Full body', days: [3, 4, 5], best: 'cut-prep' },
  { label: 'Upper / Lower / Sport', days: [4, 5], best: 'sport' },
  { label: 'Custom split', days: [3, 4, 5, 6], best: null },
]
```

> Implementer note: open `data.js` at the line ranges above and copy the real values into the `/* … */` placeholders. The test in Step 1 asserts the shapes/counts/key strings; matching them confirms a faithful port. Keep every Hungarian string verbatim.

- [ ] **Step 5: Add the hook** to `src/data/hooks.ts` (import near other `./` data imports; hook near the others):

```ts
import { mesocycles, activeMeso, workout, gymSchedule, sport, exerciseLibrary } from './train'

export function useTrain() {
  return { mesocycles, activeMeso, workout, gymSchedule, sport, exerciseLibrary }
}
```

- [ ] **Step 6: Run → PASS** — `pnpm test src/data/trainData.test.tsx`.
- [ ] **Step 7: Commit** — `git add src/data/types.ts src/data/train.ts src/data/hooks.ts src/data/trainData.test.tsx && git commit -m "feat(train): data layer — mesocycles/workout/gym/sport + useTrain"`

---

## Task 2: Sub-nav + nested routes + shell + placeholder views

**Files:** Create `src/features/train/tabs.ts`, `TrainSubNav.tsx`, `TrainSubNav.test.tsx`; rewrite `TrainScreen.tsx` (shell); create placeholder views `src/features/train/views/{TrainTodayView,GymView,SportView,MesocycleLibraryView}.tsx` and full-screen placeholders `src/features/train/{ActiveWorkoutScreen.tsx,MesocyclePlanner.tsx,MesocycleBuilder.tsx}`; modify `src/app/router.tsx`. Contract: `app.jsx` `TrainSubNav` + `TrainOverview`.

Sub-tabs (id → route → verbatim label, in order): `mai`→`/train` (index, `end`)→**Mai**, `gym`→`/train/gym`→**GYM**, `sport`→`/train/sport`→**Sport**, `mesocycles`→`/train/mesocycles`→**Mesociklusok**.

- [ ] **Step 1: Failing test** — `src/features/train/TrainSubNav.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TrainSubNav } from './TrainSubNav'

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><TrainSubNav /></MemoryRouter>)
}

test('renders all four sub-nav items with verbatim labels', () => {
  renderAt('/train')
  for (const label of ['Mai', 'GYM', 'Sport', 'Mesociklusok']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  }
})

test('marks the active sub-view from the URL', () => {
  const { container } = renderAt('/train/sport')
  expect(container.querySelector('.subnav-item.active')).toHaveTextContent('Sport')
})

test('Mai (index) is active only on exact /train', () => {
  const { container } = renderAt('/train/gym')
  expect(container.querySelector('.subnav-item.active')).toHaveTextContent('GYM')
})
```

- [ ] **Step 2: Run → FAIL** — `pnpm test src/features/train/TrainSubNav.test.tsx`.

- [ ] **Step 3: `src/features/train/tabs.ts`:**

```ts
export interface TrainTab { id: string; to: string; label: string; end?: boolean }

export const TRAIN_TABS: TrainTab[] = [
  { id: 'mai', to: '/train', label: 'Mai', end: true },
  { id: 'gym', to: '/train/gym', label: 'GYM' },
  { id: 'sport', to: '/train/sport', label: 'Sport' },
  { id: 'mesocycles', to: '/train/mesocycles', label: 'Mesociklusok' },
]
```

- [ ] **Step 4: `src/features/train/TrainSubNav.tsx`** (sticky; use the existing `.subnav`/`.subnav-item` classes, mirroring `InsightsSubNav`):

```tsx
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { TRAIN_TABS } from './tabs'

export function TrainSubNav() {
  return (
    <nav
      className="subnav"
      aria-label="Train alnavigáció"
      style={{ position: 'sticky', top: 0, background: 'var(--canvas)', zIndex: 5, paddingTop: 8 }}
    >
      {TRAIN_TABS.map(({ to, label, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('subnav-item', isActive && 'active')}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 5: Rewrite `src/features/train/TrainScreen.tsx`** as the shell (dynamic eyebrow/title per active sub-tab; the prototype gives each sub-view its own header eyebrow `Train · Mai|GYM|Sport|Mesocycles` and title `Edzés|{meso.shortTitle}|Röplabda|Mesociklusok`). To keep the shell generic and match Insights, drive the header from the active tab; the per-view body renders its own content below.

```tsx
import { Outlet, useLocation } from 'react-router-dom'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { TrainSubNav } from './TrainSubNav'
import { TRAIN_TABS } from './tabs'

const HEADER: Record<string, { eyebrow: string; title: string }> = {
  mai: { eyebrow: 'Train · Mai', title: 'Edzés' },
  gym: { eyebrow: 'Train · GYM', title: 'GYM' },
  sport: { eyebrow: 'Train · Sport', title: 'Röplabda' },
  mesocycles: { eyebrow: 'Train · Mesocycles', title: 'Mesociklusok' },
}

export function TrainScreen() {
  const { pathname } = useLocation()
  const seg = pathname.split('/')[2] ?? 'mai'
  const active = TRAIN_TABS.find((t) => t.id === seg) ?? TRAIN_TABS[0]
  const h = HEADER[active.id] ?? HEADER.mai

  return (
    <>
      <div className="page-header">
        <div>
          <Eyebrow brand>{h.eyebrow}</Eyebrow>
          <PageTitle className="mt-sm">{h.title}</PageTitle>
        </div>
      </div>
      <TrainSubNav />
      <div style={{ padding: '8px 24px 24px' }}>
        <Outlet />
      </div>
    </>
  )
}
```

> Note: GYM's prototype title is the active meso `shortTitle` (`Hypertrophy 04`), not the literal "GYM". To match parity exactly, the GYM **view** (Task 5) renders its own header with `activeMeso.shortTitle` and the shell header can be visually superseded — OR keep the shell title generic for all tabs. Decision: **the shell renders the generic header above; each view that needs a richer header (GYM meso title, Mai day-label, Sport `+ Log` chip) renders its own header row as its first element and the shell header stays.** This matches Fuel (each view owns its header). If parity review prefers no double header, collapse the shell header to only the sub-nav (drop the `page-header` block) — left as a parity-review polish call. **For initial build, keep the shell header simple as above and let views add their own section headers below it.**

- [ ] **Step 6: Placeholder views + full-screen placeholders.** Create each as a stub returning a single eyebrow, e.g. `src/features/train/views/TrainTodayView.tsx`:

```tsx
export function TrainTodayView() {
  return <div className="eyebrow">Mai</div>
}
```

Same stub shape for `GymView` (`GYM`), `SportView` (`Sport`), `MesocycleLibraryView` (`Mesociklusok`). Full-screen placeholders `src/features/train/ActiveWorkoutScreen.tsx`, `MesocyclePlanner.tsx`, `MesocycleBuilder.tsx` each return a single eyebrow (`Active workout`, `Planner`, `Builder`).

- [ ] **Step 7: Wire routes** in `src/app/router.tsx` — add imports and replace the stub `{ path: 'train', element: <TrainScreen /> }` with the four route objects from the header's **Routing model** block. Imports:

```tsx
import { TrainScreen } from '@/features/train/TrainScreen'
import { TrainTodayView } from '@/features/train/views/TrainTodayView'
import { GymView } from '@/features/train/views/GymView'
import { SportView } from '@/features/train/views/SportView'
import { MesocycleLibraryView } from '@/features/train/views/MesocycleLibraryView'
import { ActiveWorkoutScreen } from '@/features/train/ActiveWorkoutScreen'
import { MesocyclePlanner } from '@/features/train/MesocyclePlanner'
import { MesocycleBuilder } from '@/features/train/MesocycleBuilder'
```
(Remove the now-unused old `TrainScreen` stub import line if it differs.)

- [ ] **Step 8: Run → PASS** — `pnpm test src/features/train/TrainSubNav.test.tsx` then `pnpm test` (whole suite green; existing `app-train` parity + navigation smoke tests still pass — the `/train` route now renders Mai placeholder).
- [ ] **Step 9: Commit** — `git add src/features/train src/app/router.tsx && git commit -m "feat(train): sub-nav + nested routes + full-screen route shells"`

---

## Task 3: SportLogSheet + NumberStep + ScaleRow (shared)

**Files:** Create `src/features/train/components/SportLogSheet.tsx` + `SportLogSheet.test.tsx`. Contract: `sport.jsx` `SportLogSheet`, `NumberStep`, `ScaleRow`. Used by Mai (Task 4) and Sport (Task 6).

`SportLogSheet` wraps the shared `Sheet` primitive (`@/components/ui/Sheet`). Props: `{ onClose: () => void }`. Fields (all local state): `NumberStep` "Idő · perc" (default 90, step 15), `NumberStep` "Setek · összesen" (default 5, step 1), `ScaleRow` "RPE · összesített nehézség" (1-10 grid, default 7), `ScaleRow` "Váll terhelés" (default 6, turns warning at value ≥ 7). A **Mezo observation** card whose copy is conditional on rpe/shoulder (see header verbatim list in the spec; transcribe the 4 branch strings verbatim from `sport.jsx`). Footer: `Mégse` (ghost → `onClose`) + `[check] Mentés` (primary → `onClose`; no persistence).

- [ ] **Step 1: Failing test** — `SportLogSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SportLogSheet } from './SportLogSheet'

function setup() {
  const onClose = vi.fn()
  render(<SportLogSheet onClose={onClose} />)
  return { onClose }
}

test('renders the sport-log fields and Mezo observation', () => {
  setup()
  expect(screen.getByText('Sport log · Volleyball')).toBeInTheDocument()
  expect(screen.getByText('Hogy ment?')).toBeInTheDocument()
  expect(screen.getByText('Idő · perc')).toBeInTheDocument()
  expect(screen.getByText('RPE · összesített nehézség')).toBeInTheDocument()
  expect(screen.getByText('Váll terhelés')).toBeInTheDocument()
})

test('Mentés closes the sheet', async () => {
  const { onClose } = setup()
  await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
  expect(onClose).toHaveBeenCalled()
})

test('high shoulder strain swaps the observation copy', async () => {
  setup()
  // default shoulder 6 → baseline copy; raise to ≥7 via the scale grid
  await userEvent.click(screen.getByRole('button', { name: 'Váll terhelés 8' }))
  expect(screen.getByText(/Váll terhelés magas/)).toBeInTheDocument()
})
```

> The `ScaleRow` cells must have accessible names like `"{label} {n}"` (set `aria-label={`${label} ${n}`}` on each cell button) so the test can target them and for a11y. Apply the same to the active-workout RIR cells later.

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** `NumberStep`, `ScaleRow`, `SportLogSheet` in the file (port `sport.jsx` faithfully; reuse `Sheet`, `Icon`, `CtaPrimary`/`CtaGhost`, `Eyebrow`). `NumberStep`: label + mono value + 44px ± buttons (reuse `.stepper`/`.stepper-display` classes). `ScaleRow`: label + a 1-10 row of cells (active = brand glow; warning tint at ≥ warnAt when provided). Transcribe the 4 conditional observation strings verbatim.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(train): SportLogSheet + NumberStep + ScaleRow (shared sport logging)"`

---

## Task 4: Mai view (`TrainTodayView`) + `WeeklyDayRow`

**Files:** Rewrite `src/features/train/views/TrainTodayView.tsx`; create `TrainTodayView.test.tsx`; create `src/features/train/components/WeeklyDayRow.tsx`. Contract: `train-views.jsx` `TrainTodayView` + `WeeklyDayRow`. Reads `useTrain()` (`workout`, `gymSchedule`, `sport`, `activeMeso`).

Top→bottom (port faithfully; verbatim copy):
1. Day-label header right: `{DAY_LABELS[todayDay]} · W{activeMeso.currentWeek}` (today = `Csü` ⇒ `Csütörtök · W3`).
2. **Today's gym block** (`Csü` has `today:true` + gym) — `card notch-12`: eyebrow brand `Week 3 · MAV`, display `Pull Day`, mono `07:30 · 78p`, `MA` brand chip, chips `5 gyakorlat`/`16 szet`/`~78p`, **CtaPrimary** `Indítsuk · Pull Day` → `navigate('/train/session')`.
3. **Today's volleyball block** — only if a volleyball session is today; on `Csü` there is none ⇒ does not render (keep the conditional + the block markup for fidelity, tendency-accent `card notch-12`, `CtaGhost` `Logold a session-t` → opens `SportLogSheet`).
4. **Weekly combined timeline** — eyebrow `Heti terv · gym + sport` + right `{N} session`; one `WeeklyDayRow` per `DAY_ORDER` day, merging `gymSchedule.weeklyTimes` + volleyball `schedule.volleyball.sessions`. Empty day → dashed + italic `rest day`. Today row tinted; chevrons tappable (gym → `/train/session`, volleyball log → `SportLogSheet`).
5. **Note card** — `card notch-4` faint brand, sparkle icon + verbatim copy: "A gym a mesociklus szerint, a volleyball recurring · független. A két ütemterv együtt-mozgatja a pacing-et, alvás-onsetet és a vacsora-időt."

`SportLogSheet` mounts at the view root, toggled by local `vbLogOpen` state.

- [ ] **Step 1: Failing test** — `TrainTodayView.test.tsx` (wrap in `MemoryRouter`; assert verbatim copy + the Indítsuk CTA + timeline days):

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TrainTodayView } from './TrainTodayView'

const renderView = () => render(<MemoryRouter><TrainTodayView /></MemoryRouter>)

test('today gym block + weekly timeline render', () => {
  renderView()
  expect(screen.getByText('Pull Day')).toBeInTheDocument()
  expect(screen.getByText('07:30 · 78p')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Indítsuk/ })).toBeInTheDocument()
  expect(screen.getByText('Heti terv · gym + sport')).toBeInTheDocument()
  // weekly note (verbatim, substring)
  expect(screen.getByText(/A gym a mesociklus szerint/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** `WeeklyDayRow` then `TrainTodayView` (faithful port; `useNavigate` for entry; `SportLogSheet` for volleyball log). Reuse `NotchCard`/`Chip`/`Eyebrow`/`CtaPrimary`/`CtaGhost`/`Icon`/`Display`.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(train): Mai view — weekly gym+sport agenda + start-workout CTA"`

---

## Task 5: GYM view (`GymView`) + `GymDayCard`/`GymDaySheet`/`GymExRow`/`PhaseDots`/`GymStat`

**Files:** Rewrite `src/features/train/views/GymView.tsx`; create `GymView.test.tsx`; create components `GymDayCard.tsx`, `GymDaySheet.tsx`, `GymExRow.tsx`, `PhaseDots.tsx`, `GymStat.tsx` under `src/features/train/components/` (one file each or grouped — prefer one file each for `GymDaySheet` and `GymDayCard`; `PhaseDots`/`GymStat`/`GymExRow` may live with their consumer). Contract: `train-views.jsx` `GymView` + helpers. Reads `useTrain()` (`activeMeso`).

Top→bottom: header (eyebrow `Train · GYM`, title `{activeMeso.shortTitle}` = `Hypertrophy 04`, right `W3 / 6`); meso meta `card notch-12` with 4 `GymStat` cells (`Fázis`=`MAV`/sub `hét 3`, `Split`/`5×/hét`, `Szetek`=total weekly sets, `Gym napok`) + footer row `Máj 1 → Jún 12 · RP · 6 hét` + `PhaseDots`; day-by-day list of `GymDayCard` (one per `activeMeso.days`), tapping a training day opens `GymDaySheet` (exercise list of `GymExRow`; today → CtaPrimary `Indítsuk · most` → `navigate('/train/session')`; else info card `Nézet-mód · csak a mai napot lehet indítani`).

- [ ] **Step 1: Failing test** — `GymView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { GymView } from './GymView'

const renderView = () => render(<MemoryRouter><GymView /></MemoryRouter>)

test('renders meso meta + phase + week counter', () => {
  renderView()
  expect(screen.getByText('Hypertrophy 04')).toBeInTheDocument()
  expect(screen.getByText('W3 / 6')).toBeInTheDocument()
  expect(screen.getByText('Fázis')).toBeInTheDocument()
})

test('tapping a training day opens the day sheet with its exercises', async () => {
  renderView()
  await userEvent.click(screen.getByText('Csü'))      // current Pull day card
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
})
```

> If multiple elements read `Csü`, target the day **card** specifically (e.g. give `GymDayCard` an accessible role/name, or query within the day list container). Adjust the selector to be unambiguous.

- [ ] **Step 2: Run → FAIL.**  - [ ] **Step 3: Implement** (faithful port; reuse primitives + `Sheet` for `GymDaySheet`).  - [ ] **Step 4: Run → PASS.**  - [ ] **Step 5: Commit** — `git commit -m "feat(train): GYM view — meso meta + day split + day-detail sheet"`

---

## Task 6: Sport view (`SportView`) + `SportStat`/`MiniBar`/`CrossLoadRow`/`SportSessionCard`

**Files:** Rewrite `src/features/train/views/SportView.tsx`; create `SportView.test.tsx`; components `SportStat.tsx`, `MiniBar.tsx`, `CrossLoadRow.tsx`, `SportSessionCard.tsx`. Contract: `sport.jsx` `SportView` + the 3 sub-views (`SportWeekView`/`SportLogView`/`SportCrossloadView`). Reads `useTrain()` (`sport`). Reuses `SportLogSheet` (Task 3) + `SYSTEM_LABELS` (Task 1).

Hero (tendency-accent `card notch-12`): eyebrow `BVSC · Felnőtt II.`, display `BVSC csarnok`, `Tavasz · 2026 · Április - Június`, 4 `SportStat` (`Sessions`/`Idő`/`RPE`/`Váll`) + RPE explainer box (verbatim, uses `SafeMarkdown` for the `**bold**` segments). A 3-button view switcher `Heti terv`/`Napló`/`Cross-load` (local `view` state, default `week`). Header right `+ Log` chip → `SportLogSheet`.
- **Heti terv**: 7-day rhythm rows + footer independence card (verbatim).
- **Napló**: header `Utolsó {N} session` + `avg {N} ugrás` (now an integer thanks to `jumpCount`); list of `SportSessionCard` (RPE big, two `MiniBar`s, optional quoted notes).
- **Cross-load**: intro card (verbatim `**bold**` via `SafeMarkdown`) + list of `CrossLoadRow` (per `sport.crossLoad`, colour/icon via `SYSTEM_LABELS`, warning rows amber) + tool chips `get_sport_load(28d)`/`computeMuscleLoadCarryover()`/`applySportTransferRule()`/`updateCrossSystemTargets()`.

- [ ] **Step 1: Failing test** — `SportView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SportView } from './SportView'

test('hero + RPE explainer render', () => {
  render(<SportView />)
  expect(screen.getByText('BVSC csarnok')).toBeInTheDocument()
  expect(screen.getByText(/RPE = Rate of Perceived Exertion/)).toBeInTheDocument()
})

test('switching to Napló shows the session log with avg jumps', async () => {
  render(<SportView />)
  await userEvent.click(screen.getByRole('button', { name: 'Napló' }))
  expect(screen.getByText(/avg \d+ ugrás/)).toBeInTheDocument()
})

test('switching to Cross-load shows the cross-system rows + tool chips', async () => {
  render(<SportView />)
  await userEvent.click(screen.getByRole('button', { name: 'Cross-load' }))
  expect(screen.getByText('get_sport_load(28d)')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run → FAIL.**  - [ ] **Step 3: Implement** (faithful port; tendency pinks → `var(--cat-tendency)`; `**bold**` → `SafeMarkdown`).  - [ ] **Step 4: Run → PASS.**  - [ ] **Step 5: Commit** — `git commit -m "feat(train): Sport view — hero + week/log/crossload"`

---

## Task 7: Mesociklusok library (`MesocycleLibraryView`) + Active/Planned/Archived cards

**Files:** Rewrite `src/features/train/views/MesocycleLibraryView.tsx`; create `MesocycleLibraryView.test.tsx`; components `ActiveMesoCard.tsx`, `PlannedMesoCard.tsx`, `ArchivedMesoCard.tsx`, `MetaStat.tsx`, `PhaseCurveBars.tsx` (shared mini phase-curve bars — small variant, reused by builder Overview as the large variant via a `size` prop). Contract: `mesocycles.jsx` `MesocycleLibrary` + cards. Reads `useTrain()` (`mesocycles`). Uses `useNavigate()`.

Header `+ Új` chip → `navigate('/train/mesocycles/new')`. Three sections: **Aktív · 1** (`ActiveMesoCard` → `navigate('/train/mesocycles/'+id)`, with phase-curve mini bars), **Tervezett · 2** (`PlannedMesoCard`s + dashed `+ Új mesociklus tervezése` → planner), **Archív · 1** (`ArchivedMesoCard`).

- [ ] **Step 1: Failing test** — `MesocycleLibraryView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { MesocycleLibraryView } from './MesocycleLibraryView'

const renderView = () => render(<MemoryRouter><MesocycleLibraryView /></MemoryRouter>)

test('renders active/planned/archived sections', () => {
  renderView()
  expect(screen.getByText('Hypertrophy 04 · Tavasz')).toBeInTheDocument()
  expect(screen.getByText('Strength 02 · Nyár')).toBeInTheDocument()
  expect(screen.getByText(/Aktív · 1/)).toBeInTheDocument()
})

test('opens the planner from + Új', async () => {
  render(<MemoryRouter initialEntries={['/train/mesocycles']}>
    <MesocycleLibraryView /></MemoryRouter>)
  // assert the link/button target via role; navigation asserted in nav smoke test (Task 13)
  expect(screen.getByRole('button', { name: /Új/ })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run → FAIL.**  - [ ] **Step 3: Implement** (`PhaseCurveBars` with `size: 'sm' | 'lg'`; faithful port).  - [ ] **Step 4: Run → PASS.**  - [ ] **Step 5: Commit** — `git commit -m "feat(train): Mesocycle library — active/planned/archived + phase-curve"`

---

## Task 8: Mesocycle builder shell + Áttekintés + `DayDetailSheet`

**Files:** Rewrite `src/features/train/MesocycleBuilder.tsx` (full-screen route `/train/mesocycles/:id`); create `MesocycleBuilder.test.tsx`; components `MesoOverview.tsx`, `DayDetailSheet.tsx`. Contract: `mesocycles.jsx` `MesocycleBuilder` + `MesoOverview` + `DayDetailSheet`. Resolves the meso via `useParams()` id against `useTrain().mesocycles`; if not found, render a minimal "not found" + back. Uses `useNavigate()` for the back chevron (`navigate('/train/mesocycles')`).

Builder header: back chevron → `Mesociklusok`; eyebrow (status-dependent: `Aktív · Week N/M` | `Tervezett` | `Archív`); page-title `{title}`; secondary `{goal}`. A 3-button view switcher `Áttekintés`/`Volumen`/`Gyakorlatok` (local `view` state, default `overview`). **This task builds the shell + Áttekintés only**; `Volumen` and `Gyakorlatok` render placeholders here and are filled in Tasks 9 & 10. Bottom actions per status (active → `Heti terv másolása` + `Meso lezárása`; planned → `Aktiválás · {startDate}`) — render the buttons (no persistence).

**Áttekintés** (`MesoOverview`): phase-curve hero (`PhaseCurveBars size="lg"` from Task 7, with legend dots MEV/MAV/MRV/Deload) + `Heti terv` tappable day rows (`{day}`/`{type}`/`{muscle} · {exerciseCount} gyakorlat`/`MA` if current) → `DayDetailSheet`. `DayDetailSheet`: eyebrow brand `{day} · {meso.title}`, title `{day.type}`, secondary `{muscle}`; body training-day `{N} gyakorlat tervezve. Open the day to edit.` / rest-day `Rest day · vagy sport. Nincs gym session.`; buttons `Bezár` + `Szerkesztés →` (training only).

- [ ] **Step 1: Failing test** — `MesocycleBuilder.test.tsx` (render at `/train/mesocycles/meso-hyp-04` via `createMemoryRouter` with the real routes, OR render `<MesocycleBuilder/>` inside `<MemoryRouter initialEntries={['/train/mesocycles/meso-hyp-04']}><Routes><Route path="/train/mesocycles/:id" element={<MesocycleBuilder/>}/></Routes></MemoryRouter>`):

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { MesocycleBuilder } from './MesocycleBuilder'

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/train/mesocycles/${id}`]}>
      <Routes><Route path="/train/mesocycles/:id" element={<MesocycleBuilder />} /></Routes>
    </MemoryRouter>,
  )
}

test('renders the meso header + view switcher + overview day rows', () => {
  renderAt('meso-hyp-04')
  expect(screen.getByRole('heading', { level: 1, name: 'Hypertrophy 04 · Tavasz' })).toBeInTheDocument()
  for (const v of ['Áttekintés', 'Volumen', 'Gyakorlatok']) {
    expect(screen.getByRole('button', { name: v })).toBeInTheDocument()
  }
})

test('day row opens the day detail sheet', async () => {
  renderAt('meso-hyp-04')
  await userEvent.click(screen.getByText('Csü'))
  expect(screen.getByText('Rest day · vagy sport. Nincs gym session.').length === undefined || true).toBeTruthy()
  // assert the sheet title (day.type) appears — adjust to the actual current day type
  expect(screen.getByText(/gyakorlat tervezve|Rest day/)).toBeInTheDocument()
})
```

> Fix the second test's day selector to an unambiguous training day once the real `days` data is in place.

- [ ] **Step 2: Run → FAIL.**  - [ ] **Step 3: Implement** shell + `MesoOverview` + `DayDetailSheet` (Volumen/Gyakorlatok placeholders).  - [ ] **Step 4: Run → PASS.**  - [ ] **Step 5: Commit** — `git commit -m "feat(train): mesocycle builder shell + Áttekintés + day-detail sheet"`

---

## Task 9: Builder Volumen view (`MesoVolume`) + `VolumeBar` provenance widget + recompute audit

**Files:** Create `src/features/train/components/MesoVolume.tsx`, `VolumeBar.tsx`, `FinalStat.tsx`; create `VolumeBar.test.tsx`; wire `Volumen` switcher case in `MesocycleBuilder`. Contract: `mesocycles.jsx` `MesoVolume` + `VolumeBar` + `FinalStat`. Reads the meso `volumeRecompute` + `volumePerMuscle`.

`MesoVolume`: collapsible **recompute status banner** (pulsing dot + `Élő rendszer · 4 nappal ezelőtt frissítve` + `Következő recompute: {nextRun…}`; expanded → audit card with `Utolsó futás · {lastRun}`, change list, tool chips `generateAiHypotheses()`/`get_workout_pattern(28d)`/`get_niggle_events()`/`updateVolumeProfile()`); provenance intro card (verbatim, `**bold**`→`SafeMarkdown`); one **`VolumeBar`** per muscle in `volumePerMuscle`; AI suggestion card (verbatim).

**`VolumeBar`** — the signature provenance widget. Collapsed: muscle label + stacked MEV/MAV/MRV background bar with a glowing `current` marker + `{current} szet`. Expanded (tap): 3-stage provenance — `01 · Baseline` (`{source.baseline.name}` + mev/mav/mrv), `02 · Daniel-személyre szabás` (each `adjustment.label` + delta, warning-tinted if `warning`), `03 · Eredő · most` (`FinalStat`s mev/mav/mrv/current) — + italic `{source.note}` (if present) + a **Confidence** mini-bar `{(confidence*100)|0}%` + a `[tool] Felülír` override chip (inert).

- [ ] **Step 1: Failing test** — `VolumeBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VolumeBar } from './VolumeBar'
import { activeMeso } from '@/data/train'

const chest = activeMeso.volumePerMuscle!.chest

test('shows the muscle, current sets, and expands the provenance', async () => {
  render(<VolumeBar muscle="chest" profile={chest} />)
  expect(screen.getByText('Mell')).toBeInTheDocument()             // via MUSCLE_LABELS
  await userEvent.click(screen.getByText(/Mell/))
  expect(screen.getByText('01 · Baseline')).toBeInTheDocument()
  expect(screen.getByText(chest.source.baseline.name)).toBeInTheDocument()
  expect(screen.getByText('03 · Eredő · most')).toBeInTheDocument()
  expect(screen.getByText(/78%/)).toBeInTheDocument()              // confidence
})
```

> Adjust the expand trigger selector to match the implementation (e.g. a header button with an accessible name including the muscle label).

- [ ] **Step 2: Run → FAIL.**  - [ ] **Step 3: Implement** `FinalStat`, `VolumeBar`, `MesoVolume`; wire the `Volumen` case in the builder.  - [ ] **Step 4: Run → PASS.**  - [ ] **Step 5: Commit** — `git commit -m "feat(train): builder Volumen — VolumeBar provenance + recompute audit"`

---

## Task 10: Builder Gyakorlatok view (`MesoExercises`) + `ExercisePickerSheet`

**Files:** Create `src/features/train/components/MesoExercises.tsx`, `DayExerciseSection.tsx`, `ExerciseEditRow.tsx`, `EditorChip.tsx`, `ExercisePickerSheet.tsx`; create `ExercisePickerSheet.test.tsx`; wire `Gyakorlatok` switcher case in `MesocycleBuilder`. Contract: `mesocycles.jsx` `MesoExercises` + `ExercisePickerSheet`. Reads meso `days` + `useTrain().exerciseLibrary`.

`MesoExercises`: intro card (verbatim, `**bold**`→`SafeMarkdown`); per-day collapsible `DayExerciseSection` (default-expanded = current day) with `ExerciseEditRow`s (drag handle (visual), name, `{muscle}`, `{sets} × {targetReps} · RIR {targetRIR}`, optional warning, settings/✕ chips; settings expands `EditorChip`s `Szet`/`Rep target`/`RIR` + `[tool] Csere`/`[+] Variáns`); dashed `+ Gyakorlat hozzáadása` → `ExercisePickerSheet`; off-days `{note}` + `Edzéssé alakít`; footer `Heti szet-volumen` summary. Edits/adds/removes mutate **local state** seeded from the meso `days` (no persistence).

`ExercisePickerSheet`: eyebrow brand `Gyakorlat választás`, title `Mit pakolunk be?`, search input placeholder `Keresés · pl. row, curl, press`, muscle filter chips (`Összes` + `MUSCLE_LABELS`), list from `exerciseLibrary` (name, `{muscle} · {type}`, a `STIM` 5-bar meter, `+`), empty → `Nincs találat ezzel a szűrővel.`

- [ ] **Step 1: Failing test** — `ExercisePickerSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExercisePickerSheet } from './ExercisePickerSheet'

test('lists library exercises and filters by search', async () => {
  render(<ExercisePickerSheet onClose={() => {}} onPick={() => {}} />)
  expect(screen.getByText('Mit pakolunk be?')).toBeInTheDocument()
  await userEvent.type(screen.getByPlaceholderText('Keresés · pl. row, curl, press'), 'zzzz')
  expect(screen.getByText('Nincs találat ezzel a szűrővel.')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run → FAIL.**  - [ ] **Step 3: Implement** (faithful port; local-state day model).  - [ ] **Step 4: Run → PASS.**  - [ ] **Step 5: Commit** — `git commit -m "feat(train): builder Gyakorlatok — day editor + exercise picker"`

---

## Task 11: 4-step AI mesocycle planner (`MesocyclePlanner`)

**Files:** Rewrite `src/features/train/MesocyclePlanner.tsx` (full-screen route `/train/mesocycles/new`); create `MesocyclePlanner.test.tsx`; components `PlannerDaySection.tsx`, `PlannerExerciseRow.tsx`, `MiniStat.tsx`, and a helper module `src/features/train/planner.ts` (`generateProgram`, `addWeeks`, `getSeason`, `stepLabels`, the per-goal hint copy, the `schemes` table). Contract: `meso-planner.jsx`. Reads `useTrain()` (`GOAL_PRESETS`, `SPLITS`, `exerciseLibrary`). Uses `useNavigate()` for back/save (no real persistence — `onSave` just `navigate('/train/mesocycles')`).

State machine: `step ∈ 0..3`; selections `{ goal, name, startDate, weeks, phaseCurve, split, days }`. Header: back button (`← {prev step label | 'Mesociklusok'}`), 4-segment progress bar (filled+glow ≤ step, earlier tappable), eyebrow brand `{NN} / 04 · {stepLabel}`, page-title per step (`Mit szeretnénk építeni?` / `Mennyi időnk van?` / `Hogyan osszuk be?` / `AI program · áttekintés`). Footer nav: steps 0-2 `Vissza`+`Tovább →` (disabled until `canNext`); step 3 `[check] Hozzáad mint tervezett` + `Aktiválás most · {startDate}`.
- **Step 0 Cél**: intro + 5 `GOAL_PRESETS` cards (selecting prefills name/weeks/phaseCurve/split/days; selected shows `description` + accent strip).
- **Step 1 Hossz + fázisok**: name input, start date `{startDate} · 2026`, computed `Vége` via `addWeeks`, length selector `3..8` (auto-adjust phaseCurve length), **phase-curve editor** (tap a week to cycle MEV→MAV→MRV→Deload, `[sparkle] Mezo reset`), per-goal `Mezo javasolja` hint (verbatim 5 strings).
- **Step 2 Split + napok**: intro, `SPLITS` cards (`★ Mezo ajánlja {goal.label}-hez` when `best===goal.id`), `Edzések száma` `3..6`, auto-fill card (verbatim).
- **Step 3 Áttekintés**: on entry run `generateProgram(...)` with a loading state (`A Mezo összerakja a programot…`); summary header (`MiniStat`s Hossz/Napok/Gyak/Szet), AI hint (verbatim), collapsible `PlannerDaySection`s with `PlannerExerciseRow`s (✕ removes), tool chips `get_meso_history()`/`get_niggle_events()`/`generateMesoPlan(goal, split)`/`rankByStimFatigue()`.

`planner.ts` `generateProgram` builds 7-day templates per split + applies the goal `schemes` (rep/RIR/set per compound/isolation) + injects niggle-aware warnings (Overhead Press → "Cable variánssal helyettesítve", Lat Pulldown → "Pronated grif"). Port the `schemes` table and helpers verbatim from `meso-planner.jsx` (lines ~793-799 for schemes; `addWeeks` uses HU months `Jan,Feb,Már,Ápr,Máj,Jún,Júl,Aug,Szep,Okt,Nov,Dec`).

- [ ] **Step 1: Failing test** — `MesocyclePlanner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { MesocyclePlanner } from './MesocyclePlanner'

const renderPlanner = () => render(<MemoryRouter initialEntries={['/train/mesocycles/new']}><MesocyclePlanner /></MemoryRouter>)

test('step 0 shows the goal presets', () => {
  renderPlanner()
  expect(screen.getByText('Mit szeretnénk építeni?')).toBeInTheDocument()
  expect(screen.getByText('Hypertrophy')).toBeInTheDocument()
  expect(screen.getByText('Sport-specific')).toBeInTheDocument()
})

test('selecting a goal enables Tovább and advances to step 1', async () => {
  renderPlanner()
  await userEvent.click(screen.getByText('Hypertrophy'))
  await userEvent.click(screen.getByRole('button', { name: /Tovább/ }))
  expect(screen.getByText('Mennyi időnk van?')).toBeInTheDocument()
})
```

Also add `src/features/train/planner.test.ts` asserting `generateProgram({goal: GOAL_PRESETS[0], split: SPLITS[0], days: 5, niggle: 'shoulder'})` returns 7 day templates with a niggle warning on the relevant exercise, and `addWeeks('Jún 16', 6)` returns the expected HU date string.

- [ ] **Step 2: Run → FAIL.**  - [ ] **Step 3: Implement** `planner.ts` (+ test) then the stepper component.  - [ ] **Step 4: Run → PASS.**  - [ ] **Step 5: Commit** — `git commit -m "feat(train): 4-step AI mesocycle planner + generateProgram"`

---

## Task 12: Active workout mode (`ActiveWorkoutScreen`)

**Files:** Rewrite `src/features/train/ActiveWorkoutScreen.tsx` (full-screen route `/train/session`); create `ActiveWorkoutScreen.test.tsx`; components `CompactStepper.tsx`, `LastWeekStat.tsx`, `PRToast.tsx`, `FeedbackModal.tsx`, `WorkoutComplete.tsx`, `ChallengesCarousel.tsx`, `ChallengeCard.tsx`. Contract: `train.jsx` + `challenges.jsx`. Reads `useTrain()` (`workout`, `activeMeso`). Uses `useNavigate()` — every exit (`Bezárás`/back/`Mentés`) → `navigate('/train')`.

State machine (effective phases `prep → active → complete`): local state `phase`, `exerciseIdx`, `setIdx`, `weight` (init 102.5), `reps` (init 9), `rir` (init 2), `completedSets` (map keyed `ex0..exN`), `showPR`, `showFeedback`, `niggleConfirmed`, `acceptedChallenges` (Set/array). `niggleActive = !!workout.niggleWarning`.

- **PREP**: back `← Vissza` → exit; title `{workout.title}`; chips `Week 3 · MAV` + `5 gyakorlat`; niggle pre-flag (amber, `Jobb váll · aktív niggle` + detail + `Értem · jó így`/`Tudatosítsuk később`); `ChallengesCarousel` (renders `workout.challenges`, accept/skip, dot pager); warmup block (3 hardcoded rows verbatim); exercise list (challenge-targeted exercises get brand strip); CtaPrimary `Kezdjük el · {title}` → `phase='active'`.
- **ACTIVE**: header ✕ `Bezárás` + `{exIdx+1}/{N} · {doneSets}/{totalSets} szet` + progress bar; optional niggle banner; active exercise `card notch-12` (challenge banner if accepted; eyebrow `{Compound|Isolation} · Set {setIdx+1}/{sets}`; `Cél · {targetReps} @ RIR {targetRIR}`; name; **Múlt hét** comparison block with AI suggestion line; **set dots**; completed-set history with PR star + delta); logging panel (two `CompactStepper`s kg step 2.5 / reps step 1; RIR row 0-3; Side L/B/R for isolation only); tool row (`90s`/`Note`/`Voice`, inert); CtaPrimary `[check] Set kész` → `completeSet()`.
- **`completeSet()`**: push `{weight,reps,rir}`; **PR demo** if `exerciseIdx===0 && setIdx===2 && weight>=105` → `showPR` toast (`PRToast`, 4.5s); if last set of exercise → open `FeedbackModal`; else `setIdx++`.
- **`FeedbackModal`**: 3 `FeedbackRow`s (`Pump · érzed?`/`Joint pain`/`Akarunk még?` with verbatim options + defaults); `Hagyjuk`/`{Edzés vége → | Mentés · tovább}`; advancing prefills next exercise from its `lastWeek`, or → `complete`.
- **COMPLETE** (`WorkoutComplete`): companion celebration (PR vs no-PR copy verbatim, tool chips), `Mai mérleg` stats (`CompleteStat` Szet/Volumen/PR), per-exercise recap, post-workout window card (verbatim), notes textarea, actions `[check] Mentés · vissza a Today-re` (→ exit) + `[bookmark] Megosztom Mezo-val` (inert).

`ChallengesCarousel`/`ChallengeCard` (`challenges.jsx`): carousel eyebrow `Mai kihívások · proposál` + helper copy + dot pager; card type-colored pill (PR/Depth/Volume/Tempo), `conf {NN}%`, risk chip, `{exercise}`+`{target}`, `{why}`, `RefTag`s, tool chips, accepted glory banner `Ha sikerül · {glory}`, `[sparkle] Vállaljuk`/`[check] Elfogadva` + `Nem ma`.

- [ ] **Step 1: Failing test** — `ActiveWorkoutScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen'

const renderWorkout = () => render(<MemoryRouter initialEntries={['/train/session']}><ActiveWorkoutScreen /></MemoryRouter>)

test('prep screen shows title, challenges and the start CTA', () => {
  renderWorkout()
  expect(screen.getByText('Pull Day', { exact: false })).toBeInTheDocument()
  expect(screen.getByText('Mai kihívások · proposál')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Kezdjük el/ })).toBeInTheDocument()
})

test('starting the workout reveals the first exercise + logging panel', async () => {
  renderWorkout()
  await userEvent.click(screen.getByRole('button', { name: /Kezdjük el/ }))
  expect(screen.getByText('Chest Supported Row')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Set kész/ })).toBeInTheDocument()
})

test('logging the first set advances the set counter', async () => {
  renderWorkout()
  await userEvent.click(screen.getByRole('button', { name: /Kezdjük el/ }))
  await userEvent.click(screen.getByRole('button', { name: /Set kész/ }))
  expect(screen.getByText(/Set 2\//)).toBeInTheDocument()
})
```

> The niggle pre-flag, PR toast (set 3 @ ≥105), and feedback modal each warrant a focused test once the component exists; add them during implementation. Keep RIR/scale cells accessible (`aria-label`).

- [ ] **Step 2: Run → FAIL.**  - [ ] **Step 3: Implement** components then `ActiveWorkoutScreen` state machine (faithful port).  - [ ] **Step 4: Run → PASS.**  - [ ] **Step 5: Commit** — `git commit -m "feat(train): active workout mode — prep/active/complete + challenges + feedback"`

---

## Task 13: Parity harness + nav smoke test + final build/review

**Files:** Modify `tests/parity/foundation.spec.ts` (add Train shots); create `src/features/train/train.nav.test.tsx`. Contract: existing `foundation.spec.ts` `INSIGHTS_VIEWS` loop + Fuel sheet-state tests.

- [ ] **Step 1: Nav smoke test** — `train.nav.test.tsx` (boot the real router via `createMemoryRouter(routes, …)` inside `ThemeProvider`; click sub-nav; assert headings/content swap; assert entering `/train/session`, `/train/mesocycles/new`, `/train/mesocycles/meso-hyp-04` render their full-screen content WITHOUT the sub-nav):

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<ThemeProvider><RouterProvider router={router} /></ThemeProvider>)
}

test('Train sub-nav swaps the sub-views', async () => {
  renderApp('/train')
  expect(screen.getByText('Pull Day')).toBeInTheDocument()                 // Mai
  await userEvent.click(screen.getByRole('link', { name: 'Sport' }))
  expect(screen.getByText('BVSC csarnok')).toBeInTheDocument()             // Sport
  await userEvent.click(screen.getByRole('link', { name: 'Mesociklusok' }))
  expect(screen.getByText('Hypertrophy 04 · Tavasz')).toBeInTheDocument()  // Library
})

test('full-screen flows render without the sub-nav', () => {
  const { container } = renderApp('/train/session')
  expect(container.querySelector('.subnav')).toBeNull()
  expect(screen.getByRole('button', { name: /Kezdjük el/ })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run → PASS** — `pnpm test src/features/train/train.nav.test.tsx`.
- [ ] **Step 3: Parity shots** — add to `foundation.spec.ts`:

```ts
const TRAIN_VIEWS: Array<[string, string]> = [
  ['train-mai', '/train'],
  ['train-gym', '/train/gym'],
  ['train-sport', '/train/sport'],
  ['train-mesocycles', '/train/mesocycles'],
  ['train-builder', '/train/mesocycles/meso-hyp-04'],
  ['train-planner', '/train/mesocycles/new'],
  ['train-session', '/train/session'],
]
for (const [name, path] of TRAIN_VIEWS) {
  test(`our app — ${name}`, async ({ page }) => {
    await page.goto(`http://localhost:4317${path}`)
    await page.waitForTimeout(500)
    await page.screenshot({ path: `tests/parity/__shots__/app-${name}.png` })
  })
}
```

- [ ] **Step 4: Full suite + build** — `pnpm test` (all green, including the 199 baseline) and `pnpm build` (tsc `noUnusedLocals`/`noUnusedParameters` clean, vite build OK).
- [ ] **Step 5: Parity capture** — `pnpm parity` (best-effort; generates `app-train-*.png` for the manual parity review). If the prototype server in the spec is available, capture prototype shots too.
- [ ] **Step 6: Commit** — `git add tests/parity/foundation.spec.ts src/features/train/train.nav.test.tsx && git commit -m "test(train): nav smoke test + parity shots for Train slice"`

---

## Self-Review (controller runs after writing, before execution)

**Spec coverage:** Mai ✓(T4) · GYM ✓(T5) · Sport+week/log/crossload ✓(T6) · Mesocycle library ✓(T7) · Builder overview/volume/exercises ✓(T8/T9/T10) · 4-step planner ✓(T11) · Active workout prep/active/complete + challenges ✓(T12) · sub-nav+routes ✓(T2) · data ✓(T1) · sheets (SportLog ✓T3, GymDay ✓T5, DayDetail ✓T8, ExercisePicker ✓T10, Feedback ✓T12) · parity+smoke ✓(T13).

**Adaptations locked:** routes-not-local-state for sub-tabs; full-screen siblings for session/planner/builder (no sub-nav); `jumpCount` added to sport sessions; tendency pinks → token; `niggleActive` from data; `**bold**`→`SafeMarkdown`; verbatim HU copy; no new icons/CSS; named exports; local state for all mutations.

**Type consistency:** `Mesocycle`/`MesoDay`/`VolumeProfile`/`WorkoutPlan`/`Challenge`/`Sport*`/`GoalPreset`/`SplitOption` defined in T1, consumed by the same names throughout. `useTrain()` returns `{ mesocycles, activeMeso, workout, gymSchedule, sport, exerciseLibrary }`.

**Open parity-review calls (decide at slice checkpoint, not blocking):** double-header on GYM/Sport (shell header + view header); whether the bottom tab bar should hide during active workout; `DayDetailSheet` English fragment.

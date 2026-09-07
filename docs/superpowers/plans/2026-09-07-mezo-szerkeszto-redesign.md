# Mezo-szerkesztő redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mezociklus-varázsló és a sablon-szerkesztő egyetlen, design 2.0 (Mozaik) szerkesztőfelületté olvad — vékony interjú, vízszintesen görgethető nap-csempesor, mindig nyitott inline inputos gyakorlat-kártyák, és a zöld/sárga/piros helyett zóna-sávos Heti/Napi terhelés-oldalak.

**Architecture:** Minden új derivációt egyetlen pure modul ad (`logic/mesoLoad.ts`), amire vékony, presentational komponensek épülnek (`ZoneBar`, `ExerciseCard`, `LoadTile`, `DayStripTile`), ezekből áll össze két panel (`MesoDayEditor`, `MesoWeekEditor`) és két teljes oldal (`DayLoadPanel`, `WeekLoadPanel`). A két meglévő route (`/train/mesocycles/new`, `/train/mesocycles/templates/:id`) ugyanazt a `MesoWeekEditor`-t rendereli, csak a perzisztencia és a lábléc-CTA-k különböznek. A régi `MesoEditor` életben marad a futó mezo napi szerkesztőjének (`MesoExercises` → `MesoDayPage`), ami e munka non-goalja.

**Tech Stack:** React 19 + TypeScript, Vite, vitest + Testing Library + MSW, TanStack Query, `@/shared/ui/mozaik` + `@/shared/ui/clay` kit, `frontend/src/styles/prototype.css` (`mz-*` osztályok).

## Global Constraints

- **A vizuális igazság a prototípus:** `docs/design_2.0/prototypes/mezo-szerkeszto.html`. Ahol a terv szövege és a prototípus eltér, a prototípus dönt. Spec: `docs/superpowers/specs/2026-09-07-mezo-szerkeszto-redesign-design.md`.
- **Százalék soha nem jelenik meg szövegként** a volumen-felületeken (öröklött szabály a `WeeklyBandsCard`-ból).
- **Nincs `*Screen` / `*View` név** — presentational egység `components/`-ben, `Card/Panel/Row/Hero/Bar/Tile/Cell` utótaggal (`docs/references/frontend_conventions.md` §3 és §8).
- **Deep, abszolút importok** a `@/*` aliason át; relatív `../` import tilos.
- **Pages fetchel, components présentál** — `useTimingProfile()` és minden query a `pages/` rétegben marad, propként megy le.
- **Clay ikonok, nem emoji** dekorációra. Kivétel a 🔥 Failure / 🌿 Volume címke, ami már ma is így él (`ExerciseAccordionRow.tsx:104`) — szemantikus szövegjelölő, változatlanul átvéve.
- **Backend és kontraktus nem változik:** `api/feature/train/train.yml`-hez nem nyúlunk.
- **Teljes-sablon PUT láb-lövés:** a sablon minden írásának vinnie kell a `musclePriorities` és `goalPreset` mezőt, különben némán all-grow-ra áll vissza (`MesoTemplateEditorPage.tsx:42-48`).
- **`prefers-reduced-motion`** minden új animációnál kötelezően kezelt.
- **A `prototype.css` (9k sor) szerkezetileg törékeny** — a `prototypeCssStructure.test.ts` parsolja. Új szabályokat a fájl végére, egy blokkban, gondosan lezárt kapcsos zárójelekkel.
- **Fókuszált teszt futtatása:** `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run <path>`. A `pnpm test -- <file>` **nem** szűkít (a teljes 675-fájlos suite fut le).
- **Teljes kapu a végén:** `cd frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test`.
- **Adatmodell-tény:** `GymExercise.muscle` **egyetlen** izomkulcs — a modellben **nincs szinergista**. A prototípus „szinergista fél szettel" része demó-fikció; az implementációban minden gyakorlat a teljes `workingSets`-ét pontosan egy `budgetGroup`-hoz adja.

---

### Task 1: `mesoLoad` — a megosztott deriváció-modul

Minden új felület ugyanabból a modulból olvas: heti izom-terhelés tier-céllal és iránnyal, napi izom-terhelés session-cap ellen, és az egymást követő napok izom-ütközése. Pure függvények, nulla React.

**Files:**
- Create: `frontend/src/features/train/logic/mesoLoad.ts`
- Test: `frontend/src/features/train/logic/mesoLoad.test.ts`

**Interfaces:**
- Consumes: `budgetGroup`, `countsForVolume`, `BUDGET_GROUP_LABELS`, `GROUP_LANDMARKS`, `SESSION_MUSCLE_CAP` (`@/features/train/logic/setBudget`); `tierOf`, `tierTargetOf` (`@/features/train/logic/musclePriorities`); `isOffDay` (`@/features/train/logic/offDay`); `DAY_ORDER` (`@/data/train/train`).
- Produces:
  - `interface Landmark { mev: number; mav: number; mrv: number }`
  - `interface ExerciseContribution { exerciseId: string; name: string; sets: number }`
  - `interface DayContribution { day: string; type: string; sets: number; exercises: ExerciseContribution[] }`
  - `interface WeekLoadRow { group: string; label: string; colorMuscle: string; tier: MuscleTier; sets: number; target: number; landmark: Landmark; frequency: number; direction: 'up' | 'down' | 'hold'; toTarget: number; contributions: DayContribution[] }`
  - `interface DayLoadRow { group: string; label: string; colorMuscle: string; sets: number; cap: number; nearCap: boolean; over: boolean; exercises: ExerciseContribution[] }`
  - `interface AdjacentConflict { fromDay: string; fromType: string; toDay: string; toType: string; groups: { group: string; label: string }[] }`
  - `function weekMuscleLoad(days: MesoDay[], priorities?: MusclePriorities | null, landmarks?: Record<string, Landmark> | null): WeekLoadRow[]`
  - `function dayMuscleLoad(day: MesoDay): DayLoadRow[]`
  - `function adjacentDayConflicts(days: MesoDay[]): AdjacentConflict[]`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/train/logic/mesoLoad.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { adjacentDayConflicts, dayMuscleLoad, weekMuscleLoad } from '@/features/train/logic/mesoLoad'

function ex(id: string, name: string, muscle: string, workingSets: number, extra: Partial<GymExercise> = {}): GymExercise {
  return {
    id, name, muscle, warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR: 1,
    anchorWeightKg: null, type: 'strength', ...extra,
  }
}

function day(dayKey: string, type: string, exercises: GymExercise[], muscle = 'back'): MesoDay {
  return { day: dayKey, type, muscle, exerciseCount: exercises.length, exercises }
}

const WEEK: MesoDay[] = [
  day('Hét', 'Upper', [ex('a', 'Döntött evezés', 'back', 4), ex('b', 'Arnold press', 'shoulder', 3)]),
  day('Kedd', 'Push', [ex('c', 'Oldalemelés', 'shoulder', 4)], 'shoulder'),
  day('Sze', 'Rest', [], ''),
  day('Csü', 'Pull', [ex('d', 'Húzódzkodás', 'back', 3)]),
]

describe('weekMuscleLoad', () => {
  test('sums working sets per budget group, sorted by sets descending', () => {
    const rows = weekMuscleLoad(WEEK, null)
    expect(rows.map((r) => [r.group, r.sets])).toEqual([['back', 7], ['shoulder', 7]])
    // tie broken by label: Hát before Váll
    expect(rows.map((r) => r.label)).toEqual(['Hát', 'Váll'])
  })

  test('target follows the tier: grow -> MAV, emphasize -> MRV, maintain -> MEV', () => {
    const grow = weekMuscleLoad(WEEK, null).find((r) => r.group === 'back')!
    expect(grow.tier).toBe('grow')
    expect(grow.target).toBe(16) // GROUP_LANDMARKS.back.mav

    const emph = weekMuscleLoad(WEEK, { back: 'emphasize' }).find((r) => r.group === 'back')!
    expect(emph.target).toBe(22) // .mrv

    const maint = weekMuscleLoad(WEEK, { back: 'maintain' }).find((r) => r.group === 'back')!
    expect(maint.target).toBe(10) // .mev
  })

  test('direction points at the target and toTarget is the distance', () => {
    const under = weekMuscleLoad(WEEK, null).find((r) => r.group === 'back')!
    expect(under.direction).toBe('up')
    expect(under.toTarget).toBe(9) // 16 - 7

    const over = weekMuscleLoad(WEEK, { back: 'maintain' }).find((r) => r.group === 'back')!
    expect(over.direction).toBe('down')
    expect(over.toTarget).toBe(3) // 7 - 10 -> |−3|
  })

  test('frequency counts the training days that hit the group', () => {
    const rows = weekMuscleLoad(WEEK, null)
    expect(rows.find((r) => r.group === 'back')!.frequency).toBe(2)
    expect(rows.find((r) => r.group === 'shoulder')!.frequency).toBe(2)
  })

  test('contributions list the days and exercises behind the number', () => {
    const back = weekMuscleLoad(WEEK, null).find((r) => r.group === 'back')!
    expect(back.contributions).toEqual([
      { day: 'Hét', type: 'Upper', sets: 4, exercises: [{ exerciseId: 'a', name: 'Döntött evezés', sets: 4 }] },
      { day: 'Csü', type: 'Pull', sets: 3, exercises: [{ exerciseId: 'd', name: 'Húzódzkodás', sets: 3 }] },
    ])
  })

  test('an explicit landmark override wins over the static table', () => {
    const rows = weekMuscleLoad(WEEK, null, { back: { mev: 4, mav: 6, mrv: 8 } })
    const back = rows.find((r) => r.group === 'back')!
    expect(back.target).toBe(6)
    expect(back.landmark).toEqual({ mev: 4, mav: 6, mrv: 8 })
  })

  test('exempt work and landmark-less groups are excluded', () => {
    const days = [day('Hét', 'Upper', [
      ex('p', 'Box jump', 'quad', 3, { countsTowardVolume: false }),
      ex('t', 'Shrug', 'traps', 3),
      ex('r', 'Evezés', 'back', 2),
    ])]
    expect(weekMuscleLoad(days, null).map((r) => r.group)).toEqual(['back'])
  })
})

describe('dayMuscleLoad', () => {
  test('per-group sets with cap flags, sorted by sets descending', () => {
    const d = day('Hét', 'Upper', [
      ex('a', 'Evezés', 'back', 8),
      ex('b', 'Press', 'shoulder', 7),
      ex('c', 'Fly', 'chest', 2),
    ])
    expect(dayMuscleLoad(d).map((r) => [r.group, r.sets, r.nearCap, r.over])).toEqual([
      ['back', 8, true, false],   // == cap: near, not over
      ['shoulder', 7, true, false], // cap - 1: near
      ['chest', 2, false, false],
    ])
  })

  test('over the cap sets over (and not nearCap)', () => {
    const d = day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 9)])
    expect(dayMuscleLoad(d)[0]).toMatchObject({ sets: 9, nearCap: false, over: true, cap: 8 })
  })

  test('each row lists the exercises behind it', () => {
    const d = day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 4), ex('b', 'Pulldown', 'back', 3)])
    expect(dayMuscleLoad(d)[0].exercises).toEqual([
      { exerciseId: 'a', name: 'Evezés', sets: 4 },
      { exerciseId: 'b', name: 'Pulldown', sets: 3 },
    ])
  })
})

describe('adjacentDayConflicts', () => {
  test('flags a group trained on two calendar-adjacent training days', () => {
    expect(adjacentDayConflicts(WEEK)).toEqual([
      { fromDay: 'Hét', fromType: 'Upper', toDay: 'Kedd', toType: 'Push', groups: [{ group: 'shoulder', label: 'Váll' }] },
    ])
  })

  test('a gap day breaks the adjacency', () => {
    const spread = [
      day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 4)]),
      day('Sze', 'Pull', [ex('b', 'Húzódzkodás', 'back', 4)]),
    ]
    expect(adjacentDayConflicts(spread)).toEqual([])
  })

  test('rest days neither conflict nor bridge', () => {
    const withRest = [
      day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 4)]),
      day('Kedd', 'Rest', [], ''),
      day('Sze', 'Pull', [ex('b', 'Húzódzkodás', 'back', 4)]),
    ]
    expect(adjacentDayConflicts(withRest)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/logic/mesoLoad.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/train/logic/mesoLoad"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/train/logic/mesoLoad.ts`:

```ts
// ============================================================
// Mezo · mesoLoad — a mezo-szerkesztő terhelés-derivációi egy helyen
// (mezo-yty6, spec 2026-09-07-mezo-szerkeszto-redesign): heti izom-terhelés a
// tier-cél ellen (irány + távolság + frekvencia + lebontás), napi izom-terhelés
// a session-cap ellen, és az egymást követő edzésnapok izom-ütközése.
//
// Miért egy modul: a nap-csempesor, a két kompakt csempe, a Napi és a Heti
// terhelés-oldal ugyanazokat a számokat mutatja — két külön számolás előbb-utóbb
// elcsúszik (a dayTiles.ts ugyanezért született).
//
// A modell EGY izomkulcsot tárol gyakorlatonként (GymExercise.muscle), tehát
// nincs szinergista-hasítás: minden gyakorlat a teljes workingSets-ét pontosan
// egy budgetGroup-hoz adja.
// ============================================================
import { DAY_ORDER } from '@/data/train/train'
import type { MesoDay, MusclePriorities, MuscleTier } from '@/data/types'
import { tierOf, tierTargetOf } from '@/features/train/logic/musclePriorities'
import { isOffDay } from '@/features/train/logic/offDay'
import {
  BUDGET_GROUP_LABELS, GROUP_LANDMARKS, SESSION_MUSCLE_CAP, budgetGroup, countsForVolume,
} from '@/features/train/logic/setBudget'

export interface Landmark { mev: number; mav: number; mrv: number }

export interface ExerciseContribution { exerciseId: string; name: string; sets: number }

export interface DayContribution {
  day: string
  type: string
  sets: number
  exercises: ExerciseContribution[]
}

export interface WeekLoadRow {
  group: string
  label: string
  /** Representative catalog muscle key — feed muscleColor() for the family tokens. */
  colorMuscle: string
  tier: MuscleTier
  /** Working sets planned this week for the group (exempt work excluded). */
  sets: number
  /** The tier's weekly landmark target: maintain→MEV, grow→MAV, emphasize→MRV. */
  target: number
  landmark: Landmark
  /** Training days that hit the group at all. */
  frequency: number
  /** Which way the block has to move to reach `target`. */
  direction: 'up' | 'down' | 'hold'
  /** |target − sets|; 0 when on target. */
  toTarget: number
  contributions: DayContribution[]
}

export interface DayLoadRow {
  group: string
  label: string
  colorMuscle: string
  sets: number
  /** SESSION_MUSCLE_CAP, carried so the view never re-imports the constant. */
  cap: number
  /** At the cap or one set below it — amber, but not a breach. */
  nearCap: boolean
  /** Strictly over the cap. */
  over: boolean
  exercises: ExerciseContribution[]
}

export interface AdjacentConflict {
  fromDay: string
  fromType: string
  toDay: string
  toType: string
  groups: { group: string; label: string }[]
}

const labelOf = (group: string) => BUDGET_GROUP_LABELS[group] ?? group
const dayIndex = (day: string) => DAY_ORDER.indexOf(day as (typeof DAY_ORDER)[number])

/** Training days (not off, at least one exercise) in calendar order. */
function trainingDays(days: MesoDay[]): MesoDay[] {
  return days
    .filter((d) => !isOffDay(d) && d.exercises.length > 0)
    .slice()
    .sort((a, b) => dayIndex(a.day) - dayIndex(b.day))
}

/** group -> the exercises contributing to it on this day, in list order. */
function groupExercises(day: MesoDay): Map<string, ExerciseContribution[]> {
  const out = new Map<string, ExerciseContribution[]>()
  for (const ex of day.exercises) {
    if (!countsForVolume(ex)) continue
    const group = budgetGroup(ex.muscle)
    if (!group) continue
    const list = out.get(group) ?? []
    list.push({ exerciseId: ex.id, name: ex.name, sets: ex.workingSets })
    out.set(group, list)
  }
  return out
}

/**
 * Weekly per-group load measured against the group's OWN tier target. Landmarks:
 * explicit `landmarks[group]` → static GROUP_LANDMARKS → row dropped (traps/core carry
 * no landmark, so there is no target to point an arrow at).
 * Sorted by sets desc, ties by label — the spec's "csökkenő sorrend".
 */
export function weekMuscleLoad(
  days: MesoDay[],
  priorities?: MusclePriorities | null,
  landmarks?: Record<string, Landmark> | null,
): WeekLoadRow[] {
  const sets = new Map<string, number>()
  const colorMuscle = new Map<string, string>()
  const contributions = new Map<string, DayContribution[]>()

  for (const day of trainingDays(days)) {
    for (const [group, exercises] of groupExercises(day)) {
      const daySets = exercises.reduce((a, e) => a + e.sets, 0)
      sets.set(group, (sets.get(group) ?? 0) + daySets)
      if (!colorMuscle.has(group)) {
        const first = day.exercises.find((e) => budgetGroup(e.muscle) === group)
        if (first) colorMuscle.set(group, first.muscle)
      }
      const list = contributions.get(group) ?? []
      list.push({ day: day.day, type: day.type, sets: daySets, exercises })
      contributions.set(group, list)
    }
  }

  const rows: WeekLoadRow[] = []
  for (const [group, groupSets] of sets) {
    const landmark = landmarks?.[group] ?? GROUP_LANDMARKS[group] ?? null
    if (!landmark) continue
    const tier = tierOf(priorities, group)
    const target = tierTargetOf(tier, landmark)
    const list = contributions.get(group) ?? []
    rows.push({
      group,
      label: labelOf(group),
      colorMuscle: colorMuscle.get(group) ?? group,
      tier,
      sets: groupSets,
      target,
      landmark,
      frequency: list.length,
      direction: groupSets < target ? 'up' : groupSets > target ? 'down' : 'hold',
      toTarget: Math.abs(target - groupSets),
      contributions: list,
    })
  }
  return rows.sort((a, b) => b.sets - a.sets || a.label.localeCompare(b.label, 'hu'))
}

/** Per-group load for ONE day against the per-session muscle cap, sets desc. */
export function dayMuscleLoad(day: MesoDay): DayLoadRow[] {
  const rows: DayLoadRow[] = []
  for (const [group, exercises] of groupExercises(day)) {
    const sets = exercises.reduce((a, e) => a + e.sets, 0)
    const first = day.exercises.find((e) => budgetGroup(e.muscle) === group)
    rows.push({
      group,
      label: labelOf(group),
      colorMuscle: first?.muscle ?? group,
      sets,
      cap: SESSION_MUSCLE_CAP,
      nearCap: sets >= SESSION_MUSCLE_CAP - 1 && sets <= SESSION_MUSCLE_CAP,
      over: sets > SESSION_MUSCLE_CAP,
      exercises,
    })
  }
  return rows.sort((a, b) => b.sets - a.sets || a.label.localeCompare(b.label, 'hu'))
}

/**
 * Muscle groups trained on two CALENDAR-ADJACENT training days (Hét→Kedd, not Hét→Sze).
 * Passive advice, never a block: a rest day between two sessions for the same group is
 * the recovery default. No prior art in the surveyed apps — our own pattern (spec §4).
 */
export function adjacentDayConflicts(days: MesoDay[]): AdjacentConflict[] {
  const training = trainingDays(days)
  const out: AdjacentConflict[] = []
  for (let i = 0; i < training.length - 1; i++) {
    const from = training[i]
    const to = training[i + 1]
    if (dayIndex(to.day) - dayIndex(from.day) !== 1) continue
    const fromGroups = new Set(groupExercises(from).keys())
    const groups = [...groupExercises(to).keys()]
      .filter((g) => fromGroups.has(g))
      .map((group) => ({ group, label: labelOf(group) }))
    if (groups.length) {
      out.push({ fromDay: from.day, fromType: from.type, toDay: to.day, toType: to.type, groups })
    }
  }
  return out
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/logic/mesoLoad.test.ts`
Expected: PASS — 12 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/logic/mesoLoad.ts frontend/src/features/train/logic/mesoLoad.test.ts
git commit -m "feat(train): mesoLoad derivations for the meso editor redesign (mezo-yty6)"
```

---

### Task 2: `ZoneBar` — a zóna-sáv (MV→MEV→MAV→MRV)

A magyarázat nélküli zöld/sárga/piros helyett: zónázott sáv feliratozott landmark-vonalakkal, cél-vonallal és az aktuális értéken álló markerrel. Ez a komponens szolgálja ki a Heti terhelés oldalt.

**Files:**
- Create: `frontend/src/features/train/components/ZoneBar.tsx`
- Test: `frontend/src/features/train/components/ZoneBar.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (a fájl **végére**)

**Interfaces:**
- Consumes: `Landmark` (`@/features/train/logic/mesoLoad`), `muscleColor` (`@/features/train/logic/muscleColors`).
- Produces: `function ZoneBar(props: { landmark: Landmark; value: number; target: number; colorMuscle: string; label: string }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/train/components/ZoneBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { ZoneBar } from '@/features/train/components/ZoneBar'

const LM = { mev: 10, mav: 16, mrv: 22 }

describe('ZoneBar', () => {
  test('labels every landmark so the zones are readable', () => {
    render(<ZoneBar landmark={LM} value={13} target={22} colorMuscle="back" label="Hát" />)
    expect(screen.getByText('MEV 10')).toBeInTheDocument()
    expect(screen.getByText('MAV 16')).toBeInTheDocument()
    expect(screen.getByText('MRV 22')).toBeInTheDocument()
  })

  test('exposes the position as an accessible meter, never as percent text', () => {
    const { container } = render(<ZoneBar landmark={LM} value={13} target={22} colorMuscle="back" label="Hát" />)
    const meter = screen.getByRole('meter', { name: 'Hát · heti szettek' })
    expect(meter).toHaveAttribute('aria-valuenow', '13')
    expect(meter).toHaveAttribute('aria-valuemax', '24') // mrv + 2 headroom
    expect(container.textContent).not.toMatch(/%/)
  })

  test('the marker sits at value and the target line at target', () => {
    const { container } = render(<ZoneBar landmark={LM} value={12} target={16} colorMuscle="back" label="Hát" />)
    const marker = container.querySelector('.mz-zb-mk') as HTMLElement
    const targetLine = container.querySelector('.mz-zb-tg') as HTMLElement
    expect(marker.style.left).toBe('50%')      // 12 / 24
    expect(targetLine.style.left).toBe('66.66667%') // 16 / 24
  })

  test('a value past the scale is clamped inside the track', () => {
    const { container } = render(<ZoneBar landmark={LM} value={99} target={22} colorMuscle="back" label="Hát" />)
    expect((container.querySelector('.mz-zb-mk') as HTMLElement).style.left).toBe('100%')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/components/ZoneBar.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/train/components/ZoneBar"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/train/components/ZoneBar.tsx`:

```tsx
// ============================================================
// Mezo · ZoneBar — a heti volumen zóna-sávja (mezo-yty6): a MEV–MAV és MAV–MRV
// zónák halvány sávozása, feliratozott landmark-vonalak, a tier-cél vonala és a
// mostani értéken álló, izom-színű marker. Ez váltja a magyarázat nélküli
// zöld/sárga/piros jelzést: látszik, hol állsz ÉS hova tartasz.
// Százalék soha nem jelenik meg szövegként (a WeeklyBandsCard öröklött szabálya).
// ============================================================
import type { Landmark } from '@/features/train/logic/mesoLoad'
import { muscleColor } from '@/features/train/logic/muscleColors'

interface ZoneBarProps {
  landmark: Landmark
  /** Working sets planned this week. */
  value: number
  /** The tier's landmark target — gets its own line on the track. */
  target: number
  colorMuscle: string
  /** Muscle label, used for the meter's accessible name. */
  label: string
}

/** A little headroom past MRV so a marker AT the ceiling is still visibly inside the track. */
const HEADROOM = 2

export function ZoneBar({ landmark, value, target, colorMuscle, label }: ZoneBarProps) {
  const max = landmark.mrv + HEADROOM
  const at = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`
  const deep = muscleColor(colorMuscle).deep

  return (
    <>
      <div
        className="mz-zb"
        role="meter"
        aria-label={`${label} · heti szettek`}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <span className="mz-zb-z2" style={{ left: at(landmark.mev), width: `${((landmark.mav - landmark.mev) / max) * 100}%` }} />
        <span className="mz-zb-z3" style={{ left: at(landmark.mav), width: `${((landmark.mrv - landmark.mav) / max) * 100}%` }} />
        <span className="mz-zb-hl" style={{ left: at(landmark.mev) }} />
        <span className="mz-zb-hl" style={{ left: at(landmark.mav) }} />
        <span className="mz-zb-hl" style={{ left: at(landmark.mrv) }} />
        <span className="mz-zb-tg" style={{ left: at(target) }} />
        <span className="mz-zb-mk" style={{ left: at(value), background: deep }} />
      </div>
      <div className="mz-zb-cap" aria-hidden="true">
        <span>MV {landmark.mev > 0 ? Math.max(0, Math.round(landmark.mev / 2)) : 0}</span>
        <span>MEV {landmark.mev}</span>
        <span>MAV {landmark.mav}</span>
        <span>MRV {landmark.mrv}</span>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Add the stylesheet block**

Append to the **end** of `frontend/src/styles/prototype.css` (keep every brace balanced — `prototypeCssStructure.test.ts` parses this file):

```css
/* ===== mezo-szerkesztő · zóna-sáv (mezo-yty6) ===== */
.mz-zb { position: relative; height: 14px; border-radius: 7px; overflow: hidden;
  margin-top: 6px; background: var(--mz-gbar-bg); }
.mz-zb-z2 { position: absolute; top: 0; bottom: 0; background: color-mix(in srgb, var(--coral) 16%, transparent); }
.mz-zb-z3 { position: absolute; top: 0; bottom: 0; background: color-mix(in srgb, var(--coral) 32%, transparent); }
.mz-zb-hl { position: absolute; top: 0; bottom: 0; width: 1px; background: color-mix(in srgb, var(--mz-ink) 25%, transparent); }
.mz-zb-tg { position: absolute; top: 0; bottom: 0; width: 2px; background: color-mix(in srgb, var(--mz-ink) 45%, transparent); }
.mz-zb-mk { position: absolute; top: -2px; bottom: -2px; width: 4px; border-radius: 2px;
  animation: mz-zb-pulse 2.6s ease-in-out 1.2s infinite; }
.mz-zb-cap { display: flex; justify-content: space-between; margin-top: 3px;
  font-size: 8px; font-weight: 700; color: var(--mz-ink-mut); }
@keyframes mz-zb-pulse {
  0%, 100% { box-shadow: 0 0 5px color-mix(in srgb, var(--amber) 50%, transparent); }
  50% { box-shadow: 0 0 11px color-mix(in srgb, var(--amber) 90%, transparent); }
}
@media (prefers-reduced-motion: reduce) {
  .mz-zb-mk { animation: none; }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/components/ZoneBar.test.tsx src/shared/ui/mozaik/prototypeCssStructure.test.ts`
Expected: PASS — both files (the CSS guard proves the stylesheet is still structurally intact).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/components/ZoneBar.tsx frontend/src/features/train/components/ZoneBar.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(train): ZoneBar volume gauge with landmark zones (mezo-yty6)"
```

---

### Task 3: `ExerciseCard` — mindig nyitott, inline inputos gyakorlat-kártya

Az accordion + stepper-gombok helyett: minden érték egyszerre látszik és közvetlenül írható. A „Finomhangolás" disclosure megszűnik — a RIR ide olvad be.

**Files:**
- Create: `frontend/src/features/train/components/ExerciseCard.tsx`
- Test: `frontend/src/features/train/components/ExerciseCard.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (a fájl végére)

**Interfaces:**
- Consumes: `GymExercise` (`@/data/types`), `setStyle` (`@/features/train/logic/setBudget`), `muscleColor` (`@/features/train/logic/muscleColors`), `MUSCLE_LABELS` (`@/data/train/train`), `ClayIcon` (`@/shared/ui/clay`).
- Produces: `function ExerciseCard(props: { ex: GymExercise; contribution: { label: string; sets: number; color: string }[]; canMoveUp: boolean; canMoveDown: boolean; onChange: (patch: Partial<GymExercise>) => void; onMove: (dir: -1 | 1) => void; onRemove: () => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/train/components/ExerciseCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { GymExercise } from '@/data/types'
import { ExerciseCard } from '@/features/train/components/ExerciseCard'

const EX: GymExercise = {
  id: 'e1', name: 'Döntött evezés', muscle: 'back', warmupSets: 1, workingSets: 4,
  repMin: 8, repMax: 10, targetRIR: 1, anchorWeightKg: 84, type: 'strength',
}

function setup(overrides: Partial<Parameters<typeof ExerciseCard>[0]> = {}) {
  const props = {
    ex: EX,
    contribution: [{ label: 'Hát', sets: 4, color: 'var(--tag-gym)' }],
    canMoveUp: true,
    canMoveDown: true,
    onChange: vi.fn(),
    onMove: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  }
  render(<ExerciseCard {...props} />)
  return props
}

describe('ExerciseCard', () => {
  test('shows every value inline — no accordion to open', () => {
    setup()
    expect(screen.getByRole('spinbutton', { name: 'Munkaszettek' })).toHaveValue(4)
    expect(screen.getByRole('spinbutton', { name: 'Rep minimum' })).toHaveValue(8)
    expect(screen.getByRole('spinbutton', { name: 'Rep maximum' })).toHaveValue(10)
    expect(screen.getByRole('spinbutton', { name: 'Kiinduló súly (kg)' })).toHaveValue(84)
    expect(screen.getByRole('spinbutton', { name: 'Cél RIR' })).toHaveValue(1)
    expect(screen.getByRole('spinbutton', { name: 'Bemelegítő szettek' })).toHaveValue(1)
    // the retired disclosure must not come back
    expect(screen.queryByText('Finomhangolás')).not.toBeInTheDocument()
  })

  test('typing a set count patches workingSets', async () => {
    const user = userEvent.setup()
    const props = setup()
    const input = screen.getByRole('spinbutton', { name: 'Munkaszettek' })
    await user.clear(input)
    await user.type(input, '6')
    expect(props.onChange).toHaveBeenLastCalledWith({ workingSets: 6 })
  })

  test('an emptied weight field patches null, not zero', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.clear(screen.getByRole('spinbutton', { name: 'Kiinduló súly (kg)' }))
    expect(props.onChange).toHaveBeenLastCalledWith({ anchorWeightKg: null })
  })

  test('the Failure/Volume toggle rewrites targetRIR', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: /Volume/ }))
    expect(props.onChange).toHaveBeenLastCalledWith({ targetRIR: 2 })
  })

  test('the arrows move the card and are disabled at the ends', () => {
    const props = setup({ canMoveUp: false })
    expect(screen.getByRole('button', { name: 'Döntött evezés feljebb' })).toBeDisabled()
    const down = screen.getByRole('button', { name: 'Döntött evezés lejjebb' })
    down.click()
    expect(props.onMove).toHaveBeenCalledWith(1)
  })

  test('the × removes and the contribution line names the muscles', () => {
    const props = setup()
    screen.getByRole('button', { name: 'Döntött evezés törlése' }).click()
    expect(props.onRemove).toHaveBeenCalled()
    expect(screen.getByText('Hát +4')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/components/ExerciseCard.test.tsx`
Expected: FAIL — `Failed to resolve import "@/features/train/components/ExerciseCard"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/train/components/ExerciseCard.tsx`:

```tsx
// ============================================================
// Mezo · ExerciseCard — a mezo-szerkesztő gyakorlat-kártyája (mezo-yty6).
// Az ExerciseAccordionRow utódja az ÚJ szerkesztőben: nincs nyitogatás és
// nincsenek stepper-gombok — szett / rep-ablak / kiinduló súly / RIR / bemelegítő
// mind egyszerre látszik és közvetlenül írható. A régi „Finomhangolás"
// disclosure megszűnt: a RIR a fő sorba került.
// Az ExerciseAccordionRow ÉL TOVÁBB — a futó mezo napi szerkesztőjét
// (MesoExercises → MesoDayPage) az a felület szolgálja ki, ami e körnek non-goalja.
// ============================================================
import { MUSCLE_LABELS } from '@/data/train/train'
import type { GymExercise } from '@/data/types'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { setStyle } from '@/features/train/logic/setBudget'
import { ClayIcon } from '@/shared/ui/clay'

/** targetRIR values the two style buttons write — mirrors ExerciseAccordionRow's toggle. */
const FAILURE_RIR = 0
const VOLUME_RIR = 2

interface ExerciseCardProps {
  ex: GymExercise
  /** Muscle groups this exercise feeds, for the card's context line. */
  contribution: { label: string; sets: number; color: string }[]
  canMoveUp: boolean
  canMoveDown: boolean
  onChange: (patch: Partial<GymExercise>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}

function NumField({ label, value, min, max, step, placeholder, onCommit }: {
  label: string
  value: number | null
  min: number
  max: number
  step?: number
  placeholder?: string
  onCommit: (v: number | null) => void
}) {
  return (
    <label className="mz-exc-fld">
      <span>{label}</span>
      <input
        type="number"
        inputMode={step && step < 1 ? 'decimal' : 'numeric'}
        aria-label={label}
        className="mz-exc-num"
        value={value === null ? '' : value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') { onCommit(null); return }
          const n = Number(raw)
          if (Number.isNaN(n)) return
          onCommit(Math.min(max, Math.max(min, n)))
        }}
      />
    </label>
  )
}

export function ExerciseCard({
  ex, contribution, canMoveUp, canMoveDown, onChange, onMove, onRemove,
}: ExerciseCardProps) {
  const fam = muscleColor(ex.muscle)
  const isFailure = setStyle(ex.targetRIR) === 'failure'

  return (
    <div className="mz-exc" style={{ background: fam.wash, borderLeftColor: fam.rail }}>
      <div className="mz-exc-head">
        <span className="mz-exc-ico" aria-hidden="true">
          <ClayIcon name="i-suly" size={17} />
        </span>
        <span className="mz-grow" style={{ minWidth: 0 }}>
          <span className="mz-exc-nm">{ex.name}</span>
          <span className="mz-exc-sub">{MUSCLE_LABELS[ex.muscle] ?? ex.muscle}</span>
        </span>
        <span className="mz-exc-mv">
          <button
            type="button"
            aria-label={`${ex.name} feljebb`}
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
          >
            ▲
          </button>
          <button
            type="button"
            aria-label={`${ex.name} lejjebb`}
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
          >
            ▼
          </button>
        </span>
        <button type="button" className="mz-exc-del" aria-label={`${ex.name} törlése`} onClick={onRemove}>
          ✕
        </button>
      </div>

      <div className="mz-exc-row">
        <NumField label="Munkaszettek" value={ex.workingSets} min={1} max={10}
          onCommit={(v) => onChange({ workingSets: v ?? 1 })} />
        <label className="mz-exc-fld mz-exc-reps">
          <span>Rep</span>
          <span className="mz-exc-pair">
            <input
              type="number" inputMode="numeric" aria-label="Rep minimum" className="mz-exc-num"
              value={ex.repMin} min={1} max={50}
              onChange={(e) => e.target.value !== '' && onChange({ repMin: Math.min(50, Math.max(1, Number(e.target.value))) })}
            />
            <i aria-hidden="true">–</i>
            <input
              type="number" inputMode="numeric" aria-label="Rep maximum" className="mz-exc-num"
              value={ex.repMax} min={1} max={50}
              onChange={(e) => e.target.value !== '' && onChange({ repMax: Math.min(50, Math.max(1, Number(e.target.value))) })}
            />
          </span>
        </label>
        <NumField label="Kiinduló súly (kg)" value={ex.anchorWeightKg ?? null} min={0} max={500} step={2.5}
          placeholder="auto" onCommit={(v) => onChange({ anchorWeightKg: v })} />
        <NumField label="Cél RIR" value={ex.targetRIR} min={0} max={4}
          onCommit={(v) => onChange({ targetRIR: v ?? 0 })} />
      </div>

      <div className="mz-exc-row2">
        <span className="mz-exc-fv">
          <button
            type="button" aria-pressed={isFailure} className={isFailure ? 'on fire' : undefined}
            onClick={() => onChange({ targetRIR: FAILURE_RIR })}
          >
            🔥 Failure
          </button>
          <button
            type="button" aria-pressed={!isFailure} className={!isFailure ? 'on leaf' : undefined}
            onClick={() => onChange({ targetRIR: VOLUME_RIR })}
          >
            🌿 Volume
          </button>
        </span>
        <NumField label="Bemelegítő szettek" value={ex.warmupSets} min={0} max={5}
          onCommit={(v) => onChange({ warmupSets: v ?? 0 })} />
      </div>

      <div className="mz-exc-ctx">
        Hozzájárulás ·{' '}
        {contribution.map((c) => (
          <b key={c.label} style={{ color: c.color }}>{c.label} +{c.sets}</b>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add the stylesheet block**

Append to the **end** of `frontend/src/styles/prototype.css`:

```css
/* ===== mezo-szerkesztő · gyakorlat-kártya (mezo-yty6) ===== */
.mz-exc { border-radius: 15px; margin-bottom: 8px; padding: 9px 11px 10px;
  border: 0.5px solid var(--border-subtle); border-left: 5px solid var(--coral);
  box-shadow: 0 12px 22px -14px rgba(43, 33, 24, 0.28); }
.mz-exc-head { display: flex; align-items: center; gap: 7px; }
.mz-exc-ico { width: 30px; height: 30px; border-radius: 50%; flex: none; display: grid;
  place-items: center; background: color-mix(in srgb, var(--surface-1) 85%, transparent); }
.mz-exc-nm { display: block; font-size: 12px; font-weight: 700; }
.mz-exc-sub { display: block; font-size: 9px; color: var(--mz-ink-soft); }
.mz-exc-mv { display: flex; gap: 3px; flex: none; }
.mz-exc-mv button { width: 22px; height: 22px; border-radius: 7px; padding: 0; line-height: 1;
  border: 1px solid var(--border-subtle); background: var(--surface-1);
  font-size: 9px; color: var(--text-secondary); cursor: pointer; }
.mz-exc-mv button:disabled { opacity: 0.3; cursor: default; }
.mz-exc-del { flex: none; border: none; background: none; padding: 2px 5px;
  font-size: 12px; font-weight: 700; color: var(--coral-deep); cursor: pointer; }
.mz-exc-row { display: grid; grid-template-columns: 0.9fr 1.7fr 1.1fr 0.8fr; gap: 5px; margin-top: 8px; }
.mz-exc-row > * { min-width: 0; }
.mz-exc-row2 { display: flex; align-items: flex-end; gap: 6px; margin-top: 7px; }
.mz-exc-fld { display: block; background: color-mix(in srgb, var(--surface-1) 72%, transparent);
  border-radius: 11px; padding: 5px 5px 6px; min-width: 0; }
.mz-exc-fld > span { display: block; margin-bottom: 3px; white-space: nowrap;
  font-size: 7px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--mz-ink-mut); }
.mz-exc-num { width: 100%; min-width: 0; border-radius: 8px; padding: 4px 1px; text-align: center;
  border: 1px solid var(--border-subtle); background: var(--surface-1);
  font-family: inherit; font-size: 10.5px; font-weight: 700; font-variant-numeric: tabular-nums;
  color: inherit; -moz-appearance: textfield; appearance: textfield; }
.mz-exc-num::-webkit-outer-spin-button,
.mz-exc-num::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.mz-exc-pair { display: flex; align-items: center; gap: 3px; }
.mz-exc-pair i { flex: none; font-style: normal; font-size: 10px; color: var(--mz-ink-mut); }
.mz-exc-fv { display: flex; gap: 4px; flex: 1; }
.mz-exc-fv button { flex: 1; border: none; border-radius: 9px; padding: 5px 0;
  background: var(--surface-2); color: var(--text-secondary);
  font-family: inherit; font-size: 8.5px; font-weight: 700; cursor: pointer; }
.mz-exc-fv button.on.fire { background: var(--gradient-cta); color: var(--text-inverse); }
.mz-exc-fv button.on.leaf { background: var(--sage-deep); color: var(--text-inverse); }
.mz-exc-row2 .mz-exc-fld { flex: none; }
.mz-exc-row2 .mz-exc-num { width: 34px; }
.mz-exc-ctx { margin-top: 7px; font-size: 8.5px; color: var(--mz-ink-soft);
  font-variant-numeric: tabular-nums; }
.mz-exc-ctx b + b::before { content: ' · '; color: var(--mz-ink-mut); font-weight: 400; }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/components/ExerciseCard.test.tsx src/shared/ui/mozaik/prototypeCssStructure.test.ts`
Expected: PASS — 6 + CSS-guard tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/components/ExerciseCard.tsx frontend/src/features/train/components/ExerciseCard.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(train): always-open ExerciseCard with inline number fields (mezo-yty6)"
```

---

### Task 4: `LoadTile` + `DayStripTile` — a kompakt csempék

Két apró presentational csempe: a terhelés-oldalak belépője (nagy szám + 3 mini-gauge) és a vízszintesen görgethető nap-csempesor eleme.

**Files:**
- Create: `frontend/src/features/train/components/LoadTile.tsx`
- Create: `frontend/src/features/train/components/DayStripTile.tsx`
- Test: `frontend/src/features/train/components/LoadTile.test.tsx`
- Test: `frontend/src/features/train/components/DayStripTile.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (a fájl végére)

**Interfaces:**
- Consumes: `useCountUpOnChange` (`@/shared/ui/mozaik/motion`).
- Produces:
  - `interface LoadGauge { label: string; value: number; max: number; color: string; warn?: boolean }`
  - `function LoadTile(props: { tone: 'day' | 'week'; eyebrow: string; value: number; unit: string; gauges: LoadGauge[]; flagged?: boolean; onOpen: () => void }): JSX.Element`
  - `interface DayStripMuscle { label: string; sets: number; color: string }`
  - `function DayStripTile(props: { day: string; type: string; name: string; sets: number; minutes: number; muscles: DayStripMuscle[]; tone: 'coral' | 'sage' | 'rose' | 'gold'; flagged?: boolean; onOpen: () => void }): JSX.Element`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/features/train/components/LoadTile.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { LoadTile } from '@/features/train/components/LoadTile'

const GAUGES = [
  { label: 'Hát', value: 7, max: 8, color: 'var(--tag-gym)', warn: true },
  { label: 'Váll', value: 4, max: 8, color: 'var(--lav-deep)' },
]

describe('LoadTile', () => {
  test('renders the headline number, unit and one gauge per muscle', () => {
    render(<LoadTile tone="day" eyebrow="Napi terhelés · Hét" value={13} unit="szett · ~57′" gauges={GAUGES} onOpen={vi.fn()} />)
    expect(screen.getByText('Napi terhelés · Hét')).toBeInTheDocument()
    expect(screen.getByText('13')).toBeInTheDocument()
    expect(screen.getByText('szett · ~57′')).toBeInTheDocument()
    expect(screen.getByText('Hát')).toBeInTheDocument()
    expect(screen.getByText('Váll')).toBeInTheDocument()
  })

  test('opens on click', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<LoadTile tone="week" eyebrow="Heti terhelés" value={46} unit="szett · W1" gauges={GAUGES} onOpen={onOpen} />)
    await user.click(screen.getByRole('button', { name: /Heti terhelés/ }))
    expect(onOpen).toHaveBeenCalled()
  })

  test('a flagged tile carries an amber dot', () => {
    const { container } = render(
      <LoadTile tone="week" eyebrow="Heti terhelés" value={46} unit="szett" gauges={GAUGES} flagged onOpen={vi.fn()} />,
    )
    expect(container.querySelector('.mz-lt-dot')).toBeInTheDocument()
  })
})
```

Create `frontend/src/features/train/components/DayStripTile.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { DayStripTile } from '@/features/train/components/DayStripTile'

const MUSCLES = [
  { label: 'Hát', sets: 7, color: 'var(--tag-gym)' },
  { label: 'Váll', sets: 3, color: 'var(--lav-deep)' },
]

describe('DayStripTile', () => {
  test('shows the day, name and the set/minute meta', () => {
    render(<DayStripTile day="Hét" type="Upper" name="Upper" sets={13} minutes={57} muscles={MUSCLES} tone="coral" onOpen={vi.fn()} />)
    expect(screen.getByText('Hét · Upper')).toBeInTheDocument()
    expect(screen.getByText('Upper')).toBeInTheDocument()
    expect(screen.getByText('13 szett · ~57′')).toBeInTheDocument()
  })

  test('opens the day on click, named for screen readers', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<DayStripTile day="Hét" type="Upper" name="Upper" sets={13} minutes={57} muscles={MUSCLES} tone="coral" onOpen={onOpen} />)
    await user.click(screen.getByRole('button', { name: 'Hét · Upper · szerkesztés' }))
    expect(onOpen).toHaveBeenCalled()
  })

  test('a flagged day carries an amber dot', () => {
    const { container } = render(
      <DayStripTile day="Kedd" type="Push" name="Push" sets={9} minutes={40} muscles={MUSCLES} tone="rose" flagged onOpen={vi.fn()} />,
    )
    expect(container.querySelector('.mz-dst-dot')).toBeInTheDocument()
  })

  test('the muscle rail is proportional to the sets', () => {
    const { container } = render(
      <DayStripTile day="Hét" type="Upper" name="Upper" sets={10} minutes={44} muscles={MUSCLES} tone="coral" onOpen={vi.fn()} />,
    )
    const rails = container.querySelectorAll('.mz-dst-rail i')
    expect(rails).toHaveLength(2)
    expect((rails[0] as HTMLElement).style.flexGrow).toBe('7')
    expect((rails[1] as HTMLElement).style.flexGrow).toBe('3')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/components/LoadTile.test.tsx src/features/train/components/DayStripTile.test.tsx`
Expected: FAIL — both imports unresolved.

- [ ] **Step 3: Write the implementations**

Create `frontend/src/features/train/components/LoadTile.tsx`:

```tsx
// ============================================================
// Mezo · LoadTile — a Heti / Napi terhelés-oldal kompakt belépő csempéje
// (mezo-yty6): nagy count-up szám + a három legnagyobb izom mini-gauge-a.
// A hetit a szerkesztő, a napit a nap-szerkesztő hordja — a csempe maga a gomb.
// ============================================================
import { useCountUpOnChange } from '@/shared/ui/mozaik/motion'

export interface LoadGauge {
  label: string
  value: number
  /** The bar's denominator: the session cap (day) or the group's MRV (week). */
  max: number
  color: string
  /** Amber treatment — at or near the session cap. */
  warn?: boolean
}

interface LoadTileProps {
  tone: 'day' | 'week'
  eyebrow: string
  value: number
  /** Small print after the headline number, e.g. "szett · ~57′". */
  unit: string
  gauges: LoadGauge[]
  /** A lint touches this scope — amber dot. */
  flagged?: boolean
  onOpen: () => void
}

export function LoadTile({ tone, eyebrow, value, unit, gauges, flagged, onOpen }: LoadTileProps) {
  const shown = useCountUpOnChange(value)
  return (
    <button type="button" className={`mz-lt mz-lt-${tone}`} onClick={onOpen}>
      <span className="mz-lt-head">
        <span className="mz-lt-eyebrow mz-grow">{eyebrow}</span>
        {flagged && <span className="mz-lt-dot" aria-hidden="true" />}
        <span className="mz-lt-chev" aria-hidden="true">›</span>
      </span>
      <span className="mz-lt-body">
        <span className="mz-lt-big">
          {shown}
          <small>{unit}</small>
        </span>
        <span className="mz-lt-gauges">
          {gauges.map((g) => (
            <span className="mz-lt-g" key={g.label}>
              <span style={{ color: g.color }}>{g.label}</span>
              <span className="bar">
                <span
                  style={{
                    display: 'block', height: '100%', borderRadius: 3,
                    width: `${Math.min(100, Math.round((g.value / g.max) * 100))}%`,
                    background: g.warn ? 'var(--amber-deep)' : g.color,
                  }}
                />
              </span>
              <span className="n">{g.value}</span>
            </span>
          ))}
        </span>
      </span>
    </button>
  )
}
```

Create `frontend/src/features/train/components/DayStripTile.tsx`:

```tsx
// ============================================================
// Mezo · DayStripTile — a szerkesztő vízszintesen görgethető nap-csempesorának
// egy csempéje (mezo-yty6). A wizard régi 2-oszlopos DayTile-mozaikját váltja:
// fix szélesség, scroll-snap, arányos izom-sáv, borostyán pötty ha a napot
// lint érinti. Koppintásra a nap saját szerkesztője nyílik.
// ============================================================
export interface DayStripMuscle {
  label: string
  sets: number
  color: string
}

interface DayStripTileProps {
  /** Weekday key ('Hét'…'Vas'). */
  day: string
  /** Split type from the generator ('Upper', 'Push'…) — the eyebrow's second half. */
  type: string
  /** The (renameable) day name shown big. */
  name: string
  sets: number
  minutes: number
  muscles: DayStripMuscle[]
  tone: 'coral' | 'sage' | 'rose' | 'gold'
  flagged?: boolean
  onOpen: () => void
}

export function DayStripTile({
  day, type, name, sets, minutes, muscles, tone, flagged, onOpen,
}: DayStripTileProps) {
  return (
    <button
      type="button"
      className={`mz-dst mz-dst-${tone}`}
      aria-label={`${day} · ${name} · szerkesztés`}
      onClick={onOpen}
    >
      {flagged && <span className="mz-dst-dot" aria-hidden="true" />}
      <span className="mz-dst-tt">{day} · {type}</span>
      <span className="mz-dst-nm">{name}</span>
      <span className="mz-dst-meta">{sets} szett · ~{minutes}′</span>
      <span className="mz-dst-rail">
        {muscles.map((m) => (
          <i key={m.label} style={{ flexGrow: m.sets, background: m.color }} />
        ))}
      </span>
    </button>
  )
}
```

- [ ] **Step 4: Add the stylesheet block**

Append to the **end** of `frontend/src/styles/prototype.css`:

```css
/* ===== mezo-szerkesztő · kompakt csempék (mezo-yty6) ===== */
.mz-lt { display: block; width: 100%; text-align: left; font-family: inherit; cursor: pointer;
  border-radius: 17px; padding: 10px 11px; border: 0.5px solid var(--border-subtle);
  box-shadow: 0 14px 26px -14px rgba(43, 33, 24, 0.28);
  transition: transform 0.15s cubic-bezier(0.3, 0.8, 0.4, 1.4); }
.mz-lt:active { transform: scale(0.98); }
.mz-lt-day { background: var(--mz-wash-coral); }
.mz-lt-week { background: var(--mz-wash-gold); }
.mz-lt-head { display: flex; align-items: center; gap: 6px; }
.mz-lt-eyebrow { font-size: 9px; font-weight: 700; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--mz-ink-mut); }
.mz-lt-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--amber-deep); }
.mz-lt-chev { flex: none; font-size: 11px; color: var(--mz-ink-mut); }
.mz-lt-body { display: flex; align-items: flex-end; gap: 12px; }
.mz-lt-big { flex: none; margin-top: 3px; font-size: 20px; font-weight: 200;
  letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.mz-lt-big small { margin-left: 3px; font-size: 9px; font-weight: 600; color: var(--mz-ink-soft); }
.mz-lt-gauges { flex: 1; min-width: 0; display: grid; gap: 4px; }
.mz-lt-g { display: grid; grid-template-columns: 34px 1fr 22px; align-items: center; gap: 5px;
  font-size: 7.5px; font-weight: 700; }
.mz-lt-g .bar { display: block; height: 5px; border-radius: 3px; overflow: hidden;
  background: var(--mz-gbar-bg); }
.mz-lt-g .n { text-align: right; font-variant-numeric: tabular-nums; color: var(--mz-ink-soft); }

.mz-dayrow { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none;
  margin: 0 -2px; padding: 2px 2px 8px; scroll-snap-type: x proximity; }
.mz-dayrow::-webkit-scrollbar { display: none; }
.mz-dst { position: relative; flex: none; width: 124px; scroll-snap-align: start;
  text-align: left; font-family: inherit; cursor: pointer;
  border-radius: 15px; padding: 9px 10px 10px; border: 0.5px solid var(--border-subtle);
  background: var(--mz-wash-coral);
  box-shadow: 0 12px 22px -14px rgba(43, 33, 24, 0.28);
  transition: transform 0.15s cubic-bezier(0.3, 0.8, 0.4, 1.4); }
.mz-dst:active { transform: scale(0.96); }
.mz-dst-sage { background: var(--mz-wash-sage); }
.mz-dst-rose { background: var(--mz-wash-rose); }
.mz-dst-gold { background: var(--mz-wash-gold); }
.mz-dst-dot { position: absolute; top: 8px; right: 9px; width: 7px; height: 7px;
  border-radius: 50%; background: var(--amber-deep); }
.mz-dst-tt { display: block; font-size: 7.5px; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--mz-ink-mut); }
.mz-dst-nm { display: block; font-size: 14px; font-weight: 700; line-height: 1.15; }
.mz-dst-meta { display: block; margin-top: 4px; font-size: 8.5px; color: var(--mz-ink-soft);
  font-variant-numeric: tabular-nums; }
.mz-dst-rail { display: flex; height: 6px; margin-top: 7px; border-radius: 3px;
  overflow: hidden; background: var(--mz-gbar-bg); }
.mz-dst-rail i { display: block; }
@media (prefers-reduced-motion: reduce) {
  .mz-lt, .mz-dst { transition: none; }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/components/LoadTile.test.tsx src/features/train/components/DayStripTile.test.tsx src/shared/ui/mozaik/prototypeCssStructure.test.ts`
Expected: PASS — 3 + 4 + CSS-guard tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/components/LoadTile.tsx frontend/src/features/train/components/LoadTile.test.tsx frontend/src/features/train/components/DayStripTile.tsx frontend/src/features/train/components/DayStripTile.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(train): compact load tile + horizontal day strip tile (mezo-yty6)"
```

---

### Task 5: `DayLoadPanel` — a Napi terhelés teljes oldala

A napi drawer helyett teljes Mozaik-oldal: hero count-up szettszámmal, statstrip, majd izomcsoportonként egy poszter-kártya session-cap sávval és a hozzájáruló gyakorlatok chipjeivel.

**Files:**
- Create: `frontend/src/features/train/components/DayLoadPanel.tsx`
- Test: `frontend/src/features/train/components/DayLoadPanel.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (a fájl végére)

**Interfaces:**
- Consumes: `dayMuscleLoad` (Task 1), `muscleColor`, `MozaikPage`/`PageHead`/`PageHero`/`PageBody`/`StatStrip`/`StatCell`/`PageTone` (`@/shared/ui/mozaik`), `EntranceGroup` (`@/shared/ui/mozaik/motion`), `dayTone` (`@/features/train/wizard/dayTiles`).
- Produces: `function DayLoadPanel(props: { day: MesoDay; minutes: number; onBack: () => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/train/components/DayLoadPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { DayLoadPanel } from '@/features/train/components/DayLoadPanel'

function ex(id: string, name: string, muscle: string, workingSets: number): GymExercise {
  return { id, name, muscle, warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR: 1, anchorWeightKg: null, type: 'strength' }
}

const DAY: MesoDay = {
  day: 'Hét', type: 'Upper', muscle: 'back', exerciseCount: 3,
  exercises: [ex('a', 'Evezés', 'back', 7), ex('b', 'Pulldown', 'back', 2), ex('c', 'Press', 'shoulder', 3)],
}

describe('DayLoadPanel', () => {
  test('the hero carries the day and its totals', () => {
    render(<DayLoadPanel day={DAY} minutes={53} onBack={vi.fn()} />)
    expect(screen.getByText('Napi terhelés · Hét · Upper')).toBeInTheDocument()
    expect(screen.getByText('szett · ~53 perc · 3 gyakorlat')).toBeInTheDocument()
  })

  test('one card per muscle group, sets desc, with the cap denominator', () => {
    render(<DayLoadPanel day={DAY} minutes={53} onBack={vi.fn()} />)
    const cards = screen.getAllByTestId('day-load-card')
    expect(cards.map((c) => c.getAttribute('data-group'))).toEqual(['back', 'shoulder'])
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getAllByText('/ ~8')).toHaveLength(2)
  })

  test('a group over the cap is called out', () => {
    render(<DayLoadPanel day={DAY} minutes={53} onBack={vi.fn()} />)
    expect(screen.getByText('a plafon fölött')).toBeInTheDocument()
  })

  test('each card lists the exercises behind the number', () => {
    render(<DayLoadPanel day={DAY} minutes={53} onBack={vi.fn()} />)
    expect(screen.getByText('Evezés +7')).toBeInTheDocument()
    expect(screen.getByText('Pulldown +2')).toBeInTheDocument()
    expect(screen.getByText('Press +3')).toBeInTheDocument()
  })

  test('back closes the panel', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(<DayLoadPanel day={DAY} minutes={53} onBack={onBack} />)
    await user.click(screen.getByRole('button', { name: '‹ Upper' }))
    expect(onBack).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/components/DayLoadPanel.test.tsx`
Expected: FAIL — import unresolved.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/train/components/DayLoadPanel.tsx`:

```tsx
// ============================================================
// Mezo · DayLoadPanel — a Napi terhelés SAJÁT OLDALA (mezo-yty6). Az első
// prototípus-kör alsó drawere helyett teljes Mozaik-oldal: szűk volt a bontásnak.
// Oldal-ÁLLAPOT, nem route (ProgramDayView idiom) — a még nem mentett vázlat
// így éli túl a be-/kilépést. Izmonként egy poszter-kártya a ~8 szett/edzés
// session-cap ellen, a hozzájáruló gyakorlatokkal.
// ============================================================
import type { MesoDay } from '@/data/types'
import { dayMuscleLoad } from '@/features/train/logic/mesoLoad'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { dayTone } from '@/features/train/wizard/dayTiles'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip, type PageTone } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

const TONE: Record<string, PageTone> = { coral: 'coral', sage: 'sage', rose: 'rose', gold: 'gold' }

interface DayLoadPanelProps {
  day: MesoDay
  /** Estimated session minutes — computed by the caller (pages own the timing profile). */
  minutes: number
  onBack: () => void
}

export function DayLoadPanel({ day, minutes, onBack }: DayLoadPanelProps) {
  const rows = dayMuscleLoad(day)
  const sets = day.exercises.reduce((a, e) => a + e.workingSets, 0)
  const flagged = rows.filter((r) => r.nearCap || r.over).length

  return (
    <MozaikPage tone={TONE[dayTone(day.type)] ?? 'coral'}>
      <PageHead onBack={onBack} label={`‹ ${day.type}`} />
      <EntranceGroup>
        <PageHero
          icon="i-edzes"
          big={sets}
          name={`Napi terhelés · ${day.day} · ${day.type}`}
          sub={`szett · ~${minutes} perc · ${day.exercises.length} gyakorlat`}
        />
        <PageBody principle="A plafon nem tiltás — ha átléped, a modell átosztást javasol egy másik napra.">
          <div className="rise" style={{ marginBottom: 11 }}>
            <StatStrip>
              <StatCell value={sets} label="szett" />
              <StatCell value={`~${minutes}`} label="perc" />
              <StatCell value={rows.length} label="izomcsoport" />
              <StatCell value={flagged || '✓'} label="plafon-közel" over={flagged > 0} />
            </StatStrip>
          </div>
          <div className="mz-eyebrow rise" style={{ padding: '0 2px 6px' }}>
            Izmonként · a ~{rows[0]?.cap ?? 8} szett/edzés plafon ellen
          </div>
          {rows.map((r, i) => {
            const fam = muscleColor(r.colorMuscle)
            const amber = r.nearCap || r.over
            return (
              <div
                key={r.group}
                data-testid="day-load-card"
                data-group={r.group}
                className="mz-lcard rise"
                style={{ background: fam.wash, ['--d' as string]: `${90 + i * 60}ms` }}
              >
                <div className="mz-lcard-head">
                  <span className="mz-lcard-pill" style={{ background: fam.wash, color: fam.deep }}>{r.label}</span>
                  {r.over && <span className="mz-lcard-flag">a plafon fölött</span>}
                  {!r.over && r.nearCap && <span className="mz-lcard-flag">közel a plafonhoz</span>}
                  <span className="mz-grow" />
                  <span className="mz-lcard-num" style={{ color: fam.deep }}>
                    {r.sets}<small>/ ~{r.cap}</small>
                  </span>
                </div>
                <div className="mz-lcard-bar">
                  <span
                    style={{
                      display: 'block', height: '100%', borderRadius: 5,
                      width: `${Math.min(100, Math.round((r.sets / r.cap) * 100))}%`,
                      background: amber ? 'var(--amber-deep)' : fam.deep,
                    }}
                  />
                </div>
                <div className="mz-lcard-chips">
                  {r.exercises.map((e) => (
                    <span className="mz-lcard-chip" key={e.exerciseId}>{e.name} +{e.sets}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
```

- [ ] **Step 4: Add the stylesheet block**

Append to the **end** of `frontend/src/styles/prototype.css`:

```css
/* ===== mezo-szerkesztő · terhelés-oldalak poszter-kártyája (mezo-yty6) ===== */
.mz-lcard { border-radius: 17px; padding: 10px 12px; margin-bottom: 9px;
  border: 0.5px solid var(--border-subtle);
  box-shadow: 0 14px 26px -14px rgba(43, 33, 24, 0.28); }
.mz-lcard-head { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.mz-lcard-pill { flex: none; border-radius: 999px; padding: 3px 10px;
  font-size: 9.5px; font-weight: 700; }
.mz-lcard-flag { flex: none; border-radius: 999px; padding: 2px 8px; font-size: 8px; font-weight: 700;
  background: var(--mz-cell-gold-bg); color: var(--mz-cell-gold-ink); }
.mz-lcard-num { flex: none; font-size: 19px; font-weight: 200; letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums; white-space: nowrap; }
.mz-lcard-num small { margin-left: 3px; font-size: 9px; font-weight: 600; color: var(--mz-ink-soft); }
.mz-lcard-bar { height: 9px; margin-top: 6px; border-radius: 5px; overflow: hidden;
  background: var(--mz-gbar-bg); }
.mz-lcard-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
.mz-lcard-chip { border-radius: 999px; padding: 3px 9px; font-size: 8.5px; font-weight: 700;
  background: var(--surface-2); color: var(--text-secondary); }
.mz-lcard-stat { font-size: 8.5px; font-weight: 700; }
.mz-lcard-body { display: none; margin-top: 7px; padding-top: 6px;
  border-top: 0.5px solid var(--border-subtle); }
.mz-lcard.open .mz-lcard-body { display: block; }
.mz-lcard-cline { display: flex; align-items: flex-start; gap: 7px; padding: 4px 0; font-size: 9px; }
.mz-lcard-cline > b { flex: none; width: 30px; color: var(--mz-ink-soft); }
.mz-lcard-freq { flex: none; border-radius: 999px; padding: 2px 7px; font-size: 8px; font-weight: 700;
  background: var(--surface-2); color: var(--text-secondary); }
```

(Az `.mz-lcard-stat` / `.mz-lcard-body` / `.mz-lcard-cline` / `.mz-lcard-freq` szabályokat a Task 6 heti oldala használja — egy blokkban tartva, hogy a kártya-család együtt olvasható maradjon.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/components/DayLoadPanel.test.tsx src/shared/ui/mozaik/prototypeCssStructure.test.ts`
Expected: PASS — 5 + CSS-guard tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/components/DayLoadPanel.tsx frontend/src/features/train/components/DayLoadPanel.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(train): DayLoadPanel full-page session-cap breakdown (mezo-yty6)"
```

---

### Task 6: `WeekLoadPanel` — a Heti terhelés teljes oldala

Izmonként poszter-kártya: tier-chip, frekvencia, `13 ▲ 22 cél` számsor, `ZoneBar`, és koppintásra a napokra bontott hozzájárulás. Alul a lint-sorok.

**Files:**
- Create: `frontend/src/features/train/components/WeekLoadPanel.tsx`
- Test: `frontend/src/features/train/components/WeekLoadPanel.test.tsx`

**Interfaces:**
- Consumes: `weekMuscleLoad`, `adjacentDayConflicts`, `Landmark` (Task 1); `ZoneBar` (Task 2); `TIER_LABELS` (`@/features/train/logic/musclePriorities`); `muscleColor`; mozaik kit.
- Produces: `function WeekLoadPanel(props: { days: MesoDay[]; priorities?: MusclePriorities | null; volumePerMuscle?: Record<string, Landmark> | null; onBack: () => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/train/components/WeekLoadPanel.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { WeekLoadPanel } from '@/features/train/components/WeekLoadPanel'

function ex(id: string, name: string, muscle: string, workingSets: number): GymExercise {
  return { id, name, muscle, warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR: 1, anchorWeightKg: null, type: 'strength' }
}
function day(dayKey: string, type: string, exercises: GymExercise[], muscle = 'back'): MesoDay {
  return { day: dayKey, type, muscle, exerciseCount: exercises.length, exercises }
}

const WEEK: MesoDay[] = [
  day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 6), ex('b', 'Press', 'shoulder', 3)]),
  day('Kedd', 'Push', [ex('c', 'Oldalemelés', 'shoulder', 4)], 'shoulder'),
]

describe('WeekLoadPanel', () => {
  test('one card per muscle, sorted by weekly sets descending', () => {
    render(<WeekLoadPanel days={WEEK} onBack={vi.fn()} />)
    const cards = screen.getAllByTestId('week-load-card')
    expect(cards.map((c) => c.getAttribute('data-group'))).toEqual(['shoulder', 'back'])
  })

  test('each card shows the tier, the frequency and the direction toward the target', () => {
    render(<WeekLoadPanel days={WEEK} priorities={{ back: 'emphasize' }} onBack={vi.fn()} />)
    const back = screen.getAllByTestId('week-load-card').find((c) => c.dataset.group === 'back')!
    expect(within(back).getByText('Emphasize')).toBeInTheDocument()
    expect(within(back).getByText('1 nap / hét')).toBeInTheDocument()
    // 6 sets toward the MRV target of 22
    expect(within(back).getByText('6')).toBeInTheDocument()
    expect(within(back).getByText('▲')).toBeInTheDocument()
    expect(within(back).getByText('22')).toBeInTheDocument()
  })

  test('percent is never rendered as text', () => {
    const { container } = render(<WeekLoadPanel days={WEEK} onBack={vi.fn()} />)
    expect(container.textContent).not.toMatch(/%/)
  })

  test('tapping a card reveals the day-by-day contribution', async () => {
    const user = userEvent.setup()
    render(<WeekLoadPanel days={WEEK} onBack={vi.fn()} />)
    const shoulder = screen.getAllByTestId('week-load-card').find((c) => c.dataset.group === 'shoulder')!
    expect(within(shoulder).queryByText('Oldalemelés +4')).not.toBeVisible()
    await user.click(within(shoulder).getByRole('button', { name: /Váll · lebontás/ }))
    expect(within(shoulder).getByText('Oldalemelés +4')).toBeVisible()
  })

  test('adjacent-day muscle overlap is reported as passive advice', () => {
    render(<WeekLoadPanel days={WEEK} onBack={vi.fn()} />)
    expect(screen.getByText(/Váll/)).toBeInTheDocument()
    expect(screen.getByText(/pihenőnap ajánlott/i)).toBeInTheDocument()
  })

  test('a conflict-free week says so instead of staying silent', () => {
    const clean = [day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 6)])]
    render(<WeekLoadPanel days={clean} onBack={vi.fn()} />)
    expect(screen.getByText(/Nincs egymást követő napi átfedés/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/components/WeekLoadPanel.test.tsx`
Expected: FAIL — import unresolved.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/train/components/WeekLoadPanel.tsx`:

```tsx
// ============================================================
// Mezo · WeekLoadPanel — a Heti terhelés SAJÁT OLDALA (mezo-yty6). Izmonként egy
// poszter-kártya: tier-chip + frekvencia, `most ▲ cél` számsor, ZoneBar a
// MEV/MAV/MRV zónákkal, és koppintásra a napokra bontott hozzájárulás — a
// „miért piros?" helyett „mit változtass?" (Liftosaur-minta, spec Prior art).
// Alul az egymást követő napok izom-átfedése: passzív tanács, sosem blokkol.
// ============================================================
import type { MesoDay, MusclePriorities } from '@/data/types'
import { ZoneBar } from '@/features/train/components/ZoneBar'
import { adjacentDayConflicts, weekMuscleLoad, type Landmark } from '@/features/train/logic/mesoLoad'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { TIER_LABELS } from '@/features/train/logic/musclePriorities'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useState } from 'react'

const ARROW = { up: '▲', down: '▼', hold: '=' } as const

interface WeekLoadPanelProps {
  days: MesoDay[]
  priorities?: MusclePriorities | null
  volumePerMuscle?: Record<string, Landmark> | null
  onBack: () => void
}

export function WeekLoadPanel({ days, priorities, volumePerMuscle, onBack }: WeekLoadPanelProps) {
  const rows = weekMuscleLoad(days, priorities ?? null, volumePerMuscle ?? null)
  const conflicts = adjacentDayConflicts(days)
  const [open, setOpen] = useState<string | null>(null)

  const total = rows.reduce((a, r) => a + r.sets, 0)
  const peak = rows.reduce((a, r) => a + Math.max(r.sets, r.target), 0)
  const moving = rows.filter((r) => r.direction !== 'hold').length

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={onBack} label="‹ A blokkod" />
      <EntranceGroup>
        <PageHero
          icon="i-meso"
          big={total}
          name="Heti terhelés · izmonként"
          sub={`szett · 1. hét · ${days.filter((d) => d.exercises.length > 0).length} edzésnap`}
        />
        <PageBody principle="Emphasize→MRV · Grow→MAV · Maintain→MEV. A sáv mutatja, hol állsz a zónákban — a jelzés borostyán, és sosem blokkol.">
          <div className="rise" style={{ marginBottom: 11 }}>
            <StatStrip>
              <StatCell value={total} label="szett · W1" />
              <StatCell value={peak} label="szett · csúcs" />
              <StatCell value={moving} label="mozog" />
              <StatCell value={rows.length - moving} label="célon" />
            </StatStrip>
          </div>
          <div className="mz-eyebrow rise" style={{ padding: '0 2px 6px' }}>
            Csökkenő sorrendben · a nyíl a tier-cél felé · koppints a lebontásért
          </div>

          {rows.map((r, i) => {
            const fam = muscleColor(r.colorMuscle)
            const expanded = open === r.group
            return (
              <div
                key={r.group}
                data-testid="week-load-card"
                data-group={r.group}
                className={`mz-lcard rise${expanded ? ' open' : ''}`}
                style={{ background: fam.wash, ['--d' as string]: `${90 + i * 70}ms` }}
              >
                <button
                  type="button"
                  className="mz-lcard-open"
                  aria-expanded={expanded}
                  aria-label={`${r.label} · lebontás`}
                  onClick={() => setOpen((cur) => (cur === r.group ? null : r.group))}
                >
                  <span className="mz-lcard-head">
                    <span className="mz-lcard-pill" style={{ background: fam.wash, color: fam.deep }}>{r.label}</span>
                    <span className="mz-tchip">{TIER_LABELS[r.tier]}</span>
                    <span className="mz-grow" />
                    <span className="mz-lcard-freq">{r.frequency} nap / hét</span>
                  </span>
                  <span className="mz-lcard-head" style={{ marginTop: 2 }}>
                    <span className="mz-lcard-num" style={{ color: fam.deep }}>
                      <b>{r.sets}</b> <i aria-hidden="true">{ARROW[r.direction]}</i> <b>{r.target}</b>
                      <small>cél</small>
                    </span>
                    <span className="mz-grow" />
                    <span className="mz-lcard-stat" style={{ color: r.direction === 'hold' ? 'var(--sage-deep)' : 'var(--amber-deep)' }}>
                      {r.direction === 'hold'
                        ? 'a célon'
                        : r.direction === 'up'
                          ? `még ${r.toTarget} szett a célig`
                          : `${r.toTarget} szettel a cél fölött`}
                    </span>
                  </span>
                  <ZoneBar landmark={r.landmark} value={r.sets} target={r.target} colorMuscle={r.colorMuscle} label={r.label} />
                </button>
                <div className="mz-lcard-body">
                  {r.contributions.map((c) => (
                    <div className="mz-lcard-cline" key={c.day}>
                      <b>{c.day}</b>
                      <span className="mz-lcard-chips" style={{ marginTop: 0 }}>
                        {c.exercises.map((e) => (
                          <span className="mz-lcard-chip" key={e.exerciseId}>{e.name} +{e.sets}</span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {conflicts.length > 0 ? conflicts.map((c) => (
            <div className="mz-lint rise" key={`${c.fromDay}-${c.toDay}`}>
              <span aria-hidden="true">⚠️</span>
              <span>
                <b>{c.groups.map((g) => g.label).join(' + ')}</b> egymást követő napokon
                ({c.fromDay} {c.fromType} → {c.toDay} {c.toType}) — pihenőnap ajánlott közéjük.
              </span>
            </div>
          )) : (
            <div className="mz-lint mz-lint-ok rise">
              <span aria-hidden="true">✓</span>
              <span><b>Nincs egymást követő napi átfedés</b> — minden izom kap pihenőt két edzés között.</span>
            </div>
          )}
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
```

- [ ] **Step 4: Add the stylesheet block**

Append to the **end** of `frontend/src/styles/prototype.css`:

```css
/* ===== mezo-szerkesztő · heti kártya + lint-sorok (mezo-yty6) ===== */
.mz-lcard-open { display: block; width: 100%; padding: 0; border: none; background: none;
  text-align: left; font-family: inherit; color: inherit; cursor: pointer; }
.mz-lcard-num b { font-weight: 200; }
.mz-lcard-num i { font-style: normal; font-size: 12px; }
.mz-tchip { flex: none; border-radius: 999px; padding: 2px 8px; font-size: 8px; font-weight: 700;
  background: var(--surface-2); color: var(--text-secondary); }
.mz-lint { display: flex; align-items: flex-start; gap: 8px; border-radius: 12px;
  padding: 8px 10px; margin-top: 6px; font-size: 9.5px; line-height: 1.45;
  background: var(--mz-cell-gold-bg); }
.mz-lint b { color: var(--mz-cell-gold-ink); }
.mz-lint-ok { background: var(--mz-cell-sage-bg); }
.mz-lint-ok b { color: var(--mz-cell-sage-ink); }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/components/WeekLoadPanel.test.tsx src/shared/ui/mozaik/prototypeCssStructure.test.ts`
Expected: PASS — 6 + CSS-guard tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/components/WeekLoadPanel.tsx frontend/src/features/train/components/WeekLoadPanel.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(train): WeekLoadPanel zone-bar weekly volume page (mezo-yty6)"
```

---

### Task 7: `MesoDayEditor` — a nap szerkesztője, villanás nélkül

Hero átnevezhető napnévvel, alatta a Napi terhelés csempe, majd a gyakorlat-kártyák. A belépő choreográfia **csak a nap első megnyitásakor** fut — szerkesztéskor nem játszik újra (ez konkrét prototípus-visszajelzés volt).

**Files:**
- Create: `frontend/src/features/train/components/MesoDayEditor.tsx`
- Test: `frontend/src/features/train/components/MesoDayEditor.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (a fájl végére)

**Interfaces:**
- Consumes: `ExerciseCard` (Task 3), `LoadTile` (Task 4), `DayLoadPanel` (Task 5), `dayMuscleLoad` (Task 1), `muscleColor`, `budgetGroup`/`BUDGET_GROUP_LABELS` (`@/features/train/logic/setBudget`), `dayTone`, mozaik kit.
- Produces: `function MesoDayEditor(props: { day: MesoDay; minutes: number; onBack: () => void; onRename: (name: string) => void; onChangeExercise: (exId: string, patch: Partial<GymExercise>) => void; onMoveExercise: (exId: string, dir: -1 | 1) => void; onRemoveExercise: (exId: string) => void; onAdd: () => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/train/components/MesoDayEditor.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { MesoDayEditor } from '@/features/train/components/MesoDayEditor'

function ex(id: string, name: string, muscle: string, workingSets: number): GymExercise {
  return { id, name, muscle, warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR: 1, anchorWeightKg: null, type: 'strength' }
}

const DAY: MesoDay = {
  day: 'Hét', type: 'Upper', muscle: 'back', exerciseCount: 2,
  exercises: [ex('a', 'Evezés', 'back', 4), ex('b', 'Press', 'shoulder', 3)],
}

function setup(overrides: Partial<Parameters<typeof MesoDayEditor>[0]> = {}) {
  const props = {
    day: DAY,
    minutes: 31,
    onBack: vi.fn(),
    onRename: vi.fn(),
    onChangeExercise: vi.fn(),
    onMoveExercise: vi.fn(),
    onRemoveExercise: vi.fn(),
    onAdd: vi.fn(),
    ...overrides,
  }
  render(<MesoDayEditor {...props} />)
  return props
}

describe('MesoDayEditor', () => {
  test('the day name is an editable field, not static text', async () => {
    const user = userEvent.setup()
    const props = setup()
    const field = screen.getByRole('textbox', { name: 'Hét nap neve' })
    expect(field).toHaveValue('Upper')
    await user.clear(field)
    await user.type(field, 'Húzónap')
    expect(props.onRename).toHaveBeenLastCalledWith('Húzónap')
  })

  test('one always-open card per exercise, above them the daily load tile', () => {
    setup()
    expect(screen.getByText('Napi terhelés · Hét')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Munkaszettek' })).toBeInTheDocument()
    expect(screen.getAllByLabelText(/törlése$/)).toHaveLength(2)
  })

  test('the arrows report the exercise id and direction', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: 'Evezés lejjebb' }))
    expect(props.onMoveExercise).toHaveBeenCalledWith('a', 1)
  })

  test('the first card cannot move up and the last cannot move down', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Evezés feljebb' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Press lejjebb' })).toBeDisabled()
  })

  test('the load tile opens the daily load page and back returns to the day', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /Napi terhelés · Hét/ }))
    expect(screen.getByText('Napi terhelés · Hét · Upper')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '‹ Upper' }))
    expect(screen.getByRole('textbox', { name: 'Hét nap neve' })).toBeInTheDocument()
  })

  test('the add button asks the parent to open the picker', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: /Gyakorlat hozzáadása/ }))
    expect(props.onAdd).toHaveBeenCalled()
  })

  test('editing does not replay the entrance choreography', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <MesoDayEditor
        day={DAY} minutes={31} onBack={vi.fn()} onRename={vi.fn()} onChangeExercise={vi.fn()}
        onMoveExercise={vi.fn()} onRemoveExercise={vi.fn()} onAdd={vi.fn()}
      />,
    )
    const list = screen.getByTestId('exercise-list')
    expect(list).toHaveAttribute('data-entered', 'false')
    // after mount the list is marked entered and stays that way across edits
    await user.click(screen.getByRole('button', { name: 'Evezés lejjebb' }))
    const moved: MesoDay = { ...DAY, exercises: [DAY.exercises[1], DAY.exercises[0]] }
    rerender(
      <MesoDayEditor
        day={moved} minutes={31} onBack={vi.fn()} onRename={vi.fn()} onChangeExercise={vi.fn()}
        onMoveExercise={vi.fn()} onRemoveExercise={vi.fn()} onAdd={vi.fn()}
      />,
    )
    expect(screen.getByTestId('exercise-list')).toHaveAttribute('data-entered', 'true')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/components/MesoDayEditor.test.tsx`
Expected: FAIL — import unresolved.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/train/components/MesoDayEditor.tsx`:

```tsx
// ============================================================
// Mezo · MesoDayEditor — egy edzésnap szerkesztője az egységes mezo-szerkesztőben
// (mezo-yty6). Anatómia: hero ÁTNEVEZHETŐ napnévvel → Napi terhelés csempe →
// mindig nyitott gyakorlat-kártyák → hozzáadás-gomb.
//
// RENDER-FEGYELEM (prototípus-visszajelzés: „átrendezéskor az egész oldal flashel"):
// a belépő `rise` choreográfia CSAK az első mountra fut. A lista `data-entered`
// jelzője a mount után 'true' lesz, és onnantól a kártyák stagger-osztály nélkül
// renderelődnek — a szerkesztés (átrendezés, törlés, hozzáadás, számbevitel)
// villanás nélkül frissül.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import type { GymExercise, MesoDay } from '@/data/types'
import { DayLoadPanel } from '@/features/train/components/DayLoadPanel'
import { ExerciseCard } from '@/features/train/components/ExerciseCard'
import { LoadTile } from '@/features/train/components/LoadTile'
import { dayMuscleLoad } from '@/features/train/logic/mesoLoad'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { BUDGET_GROUP_LABELS, budgetGroup } from '@/features/train/logic/setBudget'
import { dayTone } from '@/features/train/wizard/dayTiles'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageBody, PageHead, type PageTone } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

const TONE: Record<string, PageTone> = { coral: 'coral', sage: 'sage', rose: 'rose', gold: 'gold' }

interface MesoDayEditorProps {
  day: MesoDay
  /** Estimated session minutes — the page owns the timing profile and passes the number. */
  minutes: number
  onBack: () => void
  onRename: (name: string) => void
  onChangeExercise: (exId: string, patch: Partial<GymExercise>) => void
  onMoveExercise: (exId: string, dir: -1 | 1) => void
  onRemoveExercise: (exId: string) => void
  onAdd: () => void
}

export function MesoDayEditor({
  day, minutes, onBack, onRename, onChangeExercise, onMoveExercise, onRemoveExercise, onAdd,
}: MesoDayEditorProps) {
  const [loadOpen, setLoadOpen] = useState(false)
  // One-shot entrance: true from the first effect tick onward, so re-renders caused by
  // editing never re-run the stagger.
  const [entered, setEntered] = useState(false)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; setEntered(true) }
  }, [])

  const rows = dayMuscleLoad(day)
  const sets = day.exercises.reduce((a, e) => a + e.workingSets, 0)

  if (loadOpen) {
    return <DayLoadPanel day={day} minutes={minutes} onBack={() => setLoadOpen(false)} />
  }

  return (
    <MozaikPage tone={TONE[dayTone(day.type)] ?? 'coral'}>
      <PageHead onBack={onBack} label="‹ A heted" />
      <EntranceGroup>
        <div className="mz-dayhero rise">
          <ClayIcon name="i-edzes" size={30} />
          <input
            className="mz-dayname"
            aria-label={`${day.day} nap neve`}
            value={day.type}
            onChange={(e) => onRename(e.target.value)}
          />
          <span className="mz-dayhero-hint">✎ koppints a névre az átnevezéshez</span>
          <span className="mz-dayhero-sub">
            {day.day} · {sets} szett · ~{minutes} perc · {day.exercises.length} gyakorlat
          </span>
        </div>
        <PageBody principle="Minden mező közvetlenül írható. Átrendezés a ▲▼ nyilakkal, törlés az ×-szel.">
          <div className="rise" style={{ marginBottom: 10 }}>
            <LoadTile
              tone="day"
              eyebrow={`Napi terhelés · ${day.day}`}
              value={sets}
              unit={`szett · ~${minutes}′`}
              gauges={rows.slice(0, 3).map((r) => ({
                label: r.label,
                value: r.sets,
                max: r.cap,
                color: muscleColor(r.colorMuscle).deep,
                warn: r.nearCap || r.over,
              }))}
              flagged={rows.some((r) => r.over)}
              onOpen={() => setLoadOpen(true)}
            />
          </div>

          <div data-testid="exercise-list" data-entered={entered ? 'true' : 'false'}>
            {day.exercises.map((ex, i) => {
              const group = budgetGroup(ex.muscle)
              return (
                <div key={ex.id} className={entered ? undefined : 'rise'} style={entered ? undefined : { ['--d' as string]: `${60 + i * 50}ms` }}>
                  <ExerciseCard
                    ex={ex}
                    contribution={group
                      ? [{
                        label: BUDGET_GROUP_LABELS[group] ?? group,
                        sets: ex.workingSets,
                        color: muscleColor(ex.muscle).deep,
                      }]
                      : []}
                    canMoveUp={i > 0}
                    canMoveDown={i < day.exercises.length - 1}
                    onChange={(patch) => onChangeExercise(ex.id, patch)}
                    onMove={(dir) => onMoveExercise(ex.id, dir)}
                    onRemove={() => onRemoveExercise(ex.id)}
                  />
                </div>
              )
            })}
          </div>

          <button type="button" onClick={onAdd} className="mz-addex">
            <Icon name="plus" size={12} /> Gyakorlat hozzáadása
          </button>
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
```

- [ ] **Step 4: Add the stylesheet block**

Append to the **end** of `frontend/src/styles/prototype.css`:

```css
/* ===== mezo-szerkesztő · nap-hero + hozzáadás gomb (mezo-yty6) ===== */
.mz-dayhero { display: grid; justify-items: center; text-align: center; gap: 1px;
  padding: 8px 14px 12px; }
.mz-dayname { width: 100%; max-width: 260px; padding: 1px 0; border: none; background: transparent;
  text-align: center; font-family: inherit; font-size: 17px; font-weight: 700; color: inherit; }
.mz-dayname:focus { outline: none; border-bottom: 1.5px solid var(--coral); }
.mz-dayhero-hint { font-size: 7.5px; color: var(--mz-ink-mut); }
.mz-dayhero-sub { font-size: 10px; color: var(--mz-ink-soft); }
.mz-addex { display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; margin-top: 2px; padding: 10px 0; border-radius: 15px;
  border: 1.5px dashed color-mix(in srgb, var(--coral) 50%, transparent);
  background: transparent; color: var(--coral-deep);
  font-family: inherit; font-size: 10px; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/components/MesoDayEditor.test.tsx src/shared/ui/mozaik/prototypeCssStructure.test.ts`
Expected: PASS — 7 + CSS-guard tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/components/MesoDayEditor.tsx frontend/src/features/train/components/MesoDayEditor.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(train): MesoDayEditor with rename, load tile and flash-free edits (mezo-yty6)"
```

---

### Task 8: `MesoWeekEditor` — az egységes szerkesztő váza

A közös felület: hero szerkeszthető mezo-névvel, vízszintes nap-csempesor, Heti terhelés csempe, lint-sorok, és mód szerinti lábléc. Ez a komponens az, amit a wizard és a sablon-szerkesztő is renderel.

**Files:**
- Create: `frontend/src/features/train/components/MesoWeekEditor.tsx`
- Test: `frontend/src/features/train/components/MesoWeekEditor.test.tsx`

**Interfaces:**
- Consumes: `DayStripTile`, `LoadTile` (Task 4), `MesoDayEditor` (Task 7), `WeekLoadPanel` (Task 6), `weekMuscleLoad`/`adjacentDayConflicts`/`Landmark` (Task 1), `dayTone`, `estimateSessionMinutes` + `SessionTimingProfile` (`@/features/train/logic/sessionLength`), mozaik kit.
- Produces: `function MesoWeekEditor(props: MesoWeekEditorProps): JSX.Element` with

```ts
interface MesoWeekEditorProps {
  mode: 'draft' | 'template'
  name: string
  meta: string
  days: MesoDay[]
  priorities?: MusclePriorities | null
  volumePerMuscle?: Record<string, Landmark> | null
  timingProfile?: SessionTimingProfile | null
  timingProfilePending?: boolean
  /** Which day's editor is open; null = the week view. Page-state, owned by the caller. */
  activeDay: string | null
  onOpenDay: (dayKey: string | null) => void
  onBack: () => void
  onRename: (name: string) => void
  onRenameDay: (dayKey: string, name: string) => void
  onChangeExercise: (dayKey: string, exId: string, patch: Partial<GymExercise>) => void
  onMoveExercise: (dayKey: string, exId: string, dir: -1 | 1) => void
  onRemoveExercise: (dayKey: string, exId: string) => void
  onAddClick: (dayKey: string) => void
  /** Mode-specific CTAs rendered in the footer. */
  footer?: ReactNode
}
```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/train/components/MesoWeekEditor.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import type { GymExercise, MesoDay } from '@/data/types'
import { MesoWeekEditor } from '@/features/train/components/MesoWeekEditor'

function ex(id: string, name: string, muscle: string, workingSets: number): GymExercise {
  return { id, name, muscle, warmupSets: 1, workingSets, repMin: 8, repMax: 10, targetRIR: 1, anchorWeightKg: null, type: 'strength' }
}
function day(dayKey: string, type: string, exercises: GymExercise[], muscle = 'back'): MesoDay {
  return { day: dayKey, type, muscle, exerciseCount: exercises.length, exercises }
}

const DAYS: MesoDay[] = [
  day('Hét', 'Upper', [ex('a', 'Evezés', 'back', 6), ex('b', 'Press', 'shoulder', 3)]),
  day('Kedd', 'Push', [ex('c', 'Oldalemelés', 'shoulder', 4)], 'shoulder'),
]

function setup(overrides: Partial<Parameters<typeof MesoWeekEditor>[0]> = {}) {
  const props = {
    mode: 'template' as const,
    name: 'Hypertrophy · Ősz',
    meta: '6 hét · Upper/Lower · 3× futtatva',
    days: DAYS,
    activeDay: null as string | null,
    onOpenDay: vi.fn(),
    onBack: vi.fn(),
    onRename: vi.fn(),
    onRenameDay: vi.fn(),
    onChangeExercise: vi.fn(),
    onMoveExercise: vi.fn(),
    onRemoveExercise: vi.fn(),
    onAddClick: vi.fn(),
    ...overrides,
  }
  const view = render(<MesoWeekEditor {...props} />)
  return { props, view }
}

describe('MesoWeekEditor', () => {
  test('the mesocycle name is editable and the meta line shows', () => {
    const { props } = setup()
    const field = screen.getByRole('textbox', { name: 'Mezociklus neve' })
    expect(field).toHaveValue('Hypertrophy · Ősz')
    field.focus()
    expect(screen.getByText('6 hét · Upper/Lower · 3× futtatva')).toBeInTheDocument()
    expect(props.onRename).not.toHaveBeenCalled()
  })

  test('one day tile per day, in a single horizontally scrollable row', () => {
    const { view } = setup()
    const row = view.container.querySelector('.mz-dayrow')!
    expect(row.querySelectorAll('.mz-dst')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Hét · Upper · szerkesztés' })).toBeInTheDocument()
  })

  test('tapping a day asks the caller to open it', async () => {
    const user = userEvent.setup()
    const { props } = setup()
    await user.click(screen.getByRole('button', { name: 'Kedd · Push · szerkesztés' }))
    expect(props.onOpenDay).toHaveBeenCalledWith('Kedd')
  })

  test('the weekly load tile opens the weekly load page', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /Heti terhelés/ }))
    expect(screen.getByText('Heti terhelés · izmonként')).toBeInTheDocument()
  })

  test('an adjacent-day conflict flags both day tiles and shows a lint row', () => {
    const { view } = setup()
    expect(view.container.querySelectorAll('.mz-dst-dot')).toHaveLength(2)
    expect(screen.getByText(/pihenőnap ajánlott/i)).toBeInTheDocument()
  })

  test('activeDay renders the day editor instead of the week view', () => {
    setup({ activeDay: 'Hét' })
    expect(screen.getByRole('textbox', { name: 'Hét nap neve' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Mezociklus neve' })).not.toBeInTheDocument()
  })

  test('draft mode says the block is unsaved; template mode names the template', () => {
    const { view } = setup({ mode: 'draft' })
    expect(screen.getByText('Vázlat · még nincs mentve')).toBeInTheDocument()
    view.unmount()
    setup({ mode: 'template' })
    expect(screen.getByText('Sablon · mentve')).toBeInTheDocument()
  })

  test('the footer slot renders the mode-specific CTAs', () => {
    setup({ footer: <button type="button">Mentés + indítás</button> })
    expect(screen.getByRole('button', { name: 'Mentés + indítás' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/components/MesoWeekEditor.test.tsx`
Expected: FAIL — import unresolved.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/train/components/MesoWeekEditor.tsx`:

```tsx
// ============================================================
// Mezo · MesoWeekEditor — az EGYSÉGES mezo-szerkesztő (mezo-yty6). A varázsló
// harmadik lépése és a sablon-szerkesztő ugyanezt rendereli: két felület helyett
// egy. Ami különbözik, az kívülről jön — a perzisztencia (a szülő callbackjei) és
// a lábléc CTA-i (`footer` slot); a `mode` csak a fejléc-eyebrow-t választja.
//
// Anatómia: hero (szerkeszthető mezo-név + meta) → VÍZSZINTESEN görgethető
// nap-csempesor → Heti terhelés csempe → lint-sorok → footer. Egy nap
// megnyitása OLDAL-ÁLLAPOT (`activeDay`, a hívó birtokolja), nem route — a még
// nem mentett vázlat így éli túl a be-/kilépést (ProgramDayView idiom).
// ============================================================
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { GymExercise, MesoDay, MusclePriorities } from '@/data/types'
import { DayStripTile } from '@/features/train/components/DayStripTile'
import { LoadTile } from '@/features/train/components/LoadTile'
import { MesoDayEditor } from '@/features/train/components/MesoDayEditor'
import { WeekLoadPanel } from '@/features/train/components/WeekLoadPanel'
import { adjacentDayConflicts, dayMuscleLoad, weekMuscleLoad, type Landmark } from '@/features/train/logic/mesoLoad'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { estimateSessionMinutes, type SessionTimingProfile } from '@/features/train/logic/sessionLength'
import { dayTone } from '@/features/train/wizard/dayTiles'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

interface MesoWeekEditorProps {
  mode: 'draft' | 'template'
  name: string
  /** One-line meta under the name: weeks · split · run count. */
  meta: string
  days: MesoDay[]
  priorities?: MusclePriorities | null
  volumePerMuscle?: Record<string, Landmark> | null
  timingProfile?: SessionTimingProfile | null
  timingProfilePending?: boolean
  activeDay: string | null
  onOpenDay: (dayKey: string | null) => void
  onBack: () => void
  onRename: (name: string) => void
  onRenameDay: (dayKey: string, name: string) => void
  onChangeExercise: (dayKey: string, exId: string, patch: Partial<GymExercise>) => void
  onMoveExercise: (dayKey: string, exId: string, dir: -1 | 1) => void
  onRemoveExercise: (dayKey: string, exId: string) => void
  onAddClick: (dayKey: string) => void
  footer?: ReactNode
}

export function MesoWeekEditor({
  mode, name, meta, days, priorities, volumePerMuscle, timingProfile, timingProfilePending,
  activeDay, onOpenDay, onBack, onRename, onRenameDay,
  onChangeExercise, onMoveExercise, onRemoveExercise, onAddClick, footer,
}: MesoWeekEditorProps) {
  const [weekLoadOpen, setWeekLoadOpen] = useState(false)

  // Held at 0 while the calibrated profile is still loading — never the static fallback,
  // which would render and then swap under the user (MesoEditor's own rule).
  const minutesOf = (day: MesoDay) =>
    timingProfilePending ? 0 : estimateSessionMinutes(day.exercises, timingProfile ?? undefined)

  const conflicts = adjacentDayConflicts(days)
  const flaggedDays = new Set(conflicts.flatMap((c) => [c.fromDay, c.toDay]))
  const weekRows = weekMuscleLoad(days, priorities ?? null, volumePerMuscle ?? null)
  const weekSets = weekRows.reduce((a, r) => a + r.sets, 0)

  const open = activeDay ? days.find((d) => d.day === activeDay) : undefined
  if (open) {
    return (
      <MesoDayEditor
        day={open}
        minutes={minutesOf(open)}
        onBack={() => onOpenDay(null)}
        onRename={(next) => onRenameDay(open.day, next)}
        onChangeExercise={(exId, patch) => onChangeExercise(open.day, exId, patch)}
        onMoveExercise={(exId, dir) => onMoveExercise(open.day, exId, dir)}
        onRemoveExercise={(exId) => onRemoveExercise(open.day, exId)}
        onAdd={() => onAddClick(open.day)}
      />
    )
  }

  if (weekLoadOpen) {
    return (
      <WeekLoadPanel
        days={days}
        priorities={priorities}
        volumePerMuscle={volumePerMuscle}
        onBack={() => setWeekLoadOpen(false)}
      />
    )
  }

  return (
    <MozaikPage tone="coral">
      <PageHead onBack={onBack} label="‹ Mezociklus" />
      <EntranceGroup>
        <PageBody>
          <div className="mz-wbhero rise">
            <div className="mz-eyebrow">{mode === 'draft' ? 'Vázlat · még nincs mentve' : 'Sablon · mentve'}</div>
            <input
              className="mz-wbname"
              aria-label="Mezociklus neve"
              value={name}
              onChange={(e) => onRename(e.target.value)}
            />
            <div className="mz-wbmeta">{meta}</div>
          </div>

          <div className="mz-eyebrow rise" style={{ padding: '9px 2px 5px' }}>A heted · koppints egy napra</div>
          <div className="mz-dayrow rise">
            {days.map((d) => {
              const rows = dayMuscleLoad(d)
              const sets = d.exercises.reduce((a, e) => a + e.workingSets, 0)
              return (
                <DayStripTile
                  key={d.day}
                  day={d.day}
                  type={d.type}
                  name={d.type}
                  sets={sets}
                  minutes={minutesOf(d)}
                  muscles={rows.map((r) => ({
                    label: r.label, sets: r.sets, color: muscleColor(r.colorMuscle).deep,
                  }))}
                  tone={dayTone(d.type)}
                  flagged={flaggedDays.has(d.day)}
                  onOpen={() => onOpenDay(d.day)}
                />
              )
            })}
          </div>

          <div className="rise">
            <LoadTile
              tone="week"
              eyebrow="Heti terhelés · izmonként"
              value={weekSets}
              unit="szett · W1"
              gauges={weekRows.slice(0, 3).map((r) => ({
                label: r.label,
                value: r.sets,
                max: r.landmark.mrv,
                color: muscleColor(r.colorMuscle).deep,
              }))}
              flagged={conflicts.length > 0}
              onOpen={() => setWeekLoadOpen(true)}
            />
          </div>

          {conflicts.map((c) => (
            <div className="mz-lint rise" key={`${c.fromDay}-${c.toDay}`}>
              <span aria-hidden="true">⚠️</span>
              <span>
                <b>{c.groups.map((g) => g.label).join(' + ')}</b> egymást követő napokon
                ({c.fromDay} → {c.toDay}) — egy pihenőnap segítené a regenerációt.
              </span>
            </div>
          ))}

          {footer && <div className="mz-wfoot">{footer}</div>}
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
```

- [ ] **Step 4: Add the stylesheet block**

Append to the **end** of `frontend/src/styles/prototype.css`:

```css
/* ===== mezo-szerkesztő · a szerkesztő heroja (mezo-yty6) ===== */
.mz-wbhero { border-radius: 18px; padding: 11px 13px; background: var(--mz-wash-coral);
  border: 0.5px solid var(--border-subtle);
  box-shadow: 0 14px 26px -14px rgba(43, 33, 24, 0.28); }
.mz-wbname { width: 100%; padding: 2px 0; border: none; background: transparent;
  font-family: inherit; font-size: 16px; font-weight: 700; color: inherit; }
.mz-wbname:focus { outline: none; border-bottom: 1.5px solid var(--coral); }
.mz-wbmeta { margin-top: 2px; font-size: 9.5px; color: var(--mz-ink-soft); }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/components/MesoWeekEditor.test.tsx src/shared/ui/mozaik/prototypeCssStructure.test.ts`
Expected: PASS — 8 + CSS-guard tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/components/MesoWeekEditor.tsx frontend/src/features/train/components/MesoWeekEditor.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(train): MesoWeekEditor — the unified meso editing surface (mezo-yty6)"
```

---

### Task 9: A varázsló átkötése — egyképernyős interjú + a közös szerkesztő

A 3 lépés (Mikor → Fókusz → Program) eggyé olvad: egy görgethető interjú-oldal, a generálás kimenete pedig a `MesoWeekEditor`-ban nyílik. A `wizardState` `step` mezője kétállapotúvá válik (`'interview' | 'editor'`).

**Files:**
- Create: `frontend/src/features/train/wizard/InterviewStep.tsx`
- Modify: `frontend/src/features/train/wizard/wizardState.ts` (a `step` típus + a reducer)
- Modify: `frontend/src/features/train/wizard/wizardState.test.ts`
- Modify: `frontend/src/features/train/pages/MesocyclePlannerPage.tsx` (teljes újraírás)
- Modify: `frontend/src/features/train/pages/MesocyclePlannerPage.test.tsx`
- Delete: `frontend/src/features/train/wizard/StepWhen.tsx`, `StepFocus.tsx`, `StepProgram.tsx`, `ProgramDayView.tsx` (+ a hozzájuk tartozó `.test.tsx` fájlok, ha vannak)

**Interfaces:**
- Consumes: `MesoWeekEditor` (Task 8); `MusclePriorityPicker` (`@/features/train/components/MusclePriorityPicker`); `wizardReducer`/`generateInput`/`toUpsert`/`initialWizardState` (`@/features/train/wizard/wizardState`); `recommendedDays`/`splitLine` (`@/features/train/logic/mesoPlan`).
- Produces: `function InterviewStep(props: { state: WizardState; dispatch: Dispatch<WizardAction>; onGenerate: () => void; generating: boolean }): JSX.Element`; a `WizardState['step']` típus `'interview' | 'editor'`-ra változik.

- [ ] **Step 1: Update the state machine's test first**

In `frontend/src/features/train/wizard/wizardState.test.ts`, replace every numeric-step assertion with the two-phase model. Add:

```ts
test('the wizard starts on the interview and generation moves it to the editor', () => {
  const s0 = initialWizardState('2026-09-07')
  expect(s0.step).toBe('interview')
  const s1 = wizardReducer(s0, { type: 'step', step: 'editor' })
  expect(s1.step).toBe('editor')
  expect(s1.activeDay).toBeNull()
})

test('renaming a day rewrites only that day and marks the draft dirty', () => {
  const base = {
    ...initialWizardState('2026-09-07'),
    program: [
      { day: 'Hét', type: 'Upper', muscle: 'back', exerciseCount: 0, exercises: [] },
      { day: 'Kedd', type: 'Push', muscle: 'chest', exerciseCount: 0, exercises: [] },
    ],
  }
  const next = wizardReducer(base, { type: 'renameDay', day: 'Kedd', name: 'Nyomónap' })
  expect(next.program.map((d) => d.type)).toEqual(['Upper', 'Nyomónap'])
  expect(next.dirty).toBe(true)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/wizard/wizardState.test.ts`
Expected: FAIL — `expected 0 to be 'interview'` and `renameDay` is not a known action.

- [ ] **Step 3: Update the state machine**

In `frontend/src/features/train/wizard/wizardState.ts`:

```ts
// in WizardState
export interface WizardState {
  /** Two phases now (mezo-yty6): the single-screen interview, then the unified editor. */
  step: 'interview' | 'editor'
  // …everything else unchanged…
}

// in WizardAction — replace the numeric `step` action and add renameDay
export type WizardAction =
  | { type: 'setDays'; days: string[] }
  | { type: 'setDayCount'; n: number }
  | { type: 'setWeeks'; weeks: number }
  | { type: 'setPriorities'; priorities: MusclePriorities }
  | { type: 'setGoalText'; text: string }
  | { type: 'setName'; name: string }
  | { type: 'step'; step: 'interview' | 'editor' }
  | { type: 'generated'; proposal: MesoPlanProposal; input: MesoPlanGenerateRequest }
  | { type: 'editProgram'; program: MesoDay[] }
  | { type: 'renameDay'; day: string; name: string }
  | { type: 'openDay'; day: string | null }

// in initialWizardState
step: 'interview',

// in wizardReducer — the new case, next to 'editProgram'
case 'renameDay':
  return {
    ...s,
    program: s.program.map((d) => (d.day === a.day ? { ...d, type: a.name } : d)),
    dirty: true,
  }
```

- [ ] **Step 4: Run the state test to verify it passes**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/wizard/wizardState.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the interview screen**

Create `frontend/src/features/train/wizard/InterviewStep.tsx`:

```tsx
// ============================================================
// Mezo · InterviewStep — a varázsló EGYETLEN kérdező képernyője (mezo-yty6).
// A régi 01 „Mikor és miért" + 02 „Fókusz" lépés egy görgethető oldallá olvadt,
// a 03 „Program" pedig megszűnt: a generálás kimenete a közös MesoWeekEditor-ban
// nyílik (Alpha-Progression-minta — a wizard vékony interjú, nem második szerkesztő).
// ============================================================
import type { Dispatch } from 'react'
import { DAY_ORDER } from '@/data/train/train'
import { MusclePriorityPicker } from '@/features/train/components/MusclePriorityPicker'
import { recommendedDays, splitLine } from '@/features/train/logic/mesoPlan'
import type { WizardAction, WizardState } from '@/features/train/wizard/wizardState'
import { CtaPrimary } from '@/shared/ui/Cta'
import { ClayIcon } from '@/shared/ui/clay'
import { StatCell, StatStrip } from '@/shared/ui/mozaik'

const COUNTS = [2, 3, 4, 5, 6] as const
const COUNT_HINTS: Record<number, string> = {
  2: 'full body', 3: 'full body', 4: 'upper/lower', 5: 'U/L + PPL', 6: 'PPL ×2',
}

interface InterviewStepProps {
  state: WizardState
  dispatch: Dispatch<WizardAction>
  onGenerate: () => void
  generating: boolean
}

export function InterviewStep({ state, dispatch, onGenerate, generating }: InterviewStepProps) {
  const days = state.daysOfWeek
  const toggleDay = (d: string) =>
    dispatch({ type: 'setDays', days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] })

  return (
    <>
      <h2 className="mz-inth">Mikor edzel — és mire gyúrsz?</h2>
      <p className="mz-intlede">
        Csak ennyit kérdezünk — a többit a modell rakja össze, és a szerkesztőben bármit átírhatsz.
      </p>

      <section className="mz-stepcard mz-stepcard-coral rise">
        <div className="mz-stepcard-head">
          <ClayIcon name="i-edzes" size={24} />
          <span className="mz-eyebrow mz-grow">Edzésnapok</span>
          <span className="mz-stepcard-count">{days.length} nap</span>
        </div>
        <div className="mz-dcgrid">
          {COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={days.length === n ? 'on' : undefined}
              aria-pressed={days.length === n}
              aria-label={`${n} nap / hét`}
              onClick={() => dispatch({ type: 'setDayCount', n })}
            >
              <b>{n}</b><small>{COUNT_HINTS[n]}</small>
            </button>
          ))}
        </div>
        <div className="mz-daypick">
          {DAY_ORDER.map((d) => (
            <button
              key={d}
              type="button"
              className={days.includes(d) ? 'on' : undefined}
              aria-pressed={days.includes(d)}
              aria-label={d}
              onClick={() => toggleDay(d)}
            >
              {d}
            </button>
          ))}
        </div>
        <p className="mz-splitline">{splitLine(days)}</p>
      </section>

      <section className="mz-stepcard mz-stepcard-lav rise">
        <div className="mz-stepcard-head">
          <ClayIcon name="i-mezo" size={24} />
          <span className="mz-eyebrow mz-grow">A célod · opcionális</span>
        </div>
        <textarea
          rows={2}
          aria-label="A célod"
          placeholder="pl. röplabda szezon mellett, a vállam kímélve — de a hát és a váll jöhet"
          value={state.goalText}
          onChange={(e) => dispatch({ type: 'setGoalText', text: e.target.value })}
        />
      </section>

      <section className="mz-stepcard mz-stepcard-rose rise">
        <div className="mz-stepcard-head">
          <ClayIcon name="i-suly" size={24} />
          <span className="mz-eyebrow mz-grow">Fókusz · max 2 hangsúly</span>
        </div>
        <MusclePriorityPicker
          value={state.priorities}
          onChange={(priorities) => dispatch({ type: 'setPriorities', priorities })}
        />
      </section>

      <section className="mz-stepcard mz-stepcard-gold rise">
        <div className="mz-stepcard-head">
          <ClayIcon name="i-meso" size={24} />
          <span className="mz-eyebrow mz-grow">Ami magától megy</span>
        </div>
        <StatStrip>
          <StatCell value={`${state.weeks - 1} + 1`} label="rámpa + deload hét" />
          <StatCell value="+2" label="szett / hét / izom" />
          <StatCell value="~8" label="szett-plafon / edzés" />
        </StatStrip>
      </section>

      <div className="mz-wfoot">
        <CtaPrimary disabled={days.length < 2 || generating} onClick={onGenerate}>
          {generating ? 'Mezo dolgozik…' : '✨ Program generálása'}
        </CtaPrimary>
      </div>
      {days.length < 2 && <p className="mz-stepnote">Válassz legalább 2 edzésnapot a folytatáshoz.</p>}
    </>
  )
}
```

Add the matching stylesheet block to the **end** of `frontend/src/styles/prototype.css`:

```css
/* ===== mezo-szerkesztő · interjú-képernyő (mezo-yty6) ===== */
.mz-inth { padding: 6px 0 2px; font-size: 15px; font-weight: 700; }
.mz-intlede { margin-bottom: 10px; font-size: 9.5px; color: var(--mz-ink-soft); }
.mz-stepcard { border-radius: 17px; padding: 11px 13px; margin-bottom: 9px;
  border: 0.5px solid var(--border-subtle);
  box-shadow: 0 14px 26px -14px rgba(43, 33, 24, 0.28); }
.mz-stepcard-coral { background: var(--mz-wash-coral); }
.mz-stepcard-lav { background: var(--mz-wash-lav); }
.mz-stepcard-rose { background: var(--mz-wash-rose); }
.mz-stepcard-gold { background: var(--mz-wash-gold); }
.mz-stepcard-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.mz-stepcard-count { flex: none; font-size: 9px; font-weight: 700; color: var(--mz-ink-soft); }
.mz-stepcard textarea { width: 100%; resize: none; border-radius: 12px; padding: 9px 11px;
  border: 1px solid var(--border-subtle); background: var(--surface-1);
  font-family: inherit; font-size: 11px; color: inherit; }
.mz-dcgrid { display: flex; gap: 6px; }
.mz-dcgrid button { flex: 1; border-radius: 14px; padding: 10px 0 8px; text-align: center;
  border: 1px solid var(--border-subtle); background: var(--surface-1);
  font-family: inherit; cursor: pointer; }
.mz-dcgrid button.on { border-color: var(--coral); background: var(--mz-wash-coral); }
.mz-dcgrid b { display: block; font-size: 17px; font-weight: 200; font-variant-numeric: tabular-nums; }
.mz-dcgrid small { font-size: 7px; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--mz-ink-mut); }
.mz-daypick { display: flex; gap: 5px; justify-content: space-between; margin-top: 9px; }
.mz-daypick button { width: 34px; height: 34px; border-radius: 50%; padding: 0;
  border: 1px solid var(--border-subtle); background: var(--surface-1);
  font-family: inherit; font-size: 9.5px; font-weight: 700; color: var(--text-secondary);
  cursor: pointer; }
.mz-daypick button.on { border-color: var(--coral); background: var(--gradient-cta);
  color: var(--text-inverse); }
.mz-splitline { margin-top: 9px; font-size: 9.5px; color: var(--mz-ink-soft); }
```

- [ ] **Step 6: Rewrite the planner page**

Replace `frontend/src/features/train/pages/MesocyclePlannerPage.tsx` with:

```tsx
// ============================================================
// Mezo · MesocyclePlannerPage — a mezociklus-varázsló v3 (mezo-yty6):
// EGY kérdező képernyő (InterviewStep) → generálás → a KÖZÖS MesoWeekEditor
// draft módban. A régi 3 lépés + progress-sáv és a külön ProgramDayView
// nyugdíjba ment: a sablon-szerkesztés ugyanezt a szerkesztőt nyitja, így
// ugyanarra a feladatra nincs többé kétféle UI.
//
// A draft VÉGIG memóriában él (wizardState) és a nap-megnyitás OLDAL-ÁLLAPOT,
// nem route — a még nem mentett vázlat így éli túl a be-/kilépést.
// ============================================================
import { useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMesoPlanGenerate, useMesoTemplates, useTimingProfile } from '@/data/hooks'
import type { ExerciseLibraryItem, GymExercise, MesoDay } from '@/data/types'
import { MesoWeekEditor } from '@/features/train/components/MesoWeekEditor'
import { addExerciseWithDefaults } from '@/features/train/logic/exerciseDefaults'
import { splitLine } from '@/features/train/logic/mesoPlan'
import { ExercisePickerSheet } from '@/features/train/sheets/ExercisePickerSheet'
import { InterviewStep } from '@/features/train/wizard/InterviewStep'
import {
  generateInput, initialWizardState, toUpsert, wizardReducer, type WizardState,
} from '@/features/train/wizard/wizardState'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { CtaGhost, CtaPrimary } from '@/shared/ui/Cta'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { localDateString } from '@/shared/lib/dates'

export function MesocyclePlannerPage() {
  const goBack = useBackNav('/train/mesocycles')
  const navigate = useNavigate()
  const [todayIso] = useState(() => localDateString())
  const [state, dispatch] = useReducer(wizardReducer, todayIso, initialWizardState)
  const { generate, generating } = useMesoPlanGenerate()
  const { createTemplate, startTemplate } = useMesoTemplates()
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pickerDay, setPickerDay] = useState<string | null>(null)
  // pages/ own data fetching; the editor stays presentational (frontend_conventions).
  const { data: timingProfile, isPending: timingProfilePending } = useTimingProfile()

  const runGenerate = async (from: WizardState) => {
    setFailed(false)
    const input = generateInput(from)
    try {
      dispatch({ type: 'generated', proposal: await generate(input), input })
      dispatch({ type: 'step', step: 'editor' })
    } catch {
      setFailed(true)
    }
  }

  const editProgram = (program: MesoDay[]) => dispatch({ type: 'editProgram', program })

  const patchDay = (dayKey: string, fn: (d: MesoDay) => MesoDay) =>
    editProgram(state.program.map((d) => (d.day === dayKey ? fn(d) : d)))

  const withExercises = (d: MesoDay, exercises: GymExercise[]): MesoDay =>
    ({ ...d, exercises, exerciseCount: exercises.length })

  const save = async (alsoStart: boolean) => {
    setSaving(true)
    try {
      const tpl = await createTemplate(toUpsert(state))
      if (!alsoStart) { navigate('/train/mesocycles'); return }
      try {
        await startTemplate(tpl.id, { startDate: todayIso, status: 'active' })
        navigate('/train/gym')
      } catch {
        // The template IS saved; only the run stamping died — the library is where it lives.
        navigate('/train/mesocycles')
      }
    } catch {
      setSaving(false)
    }
  }

  if (state.step === 'editor') {
    const pickerLabel = pickerDay
      ? (() => {
        const d = state.program.find((x) => x.day === pickerDay)
        return d ? `${d.day} · ${d.type}` : undefined
      })()
      : undefined
    return (
      <>
        <MesoWeekEditor
          mode="draft"
          name={state.name}
          meta={`${state.weeks} hét · ${splitLine(state.daysOfWeek)}`}
          days={state.program}
          priorities={state.priorities}
          volumePerMuscle={state.proposal?.template.volumePerMuscle ?? null}
          timingProfile={timingProfile}
          timingProfilePending={timingProfilePending}
          activeDay={state.activeDay}
          onOpenDay={(day) => dispatch({ type: 'openDay', day })}
          onBack={goBack}
          onRename={(name) => dispatch({ type: 'setName', name })}
          onRenameDay={(day, name) => dispatch({ type: 'renameDay', day, name })}
          onChangeExercise={(dayKey, exId, patch) => patchDay(dayKey, (d) =>
            withExercises(d, d.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e))))}
          onMoveExercise={(dayKey, exId, dir) => patchDay(dayKey, (d) => {
            const i = d.exercises.findIndex((e) => e.id === exId)
            const j = i + dir
            if (i < 0 || j < 0 || j >= d.exercises.length) return d
            const next = [...d.exercises]
            ;[next[i], next[j]] = [next[j], next[i]]
            return withExercises(d, next)
          })}
          onRemoveExercise={(dayKey, exId) => patchDay(dayKey, (d) =>
            withExercises(d, d.exercises.filter((e) => e.id !== exId)))}
          onAddClick={setPickerDay}
          footer={
            <>
              <CtaGhost onClick={() => void save(false)} disabled={saving}>Mentés sablonként</CtaGhost>
              <CtaPrimary onClick={() => void save(true)} disabled={saving}>✓ Mentés + indítás</CtaPrimary>
            </>
          }
        />
        {pickerDay && (
          <ExercisePickerSheet
            dayLabel={pickerLabel}
            onClose={() => setPickerDay(null)}
            onPick={(item: ExerciseLibraryItem) => patchDay(pickerDay, (d) =>
              addExerciseWithDefaults(d, item, 'hypertrophy'))}
          />
        )}
      </>
    )
  }

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={goBack} label="‹ Mezociklus">
        <span className="mz-stepct">Új blokk · interjú</span>
      </PageHead>
      <PageBody>
        {failed && (
          <div className="mz-lint" role="alert">
            <span aria-hidden="true">⚠️</span>
            <span>A generálás nem sikerült — próbáld újra.</span>
          </div>
        )}
        <InterviewStep
          state={state}
          dispatch={dispatch}
          generating={generating}
          onGenerate={() => void runGenerate(state)}
        />
      </PageBody>
    </MozaikPage>
  )
}
```

- [ ] **Step 7: Rewrite the planner page test**

Replace the step-flow tests in `frontend/src/features/train/pages/MesocyclePlannerPage.test.tsx`. Keep the file's existing `beforeEach` clock pin and `setup()` helper; replace the flow helper and the step tests with:

```tsx
/** The interview is one screen now — generation is the only hop. */
async function generate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Program generálása/ }))
}

test('the interview asks everything on one screen', () => {
  setup()
  expect(screen.getByText('Edzésnapok')).toBeInTheDocument()
  expect(screen.getByText('A célod · opcionális')).toBeInTheDocument()
  expect(screen.getByText('Fókusz · max 2 hangsúly')).toBeInTheDocument()
  expect(screen.getByText('Ami magától megy')).toBeInTheDocument()
  // the retired 3-step chrome must not come back
  expect(screen.queryByRole('button', { name: 'Tovább →' })).not.toBeInTheDocument()
})

test('generating lands in the unified editor with the day strip', async () => {
  const user = userEvent.setup()
  setup()
  await generate(user)
  expect(await screen.findByRole('textbox', { name: 'Mezociklus neve' })).toBeInTheDocument()
  expect(screen.getByText('A heted · koppints egy napra')).toBeInTheDocument()
  expect(screen.getByText('Vázlat · még nincs mentve')).toBeInTheDocument()
})

test('a day opens its editor and the day name is renameable', async () => {
  const user = userEvent.setup()
  setup()
  await generate(user)
  const tile = (await screen.findAllByRole('button', { name: /· szerkesztés$/ }))[0]
  await user.click(tile)
  const nameField = await screen.findByRole('textbox', { name: /nap neve$/ })
  await user.clear(nameField)
  await user.type(nameField, 'Húzónap')
  expect(nameField).toHaveValue('Húzónap')
})
```

- [ ] **Step 8: Delete the retired step components**

```bash
git rm frontend/src/features/train/wizard/StepWhen.tsx frontend/src/features/train/wizard/StepFocus.tsx frontend/src/features/train/wizard/StepProgram.tsx frontend/src/features/train/wizard/ProgramDayView.tsx
```

If any of these has a sibling `*.test.tsx`, `git rm` it too. Then remove the now-dead `.mz-wprog` / `.mz-dtile*` rules from `frontend/src/styles/prototype.css` **only if** `grep -rn "mz-wprog\|mz-dtile" frontend/src` returns no hits outside the stylesheet — the `DayTile` component may still be used by `MesocycleBuilderPage`.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/wizard src/features/train/pages/MesocyclePlannerPage.test.tsx`
Expected: PASS. Then `cd frontend && pnpm build` to prove no dangling imports of the deleted files.

- [ ] **Step 10: Commit**

```bash
git add -A frontend/src/features/train frontend/src/styles/prototype.css
git commit -m "feat(train): wizard becomes a one-screen interview into the unified editor (mezo-yty6)"
```

---

### Task 10: A sablon-szerkesztő átkötése a közös szerkesztőre

A `pghead-np` fejlécű, `<details>`-es oldal helyére a `MesoWeekEditor` kerül, sablon módban. A teljes-sablon PUT idióma változatlan marad.

**Files:**
- Modify: `frontend/src/features/train/pages/MesoTemplateEditorPage.tsx`
- Modify: `frontend/src/features/train/pages/MesoTemplateEditorPage.test.tsx`
- Modify: `frontend/src/features/train/pages/train.nav.test.tsx`

**Interfaces:**
- Consumes: `MesoWeekEditor` (Task 8), a page meglévő `toUpsert` helpere, `seedDays`/`toDayInputs`, `useMesoTemplates`, `useTimingProfile`.
- Produces: nincs új export — a route ugyanaz marad.

- [ ] **Step 1: Write the failing test**

In `frontend/src/features/train/pages/MesoTemplateEditorPage.test.tsx`, add to the mock-mode describe block:

```tsx
test('the template editor renders the unified editor, not the old page head', async () => {
  renderEditor('t1')
  expect(await screen.findByRole('textbox', { name: 'Mezociklus neve' })).toBeInTheDocument()
  expect(screen.getByText('Sablon · mentve')).toBeInTheDocument()
  expect(screen.getByText('A heted · koppints egy napra')).toBeInTheDocument()
  // the retired chrome
  expect(document.querySelector('.pghead-np')).toBeNull()
  expect(screen.queryByText('Fókusz')).not.toBeInTheDocument()
})

test('renaming a day persists through the full-template PUT', async () => {
  const user = userEvent.setup()
  renderEditor('t1')
  const tile = (await screen.findAllByRole('button', { name: /· szerkesztés$/ }))[0]
  await user.click(tile)
  const nameField = await screen.findByRole('textbox', { name: /nap neve$/ })
  await user.clear(nameField)
  await user.type(nameField, 'Húzónap')
  expect(nameField).toHaveValue('Húzónap')
})
```

(Use the file's existing `renderEditor` helper; if it is named differently, keep the file's own convention.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/pages/MesoTemplateEditorPage.test.tsx`
Expected: FAIL — no `Mezociklus neve` textbox (the old `pghead-np` head is still rendered).

- [ ] **Step 3: Rewrite the page body**

In `frontend/src/features/train/pages/MesoTemplateEditorPage.tsx`, keep the module doc, the `toUpsert` helper and the pending/not-found branches exactly as they are. Replace the `return (…)` of `MesoTemplateEditorPage` and the whole `TemplateDayEditor` body with:

```tsx
  return <TemplateDayEditor key={template.id} template={template} onPersist={(days, goalPreset, musclePriorities) =>
    updateTemplate(template.id, toUpsert(template, days, goalPreset, musclePriorities))
      // Failed mutations are toasted globally (§7a); the local edit stands and the
      // next change retries the whole document.
      .catch(() => {})} />
}

function TemplateDayEditor({ template, onPersist }: {
  template: MesoTemplate
  onPersist: (days: MesoDay[], goalPreset?: string | null, musclePriorities?: MusclePriorities | null) => void
}) {
  const goBack = useBackNav('/train/mesocycles')
  const [days, setDays] = useState<MesoDay[]>(() => seedDays(template.days ?? []))
  const [priorities] = useState<MusclePriorities>(() => template.musclePriorities ?? {})
  const [name, setName] = useState(template.title)
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [pickerDay, setPickerDay] = useState<string | null>(null)
  const { data: timingProfile, isPending: timingProfilePending } = useTimingProfile()

  const apply = (next: MesoDay[]) => { setDays(next); onPersist(next) }

  const patchDay = (dayKey: string, fn: (d: MesoDay) => MesoDay) =>
    apply(days.map((d) => (d.day === dayKey ? fn(d) : d)))

  const withExercises = (d: MesoDay, exercises: GymExercise[]): MesoDay =>
    ({ ...d, exercises, exerciseCount: exercises.length })

  const pickerLabel = pickerDay
    ? (() => {
      const d = days.find((x) => x.day === pickerDay)
      return d ? `${d.day} · ${d.type}` : undefined
    })()
    : undefined

  return (
    <>
      <MesoWeekEditor
        mode="template"
        name={name}
        meta={[`${template.weeks} hét`, template.split, `${template.runCount}× futtatva`]
          .filter(Boolean).join(' · ')}
        days={days}
        priorities={priorities}
        volumePerMuscle={template.volumePerMuscle ?? null}
        timingProfile={timingProfile}
        timingProfilePending={timingProfilePending}
        activeDay={activeDay}
        onOpenDay={setActiveDay}
        onBack={goBack}
        // The title rides along the same full-replace document as every other edit.
        onRename={(next) => { setName(next); onPersist(days) }}
        onRenameDay={(dayKey, next) => patchDay(dayKey, (d) => ({ ...d, type: next }))}
        onChangeExercise={(dayKey, exId, patch) => patchDay(dayKey, (d) =>
          withExercises(d, d.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e))))}
        onMoveExercise={(dayKey, exId, dir) => patchDay(dayKey, (d) => {
          const i = d.exercises.findIndex((e) => e.id === exId)
          const j = i + dir
          if (i < 0 || j < 0 || j >= d.exercises.length) return d
          const next = [...d.exercises]
          ;[next[i], next[j]] = [next[j], next[i]]
          return withExercises(d, next)
        })}
        onRemoveExercise={(dayKey, exId) => patchDay(dayKey, (d) =>
          withExercises(d, d.exercises.filter((e) => e.id !== exId)))}
        onAddClick={setPickerDay}
      />
      {pickerDay && (
        <ExercisePickerSheet
          dayLabel={pickerLabel}
          onClose={() => setPickerDay(null)}
          onPick={(item) => patchDay(pickerDay, (d) =>
            addExerciseWithDefaults(d, item, template.goalPreset))}
        />
      )}
    </>
  )
}
```

Update the imports at the top of the file: drop `CtaGhost` if it becomes unused by the not-found branch (it does not — keep it), drop `MesoEditor` and `MusclePriorityPicker`, and add:

```tsx
import { MesoWeekEditor } from '@/features/train/components/MesoWeekEditor'
```

**Note on the retired Fókusz picker:** the tier picker moves to the wizard interview only. Editing tiers on an existing template is out of scope for this round — file it as a follow-up in Task 11 rather than silently dropping the capability.

- [ ] **Step 4: Update the nav test**

`frontend/src/features/train/pages/train.nav.test.tsx` pins scaffold choices per route. Update the template-editor expectation to the Mozaik shell — find the assertion that the template editor route renders the plain DS shell and change it to assert `document.querySelector('.mz-page')` is present (mirroring how the file asserts the planner's full-screen flow at :98).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && CI=true VITE_USE_MOCK=true pnpm exec vitest run src/features/train/pages`
Expected: PASS — the whole `pages/` folder, including `train.nav.test.tsx`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/train/pages
git commit -m "feat(train): template editor moves onto the unified MesoWeekEditor (mezo-yty6)"
```

---

### Task 11: Dokumentáció, CODEMAP, kapuk és utókövetés

**Files:**
- Modify: `docs/features/train.md` (§2 Mezociklus blokk + §9 státusz + §10)
- Modify: `docs/CODEMAP.md` (generált)
- Modify: `docs/design_2.0/2026-09-07-mezo-szerkeszto-design-iterations.md` (záró bejegyzés)

- [ ] **Step 1: Update the feature doc**

In `docs/features/train.md` §2 ("Mezociklus"), replace the wizard/template-editor description with the shipped shape:

```markdown
- **Varázsló (`/train/mesocycles/new`)** — EGY kérdező képernyő (`InterviewStep`: edzésnapok,
  cél, izom-fókusz, „ami magától megy") → generálás → a közös `MesoWeekEditor` **draft**
  módban. A 3 lépéses változat és a `ProgramDayView` nyugdíjba ment (mezo-yty6).
- **Sablon-szerkesztő (`/train/mesocycles/templates/:id`)** — ugyanaz a `MesoWeekEditor`
  **sablon** módban, a teljes-sablon PUT idiómával. Két UI helyett egy.
- **A szerkesztő anatómiája** — hero (szerkeszthető mezo-név + meta) → vízszintesen
  görgethető nap-csempesor (`DayStripTile`) → Heti terhelés csempe (`LoadTile`) →
  egymást követő napok izom-ütközésének lint-sorai. Egy nap megnyitása oldal-állapot:
  `MesoDayEditor` (átnevezhető napnév, Napi terhelés csempe, mindig nyitott
  `ExerciseCard`-ok inline számmezőkkel, ▲▼ átrendezés, × törlés).
- **Terhelés-oldalak** — `WeekLoadPanel` (izmonként `ZoneBar` a MEV/MAV/MRV zónákkal,
  tier-cél felé mutató nyíllal, frekvenciával és napokra bontott hozzájárulással) és
  `DayLoadPanel` (session-cap sávok). Százalék sehol nem jelenik meg szövegként.
- **Derivációk** — `logic/mesoLoad.ts` (`weekMuscleLoad`, `dayMuscleLoad`,
  `adjacentDayConflicts`); a `ExerciseAccordionRow` + `MesoEditor` pár TOVÁBB ÉL, mert
  a futó mezo napi szerkesztőjét (`MesoExercises` → `MesoDayPage`) az szolgálja ki.
```

In §9, mark F7.2/F7.4 as delivered with the issue id and the spec/plan paths. In §10, add the new files to the file map.

- [ ] **Step 2: Regenerate the CODEMAP**

```bash
node scripts/gen-codemap.mjs
node scripts/gen-codemap.mjs --check
node scripts/lint-docs.mjs
```
Expected: `--check` exits 0 and the docs lint reports no new orphans or broken links.

- [ ] **Step 3: File the follow-up issues**

```bash
bd create "Mezo generátor: kerülje az egymást követő napok izom-átfedését" -t feature -p 2 -d "A mezo-yty6 szerkesztő már JELZI az ütközést (adjacentDayConflicts, WeekLoadPanel lint-sor), de a generátor még mindig kioszthat ilyen hetet. Backend/generátor oldali elkerülés: docs/superpowers/specs/2026-09-07-mezo-szerkeszto-redesign-design.md non-goals."
bd create "Futó mezo napi szerkesztője álljon át az ExerciseCard-ra" -t feature -p 2 -d "MesoExercises (MesoDayPage) még a régi MesoEditor + ExerciseAccordionRow párt rendereli, míg a tervezés már ExerciseCard-ot (mezo-yty6). Harmadik felület egységesítése — külön kör, mert a futó mezo per-day PUT-tal és élő edzés-szemantikával dolgozik."
bd create "Sablon tier-szerkesztés (Fókusz) az egységes szerkesztőben" -t feature -p 2 -d "A mezo-yty6 redesignban a MusclePriorityPicker a varázsló interjújába került; a sablon-szerkesztőből a Fókusz <details> kikerült. Vissza kell hozni az új felület nyelvén (pl. a Heti terhelés oldalról nyíló tier-váltás), hogy egy MENTETT sablon tierjei is szerkeszthetők legyenek."
```

- [ ] **Step 4: Run the full gate**

```bash
cd frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: build clean, both suites green. Fix anything red before continuing — a partially green gate is not a pass.

- [ ] **Step 5: Refresh the visual goldens if they moved**

```bash
cd frontend && pnpm test:visual
```
The snapshotted routes are `meso-hub` and `meso-week` — neither is a route this plan touches, so this should pass unchanged. If a shared piece shifted them, review the diff before re-baselining with `pnpm test:visual:update`.

- [ ] **Step 6: Close the loop and commit**

```bash
node scripts/check-beads-backup.mjs --fix
git add -A docs .beads
git commit -m "docs(train): mezo-szerkesztő redesign — feature doc, codemap, follow-ups (mezo-yty6)"
```

---

## Self-Review

**Spec coverage.** Minden spec-szakaszhoz tartozik task: §1 flow/IA → Task 8, 9, 10; §2 nap-szerkesztő + gyakorlat-kártyák + render-fegyelem → Task 3, 7; §3 volumen-vizualizáció → Task 1, 2, 5, 6; §3.a mozgás → Task 2 (pulzáló marker), 4 (count-up), 5–8 (stagger, `EntranceGroup`), és a `prefers-reduced-motion` blokkok minden CSS-részben; §4 prototípus-igazodás → globális constraint. A döntéslista 1–6 pontja rendre Task 8/9/10 (egy szerkesztő), Task 4+5+6 (csempe + teljes oldal), Task 3 (inline input), Task 1+6+8 (passzív lint), Task 9 (egyképernyős interjú), Task 3 (▲▼).

**Placeholder-ellenőrzés.** Nincs "TBD"/"később"/"hasonlóan a Task N-hez": minden lépés a tényleges kódot vagy a tényleges parancsot tartalmazza. A Task 10 nav-teszt lépése az egyetlen, ami a meglévő fájl saját konvenciójára hivatkozik a pontos sor helyett — szándékosan, mert a fájl állapota a Task 9 után módosulhat; a lépés megmondja, mit kell állítani (`.mz-page` jelenléte).

**Típus-konzisztencia.** `WeekLoadRow`/`DayLoadRow`/`AdjacentConflict` mezőneveit a Task 1 rögzíti, és a Task 5/6/7/8 pontosan ezeket olvassa (`sets`, `target`, `landmark`, `frequency`, `direction`, `toTarget`, `contributions`, `cap`, `nearCap`, `over`, `exercises`, `fromDay`/`toDay`/`groups`). A `LoadGauge`/`DayStripMuscle` a Task 4-ből származik, és a Task 7/8 azzal a shape-pel hívja. Az `onMoveExercise(dayKey, exId, dir)` szignatúra azonos a Task 7 (`onMove(dir)` → felfelé propagálva), Task 8, 9 és 10 kódjában.

**Ismert kockázat, tudatosan vállalva.** A Task 10 elveszíti a sablon-szintű tier-szerkesztést (a `Fókusz` `<details>`) — ezért kap saját bd-issue-t a Task 11-ben, nem néma kiesésként.

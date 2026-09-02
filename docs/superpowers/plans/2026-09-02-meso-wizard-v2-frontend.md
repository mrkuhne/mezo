# Mesocycle wizard v2 (frontend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 5-step planner with the approved 3-step wizard (Mikor és miért → Fókusz → Program) driven by `POST /api/train/meso-plans/generate`, delete the goal presets / split presets / phase-curve editor / "szet-büdzsé %" card, and make every volume display speak `current → ceiling · tier`.

**Architecture:** One new dual-mode hook (`useMesoPlanGenerate`) wraps the endpoint (mock branch = a pure TS mirror of the backend skeleton + the mock exercise library). One pure module (`logic/mesoPlan.ts`) gives the wizard its live numbers before/after generation (split from day count, week-1 sets, ceilings, per-day frames). The page becomes a thin state container over three step components; the Program step is a tile hub (hero + day mosaic + weekly bands) whose day tiles swap in a single-day editor built on the existing `MesoEditor`. `SetBudgetCard` is replaced by `WeeklyBandsCard` everywhere it was mounted.

**Tech Stack:** React 19 + Vite + TypeScript, TanStack Query dual-mode hooks (`useDualQuery`/`useMutation` + `isMockMode()`), MSW for real-mode tests, vitest + Testing Library, Mozaik primitives (`shared/ui/mozaik`), clay sprites.

**Prerequisite:** the backend plan (`2026-09-02-meso-plan-generator-backend.md`) is merged — `frontend/src/data/_client/api.gen.ts` already carries `MesoPlanGenerateRequest/Response`.

## Global Constraints

- Visual truth: `docs/design_2.0/prototypes/src/meso-body.html` `#page-wizard` (steps 0–2) and `#page-day` (px ×1.18, tile recipe). Rebuild the prototype with `docs/design_2.0/prototypes/build.sh` if you need to view it.
- Mozaik primitives only (`Tile`, `Mosaic`, `StatStrip`, `StatCell`, `MozaikPage`, `PageHead`, `PageHero`, `PageBody`, `CollapsibleStrip`, `EntranceGroup`, `ClayIcon`); no new primitives; `.rise` needs an `EntranceGroup` ancestor; colors only through `--mz-*` tokens declared in BOTH `:root` blocks of `frontend/src/styles/prototype.css` (guarded by `mozaikCssTokens.test.ts`); the Mozaik CSS section must stay before the Today section (`todayCssTokens.test.ts`); no `*/` inside CSS comments (`prototypeCssStructure.test.ts`).
- Dual-mode: `isMockMode()` read inside hook bodies only; mock hooks never fetch; real mode has no static fallback; `realEmpty` is never the mock seed.
- Tests must pass in BOTH modes: `cd frontend && VITE_USE_MOCK=false pnpm test` and `VITE_USE_MOCK=true pnpm test` (unset = mock in a worktree). Single file: `pnpm vitest run <path>`. Build gate: `pnpm build`.
- Template-first save seam stays: `createTemplate(MesoTemplateUpsertRequest)` → `startTemplate(id, {startDate, status:'active'})`; all 7 days travel (rest days as `type: 'Rest'`).
- Tier semantics: `emphasize → start MEV+2, ceiling MRV`; `grow → MEV, MAV`; `maintain → MEV, MEV (holds)`. Landmarks from `GROUP_LANDMARKS` (`logic/setBudget.ts`) or the template's `volumePerMuscle` override when present.
- Delete: `GOAL_PRESETS`, `SPLITS`, `GoalPreset`, `SplitOption`, `planner.ts`, `programFit.ts`, `SetBudgetCard`, the phase-curve editor, the "Heti szet-büdzsé %" logic (`muscleBudgets`' percentage semantics). Keep: `budgetOf`/`GROUP_MEV`/`setStyle` for `weekZone.ts` (Heti/session surfaces — out of scope; file a bd follow-up, see Task 6), `structureLint`, `peakWeekFit`, `mesoDays`, `musclePriorities`, `MusclePriorityPicker`.
- Docs in the same change: `docs/features/train.md` (§2 planner paragraph, §4 `#### Set-budget` → `#### Weekly bands`, §8 test list, §10 file map), `node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs`.
- Commits: `feat(train-fe): … (mezo-<id>)`.

---

### Task 0: bd issue + branch

- [ ] **Step 1**
```bash
bd create --title "Mesocycle wizard v2: 3-step generator-driven wizard, presets/splits/budget% removed" --type feature --priority 1 --parent mezo-d20 --description "Spec: docs/superpowers/specs/2026-09-01-mesocycle-wizard-redesign-design.md §Wizard. Plan: docs/superpowers/plans/2026-09-02-meso-wizard-v2-frontend.md. Depends on the backend generator (merged)."
bd update <id> --claim
git checkout main && git pull --rebase && git checkout -b feat/meso-wizard-v2
```

---

### Task 1: `logic/mesoPlan.ts` — pure FE mirror of the skeleton math

**Files:**
- Create: `frontend/src/features/train/logic/mesoPlan.ts`
- Test: `frontend/src/features/train/logic/mesoPlan.test.ts`

**Interfaces:**
- Consumes: `GROUP_LANDMARKS` (`logic/setBudget.ts:65`, `Record<string,{mev,mav,mrv}>`), `TIER_GROUPS`, `tierOf` (`logic/musclePriorities.ts`), `DAY_ORDER` (`data/train/train.ts:31`).
- Produces:
```ts
export type DayType = 'Full' | 'Upper' | 'Lower' | 'Push' | 'Pull' | 'Legs' | 'Rest'
export interface MuscleFrame { group: string; sets: number }
export interface DayFrame { day: string; type: DayType; muscles: MuscleFrame[] }
export interface Landmark { mev: number; mav: number; mrv: number }
export const SPLIT_LABELS: Record<number, string>          // 2..6 → 'Full body' … 'Push / Pull / Legs ×2'
export const SPLIT_TYPES: Record<number, DayType[]>
export function recommendedDays(n: number): string[]      // 2:[Hét,Csü] 3:[Hét,Sze,Pén] 4:[Hét,Sze,Pén,Szo] 5:[Hét,Kedd,Sze,Pén,Szo] 6:[Hét,Kedd,Sze,Pén,Szo,Vas]
export function splitLine(days: string[]): string          // '4 nap → Upper / Lower · minden izom 2×/hét'
export function weekOneSets(tier: MuscleTier, lm: Landmark): number
export function ceilingSets(tier: MuscleTier, lm: Landmark): number
export function dayFrames(days: string[], priorities: MusclePriorities | null, landmarks?: Record<string, Landmark>): DayFrame[]  // 7 entries in DAY_ORDER
export function weekTotals(priorities: MusclePriorities | null, landmarks?: Record<string, Landmark>): { weekOne: number; peak: number }
export function frequencyOf(frames: DayFrame[], group: string): number
export const SESSION_CAP = 8
```
Type→group table identical to the backend (`Full: quad,chest,back,ham,shoulder,glute,biceps,triceps,calf · Upper: chest,back,shoulder,biceps,triceps · Lower: quad,ham,glute,calf · Push: chest,shoulder,triceps · Pull: back,biceps · Legs: quad,ham,glute,calf`); distribution = floor + remainder on earliest day.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  SESSION_CAP, ceilingSets, dayFrames, frequencyOf, recommendedDays, splitLine, weekOneSets, weekTotals,
} from './mesoPlan'

const LM = { mev: 10, mav: 16, mrv: 22 }

describe('mesoPlan', () => {
  it('derives the split label from the day count', () => {
    expect(splitLine(['Hét', 'Sze', 'Pén', 'Szo'])).toBe('4 nap → Upper / Lower · minden izom 2×/hét')
    expect(splitLine(['Hét', 'Csü'])).toBe('2 nap → Full body · minden izom 2×/hét')
    expect(splitLine(['Hét', 'Kedd', 'Sze', 'Pén', 'Szo', 'Vas'])).toBe('6 nap → Push / Pull / Legs ×2 · minden izom 2×/hét')
  })

  it('recommends weekend-inclusive patterns', () => {
    expect(recommendedDays(4)).toEqual(['Hét', 'Sze', 'Pén', 'Szo'])
    expect(recommendedDays(6)).toContain('Vas')
  })

  it('maps tiers to week-1 start and ceiling', () => {
    expect(weekOneSets('emphasize', LM)).toBe(12)
    expect(weekOneSets('grow', LM)).toBe(10)
    expect(weekOneSets('maintain', LM)).toBe(10)
    expect(ceilingSets('emphasize', LM)).toBe(22)
    expect(ceilingSets('grow', LM)).toBe(16)
    expect(ceilingSets('maintain', LM)).toBe(10)
    expect(weekOneSets('emphasize', { mev: 21, mav: 21, mrv: 22 })).toBe(22)
  })

  it('frames 7 days with rest days and spreads sets with the remainder first', () => {
    const frames = dayFrames(['Hét', 'Sze', 'Pén', 'Szo'], { back: 'emphasize' })
    expect(frames).toHaveLength(7)
    expect(frames.map((f) => f.type)).toEqual(['Upper', 'Rest', 'Lower', 'Rest', 'Upper', 'Lower', 'Rest'])
    const back = frames.filter((f) => f.type === 'Upper').map((f) => f.muscles.find((m) => m.group === 'back')?.sets ?? 0)
    expect(back).toEqual([6, 6])
    const chest7 = dayFrames(['Hét', 'Sze', 'Pén', 'Szo'], null, { chest: { mev: 7, mav: 14, mrv: 20 } })
    expect(chest7.filter((f) => f.type === 'Upper').map((f) => f.muscles.find((m) => m.group === 'chest')?.sets)).toEqual([4, 3])
  })

  it('trains every group at least twice and never above the session cap for 2–6 days', () => {
    for (let n = 2; n <= 6; n++) {
      const frames = dayFrames(recommendedDays(n), { back: 'emphasize', quad: 'emphasize' })
      for (const g of ['chest', 'back', 'shoulder', 'biceps', 'triceps', 'quad', 'ham', 'glute', 'calf']) {
        expect(frequencyOf(frames, g), `${n} days ${g}`).toBeGreaterThanOrEqual(2)
      }
      frames.forEach((f) => f.muscles.forEach((m) => expect(m.sets).toBeLessThanOrEqual(SESSION_CAP)))
    }
  })

  it('sums week-1 and peak totals over the nine groups', () => {
    const t = weekTotals({ back: 'emphasize' })
    expect(t.weekOne).toBeGreaterThan(50)
    expect(t.peak).toBeGreaterThan(t.weekOne)
  })
})
```

- [ ] **Step 2: Run to see it fail** — `cd frontend && pnpm vitest run src/features/train/logic/mesoPlan.test.ts` → "Failed to resolve import".

- [ ] **Step 3: Implement**

```ts
// ============================================================
// Mezo · mesoPlan — the FE mirror of the backend MesoPlanSkeleton (mesocycle wizard
// redesign). Pure. Gives the wizard its live numbers before the generator answers
// (split line, week-1/peak totals, per-day frames for the day mosaic) and the mock-mode
// proposal its frames. Same tables as backend/…/MesoPlanSkeleton.java — change both.
// ============================================================
import { DAY_ORDER } from '@/data/train/train'
import type { MusclePriorities, MuscleTier } from '@/data/types'
import { GROUP_LANDMARKS } from '@/features/train/logic/setBudget'
import { TIER_GROUPS, tierOf } from '@/features/train/logic/musclePriorities'

export type DayType = 'Full' | 'Upper' | 'Lower' | 'Push' | 'Pull' | 'Legs' | 'Rest'
export interface MuscleFrame { group: string; sets: number }
export interface DayFrame { day: string; type: DayType; muscles: MuscleFrame[] }
export interface Landmark { mev: number; mav: number; mrv: number }

export const SESSION_CAP = 8

export const SPLIT_LABELS: Record<number, string> = {
  2: 'Full body', 3: 'Full body', 4: 'Upper / Lower', 5: 'Upper / Lower / Push / Pull / Legs', 6: 'Push / Pull / Legs ×2',
}
export const SPLIT_TYPES: Record<number, DayType[]> = {
  2: ['Full', 'Full'],
  3: ['Full', 'Full', 'Full'],
  4: ['Upper', 'Lower', 'Upper', 'Lower'],
  5: ['Upper', 'Lower', 'Push', 'Pull', 'Legs'],
  6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
}
const TYPE_GROUPS: Record<Exclude<DayType, 'Rest'>, string[]> = {
  Full: ['quad', 'chest', 'back', 'ham', 'shoulder', 'glute', 'biceps', 'triceps', 'calf'],
  Upper: ['chest', 'back', 'shoulder', 'biceps', 'triceps'],
  Lower: ['quad', 'ham', 'glute', 'calf'],
  Push: ['chest', 'shoulder', 'triceps'],
  Pull: ['back', 'biceps'],
  Legs: ['quad', 'ham', 'glute', 'calf'],
}
const RECOMMENDED: Record<number, string[]> = {
  2: ['Hét', 'Csü'], 3: ['Hét', 'Sze', 'Pén'], 4: ['Hét', 'Sze', 'Pén', 'Szo'],
  5: ['Hét', 'Kedd', 'Sze', 'Pén', 'Szo'], 6: ['Hét', 'Kedd', 'Sze', 'Pén', 'Szo', 'Vas'],
}

const clampN = (n: number) => Math.min(6, Math.max(2, n))
const dayIdx = (d: string) => DAY_ORDER.indexOf(d as (typeof DAY_ORDER)[number])

export function recommendedDays(n: number): string[] { return [...RECOMMENDED[clampN(n)]] }

export function splitLine(days: string[]): string {
  const n = clampN(days.length)
  return `${days.length} nap → ${SPLIT_LABELS[n]} · minden izom 2×/hét`
}

export function weekOneSets(tier: MuscleTier, lm: Landmark): number {
  return tier === 'emphasize' ? Math.min(lm.mev + 2, lm.mrv) : lm.mev
}
export function ceilingSets(tier: MuscleTier, lm: Landmark): number {
  return tier === 'emphasize' ? lm.mrv : tier === 'grow' ? lm.mav : lm.mev
}

function landmarkOf(group: string, landmarks?: Record<string, Landmark>): Landmark | null {
  return landmarks?.[group] ?? GROUP_LANDMARKS[group] ?? null
}

export function dayFrames(days: string[], priorities: MusclePriorities | null, landmarks?: Record<string, Landmark>): DayFrame[] {
  const training = [...days].sort((a, b) => dayIdx(a) - dayIdx(b))
  const types = SPLIT_TYPES[clampN(training.length)]
  const freq = new Map<string, number>()
  types.forEach((t) => TYPE_GROUPS[t as Exclude<DayType, 'Rest'>].forEach((g) => { if (landmarkOf(g, landmarks)) freq.set(g, (freq.get(g) ?? 0) + 1) }))
  const handed = new Map<string, number>()
  return DAY_ORDER.map((day) => {
    const i = training.indexOf(day)
    if (i < 0) return { day, type: 'Rest' as const, muscles: [] }
    const type = types[i]
    const muscles: MuscleFrame[] = []
    for (const g of TYPE_GROUPS[type as Exclude<DayType, 'Rest'>]) {
      const lm = landmarkOf(g, landmarks)
      if (!lm) continue
      const total = weekOneSets(tierOf(priorities ?? {}, g), lm)
      const f = freq.get(g) ?? 1
      const done = handed.get(g) ?? 0
      const sets = Math.floor(total / f) + (done < total % f ? 1 : 0)
      handed.set(g, done + 1)
      if (sets > 0) muscles.push({ group: g, sets })
    }
    return { day, type, muscles }
  })
}

export function weekTotals(priorities: MusclePriorities | null, landmarks?: Record<string, Landmark>): { weekOne: number; peak: number } {
  let weekOne = 0
  let peak = 0
  for (const g of TIER_GROUPS) {
    const lm = landmarkOf(g, landmarks)
    if (!lm) continue
    const tier = tierOf(priorities ?? {}, g)
    weekOne += weekOneSets(tier, lm)
    peak += ceilingSets(tier, lm)
  }
  return { weekOne, peak }
}

export function frequencyOf(frames: DayFrame[], group: string): number {
  return frames.filter((f) => f.muscles.some((m) => m.group === group)).length
}
```
Check `tierOf`'s signature in `musclePriorities.ts:25` (it takes `(value, group)`); if it accepts `null` directly, drop the `?? {}`.

- [ ] **Step 4: Run green** — `pnpm vitest run src/features/train/logic/mesoPlan.test.ts` → 6 passed.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/features/train/logic/mesoPlan.ts frontend/src/features/train/logic/mesoPlan.test.ts
git commit -m "feat(train-fe): mesoPlan — FE mirror of the plan skeleton (split, frames, tier bands) (mezo-<id>)"
```

---

### Task 2: Data layer — `trainApi.generateMesoPlan` + `useMesoPlanGenerate` (dual-mode) + MSW

**Files:**
- Modify: `frontend/src/data/train/trainApi.ts` (type re-exports ~line 6-20, client method next to `createMesoTemplate` ~line 63)
- Create: `frontend/src/data/train/mesoPlanHooks.ts`, `frontend/src/data/train/mesoPlanMock.ts`
- Modify: `frontend/src/data/hooks.ts` (train block ~line 29-39), `frontend/src/test/msw/handlers.ts` (after the meso-template handlers ~line 741)
- Test: `frontend/src/data/train/mesoPlanHooks.test.tsx`

**Interfaces:**
- Produces: `trainApi.generateMesoPlan(body: MesoPlanGenerateRequest): Promise<MesoPlanGenerateResponse>`; `export type MesoPlanGenerateRequest/MesoPlanGenerateResponse` from `trainApi.ts`; `useMesoPlanGenerate(): { generate(input: MesoPlanGenerateRequest): Promise<MesoPlanProposal>; generating: boolean; error: boolean }` where `MesoPlanProposal = { template: MesoTemplateUpsertRequest; days: MesoDay[]; rationale: string; llmUsed: boolean }` (`days` = the template's days converted with the existing `seedDays` from `logic/mesoDays.ts` so the editor gets ids); `mockMesoPlan(input, library: ExerciseLibraryItem[]): MesoPlanGenerateResponse`.

- [ ] **Step 1: Write the failing hook test (both modes)**

```tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useMesoPlanGenerate } from '@/data/train/mesoPlanHooks'

const input = { daysOfWeek: ['Hét', 'Sze', 'Pén', 'Szo'], weeks: 6, priorities: { back: 'emphasize' }, goalText: 'röpi' }

describe('useMesoPlanGenerate', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('mock mode: answers synchronously with a 7-day deterministic proposal, llmUsed false', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useMesoPlanGenerate(), { wrapper: makeHookWrapper() })
    let p!: Awaited<ReturnType<typeof result.current.generate>>
    await act(async () => { p = await result.current.generate(input) })
    expect(p.llmUsed).toBe(false)
    expect(p.template.days).toHaveLength(7)
    expect(p.days).toHaveLength(7)
    expect(p.days.every((d) => typeof d.id === 'string')).toBe(true)
    expect(p.template.split).toBe('Upper / Lower · 4×/hét')
    const backSets = p.template.days.flatMap((d) => d.exercises ?? []).filter((e) => (e.muscle ?? '').startsWith('back')).reduce((s, e) => s + e.workingSets, 0)
    expect(backSets).toBe(12)
  })

  it('real mode: posts the request and maps the response', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    let posted: unknown = null
    server.use(http.post(`${API_BASE}/api/train/meso-plans/generate`, async ({ request }) => {
      posted = await request.json()
      return HttpResponse.json({
        template: { title: 'Hypertrophy · Ősz', weeks: 6, phaseCurve: ['MEV', 'Deload'], split: 'Upper / Lower · 4×/hét', goalPreset: 'hypertrophy', days: [{ day: 'Hét', type: 'Upper', exercises: [] }] },
        rationale: 'teszt', llmUsed: true,
      })
    }))
    const { result } = renderHook(() => useMesoPlanGenerate(), { wrapper: makeHookWrapper() })
    let p!: Awaited<ReturnType<typeof result.current.generate>>
    await act(async () => { p = await result.current.generate(input) })
    expect(posted).toMatchObject({ daysOfWeek: input.daysOfWeek, weeks: 6, priorities: { back: 'emphasize' }, goalText: 'röpi' })
    expect(p.llmUsed).toBe(true)
    expect(p.rationale).toBe('teszt')
    await waitFor(() => expect(result.current.generating).toBe(false))
  })
})
```
Verify `makeHookWrapper` exists in `frontend/src/test/queryWrapper.tsx` (recon says it does) and `API_BASE` is exported from `data/_client/api.ts` (check `grep -n 'export const API_BASE' frontend/src/data/_client/api.ts`; other tests import it — copy their import path).

- [ ] **Step 2: Run to see it fail** — `pnpm vitest run src/data/train/mesoPlanHooks.test.tsx` → import resolution error.

- [ ] **Step 3: trainApi additions**

```ts
export type MesoPlanGenerateRequest = components['schemas']['MesoPlanGenerateRequest']
export type MesoPlanGenerateResponse = components['schemas']['MesoPlanGenerateResponse']
// …inside trainApi, after createMesoTemplate:
  generateMesoPlan: (body: MesoPlanGenerateRequest): Promise<MesoPlanGenerateResponse> =>
    apiFetch<MesoPlanGenerateResponse>('/api/train/meso-plans/generate', { method: 'POST', body: JSON.stringify(body) }),
```

- [ ] **Step 4: `mesoPlanMock.ts` — mock proposal from the FE skeleton + the mock library**

```ts
// Mock-mode twin of the backend generator: same frames (logic/mesoPlan), exercises from the
// mock exercise library (compound-first, stim-desc, rotating on the 2nd weekly occurrence).
import type { ExerciseLibraryItem } from '@/data/types'
import type { GymExerciseInput, MesoDayInput, MesoPlanGenerateRequest, MesoPlanGenerateResponse } from '@/data/train/trainApi'
import { GROUP_LANDMARKS, budgetGroup } from '@/features/train/logic/setBudget'
import { SPLIT_LABELS, dayFrames } from '@/features/train/logic/mesoPlan'
import { getSeason } from '@/features/train/logic/mesoDates'

const phaseCurve = (weeks: number): MesoDayInput extends never ? never : ('MEV' | 'MAV' | 'MRV' | 'Deload')[] => {
  const ramp = Math.max(1, weeks - 1)
  const mevWeeks = ramp >= 4 ? 2 : 1
  const out: ('MEV' | 'MAV' | 'MRV' | 'Deload')[] = []
  for (let i = 0; i < ramp; i++) out.push(i === ramp - 1 && ramp > 1 ? 'MRV' : i < mevWeeks ? 'MEV' : 'MAV')
  out.push('Deload')
  return out
}

function pick(group: string, sets: number, library: ExerciseLibraryItem[], rotation: number): GymExerciseInput[] {
  const pool = library
    .filter((e) => e.type !== 'plyo' && budgetGroup(e.muscle) === group)
    .sort((a, b) => (a.type === 'compound' ? 0 : 1) - (b.type === 'compound' ? 0 : 1) || b.stim - a.stim || a.name.localeCompare(b.name))
  if (!pool.length || sets <= 0) return []
  const count = Math.min(pool.length, sets >= 6 ? 2 : 1)
  const offset = (rotation * count) % pool.length
  const base = Math.floor(sets / count)
  const rem = sets % count
  return Array.from({ length: count }, (_, i) => {
    const e = pool[(offset + i) % pool.length]
    const compound = e.type === 'compound'
    return {
      name: e.name, muscle: e.muscle, catalogId: e.catalogId ?? e.id,
      warmupSets: compound ? 2 : 1, workingSets: base + (i < rem ? 1 : 0),
      repMin: compound ? 8 : 12, repMax: compound ? 10 : 15, targetRIR: 1,
      type: e.type, countsTowardVolume: true,
    }
  })
}

export function mockMesoPlan(input: MesoPlanGenerateRequest, library: ExerciseLibraryItem[]): MesoPlanGenerateResponse {
  const priorities = Object.fromEntries(Object.entries(input.priorities ?? {}).filter(([, t]) => t !== 'grow')) as Record<string, 'emphasize' | 'maintain'>
  const frames = dayFrames(input.daysOfWeek, priorities as never)
  const occurrence = new Map<string, number>()
  const days: MesoDayInput[] = frames.map((f) => {
    if (f.type === 'Rest') return { day: f.day, type: 'Rest', muscle: '', note: 'Pihenőnap', exercises: [] }
    const exercises = f.muscles.flatMap((m) => {
      const rot = occurrence.get(m.group) ?? 0
      occurrence.set(m.group, rot + 1)
      return pick(m.group, m.sets, library, rot)
    })
    return { day: f.day, type: f.type, muscle: f.muscles[0]?.group ?? '', exercises }
  })
  const n = Math.min(6, Math.max(2, input.daysOfWeek.length))
  return {
    template: {
      title: `Hypertrophy · ${getSeason(new Date().toISOString().slice(0, 10))}`,
      shortTitle: 'Hypertrophy', goal: 'Izomtömeg építés', goalPreset: 'hypertrophy',
      musclePriorities: Object.keys(priorities).length ? priorities : null,
      weeks: input.weeks, split: `${SPLIT_LABELS[n]} · ${input.daysOfWeek.length}×/hét`, style: `RP · ${input.weeks} hét`,
      phaseCurve: phaseCurve(input.weeks), notes: input.goalText?.trim() || null,
      volumePerMuscle: Object.fromEntries(Object.entries(GROUP_LANDMARKS).map(([g, lm]) => [g, { name: 'RP guidelines · intermediate', ...lm }])),
      days,
    },
    rationale: 'Determinisztikus kiosztás: a split a napszámból, a szettek a MEV/MAV/MRV sávokból — bármit cserélhetsz.',
    llmUsed: false,
  }
}
```
Simplify the `phaseCurve` return type to `MesoPlanGenerateResponse['template']['phaseCurve']` — the conditional type above is a placeholder-free but clumsy annotation; use the indexed type. `getSeason` comes from Task 4's `logic/mesoDates.ts` — until Task 4 lands, import it from `logic/planner.ts` (it exists there) and switch the import in Task 4.

- [ ] **Step 5: `mesoPlanHooks.ts`**

```ts
import { useMutation } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { trainApi, type MesoPlanGenerateRequest, type MesoPlanGenerateResponse, type MesoTemplateUpsertRequest } from '@/data/train/trainApi'
import { exerciseLibrary } from '@/data/train/train'
import type { MesoDay } from '@/data/types'
import { seedDays } from '@/features/train/logic/mesoDays'
import { mockMesoPlan } from '@/data/train/mesoPlanMock'

export interface MesoPlanProposal {
  template: MesoTemplateUpsertRequest
  /** The template's days with client ids (seedDays) — what the editor mutates. */
  days: MesoDay[]
  rationale: string
  llmUsed: boolean
}

function toProposal(r: MesoPlanGenerateResponse): MesoPlanProposal {
  const days = seedDays(r.template.days.map((d) => ({
    day: d.day, type: d.type, muscle: d.muscle ?? '', note: d.note ?? undefined,
    exerciseCount: d.exercises?.length ?? 0,
    exercises: (d.exercises ?? []).map((e) => ({ ...e, id: '' })) as MesoDay['exercises'],
  })) as MesoDay[])
  return { template: r.template, days, rationale: r.rationale, llmUsed: r.llmUsed }
}

/** Generate a hypertrophy plan proposal (nothing persisted). Mock = FE skeleton + mock library. */
export function useMesoPlanGenerate() {
  const mock = isMockMode()
  const m = useMutation({
    mutationFn: mock
      ? async (input: MesoPlanGenerateRequest) => toProposal(mockMesoPlan(input, exerciseLibrary))
      : (input: MesoPlanGenerateRequest) => trainApi.generateMesoPlan(input).then(toProposal),
  })
  return {
    generate: (input: MesoPlanGenerateRequest): Promise<MesoPlanProposal> => m.mutateAsync(input),
    generating: m.isPending,
    error: m.isError,
  }
}
```
Check `seedDays`'s exact input type in `logic/mesoDays.ts:15` and adapt the cast (it assigns ids to days and exercises).

- [ ] **Step 6: Barrel + MSW**

`data/hooks.ts` train block: `export { useMesoPlanGenerate } from '@/data/train/mesoPlanHooks'` and `export type { MesoPlanProposal } from '@/data/train/mesoPlanHooks'`.

`test/msw/handlers.ts` after the `/start` handler:
```ts
  // Meso plan generator (wizard redesign): deterministic default so real-mode wizard tests
  // can render a 7-day proposal without scripting; tests override per case with server.use.
  http.post(`${API_BASE}/api/train/meso-plans/generate`, async ({ request }) => {
    const body = (await request.json()) as { daysOfWeek: string[]; weeks: number; priorities?: Record<string, string> | null; goalText?: string | null }
    const training = new Set(body.daysOfWeek)
    const days = ['Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas'].map((day, i) => training.has(day)
      ? { day, type: i % 2 === 0 ? 'Upper' : 'Lower', muscle: i % 2 === 0 ? 'back' : 'quad', exercises: [
          { name: i % 2 === 0 ? 'Row' : 'Squat', muscle: i % 2 === 0 ? 'back-mid' : 'quad', warmupSets: 2, workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound', catalogId: 'c1f3a0e2-0000-4000-8000-000000000002' } ] }
      : { day, type: 'Rest', muscle: '', note: 'Pihenőnap', exercises: [] })
    return HttpResponse.json({
      template: { title: 'Hypertrophy · Ősz', shortTitle: 'Hypertrophy', goal: 'Izomtömeg építés', goalPreset: 'hypertrophy',
        musclePriorities: body.priorities ?? null, weeks: body.weeks, split: `Upper / Lower · ${body.daysOfWeek.length}×/hét`, style: `RP · ${body.weeks} hét`,
        phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'], notes: body.goalText ?? null, volumePerMuscle: null, days },
      rationale: 'MSW alap kiosztás', llmUsed: false,
    })
  }),
```

- [ ] **Step 7: Run green in both modes**
```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run src/data/train/mesoPlanHooks.test.tsx && VITE_USE_MOCK=false pnpm vitest run src/data/train/mesoPlanHooks.test.tsx
```

- [ ] **Step 8: Commit**
```bash
git add frontend/src/data/train/trainApi.ts frontend/src/data/train/mesoPlanHooks.ts frontend/src/data/train/mesoPlanMock.ts frontend/src/data/train/mesoPlanHooks.test.tsx frontend/src/data/hooks.ts frontend/src/test/msw/handlers.ts
git commit -m "feat(train-fe): useMesoPlanGenerate dual-mode hook + mock proposal + MSW (mezo-<id>)"
```

---

### Task 3: `WeeklyBandsCard` replaces `SetBudgetCard`

**Files:**
- Create: `frontend/src/features/train/components/WeeklyBandsCard.tsx`, `frontend/src/features/train/logic/weeklyBands.ts`
- Delete: `frontend/src/features/train/components/SetBudgetCard.tsx` (+ its test if present)
- Modify: `frontend/src/features/train/components/MesoEditor.tsx` (~line 66-84 derivations; the `<SetBudgetCard …/>` mount), `frontend/src/features/train/sheets/MuscleWeekSheet.tsx` (~line 20-21 import + mount)
- Modify: `frontend/src/styles/prototype.css` — add `--mz-band-*` tokens? No: reuse `--mz-cell-*` tones and `--mz-ink-soft`; add only the `.mz-band` / `.mz-band-bar` classes in the Mozaik section (no new tokens).
- Test: `frontend/src/features/train/logic/weeklyBands.test.ts`, `frontend/src/features/train/components/WeeklyBandsCard.test.tsx`

**Interfaces:**
- Produces:
```ts
// logic/weeklyBands.ts
export interface BandRow { group: string; label: string; tier: MuscleTier; planned: number /* sets in the days */; start: number; ceiling: number; pct: number /* planned/ceiling, 0..100+ */; step: '+2' | 'hold' }
export function weeklyBands(days: MesoDay[], priorities: MusclePriorities | null, landmarks?: Record<string, Landmark>): BandRow[]  // sorted ceiling desc; groups with no planned sets and no landmark are omitted; counts only countsForVolume(ex) working sets via budgetGroup(ex.muscle)
// components/WeeklyBandsCard.tsx
export function WeeklyBandsCard({ rows, eyebrow = 'Heti szetek · izmonként', note }: { rows: BandRow[]; eyebrow?: string; note?: string })
```
Row markup (prototype `.mband`): muscle pill (`muscleColor(group)` wash), tier chip (`Emphasize` coral / `Grow` sage / `Maintain` dashed), `▲ +2 / hét` or `= tart`, `12 → 22` (nowrap, `tabular-nums`), thin bar `pct`. No percentages as text anywhere.

- [ ] **Step 1: Failing logic test**

```ts
import { describe, expect, it } from 'vitest'
import { weeklyBands } from './weeklyBands'
import type { MesoDay } from '@/data/types'

const ex = (muscle: string, sets: number, type: 'compound' | 'isolation' = 'compound') =>
  ({ id: muscle + sets, name: muscle, muscle, warmupSets: 1, workingSets: sets, repMin: 8, repMax: 10, targetRIR: 1, type })
const days: MesoDay[] = [
  { day: 'Hét', type: 'Upper', muscle: 'back', exerciseCount: 2, exercises: [ex('back-mid', 6), ex('chest-mid', 4)] },
  { day: 'Csü', type: 'Upper', muscle: 'back', exerciseCount: 2, exercises: [ex('back-wide', 6), ex('chest-upper', 4)] },
]

describe('weeklyBands', () => {
  it('sums planned working sets per coarse group and pairs them with the tier band', () => {
    const rows = weeklyBands(days, { back: 'emphasize' })
    const back = rows.find((r) => r.group === 'back')!
    expect(back).toMatchObject({ planned: 12, start: 12, ceiling: 22, tier: 'emphasize', step: '+2' })
    const chest = rows.find((r) => r.group === 'chest')!
    expect(chest).toMatchObject({ planned: 8, start: 8, ceiling: 14, tier: 'grow' })
  })
  it('orders by ceiling desc so Emphasize reads first and never prints a percentage label', () => {
    const rows = weeklyBands(days, { back: 'emphasize' })
    expect(rows[0].group).toBe('back')
    expect(rows.every((r) => typeof r.pct === 'number')).toBe(true)
  })
  it('marks maintain as hold', () => {
    const rows = weeklyBands(days, { chest: 'maintain' })
    expect(rows.find((r) => r.group === 'chest')).toMatchObject({ step: 'hold', ceiling: 8 })
  })
})
```

- [ ] **Step 2: Run to fail**, then implement `weeklyBands.ts`:

```ts
import type { MesoDay, MusclePriorities, MuscleTier } from '@/data/types'
import { BUDGET_GROUP_LABELS, GROUP_LANDMARKS, budgetGroup, countsForVolume } from '@/features/train/logic/setBudget'
import { tierOf } from '@/features/train/logic/musclePriorities'
import { ceilingSets, weekOneSets, type Landmark } from '@/features/train/logic/mesoPlan'

export interface BandRow {
  group: string; label: string; tier: MuscleTier; planned: number; start: number; ceiling: number; pct: number; step: '+2' | 'hold'
}

export function weeklyBands(days: MesoDay[], priorities: MusclePriorities | null, landmarks?: Record<string, Landmark>): BandRow[] {
  const planned = new Map<string, number>()
  for (const d of days) for (const ex of d.exercises ?? []) {
    if (!countsForVolume(ex)) continue
    const g = budgetGroup(ex.muscle)
    if (!g) continue
    planned.set(g, (planned.get(g) ?? 0) + ex.workingSets)
  }
  const rows: BandRow[] = []
  for (const [group, sets] of planned) {
    const lm = landmarks?.[group] ?? GROUP_LANDMARKS[group]
    if (!lm) continue
    const tier = tierOf(priorities ?? {}, group)
    const start = weekOneSets(tier, lm)
    const ceiling = ceilingSets(tier, lm)
    rows.push({
      group, label: BUDGET_GROUP_LABELS[group] ?? group, tier, planned: sets, start, ceiling,
      pct: Math.round((sets / ceiling) * 100), step: tier === 'maintain' || sets >= ceiling ? 'hold' : '+2',
    })
  }
  return rows.sort((a, b) => b.ceiling - a.ceiling || a.label.localeCompare(b.label))
}
```

- [ ] **Step 3: Component + CSS**

`WeeklyBandsCard.tsx`:
```tsx
import type { BandRow } from '@/features/train/logic/weeklyBands'
import { muscleColor } from '@/features/train/logic/muscleColors'

const TIER_LABEL = { emphasize: 'Emphasize', grow: 'Grow', maintain: 'Maintain' } as const

export function WeeklyBandsCard({ rows, eyebrow = 'Heti szetek · izmonként', note }: { rows: BandRow[]; eyebrow?: string; note?: string }) {
  if (!rows.length) return null
  return (
    <div className="mz-card mz-bands" aria-label={eyebrow}>
      <div className="mz-eyebrow">{eyebrow}</div>
      {rows.map((r) => {
        const fam = muscleColor(r.group)
        return (
          <div className="mz-band" key={r.group} role="group" aria-label={`${r.label} · ${TIER_LABEL[r.tier]}`}>
            <div className="mz-band-row">
              <span className="mz-pill" style={{ background: fam.wash, color: fam.ink }}>{r.label}</span>
              <span className={`mz-tchip mz-tchip-${r.tier}`}>{TIER_LABEL[r.tier]}</span>
              <span className="mz-grow" />
              {r.tier !== 'maintain' && <span className="mz-stepchip">{r.step === '+2' ? '▲ +2 / hét' : 'plafonon'}</span>}
              <span className="mz-band-nums">{r.tier === 'maintain' ? `${r.planned} szett · tart` : `${r.planned} → ${r.ceiling}`}</span>
            </div>
            {r.tier !== 'maintain' && (
              <div className="mz-band-bar"><div style={{ width: `${Math.min(100, r.pct)}%`, background: fam.ink }} /></div>
            )}
          </div>
        )
      })}
      {note && <div className="mz-habnote">{note}</div>}
    </div>
  )
}
```
Check `muscleColor`'s return shape in `logic/muscleColors.ts` (recon: used with `.wash`/`.ink`-like fields by `MusclePriorityPicker`); adapt the two property names. CSS (Mozaik section of `prototype.css`, tokens already present):
```css
/* Weekly bands (wizard redesign) — current → ceiling per muscle, no percentages */
.mz-bands { display: grid; gap: 2px; }
.mz-band { padding: 7px 0; }
.mz-band + .mz-band { border-top: 0.5px solid var(--mz-line, rgba(43, 33, 24, 0.08)); }
.mz-band-row { display: flex; align-items: center; gap: 8px; }
.mz-band-nums { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.mz-band-bar { height: 9px; border-radius: 5px; background: var(--mz-cellbg); overflow: hidden; margin-top: 5px; }
.mz-band-bar > div { height: 100%; border-radius: 5px; }
.mz-tchip { font-size: 9px; font-weight: 700; border-radius: 999px; padding: 2px 9px; }
.mz-tchip-emphasize { background: var(--mz-cell-coral-bg); color: var(--mz-cell-coral-ink); }
.mz-tchip-grow { background: var(--mz-cell-sage-bg); color: var(--mz-cell-sage-ink); }
.mz-tchip-maintain { border: 1px dashed var(--mz-ink-mut); color: var(--mz-ink-mut); }
.mz-stepchip { font-size: 9.5px; font-weight: 700; color: var(--mz-cell-sage-ink); }
```
If `--mz-line` does not exist, use the literal-free alternative already used by `.mz-band`-like rules in the file (grep `border-top: 0.5px solid` in the Mozaik section and reuse that token).

- [ ] **Step 4: Component test**
```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WeeklyBandsCard } from './WeeklyBandsCard'

describe('WeeklyBandsCard', () => {
  it('renders current → ceiling per muscle and no percent sign', () => {
    render(<WeeklyBandsCard rows={[
      { group: 'back', label: 'Hát', tier: 'emphasize', planned: 12, start: 12, ceiling: 22, pct: 55, step: '+2' },
      { group: 'calf', label: 'Vádli', tier: 'maintain', planned: 6, start: 6, ceiling: 6, pct: 100, step: 'hold' },
    ]} />)
    expect(screen.getByText('12 → 22')).toBeInTheDocument()
    expect(screen.getByText('6 szett · tart')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).toBeNull()
    expect(screen.getByRole('group', { name: 'Hát · Emphasize' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Re-home the two mounts.** In `MesoEditor.tsx` replace the `muscleBudgets(...)` derivation + `<SetBudgetCard budgets=… capWarnings=…/>` with `const bands = useMemo(() => weeklyBands(days, priorities ?? null, volumePerMuscle ?? undefined), [days, priorities, volumePerMuscle])` and `<WeeklyBandsCard rows={bands} note="1. hét → plafon. Az Emphasize izmok kapják a legtöbbet." />`; keep `sessionCapWarnings` feeding `DayBreakdownCard` (cap stays 8 — change `SESSION_MUSCLE_CAP` in `setBudget.ts:36` from 11 to 8 and fix the assertions in `setBudget.test.ts` that pin 11). In `MuscleWeekSheet.tsx` do the same swap (`weeklyBands(meso.days ?? [], meso.musclePriorities ?? null, meso.volumePerMuscle …)` — `volumePerMuscle` there is `Record<string, VolumeProfile>`, which structurally satisfies `Landmark`). Delete `SetBudgetCard.tsx` and its test; delete `muscleBudgets`/`MuscleBudgetRow`/`NEAR_THRESHOLD`/`BudgetLevel` from `setBudget.ts` ONLY IF `grep -rn 'muscleBudgets\|MuscleBudgetRow' frontend/src --include='*.ts*'` shows no remaining consumer besides `weekZone.ts` (which uses it — keep it then; remove only the `%`-producing `pillText` in the deleted card).

- [ ] **Step 6: Run** `pnpm vitest run src/features/train` in both modes; fix the `MesoEditor`/`MuscleWeekSheet`/`setBudget` tests that pinned `Set-büdzsé`/`%` copy (replace with the new card's texts). **Commit**
```bash
git add -A frontend/src/features/train frontend/src/styles/prototype.css
git commit -m "feat(train-fe): WeeklyBandsCard (current → ceiling) replaces SetBudgetCard %; session cap 8 (mezo-<id>)"
```

---

### Task 4: Retire presets/splits/planner/programFit; keep the survivors

**Files:**
- Create: `frontend/src/features/train/logic/mesoDates.ts` (move `addWeeks`, `getSeason` out of `planner.ts` verbatim + their tests from `planner.test.ts` into `mesoDates.test.ts`)
- Modify: `frontend/src/features/train/logic/exerciseDefaults.ts` (inline the hypertrophy scheme)
- Delete: `frontend/src/features/train/logic/planner.ts`, `planner.test.ts`, `programFit.ts`, `programFit.test.ts`, `frontend/src/features/train/components/PlannerExerciseRow.tsx` (orphan)
- Modify: `frontend/src/data/train/train.ts` (delete `GOAL_PRESETS` :1130-1137, `SPLITS` :1138-1145), `frontend/src/data/types.ts` (delete `GoalPreset`, `SplitOption` :1240-1245), `frontend/src/data/train/trainData.test.tsx` (:51-54 assertions), `frontend/src/features/train/pages/MesoTemplateEditorPage.tsx` (drop the Cél select + `GOAL_PRESET_OPTIONS`; `toUpsert` keeps `goalPreset: template.goalPreset` pass-through), its test (`:66` "Cél dropdown" case → delete)

- [ ] **Step 1: `exerciseDefaults.ts`** — replace the `SCHEMES`/`PLYO_SCHEME` import with local constants copied from `planner.ts:48-63` for the `hypertrophy` entry only:
```ts
// Single-model scheme (wizard redesign): every new exercise is a hypertrophy exercise.
const HYPERTROPHY_SCHEME = { /* copy SCHEMES.hypertrophy verbatim from planner.ts:48-59 */ }
const PLYO_SCHEME = { reps: 5, sets: 3 }
```
and change `const scheme = (SCHEMES[preset ?? 'hypertrophy'] ?? SCHEMES.hypertrophy)[item.type]` to `const scheme = HYPERTROPHY_SCHEME[item.type]`; keep the `preset` parameter (callers still pass it) but mark it `_preset?: string | null` unused.

- [ ] **Step 2: Move dates**, delete the files, fix imports (`grep -rn "logic/planner'" frontend/src`), remove `GOAL_PRESETS`/`SPLITS`/types and the template editor's select. Update `MesoTemplateEditorPage.test.tsx` (drop the Cél dropdown case; keep the priority carry cases).

- [ ] **Step 3: Run the whole train suite in both modes + build**
```bash
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/features/train src/data && VITE_USE_MOCK=true pnpm vitest run src/features/train src/data && pnpm build
```
Expected: the only failures are in `MesocyclePlannerPage.test.tsx` (rewritten in Task 5) — temporarily skip that file with `describe.skip` in this commit and note it in the commit body.

- [ ] **Step 4: Commit**
```bash
git add -A frontend/src
git commit -m "refactor(train-fe): retire GOAL_PRESETS/SPLITS/planner/programFit; hypertrophy-only exercise defaults (mezo-<id>)"
```

---

### Task 5: The 3-step wizard

**Files:**
- Rewrite: `frontend/src/features/train/pages/MesocyclePlannerPage.tsx`
- Create: `frontend/src/features/train/wizard/StepWhen.tsx`, `wizard/StepFocus.tsx`, `wizard/StepProgram.tsx`, `wizard/ProgramDayView.tsx`, `wizard/DayTile.tsx`, `wizard/wizardState.ts`
- Modify: `frontend/src/styles/prototype.css` (Mozaik section: `.mz-dct`, `.mz-daypick`, `.mz-stepcard`, `.mz-dtile*`, `.mz-genwait` — px ×1.18 of the prototype values; washes via existing `--mz-wash-*`/`--mz-cell-*` tokens; add `--mz-genwait-orb` ONLY if no existing coral gradient token fits — declare in both `:root` blocks)
- Rewrite: `frontend/src/features/train/pages/MesocyclePlannerPage.test.tsx`

**Interfaces:**
- `wizardState.ts`:
```ts
export interface WizardState {
  step: 0 | 1 | 2
  daysOfWeek: string[]            // default recommendedDays(4)
  weeks: number                   // default 6
  priorities: MusclePriorities    // default {}
  goalText: string
  name: string                    // default `Hypertrophy · ${getSeason(today)}`
  proposal: MesoPlanProposal | null
  program: MesoDay[]              // editable copy of proposal.days
  dirty: boolean                  // manual edit since last generation
  activeDay: string | null        // ProgramDayView open for this day
}
export type WizardAction =
  | { type: 'setDays'; days: string[] } | { type: 'setDayCount'; n: number } | { type: 'setWeeks'; weeks: number }
  | { type: 'setPriorities'; priorities: MusclePriorities } | { type: 'setGoalText'; text: string } | { type: 'setName'; name: string }
  | { type: 'step'; step: 0 | 1 | 2 } | { type: 'generated'; proposal: MesoPlanProposal }
  | { type: 'editProgram'; program: MesoDay[] } | { type: 'openDay'; day: string | null }
export function wizardReducer(s: WizardState, a: WizardAction): WizardState
export function initialWizardState(today: string): WizardState
export function toUpsert(s: WizardState): MesoTemplateUpsertRequest   // proposal.template + {title: name, weeks, musclePriorities: sparse(priorities) | null, days: toDayInputs(program), notes: goalText || null}
export function generateInput(s: WizardState): MesoPlanGenerateRequest  // {daysOfWeek, weeks, priorities: sparse or null, goalText: goalText || null}
```
`setDayCount` replaces `daysOfWeek` with `recommendedDays(n)`; `setDays` sorts by `DAY_ORDER`; `editProgram` sets `dirty: true`; `generated` sets `proposal`, `program: proposal.days`, `dirty: false`.

- [ ] **Step 1: Failing reducer test** (`wizard/wizardState.test.ts`)
```ts
import { describe, expect, it } from 'vitest'
import { generateInput, initialWizardState, toUpsert, wizardReducer } from './wizardState'

describe('wizardReducer', () => {
  const s0 = initialWizardState('2026-09-02')
  it('starts with 4 recommended days, 6 weeks, grow-only priorities and a seasonal name', () => {
    expect(s0.daysOfWeek).toEqual(['Hét', 'Sze', 'Pén', 'Szo'])
    expect(s0.weeks).toBe(6)
    expect(s0.name).toBe('Hypertrophy · Ősz')
  })
  it('setDayCount swaps in the recommended pattern and setDays keeps DAY_ORDER', () => {
    expect(wizardReducer(s0, { type: 'setDayCount', n: 2 }).daysOfWeek).toEqual(['Hét', 'Csü'])
    expect(wizardReducer(s0, { type: 'setDays', days: ['Szo', 'Hét'] }).daysOfWeek).toEqual(['Hét', 'Szo'])
  })
  it('generateInput sends a sparse priority map and null goal when empty', () => {
    const s = wizardReducer(s0, { type: 'setPriorities', priorities: { back: 'emphasize', chest: 'grow' } })
    expect(generateInput(s)).toEqual({ daysOfWeek: ['Hét', 'Sze', 'Pén', 'Szo'], weeks: 6, priorities: { back: 'emphasize' }, goalText: null })
  })
  it('editProgram marks dirty; generated resets it and copies the days', () => {
    const proposal = { template: { title: 't', weeks: 6, phaseCurve: ['MEV', 'Deload'], days: [] }, days: [{ day: 'Hét', type: 'Upper', muscle: 'back', exerciseCount: 0, exercises: [], id: 'd1' }], rationale: 'r', llmUsed: false } as never
    const g = wizardReducer(s0, { type: 'generated', proposal })
    expect(g.dirty).toBe(false)
    expect(g.program).toHaveLength(1)
    expect(wizardReducer(g, { type: 'editProgram', program: [] }).dirty).toBe(true)
    expect(toUpsert(g)).toMatchObject({ title: 'Hypertrophy · Ősz', weeks: 6, musclePriorities: null, days: [{ day: 'Hét', type: 'Upper' }] })
  })
})
```

- [ ] **Step 2: Implement `wizardState.ts`** exactly per the interface (use `toDayInputs` from `logic/mesoDays.ts`, `recommendedDays` from `logic/mesoPlan.ts`, `getSeason` from `logic/mesoDates.ts`; `sparse(p)` = entries whose tier !== 'grow', `null` when empty).

- [ ] **Step 3: Step components (prototype `#page-wizard`)**

`StepWhen` props `{ state: WizardState; dispatch }`: three `.mz-stepcard` cards inside an `EntranceGroup`, `.rise` with `delayMs` 40/110/180:
1. coral `ClayIcon name="i-edzes"` eyebrow `Edzésnapok` + right-aligned `{days.length}/{days.length}`; five `.mz-dct` buttons `2…6` with sublabels `full body · full body · upper/lower · U/L + PPL · PPL ×2` (`aria-pressed` on the active count, dispatch `setDayCount`); the 7 round `.mz-daypick` buttons `H K Sze Cs P Szo V` mapping to `DAY_ORDER` tokens (`aria-pressed`, dispatch `setDays` toggling); a coach line (`.mz-coach`) with `splitLine(days)`.
2. lavender `i-mezo` eyebrow `A célod · opcionális`; `<textarea rows=3 maxLength=400 placeholder="pl. röplabda szezon mellett, a vállam kímélve — de a hát és a váll nagyon jöhet" aria-label="Mit szeretnél ebben a blokkban?">`; hint text under it.
3. gold `s-hajtas` (`ClaySpot`) eyebrow `Ami magától megy`; `StatStrip` with `StatCell`s `5 + 1 / rámpa + deload hét`, `+2 / szett / hét / izom`, `~8 / szett-plafon / edzés`.
`canNext = daysOfWeek.length >= 2 && <= 6`.

`StepFocus`: `<MusclePriorityPicker value onChange>` (unchanged component) + `StatStrip` with `weekTotals(priorities)` → cells `{weekOne} / szett · 1. hét`, `{peak} / szett · csúcshét`; coach card text "Emphasize → MEV+2-ről indul, MRV-ig rámpázik · Grow → MEV-ről MAV-ig · Maintain → MEV-en tart."

`StepProgram` props `{ state, dispatch, generating, onRegenerate, onSave(alsoStart: boolean), saving }`:
- while `generating`: `.mz-genwait` (pulsing orb + `Mezo összerakja a blokkod…` + `determinisztikus váz + a célod szerinti gyakorlatok`), `role="status"`.
- hero (`.mz-edhero`): eyebrow `A te blokkod` + `↺ Újragenerálás` ghost button; `<input aria-label="Mesociklus neve">` bound to `name`; `StatStrip` cells `{weeks} hét · {days.length}× nap/hét · {weekOne} szett · W1 · {peak} szett · csúcs`; coach bubble with `proposal.rationale` and a small line `Gemini · a determinisztikus kereteken belül` when `llmUsed`, else `alap gyakorlat-kiosztás — újragenerálhatod`; `CollapsibleStrip eyebrow="Hossz"` with a `.segtab` `4 5 6 7 8` (`aria-pressed`, dispatch `setWeeks`; changing weeks after generation shows the regenerate hint, it does not regenerate).
- `Mosaic` of `DayTile`s (one per training day, from `program` — a day with `type !== 'Rest'`): `DayTile { day, type, sets, minutes, muscles: {label, sets, color, over}[], status?: 'now'|'done'|null, onOpen }` → prototype `.dtile` anatomy (day letter + type eyebrow, two mini cells `szett`/`~perc`, per-muscle rows with thin bars). `minutes = Math.round(sets * 4.4)`; muscles via `daySessionBreakdown(day)` from `setBudget.ts` (`DayGroupRow`), `over = sets > SESSION_MUSCLE_CAP`.
- `WeeklyBandsCard rows={weeklyBands(program, priorities, proposal.template.volumePerMuscle)}`.
- `CollapsibleStrip eyebrow="Csúcshét · terhelés-ellenőrzés"` with `peakWeekFit(program, priorities, volumePerMuscle)` summary (existing helper; render its rows as a plain list, no red).
- footer: `CtaPrimary` `✓ Mentés + indítás · {huMonthDay(today)}` → `onSave(true)`, `CtaGhost` `Mentés sablonként` → `onSave(false)`.
- regenerate with `dirty`: render an inline confirm strip (`Kézzel szerkesztett napjaid vannak — az újragenerálás felülírja őket.` + `Újragenerálás` / `Mégse`), never `window.confirm`.

`ProgramDayView` props `{ day: MesoDay; priorities; onBack; onChange(day: MesoDay); onAdd }`: `MozaikPage tone` by type (`Upper|Pull → coral`, `Lower|Legs → sage`, `Push → rose`, `Full → gold`), `PageHead label="‹ Program"`, `PageHero big={dayLetter} name={`${type} nap`} sub={`${sets} szett · ~${minutes} perc · 1. hét · a terv`}`, `StatStrip` of per-muscle cells, then `<MesoEditor days={[day]} priorities … onChange onRemove onReorder onAddClick={onAdd} />` (single-day editor: MesoEditor's day tabs render one tab — acceptable) and the existing `ExercisePickerSheet`. It is a page-state swap inside the planner route (`state.activeDay`), not a new route (the session-prep idiom), so the URL and the unsaved draft survive.

`MesocyclePlannerPage`: `useReducer(wizardReducer, initialWizardState(todayIso))`; `const { generate, generating } = useMesoPlanGenerate()`; `const { createTemplate, startTemplate } = useMesoTemplates()`; `const { gymSlots, saveGymSchedule } = useTrain()`; entering step 2 without a proposal calls `generate(generateInput(state))` then `dispatch({type:'generated'})`; `onRegenerate` same; `onSave(alsoStart)`: `setSaving(true)`; `saveGymSchedule(daysOfWeek.map(d => ({ dayOfWeek: DAY_ORDER.indexOf(d), time: gymSlots.find(s => s.dayOfWeek === DAY_ORDER.indexOf(d))?.time ?? null })))` (preserve existing times, else null — check `saveGymSchedule`'s slot type for `time: string | null`), then `createTemplate(toUpsert(state))` → if `alsoStart` `startTemplate(tpl.id, { startDate: todayIso, status: 'active' })` → `navigate('/train/gym')`, else `navigate('/train/mesocycles')`; failure → stay, `setSaving(false)`. Head: `PageHead label="‹ Mezociklus"` + step counter `0{step+1} / 03 · {label}` + 3-segment progress (`button`s named `1. lépés · Mikor és miért` etc. so tests can jump back; forward jumps disabled). If `generate` fails (real mode network): render the hero with `Nem sikerült a generálás — próbáld újra` + retry button, never a blank body.

- [ ] **Step 4: Rewrite `MesocyclePlannerPage.test.tsx`** — keep the `setup()`/`runWizardToTerminalStep` helpers' shape, assert:
  1. step 0 shows the three cards, day count `4` pressed, 4 day chips pressed incl. `Szo`; tapping `2` presses `H` and `Cs` only; `Tovább` → step 1.
  2. step 1: `MusclePriorityPicker` present; totals cells update when `Hát prioritás` group's `Emphasize` is pressed (`szett · 1. hét` value increases by 2).
  3. step 2 (mock): status `Mezo összerakja a blokkod…` then hero `Hypertrophy · Ősz`, 4 day tiles (`H Upper`, `Sze Lower`, `P Upper`, `Szo Lower`), `Heti szetek · izmonként` card with `12 → 22` for back when emphasized, no `%` text.
  4. tapping a day tile opens the day view (`‹ Program` head, `Upper nap`), removing an exercise there and going back shows the regenerate confirm strip on `↺ Újragenerálás`.
  5. real mode (`vi.stubEnv('VITE_USE_MOCK','false')` + MSW default handler): `✓ Mentés + indítás` posts `days.length === 7`, `goalPreset === 'hypertrophy'`, `musclePriorities === null` (or `{back:'emphasize'}` when set), `notes` equals the typed goal text, then lands on `/train/gym`; `Mentés sablonként` lands on `/train/mesocycles`; a 500 on create keeps the page.
  6. real mode generate failure (MSW 500) shows the retry state.

- [ ] **Step 5: Run both modes + build**, then commit:
```bash
git add -A frontend/src frontend/src/styles/prototype.css
git commit -m "feat(train-fe): 3-step mesocycle wizard (Mikor és miért → Fókusz → Program) on the plan generator (mezo-<id>)"
```

---

### Task 6: Docs, CODEMAP, follow-ups, PR

- [ ] **Step 1: `docs/features/train.md`** — §2 planner paragraph (:108) → describe the 3 steps, the generator call, the day-view swap, the regenerate guard; §4 `#### Set-budget` (:310-333) → `#### Weekly bands` (`weeklyBands` semantics: planned vs `start → ceiling`, tier table, no %); §8 test list (`mesoPlan.test`, `weeklyBands.test`, `WeeklyBandsCard.test`, `wizardState.test`, `mesoPlanHooks.test`, rewritten `MesocyclePlannerPage.test`); §10 file map (add wizard/*, logic/mesoPlan, weeklyBands, mesoDates, data/train/mesoPlanHooks, mesoPlanMock; remove planner, programFit, SetBudgetCard, PlannerExerciseRow). Mark `weekZone.ts` as "still on the fatigue scale (`budgetOf`) — landmark re-basing tracked in <follow-up id>".
- [ ] **Step 2: bd follow-up**
```bash
bd create --title "weekZone/Heti zone rows: re-base from budgetOf fatigue scale to landmark bands" --type task --priority 3 --parent mezo-d20 --description "Spec 2026-09-01 says the fatigue-cap model retires; the wizard slice kept budgetOf for weekZone.ts (Heti/prep/session). Move WeekZoneCard/ZoneMiniGrid/ZoneTrack to weeklyBands-style current→ceiling and delete budgetOf/GROUP_MEV/FAILURE_WEEKLY_CAP/VOLUME_WEEKLY_CAP."
```
- [ ] **Step 3: Gates**
```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs && node scripts/gen-codemap.mjs --check
cd frontend && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build
```
- [ ] **Step 4: Commit, push, PR, CI, merge**
```bash
git add docs && git commit -m "docs(train): wizard v2 + weekly bands; CODEMAP (mezo-<id>)"
git push -u origin feat/meso-wizard-v2
gh pr create --fill --title "feat(train-fe): mesocycle wizard v2 — 3 steps on the plan generator (mezo-<id>)" --body "Spec: docs/superpowers/specs/2026-09-01-mesocycle-wizard-redesign-design.md · Plan: docs/superpowers/plans/2026-09-02-meso-wizard-v2-frontend.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch
git checkout main && git pull --rebase && git merge --no-ff feat/meso-wizard-v2 -m "Merge feat/meso-wizard-v2: 3-step mesocycle wizard (mezo-<id>)" && git push && git branch -d feat/meso-wizard-v2
bd close <id> && bd dolt push
```

---

## Self-review

- **Spec coverage:** 3 steps with day-count tiles, 7-day picker (weekends), goal text (Task 5) ✓; Fókusz with live totals + cap 2 (Task 5, existing picker) ✓; Program = generator call, rationale, Újragenerálás with dirty guard, editable, template-first save (Tasks 2, 5) ✓; deletions of presets/splits/phase editor/% card (Tasks 3–4) ✓; `current → ceiling · tier` everywhere the wizard shows volume (Task 3) ✓; mock parity (Task 2) ✓; docs/CODEMAP (Task 6) ✓. Deviation: `budgetOf` survives for `weekZone` with a filed follow-up — stated explicitly.
- **Placeholder scan:** the two "check the exact signature" notes (`tierOf`, `seedDays`, `muscleColor`, `saveGymSchedule` slot type) carry the file:line to look at; no TBDs.
- **Type consistency:** `Landmark {mev,mav,mrv}` shared by `mesoPlan`, `weeklyBands`, and `VolumeProfile`/`VolumeBaseline` structurally ✓; `MesoPlanProposal.days: MesoDay[]` is what `wizardState.program` holds and `toDayInputs` consumes ✓; `DayType` strings equal the backend `MesoDayInput.type` values ✓.

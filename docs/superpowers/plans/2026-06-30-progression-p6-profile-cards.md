# Progression P6 — FE Profile Cards (athletic radar + muscle levels) + dual-mode mock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. The visual radar (Task 4) additionally uses the **frontend-design** skill (port the chosen `profile-card.html` mockup to app tokens).

**Goal:** Consume the already-shipped P4 `GET /api/progression/profile` endpoint via a new dual-mode `useProgressionProfile()` hook and render two cards below `BiometricCard` in the Me/Profile view: an **AthleticRadarCard** (hand-rolled SVG hexagon radar of the 6 server-computed `radarAxes` + athlete-level / streak / best-skill stats) and a **MuscleLevelsCard** (top-N muscle levels + reserve note). Ghost state before any XP (mirrors `BiometricCard`).

**Architecture:** Pure frontend. The P4 backend already returns `ProgressionProfileResponse {athleteLevel?, streakWeeks, athletic[], muscle[], radarAxes[], highlights}` (types already generated in `api.gen.ts` — **no regen, no backend/contract changes**). New `progressionApi.ts` (GET client) → `progressionHooks.ts` `useProgressionProfile()` (built on `useDualQuery`: seeded mock fixture / real-empty ghost) → re-exported from `data/hooks.ts` → consumed by the two new cards in `ProfileView`. The **radar axes are server-aggregated** (HU label + 1-decimal level value); the card just plots them. Reuses P5's `useReducedMotion` and `levelUpMeta.skillDisplay`/`MUSCLE_LABELS` for labels+icons.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4 + `prototype.css` tokens, TanStack Query (`useDualQuery`), hand-rolled SVG + CSS `@keyframes`, Vitest + Testing Library + MSW.

## Global Constraints

- **Pure FE slice — NO backend/contract/`api.gen.ts` changes.** The `ProgressionProfileResponse` + `SkillLevel` + `RadarAxis` + `ProfileHighlights` + `SkillRef` types are already in `api.gen.ts:1986-2018`. The endpoint is live (P4, `mezo-x71h`).
- **Ghost predicate = `athleteLevel == null`** (api.gen.ts:1987 doc: "null = ghost (no XP yet)"). Both cards render a BiometricCard-style ghost prompt when ghosted. Mirror `BiometricCard`'s `if (!profile) return <prompt card>` pattern (`BiometricCard.tsx:55-86`), NOT the skeleton `GhostState`.
- **Dual-mode via `useDualQuery`** (`src/data/useDualQuery.ts`) — `{ queryKey, mockData, realFetch, realEmpty }`. NEVER `const { data = SEED } = useQuery(...)` (the `dualMode.guard.test.ts` fails the build). Mock seeds synchronously; real returns `realEmpty` (ghost) while unresolved / on 404.
- **Server-computed radar** — consume `radarAxes` directly (fixed order: **Erő, Robbanékonyság, Sebesség, Állóképesség, Mozgékonyság, Koordináció** — matches `ProgressionService.getProfile` and the mockup hexagon, top → clockwise). Do NOT recompute axes from `athletic[]`.
- **Reuse, don't duplicate:** `useReducedMotion` (`src/lib/useReducedMotion.ts`, P5), `skillDisplay`/`ATHLETIC_META` (`src/features/progression/levelUpMeta.ts`, P5) for athletic skill/best-skill labels+icons, `MUSCLE_LABELS` (`src/data/train.ts`) for muscle names. Reuse app design tokens (`--brand-glow`, `--brand-primary`, `--surface-*`, `--text-*`, `--border-*`, `--ff-display`/`--ff-mono`) — no raw hex. Radar keyframes go in `prototype.css`, namespaced `progress-*`.
- **Both FE modes green** (`pnpm test` AND `VITE_USE_MOCK=true pnpm test`) + `pnpm build`. Add a `/api/progression/profile` MSW handler for real-mode tests.
- **"Teljes profil ›" / "Mind a 13 ›" links are inert stubs in v1** (no route exists; the full-profile route is deferred per spec §"Deferred to v1.1"). Render as non-navigating text/chip.
- **Radar scaling:** `radarAxes[].value` is a LEVEL (1-decimal, realistically ~1–10), not 0–100. Plot at `radius * min(value, MAX) / MAX` where `MAX = Math.max(10, ...ceil(values))` (fixed 10-baseline so growth shows; expands only past Lv10 to avoid clipping).

---

## File Structure

**New files**
- `frontend/src/lib/progressionApi.ts` — `progressionApi.getProfile()` + re-exported gen types (`ProgressionProfileResponse`, `SkillLevel`, `RadarAxis`, `ProfileHighlights`, `SkillRef`). Mirrors `biometricProfileApi.ts`.
- `frontend/src/data/progressionHooks.ts` — `useProgressionProfile()` (dual-mode). + `frontend/src/data/progressionHooks.test.tsx`.
- `frontend/src/features/me/components/radarGeometry.ts` — pure radar point math (polar→cartesian, scale, polygon point strings). + `radarGeometry.test.ts`.
- `frontend/src/features/me/components/AthleticRadarCard.tsx` — the SVG radar card. + `AthleticRadarCard.test.tsx`.
- `frontend/src/features/me/components/MuscleLevelsCard.tsx` — the muscle top-N card. + `MuscleLevelsCard.test.tsx`.

**Modified files**
- `frontend/src/data/progressionMock.ts` — add `progressionProfileMock` (seed) + `GHOST_PROGRESSION_PROFILE` (realEmpty).
- `frontend/src/data/hooks.ts` — re-export `useProgressionProfile`.
- `frontend/src/features/me/views/ProfileView.tsx` — render both cards below `BiometricCard`.
- `frontend/src/test/msw/handlers.ts` — add the `GET /api/progression/profile` handler.
- `frontend/src/features/me/views/ProfileView.test.tsx` — assert the cards (mock + ghost).
- `frontend/src/styles/prototype.css` — `.progress-radar*` / `.progress-mbar*` styles + keyframes + reduced-motion gate.

**Docs (Task 7)**
- `docs/features/me.md` (Profile view: the two new progression cards), `docs/features/_platform-api-backend.md` §4e (P6 done — FE consumer of the profile endpoint), `docs/milestones/roadmap.md`.

---

## Task 1: progressionApi client + seeded mock fixtures

**Files:**
- Create: `frontend/src/lib/progressionApi.ts`
- Modify: `frontend/src/data/progressionMock.ts`
- Test: `frontend/src/data/progressionMock.test.ts` (extend)

**Interfaces:**
- Produces: `progressionApi.getProfile(): Promise<ProgressionProfileResponse>` + the re-exported types; `progressionProfileMock: ProgressionProfileResponse` (seed, `athleteLevel: 4.3`, varied shape); `GHOST_PROGRESSION_PROFILE: ProgressionProfileResponse` (`athleteLevel: null`, empty arrays — the real-empty/ghost value).

- [ ] **Step 1: Create `progressionApi.ts`**

```ts
// frontend/src/lib/progressionApi.ts
import { apiFetch } from './api'
import type { components } from './api.gen'

// Contract types generated from api/openapi.yml (P4) — no regen needed.
export type ProgressionProfileResponse = components['schemas']['ProgressionProfileResponse']
export type SkillLevel = components['schemas']['SkillLevel']
export type RadarAxis = components['schemas']['RadarAxis']
export type ProfileHighlights = components['schemas']['ProfileHighlights']
export type SkillRef = components['schemas']['SkillRef']

export const progressionApi = {
  getProfile: (): Promise<ProgressionProfileResponse> =>
    apiFetch<ProgressionProfileResponse>('/api/progression/profile'),
}
```

- [ ] **Step 2: Write the failing fixture test** (append to `progressionMock.test.ts`)

```ts
import { progressionProfileMock, GHOST_PROGRESSION_PROFILE } from './progressionMock'

describe('progression profile fixtures', () => {
  it('seed has an athlete level, a full 6-axis radar (Erő first), and 11+13 skills', () => {
    expect(progressionProfileMock.athleteLevel).toBeGreaterThan(0)
    expect(progressionProfileMock.streakWeeks).toBeGreaterThan(0)
    expect(progressionProfileMock.radarAxes.map((a) => a.axis)).toEqual([
      'Erő', 'Robbanékonyság', 'Sebesség', 'Állóképesség', 'Mozgékonyság', 'Koordináció',
    ])
    expect(progressionProfileMock.athletic).toHaveLength(11)
    expect(progressionProfileMock.muscle).toHaveLength(13)
    expect(progressionProfileMock.highlights.bestAthletic?.skillKey).toBeTruthy()
  })

  it('ghost profile has null athleteLevel and empty arrays (real-empty)', () => {
    expect(GHOST_PROGRESSION_PROFILE.athleteLevel).toBeNull()
    expect(GHOST_PROGRESSION_PROFILE.radarAxes).toEqual([])
    expect(GHOST_PROGRESSION_PROFILE.muscle).toEqual([])
  })
})
```

- [ ] **Step 3: Run — fails** (`cd frontend && pnpm test src/data/progressionMock.test.ts`). Expected: FAIL (exports missing).

- [ ] **Step 4: Add the fixtures to `progressionMock.ts`**

```ts
import type { ProgressionProfileResponse } from '@/lib/progressionApi'

const athleticLevels: Record<string, number> = {
  max_strength: 7, aerobic_capacity: 6, explosiveness: 5, anaerobic_capacity: 5, strength_endurance: 5,
  agility: 4, coordination: 4, vertical_jump: 4, core_stability: 4, sprint_speed: 3, mobility: 3,
}
const muscleLevels: Record<string, number> = {
  'back-mid': 6, quad: 6, chest: 6, glute: 5, ham: 5, shoulder: 5, lats: 4, biceps: 4,
  triceps: 4, core: 4, traps: 3, 'rear-delt': 3, calf: 2,
}
const skill = (skillKey: string, kind: 'ATHLETIC' | 'MUSCLE', level: number, progressPct: number) =>
  ({ skillKey, kind, level, cumulativeXp: level * 150, progressPct })

/** Seeded profile snapshot for mock mode (the FE can't derive levels — no logged history). */
export const progressionProfileMock: ProgressionProfileResponse = {
  athleteLevel: 4.3,
  streakWeeks: 5,
  athletic: Object.entries(athleticLevels).map(([k, lv], i) => skill(k, 'ATHLETIC', lv, 30 + ((i * 13) % 60))),
  muscle: Object.entries(muscleLevels).map(([k, lv], i) => skill(k, 'MUSCLE', lv, 25 + ((i * 17) % 65))),
  radarAxes: [
    { axis: 'Erő', value: 6.8 },
    { axis: 'Robbanékonyság', value: 4.5 },
    { axis: 'Sebesség', value: 3.0 },
    { axis: 'Állóképesség', value: 5.5 },
    { axis: 'Mozgékonyság', value: 3.2 },
    { axis: 'Koordináció', value: 4.0 },
  ],
  highlights: {
    bestAthletic: { skillKey: 'max_strength', level: 7 },
    bestMuscle: { skillKey: 'back-mid', level: 6 },
  },
}

/** Real-mode empty / ghost value (no XP yet, or switch off → 404). */
export const GHOST_PROGRESSION_PROFILE: ProgressionProfileResponse = {
  athleteLevel: null,
  streakWeeks: 0,
  athletic: [],
  muscle: [],
  radarAxes: [],
  highlights: {},
}
```

- [ ] **Step 5: Run — passes.** `cd frontend && pnpm test src/data/progressionMock.test.ts` → PASS. `pnpm build` → green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/progressionApi.ts frontend/src/data/progressionMock.ts frontend/src/data/progressionMock.test.ts
git commit -m "feat(progression): profile API client + seeded profile mock fixtures (mezo-xje5)"
```

---

## Task 2: `useProgressionProfile` dual-mode hook + MSW handler + re-export

**Files:**
- Create: `frontend/src/data/progressionHooks.ts`, `frontend/src/data/progressionHooks.test.tsx`
- Modify: `frontend/src/data/hooks.ts`, `frontend/src/test/msw/handlers.ts`

**Interfaces:**
- Consumes: `useDualQuery`, `progressionApi.getProfile`, `progressionProfileMock`, `GHOST_PROGRESSION_PROFILE`.
- Produces: `useProgressionProfile(): { data: ProgressionProfileResponse; isPending: boolean }`, re-exported from `@/data/hooks`.

- [ ] **Step 1: Write the failing hook test**

```tsx
// frontend/src/data/progressionHooks.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { useProgressionProfile } from './hooks'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

afterEach(() => vi.unstubAllEnvs())

test('mock mode seeds the profile fixture synchronously', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useProgressionProfile(), { wrapper: makeHookWrapper() })
  expect(result.current.data.athleteLevel).toBe(4.3)
  expect(result.current.data.radarAxes).toHaveLength(6)
})

test('real mode fetches the profile from /api/progression/profile', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/progression/profile`, () =>
    HttpResponse.json({
      athleteLevel: 2.1, streakWeeks: 1,
      athletic: [], muscle: [],
      radarAxes: [{ axis: 'Erő', value: 2.0 }],
      highlights: {},
    })))
  const { result } = renderHook(() => useProgressionProfile(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.data.athleteLevel).toBe(2.1))
})

test('real mode shows the ghost profile (athleteLevel null) on a 404 (switch off)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/progression/profile`, () => new HttpResponse(null, { status: 404 })))
  const { result } = renderHook(() => useProgressionProfile(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.isPending).toBe(false))
  expect(result.current.data.athleteLevel).toBeNull()
})
```

- [ ] **Step 2: Run — fails** (`useProgressionProfile` not exported).

- [ ] **Step 3: Create `progressionHooks.ts`**

```ts
// frontend/src/data/progressionHooks.ts
import { useDualQuery } from './useDualQuery'
import { progressionApi } from '@/lib/progressionApi'
import { progressionProfileMock, GHOST_PROGRESSION_PROFILE } from './progressionMock'

/** Athletic + muscle progression profile (radar, athlete-level, streak, highlights).
 *  Dual-mode: seeded fixture in mock, real GET /api/progression/profile in real mode;
 *  a 404 (progression switch off) or empty backend surfaces as the ghost profile. */
export function useProgressionProfile() {
  return useDualQuery({
    queryKey: ['progressionProfile'],
    mockData: progressionProfileMock,
    realFetch: progressionApi.getProfile,
    realEmpty: GHOST_PROGRESSION_PROFILE,
    realStaleTime: 60_000,
  })
}
```

- [ ] **Step 4: Re-export from `hooks.ts`** (add next to the other re-exports, ~line 179):

```ts
export { useProgressionProfile } from './progressionHooks'
```

- [ ] **Step 5: Add the MSW handler** (`handlers.ts`, mirror the biometrics one ~line 92):

```ts
http.get(`${API_BASE}/api/progression/profile`, () =>
  HttpResponse.json({
    athleteLevel: 4.3, streakWeeks: 5,
    athletic: [], muscle: [],
    radarAxes: [
      { axis: 'Erő', value: 6.8 }, { axis: 'Robbanékonyság', value: 4.5 }, { axis: 'Sebesség', value: 3.0 },
      { axis: 'Állóképesség', value: 5.5 }, { axis: 'Mozgékonyság', value: 3.2 }, { axis: 'Koordináció', value: 4.0 },
    ],
    highlights: { bestAthletic: { skillKey: 'max_strength', level: 7 }, bestMuscle: { skillKey: 'back-mid', level: 6 } },
  })),
```

- [ ] **Step 6: Run — passes (both modes).** `cd frontend && pnpm test src/data/progressionHooks.test.tsx && VITE_USE_MOCK=true pnpm test src/data/progressionHooks.test.tsx` → PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/data/progressionHooks.ts frontend/src/data/progressionHooks.test.tsx frontend/src/data/hooks.ts frontend/src/test/msw/handlers.ts
git commit -m "feat(progression): useProgressionProfile dual-mode hook + MSW handler (mezo-xje5)"
```

---

## Task 3: Radar geometry pure helper

**Files:**
- Create: `frontend/src/features/me/components/radarGeometry.ts`, `radarGeometry.test.ts`

**Interfaces:**
- Produces:
  - `radarMax(values: number[]): number` — `Math.max(10, ...values.map(Math.ceil))`.
  - `polarPoint(cx, cy, radius, axisIndex, axisCount): { x, y }` — vertex on axis `i` at `angle = -90° + (360/axisCount)*i`, clockwise.
  - `polygonPoints(cx, cy, radius, axisCount): string` — the SVG `points` string for a full ring at `radius`.
  - `dataPolygonPoints(cx, cy, R, values, max): string` — the data polygon, each axis scaled `R*min(v,max)/max`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/features/me/components/radarGeometry.test.ts
import { describe, expect, it } from 'vitest'
import { radarMax, polarPoint, dataPolygonPoints } from './radarGeometry'

describe('radarGeometry', () => {
  it('radarMax floors at 10 and expands past it', () => {
    expect(radarMax([3, 4.5, 6.8])).toBe(10)
    expect(radarMax([3, 12.2])).toBe(13)
  })

  it('axis 0 is straight up (top vertex)', () => {
    const p = polarPoint(124, 124, 88, 0, 6)
    expect(p.x).toBeCloseTo(124, 1)
    expect(p.y).toBeCloseTo(36, 1) // 124 - 88
  })

  it('axis 3 of 6 is straight down (bottom vertex)', () => {
    const p = polarPoint(124, 124, 88, 3, 6)
    expect(p.x).toBeCloseTo(124, 1)
    expect(p.y).toBeCloseTo(212, 1) // 124 + 88
  })

  it('dataPolygonPoints scales each value by radius*v/max', () => {
    // single axis up, value 5 of max 10 → half radius up
    const pts = dataPolygonPoints(124, 124, 88, [5], 10)
    const [x, y] = pts.split(' ')[0].split(',').map(Number)
    expect(x).toBeCloseTo(124, 1)
    expect(y).toBeCloseTo(80, 1) // 124 - 44
  })
})
```

- [ ] **Step 2: Run — fails** (module missing).

- [ ] **Step 3: Implement**

```ts
// frontend/src/features/me/components/radarGeometry.ts
/** Fixed 10-level baseline so growth is visible; expands only past Lv10 to avoid clipping. */
export function radarMax(values: number[]): number {
  return Math.max(10, ...values.map((v) => Math.ceil(v)))
}

/** Vertex on axis `i`: angle starts straight up (-90°) and steps clockwise. */
export function polarPoint(cx: number, cy: number, radius: number, axisIndex: number, axisCount: number) {
  const angle = (-90 + (360 / axisCount) * axisIndex) * (Math.PI / 180)
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
}

const pointsStr = (pts: { x: number; y: number }[]) =>
  pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

/** SVG points for a full grid ring at `radius`. */
export function polygonPoints(cx: number, cy: number, radius: number, axisCount: number): string {
  return pointsStr(Array.from({ length: axisCount }, (_, i) => polarPoint(cx, cy, radius, i, axisCount)))
}

/** SVG points for the data polygon; each axis value scaled to R*min(v,max)/max. */
export function dataPolygonPoints(cx: number, cy: number, R: number, values: number[], max: number): string {
  return pointsStr(values.map((v, i) => polarPoint(cx, cy, (R * Math.min(v, max)) / max, i, values.length)))
}
```

- [ ] **Step 4: Run — passes.** `cd frontend && pnpm test src/features/me/components/radarGeometry.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me/components/radarGeometry.ts frontend/src/features/me/components/radarGeometry.test.ts
git commit -m "feat(progression): radar geometry pure helper (mezo-xje5)"
```

---

## Task 4: `AthleticRadarCard` (SVG radar + stats + ghost)

> **Use the `frontend-design` skill.** Port `profile-card.html`'s `.card` / radar / `rstats` to app tokens. The geometry comes from Task 3; the static look from the mockup.

**Files:**
- Create: `frontend/src/features/me/components/AthleticRadarCard.tsx`, `AthleticRadarCard.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (`.progress-radar*` styles + keyframes + reduced-motion gate)

**Interfaces:**
- Consumes: `ProgressionProfileResponse` (`@/lib/progressionApi`), `radarMax`/`polygonPoints`/`dataPolygonPoints`/`polarPoint` (Task 3), `skillDisplay` (`@/features/progression/levelUpMeta`), `useReducedMotion` (`@/lib/useReducedMotion`).
- Produces: `export function AthleticRadarCard({ profile }: { profile: ProgressionProfileResponse }): JSX.Element` — ghost prompt when `profile.athleteLevel == null`, else the radar card.

**Component contract:**
- `cx=cy=124`, `R=88`, 6 axes. Grid rings at `R*[1, 0.66, 0.33]`; one `<line>` per axis (center→outer vertex); the data polygon via `dataPolygonPoints(124,124,88, radarAxes.map(a=>a.value), max)` where `max = radarMax(values)`; a `<circle>` data-dot per vertex.
- Axis labels: an abbreviation per axis at a label-radius vertex (`polarPoint(124,124, R+18, i, 6)`), `text-anchor` = `middle` (top/bottom: i 0,3), `start` (right: i 1,2), `end` (left: i 4,5). `RADAR_AXIS_ABBR = { Erő:'ERŐ', Robbanékonyság:'ROBBAN.', Sebesség:'SEBESSÉG', Állóképesség:'ÁLLÓKÉP.', Mozgékonyság:'MOZGÉK.', Koordináció:'KOORD.' }` (fallback: the axis label uppercased).
- `rstats` (3 cells): **Atléta-szint** (highlighted, value = `profile.athleteLevel?.toFixed(1)`), **best athletic** (value = `skillDisplay(bestAthletic.skillKey,'ATHLETIC').icon`, label = `skillDisplay(...).name` truncated + `· Lv${level}`; omit the cell if no `bestAthletic`), **Streak** (`{streakWeeks} hét`).
- Header: `eyebrow brand` "Atlétikai profil" + an inert "Teljes profil ›" text/chip (no nav).
- `useReducedMotion()`: when `reduced`, the polygon renders at final scale + dots visible (no `radarIn` scale-in) — gate via a `progress-radar--reduced` class / omitting the anim class (mirror `LevelUpScreen`).
- Ghost (`athleteLevel == null`): a `card notch-12` brand-tinted prompt (mirror `BiometricCard.tsx:55-86`): sparkle icon + `eyebrow brand` "Atlétikai profil" + "Kezdj el edzeni" + "Minden logolt edzés XP-t ad a skilljeidnek." No radar.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/me/components/AthleticRadarCard.test.tsx
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AthleticRadarCard } from './AthleticRadarCard'
import { progressionProfileMock, GHOST_PROGRESSION_PROFILE } from '@/data/progressionMock'

function stubReduced() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: true, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

describe('AthleticRadarCard', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders the 6 radar axis labels, athlete level, and streak', () => {
    stubReduced()
    render(<AthleticRadarCard profile={progressionProfileMock} />)
    expect(screen.getByText('ERŐ')).toBeInTheDocument()
    expect(screen.getByText('SEBESSÉG')).toBeInTheDocument()
    expect(screen.getByText('KOORD.')).toBeInTheDocument()
    expect(screen.getByText('4.3')).toBeInTheDocument()       // athlete level
    expect(screen.getByText(/5/)).toBeInTheDocument()          // streak weeks
  })

  it('renders the best-athletic highlight icon (max_strength → 🏋️)', () => {
    stubReduced()
    render(<AthleticRadarCard profile={progressionProfileMock} />)
    expect(screen.getByText('🏋️')).toBeInTheDocument()
  })

  it('renders a ghost prompt when there is no XP (athleteLevel null)', () => {
    stubReduced()
    render(<AthleticRadarCard profile={GHOST_PROGRESSION_PROFILE} />)
    expect(screen.getByText(/Kezdj el edzeni/)).toBeInTheDocument()
    expect(screen.queryByText('ERŐ')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — fails** (module missing).

- [ ] **Step 3: Implement `AthleticRadarCard.tsx`** (geometry from Task 3 + mockup markup mapped to tokens) and **append `.progress-radar*` CSS** to `prototype.css` (port `.radar`/`.grid-poly`/`.axis-line`/`.data-poly`/`.data-dot`/`.axlabel`/`.rstats`/`.rstat` with tokens; keyframe `progress-radar-in` scale-in gated by reduced-motion).

- [ ] **Step 4: Run — passes.** `cd frontend && pnpm test src/features/me/components/AthleticRadarCard.test.tsx` → PASS. `pnpm build` → green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me/components/AthleticRadarCard.tsx frontend/src/features/me/components/AthleticRadarCard.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(progression): AthleticRadarCard SVG radar + stats + ghost (mezo-xje5)"
```

---

## Task 5: `MuscleLevelsCard` (top-N + reserve note + ghost)

**Files:**
- Create: `frontend/src/features/me/components/MuscleLevelsCard.tsx`, `MuscleLevelsCard.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (`.progress-mbar*` if not already added)

**Interfaces:**
- Consumes: `ProgressionProfileResponse`, `MUSCLE_LABELS` (`@/data/train`), `useReducedMotion`.
- Produces: `export function MuscleLevelsCard({ profile }: { profile: ProgressionProfileResponse }): JSX.Element` — ghost when `athleteLevel == null`, else top-4 muscle rows + reserve note.

**Contract:**
- Sort `profile.muscle` by `(level desc, cumulativeXp desc)`; take top 4. Each row: rank (`01`..`04`), `MUSCLE_LABELS[skillKey] ?? skillKey`, `Lv {level}`, a bar filled to `progressPct%` (or `level/maxMuscleLevel`). Bar grow via `progress-mbar-fill` keyframe, reduced-motion → final width.
- Reserve note: `+ {muscle.length - 4} további izom · {LABEL(lowest)} a legtöbb tartalék (Lv {lowest.level})` where lowest = min by `(level, cumulativeXp)`.
- Header: `eyebrow brand` "Izom-szintek" + inert "Mind a 13 ›".
- Ghost (`athleteLevel == null`): brand-tinted prompt "Emeld a volumened" / "A gym-szetek volumene építi az izom-szintjeidet."

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/me/components/MuscleLevelsCard.test.tsx
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MuscleLevelsCard } from './MuscleLevelsCard'
import { progressionProfileMock, GHOST_PROGRESSION_PROFILE } from '@/data/progressionMock'

function stubReduced() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: true, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

describe('MuscleLevelsCard', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows the top muscle by level with its HU label + level', () => {
    stubReduced()
    render(<MuscleLevelsCard profile={progressionProfileMock} />)
    // back-mid is the joint top (Lv6); MUSCLE_LABELS['back-mid'] = 'Hát (közép)'
    expect(screen.getByText('Hát (közép)')).toBeInTheDocument()
    expect(screen.getAllByText(/Lv 6/).length).toBeGreaterThan(0)
  })

  it('shows the reserve note naming the lowest muscle (Calf, Lv2)', () => {
    stubReduced()
    render(<MuscleLevelsCard profile={progressionProfileMock} />)
    expect(screen.getByText(/további izom/)).toBeInTheDocument()
    expect(screen.getByText(/Vádli/)).toBeInTheDocument() // MUSCLE_LABELS['calf'] = 'Vádli'
  })

  it('renders a ghost prompt when there is no XP', () => {
    stubReduced()
    render(<MuscleLevelsCard profile={GHOST_PROGRESSION_PROFILE} />)
    expect(screen.getByText(/Emeld a volumened/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — fails.**

- [ ] **Step 3: Implement `MuscleLevelsCard.tsx`** + any `.progress-mbar*` CSS.

- [ ] **Step 4: Run — passes (both modes).**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me/components/MuscleLevelsCard.tsx frontend/src/features/me/components/MuscleLevelsCard.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(progression): MuscleLevelsCard top-N + reserve note + ghost (mezo-xje5)"
```

---

## Task 6: Wire both cards into `ProfileView`

**Files:**
- Modify: `frontend/src/features/me/views/ProfileView.tsx`, `frontend/src/features/me/views/ProfileView.test.tsx`

**Interfaces:**
- Consumes: `useProgressionProfile` (`@/data/hooks`), `AthleticRadarCard`, `MuscleLevelsCard`.

- [ ] **Step 1: Write the failing view test** (extend `ProfileView.test.tsx`)

```tsx
it('renders the athletic radar + muscle cards below biometrics (mock)', () => {
  // (renderProfile() already pins mock mode + QueryWrapper + MemoryRouter)
  renderProfile()
  expect(screen.getByText('Atlétikai profil')).toBeInTheDocument()
  expect(screen.getByText('Izom-szintek')).toBeInTheDocument()
  expect(screen.getByText('ERŐ')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — fails.**

- [ ] **Step 3: Wire `ProfileView.tsx`**

```tsx
import { useBiometricProfile, useProgressionProfile } from '@/data/hooks'
import { AthleticRadarCard } from '../components/AthleticRadarCard'
import { MuscleLevelsCard } from '../components/MuscleLevelsCard'
// ...
const { profile: biometric } = useBiometricProfile()
const { data: progression } = useProgressionProfile()
// ...
<div style={{ padding: '8px 24px 24px' }}>
  <div className="col gap-md">
    <BiometricCard profile={biometric} onEdit={() => setSheet('biometric')} />
    <AthleticRadarCard profile={progression} />
    <MuscleLevelsCard profile={progression} />
  </div>
</div>
```

- [ ] **Step 4: Run — passes (both modes).** `cd frontend && pnpm test src/features/me/views/ProfileView.test.tsx && VITE_USE_MOCK=true pnpm test src/features/me/views/ProfileView.test.tsx` → PASS. `pnpm build` → green.

- [ ] **Step 5: Visual check** — drive the app (`VITE_USE_MOCK=true pnpm dev`, navigate `/me`) and screenshot the radar + muscle cards. Confirm the radar polygon shape, labels, stats, and the muscle bars render and match the mockup intent.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/me/views/ProfileView.tsx frontend/src/features/me/views/ProfileView.test.tsx
git commit -m "feat(progression): render athletic radar + muscle cards in ProfileView (mezo-xje5)"
```

---

## Task 7: Docs, lint, and full verification gates

**Files:**
- Modify: `docs/features/me.md` (Profile view: the two new progression cards + the `useProgressionProfile` seam), `docs/features/_platform-api-backend.md` §4e (P6 done — FE consumes the profile endpoint; the level-up parent epic `mezo-8e4` is now fully shipped), `docs/milestones/roadmap.md`.

- [ ] **Step 1: Update `me.md`** — document the Profile view's two new cards (`AthleticRadarCard` SVG radar of the 6 server-computed `radarAxes`, `MuscleLevelsCard` top-N), the `useProgressionProfile` dual-mode hook (`progressionApi.getProfile` / seeded `progressionProfileMock` / ghost on `athleteLevel == null`), and the inert "Teljes profil"/"Mind a 13" stubs. Bump `updated:`.

- [ ] **Step 2: Update `_platform-api-backend.md` §4e** — append: P6 shipped — the profile endpoint now has an FE consumer (`useProgressionProfile` + the two `features/me/components/` cards); the `mezo-8e4` epic (P1–P6) is fully shipped.

- [ ] **Step 3: Update `roadmap.md`** — Progression P6 (`mezo-xje5`) shipped; mark the `mezo-8e4` epic complete.

- [ ] **Step 4: Lint** — `node scripts/lint-docs.mjs` → the touched docs (`me.md`, `_platform-api-backend.md`) clear staleness.

- [ ] **Step 5: Full FE gates** —
```bash
cd frontend
pnpm test
VITE_USE_MOCK=true pnpm test
pnpm build
```
All green in BOTH modes + build.

- [ ] **Step 6: Commit docs**

```bash
git add docs/
git commit -m "docs(progression): P6 profile cards — me.md + _platform-api-backend.md §4e + roadmap (mezo-xje5)"
```

---

## Self-Review (run after drafting; fix inline)

- **Spec coverage** (`2026-06-25-progression-levelup-design.md` §4 + §6 + §8 P6):
  - `progressionHooks.ts` `useProgressionProfile()` on `useDualQuery` (mock / real-empty, not a seed default) → Task 2. ✓
  - `AthleticProfileCard` (SVG radar + athlete-level/best/streak) → Task 4. ✓
  - `MuscleLevelsCard` (top-N + reserve note) → Task 5. ✓
  - ghost before any XP (mirrors BiometricCard) → Tasks 4+5 (athleteLevel null). ✓
  - radar 6 axes regrouping (server-computed, consumed directly) → Task 4. ✓
  - seeded mock snapshot → Task 1. ✓
  - reduced-motion (reuse useReducedMotion) → Tasks 4+5. ✓
- **Placeholder scan:** the card JSX static markup (Tasks 4/5) is delegated to the verbatim mockup + frontend-design; all data-derivation, geometry, sort, ghost predicate, and tests are spelled out. ✓
- **Type consistency:** `useProgressionProfile()` returns `{ data: ProgressionProfileResponse; isPending }`; cards take `{ profile: ProgressionProfileResponse }`; ghost predicate `athleteLevel == null` everywhere. ✓

## Execution notes

- One bd issue (mezo-xje5) + one branch (`feat/progression-p6-profile-cards`). Commit per task.
- Before merge: adversarial review via a Workflow (dimensions × per-finding verify, the P5 pattern).
- Merge `--no-ff` into main, delete branch, `bd dolt push && git push`. **Do NOT `git pull --rebase` after the merge** (flattens the `--no-ff` merge; the pre-merge rebase already synced — `git-noff-merge-flatten-trap` memory). Closing `mezo-xje5` also completes the `mezo-8e4` epic.

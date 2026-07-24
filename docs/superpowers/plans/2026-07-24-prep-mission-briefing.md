# Prep „Mission briefing" redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `ActiveWorkoutPage`'s prep phase as the approved „Mission briefing" (variant B v2): XP-ring hero + skill bars, stat pills, quest-styled challenges WITH a visible pending state, muscle-sectioned bigger exercise cards with 1RM badges — and make Mai/Gym day taps navigate straight to the prep (deleting `GymDaySheet`). FE-only (`mezo-bxpg`).

**Architecture:** New pure logic module `prepBriefing.ts` adapts existing engines (`growthForecast`, `muscleColor`/`muscleRegionGroups`, `exerciseRecords`, `prescribedSets`) into prep-screen view data; two new presentational components (`PrepHero`, `PrepExerciseCard`); the prep JSX in `ActiveWorkoutPage` is recomposed; `useChallenges` gains `pending`; `GymDaySheet` is deleted and both call sites navigate directly.

**Tech Stack:** React 19, TanStack Query, Vitest + testing-library + msw; Napiv token vocabulary (`--coral`, `--wash-gym`, muscle families via `muscleColor`); Playwright visual baselines.

**Driving docs:** spec `docs/superpowers/specs/2026-07-24-prep-mission-briefing-design.md` (D1–D8); `docs/references/frontend_conventions.md` (MANDATORY read for every task).

## Global Constraints

- FE-only: NO contract, NO backend change. `active`/`summary`/`complete` phases and the session model untouched (D1).
- Hooks consumed from `@/data/hooks` only; imports `@/*`; no new barrels; tests colocated; both test modes green (`pnpm test` + `VITE_USE_MOCK=true pnpm test`) + `pnpm build`.
- Estimates are honest: copy says „várható"/„becsült"; no level-up badge without real threshold data (D2); missing 1RM → badge omitted (D3); null start weight → pill omitted (D4).
- Hungarian UI copy exactly: „várható XP", „szintlépés-esély", „A mai küldetések", „Kihívások generálása…", „Ma nincs kihívás", „1RM rekord", „↑ {kg} kg-ról indul", „Kezdjük el".
- Colors ONLY via existing tokens: `--coral`/`--coral-deep`/`--wash-gym`/`--tag-gym`, `muscleColor(muscle)` families (`rail`/`wash`/`deep`), `--amber` for level-up affordances. No hex literals in components.
- Mock parity: everything computes client-side; mock renders the full briefing (challenge `pending` false in mock).
- Conventional commits with `(mezo-bxpg)`; branch `feat/prep-mission-briefing` (already exists, spec committed).
- A bd pre-commit hook adds `.beads/issues.jsonl` churn / stray root `issues.jsonl` — expected; controller sweeps before push.
- Visual baselines WILL change → Task 6 re-baselines darwin locally + linux via `gh workflow run update-visual-baselines.yml -r feat/prep-mission-briefing` + empty-commit CI retrigger (bd memory recipe).

---

### Task 1: `useChallenges.pending` + quest-styled carousel with pending/empty states

**Files:**
- Modify: `frontend/src/data/train/challengeHooks.ts`
- Modify: `frontend/src/features/train/components/ChallengesCarousel.tsx` (+ its test file; read both first — the carousel/card markup is restyled, the accept/dismiss/outcome wiring is NOT changed)
- Modify: `frontend/src/features/train/components/ChallengeCard.tsx`

**Interfaces:**
- Produces: `ChallengesView` gains `pending: boolean` (real: `q.isPending`; mock: `false`). `ChallengesCarousel` renders: pending → a skeleton quest card with „Kihívások generálása…"; resolved-empty → a single muted „Ma nincs kihívás" line; else the quest cards. Section eyebrow becomes „⚔ A mai küldetések · {n}".
- Quest card restyle (ChallengeCard): coral-bordered card (`border: 1px solid var(--coral)`, background `var(--wash-gym)`), header row = type + exercise name in `--coral-deep` + risk tag right (`--text-tertiary`), why/glory line, actions `⚔ Elfogadom` (solid coral chip) / `Passz` (plain chip). Outcome chips (`✓ Megerősítve` etc.) keep their existing logic/markup.

- [ ] **Step 1 (RED):** extend the carousel test: (a) `pending` prop renders text „Kihívások generálása…" and no cards; (b) empty + not pending renders „Ma nincs kihívás"; (c) hook test in `challengeHooks.test.ts` (create if missing, msw pattern like `customWorkoutHooks.test.ts`): real mode with a never-resolving handler → `pending === true`; mock mode → `pending === false`. Run `VITE_USE_MOCK=true pnpm test Challenge` → FAIL.
- [ ] **Step 2 (GREEN):** implement:

```ts
// challengeHooks.ts — in ChallengesView:
  /** Real mode: the list query is in flight (the lazy LLM generation) — render the skeleton. */
  pending: boolean
// return branches:
  if (mock) return { challenges: mockWorkout.challenges, mode: 'mock', pending: false }
  return { challenges: q.data ?? [], mode: 'live', pending: q.isPending }
```

Carousel signature gains `pending?: boolean`; render order: pending-skeleton → empty-line → cards. Skeleton = one `.card`-style div with the copy + a `.bar`-like shimmer div (no animation lib — a plain muted block is fine).
- [ ] **Step 3:** `VITE_USE_MOCK=true pnpm test Challenge && pnpm test Challenge` → PASS. Existing ActiveWorkoutPage tests still green (`VITE_USE_MOCK=true pnpm test ActiveWorkoutPage`).
- [ ] **Step 4:** Commit `feat(train): challenge pending/empty states + quest card restyle (mezo-bxpg)`.

### Task 2: `logic/prepBriefing.ts` — pure view-data adapters

**Files:**
- Create: `frontend/src/features/train/logic/prepBriefing.ts`
- Test: `frontend/src/features/train/logic/prepBriefing.test.ts`

**Interfaces (later tasks consume these exact signatures):**

```ts
import type { LoggedWorkoutExercise, MesoDay, WorkoutPlan } from '@/data/types'
import type { SkillLevel } from '@/data/progression/progressionApi'
import type { ExerciseRecordResponse } from '@/data/train/trainApi'
import { growthForecast, xpThreshold, type ForecastSkill } from '@/features/train/logic/growthForecast'

export interface PrepStats { workSets: number; warmupSets: number; repsEst: number; durationEst: number; muscleCount: number }
export function prepStats(W: WorkoutPlan): PrepStats
// workSets = Σ e.sets; warmupSets = Σ prescribedSets kind==='warmup' (0 without prescriptions);
// repsEst = Σ e.sets × round((repMin+repMax)/2); muscleCount = distinct non-empty, non-'sport' muscles.

/** MesoDay adapter so growthForecast can score ONE workout (meso day or custom/saját plan). */
export function pseudoDayFromPlan(W: WorkoutPlan): MesoDay
// { day: '', type: W.title, muscle: '', exerciseCount: n, exercises: mapped GymExercise[] } —
// map each LoggedWorkoutExercise to GymExercise {id, name, muscle, warmupSets (from prescribed
// kinds), workingSets: e.sets, repMin, repMax, targetRIR, type, anchorWeightKg: first working
// prescribed targetWeightKg ?? null}. VERIFY LoggedWorkoutExercise's exact fields in
// data/types.ts and adapt mechanically (it carries prescribedSets since mezo-dhdr).

export interface PrepForecast { totalXp: number; skills: ForecastSkill[] }
export function prepForecast(day: MesoDay, athletic: SkillLevel[]): PrepForecast
// growthForecast({days:[day], slots:[], runSessions:[], athletic}) → totalXp = Σ skill xpEst +
// Σ muscleXp values; skills = top 3 by xpEst (willLevelUp comes computed from the engine).

/** catalogId-else-name identity → best e1RM kg (rounded), the records idiom. */
export function oneRmByIdentity(records: ExerciseRecordResponse[]): Map<string, number>
export function identityKeyOf(ex: { catalogId?: string | null; name: string }): string  // 'c:'+id | 'n:'+name

/** First working prescribed target weight, or null (plyo / no anchor / switch off). */
export function startWeightOf(e: LoggedWorkoutExercise): number | null
```

- [ ] **Step 1 (RED):** write the test file first — fixture `WorkoutPlan` with 2 exercises (one with prescribedSets incl. 1 warmup + working targetWeightKg 26, one plyo without), assert: `prepStats` numbers; `pseudoDayFromPlan` maps workingSets/anchor; `prepForecast` with a seeded athletic level near threshold returns a `willLevelUp` skill (reuse `growthForecast.test.ts`'s fixture idiom — read it); `oneRmByIdentity` prefers catalogId key and falls back to name; `startWeightOf` null for the plyo. Run → FAIL (module missing).
- [ ] **Step 2 (GREEN):** implement per the signatures above (pure functions, no hooks). `oneRmByIdentity`: record's e1RM field — VERIFY the exact field name on `ExerciseRecordResponse` (`bestE1rm` object per the contract; use its kg value rounded).
- [ ] **Step 3:** both modes green for the file; commit `feat(train): prepBriefing view-data adapters (mezo-bxpg)`.

### Task 3: `PrepHero` + `PrepExerciseCard` components

**Files:**
- Create: `frontend/src/features/train/components/PrepHero.tsx` (+ colocated test)
- Create: `frontend/src/features/train/components/PrepExerciseCard.tsx` (+ colocated test)

**Interfaces:**

```tsx
export function PrepHero({ overline, title, forecast, stats }: {
  overline: string            // "Csütörtök · W2 · MAV hét" — caller composes
  title: string
  forecast: PrepForecast | null   // null → ring hidden, stats row only (empty athletic profile)
  stats: PrepStats
})
// Layout: centered; XP ring = a bordered circle (border 4px var(--coral)) with "+{totalXp}" +
// "VÁRHATÓ XP" micro-label; beside it up to 3 skill rows: {emoji} {label} +{xpEst} with a
// progress bar (progressPct width, skill-colored: use var(--amber) when willLevelUp else
// var(--sage)) and the "⚡ szintlépés-esély!" micro-badge when willLevelUp. Below: pill row
// "{workSets} szett · ~{repsEst} rep · ~{durationEst} perc · {muscleCount} izomcsoport".
// Skill label/emoji: reuse the existing skill-label map — grep for how MuscleWeekSheet/Me
// profile render skillKey → HU label (SKILL_LABELS or similar) and import THAT source; do not
// duplicate the map.

export function PrepExerciseCard({ exercise, oneRmKg, accentChallenge }: {
  exercise: LoggedWorkoutExercise
  oneRmKg: number | null
  accentChallenge: { typeLabel: string; target: string } | null  // accepted challenge on this exercise
})
// muscleColor(exercise.muscle) family: left rail 4px family.rail; name row + muscle pill
// (family.wash bg + family.deep text, MUSCLE_LABELS[muscle]); top-right when oneRmKg: "🏆 {kg} kg"
// + "1RM REKORD" micro-label in var(--amber); pill row: "🔥 {n} bemelegítő" (only when >0),
// "{sets} × working" (family.deep border/text), "{repMin}–{repMax} rep", "RIR {targetRIR}",
// startWeightOf(e) != null → "↑ {kg} kg-ról indul"; accepted-challenge line kept (sparkle +
// typeLabel · target, coral) under the name like today.
```

- [ ] **Step 1 (RED):** component tests: hero renders "+140" ring + "szintlépés-esély" badge from a fixture forecast, hides ring when `forecast` null but still shows pills; card renders 1RM badge / omits it when null, renders start-weight pill / omits when null, warmup pill only when >0. → FAIL (modules missing).
- [ ] **Step 2 (GREEN):** implement; inline styles + existing utility classes (`.chip`, `.eyebrow`, `.card`, `label-mono`) per the file-neighborhood idiom; tokens only.
- [ ] **Step 3:** tests green both modes; commit `feat(train): PrepHero + PrepExerciseCard components (mezo-bxpg)`.

### Task 4: Recompose the prep phase in `ActiveWorkoutPage`

**Files:**
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (the `if (phase === 'prep')` block ONLY, lines ~476–640 — breadcrumb stays)
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx` (prep assertions)

**Interfaces:**
- Consumes: Tasks 1–3 (`pending` + carousel states, `prepBriefing` helpers, both components), `useProgressionProfile` + `useTrain().exerciseRecords` (already available from `@/data/hooks`), `muscleRegionGroups` for sectioning.
- Composition top→bottom: breadcrumb (unchanged) → `PrepHero` (overline: compose from existing `weekLabel` + day; title `W.title`) → niggle card (existing JSX, unchanged logic) → `ChallengesCarousel` with `pending` → warmup section (existing rows, keep) → exercise sections: group `W.exercises` by `muscleRegion` (`muscleRegionGroups` over a `MuscleWeekRow`-like adaptation OR simpler: group by `muscleColor` family key preserving plan order — pick the simpler; section header `{region label} · {n} gyakorlat` in `family.deep`) each exercise a `PrepExerciseCard` → sticky CTA `⚡ Kezdjük el →` (`.np-cta np-press`, `position: sticky; bottom: 12px`).
- `prepForecast` inputs: `athletic = profile?.athletic ?? []`; when `activeMeso` has a day matching today AND it is the planned day, prefer that `MesoDay`; else `pseudoDayFromPlan(W)` (covers custom/saját + no-meso — the D2 rule). Forecast `null` when `athletic` empty AND every xpEst is 0.

- [ ] **Step 1 (RED):** update prep tests: mock-mode prep renders „VÁRHATÓ XP" hero, a `Mell` section header, a 🏆 1RM badge (add a record fixture to the mock exerciseRecords? mock records are `[]` — so instead assert the badge OMITTED in mock and add ONE real-mode msw test with a record matched by name that asserts „1RM" appears), the „⚔ A mai küldetések" eyebrow, and the existing „Kezdjük el" CTA still starts (`beginWorkout` fires). Keep/adjust the existing prep-phase assertions (niggle, challenges accept flow) — read them first; they must stay green with the new markup (update selectors, not behavior).
- [ ] **Step 2 (GREEN):** recompose; delete the old title/chips block and the old flat exercise list; keep `WARMUP_ROWS`, niggle, challenge wiring intact.
- [ ] **Step 3:** `pnpm test ActiveWorkoutPage` + mock mode + `pnpm build` → green. Commit `feat(train): mission-briefing prep phase (mezo-bxpg)`.

### Task 5: Direct-start flow + delete `GymDaySheet`

**Files:**
- Modify: `frontend/src/features/train/pages/GymPage.tsx` (day-card tap → navigate; sheet mount/props removed)
- Modify: `frontend/src/features/train/pages/TrainTodayPage.tsx` (weekly-row `onOpenGymDay` → direct navigate; sheet mount/state removed)
- Delete: `frontend/src/features/train/sheets/GymDaySheet.tsx` (+ its test file if one exists)
- Modify: `frontend/src/features/train/pages/GymPage.test.tsx` + `TrainTodayPage.test.tsx`

**Interfaces / behavior (D6):**
- GymPage `GymDayCard` `onOpen` becomes: day completed this week (`weekWorkouts` map by `templateSessionId`) → `navigate(/train/review/{id})`; else exercises>0 → `navigate(day.current || !day.id ? '/train/session' : \`/train/session?day=${day.id}\`)`; rest day → no-op. The `useWeekWorkouts`/`todaySession` derivations STAY (review routing needs them).
- TrainTodayPage: `onOpenGymDay` callback becomes the same direct navigation (the `openGymDay` state + sheet mount deleted). Done rows keep their existing `onReviewGym` path.
- Delete the sheet file; `grep -rn "GymDaySheet" frontend/src` must return ZERO afterwards.

- [ ] **Step 1 (RED):** update tests: GymPage „tapping the current training day … opens the detail sheet" becomes „…navigates to /train/session" (assert via a route probe or `useNavigate` spy pattern already used in the file's tests — read first); TrainTodayPage's mezo-j3x0 test (non-today row) asserts navigation to `/train/session?day=` instead of sheet content. → FAIL.
- [ ] **Step 2 (GREEN):** implement + delete the sheet. Full grep-zero check.
- [ ] **Step 3:** `VITE_USE_MOCK=true pnpm test GymPage TrainTodayPage && pnpm test GymPage TrainTodayPage && pnpm build` → green. Commit `feat(train): direct prep start from Mai/Gym, delete GymDaySheet (mezo-bxpg)`.

### Task 6: Docs + gates + visual re-baseline + ship

- [ ] **Step 1:** `docs/features/train.md`: §2 active-workout prep paragraph rewritten (briefing composition, pending state, D2/D3/D4 data sources), §2 Gym/Mai: direct-start flow, GymDaySheet removal (also purge its §2/§5 mentions — grep "GymDaySheet"); `docs/features/proactive.md`: challenge-consumption note gains the pending-skeleton sentence. `updated:` → today. `node scripts/lint-docs.mjs` clean for both.
- [ ] **Step 2:** Full gates: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- [ ] **Step 3:** Visual: `pnpm test:visual` → expect train-session (and possibly train-gym/mai) diffs; `pnpm test:visual:update`; commit goldens.
- [ ] **Step 4:** Commit docs; push; PR (`gh pr create` — title `feat(train): mission-briefing prep + direct start (mezo-bxpg)`); `gh workflow run update-visual-baselines.yml -r feat/prep-mission-briefing`; after the bot commit: pull + empty commit retrigger; CI green → controller merges (`gh pr merge --merge`), `bd close mezo-bxpg`, `bd dolt push`.

## Self-review notes

- Spec coverage: D1→T4 scope guard, D2→T2/T4, D3→T2/T3, D4→T2/T3, D5→T1, D6→T5, D7→T4 tests + T6 re-baseline, D8→copy constraints.
- Verify-points flagged: `LoggedWorkoutExercise` exact fields (T2), `ExerciseRecordResponse.bestE1rm` field shape (T2), skill-label map source (T3), existing prep test assertions + nav-spy idiom (T4/T5), ChallengesCarousel current props (T1).
- No placeholder steps; each task carries its own RED→GREEN cycle and commit.

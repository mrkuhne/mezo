# Prep-screen „Mission briefing" redesign — design (mezo-bxpg)

**Date:** 2026-07-24 · **Driving issue:** `mezo-bxpg` · **Status:** approved (visual companion,
variant B v2 — mockups persisted under `.superpowers/brainstorm/`, git-ignored; this spec is the
standalone description)

## Problem

The workout prep screen (`ActiveWorkoutPage` `prep` phase) is visually flat: plain title + two
chips, no hero, no sectioning, no color, no set/rep or muscle summary, no XP/skill outlook. The
challenge carousel also generates silently (1–3 s LLM call) with **no loading state**, so a user
who taps „Kezdjük el" quickly never sees the cards land (observed in prod, 2026-07-24). Finally,
starting a day is a redundant two-step: Mai/Gym → `GymDaySheet` (exercise list + Indítsuk) →
prep (same list again) → Kezdjük el.

## Approved UX (variant B v2)

The prep phase becomes a centered **mission briefing**, top to bottom:

1. **Hero** — over-line `{day} · W{n} · {phase} hét`, big serif title, then an **XP ring**
   (estimated XP for THIS workout) with the top 2–3 **skill bars** beside it (each: emoji +
   name + est. `+XP`, progress bar toward the next threshold, and a **⚡ szintlépés-esély!**
   badge when the estimate crosses it). Below: a **pill row** — `{n} szett · ~{n} rep ·
   ~{n} perc · {n} izomcsoport`.
2. **⚔ A mai küldetések** — the challenge cards restyled as quest cards (type + exercise name,
   glory/why line, risk tag, `⚔ Elfogadom` / `Passz`). **NEW: a visible pending state** — a
   skeleton card with „Kihívások generálása…" while the list query is in flight, and an honest
   „Ma nincs kihívás" row when it resolves empty. Outcome chips (post-workout) unchanged.
3. **Niggle pre-flag** — kept, restyled to the section idiom.
4. **Bemelegítés** — kept as a section.
5. **Gyakorlatok, izomcsoport-szekciókban** — sections via `muscleRegionGroups` (region label in
   the family color, e.g. `Mell · 1 gyakorlat`), each exercise a **bigger card**: muscle-color
   left rail, name + muscle pill, **🏆 1RM rekord** top-right (record-engine e1RM), and a pill
   row: `🔥 {n} bemelegítő` · `{n} × working` (family-colored) · `{repMin}–{repMax} rep` ·
   `RIR {n}` · `↑ {kg} kg-ról indul` (the recommendation engine's first working-set target).
6. **Sticky `⚡ Kezdjük el →` CTA** — coral, full width.

## Decisions

- **D1 — Scope: prep phase only.** The `active`/`summary`/`complete` phases are untouched; the
  session model, guards, and finish flow are untouched. FE-only feature (no contract/BE change).
- **D2 — XP/skill estimates are client-side** via the existing `growthForecast`
  (`features/train/logic/growthForecast.ts`) called with a SINGLE day: today's `MesoDay` from
  `activeMeso.days` (matched by day label), or a pseudo-`MesoDay` adapted from `W.exercises`
  for custom (saját) workouts / no-meso sessions. `slots`/`runSessions` empty — gym-only
  estimate. Skill levels from the progression profile hook (same source as Me/Profile); when the
  profile is empty (mock/fresh), bars render without thresholds and no level-up badge — never
  fabricated. Copy says **„várható"/„becsült"** everywhere.
- **D3 — 1RM per exercise from the record engine:** `useTrain().exerciseRecords` matched by
  `catalogId` (else exact name) — the same identity idiom as records/challenge grounding. No
  record → the badge is simply omitted (no zero-state noise).
- **D4 — Starting weight pill from `prescribedSets`:** the first working set's
  `targetWeightKg` when the hypertrophy drive is on; hidden when null (plyo/first session
  without anchor/switch off).
- **D5 — Challenge pending state:** `useChallenges` exposes `pending` (real mode: the query's
  `isPending`; mock: false). The quest section renders a skeleton + „Kihívások generálása…"
  while pending — closing the silent-gap bug class for good. Empty resolved list → „Ma nincs
  kihívás" line.
- **D6 — Direct start flow:** Mai weekly gym rows and Gym day cards navigate STRAIGHT to
  `/train/session?day={templateDayId}` (today's row/hero plain `/train/session`); a day
  completed this week navigates straight to `/train/review/{id}` (both pages already hold the
  `useWeekWorkouts` map). **`GymDaySheet` is deleted** (component + tests + both call sites).
  Its remaining states are covered: completed → direct review; another workout open → the
  session route resumes the open workout (visible + resumable — acceptable, documented);
  missed/pull-forward chips move to nothing (the prep hero shows the day identity).
- **D7 — Mock parity:** every new element computes client-side, so mock renders the full
  briefing from fixtures (challenge pending=false, mock challenge seeds show as quests). Visual
  baselines will change → re-baseline darwin + linux in the same change.
- **D8 — Copy is Hungarian**, gamified but honest: „várható XP", „szintlépés-esély",
  „A mai küldetések", „1RM rekord", „↑ {kg} kg-ról indul".

## Data sources (all existing)

| Element | Source |
|---|---|
| XP ring + skill bars | `growthForecast({days:[today], slots:[], runSessions:[], athletic})` + progression profile levels; `xpThreshold` for level-up detection |
| szett/rep/perc pills | recipe sums from `W.exercises` (`warmupSets`/`workingSets`/`repMin/Max`), `W.durationEst` |
| izomcsoport count + sections | `muscleWeekFromMeso`-style grouping via `muscleRegionGroups` + `muscleColor` families |
| 1RM badge | `exerciseRecords` `bestE1rm` by catalog/name identity |
| induló kg pill | `prescribedSets[first working].targetWeightKg` |
| quest cards + pending | `useChallenges` (+ new `pending`), decide via `useChallengeActions` |

## Cleanup

`GymDaySheet.tsx` + its tests deleted; `GymPage`/`TrainTodayPage` lose the sheet mounts/props
(the `useWeekWorkouts`-based review-routing stays); `docs/features/train.md` §2 updated (prep
composition, direct-start flow, sheet removal), `proactive.md` challenge-consumption note
(pending state).

## Testing

FE only: prep-render tests (hero numbers from a fixture day, 1RM matching incl. no-record
omission, pending skeleton via a never-resolving msw handler, empty-challenges line, muscle
sections, direct-nav from Gym day card + Mai weekly row, custom/no-meso pseudo-day path);
`weeklyLoad`/session-flow tests untouched. Gate: build + both modes + visual re-baseline.

## Delivery

One branch (`feat/prep-mission-briefing`), one bd issue (`mezo-bxpg`), house flow (self-PR → CI
→ `--no-ff` merge). Follow-up candidates NOT in scope: challenge-deck swipe interaction (C
variant), sticky CTA glow animation, sport/run inclusion in the day forecast.

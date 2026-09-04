---
title: Life goals
type: feature-domain
status: in-progress
updated: 2026-09-05
tags: [me, growth, companion, backend, data-layer, frontend]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal
  - backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/engine/LifeGoalScorer.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/engine/SignalSource.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalProgressService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalEvalJob.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalXpService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalTriggerService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalTriggerRules.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalSignalService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/LifeGoalProposePort.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/LifeGoalProposeLlmAdapter.java
  - api/feature/lifegoal/lifegoal.yml
  - frontend/src/data/lifegoal
  - frontend/src/features/me/pages/CelokPage.tsx
  - frontend/src/features/me/pages/CelPage.tsx
  - frontend/src/features/me/pages/CelWizardPage.tsx
  - frontend/src/features/me/pages/JelekPage.tsx
  - frontend/src/features/today/components/LifeGoalTodayTile.tsx
  - frontend/src/features/me/components/WeekGoalsCard.tsx
related: [goal-engine, growth, companion, me, today, train]
---

# Life goals — Feature Documentation

> One-line: general-purpose life goals ("Célok") at route `/me/goals` (tab "Én"), tagged to a
> PERMAH dimension and measured by 1–5 pillars drawn from a closed signal catalog.
> **Status: slice 3 (`mezo-iizd.5`–`.7` engine, `.9`/`.4`/`.12` embedding) — ✅ backend CRUD/lifecycle/
> catalog/AI-propose (slice 1) ✅ scorer core: `LifeGoalScorer` + 5 `SignalSource` adapters +
> `progress`/`evaluate`/`today` endpoints (`mezo-iizd.5`); ✅ nightly `LifeGoalEvalJob` (dual-gated
> cron, per-user + per-goal error isolation) and pillar-hit XP via `LifeGoalXpService` →
> `ProgressionService.applyLifeGoal` (`mezo-iizd.6`); ✅ ha–akkor trigger evaluation
> (`LifeGoalTriggerRules`/`LifeGoalTriggerService`, immediate + delayed branches) and
> `LIFE_GOAL_PLAN` notifications, ✅ `GET /signals` liveness + `JelekPage` + the hub's Jelek row
> (`mezo-iizd.7`); ✅ FE hub/detail/wizard render live dots/arrows/weekly% in both modes;
> ✅ **slice 3's EMBEDDING (`mezo-iizd.9`/`.4`/`.12`)** — the engine now surfaces on seven places
> OUTSIDE its own pages: the Nap "Célok · ma" tile, the goal-detail conflict sentence, the Heti
> `WeekGoalsCard`, the weekly-review prompt's `ÉLETCÉLOK` block, the Célok hub's closed-goals
> section + Súlycél row, the Én-hub life-goal hero, and the Growth skill-row `goalchip` — see §2.
> Still 🔴 not built: the `[Célok]` **companion (chat) prompt block** + a `get_life_goals` chat
> tool, and the knowledge-graph `GOAL` node — see §9.**

## 1. Summary

A life goal is free text ("Kockahas", "Side hustle az appból", "Az utolsó barátnő") the user
assigns to one of the six **PERMAH** dimensions (positive emotion · engagement · relationships
· meaning · accomplishment · health — health is PERMA's practical extension, kept under that
label) and backs with 1–5 **pillars**, each pointing at a signal the user is *already* logging
(sleep, meals, workouts, weight, check-ins, habits, ritual close, chat-derived activity log,
mentioned people) — there is no new logging surface. This is the general-purpose sibling of the
existing body-weight "Cél" (now at `/me/goals/weight`, see [`goal-engine.md`](goal-engine.md)),
which a life goal can reference as a `linked` pillar.

Driving design spec: [`docs/superpowers/specs/2026-09-02-lifegoal-system-design.md`](../superpowers/specs/2026-09-02-lifegoal-system-design.md)
(binding decisions D1–D10, prior art, the three-slice plan). Implementation plan:
[`docs/superpowers/plans/2026-09-02-lifegoal-slice-1-alapok.md`](../superpowers/plans/2026-09-02-lifegoal-slice-1-alapok.md).
Approved prototype (visual truth): [`docs/design_2.0/prototypes/celok.html`](../design_2.0/prototypes/celok.html).
ADR: [`0034-measurable-life-goals.md`](../decisions/0034-measurable-life-goals.md) — see §9.

**Status per layer, slice 2:**
- **Backend:** ✅ real — three tables (`life_goal`, `life_goal_pillar`, `life_goal_pillar_day`),
  full CRUD + status lifecycle (draft → active/parked/done/archived, **no cap on active goals**,
  D7), the closed 28-entry signal catalog + pillar validation, AI propose (companion port + LLM
  adapter + deterministic template fallback), a `demofixtures` seed of three goals + one parked —
  **plus, this slice:** the pure `LifeGoalScorer` engine (daily hit/partial/miss/no_data per pillar
  kind, weighted daily goal-point, 7-vs-21-day arrow), 5 `SignalSource` adapters, and
  `LifeGoalProgressService`'s three read/write operations (`GET /{id}/progress`,
  `POST /{id}/evaluate`, `GET /today`) — see §3/§4. **Plus, `mezo-iizd.6`:** `LifeGoalEvalJob`
  (nightly cron, dual `@ConditionalOnProperty`, calling `evaluateDays` for every user's `active`
  goals with per-user + per-goal error isolation) and `LifeGoalXpService` (the D-1-keyed, hit-only
  XP seam on the pillar's own skill, `source_type=LIFE_GOAL`) — see §3/§5/§9. **Plus,
  `mezo-iizd.7`:** `LifeGoalTriggerRules` (the closed 3-source → metric-predicate mapping),
  `LifeGoalTriggerService` (immediate + delayed evaluation over the same predicate),
  `LifeGoalTriggerListener` (`CheckInSavedEvent` + the new `SportSessionLoggedEvent`),
  `LifeGoalEvalJob` also firing the delayed branch, `AppNotificationKind.LIFE_GOAL_PLAN`, and
  `GET /signals` per-source liveness (`daysWithData`/`live`/`fedPillars`) — see §3/§5/§9.
- **FE:** ✅ the Célok hub (`CelokPage`), the goal detail page (`CelPage`), the five-step
  creation wizard (`CelWizardPage`) — both `pnpm test` (real) and `VITE_USE_MOCK=true pnpm test`
  (mock) green — **plus, this slice:** `CelPage`/`PillarCard` render live dots, arrows, and
  weekly-% (with week/month chips), and `CelokPage`'s hub renders live per-goal arrow counters
  and per-tile dots, all dual-mode via `useLifeGoalProgress`/`useLifeGoalToday`. **Plus,
  `mezo-iizd.7`:** `JelekPage` at `/me/goals/signals` (live/asleep source lists,
  `daysWithData`/`fedPillars` per entry) and the hub's "Jelek · mit figyel a rendszer" row.
- **FE, slice 3's embedding (`mezo-iizd.9`/`.4`/`.12`):** ✅ the Nap mosaic's `LifeGoalTodayTile`,
  the `CelPage` conflict sentence, the Heti hub's `WeekGoalsCard` + `goalWeekSentence`, the Célok
  hub's closed-goals section + Súlycél row, the `EnHubPage` life-goal hero, and the Growth
  skill-row `goalchip` (`goalSkillChips`) — all dual-mode, all with their own tests + visual
  goldens. **Backend, same slice:** the weekly-review prompt's `ÉLETCÉLOK · AZ ELMÚLT 7 NAP`
  block in `WeeklyReviewContextSources` (see [`proactive.md`](proactive.md) §3).
- **Still deferred** (§9): the `[Célok]` **companion (chat)** prompt block + a `get_life_goals`
  chat tool, and the knowledge-graph `GOAL` node (blocked on `mezo-06o0.5`).

## 2. User-facing behavior

- **`/me/goals` → `CelokPage`** (`frontend/src/features/me/pages/CelokPage.tsx`) — the Célok
  hub. Hero: a six-arc `PermahRing` (`components/PermahRing.tsx`, one arc per dimension, lit
  where an active goal exists, center = active-goal count) + one Hungarian line driven by
  `useLifeGoalToday()` — "A pillérek a meglévő naplódból számolnak. **{up}↗ · {flat}→ ·
  {down}↘** ezen a héten." with an `up`/`flat`/`down` tally over the active goals'
  `LifeGoalTodaySummary.arrow`s (an `insufficient` arrow is deliberately excluded from all three
  buckets rather than defaulting into `flat` — too little data must never masquerade as a
  direction), and the pre-existing empty-state copy when there are no active goals.
  A dimension-chip band (`DIMENSION_ORDER`, empty dimensions render grey — no fabricated value).
  A `Mosaic` of one `LifeGoalTile` per **active** goal (`components/LifeGoalTile.tsx`, now showing
  the goal's `today` dots) plus a dashed "＋ Új cél" tile. A parked-goals row below
  (`status='parked'` or `'draft'`) with a one-tap "Vissza" button that reactivates
  (`changeStatus(id, 'active')`). A "Jelek · mit figyel a rendszer" row at the bottom
  (`mezo-iizd.7`) opens `/me/goals/signals` (`JelekPage`) — see below.
- **`/me/goals/signals` → `JelekPage`** (`pages/JelekPage.tsx`, `mezo-iizd.7`, registered ahead
  of the dynamic `me/goals/:id` route). Hero: "**{live}** / {total} forrás él · volt adata az
  elmúlt 7 napban". Two lists, Él / Alszik, one row per catalog entry — clay icon by group,
  `{daysWithData} / 7 nap · {group}` (asleep rows read "nincs adat 7 napja"), and the labels of
  the caller's active goals' active pillars fed by that source as chips. No new logging surface —
  a `principle` footer states it explicitly ("Nincs külső forrás — se naptár, se időjárás, se
  GitHub."). Prototype: [`celok.html`](../design_2.0/prototypes/celok.html) `#page-jelek`.
- **`/me/goals/:id` → `CelPage`** (`pages/CelPage.tsx`) — the goal detail page. Hero: dimension
  icon, title, the goal's live ↗/→/↘ arrow (or a dash while `insufficient`) and weekly-%
  from `useLifeGoalProgress(id)`, and a subtitle line (dimension(s) · date range · status). A
  week/month chip toggle switches the pillar cards' day window between the last 7 and the full
  28-day `progress` payload. Pillar cards (`components/PillarCard.tsx`) — label, skill, kind
  chip, source description, plus (this slice) a live current-value/reference-value line, a
  7/28-day dot row, and an arrow; a pillar whose `SignalSource` returns no data for the whole
  window still renders its honest `—` contract, never a fabricated status. A
  "＋ Pillér" header action opens `PillarCatalogSheet` (`sheets/PillarCatalogSheet.tsx`) to add
  a pillar from the catalog (capped at 5, button disables at the cap). A "Miért · ha–akkor"
  section renders `whyText`, `obstacleText`, and each `ifThenPlans[]` entry — a plan with a
  `trigger` shows "Mezo figiyeli (\<source>)", a manual plan shows "nincs hozzá jel" (D9).
  Status actions at the bottom: Parkolás / Aktiválás / Lezárás / Archiválás, gated by the
  current status (see the status machine in §4).
- **`/me/goals/new` → `CelWizardPage`** (`pages/CelWizardPage.tsx`) — the five-step
  creation wizard (D8): **Cél** (title + why + optional target date) → **Keret** (fires
  `useLifeGoalPropose` exactly once on step 1→2 using title+why; shows Mezo's frame reading,
  an SDT reframe offer when `frame='extrinsic'`, and an editable dimension/secondary-dimension
  chip band seeded by the AI) → **Pillérek** (the AI's suggested pillars as on/off toggle cards,
  plus "＋ Pillér a katalógusból", capped at 5) → **Ha–akkor** (obstacle chips + editable
  ha/akkor plan cards, each footer naming its trigger or "nincs hozzá jelem · ezt te tartod") →
  **Összegzés** (a preview of the goal page — title, dimension chips, why quote, pillar list,
  plan list, and a prose "Aktiválás után" paragraph — never a computed number, per the
  honest-state house rule). Two CTAs on the last step: "Mentés tervezettként" (`activate=false`)
  and "Aktiválás" (`activate=true`, immediately calls `changeStatus(id, 'active')` after create).
- **`/me/goals/weight` (+ `/me/goals/weight/new`)** — the pre-existing body-weight goal
  (`GoalsPage`/`GoalPlannerPage`), unchanged in behavior, moved here in Task 8 so `/me/goals`
  could become the Célok hub. See [`goal-engine.md`](goal-engine.md) §2 and [`me.md`](me.md) §2.

### 2.1 The engine OUTSIDE its own pages (slice 3's embedding, `mezo-iizd.9`/`.4`/`.12`)

Seven surfaces read the same already-computed engine output. None of them recomputes anything, and
every one of them renders NOTHING rather than a fabricated number when its source is unresolved:

- **Nap mosaic · "Célok · ma"** (`frontend/src/features/today/components/LifeGoalTodayTile.tsx`) —
  one tile stating today's pillar tally (`{hit} / {total}`) over the goals that report counts, the
  leading goal's 7 day-dots, and the wash of the dimension carrying the most active goals; opens
  `/me/goals`. The big numeral wears the NEUTRAL `lg-arrow none` class, not the success-green
  `up` — it is a tally, not a direction. Goals that report **no** pillar counts are excluded from
  BOTH numerator and denominator explicitly (a silent `?? 0` would let the tile assert "2 / 3"
  while a fourth goal went uncounted). The tile is absent with no active goal, with an
  unresolved/failed `today`, or when no goal reports counts.
- **Goal detail · conflict sentence** (`CelPage`) — the `LifeGoalTodaySummary.conflicts` field the
  engine already computed finally has a face: one `.lg-conflict` line naming the goal it pulls
  against. No conflict ⇒ no scaffolding.
- **Heti hub · `WeekGoalsCard`** (`features/me/components/WeekGoalsCard.tsx` +
  `logic/goalWeekSentence.ts`) — per active goal an arrow glyph (`—` for `insufficient`), a
  dimension `goalchip` and ONE counted sentence: `{hits} találat-nap a 7-ből · ma {n} / {m}
  pillér`. **`no_data` days are never hits and never misses**: with no data-day at all the sentence
  reads „Ezen a héten még nincs adata." rather than claiming a measured zero. The card renders on
  the **RUNNING week only** — `useLifeGoalToday`'s window is the 7 days trailing NOW, so on a
  browsed-back week it would show this week's arrows under the header „Célok · a hét iránya"; the
  gate is `WeekHubPage`'s existing `running` boolean, the same one `WeekNextCard` uses.
- **Weekly-review prompt · `ÉLETCÉLOK · AZ ELMÚLT 7 NAP`** — backend, see §5 and
  [`proactive.md`](proactive.md) §3.
- **Célok hub · closed goals + Súlycél row** (`CelokPage`, `mezo-iizd.4`) — a `done` goal used to
  vanish from every surface even though `GET /api/life-goals` returns it; it now gets its own
  "Lezárt célok" section BELOW the mosaic (the mosaic is the tense of LIVE goals; a finished goal
  is a memory), each row dimmed with a `✓`. Beneath the Jelek row, a **Súlycél** row carries the
  body-weight goal's entry point (`{trajectory} · {current} → {target} kg`), since the Én-hub hero
  stopped being that door — three honest states, `töltöm…` / `a súlycél most nem elérhető` (a
  FAILED `/api/goals` read) / `nincs aktív súlycél`, never a network error reported as an absence.
  The hub hero's own sentence likewise splits loading from failure („A heti irány most töltődik"
  vs „A heti irányt most nem sikerült lekérni").
- **Én hub · life-goal hero** (`EnHubPage`, `mezo-iizd.4`) — the coral weight track is retired; the
  hero is now the active goals' dimension chips + an `MCells` trio `emelkedik ↗ / tartja → /
  csúszik ↘` off `useLifeGoalToday`, opening `/me/goals`. An unresolved/failed `today` collapses
  the trio to a single „aktív cél" count rather than printing „0↗ · 0→ · 0↘"; with no active goal
  at all the hero is a bare `＋ Új cél` door into `/me/goals/new`. See [`me.md`](me.md) §2.
- **Én hub · `Célok` mosaic tile** (`EnHubPage`, `mezo-rn9u`) — the hub's PERMANENT door to
  `/me/goals`, unconditional by design; only its line varies (`{n} aktív · {m} parkol`, each
  clause dropped at zero, the whole line absent while the list is pending or when there is no
  goal at all). Every other `/me/goals` door is data-gated — the hero above needs an active goal,
  the Nap tile needs one with pillar counts, the Heti card needs a running week AND an active
  goal — so with zero active goals the hub had NO entry point at all. That made parking a
  one-way door (park your last active goal → the hub vanishes → you cannot un-park it) and took
  the closed-goals section, the Jelek page and the Súlycél row down with it. No test or golden
  caught it because `lifegoalMock` seeds three ACTIVE goals, so every run took the populated
  branch; the fix ships with the empty-branch coverage that was missing.
- **Growth skill row · `goalchip`** (`logic/goalSkillChips.ts` + `SkillBandCard`, `mezo-iizd.12`) —
  a skill whose key feeds an active goal's pillar wears that goal's dimension chip, so the Growth
  page shows WHY a skill matters.

## 3. Architecture & data flow

New backend slice `io.mrkuhne.mezo.feature.lifegoal` (`entity / repository / service /
controller / mapper / catalog / config`), gated end-to-end on `LIFEGOAL_SWITCH`
(`FeaturesConfiguration`). Read path: `view → useLifeGoals()/useLifeGoal(id) → useDualQuery →
lifegoalApi (real) | MOCK_LIFE_GOALS (mock) → LifeGoalController → LifeGoalService →
LifeGoalRepository → life_goal/life_goal_pillar`. Write path (create/update/status/pillars):
`useLifeGoalMutations() → lifegoalApi.<op> → LifeGoalController → LifeGoalService /
LifeGoalPillarService → repository`, with mock mode patching an in-memory
`['lifeGoals']` query-cache list instead (`lifegoalHooks.ts`).

**`life_goal_pillar_day` now has two writers** (`mezo-iizd.6`), both funneling through the same
`LifeGoalProgressService.evaluateDays(userId, goal)`: the manual `POST /{id}/evaluate` endpoint,
and `LifeGoalEvalJob` — a nightly `@Scheduled(cron = "${mezo.lifegoal.eval-cron}")` bean (default
`0 20 0 * * *`, i.e. 00:20, deliberately after the 00:10 habit close) that iterates every user's
`active` goals and calls the same method. The job is gated by BOTH `mezo.feature.lifegoal.enabled`
and `mezo.techcore.cron.life-goal-eval-job.enabled` (`FeaturesConfiguration.LIFE_GOAL_EVAL_JOB_SWITCH`)
via a dual `@ConditionalOnProperty` — either switch off and the job bean does not exist at all,
while the manual `evaluate` endpoint keeps working. Failures are isolated per user (the goal-list
fetch) and per goal (each `evaluateDays` call) — one broken signal source or a user with a bad row
must not cost every other user, or every other goal, its evaluation. `evaluateDays`'s day-upsert
also calls `LifeGoalXpService.awardIfHit` per pillar-day, so both writers grant XP identically —
see §5.

**Ha–akkor trigger evaluation, two entry points over one predicate** (`mezo-iizd.7`,
`feature/lifegoal/service/{LifeGoalTriggerRules,LifeGoalTriggerService,LifeGoalTriggerListener}`,
spec §.7/D-3): a plan's `trigger.source` is one of exactly three closed values — the same three
`LifeGoalProposeLlmAdapter.TRIGGER_SOURCES` whitelists (§3 above) — and `LifeGoalTriggerRules`
(a pure, dependency-free class, fully covered by `LifeGoalTriggerRulesTest`) maps each to a
`PillarSourceJson` metric signal plus a day-value predicate:

| `trigger.source` | Metrika-jel | Predikátum |
|---|---|---|
| `sport_session_logged` | `metric:SPORT_LOAD_MIN` | a napi érték > 0 |
| `checkin_energy_lte` | `metric:CHECKIN_ENERGY` | a napi érték ≤ küszöb. A küszöb a `condition` szám-szövege; HIÁNYZÓ `condition` esetén 4 az alapérték, NEM-SZÁM `condition` esetén viszont **nem tüzelünk** — a 4-es fallback lazíthatna a szándékon (egy `"<=2"` kétszer lazábbra esne vissza) |
| `ritual_missed` | `metric:RITUAL_CLOSED` | a napi érték hiányzik VAGY 0 — az EGYETLEN hiány-alapú szabály. **Adopciós kapu:** csak akkor szólalhat meg, ha a kiértékelt napot megelőző 14 napban volt legalább EGY lezárt rituálé-nap; aki nem (vagy már nem) használja a rituálét, azt nem nyaggatjuk |

The signal value itself comes from the same `SignalSource` dispatch `LifeGoalProgressService`
uses (`sources.stream().filter(s -> s.supports(source)).findFirst()`), so the trigger path adds
no new dependency. **"Nincs adat" ≠ "a jel alszik":** if NO `SignalSource` bean supports the
trigger's signal (companion switch off ⇒ no `MetricSignalSource`), the plan is **skipped entirely**
— no predicate call, no emit. Without that split the gap-based `ritual_missed` would read the
missing bean as "the ritual was missed" and nudge every night, forever, even for a user who closed
every day. This is the same "asleep" state `LifeGoalSignalService`'s liveness reports (§3, D-4).

`LifeGoalTriggerService` exposes two entry points over that same predicate, both restricted to
`status == "active"` goals (the same evaluable definition `LifeGoalProgressService.evaluateDays`
uses): **`fireImmediate(userId, source, day)`** evaluates every active goal's plans whose
`trigger.source` matches the fired source, for plans with `delayHours` null/0 — called from
`LifeGoalTriggerListener`, an `@Async` + `@TransactionalEventListener(AFTER_COMMIT)` component
(the `FlagEvaluationListener` pattern) on the pre-existing `CheckInSavedEvent`
(`checkin_energy_lte`) and the NEW `SportSessionLoggedEvent` (`sport_session_logged`), published
by `SportService.logSportSession` in `feature/train` — AFTER_COMMIT so only a persisted row
triggers evaluation, `@Async` so a notification can never slow or fail the check-in/sport-session
response. **`fireDelayed(userId, goal, today)`** evaluates plans with `delayHours > 0` PLUS EVERY
`ritual_missed` plan regardless of its `delayHours` (absence can only be judged after the day
closes — there is no "ritual missed" event), against **the same three closed days
`evaluateDays` rewrites** (yesterday, −2, −3, newest first) — called from
`LifeGoalEvalJob.runEval()` inside its existing per-goal try/catch, right after
`evaluateDays`, so one broken goal's trigger evaluation cannot cost another goal or user its
pillar-day write. The rolling window is what earns a LATE-logged day its delayed nudge (a Monday
session written on Tuesday evening still speaks), and re-running is safe precisely because the
dedup key is per-day. There is no separate scheduler for the delayed branch (D-3).

A firing plan emits `AppNotificationKind.LIFE_GOAL_PLAN` via `AppNotificationEmitter` — see §5
for the notification shape and the `dedupKey` that makes "one plan speaks at most once a day, on
the first transition only" hold across repeated evaluation.

**Dependency direction (spec §3, ArchUnit `feature_slices_are_cycle_free`):** `lifegoal` may
import `companion`, `progression` (`ProgressionTaxonomy` — skill-key validation), and `habit`
(`HabitCatalogService`, via `ObjectProvider`, for habit-key validation — degrades to "cannot
verify" → reject, rather than a hard Spring-context dependency, when `HABIT_SWITCH` is off).
**Plus, `mezo-iizd.7`:** `LifeGoalTriggerListener` imports `feature/train`'s
`SportSessionLoggedEvent` (a plain event-class import, listened on, not called) — the direction
stays `lifegoal → train` one-way, `train` does not import `lifegoal`.
**Nothing may import `lifegoal` back** — the AI propose seam is a port owned by `companion`
(`companion/LifeGoalProposePort.java`, implemented by `companion/llm/LifeGoalProposeLlmAdapter`)
that `lifegoal/service/LifeGoalProposeService` calls through an `ObjectProvider`, never the
other direction. This mirrors the `QuestLedgerSource`/`WeekReviewSource` port idiom used
elsewhere in the codebase (see [`_platform-api-backend.md`](_platform-api-backend.md)). This
slice's `engine/*SignalSource` adapters add three more one-way reads: `companion`
(`MetricSeriesService`, for `metric`/`social_mentions`), `activity` (`ActivityLogRepository`),
`needs` (`NeedsDayRepository`), and `goal`/`biometrics` (`GoalRepository` +
`WeightTrendService`, for the `linked` `weight_goal` source) — all one-directional, none of
those slices import `lifegoal`.

**The scoring engine** (`engine/` — Task 2–5, mezo-iizd.5, spec §5): a pure, side-effect-free
core with no Spring context.
- **`LifeGoalScorer`** (`engine/LifeGoalScorer.java`) scores one pillar-day at a time,
  dispatching on `kind` (`scoreDay(kind, rule, day, window)` → `PillarDayScore{status, value,
  target, baseline}`): **habit** — today's value on the good side of `rule.threshold`/
  `comparator` (`gte`/`lte`) → `hit`, else `miss`; no value → `no_data` (never a miss). **average**
  — the mean of `rule.windowDays` (default 7) trailing values against `rule.threshold`: `hit` on
  the good side, `partial` inside a ±10% band around the threshold, else `miss`; no data in the
  window → `no_data`. **target** — linear-interpolates an `expected` value between
  `rule.startValue`/`startDate` and `targetValue`/`targetDate`, compares today's value against it
  per `rule.direction` (`up`/`down`). **baseline** — compares today's value against the *median*
  of the preceding `rule.windowDays` (default 28, needs ≥`rule.minDataDays`, default 14, or
  `no_data`) per `rule.direction`; there is no `partial` for baseline. **linked** — see
  `WeightGoalSignalSource` below; ±0.3 kg tolerance around the expected pace, `hit`/`partial`
  (linked never scores a plain `miss` — a declining trend still inside tolerance is honest
  progress, not failure). A day with no signal value is `no_data` in every kind — never coerced
  into `miss` (the ADR-0034 guardrail in §9).
- **`LifeGoalScorer.dailyPoint`** turns one day's per-pillar statuses into the goal's weighted
  daily point: `hit=1`, `partial=0.5`, `miss=0`, weighted by each pillar's `weight` (1–3),
  `no_data` pillars excluded from both the sum and the weight total; **a day where every active
  pillar is `no_data` yields `null`**, not a fabricated 0.
- **`LifeGoalScorer.arrow`** compares the mean daily point over the trailing 7 days against the
  trailing 21 days *before* that (days 8–28 back), both gated at ≥5 data-days — below the gate,
  or if either window's non-`null` day count is short, the result is `insufficient`, never a
  guessed direction. `up`/`down` need a ≥0.10 mean-point swing; anything smaller is `flat`.
- **`SignalSource`** (`engine/SignalSource.java`) is a one-method-pair port —
  `supports(PillarSourceJson)` / `window(userId, source, from, to) → SignalWindow` — that
  `LifeGoalProgressService` dispatches over via `sources.stream().filter(s ->
  s.supports(pillar.getSource())).findFirst()`. **Five `@Component` adapters exist:**
  `MetricSignalSource` (`type=metric`, any `MetricKey` via `MetricSeriesService`),
  `SocialMentionsSignalSource` (`type=social_mentions`, fixed to `MetricKey.SOCIAL_MENTIONS`,
  same port), `ActivitySignalSource` (`type=activity`, aggregates `ActivityLogEntity` rows by
  `skillKey` + `measure ∈ {minutes,count,huf}` per day), `NeedsRingSignalSource`
  (`type=needs_ring`, one `NeedsDayEntity` ring field per closed day — an un-closed day is
  absent, never a fabricated 0), and `WeightGoalSignalSource` (`type=weight_goal`, the `linked`
  kind's source — see below). **There is deliberately no adapter for `source.type=habit`:** the
  habit catalog entry (`HABITS_DONE`) is itself a `metric` served by `MetricSignalSource`, so a
  pillar whose `source.type` is literally `habit` matches no adapter's `supports()` and every day
  scores `no_data` via `LifeGoalProgressService.windowFor`'s empty-`SignalWindow` fallback — this
  is intentional, not a gap (spec `2026-09-03-lifegoal-slice2-motor-design.md`). Such a pillar
  **is creatable** (see the catalog-validation note below), not rejected — it is permanently
  unscored by design, not unbuildable.
- **`WeightGoalSignalSource`** (linked pillars, `feature/goal`/`feature/biometrics.weight`
  imports) reads the trend-weight EWMA series (`WeightTrendService.computeTrend`) and the single
  active body-weight `GoalEntity`'s start/target line, builds a day→expected-weight `targets` map
  by the same linear interpolation as `target` kind, and returns empty `values`/`targets` (→
  every day `no_data`) when there is no active goal or no `targetWeightKg` — the honest-absence
  rule holds even for the linked kind.

**Catalog validation** (`SignalCatalog`, `LifeGoalPillarService.validate`): every pillar's
`source` (type+key/skillKey+measure/ring) must exact-match one of the 28 closed
`SignalCatalogEntry` rows, and its `kind` must be one of that entry's allowed `kinds` — an
unknown source/skill/kind is rejected with a dedicated `SystemMessage` code (§4). **`source.type=
habit` is the one exception:** `validate`'s habit branch checks `habitKey` against the user's own
`habit_def` rows (via `HabitCatalogService`, cross-feature read through `ObjectProvider` so
`HABIT_SWITCH` off degrades to "cannot verify" rather than breaking context) and skips the
catalog-entry check entirely — a known `habitKey` is accepted with no `SignalCatalogEntry` behind
it at all (slice-1 behavior, unchanged by slice 2). Every other source still goes through the
closed catalog; there is no free-text metric or external integration (D3). The habit-source
pillars this creates score `no_data` forever (no `SignalSource` adapter serves `source.type=
habit`, see above) — excluded from `dailyPoint` and from conflict detection, but not rejected at
creation time.

**AI propose, port-first-then-template** (`LifeGoalProposeService.propose`): if
`LifeGoalProposePort` has no bean (any of `LIFEGOAL_AI_PROPOSE_SWITCH` /
`COMPANION_SWITCH` / `LIFEGOAL_SWITCH` off) or the LLM call/parse fails or every proposed
pillar fails catalog validation, the service falls through to `LifeGoalTemplateProposer` — a
deterministic, dimension-keyed rule-based proposal. **The response is never empty** (spec §7).

**The propose response must be a LEGAL create request.** The wizard feeds it into
`POST /api/life-goals` verbatim, so anything the model over-produces would answer 200 on propose
and then 400 on save, dead-ending the wizard. `LifeGoalProposeLlmAdapter` therefore clamps
`pillars` to `maxPillars` and BOTH `plans` and `obstacles` to 5 (`LifeGoalUpsertRequest`'s
`maxItems`), and truncates the model's strings to the schema maxima (`label` 80, `ha`/`akkor`
240, obstacle 300); `LifeGoalProposeService.toResponse` re-checks each proposed `kind` against
its catalog entry's allowed `kinds()` — the same check `LifeGoalPillarService.validate` applies
on save — and drops a pillar that would fail it. A plan's `triggerSource` is whitelisted to
`sport_session_logged` / `checkin_energy_lte` / `ritual_missed`; anything else **nulls the
trigger but keeps the plan**, so the UI falls through to its honest "nincs hozzá jel" label
instead of promising „Mezo figyeli (<source>)" for a trigger nothing will ever evaluate.

## 4. Data model & API

Three tables (`db/changelog/1.0.0/script/…life_goal…sql`), all `OwnedEntity` (soft-deleted,
`created_by`-scoped):

- **`life_goal`** — `title`, `why_text`, `frame` (`intrinsic|extrinsic|unset`), `dimension` +
  nullable `secondary_dimension` (`ck_life_goal_dimension`, the six PERMAH keys:
  `positive_emotion|engagement|relationships|meaning|accomplishment|health`), `status`
  (`ck_life_goal_status`: `draft|active|parked|done|archived`, **no active-count cap**, D7),
  `start_date`, nullable `target_date` (`ck` target ≥ start), `activated_at`, `closed_at`,
  `obstacle_text`, `if_then_plans jsonb` (list of `{ha, akkor, trigger: {source, condition,
  delayHours} | null}` — `IfThenPlanJson`/`PlanTriggerJson`).
- **`life_goal_pillar`** — `goal_id` fk, `label`, `skill_key` (validated against
  `ProgressionTaxonomy` LIFE+ATHLETIC+MUSCLE+ROBUSTNESS), `kind` (`habit|average|target|
  baseline|linked` — the Strides-inspired taxonomy, D10), `weight int 1..3`, `position`,
  `active bool`, `source jsonb` (`PillarSourceJson`: `{type: metric, key}` ·
  `{type: activity, skillKey, measure: minutes|count|huf}` · `{type: habit, habitKey}` ·
  `{type: weight_goal}` · `{type: needs_ring, ring}` · `{type: social_mentions}`), `rule jsonb`
  (`PillarRuleJson`, shape depends on `kind`: habit `{threshold, comparator, daysPerWeek}` ·
  average `{threshold, comparator, windowDays}` · target `{startValue, targetValue, startDate,
  targetDate, direction}` · baseline `{windowDays=28, minDataDays=14, direction}` · linked `{}`).
- **`life_goal_pillar_day`** — `uq(pillar_id, day)`, `value`/`target`/`baseline numeric`,
  `status` (`hit|partial|miss|no_data`), `computed_at`. **Written by two callers now** (`mezo-iizd.6`,
  see §3): `POST /{id}/evaluate` and the nightly `LifeGoalEvalJob`, both funneling through
  `LifeGoalProgressService.evaluateDays`, which upserts the last 3 *closed* days (today−1..today−3,
  "closed" so late-logged data still gets one more re-write pass) for every active pillar
  (`evaluateDays` → `upsertPillarDay`) — a plain `GET /{id}/progress` never writes, it only reads
  what's there and computes the rest on the fly (below). The rows hang off the pillar's
  **identity**, which is why `replace` updates pillars in place (below) and why every pillar
  deletion path soft-deletes the pillar's day rows with it (`LifeGoalPillarService.deleteWithDays`;
  the table has no cascade of its own).

**Stored rows win, missing days compute on read** (`LifeGoalProgressService.compute`): for a
`progress`/`today` read, every active pillar is scored across a widened `[from−28, to]` window
purely in memory via `LifeGoalScorer`, and then any stored `life_goal_pillar_day` row inside
`[from, to]` **overwrites** the in-memory score for that day — a read never persists anything, so
a goal that has never been `evaluate`d still renders live numbers, just none of them durable
until the first `evaluate` call.

**Contract** — `api/feature/lifegoal/lifegoal.yml`, twelve operations:

| Method | Path | Returns | Notes |
|---|---|---|---|
| GET | `/api/life-goals` | `LifeGoalResponse[]` | newest first, non-deleted |
| POST | `/api/life-goals` | `LifeGoalResponse` (201) | creates in `draft`; 400 on validation |
| GET | `/api/life-goals/{id}` | `LifeGoalResponse` | 404 if not found/owned |
| PUT | `/api/life-goals/{id}` | `LifeGoalResponse` | editable fields only — status/pillars untouched |
| DELETE | `/api/life-goals/{id}` | 204 | soft-delete goal + pillars + their day rows |
| POST | `/api/life-goals/{id}/status` | `LifeGoalResponse` | lifecycle transition; 409 on illegal one |
| PUT | `/api/life-goals/{id}/pillars` | `LifeGoalResponse` | replaces the whole list, `maxItems: 5`; an echoed `id` keeps that pillar |
| GET | `/api/life-goals/signals` | `SignalCatalogResponse` | the 28-entry closed catalog + per-entry `live`/`daysWithData`/`fedPillars` liveness (`mezo-iizd.7`, see below) |
| POST | `/api/life-goals/propose` | `LifeGoalProposeResponse` | AI-or-template draft, never empty |
| GET | `/api/life-goals/{id}/progress` | `LifeGoalProgressResponse` | `from`/`to` query params, `from ≤ to` (400 otherwise); read-only, never writes |
| POST | `/api/life-goals/{id}/evaluate` | `LifeGoalProgressResponse` | idempotent upsert of the last 3 closed days, then returns a 28-day `progress` |
| GET | `/api/life-goals/today` | `LifeGoalTodayResponse` | per-active-goal arrow + 7-day dot row + pillar-hit tally, no `{id}` |

**`LifeGoalProgressResponse`** — `arrow` (`up|flat|down|insufficient`), `weeklyPct` (mean daily
point over the last 7 days × 100, `null` if all 7 are `no_data`), `days[]` (one `{day, point}`
per day in `[from, to]`), `pillars[]` (one `PillarProgress` per active pillar: `arrow`,
`currentValue` = 7-day value average, `referenceValue` = threshold (habit/average) / expected-at-
`to` (target/linked) / median-at-`to` (baseline), `missingHitDays` — habit kind + `down` arrow
only, `max(0, daysPerWeek − hits in the last 7 days)` — and `days[]` with per-day
`status`/`value`/`target`/`baseline`), and `conflicts[]` (Hungarian one-liners; see below).

**`LifeGoalTodayResponse`** — one `LifeGoalTodaySummary` per **active** goal: `goalId`, `title`,
`dimension`, `arrow`, `days7[]` (7 `PillarDayStatus` dots, `hit`≥0.66 / `partial`≥0.33 /
else `miss`/`no_data` on the day's weighted point), `pillarsTotal`, `pillarsHitToday`.

**Goal conflicts** (`LifeGoalProgressService.findConflicts`, spec §5 step 7): for every active,
non-`linked` pillar of *this* goal, matched by `SignalCatalog.find` identity against every other
active goal's active, non-`linked` pillars — an opposite intent (habit/average: `comparator`
`gte`↔`lte`; target/baseline: `direction` `up`↔`down`) adds a deduplicated Hungarian line: `"<jel
label> · két cél ellentétes irányba húzza (<másik cél címe>)"`. `linked` pillars are excluded on
both sides (a body-weight pace pillar cannot "conflict" with itself across goals).

**Error codes** (`messages.properties`): `LIFE_GOAL_INVALID_STATUS_TRANSITION`,
`LIFE_GOAL_UNKNOWN_SIGNAL`, `LIFE_GOAL_UNKNOWN_SKILL`, `LIFE_GOAL_TOO_MANY_PILLARS`,
`LIFE_GOAL_KIND_NOT_ALLOWED`, `LIFE_GOAL_UNKNOWN_PILLAR`. **Gotcha (§9):** the contract's `maxItems: 5` on both
`LifeGoalUpsertRequest.pillars` and `LifeGoalPillarsRequest.pillars` intercepts a 6th pillar
with a generic bean-validation error *before* `LifeGoalPillarService.validate`'s
`LIFE_GOAL_TOO_MANY_PILLARS` check ever runs — `LifeGoalProperties.maxPillars` (also capped at
5 by `@Max(5)`) exists only for future non-HTTP callers; raising the cap means raising both.

**Pillar identity across a replace** (mezo-iizd.2, `LifeGoalPillarService.replace`):
`LifeGoalPillarInput.id` is optional and is the client's way of saying *this is the same pillar*.
An input carrying the id of one of the goal's live pillars **updates that row in place** (label,
skill, kind, weight, active, source, rule, position); an input without an id is inserted; a live
pillar nobody claimed is soft-deleted together with its `life_goal_pillar_day` rows. An id that
is not one of this goal's live pillars — including the same id twice in one list — is a 400
(`LIFE_GOAL_UNKNOWN_PILLAR`), never a silent insert. One deliberate exception to "identity keeps
history": if the echoed pillar's **`source` or `kind` changed**, the day rows are dropped even
though the id survives — old `hit`/`miss` verdicts about a different measurement are not
comparable. The frontend upholds its half of this in `CelPage.addPillar`, which strips only
`position` (server-derived) and sends every existing pillar back with its id; the mock hook and
the MSW handler mirror the same rule (`lifegoalHooks.replacePillars`, `handlers.lifeGoalEcho`).

**Signal catalog** (`SignalCatalog`, 28 entries, seven Hungarian groups): Alvás (3: sleep
duration/quality, bedtime variability), Fuel (5: protein, kcal, water, late-meal hour, meal
score), Edzés (5: gym volume, sport load, ACWR, HR recovery, the `weight_goal` linked entry),
Elme (6: check-in energy/mental/stress, habits-done, ritual-closed, daily-XP), Activity
(5: productivity/learning/financial/connection/cooking, each keyed by an `activity_log.skill_key`
+ `measure`), Emberek (1: social mentions), Életjel (3: mozgás/pihenés/lélek needs rings).
`GET /api/life-goals/signals` exposes it verbatim, plus per-entry liveness
(`LifeGoalSignalService.catalog`, `mezo-iizd.7`): `daysWithData` — how many of the trailing 7
days (today inclusive) the same `SignalSource` dispatch `LifeGoalProgressService` uses returned a
non-null value for that entry's `source` — `live = daysWithData > 0`, and `fedPillars` — the
labels of the *caller's own active goals'* active pillars whose `source` matches that catalog
entry (`SignalCatalog.find`), so an entry with zero fed pillars still reports its liveness even
if nothing currently consumes it. With the companion switch off (no `MetricSignalSource` bean)
every `metric`-sourced entry simply reads `daysWithData=0`/`live=false` — intended, not a bug,
same as the trigger path in §3.

**FE types & mocks** — `frontend/src/data/lifegoal/lifegoalApi.ts` (generated-DTO-shaped
hand-written types, mirroring the contract), `lifegoalMock.ts` (`MOCK_LIFE_GOALS`,
`MOCK_SIGNAL_CATALOG`, `mockPropose`).

## 5. Integrations

- **← Companion** (port, real one-way). *Contract:* `LifeGoalProposePort.Proposal` — dimension
  (+ secondary), frame + frame note + optional reframe, pillars, obstacles, if–then plans.
  `lifegoal/service/LifeGoalProposeService` calls it through an `ObjectProvider`; `companion`
  never imports `lifegoal`. See §3.
- **← Progression** (`ProgressionTaxonomy`). *Contract:* the static skill-key sets (LIFE,
  ATHLETIC, MUSCLE, ROBUSTNESS) `LifeGoalPillarService` validates every pillar's `skillKey`
  against.
- **→ Progression** (`mezo-iizd.6`, `LifeGoalXpService` → `ProgressionService.applyLifeGoal`).
  *Contract:* every evaluated `hit` pillar-day grants `mezo.lifegoal.xp-per-hit` XP (default 5) on
  the pillar's *own* `skillKey`, `source_type=LIFE_GOAL`, riding the shared idempotent `award(...)`
  tail — `LifeGoalSignal{sourceRefId, skillKey, skillKind, xp, label, occurredOn}`, `skillKind`
  derived from `ProgressionTaxonomy` (LIFE/ATHLETIC/MUSCLE). Idempotency key is the D-1
  deterministic `LifeGoalXpService.refIdFor(pillarId, day)` = `UUID.nameUUIDFromBytes(
  "lifegoal:<pillarId>:<day>")` — stable across the job's 3-day rewrite window and across a
  source/kind change that drops and recomputes the pillar-day rows. Only a `hit` day awards; a
  `miss`/`partial`/`no_data` day never subtracts (ADR 0034). A `robustness`-keyed pillar's `hit`
  grants **nothing** — the shared progression tail recomputes that skill to an absolute streak
  target, so a delta award there would be discarded (see §9). Progression is optional via
  `ObjectProvider<ProgressionGate>` — the progression feature off (no `ProgressionGate` bean) and
  the award is a no-op, the pillar-day row still writes.
- **← Habit** (`HabitCatalogService`, via `ObjectProvider`). *Contract:* habit-key existence
  check for `source.type=habit` pillars; a missing bean (feature off) degrades to reject, not
  a hard dependency.
- **← Goal / goal-engine + Biometrics** (the `weight_goal` catalog entry + `linked` pillar kind,
  `WeightGoalSignalSource`, this slice). *Contract:* reads the single active body-weight
  `GoalEntity` (`GoalRepository.findByCreatedByAndStatusAndDeletedFalse`) for its start/target
  weight and dates, and `WeightTrendService.computeTrend`'s EWMA series for the day-by-day trend
  weight — a `SignalSource`-shaped one-way read, `goal`/`biometrics` never import `lifegoal`. See
  [`goal-engine.md`](goal-engine.md) §5 for the weight-goal side.
- **← Activity, Needs** (`ActivitySignalSource`, `NeedsRingSignalSource`, this slice).
  *Contract:* `ActivityLogRepository` (rows filtered by `skillKey`, aggregated per day by
  `measure`) and `NeedsDayRepository` (one ring field per closed day) — both read-only, one-way.
- **← Train** (`SportSessionLoggedEvent`, `mezo-iizd.7`). *Contract:* `LifeGoalTriggerListener`
  listens for the event `SportService.logSportSession` publishes (AFTER_COMMIT), feeding the
  `sport_session_logged` trigger source — see §3. One-way (`lifegoal → train`); `train` does not
  import `lifegoal`.
- **← Biometrics (check-in)** (`CheckInSavedEvent`, pre-existing, now also consumed by
  `mezo-iizd.7`'s `LifeGoalTriggerListener` for the `checkin_energy_lte` trigger source — same
  event the pattern-detection slice already listens to, no new publisher).
- **→ AppNotification** (`mezo-iizd.7`, `LifeGoalTriggerService` → `AppNotificationEmitter`).
  *Contract:* `AppNotificationKind.LIFE_GOAL_PLAN` (`life_goal_plan`), feed-only (`familyKey =
  null`, the `WEEKLY_REVIEW_READY` precedent — an existing push category already covers the
  underlying check-in/sport-session/nightly-job event, a second category would double-notify),
  deeplink `/me/goals/{goalId}`, `dedupKey = <goalId>:<planKey>:<day>`, where `planKey` is the
  first 12 hex chars of `SHA-256(ha + " " + akkor + " " + trigger.source)`
  (`LifeGoalTriggerRules.planKey`) — see §3 and §9.
- **→ Proactive (weekly review)** (`mezo-iizd.9`, new): `WeeklyReviewContextSources` reads
  `LifeGoalProgressService#today(userId)` directly (an acyclic `proactive → lifegoal` read, the
  `CheckInNoteSourceAdapter` precedent — no port minted) and renders the `ÉLETCÉLOK · AZ ELMÚLT
  7 NAP` prompt block: max 5 ACTIVE goals, `title [dimension] <arrow-word> · N találat-nap a
  7-ből`. *Contract:* the block is FACTS the model must explain, never recompute; the header names
  the trailing-7-day window it actually measures (one day off the Monday-06:50 cron's reviewed
  week — a windowed `today(from, to)` variant is a separate, later issue); and a goal with **no
  data-day** renders `ezen a héten még nincs adata` rather than a `0 találat-nap` tally, the same
  rule `goalWeekSentence.ts` enforces on the Heti hub. See [`proactive.md`](proactive.md) §3.
- **→ Today (Nap mosaic)** (`mezo-iizd.9`): `LifeGoalTodayTile` reads `useLifeGoalToday()` and
  renders ONE fact — today's pillar tally over the goals that report counts — plus the leading
  goal's 7 dots. It renders `null` (never a fabricated `0 / 0`) when there is no active goal, when
  `today` is unresolved/failed, or when no goal reports pillar counts. See [`today.md`](today.md).
- **→ Me (Heti hub, Én hub, Growth)** (`mezo-iizd.9`/`.4`/`.12`): the Heti hub's `WeekGoalsCard`
  (running week ONLY — `useLifeGoalToday`'s window trails NOW, so a browsed-back week would show
  this week's arrows under „a hét iránya"), the Én hub's life-goal hero (dimension chips + the
  ↗/→/↘ counters, opening `/me/goals`), and the Growth skill row's `goalchip` (`goalSkillChips`).
  See [`me.md`](me.md) §2 and [`growth.md`](growth.md).
- **🟣 Deferred seams (spec §5–§7):** `companion/LifeGoalSource` port feeding the
  `ContextSnapshotAssembler` `[Célok]` **chat** prompt block + a `get_life_goals` chat tool; the
  knowledge-graph `GOAL` node (`GraphPromotionService`, blocked on `mezo-06o0.5`). Neither reads
  nor writes anything today.

## 6. How to use it (consume)

```ts
import {
  useLifeGoals, useLifeGoal, useLifeGoalMutations, useLifeGoalPropose, useSignalCatalog,
  useLifeGoalProgress, useLifeGoalToday,
} from '@/data/hooks'

const { goals, isPending, isError, refetch } = useLifeGoals()          // LifeGoalResponse[]
const { goal, isPending, isError, refetch, goalCount } = useLifeGoal(id) // one goal or null, derived from the list
const { create, update, changeStatus, replacePillars, remove, pending } = useLifeGoalMutations()
const { entries } = useSignalCatalog()                       // the 28-entry catalog
const { propose, pending: proposing } = useLifeGoalPropose() // AI/template draft
const { progress, isPending, isError } = useLifeGoalProgress(id) // fixed 28-day window (today-27..today)
const { today, isPending, isError } = useLifeGoalToday()          // per-active-goal arrow/dots/tally
```

All hooks are dual-mode (`isMockMode()`), never reach into `lifegoalApi.ts` or
`lifegoalHooks.ts` directly, and follow the `_platform-data-layer.md` ghost-guard convention —
nothing renders while `useLifeGoals()`/`useLifeGoal()` is pending. `useLifeGoal(id)` derives
from the same `['lifeGoals']` query the hub reads, so there is no second network round trip on
navigating hub → detail. `useLifeGoalProgress`/`useLifeGoalToday` are read-only wrappers over
`GET /progress`/`GET /today` (mock mode: `mockProgress`/`mockToday` in `lifegoalMock.ts`,
deterministic per goal id) — neither calls `evaluate`; nothing in the FE writes
`life_goal_pillar_day` rows.

**Both pages render the full loading/empty/error triad, never two of the three.** `isPending`
returns a `ScreenSkeleton` (the hub used to print a fabricated "0 aktív · 0 parkol" during the
real-mode loading window), and `isError` with an empty list renders a terminal `GhostState` +
"Újra" retry — a failed fetch must never read as "you have no goals" / "no such goal".
`useLifeGoal` also exposes `goalCount` for exactly that distinction: a resolved-but-absent id is
the only real not-found. Because `useLifeGoal` derives from the LIST query and
`invalidateQueries` does **not** refetch an inactive query, `create`'s real arm writes the
created goal into the `['lifeGoals']` cache before returning — without it the wizard's
navigation to `/me/goals/{id}` flashed "Nincs ilyen cél.".

**A pillar added from `PillarCatalogSheet` goes through `features/me/logic/pillarFromCatalog.ts`**
(both the Cél-oldal `＋ Pillér` flow and the wizard's step 3 use it, so the two cannot drift).
It picks the kind by preference order — the first of `average`/`baseline`/`habit`/`target`/
`linked` the entry allows, NOT `kinds[0]` — and attaches a real default rule for each
parameterisable kind (habit: `gte`/`threshold 1`/`5× per week`). `kinds[0]` sent `rule: {}` for
the 13 of 28 entries whose first kind is `habit`, which `PillarCard` rendered as a literal `?`
and `LifeGoalScorer` could not score (a `rule: {}` habit pillar has no `threshold`/`comparator`
to evaluate against).

## 7. How to extend it

**Add a catalog entry** (a new signal a pillar may point at): add one `SignalCatalogEntry` to
`SignalCatalog.ENTRIES` (backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/catalog/SignalCatalog.java)
naming its `source`, Hungarian `label`/`group`, allowed `kinds`, `unit`, and `defaultSkillKey`
— then mirror it in `frontend/src/data/lifegoal/lifegoalMock.ts`'s `MOCK_SIGNAL_CATALOG` so mock
mode's `PillarCatalogSheet` offers the same option. No migration or contract change needed (the
catalog is code, not a table). If the new signal is a `metric` source, its `MetricKey` must
already exist in `companion/service/MetricSeriesService`.

**Add an endpoint / change the contract:** contract-first per
[`_platform-api-backend.md`](_platform-api-backend.md) §3 — edit
`api/feature/lifegoal/lifegoal.yml`, `cd api/generate && npm run generate:api`, implement the
generated `LifeGoalApi` method in `LifeGoalController`, add the service logic, a Liquibase
migration if the data model changes (`docs/references/liquibase_conventions.md`), a dual-mode
FE hook, an MSW handler, and green tests in both `pnpm test` and `VITE_USE_MOCK=true pnpm test`.

**Mock-only extension:** a new wizard step or hub affordance that has no backend counterpart yet
can be prototyped by extending `lifegoalMock.ts` alone — see `mockPropose` for the shape of a
pure-mock branch that never touches `lifegoalApi.ts`.

## 8. Testing

**Backend** (`backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/`), all requiring
`-Dmezo.test.use-testcontainers=true`:
- `LifeGoalEntityIT` — entity/repository round-trip (`AbstractIntegrationTest`).
- `LifeGoalApiIT` — CRUD + status-transition matrix (draft→active→parked→active, done,
  archive) + the too-many-pillars 400 (`ApiIntegrationTest`).
- `LifeGoalPillarApiIT` — `PUT /pillars` catalog/skill/kind/cap validation.
- `LifeGoalProposeIT` — AI-branch (`[fake-lifegoal-propose:{…}]` sentinel), malformed-JSON
  degrade, and the template fallback when the port is absent.
- `LifeGoalSeedDataIT` — the `demofixtures` seed, `@ActiveProfiles({"demodata",
  "demofixtures"})` (see the `AbstractIntegrationTest` gotcha in §9): row counts, the four
  titles/statuses/`createdBy`, `activatedAt` on the three active goals, and every seeded pillar
  run through `SignalCatalog.find` + its entry's allowed `kinds` (D4's closed-catalog guarantee).
- **This slice:** `engine/LifeGoalScorerTest` — pure unit tests, no Spring context, per-kind
  hit/partial/miss/no_data coverage for all five kinds (habit/average/target/baseline/linked,
  both `gte`/`lte` and both `up`/`down` directions where applicable) plus `dailyPoint` (weighting,
  the no_data skip, the all-`no_data`→`null` day) and `arrow` (the ≥5-data-day gate per window,
  the ±0.10 up/flat/down thresholds). `engine/SignalSourceIT` — `ActivitySignalSource` (minutes
  sum, skill-key filtering, count measure, no-rows day) and `NeedsRingSignalSource` (only closed
  days produce a key) against real rows (`AbstractIntegrationTest`). `engine/WeightGoalSignalSourceIT`
  — the linked adapter's `values`/`targets` window against a seeded active `GoalEntity` + weigh-ins,
  and the no-active-goal empty-window case. `LifeGoalProgressApiIT` — `GET /progress` end to end
  (a `habit`-kind pillar backed by `ActivitySignalSource`, stored rows winning over computed ones,
  the `from > to` 400, an active weight-goal `linked` pillar, conflict detection across two active
  goals). `LifeGoalEvaluateApiIT` — `POST /evaluate`'s idempotent 3-day upsert (a second call
  produces the same rows, not duplicates). `LifeGoalTodayApiIT` — `GET /today`'s per-goal arrow/
  dots/tally shape. (No dedicated test asserts `source.type=habit` matching zero adapters —
  that behavior falls out of `windowFor`'s `findFirst()` returning `Optional.empty()` →
  `SignalWindow.of(Map.of())`, itself covered generically by `LifeGoalScorerTest`'s no-value
  no-data assertions for each kind.)
- **`mezo-iizd.6` (nightly job + XP):** `ProgressionLifeGoalIT` — `applyLifeGoal`'s idempotent
  award on the D-1 `sourceRefId`, the `LIFE_GOAL` `source_type`, and skill-kind derivation.
  `LifeGoalXpIT` — `LifeGoalXpService.awardIfHit` end to end: XP granted only on `hit`,
  nothing on `no_data` or a stored `miss` day, a `robustness`-keyed pillar's `hit` day granting
  nothing (the shared progression tail recomputes that row to an absolute streak target), and
  `refIdFor` idempotency across a repeated call. `LifeGoalEvalJobIT` — the nightly job run twice
  leaves the same rows and the same XP (the Habitica double-cron lesson), a non-`active` goal is
  skipped, and per-goal error isolation (an unknown activity `measure` on one user's pillar does
  not cost a healthy user's goal its evaluation or XP). `LifeGoalEvalJobSwitchOffIT` — the cron
  switch is a bean boundary: `mezo.techcore.cron.life-goal-eval-job.enabled=false` ⇒ the
  `LifeGoalEvalJob` bean does not exist, while `LifeGoalProgressService` (the manual `evaluate`
  path) stays fully wired.
- **`mezo-iizd.7` (ha–akkor triggers + `LIFE_GOAL_PLAN` + `/signals` liveness):**
  `service/LifeGoalTriggerRulesTest` — pure unit tests, no Spring context, full coverage of the
  three-source → predicate table (the `condition` threshold: the 4-es default for a MISSING
  condition vs. the no-fire for an unparseable one, the `ritual_missed` null-or-zero absence check,
  and `planKey`'s position-independence — the same plan keeps its key when the list is reordered,
  two different plans get different keys). `LifeGoalTriggerIT` — the
  wiring end to end through the real writes (no mocks, the `FlagEvaluationListenerIT` pattern):
  the immediate branch via `CheckInService.save`/`SportService.logSportSession`
  (Awaitility-waited, since the listener is `@Async`) and the delayed branch via
  `LifeGoalEvalJob` — a delayed plan firing once for the closed day and staying silent on a
  second run, a session dated 3 days back but logged NOW still earning its nudge (the rolling
  window) and staying silent on the second run, the `ritual_missed` plan firing for a missed day
  when the user HAS adopted the ritual and staying silent when they never did, a parked goal
  staying silent, both immediate sources (`checkin_energy_lte`, `sport_session_logged`) firing on
  their own event, and the negatives: an energy ABOVE the threshold, a `delayHours > 0` plan on the
  immediate branch, and cross-user isolation (all three via Awaitility `during(...)` settle windows,
  since the listener is `@Async`). The "signal is ASLEEP" skip has no no-mock seam in that suite and
  is documented as such in its javadoc; the companion-off case is covered on the liveness side. `LifeGoalSignalsLivenessIT` —
  `GET /signals`'s `daysWithData`/`live`/`fedPillars` against real rows, including the
  companion-off/no-`MetricSignalSource` asleep case. Focused run:
  `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true
  -Dtest='LifeGoal*,AppNotification*,*Arch*Test'`.

**Frontend**: `CelokPage.test.tsx`, `CelPage.test.tsx`, `CelWizardPage.test.tsx` (page-level,
both test modes — each also covers its real-mode loading/error state, and now also the live
arrow/dot/weekly-% rendering from `useLifeGoalProgress`/`useLifeGoalToday`), `logic/pillarFromCatalog.test.ts`
(every catalog entry yields an allowed kind + a populated rule), `data/lifegoal/lifegoalHooks.test.tsx`
(hook-level: mock-cache patching, the real-mode create cache-seed, `isError`/`refetch`, plus this
slice's `useLifeGoalProgress`/`useLifeGoalToday` real/mock parity). **Plus, `mezo-iizd.7`:**
`JelekPage.test.tsx` (page-level, both modes — hero live/total count, Él/Alszik split, per-row
`daysWithData`/`fedPillars` rendering, loading/error states) and `CelokPage.test.tsx`'s addition
of the "Jelek · mit figyel a rendszer" row navigating to `/me/goals/signals`. All life-goal
endpoints — five writes plus `progress`/`evaluate`/`today`/`signals` — have MSW handlers
resolving the goal by id (`test/msw/handlers.ts`) — `setup.ts` runs MSW with
`onUnhandledRequest: 'bypass'`, so a missing handler would let a real-mode write escape to the
network and pass silently. Run both `pnpm test` (real, MSW-backed) and `VITE_USE_MOCK=true pnpm
test` (mock) — see [`_platform-data-layer.md`](_platform-data-layer.md) §8 for the dual-mode test
convention. **CSS guards.** `shared/ui/mozaik/prototypeCssStructure.test.ts` covers the `lg-*` rules'
placement. `mozaikCssTokens.test.ts` does **not** cover them — it pins `--mz-*` only, and this
doc previously claimed otherwise; that false claim is precisely how two bugs shipped
(`mezo-hhdo`: the family hardcoded light hexes and read white-on-white in dark mode;
`mezo-7eq0`: the entrance choreography was armed on a `.play` class that does not exist, so the
7-dot rows AND the PERMAH ring arcs were invisible in a real browser). The family now has its
own guard, `features/me/lifegoalCssTokens.test.ts`, pinning four invariants: every `--lg-*`
token is declared in BOTH `:root` blocks, the block contains no raw hex, no `.play` selector
survives anywhere, and the choreography's HIDDEN start state is scoped under `.mz-play` rather
than applied unconditionally. **The visual suite cannot substitute for that last one**: it runs
with `reducedMotion: 'reduce'`, which settles the choreography, so a broken entrance renders
correctly in every golden while being invisible in the app (§9).

## 9. Decisions, gotchas & deferred

- **D1–D10** (spec §1) are the ten binding decisions behind every shape in this doc: D1
  (measurable/visible goals, overriding the old PRD's PERMA-widget prohibition — ADR 0034,
  below), D2 (PERMAH + skill hybrid), D3 (existing signals only, no new logging, no GitHub/
  external import), D4 (AI proposes from a closed catalog, user approves), D5 (`/me/goals` +
  `/me/goals/weight` split, slice 1), **D6 (stored daily rows + on-read computation — fully
  implemented as of `mezo-iizd.6`: the storage half via `evaluate`'s idempotent 3-day upsert
  (`mezo-iizd.5`), and the nightly *job* that also calls it (`LifeGoalEvalJob`, `mezo-iizd.6`))**,
  **D7 (no cap on active goals — implemented as written; the
  earlier 3-goal 409 gate was dropped before slice 1)**, D8 (the five-step wizard, implemented
  as written), **D9 (if–then plans as trigger rules — fully implemented as of `mezo-iizd.7`: the
  plan *shape* shipped in slice 1, the *evaluation* (`LifeGoalTriggerRules`/`LifeGoalTriggerService`
  + `LIFE_GOAL_PLAN` notifications) ships this slice)**, **D10 (the five-kind pillar taxonomy —
  every kind now has a working `LifeGoalScorer` branch)**.
- **`docs/superpowers/specs/2026-09-03-lifegoal-slice2-motor-design.md`** carries this slice's
  own binding decisions (D-1..D-4 in that doc's numbering) on top of D1–D10: the scorer's
  per-kind rules, the arrow/gate thresholds, the read-computes/evaluate-writes split, and the
  deliberate absence of a `habit`-type `SignalSource` adapter.
- **The contract cap intercepts the service cap** — see §4's gotcha box; raise
  `maxItems: 5` and `LifeGoalProperties.maxPillars`/`@Max(5)` together or the property change is
  a no-op over HTTP.
- **The fake-LLM sentinel lives in `whyText`, not `title`.** `title` is capped at 120 chars by
  the contract — too tight for a scripted JSON payload — while `whyText`'s 600-char cap has
  room. `FakeCompanionLlm.LIFEGOAL_PROPOSE_SENTINEL` matches `[fake-lifegoal-propose:{…}]`
  inside the adapter's `whyText`-carrying context, not the title.
- **`AbstractIntegrationTest` does not activate the `demodata` owner profile** — only
  `ApiIntegrationTest` does. A seed-data IT (`LifeGoalSeedDataIT`) that extends
  `AbstractIntegrationTest` directly must add `@ActiveProfiles({"demodata",
  "demofixtures"})` itself, or the owner the seed keys off of never exists.
- **Two frontend CSS guard tests constrain `styles/prototype.css`** and this slice's `lg-*`
  rules live inside the region they police: `mozaikCssTokens.test.ts` forbids raw light-surface
  hex codes inside the Mozaik region (tokens only) and `prototypeCssStructure.test.ts`/the
  Mozaik-section scan assumes the **Today** section is the last one in the file — new rules for
  this feature must land before it, not after.
- **Mock/real parity, `closedAt`:** the mock `changeStatus` arm
  (`frontend/src/data/lifegoal/lifegoalHooks.ts`) now stamps `closedAt` on `done`/`archived`
  alongside `activatedAt` on activation, matching the backend — the earlier divergence (and the
  "no UI may read `closedAt`" embargo it forced) is resolved. Note `done → archived` still
  OVERWRITES `closedAt` on both sides; the completed-goals surface (`mezo-iizd.4`'s "Lezárt
  célok" section, §2.1) therefore shows only the status and dimension — it must not present it
  as the completion date without fixing that first.
- **ADR:** [`0034-measurable-life-goals.md`](../decisions/0034-measurable-life-goals.md) —
  records that this feature overrides the old PRD's IDENT-5 / anti-pattern D38 prohibition
  ("PERMA is never a widget", identity-goal progress is "never a UI progress bar") with D1's
  rationale (Harkin et al. 2016 on recorded, visible progress monitoring; the SDT framing
  nudge), and fixes the guardrails that survive the override (no loss mechanics, a declining
  trend is never red, `no_data` is never a miss, minimum-data gates before any trend, XP as
  feedback and never a penalty).
- **Shipped `mezo-iizd.5`** (spec §5 + slice2-motor-design D-1..D-4): `LifeGoalScorer`
  (daily hit/partial/miss/no_data per kind + weighted goal score + 7-vs-21-day arrow with a
  5-data-day gate), the `SignalSource` port with 5 adapters (metric, social_mentions, activity,
  needs_ring, weight_goal — **deliberately no `habit`-type adapter**, see §3), `GET /{id}/progress`,
  `POST /{id}/evaluate` (the last-3-closed-days idempotent upsert), `GET /today`, and
  goal-conflict detection. The `HabitSignalSource` the base spec originally named was retired in
  favor of the existing `HABITS_DONE` metric (see §3).
- **Shipped this slice** (`mezo-iizd.6`, spec §.6): `LifeGoalEvalJob` — the nightly scheduler
  (`@Scheduled(cron = "${mezo.lifegoal.eval-cron}")`, default `0 20 0 * * *`) that now calls
  `evaluateDays` automatically for every user's `active` goals, dual-gated
  (`LIFEGOAL_SWITCH` + `LIFE_GOAL_EVAL_JOB_SWITCH`) and per-user/per-goal error isolated — and the
  pillar-hit XP award (`LifeGoalXpService` → `ProgressionService.applyLifeGoal`,
  `source_type=LIFE_GOAL`, the D-1 deterministic idempotency key). **D6 is now fully implemented:
  stored rows AND the nightly job that populates them.** **Gotcha:** a `robustness`-keyed pillar's
  `hit` grants no XP — the shared progression tail overwrites that skill's row with an absolute
  streak target on every award, so a delta award there would be a ledger entry that changes
  nothing (see §5).
- **Shipped `mezo-iizd.7`** (spec §.7 + D-3/D-4): ha–akkor trigger evaluation
  (`LifeGoalTriggerRules` + `LifeGoalTriggerService`, immediate branch via
  `LifeGoalTriggerListener` on `CheckInSavedEvent` + the new `SportSessionLoggedEvent`, delayed
  branch via `LifeGoalEvalJob`) and `AppNotificationKind.LIFE_GOAL_PLAN`; `GET /signals` per-source
  liveness (`daysWithData`/`live`/`fedPillars`, `LifeGoalSignalService`); FE `JelekPage` +
  the hub's Jelek row. **D9 is now fully implemented.**
  **Gotcha — `dedupKey` is per-DAY and CONTENT-keyed, not per-transition-condition:** `dedupKey =
  <goalId>:<planKey>:<day>` means a plan speaks at most once for a given day even if its signal
  keeps satisfying the predicate on every re-evaluation within that day (e.g. a second
  `checkin_energy_lte` check-in the same day, or the job re-running the delayed pass) — this is
  the intended "one plan, one voice, per day" contract (spec D-3), not a missed-notification bug.
  The `planKey` is a content hash rather than the plan's list index because `IfThenPlanJson` has no
  identity and `LifeGoalService` replaces the WHOLE `ifThenPlans` list on every PUT — an index would
  shift on any delete/insert and either silence a different plan for the rest of the day or let one
  speak twice. Accepted trade-off: a RE-WORDED plan hashes differently and may speak again that day
  — we treat it as a new plan, deliberately. Migration-free, no contract change.
  **Gotcha — `LIFE_GOAL_PLAN` has no push category yet:** `familyKey = null` means it is feed-only
  by design in this first round (D-3); a push category is explicitly out of scope for `mezo-iizd.7`
  (deferred to `.8`, see below) — do not read the `null` as an oversight.
- **Deferred to `.8`** (the immediate follow-up bucket, NOT slice 3): the `partial` non-award
  test gap, a `LIFE_GOAL_PLAN` push category, and batching `/signals`'s 28 per-source queries if
  that ever measurably matters.
- **Slice 3's embedding SHIPPED** (`mezo-iizd.9`/`.4`/`.12`, spec §6–§7): the Nap "Célok · ma"
  tile, the `CelPage` conflict sentence, the Heti `WeekGoalsCard`, the weekly-review `ÉLETCÉLOK`
  prompt block, the Célok hub's closed-goals section + Súlycél row, the Én-hub life-goal hero and
  the Growth skill-row chip — see §2/§5. Two honesty gotchas the embedding forced, both pinned by
  tests: the **`WeekGoalsCard` renders on the RUNNING week only** (`useLifeGoalToday`'s window is
  the 7 days trailing NOW, so on a browsed-back week it would label this week's arrows as that
  week's direction — the same gate `WeekNextCard` uses), and **a no-data week is never a zero**
  (`goalWeekSentence.ts` and the backend's `ÉLETCÉLOK` block both say "nincs adata" instead of
  tallying `0 találat-nap`, on both sides of the wire).
- **Still deferred** (spec §5–§7): the companion `[Célok]` **chat** prompt block +
  `get_life_goals` chat tool, and the knowledge-graph `GOAL` node (blocked on `mezo-06o0.5`).

## 10. Key files

**Backend** — `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/` (entity, repository,
service, controller, mapper, catalog, config); `feature/companion/LifeGoalProposePort.java` +
`feature/companion/llm/LifeGoalProposeLlmAdapter.java` (the AI port + adapter);
`feature/lifegoal/LifeGoalSeedData.java` (`demofixtures` seed, `@Order(125)`, after
`GoalSeedData`). **This slice's engine + assembly (mezo-iizd.5):**
`feature/lifegoal/engine/{LifeGoalScorer, SignalSource, PillarDayScore, SignalWindow,
MetricSignalSource, SocialMentionsSignalSource, ActivitySignalSource, NeedsRingSignalSource,
WeightGoalSignalSource}.java`; `feature/lifegoal/service/LifeGoalProgressService.java`
(`progress`/`evaluate`/`today` + conflict detection). **This slice's job + XP (mezo-iizd.6):**
`feature/lifegoal/service/LifeGoalEvalJob.java` (the nightly cron bean); `feature/lifegoal/
service/LifeGoalXpService.java` (the D-1-keyed, hit-only XP seam); `feature/progression/
lifegoal/LifeGoalSignal.java` (the `applyLifeGoal` signal record). **This slice's triggers +
liveness (mezo-iizd.7):** `feature/lifegoal/service/{LifeGoalTriggerRules, LifeGoalTriggerService,
LifeGoalTriggerListener, LifeGoalSignalService}.java`; `feature/train/service/
SportSessionLoggedEvent.java` (the new event, published by `SportService.logSportSession`);
`feature/appnotification/domain/AppNotificationKind.java` (`LIFE_GOAL_PLAN`).

**Tests** — `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/{LifeGoalEntityIT,
LifeGoalApiIT, LifeGoalPillarApiIT, LifeGoalProposeIT, LifeGoalSeedDataIT,
LifeGoalProgressApiIT, LifeGoalEvaluateApiIT, LifeGoalTodayApiIT, LifeGoalEvalJobIT,
LifeGoalEvalJobSwitchOffIT, LifeGoalTriggerIT, LifeGoalSignalsLivenessIT}.java`;
`.../lifegoal/service/LifeGoalTriggerRulesTest.java`;
`.../lifegoal/engine/{LifeGoalScorerTest, SignalSourceIT, WeightGoalSignalSourceIT}.java`;
`.../progression/ProgressionLifeGoalIT.java`; `.../lifegoal/LifeGoalXpIT.java`.

**FE — slice 3's embedding (`mezo-iizd.9`/`.4`/`.12`)** —
`frontend/src/features/today/components/LifeGoalTodayTile.tsx` (the Nap tile);
`frontend/src/features/me/components/WeekGoalsCard.tsx` +
`frontend/src/features/me/logic/goalWeekSentence.ts` (the Heti card + its counted sentence);
`frontend/src/features/me/logic/goalSkillChips.ts` (the Growth skill-row chip, consumed by
`components/SkillBandCard.tsx` + `pages/GrowthSkillsPage.tsx`);
`frontend/src/features/me/pages/{CelokPage, CelPage, EnHubPage, WeekHubPage}.tsx`;
`frontend/src/styles/prototype.css` (the `lg-gtile` / `lg-wcard` / `lg-goalchip` / `lg-donerow` /
`enh-lgcard` rules). **Backend, same slice** —
`backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewContextSources.java`
(`appendLifeGoals` + `NO_DATA_PHRASE`), pinned by
`backend/src/test/java/io/mrkuhne/mezo/feature/proactive/WeeklyReviewContextSourcesIT.java`.

**Contract** — `api/feature/lifegoal/lifegoal.yml`.

**Frontend data** — `frontend/src/data/lifegoal/{lifegoalApi.ts, lifegoalHooks.ts,
lifegoalMock.ts}`, re-exported from `frontend/src/data/hooks.ts`
(`useLifeGoalProgress`/`useLifeGoalToday`, this slice).

**Frontend UI** — `frontend/src/features/me/pages/{CelokPage,CelPage,CelWizardPage,JelekPage}.tsx`;
`frontend/src/features/me/components/{PermahRing,LifeGoalTile,PillarCard}.tsx`;
`frontend/src/features/me/sheets/PillarCatalogSheet.tsx`;
`frontend/src/features/me/logic/lifegoalLabels.ts` (dimension/status/kind label + icon tables).

**Docs** — this file; spec
[`docs/superpowers/specs/2026-09-02-lifegoal-system-design.md`](../superpowers/specs/2026-09-02-lifegoal-system-design.md)
(slice 1, D1–D10) and
[`docs/superpowers/specs/2026-09-03-lifegoal-slice2-motor-design.md`](../superpowers/specs/2026-09-03-lifegoal-slice2-motor-design.md)
(this slice's scorer-core design, D-1..D-4); plan
[`docs/superpowers/plans/2026-09-02-lifegoal-slice-1-alapok.md`](../superpowers/plans/2026-09-02-lifegoal-slice-1-alapok.md);
prototype [`docs/design_2.0/prototypes/celok.html`](../design_2.0/prototypes/celok.html);
[`goal-engine.md`](goal-engine.md) and [`me.md`](me.md) for the weight-goal sibling and the
route map.

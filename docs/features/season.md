---
title: Évad — the season (Boop B6)
type: feature-domain
status: in-progress
updated: 2026-11-21
tags: [backend, boop, season, goal, train, sleep, fuel, companion, b6-evad]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/season
  - api/feature/season/season.yml
  - backend/src/main/resources/db/changelog/1.1.0/script/202611211000_mezo-r36n9.16_season.sql
  - backend/src/main/java/io/mrkuhne/mezo/feature/train/port/SeasonGatePort.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalPrescriptionCalculator.java
  - backend/src/test/java/io/mrkuhne/mezo/feature/season
  - ios/BoopKit/Sources/BoopCore/Evad
related: [boop-ios, goal-engine, train, fuel, companion, _platform-api-backend]
---

# Évad — the season (Boop B6) — Feature Documentation

> **2026-11-21 — reviewed after the Évad S2 review round (`mezo-r36n9.16`).** A reasoned skip excuses only the session (food and night still count), today's night is never judged, the season title is made inert before it reaches a prompt, the learned-expenditure wall card is keyed on the ISO week, and the Hét tab no longer waits on the day judgement — all described below.

> Boop's **Évad** place (the spine's second place, was Terv) and its backend feature `season`. **S2 of 4 shipped
> (2026-11-21, `mezo-r36n9.16`)**. S1 (2026-11-20): the season aggregate, the no-persist live preview with a
> fingerprinted accept, the lifecycle, the mesocycle gate, the overview read model and the iPhone page (Évad tab,
> Módosítás, Szabályok, Új évad, empty state). S2 (2026-11-21): **adherence as the single server source**
> (`getAdherence`, read by the Évad tab *and* the Étel Hét tab), gated **insights**, the `sleep_food` link number, the
> season's rules as **`[Évad]` lines in every AI context** (chat snapshot, morning brief, meal coach) + the
> **`get_season`** tool, and the **`evad` wall source** on Ma. 🟣 S3 weekly menu + shopping list · 🟣 S4 experiments.
> Backend ✅ (S1–S2) · iOS ✅ (S1–S2) · web: none (retired, #52).

## 1. Summary

A **season** is one N-week plan (4–24 weeks) with a goal. It **owns** its body-weight goal (1:1, created and edited
through the existing goal engine), the weekly gym days + sport slots (it writes `gym_schedule_slot` /
`sport_schedule_slot` on accept — they stay the single source `WeeklyScheduledActivityService` reads), the sleep need
(written to `sleep_goal.target_minutes`) and its training block (attached through the existing `goal_plan_link`). From
those it **derives** the training-day / rest-day kcal, protein, carbs, the week's total intake, the sleep need and
bedtime, and the weight course — every number is the goal engine's (or the sleep rule's), never a parallel calc.

Changing any part shows, live, what it does to every other part (**Ennyi változna**, before | after) and what he has
to do (**Ehhez ezt kell tenned**); nothing is written until he taps *Elfogadom*, and an accept is refused when anything
the preview depended on moved since (the fingerprint). **No training block starts without a season** (the gate).

Driving docs: spec [`2026-11-20-boop-evad-design.md`](../superpowers/specs/2026-11-20-boop-evad-design.md) §5 (owner-
approved with the spike and the plan, 2026-11-20), plan [`2026-11-20-boop-evad.md`](../superpowers/plans/2026-11-20-boop-evad.md)
(S1 = Tasks 1–11, S2 = Tasks 12–16). Decisions #61–#64 (`docs/boop-handbook/_dontesek.json`).

## 2. User-facing behavior

The phone side lives in [`boop-ios.md`](boop-ios.md) §2 *Évad*; in short:

- **Évad tab** — head (orb filled to *week / N*, eyebrow „Őszi fogyás · 12 hétből a 7.", a serif verdict chosen from
  the overview's `head.status`), **Mi mire hat** (the four pillars Edzés · Étel · Alvás · Súly with the computed
  links; a tap lights one), **Súly** (trend + target line, or a ±1 kg band for a maintain season), **Az évad terve**
  (block + sport days, training/rest-day kcal + protein, sleep need + bedtime, target + date), **Következik** (deload
  weeks of the block, the season end), actions *Módosítás* · *Új évad*.
- **Hogy megy** (S2) — the last seven days ending yesterday as plain counts, never a score: „4 / 5 napon belefértél a
  keretbe", „3 / 4 edzés megvolt", „4 / 7 éjjel aludtál eleget" (for example). A fact with nothing to count is left out
  (never „0 / 0"); a line under them says how many kímélő days were left out („1 kímélő nap nem számít bele. Ez nem
  pontszám, csak összesítés."). The block is absent when the overview's `adherence` is null.
- **Amit Boop észrevett** (S2) — at most three insights, each only past its data gate (§3.8).
- **Mi mire hat → Alvás → Étel** (S2) — the `sleep_food` link now carries the server's number („rövid éjszaka után
  +280 kcal", for example); without a computed effect the link says it has no number.
- **Ma wall** (S2) — the `evad` source adds at most two cards (§3.10).
- **Menü · Lista · Hatás** tabs show the "not live yet" card until S3 / S4.
- **Módosítás** — sessions per week, sport days, weekly pace → *Ennyi változna* (Most | Utána: Edzésnapon,
  Pihenőnapon or „nincs pihenőnap", Szénhidrát edzésnapon, **Heti összesen**, Alvásigény, Lefekvés, Célba érsz / A
  tempó or A sáv), red guard lines, *Ehhez ezt kell tenned*, *Elfogadom* / *Mégsem*. **While the season's block runs
  the gym days are locked** (the *Edzések hetente* stepper is disabled, a line says why); sport days, pace and gym time stay editable.
- **Szabályok** — the season's switches (NOVA rule, Sunday menu, deload-maintain, learned expenditure, experiments) and
  the read-only facts (allowed recipes, block, sleep need „az edzésből számolva", weight goal).
- **Új évad** — five steps prefilled from the first-season draft, *Indulhat az évad* (create + activate) / *Később*.
- **No season yet** — the empty state („Indítsunk egy évadot", *Megnézem* → Új évad).

## 3. Architecture & data flow

```
EvadPage → EvadStore (ServerCache "evad/overview") → EvadClient (RawJSONClient)
  → SeasonController (SeasonApi) → SeasonApiService (DTO ↔ record mapping, SeasonMapper)
      ├─ SeasonOverviewService      GET  /api/seasons/active/overview   (read-only)
      ├─ SeasonPreviewService       POST …/preview, …/draft/preview      (read-only, persists nothing)
      ├─ SeasonService              create / activate / apply / close / putRules  (the only writers)
      ├─ FirstSeasonAssembler       GET  /api/seasons/draft              (read-only)
      └─ AdherenceService (S2)      GET  /api/seasons/adherence?from&to  (read-only, with or without a season)
  overview (S2) also reads: AdherenceService.lastWeek, SeasonInsights.compute (insights + sleep_food number)
  ports (season-owned, adapters in feature/season/service):
      SeasonGoalPort    → SeasonGoalAdapter    → GoalService, GoalPrescriptionCalculator (draft overload),
                                                 DayTargetProjector, GoalFeasibilityService, GoalPlanLinkService
      SeasonTrainPort   → SeasonTrainAdapter   → gym/sport schedule services, WeeklyScheduledActivityService
                                                 (draft EAT), MesoTemplateService (start a block)
      SeasonSleepPort   → SeasonSleepAdapter   → sleep_goal repository
      SeasonMetricsPort → SeasonMetricsAdapter → weight trend, weigh-ins, sleep_log (+ S2 nightly minutes), recipe count
      SeasonMealPort    → SeasonMealAdapter    → FuelDayService.getWeek (S2: the very rollup the Étel Hét tab renders)
      SeasonTrainPort  (S2 additions)          → planned / done / excused session days (slots, run windows, sessions,
                                                 PlannedSkipService)
      SeasonGoalPort   (S2 addition)           → learnedExpenditure (the goal's tdee_bootstrap, learned base only)
  train → season:  SeasonGatePort (train-owned) ← SeasonGateAdapter
  companion / boop / meal → season (S2): each feature's own SeasonContextPort ← SeasonContextAdapter
                                          → SeasonContextRenderer (render = rules, overview = standing)
```

**Why the adapters live in `season`, not in the owning features.** The season sits *above* goal / train / biometrics
in the feature graph and also implements train's `SeasonGatePort`; a goal- or train-side adapter would close a
goal → season → goal (or train → season → train) cycle. Keeping all the adapters season-side adds no new feature
cycle (ArchUnit store unchanged apart from the season's own edges). S2's `SeasonContextAdapter` follows the same rule:
it implements the three consumer-owned `SeasonContextPort` interfaces (companion, boop, meal), so none of those
features depends on `season`.

### 3.1 The live preview (spec §5.3)

`SeasonPreviewService.compute(owner, season, draft)` builds the goal fields the draft would write
(`SeasonDraftMath.goalFields`: start weight = the season goal's, else his latest weigh-in, else the live goal's; guards
= the live goal's, else strength + muscle; window per trajectory / pace / weeks) and asks
`SeasonGoalPort.previewTargets` for the day targets **on a detached, never-saved goal** with a `DraftEnergy` that
prices the draft's gym + sport slots (`WeeklyScheduledActivityService.draftWeeklyEatKcalPerDay` /
`draftSlotKcal`). Inside the goal engine the draft EAT replaces the scheduled (gym + sport) part of the weekly EAT in
the bootstrap and in every projected segment; the running block's EAT is still added — see
[`goal-engine.md`](goal-engine.md) §3 *Draft calculation*.

- `SeasonNumbers` = `trainDayKcal`, `restDayKcal` (null when gym ∪ sport cover all seven weekdays), `proteinG`,
  `carbsTrainG`, **`weekKcal`** (trainDayKcal × active days + restDayKcal × rest days; active = distinct weekdays with
  gym or sport), `sleepNeedMin`, `bedtime`, cut/bulk only: `targetDate`, `weeksToTarget`, `paceVerdict`,
  `kgPerWeek`; maintain only: `bandLowKg` / `bandHighKg` (start ± 1 kg); `gymPerWeek`, `sportPerWeek`.
- **Each day's own target is base + that day's movement + the goal balance** (the served-target model of mezo-tb3s2,
  `DayTargetProjector`). So adding a 5th session turns a rest day into a training day — it raises **the week total**,
  the sleep need and moves the bedtime, but it does **not** raise the training-day kcal. The preview shows exactly
  what the day will serve; `weekKcal` is what makes the change visible as food.
- `todo[]` — `SeasonTodoRules` (pure, fixed order: food ≥ ±40 kcal on a training day, earlier bedtime, block re-plan
  when the gym-day count changes, season length, sport days, mid-week menu re-fit — the last always off before S3).
- `warnings[]` — strength guard, cut pace (`aggressive` or over the rate cap), muscles under their weekly volume floor
  (Hungarian muscle names).
- `previewDraft` (no season yet, the Új évad summary): *before* = the live goal + current slots + sleep goal, no
  fingerprint.
- A missing profile / weigh-in → 409 `SEASON_PROFILE_REQUIRED`.
- **Past the goal's target** (a faster pace can make the goal shorter than the season), `SeasonGoalAdapter.segmentFor`
  holds the last segment with the goal balance set to 0 — the day targets become maintenance; before the first segment
  the first one is used. The overview's projection likewise stops at the target and stays flat. The revision's
  *before* on activation is the live state's numbers, or null when the live goal cannot be projected.

### 3.2 The fingerprint

`SeasonFingerprint.of` — SHA-256 over the season's status + window + stored sleep need + accepted draft, its goal (id,
status, fields, accepted balance adjustment, segment overrides),
the weekly slots, the latest trend point + trend length + latest weigh-in + weigh-in day count, the sleep goal and the
running/linked block. `PUT /api/seasons/{id}` with a fingerprint that no longer matches → **409
`SEASON_PREVIEW_STALE`**; the phone re-previews and says „Közben változott valami, újraszámoltam." A weigh-in, an
accepted adaptive correction or a concurrent accept between preview and accept therefore never applies stale numbers.

### 3.3 Lifecycle (spec §5.2)

- **create** (`POST /api/seasons`) — a `planned` season and its planned goal; planned seasons may coexist with the
  active one. Recipes allowed by the draft go to `season_allowed_recipe`.
- **activate** (`POST …/{id}/activate`) — one transaction: the season row goes active first (so the gate sees it), the
  previous active season closes (flushed first for the one-active index), `sleep_base_min` is stored, its goal is
  activated, the slots are replaced, the sleep need (+ anchor) written, the block attached (`adopt` the running one /
  `rerun` / `template` → started through the gate and linked via `goal_plan_link`), and a `season_revision` row.
- **apply** (`PUT …/{id}`) — fingerprint check, then goal update + slots + sleep need + block in one transaction, plus a
  revision. **While a training block is running (active season + an active mesocycle) the gym days are locked:** a
  draft whose `gymDays` (as a set) differ from the current ones → **409 `SEASON_BLOCK_DAYS_LOCKED`** (previews stay
  allowed; the phone disables the control) (the block's weekdays would no longer match). Sport
  days, pace and gym time stay editable. The full "one accept moves the block too" (spec §5.12-1) waits for the
  in-block day editor — follow-up `mezo-r36n9.122` (depends on `mezo-r36n9.116`).
- **close** (`POST …/{id}/close`) — status `closed` + a small `closed_summary`; goal and slots stay. **The sleep goal
  gets its base back** (`sleep_base_min`) unless he changed it himself since the season wrote it.
- **putRules** (`PUT …/{id}/rules`) — the switches; no kcal effect, so no preview.
- A closed season is not editable → 409 `SEASON_NOT_EDITABLE`. A second active season cannot exist: activation closes
  the previous one, and the partial unique index `uq_season_one_active` is the backstop. `SEASON_ACTIVE_EXISTS` is in
  the bundles (and the phone maps it) but no server path throws it today.

**First season (no prod write without his tap).** `FirstSeasonAssembler` drafts „Első évad" from the **live**
(`is_deleted = false`) active goal, the running block (adopted only on *Indulhat az évad*), the weekly slots and the
sleep anchor; it starts today and is long enough to cover the block's end (else the live goal's end, else 12 weeks),
clamped to 4–24.

### 3.4 Sleep need

Rule `SleepNeedRule` (pure):

```
base     = his sleep goal minutes when set, else 450 (7 h 30)
need     = min(base + 6 × weekly gym sessions + 6 × weekly sport sessions, 510)   (cap 8 h 30)
bedtime  = WAKE anchor: wake − need − 15 min (falling asleep), wrapping midnight;  BED anchor: the anchor itself
```

`season.sleep_base_min` keeps the base the season started from, so re-accepting never stacks the increment on an
already-raised sleep goal; closing writes the base back (§3.3).

**Research note.** The general adult recommendation is 7–9 hours a night; sports-science guidance places athletes
toward the top of that range (around 8 hours or more), with a heavier training load raising the need for recovery
sleep. The constants above (+6 min per weekly session, 8 h 30 cap, 15 min to fall asleep) are **Boop's starting
rule**, chosen so the need moves visibly with load yet stays reachable — not a measured value and not taken from a
study; the phone labels it „az edzésből számolva" (Boop's rule). Revisit once S2 adherence shows real nights against it.

While a season is active **the season owns `sleep_goal.target_minutes`** (written on accept); he owns the anchor
(wake or bed time). The goal engine's `sleepTargetH` follows automatically because it reads the same row
([`goal-engine.md`](goal-engine.md) §5).

### 3.5 The mesocycle gate (spec §5.12-5)

Train asks `SeasonGatePort.allowsMesocycleStart(owner, start)` on the two real start paths — `TrainService.stampRun`
(template start `POST /api/train/meso-templates/{id}/start` and re-run `POST /api/train/mesocycles/{id}/rerun`) and a
real activation `POST /api/train/mesocycles/{id}/activate` of a non-active block. It passes when a season is active,
or a planned one starts within `planned-lead-days` (7) of the block's start and has not ended. Otherwise **409
`SEASON_REQUIRED`** (the phone's Blokk builder says „Edzésblokk csak évadhoz indulhat. Az Évad oldalon indíthatsz
egyet."). **Running blocks are untouched** — the idempotent re-activate of an active block is not gated, and the block
that was running before seasons existed keeps running. Single workouts and sport sessions are not gated.

Config: `mezo.season.mesocycle-gate.enabled` (**true** in `application.yml`, **false** in the test profile so the many
block-starting ITs need no season; `MesocycleGateIT` turns it back on), `mezo.season.mesocycle-gate.planned-lead-days: 7`.

### 3.6 The overview read model (spec §5.4)

`SeasonOverviewService.overview` (404 without an active season → the phone's empty state) composes: `season`
(the response incl. the current draft), `head` (title, week / weeks, trajectory, status), `map` (four pillar headline
values + six links: `train_food` = trainDayKcal − restDayKcal or null without a rest day, `train_sleep` = need − base,
`food_weight` = kgPerWeek; `sleep_food` / `food_train` / `sleep_train` are null until their data gate exists — never
an invented number), `weight` (trend series since the season start, a weekly projection to the season end that stops
at the target and stays flat, trend / target / band / pace), `pillars` (block, food incl. allowed / total recipes and
the NOVA max, sleep incl. 7-day average, weight), `adherence` (S2: `AdherenceService.lastWeek` — the seven days
ending yesterday; **null only when nothing at all could be judged** and no kímélő day was left out), `insights` (S2:
`SeasonInsights`, §3.8), `upcoming` (deload weeks from the block's phase curve, the season end). Since S2 the
`sleep_food` link carries the short-night intake difference when its gate passes (else still null).

Head status: `no_data` with fewer than 4 weigh-in days in the last 21 (or no trend); maintain → `in_band` /
`out_of_band` by the latest trend point; cut/bulk compare the engine's 14-day trend rate with the planned rate —
< 50 % (or the wrong way) `slower`, > 150 % `faster`, else `on_course`.

### 3.7 Adherence — the single source of day judgement (S2, spec §5.6)

`AdherenceService.range(owner, from, to)` (`GET /api/seasons/adherence`) judges every day, **with or without a
season** (without one the food budget is simply the goal's served target). The food side reads
`SeasonMealPort.foodDays` → `FuelDayService.getWeek` — the same rollup the Étel Hét tab renders, so target, consumed
kcal and the kímélő mark are the same numbers on both surfaces. Per day:

- **judged** (the food side counts) = `date < today` **and** no fuel recovery mode that day (any mode — GUIDANCE,
  ESTIMATE or MAINTENANCE — counts as kímélő) **and** consumed kcal > 0. This is exactly the Étel Hét tab's own rule,
  which the phone keeps as its offline fallback.
- **foodInBand** = judged and |kcal − target| ≤ **10 %** of the day's served target — symmetric. (The Hét tab's amber
  warning pill still fires only **over 110 %**; the band is the summary's notion, the pill is a different signal.)
- **sessionPlanned** = a weekly gym / sport slot on that weekday, or a `run` window of the running block that day
  (`WorkoutWindowQueryService`), or a reasoned skip that day — **one flag per day**. **sessionDone** = a completed
  workout instance, a sport session or a run log that date; null when nothing was planned, the session was skipped with
  a reason, the day is kímélő, or it is today or later.
- **sleepOk** = the night's minutes (`sleep_log`, the night ending that morning) ≥ **need − 15 min**; the need is the
  active season's `sleep_need_min`, else his sleep goal **only when set** — null when neither exists (never a default).
  A range ending today never judges today's night (the night is not over until the day is judged).
- **excused** = a **kímélő day only** (`excuse: kimelo`): it leaves **every** count of the summary (food, sessions and
  nights) and is counted in `excusedDays`. A reasoned gym / sport / run skip (`excuse: skip`, `excused: false`)
  excuses **only the session** (`sessionDone` null, out of `sessionsPlanned`); that day's food and night still count.

Summary = `foodInBand / foodJudged`, `sessionsDone / sessionsPlanned`, `nightsOk / nightsJudged`, `excusedDays`.
Range: inclusive, `to ≥ from`, **at most 62 days**, else 400 `VALIDATION_INVALID_VALUE` (field `to`).
`lastWeek(owner, today)` = the seven days ending yesterday, empty when nothing at all could be judged.

**Known limitations:** (1) planned sessions are read from **today's** weekly slots (and the running block's run
windows), not from what the schedule was on that day — a schedule change re-labels past days; (2) one flag per day —
gym and sport planned on the same day count as **one** planned session (and one done).

### 3.8 Insights — „Amit Boop észrevett" (S2, spec §5.6)

`SeasonInsights.compute` returns at most three, each present only past its data gate, never a placeholder:

1. **`learned_expenditure`** — when the season goal's engine serves a **learned** base (`tdee_bootstrap.learned`)
   and it is at least **50 kcal** away from the planned (formula) expenditure (both rounded to 10). Title „Kevesebbet
   / Többet égetsz, mint gondoltuk"; body „A terv napi X kcal-lal számolt, de a mérleged és az étkezéseid alapján
   inkább Y körül égetsz." The spike's follow-up sentence about re-fitting the budget on Monday is **dropped** — that
   weekly proposal is not built.
2. **`short_night_intake`** — nights under 7 h vs the rest, paired with that day's intake over the last **60 days**
   ending yesterday (judged days only, via `AdherenceService.days`); gate = `EffectLinkCalculator.compute` present
   with |Cliff's delta| ≥ `SMALL` and a non-zero mean difference rounded to 10 kcal. Title „Rossz alvás után
   többet / kevesebbet eszel"; body „Ha 7 óránál kevesebbet alszol, másnap átlagosan N kcal-lal többet eszel." +
   „Vagyis a jobb alvás is segít fogyni." only for a cut season with a positive difference. The same number is the
   map's `sleep_food` link value.
3. **`guard`** — „Erre figyelek": the season's current preview warnings (strength, cut pace, muscles under their
   floor), joined, in the preview's own Hungarian words.

Without an active season the list is empty.

### 3.9 The season in every AI context (S2, spec §5.10)

`SeasonContextRenderer` renders Hungarian lines prefixed **`[Évad] `**:

- **`render(owner, today)`** (the rules) — title + week („Őszi fogyás · 7. hét / 12"), goal + target + date + weekly
  pace (maintain: the band), the week's gym / sport days, training / rest-day kcal + protein, the allowed-recipe rule
  (only with allowed recipes), the NOVA rule (**omitted when the max is 4** — NOVA 4 allows everything), sleep need +
  bedtime. Every number is the engine's for the season as it stands.
- The season **title is whitespace-collapsed and bracket-stripped** before it goes into a prompt, so a typed title
  cannot forge another `[…]` block.
- **`overview(owner, today)`** (the standing) — week + trajectory, the head status in words, last week's adherence
  (food in band / judged days, sessions done / planned, nights ok / judged, kímélő days left out), one „Észrevétel:"
  line per insight.

**Never throws:** without an active season it returns `""`; with no body profile the engine cannot compute, so the
number lines are **left out** (never guessed) and the overview says only the week; any failure logs and renders `""`
— a context renderer must not break a chat turn. Consumers, each through its own `SeasonContextPort`:

| Consumer | Where | What |
|---|---|---|
| Chat snapshot | `ContextSnapshotAssembler` — **both** variants, right after the goal block | `render` |
| Morning brief | `BoopDayAssembler` → `BoopDay.seasonRules` → `BoopPrompts` (after *[Lefekvési cél]*) | `render` |
| Meal coach | `MealCoachContextReader.PersonContext.seasonRules` → `MealCoachPrompt` („AZ ÉVAD SZABÁLYAI …" block; absent without a season, never a „nincs adat" line) | `render` |
| `get_season` tool | companion `SeasonTools` — `scope=overview` (default) → `overview`, `scope=rules` → `render`; „Évad: nincs aktív évad" without one | both |

`get_season` scopes `menu` / `experiment` arrive with S3 / S4. **Cost:** while a season is active, every chat turn,
morning brief and meal-coach call runs one read-only season computation (the engine's preview for the season as it
stands); no LLM call is added, and without a season the cost is one indexed lookup.

### 3.10 The wall source (S2, spec §5.11)

The phone's `evadCandidates(overview, now:)` (`BoopCore/Evad/EvadWall.swift`, area `WallSources.evad`) turns the
overview the Évad store already holds into wall candidates — the wall engine chooses; nothing here is `.expires`, so
nothing rings (decision #35):

- **`.improves`** — the `learned_expenditure` insight as a proposal, **at most once a week** (the candidate id is keyed
  on the ISO week, so a settled card stays settled until next week): text = the insight's title, sub „Megmutatom, mi
  változna, mielőtt bármi változik.", primary **„Átnézem"** → opens Évad → **Módosítás** (`evadWallOpens` →
  `EvadStore.pendingSub`), *miért?* = the insight's body. **Rank 0.8** — beats the food tip (0.7), not a session
  within two hours (0.9).
- **`.happened`** — the season ends within **7 days** (today included): „*N nap múlva* véget ér az évad" / „*Ma* véget
  ér az évad", *Megnézem* → the Évad page.

No season (nil overview), no candidates. The Ma wall loads the overview once (cached offline).

## 4. Data model & API

Contract fragment [`api/feature/season/season.yml`](../../api/feature/season/season.yml) (tag **Season** →
`SeasonApi`), registered in `api/generate/merge.yml`.

| Operation | Method + path | Writes | Notes |
|---|---|---|---|
| `listSeasons` | GET `/api/seasons` | — | newest start first |
| `createSeason` | POST `/api/seasons` | season (planned) + goal | body `SeasonDraft` |
| `getFirstSeasonDraft` | GET `/api/seasons/draft` | — | the first-season draft |
| `previewSeasonDraft` | POST `/api/seasons/draft/preview` | — | no fingerprint |
| `getSeasonOverview` | GET `/api/seasons/active/overview` | — | 404 = no active season |
| `applySeason` | PUT `/api/seasons/{id}` | goal, slots, sleep, block, revision | body `SeasonApply {draft, fingerprint}`; 409 `SEASON_PREVIEW_STALE` / `SEASON_NOT_EDITABLE` / `SEASON_BLOCK_DAYS_LOCKED` |
| `activateSeason` | POST `/api/seasons/{id}/activate` | see §3.3 | 409 `SEASON_NOT_EDITABLE` |
| `closeSeason` | POST `/api/seasons/{id}/close` | status, summary, sleep base back | |
| `previewSeason` | POST `/api/seasons/{id}/preview` | — | `{before, after, todo, warnings, fingerprint}` |
| `putSeasonRules` | PUT `/api/seasons/{id}/rules` | rule columns | no preview |
| `getAdherence` (S2) | GET `/api/seasons/adherence?from&to` | — | `SeasonAdherenceResponse {days[SeasonAdherenceDay], summary SeasonAdherence}`; with or without a season; 400 `VALIDATION_INVALID_VALUE` when `to < from` or > 62 days (§3.7) |

Error codes (`messages_hu/en`): `SEASON_REQUIRED`, `SEASON_PREVIEW_STALE`, `SEASON_NOT_EDITABLE`,
`SEASON_PROFILE_REQUIRED`, `SEASON_BLOCK_DAYS_LOCKED`, and `SEASON_ACTIVE_EXISTS` (reserved, not thrown — §3.3). Ownership always from the principal;
another owner's id is 404.

**Tables** (Liquibase `1.1.0/script/202611211000_mezo-r36n9.16_season.sql`, all in `ResetDatabase`):

| Table | What |
|---|---|
| `season` | title, `status` planned/active/closed (partial unique index `uq_season_one_active`), `start_date`, `weeks` 4–24, `goal_id` → goal, `sleep_need_min`, `sleep_base_min`, rules (`processed_food_max_nova` 1–4 default 2, `deload_maintain`, `use_learned_expenditure`, `propose_experiments`, `menu_day` 0–6 / null, `menu_time`), `draft` jsonb (the last accepted `SeasonDraft`), `closed_summary` jsonb |
| `season_allowed_recipe` | (season_id, recipe_id) — replaced as a whole on accept; the S3 menu draws only from these |
| `season_revision` | one row per accepted change: `draft`, `before` / `after` `SeasonNumbers` snapshots |

S2 adds no table: adherence and insights are computed on read. Entities `SeasonEntity`, `SeasonAllowedRecipeEntity`, `SeasonRevisionEntity`; typed jsonb records `SeasonDraftJson`,
`SeasonNumbersJson`. Mapper `SeasonMapper`. Config record `SeasonProperties` (`mezo.season.*`).

## 5. Integrations

- **→ goal** (`SeasonGoalPort`): creates / updates / activates the season's goal through `GoalService`; draft numbers
  through `GoalPrescriptionCalculator.calculate(…, draftEat)` + `DayTargetProjector`; feasibility; `goal_plan_link`.
  The draft energy reaches the calculator through a ThreadLocal set and cleared in `try/finally` (the frozen
  biometrics↔goal ArchUnit cycle pins the 3-arg body) — tech debt `mezo-r36n9.124` (explicit parameter + re-freeze).
- **→ train** (`SeasonTrainPort`): reads / replaces gym + sport slots (per-day gym times kept unless the time is
  changed), prices draft slots, starts a block from a template, reads mesocycles. **train → season**: `SeasonGatePort`.
- **→ biometrics/sleep** (`SeasonSleepPort`): reads / writes `sleep_goal` directly (the sleep-goal service bean is
  behind its own switch); ghost defaults when unset.
- **→ weight / sleep log / recipes** (`SeasonMetricsPort`): latest weight, EWMA trend + 14-day rate, weigh-in day
  count, average sleep, recipe count.
- **← fuel** (indirect): the day targets Étel serves are the goal engine's; the season changes them only by writing the
  goal and the slots.
- **→ fuel** (S2, `SeasonMealPort` → `FuelDayService.getWeek`): adherence's food side; **← Étel Hét** reads
  `getAdherence` for its judged / kímélő flags ([`boop-ios.md`](boop-ios.md), [`fuel.md`](fuel.md)).
- **→ train** (S2): planned / done / excused session days (`PlannedSkipService.excusedDates`, `WorkoutWindowQueryService`).
- **→ companion reflection** (S2): `EffectLinkCalculator` for the short-night insight.
- **companion / boop / meal → season** (S2): `SeasonContextPort` (one per consumer) ← `SeasonContextAdapter` (§3.9) —
  chat snapshot, `get_season`, morning brief, meal coach ([`companion.md`](companion.md), [`fuel.md`](fuel.md)).
- **← Boop iOS**: `EvadClient` / `EvadStore` (§2, [`boop-ios.md`](boop-ios.md)); the Ma wall's `evad` source (§3.10).
- S3–S4 add: menu / shopping / experiments.

## 6. How to use it (consume)

From another backend feature, do not read `season` tables: add a consumer-owned port in your feature and let the
season supply the adapter (the `SeasonGatePort` pattern), or read the season's effects where they already land (goal,
slots, `sleep_goal`). On the phone, read `EvadStore.overview` (fresh or cached, `offline` + `ageText`), and treat
`empty` as "no season" — never as a failure. For a day's judgement anywhere (a new surface, a new AI line) call
`AdherenceService` / `getAdherence` — never re-derive „judged" or „in band" locally (the Étel Hét tab's local rule is
only the offline fallback). An AI context that should know the season adds its own `SeasonContextPort` and lets
`SeasonContextAdapter` implement it.

## 7. How to extend it

Contract first in `season.yml` → `merge.yml` regen → service in `feature/season/service` (writes only in
`SeasonService`, previews stay read-only) → a new number goes into `SeasonNumbersJson` **and** the fingerprint if the
preview depends on new state → Liquibase changeset in `1.1.0/` + `ResetDatabase` → ITs with
`-Dmezo.test.use-testcontainers=true` + `ArchitectureTest` → regenerate `docs/CODEMAP.md`. A new cross-feature read is
a season-owned port with a season-side adapter (§3).

## 8. Testing

Backend (`./mvnw test -Dtest='Season*IT,Season*Test,MesocycleGateIT,GoalPrescriptionDraftIT,WeeklyScheduledActivityDraftTest,SleepNeedRuleTest,ArchitectureTest' -Dmezo.test.use-testcontainers=true`):

- `SeasonPreviewIT` — same draft equal before/after, 5th session raises sleep need not the training-day target, no
  rest day when all seven days are active, maintain band, aggressive-pace warning, preview persists nothing, draft
  preview from live state with no fingerprint, `weekKcal` rises with a sport day / a 5th gym day / is seven training
  days without a rest day, seasons past the goal's target date keep computing.
- `SeasonServiceIT` — activate writes slots / sleep / link, activating another closes the previous, stale fingerprint
  409, revision written, first draft from the live goal only and covering + adopting the running block, gym-day change
  with a running block 409 (sport change passes, no-block change passes), close gives the sleep goal its base back /
  keeps one he changed, concurrent apply on a planned season 409, apply after an accepted balance adjustment 409,
  activation keeps each gym day's own time.
- `SeasonOverviewIT` — 404 without season, maintain band, null rest-day link, `slower`, `no_data` with three
  weigh-ins, deload listed from the block, projection flat after the target, past-target season computes.
- `MesocycleGateIT` (gate on) — template start without season 409, planned season in 5 days passes, too far ahead
  does not, activating a planned block without season 409, a running block keeps running, activating a season starts
  its template block through the gate.
- `AdherenceServiceIT` (S2) — kímélő day excused, a reasoned skip excuses only the session (food and night still count), a completed workout or sport
  session counts, no season still judges food against the goal, today and unlogged days not judged, the ±10 % band,
  sleepOk uses the season's need, the range validated, lastWeek empty when nothing could be judged.
- `SeasonInsightsIT` (S2) — no learned insight before learning, the short-night insight needs an effect and a
  difference, at most three, none without an active season.
- `SeasonContextRendererTest` (S2) — empty without a season, NOVA + allowed-recipe rules, no recipe rule without
  allowed recipes, the overview says where the season stands; `ContextSnapshotSeasonIT` (the block appears once),
  `SeasonToolsRenderIT` (no season says so, `rules` scope vs the `overview` default), `CompanionToolRegistryIT`
  (`get_season` registered), `BoopPromptsTest`, `MealCoachPromptTest` (the season block present / absent).
- `SeasonApiIT` (full HTTP flow incl. `getAdherence` and its 400, incoherent live goal still activates, another owner 404), `SeasonPortsIT`,
  `SeasonRepositoryIT` (one-active index, planned coexist, allowed recipes), `SeasonTodoRulesTest`,
  `SleepNeedRuleTest`, `GoalPrescriptionDraftIT`, `WeeklyScheduledActivityDraftTest`.

iOS (`BoopKit-Package`): `EvadClientTests` (contract paths, lenient decode incl. `weekKcal`, 409 mapping, refusal
copy), `EvadStoreTests` (cache fallback, offline without cache, 404 = empty, start creates + activates once on retry),
`EvadLogicTests` (verdicts, map lines never inventing a number, Hungarian formatting, no-rest-day text, gym stepper
avoids sport days, accept only for the previewed draft, gym days locked while a block runs, the weekly-total row; S2:
Hogy megy facts leave out what has nothing to count, the kímélő-days line, the `sleep_food` line from the server number),
`EvadWallTests` (S2: no candidates without a season, season end is `.happened`, the learned insight is `.improves`),
`EvadClientTests` (S2: the adherence path). App `EtelHetTests` (S2): server days give the same week as the local rule,
the server's kímélő day and judged flag win, a day the server did not answer keeps the local rule.

## 9. Decisions, gotchas & deferred

- **The season owns the slots, not the mesocycle** — a mesocycle alone has zero kcal effect; only the weekly slots
  move the kcal (spec §5.2, the scan's key modelling rule).
- **No invented number**: a link or pillar without a computation is null and the phone says so.
- **Adding a session does not raise the training-day kcal** (served-target model) — see §3.1; the owner sees it in
  *Heti összesen*, the sleep need and the bedtime. Do not "fix" this by adding movement to the train-day target.
- **Gym days locked while the block runs** (409 `SEASON_BLOCK_DAYS_LOCKED`, the phone disables the controls) until the
  in-block day editor lets one accept move the block too — `mezo-r36n9.122` (after `mezo-r36n9.116`).
- **Adapters season-side** to avoid feature cycles (§3); **ThreadLocal draft energy** in the goal calculator —
  `mezo-r36n9.124`.
- **Gate off in tests**: a new block-starting IT needs no season; a test of the gate must opt in like `MesocycleGateIT`.
- **Closing restores the sleep base** only when the sleep goal still holds the season's value.
- **One judgement, one place (S2):** „judged" and „in band" are computed only in `AdherenceService`; the Étel Hét tab
  takes the server's flags per day and keeps its own identical rule only for days the server did not answer
  (offline, an older server). The band is symmetric ±10 %, while the Hét tab's amber pill stays „over 110 %".
- **Planned sessions come from today's schedule** (§3.7) — a schedule change re-labels past days. Fixing it needs a
  dated schedule history; not built.
- **Kímélő excuses the day, a skip excuses the session:** only a kímélő day leaves every count (and `excusedDays`); a
  reasoned skip takes just that day's session out — its food and night are still judged (owner review, 2026-11-21).
- **One planned session per day** (§3.7): gym + sport on the same day are one flag, so a two-session day counts once.
- **The renderer never throws** and leaves out what it cannot compute; adding a line must keep that (a context
  failure would break every chat turn).
- **Per-turn cost** of the `[Évad]` block (§3.9): one read-only engine computation per chat turn / brief / coach call
  while a season is active.
- Deferred: S3 menu + shopping list (Menü / Lista "not live yet"); S4 experiments (Hatás "not live yet");
  `mezo-r36n9.123` — the *Korábbi évadok* page and the current weight in Új évad step 1.

## 10. Key files

- **API:** `api/feature/season/season.yml`, `api/generate/merge.yml`.
- **Backend:** `backend/src/main/java/io/mrkuhne/mezo/feature/season/{controller,service,port,entity,repository,mapper,config}/` —
  `SeasonService`, `SeasonPreviewService`, `SeasonOverviewService`, `SeasonFingerprint`, `SleepNeedRule`,
  `SeasonTodoRules`, `SeasonDraftMath`, `FirstSeasonAssembler`, `Season{Goal,Train,Sleep,Metrics,Gate,Meal}Adapter`;
  S2: `AdherenceService`, `SeasonInsights`, `SeasonContextRenderer`, `SeasonContextAdapter`, `port/SeasonMealPort`.
- **Cross-feature:** `feature/train/port/SeasonGatePort.java`, `feature/train/service/TrainService.java`
  (`requireSeason`), `feature/train/service/WeeklyScheduledActivityService.java` (draft EAT),
  `feature/goal/engine/service/{GoalPrescriptionCalculator,GoalProjectionService}.java` (draft overloads);
  S2: `feature/{companion,boop,meal}/port/SeasonContextPort.java`, `feature/companion/tools/SeasonTools.java`,
  `feature/companion/service/ContextSnapshotAssembler.java`, `feature/boop/service/{BoopDay,BoopDayAssembler,BoopPrompts}.java`,
  `feature/meal/service/{MealCoachContextReader,MealCoachPrompt}.java`.
- **DB / config:** `backend/src/main/resources/db/changelog/1.1.0/script/202611211000_mezo-r36n9.16_season.sql`,
  `application.yml` (`mezo.season.*`), `src/test/resources/application.properties` (gate off),
  `messages_hu/en.properties` (`SEASON_*`), `src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`.
- **Tests:** `backend/src/test/java/io/mrkuhne/mezo/feature/season/*`, `feature/goal/GoalPrescriptionDraftIT.java`,
  `feature/train/WeeklyScheduledActivityDraftTest.java`.
- **iOS:** `ios/BoopKit/Sources/BoopCore/Evad/{EvadClient,EvadStore,EvadWire,EvadLogic,EvadWall}.swift`,
  `ios/Boop/Etel/{EtelHet,EtelRoom}.swift` (S2: server adherence), `ios/Boop/Nap/MaWall.swift` (S2: the `evad` source),
  `ios/Boop/Evad/{EvadPage,EvadOverviewTab,EvadSystemMap,EvadWhatIf,EvadRules,EvadNewSeason,EvadPreview}.swift`.
- **Docs:** spec `docs/superpowers/specs/2026-11-20-boop-evad-design.md`, plan
  `docs/superpowers/plans/2026-11-20-boop-evad.md`, handbook `docs/boop-handbook/04-terv/`.

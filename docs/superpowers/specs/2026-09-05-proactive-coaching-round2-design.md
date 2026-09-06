# Proactive Coaching Round 2 — Deferred Detections (mezo-d58h.7)

**Date:** 2026-09-05
**Driving issue:** mezo-d58h.7
**Predecessor:** `2026-09-03-proactive-coaching-round1-design.md` (round 1 shipped the flag
spine, the daily advice card, the narrow mutation set, and thirteen live detections).

Round 2 implements the seven detections deferred in round 1's §10: items (9), (11), (12),
(13), (15), (17), (18). The §10 bullets were one-liners; this spec writes their trigger
logic for the first time.

## Decisions made during brainstorm

- **One spec for all seven items.** The one-time questions share the daily card budget
  with advice cards, and that cross-cutting decision must be made once, coherently.
- **Adherence-neutral firing policy (all items).** Incomplete intraday data never
  triggers a negative signal. Meal-shaped detections fire only from multi-day rolling
  windows; the protocol-lapse rule speaks only on the *second* consecutive miss, in a
  "the streak still lives" tone. Unlogged ≠ compliant ≠ violating; too little data ⇒
  silence.
- **Hydration is the one intraday exception**, with up to **3 checkpoints** spread
  across a training day (you cannot catch up on water at day's end), each guarded by
  "the user has already logged something today" (batch-logger guard).
- **Hydration and retro-logging are prompt facts, not cards.** They ride the companion
  window-prompt channel (`CompanionMessageGenerator`), never competing with the
  one-advice-card-per-day gate. The day gate stays unbroken — no card exceptions.
- **One-time questions carry no mutation.** Items (17) and (18) ask once, store the
  answer as a fact in companion memory, and change nothing else. No feature hiding, no
  data exclusion, no new contract endpoints.

## Architecture

Three genres, all riding the round-1 spine. Data direction: companion → {meal, fuel,
train, biometrics, journal} reads, all acyclic (ArchUnit-guarded); writes only to
companion's own tables.

### a) Flag rules — items (11), (13), (15)

New `FlagRule` classes in `companion/flags/service/rule/`, evaluated by the hourly
`FlagEvaluator` sweep alongside the existing thirteen, in the explicit fixed-order call
list. Each is a pure `evaluate(userId, today)` with cross-feature reads in the accepted
style (direct repository reads where no per-day scalar metric fits — the
`LoggingGapRule` precedent). Firing flows unchanged: `FlagRaisedEvent` →
`InterventionEventListener` → intervention library → advice card with day gate and
priority contest.

Per rule, the full round-1 recipe: `FlagKey` constant, `FlagProperties` nested config
record with Bean-Validation ranges + `application.yml` defaults, explicit
`FlagEvaluator` wiring, `AdvicePriority.ORDER` entry (+ `AdvicePriorityTest`
extension), intervention-library config entry, Liquibase CHECK widening, per-rule IT.

### b) Prompt facts — items (9), (12)

The `CompanionMessageGenerator` midday/evening gathers gain two new facts (the
`LogFreshnessProbe`/fact-injection idiom, per `docs/features/proactive.md` §7 feed
extension recipes):

- **Retro-logging ratio** (item 9): so the midday prompt stops assuming
  "no data = didn't eat".
- **Pro-rated hydration shortfall** (item 12): training days only.

Plus one new ~15:00 hydration checkpoint that branches off the existing hourly sweep
(no new cron; the dawn-job cluster stays untouched). It emits a message only when the
shortfall condition holds — it is not a new fixed daily prompt.

These are not cards and do not touch the day gate. Switches: `COMPANION_SWITCH` +
`PROACTIVE_SWITCH`.

### c) One-time questions — items (17), (18)

A "once-ever" variant of the setup-check idiom (`SetupCheckService` +
`AdviceCandidate.fromSetupCheck`): the envelope-key dedupe with an effectively infinite
(configurably enormous) re-emit window guarantees each question fires exactly once per
user, ever. The question is delivered as an advice card at setup-tier priority (below
all flags). The answer is captured through the existing message-feedback path
(`MessageFeedbackEntity` + `CompanionFeedbackApi`) and stored as a fact — no mutation
follows.

Budget rule: at most one question per day, and a question never stacks with an advice
card — a question is only eligible when no card has gone out that day (shared budget).

## Trigger logic per detection

All thresholds are config defaults with Bean-Validation ranges; tune later. Shared
honesty gate: too little data ⇒ silence.

### (11) Protocol lapse — flag `protocol_lapse`

For each active protocol item: fire when the item was missed on the last **2
consecutive due days** (no `SupplementIntakeEntity` row for the due day), AND there was
a real prior habit — ≥7 days of history with ≥60% adherence (a live streak existed).
One missed day is an implicit grace day: never speaks. Tone: "resume today and the
streak lives" (Duolingo grace-window pattern), never "streak broken". Cooldown: 7 days
per item. Empty/inactive protocol ⇒ silence (that is setup-check territory, not lapse).

### (13) Meal-rhythm drift — flag `meal_rhythm_drift`

14-day rolling window, minimum **10 days** with logged meals, else silence. Two
sub-triggers, one flag:

- **Slot drift:** a planned slot's (`MealSlotTemplateEntity`, dayType-correct) actual
  `loggedAt` median deviates persistently by >90 minutes from the planned time.
- **Dead slot:** a planned slot has meal rows on <30% of window days while the other
  slots sit at ≥70% (the user logs — just not that slot).

A single day's signal is never enough. The card phrases as neutral observation
("dinner actually lives around 21:00 / stays empty — adjust the plan?"), never as an
adherence failure. Cooldown: 14 days.

### (15) Midday energy dip vs meal timing — flag `energy_dip_meal_timing`

The most cautious rule. Minimum **10 days** that each have an early-afternoon
(11:00–16:00 `slotTime`) check-in energy value AND a logged morning meal. Trigger:
split those days by lunch time before/after the window median (fallback split when
lunch times don't vary: breakfast present/absent); fire when the two groups' afternoon energy medians
differ by at least **1 full point** consistently, with ≥4 days in each group. Phrased
as correlation, never causation ("on your earlier-lunch days you typically logged
higher afternoon energy"). Cooldown: 30 days — effectively a one-off insight card.

### (9) Retro/batch-logging awareness — prompt fact

Over a 14-day window, measure the retro ratio of meals (calendar day of `createdAt` ≠
`mealDate` ⇒ retro — the `RetroLoggingRatioDetector` convention). When the ratio is ≥
**40%**, the midday prompt context receives `batchLogger=true` plus today's logging
state, and the prompt instruction explicitly forbids the "haven't you eaten?"
assumption — neutral phrasing instead ("when you log, I'll count"). No flag, no card.

### (12) Hydration minimum on training days — prompt fact + checkpoint

Training days only (a workout instance today, or `COMBINED_LOAD_MIN` > 0). Three
signal points: the existing midday (~11:00) and evening (~19:00) window prompts plus
the new ~15:00 checkpoint. At each: pro-rated target = daily minimum × (waking-day
fraction elapsed); when logged `DAILY_WATER_ML` < **60%** of the pro-rated target AND
the user has logged anything at all today (batch-logger guard), the prompt receives the
shortfall fact. Zero water logs and zero other logs all day ⇒ silence. The 15:00
checkpoint sends a message only when the shortfall condition holds.

### (17) Feature-abandonment question — `question_feature_abandonment`

Trigger: a feature family (mind: journal/habit/ritual/needs; separately: AI chat) was
genuinely used before (≥10 domain rows total, derived from domain tables' `created_at`
— no usage-events table exists) but has zero new rows in the last **30 days**. Asked
once, ever: "I see you haven't touched X in a while — deliberate shelving, or did it
just fade?" Answer stored; nothing else happens. An empty table means "never used",
which is *not* abandonment ⇒ silence.

### (18) Flat exercise-feedback question — `question_flat_feedback`

Trigger: across the last **8 logged workouts**, `workload` AND `jointPain` values have
zero variance (always the same combination — likely reflex-clicked). Asked once, ever;
answer stored as a data-quality fact. No consequence for rule inputs (decided: same
"just remember" pattern as item 17).

## Error handling and edge cases

- Silence is the default: missing data, too few days, empty protocol, no slot template
  ⇒ `Optional.empty()`; the sweep never fails on an exception from these rules.
- (13)/(15) are timezone-sensitive: use the `loggedAt`/`slotTime` wall-clock convention
  as `LateEatingRule` does — no UTC conversion games.
- (17) usage signal comes from domain `created_at`; prior-use gate prevents
  "never used" from reading as "abandoned".
- One migration widens `ck_companion_flag_log_flag_key` with the 3 new flag keys and
  the setup-key set with the 2 question keys — template:
  `202609041200_mezo-d58h.6_flag_key_batch_b.sql`. (DB CHECKs fail silently at insert
  time otherwise.)
- Switches: flag rules under `COMPANION_SWITCH`; prompt facts and questions under
  `COMPANION_SWITCH` + `PROACTIVE_SWITCH`; switch-off ITs per house pattern.
- `AdvicePriority` unknown keys rank last with only a log warning — the
  `AdvicePriorityTest` extension is mandatory per new key.

## Testing strategy

- Per rule: a `FlagEvaluator*IT` on the round-1 pattern (fires / grace day / too-little-
  data silence / cooldown / switch-off).
- `AdvicePriorityTest`: every new key ranked.
- Prompt facts: `CompanionMessageGenerator` tests — batch-logger context appears in the
  midday prompt; hydration shortfall boundary cases; 15:00 checkpoint emits only on
  shortfall.
- One-time questions: dedupe IT — exactly one message across repeated sweeps; never
  again after an answer.
- Locally only focused ITs (`-Dmezo.test.use-testcontainers=true`); the authoritative
  full-suite gate is the CI self-PR.

## Slicing (finalized in the plan phase)

Each slice independently shippable, each includes CODEMAP regen +
`docs/features/proactive.md` update:

1. **S1** — (11) protocol-lapse flag (cleanest, established recipe)
2. **S2** — (12) hydration prompt fact + 15:00 checkpoint
3. **S3** — (9) retro-logging prompt fact (small; shares S2's idiom)
4. **S4** — (13) meal-rhythm-drift flag
5. **S5** — once-ever question mechanism + (17) + (18) (one slice; the mechanism is
   built once)
6. **S6** — (15) energy-dip flag (riskiest last; every pattern exists by then)

## Prior art

- **MacroFactor adherence-neutral design** — adopted as the firing policy: no intraday
  nags from incomplete data; batch logging is a first-class workflow.
  https://macrofactorapp.com/adherence-neutral/
- **JITAI framework (Nahum-Shani et al.)** — adopted as vocabulary/structure: decision
  rule + tailoring variable + receptivity guard (cooldowns). Rejected the ML variant as
  overkill. https://academic.oup.com/abm/article/52/6/446/4733473 (receptivity:
  https://dl.acm.org/doi/10.1145/3614214.3614221)
- **Duolingo streak freeze** — adopted the grace-window concept for (11): fire on the
  second consecutive miss, "streak still lives" tone. Rejected the monetized repair
  economy. https://duoplanet.com/duolingo-streak-freeze/
- **myCircadianClock chrononutrition research** — adopted rolling-distribution meal
  timing math for (13)/(15): 10+ days minimum, quantile/median-based, single-day
  signals are noise. https://www.nature.com/articles/s41366-021-01038-3
- **Microsurvey practice (Formbricks)** — adopted for (17)/(18): event-triggered,
  one question, one-tap answer, persisted asked-once flag, shared daily budget with
  cards. https://formbricks.com/blog/microsurveys

## Codebase terrain

- **Spine:** `FlagRule` interface
  (`backend/.../companion/flags/service/FlagRule.java:14`), 13 rules in
  `flags/service/rule/`, explicit wiring in `FlagEvaluator.java:47-82`, keys in
  `FlagKey.java`, config in `FlagProperties.java` + `application.yml`
  (`mezo.companion.flags.*`, hourly sweep cron). Flag → card:
  `InterventionEventListener` → `InterventionService` → `AdviceCardService` (day gate,
  severity, LLM prose with template fallback). Severity order:
  `AdvicePriority.java:54-67`.
- **Window prompts:** `CompanionMessageGenerator.java:390-426` (midday/evening kinds) —
  the target for items (9)/(12).
- **Once-ever base:** `SetupCheckService.java:64-126` (ordered first-wins,
  envelope-key dedupe via `inReEmitWindow`), `AdviceCandidate.fromSetupCheck`; answer
  capture via `MessageFeedbackEntity` + `CompanionFeedbackApi`.
- **Data sources:** water `WaterLogEntity` / `MetricKey.DAILY_WATER_ML`; supplements
  `SupplementIntakeEntity` + `ProtocolEntity`/`ProtocolItemEntity`; meal slots
  `MealSlotTemplateEntity` vs `MealEntity.loggedAt`; energy `CheckInEntity`
  (`slotTime`, `energy`) via `CheckInRepository` (slot-level, the `LoggingGapRule`
  precedent); exercise feedback `ExerciseFeedbackEntity`
  (`GYM_WORKLOAD`/`GYM_JOINT_PAIN`); feature usage derived from domain `created_at`
  (no usage-events table); retro convention `RetroLoggingRatioDetector` (character).
- **Traps:** DB CHECK widening required per new key; `AdvicePriority` silent
  last-place for unmapped keys; dual/triple switch layout; config-default ghost trap
  for "is X configured" reads (read repositories directly, per
  `SetupCheckService.java:66-68`); ArchUnit layer subpackages + acyclic companion
  reads; CODEMAP freshness gate; no new cron near the dawn cluster; FE (if touched)
  must pass both `VITE_USE_MOCK` modes.

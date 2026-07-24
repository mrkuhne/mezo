# Sleep + Morning-Routine feature cluster — roadmap & continuation notes

> **This is a LIVING handoff/roadmap doc, not a frozen spec.** It captures the whole
> sleep+routine effort so a fresh session (post-`/clear`) can continue without re-deriving
> context. Companion to the dated specs it references. Update it as slices land.
> **Last updated:** 2026-07-24.

## 0. TL;DR — where we are right now

- **Landed on main:** `mezo-dbsr` — **Sleep goal + day-anchor** (slice A). Merged via **PR #43** (`feat/sleep-anchor`, commits `e804d68a..ea444891`): backend `sleep_goal` singleton + enriched `sleep_log` + `GET/PUT /api/sleep/goal` + the **ungated `SleepAnchorPort`**; `HabitTargets` and the Fuel Mai timeline repointed onto the anchor (the old goal wake/bed config keys dropped, no-goal bed default 23:00→22:00); FE `useSleepGoal`/`useSleepGoalActions`, the SleepPage goal card + regularity/efficiency rings + enriched hero, `SleepGoalSheet`, and the optional in-bed field on `SleepLogSheet`.
  - Spec (approved, D1–D8): [`2026-07-23-sleep-anchor-design.md`](2026-07-23-sleep-anchor-design.md)
  - Feature docs: [`me.md`](../../features/me.md) §2/§3/§4/§5.3/§9/§10 · [`fuel.md`](../../features/fuel.md) §2/§3/§4/§5 · [`habit.md`](../../features/habit.md) §5/§9/§10.
- **Landed on main:** `mezo-66ab` — **Sleep Cycle screenshot ingestion** (slice B). Merged via **PR #48** (`feat/sleep-shot`, commits `3d906e00..991a3119`, off the merged slice A): the sleep-owned `SleepShotLlm` **vision** port + companion `SleepShotLlmAdapter` ([ADR 0012](../../decisions/0012-consumer-owned-llm-ports.md), the fourth consumer), `SleepShotService` (ONE vision call → brace-window parse → time zero-padding → `durationH = asleepMin/60`) + the deterministic `SleepShotDraftValidator` (asleep≤in-bed, phase-sum ±10%, span≈in-bed ±15p; confidence = passed/applicable; needsReview boundary-inclusive ≤0.6 or key field missing), `POST /api/sleep/screenshot` (`SleepShotController`, tag `SleepShot`) gated on `mezo.feature.sleep-shot.enabled` with `mezo.sleep-shot` caps/threshold; FE `useSleepShot` (action-only) + the `SleepLogSheet` **Kézi|Screenshot** toggle (pick → drafting → review, confirm down the normal `POST /api/biometrics/sleep` with `source:'screenshot'`) + the out-of-list `TimePicker` tolerance. **Nothing persists** at extraction time. Living docs updated ([`me.md`](../../features/me.md) §2/§3/§4/§8 · [`_platform-api-backend.md`](../../features/_platform-api-backend.md) · [`_platform-data-layer.md`](../../features/_platform-data-layer.md) · [`companion.md`](../../features/companion.md) §5.3).
  - Spec (approved, D1–D8): [`2026-07-23-sleep-shot-design.md`](2026-07-23-sleep-shot-design.md)
- **Landed on main:** `mezo-53su` — **Fuel „Mai" slot-timing fix + `fuel_settings` + slot-level AI** (the FIRST anchor consumer). Commits `71aebab2..9f3d001c` on `feat/fuel-slot-timing`: the `fuel_settings` per-user singleton (`GET/PUT /api/fuel/settings`, tag `FuelSettings`, config-ghost 4/"14:00") relocating `mealsPerDay` + the caffeine cutoff off the weight goal / habit config into a Fuel-owned home; the **ungated `CaffeineCutoffPort`/`CaffeineCutoffResolver`** the habit `no_stim_after` metric now reads (`HabitProperties.caffeineCutoff` + its yml key removed — the `SleepAnchorPort` idiom, third port instance); now-aware re-flow of pending meal windows in `buildDayPlan` (`FuelSlot.slotKey` identity, `MOCK_NOW_HHMM='13:30'`, the static `fuelPlan.today` seed retired so both modes compute the timeline); the Mai `.fuelchips` `szerkeszt` chip → `FuelSettingsSheet`; `EditGoalSheet` loses its "Napi ritmus" section; and the slot-level `AI` chip → `AiLogSheet` with slot-lock. Living docs updated ([`fuel.md`](../../features/fuel.md) §1/§2/§3/§4/§5/§10 · [`habit.md`](../../features/habit.md) §4/§5/§9/§10 · [`me.md`](../../features/me.md) §2/§3 · [`_platform-api-backend.md`](../../features/_platform-api-backend.md) · [`_platform-data-layer.md`](../../features/_platform-data-layer.md)); D4 tie-break codified in the slice spec.
  - Spec (approved, D1–D8): [`2026-07-23-fuel-slot-timing-design.md`](2026-07-23-fuel-slot-timing-design.md)
- **Implemented on `feat/sleep-night` (PR pending):** `mezo-d71m` — **slice C-éj**: slice C was decomposed (2026-07-24 brainstorm) into **C-éj = C1 evening + C2 night layer in ONE slice** — and it is now built (commits `64ec47b5..253f5cb7` on `feat/sleep-night`, awaiting the self-PR + CI gate): the `WindDownBanner` T-90/T-60/night phases carrying the `wind_down` check (over the single time source `features/today/logic/windDown.ts`), the full-screen extra-dark `NightPage` (`/me/sleep/night`) with the unified 20-minute watchdog flow + 3 calm tools (breathing/body-scan/4K-walk) + the localStorage night-trace → morning `SleepLogSheet` awakenings prefill, and the **circadian auto-theme** (`ThemeMode` gains `'auto'`, default on; `CircadianTheme` flips dark exactly inside `isDarkWindow`). FE-only, no backend change. **C3** (education/motivation stat cards + escalation), **C4** (sleep-banking), **C5** (7-day A/B) stay reserved as separate slices. Spec (approved, D1–D9): [`2026-07-24-sleep-night-layer-design.md`](2026-07-24-sleep-night-layer-design.md) + mockup [`2026-07-24-sleep-night-layer-mockup.html`](2026-07-24-sleep-night-layer-mockup.html). Feature docs updated: [`today.md`](../../features/today.md) §2/§10 · [`me.md`](../../features/me.md) §2/§10 · [`habit.md`](../../features/habit.md) §5/§9 · [`_platform-design-system.md`](../../features/_platform-design-system.md) §2/§3/§10.
- **In progress:** `mezo-hd8k` — **slice C3** (branch `feat/sleep-c3`): the Walker education/motivation layer — a daily-rotating `SleepStatCard` (7 motivational stats, §4 list; the heavy clinical stats deliberately excluded from rotation) + full-deck `SleepStatsSheet`, a gentle data-driven **escalation card** (trailing-14d avg <6.0h OR avg quality ≤4, min 5 samples, 14-day snooze — the heavy stats + CBT-I path live HERE), and the **§7 research-ingest** of both source videos into `docs/research/` (knowledge-base skill). FE-only. DEBUNK/myth cards stay reserved. Spec (approved, D1–D7): [`2026-07-24-sleep-c3-education-design.md`](2026-07-24-sleep-c3-education-design.md).
- **Next after C3:** C4 sleep-banking · C5 A/B experiment (§4) + the remaining anchor **consumer** (morning-training reschedule). See §3/§5.

## 1. How we got here — the two source videos

Daniel asked to build recommendations from two YouTube videos into the app.

- **Video 1 — Jeremy Ethier, "The Perfect Morning Routine to Build Muscle"** (`eifEiCYH2yc`).
  Six recs: circadian-aligned wake, morning sunlight, morning weigh-in, caffeine timing,
  morning training, protein-rich breakfast. → became the **habit engine**.
- **Video 2 — Matthew Walker on *The Diary of a CEO*** (`qxxnRMT9C-8`, ~2h17m).
  "Regularity is king." → drives the **Sleep feature** (this cluster). Full extraction in §4.

## 2. What has LANDED (done, on main)

| bd | What | PR |
|---|---|---|
| `mezo-d1jb` | **Habit engine** — morning+evening routine chains, DERIVED completion, HABIT XP source, Today `RoutineCard` + Growth "Rutin" tab. (Video-1 ① of the 4-part decomposition.) | #34 |
| `mezo-b2fe` | Habit routine UI redesign — chain-thread `RoutineCard` + no-truncation Rutin tab | #35 |
| `mezo-8ml4` | Habit routine polish — card padding, button glow, inline sleep-sheet | #36 |
| `mezo-a686` | **Daily intention** — creed + up to 3 daily foci + evening reflection; Today `IntentionBanner`, 2 DERIVED habits, `growth_intention` quest. (Spontaneous, NOT from a video.) | #39 |
| `mezo-dbsr` | **Sleep goal + day-anchor** — `sleep_goal` singleton + enriched `sleep_log` + `GET/PUT /api/sleep/goal` + the ungated `SleepAnchorPort` (Habit/Fuel repointed onto it); FE goal card + regularity/efficiency rings + `SleepGoalSheet`. (Sleep cluster **slice A**.) | #43 |
| `mezo-66ab` | **Sleep Cycle screenshot ingestion** — sleep-owned `SleepShotLlm` vision port + `SleepShotService` + deterministic `SleepShotDraftValidator` + `POST /api/sleep/screenshot`; FE `SleepLogSheet` Kézi\|Screenshot toggle. (Sleep cluster **slice B**.) | #48 |
| `mezo-53su` | **Fuel „Mai" slot-timing + `fuel_settings` + slot-level AI** — `fuel_settings` singleton + `GET/PUT /api/fuel/settings` + the ungated `CaffeineCutoffPort`; now-aware `buildDayPlan` re-flow + slot identity + slot-locked `AiLogSheet`; `EditGoalSheet` loses its planner section. (First **anchor consumer**.) | self-PR |

## 3. The decomposition & ordering (the master plan)

The morning-routine video was split into a **4-part decomposition** up front. Daniel then
reframed the sleep piece as the **foundation everything derives from** — so the ordering changed:
sleep-anchor first, and the old Fuel/training slices become **consumers** of the anchor.

```
① Habit engine ...................................... ✅ DONE (mezo-d1jb + polish)
   Daily intention .................................. ✅ DONE (mezo-a686)  [spontaneous]

SLEEP CLUSTER (the new foundation — video 2):
   A. Sleep goal + day-anchor + enriched log + manual  ✅ DONE (mezo-dbsr, PR #43)
   B. Sleep Cycle SCREENSHOT ingestion (LLM-vision) ... ✅ DONE (mezo-66ab, PR #48) — lands into A's model
   C. Video-2 practical layers — DECOMPOSED (2026-07-24):
      C-éj (C1 evening + C2 night in one slice) ....... ✅ BUILT on feat/sleep-night (mezo-d71m, PR pending)
      C3 education/motivation cards · C4 sleep-banking · C5 A/B experiment ... ⏳ RESERVED (§4)

CONSUMERS of the anchor (were video-1 ③④):
   Fuel "Mai" slot-timing fix + slot-level AI logging  ✅ DONE (mezo-53su) — consumes the anchor; relocated mealsPerDay + caffeine cutoff to Fuel
   Morning-training reschedule + Tasty Dose/Origin protocol setup ⏳ NEXT (consumes the wake anchor)
```

**Why sleep-first (Daniel's insight):** the day's timing anchor (wake/bed) currently lives
buried in the **weight goal's** "Napi ritmus" day-planner (an architectural smell).
`buildDayPlan.ts` already derives meal slots from wake/bed (reggeli = wake+45, kitchenClose =
bed−90), and `HabitTargets` reads goal wake/bed. Making a first-class **sleep goal** own the
anchor means: set an 8h target + fixed wake → derive bed → and *everything* (meal slots, morning
workout window, caffeine cutoff, kitchen close) cascades from one source. Slice A does exactly
this migration (see the spec).

### Slice B — Sleep Cycle screenshot ingestion (✅ DONE, `mezo-66ab`, PR #48)

The enriched `sleep_log` (slice A, spec §D5) is built to receive these. **Fields Sleep Cycle
shows** (from Daniel's example screenshot, `qxxnRMT9C-8`-era app):

- **In bed** 8h 21m · **Asleep** 7h 29m (asleep ÷ in-bed = ~90% efficiency)
- **Went to bed** 0:42 · **Woke up** 9:03
- **Sleep stages:** Awake 0h 52m · Light 3h 26m · **Dream (=REM)** 2h 24m · Deep 1h 40m
- **Quality** 95% (Sleep Cycle's own 0–100 metric)
- (Also shows a "Sleep Goal: Missed" with target bed/wake + deltas — mirrors our own goal.)

**Pattern reused (as shipped):** the project already had LLM-vision/extraction pipelines with a clean
**consumer-owned LLM port** (ADR 0012): `feature/pantry` scrape (`ScrapeLlm`), `feature/meal`
AI-draft (`MealDraftLlm`, multimodal vision), `feature/recipe` breakdown (`RecipeBreakdownLlm`).
Slice B added the **fourth**: the sleep-owned `SleepShotLlm` vision port + companion
`SleepShotLlmAdapter`, a single vision call in `SleepShotService` extracting the fields above into an
**editable draft** (deterministic confidence via `SleepShotDraftValidator` — the LLM never grades
itself), confirmed down the same `POST /api/biometrics/sleep` (enriched) path with `source:'screenshot'`.
Surface `POST /api/sleep/screenshot`, gated on `mezo.feature.sleep-shot.enabled`; nothing persists at
extraction time. Manual logging (slice A) and screenshot (slice B) land in the same model. Full spec:
[`2026-07-23-sleep-shot-design.md`](2026-07-23-sleep-shot-design.md); feature docs per §0.

## 4. Matthew Walker video — full extraction (RESERVED for slice C + reference)

Expert: **Dr. Matthew Walker** (*Why We Sleep*), on Steven Bartlett's *Diary of a CEO*.
Framework he gives = **QQRT**: **Q**uantity · **Q**uality · **R**egularity · **T**iming
(four legs of a chair). "3 most impactful things to start tonight: digital detox, regularity, light."

**Already used in slice A:** regularity-is-king (±15 min), 7–9 h range, efficiency ≥85%.
**Reserved for slice C (the practical layers)** + what NOT to build:

### Buildable affordances (slice C)
- **Wind-down reminder @ T-60 min:** dim lights + digital detox + start cooling the room.
  *(Note: a `wind_down` EVENING habit already exists — slice C would add the timed nudge + the dim/detox specifics, not a new habit.)*
- **Evening dim nudge @ T-90 min:** dim **below 30 lux** + warm/yellow light → **+18% REM** in his study. Optional "use a free lux-meter app" tip.
- **Bedroom temperature tip/target: 67–68 °F / ~18 °C.** Static education card.
- **Get-out-of-bed timer — the "20-minute rule":** if awake ~20 min → leave bed, dim room,
  read/podcast, return only when sleepy (NO countdown-to-sleep). Breaks the bed=awake association.
- **"Don't check the clock" + calm-down toolkit** for 3am wakeups: box-breathing (e.g. in 5 / hold 6 / out 7),
  body scan, a vividly-narrated "4K mental walk" (Alison Harvey — speeds return to sleep), guided meditation.
- **Sleep-banking mode:** before a known deficit (travel, on-call, big event, new baby), extend
  time-in-bed to ~10 h for the prior days → **~40% less cognitive impairment** when later deprived (Walter Reed / Balkin).
- **Motivation/education stat cards** (short, quotable — see stats below).
- **7-day A/B self-experiment** scaffold (baseline → intervention → baseline) to prove a change isn't placebo.
- **Escalation nudge:** frequent distressing nightmares / very short sleep → a "see someone" resource card.

### Motivation stats (quotable)
- Regularity (most vs least regular, UK Biobank ~60k): **−49% all-cause mortality, −57% cardiometabolic disease, −39% cancer mortality.** Regularity **beat quantity** for predicting mortality.
- "The shorter your sleep, the shorter your life." **<6h → 100–150% higher suicidality;** frequent **nightmares → 800%** (a biomarker, "canary").
- Underslept dieters lose **~70% of weight as muscle, not fat.** Short sleep distorts **711 genes**. Underslept = **~30–40% more hunger** (leptin↓/ghrelin↑).
- Deep NREM runs the brain's glymphatic "power cleanse" (clears beta-amyloid/tau).

### DEBUNKS (do NOT build)
- Fixed **90-min smart-wake** devices (cycle ranges 70–120 min — "nonsense").
- "**8 hours for everyone**" (it's a 7–9 h *range*).
- **Blue-light-blocking** as the main lever (the real issue is *engagement*/"bed rotting", not the wavelength — the famous iPad study didn't replicate).
- **Magnesium** as a sleep aid (oxide/citrate don't cross the blood-brain barrier → "expensive urine"; only L-threonate/true-deficiency has a case).
- **Melatonin** as a daily supplement (it's a darkness *signal*, not a sleep generator; only ~3.4 min faster onset; correct dose **0.1–3 mg**, NOT 10–20; use only for **jet lag / circadian-phase disorder**).
- **Counting sheep** (makes it worse). **Ambien/Z-drugs/benzos** ("sedation ≠ sleep"; Ambien cuts glymphatic clearance ~30–40%).

### What Walker DOESN'T cover (so these stay sourced from video 1 / config)
- **NO caffeine numbers** (cutoff hours, half-life) — keep from Ethier / the habit engine's `caffeine-cutoff` (14:00 config).
- **NO morning-light** content (his light section is evening-only) — keep from Ethier (`morning_sunlight` habit).
- **NO naps** discussed.

### Endorsed supplements (narrow)
- **Ashwagandha + phosphatidylserine** for the "tired but wired" phenotype (lower cortisol/sympathetic).
- **DORAs** (suvorexant/lemborexant/daridorexant) as the naturalistic prescription option + **CBT-I** — clinical, not an app feature (maybe an education card only).

## 5. Next-session playbook (post-`/clear`)

1. **Slice B AND the first anchor consumer are merged — pick up slice C or the morning-training reschedule.** Slice A
   is merged (**PR #43**); slice B (`mezo-66ab`, **PR #48**) and the Fuel „Mai" slot-timing consumer (`mezo-53su`) are
   merged too. Two threads remain off the now-anchored model — see item 2.
2. **Next work — slice C and/or the morning-training reschedule (the next brainstorm + spec).** Two ready threads, both
   off the now-anchored model: **slice C** = the Walker practical layers (§4 — wind-down/dim nudges, temperature card,
   the 20-minute rule, 3am toolkit, sleep-banking, education/A-B scaffolds; heed the DEBUNKS list), and **the remaining
   anchor consumer** = the morning-training reschedule + Tasty Dose/Origin protocol setup (reads the wake anchor via
   `useSleepGoal()` / `SleepAnchorPort`). The Fuel „Mai" slot-timing fix + slot-level AI consumer is **already done**
   (`mezo-53su` — it relocated `mealsPerDay` + the caffeine cutoff to a Fuel-owned `fuel_settings` singleton). Kick off
   with **`superpowers:brainstorming`** → `writing-plans` → `subagent-driven-development` (the mezo-d1jb / mezo-dbsr /
   mezo-66ab / mezo-53su loop: task-brief → implementer → task-reviewer → fix-wave → ledger; whole-branch review;
   runtime-verify via chrome-devtools mock FE).
3. **Slice A locked decisions (now SHIPPED — reference, don't re-litigate):** sleep goal = target + fixed
   `WAKE|BED` → derive the other end; ±15 regularity band (score only); `sleep_goal` = the single anchor source
   via the ungated `SleepAnchorPort`, repointing `HabitTargets` + the Fuel timeline; enriched `sleep_log`
   (in_bed_min + phase minutes + source_quality_pct + source); efficiency = asleep ÷ in-bed ≥ 85%; habits
   re-centre but keep the 45-min config window; `mealsPerDay` stays on the weight goal; wake/bed rows removed
   from `EditGoalSheet`; GET `/api/sleep/goal` never 404s (config-ghost). **Slice B locked decisions (`mezo-66ab`,
   SHIPPED — reference):** ONE vision call per screenshot; the LLM returns raw fields (asleep/in-bed/phase minutes
   + qualityPct + times), the backend derives `durationH = asleepMin/60` and zero-pads clock times; confidence is
   **deterministic** (`SleepShotDraftValidator`, never the LLM) = passed/applicable consistency checks, `needsReview`
   boundary-inclusive ≤ threshold (0.6) or a key field missing; **nothing persists** — the editable draft confirms
   down the existing enriched `POST /api/biometrics/sleep` with `source:'screenshot'`; sleep-owned `SleepShotLlm`
   port + companion adapter (ADR 0012, 4th consumer); gated on `mezo.feature.sleep-shot.enabled`; 400 photo / 502
   extract-failed / 503 llm-unavailable.
4. **House workflow reminders:** worktree commits use `git -c core.hooksPath=/dev/null commit`; run
   bd from the main checkout (`~/MrKuhne/mezo`); backend ITs need Postgres on :15432 (`docker compose up -d`)
   and OOM on the full suite locally (use focused `-Dtest=… -DargLine=-Xmx3g`, CI is the full gate);
   FE gate = `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` both modes.

## 6. Open follow-ups (filed, not blocking)

- `mezo-sfsw` — habit-engine follow-ups (main one: the evening-chain level-up product decision — evening
  DERIVED completions earn XP but their level-up is currently silent; decide surface-vs-quiet).
- `mezo-azwt` — daily-intention follow-ups (removeFocus 404 test, error-code asserts, dead CSS, banner state tests).

## 7. A full research ingestion of the Walker video is a TODO

Per CLAUDE.md, an external source worth keeping should be ingested into `docs/research/` via the
**`knowledge-base`** skill (source → `research/raw/`, distilled into entity/concept pages). This
doc folds the *buildable* insights inline for continuity; a proper `research/` ingestion of the
Walker interview (and the Ethier video) can be done later for the wiki.

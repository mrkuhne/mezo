# Sleep + Morning-Routine feature cluster — roadmap & continuation notes

> **This is a LIVING handoff/roadmap doc, not a frozen spec.** It captures the whole
> sleep+routine effort so a fresh session (post-`/clear`) can continue without re-deriving
> context. Companion to the dated specs it references. Update it as slices land.
> **Last updated:** 2026-07-23.

## 0. TL;DR — where we are right now

- **In progress:** `mezo-dbsr` — **Sleep goal + day-anchor** (slice A of the sleep effort).
  Spec **written + committed**, awaiting Daniel's review, then → `writing-plans` → subagent-driven-development.
  - Spec: [`docs/superpowers/specs/2026-07-23-sleep-anchor-design.md`](2026-07-23-sleep-anchor-design.md)
  - Approved browser mockup (SleepPage + SleepGoalSheet): the HTML lived at
    `…/scratchpad/sleep-mockup.html` (regenerate from the spec §5 if gone).
  - Branch: `feat/sleep-anchor` (off `origin/main`).
- **Next-session playbook:** see §5.

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

## 3. The decomposition & ordering (the master plan)

The morning-routine video was split into a **4-part decomposition** up front. Daniel then
reframed the sleep piece as the **foundation everything derives from** — so the ordering changed:
sleep-anchor first, and the old Fuel/training slices become **consumers** of the anchor.

```
① Habit engine ...................................... ✅ DONE (mezo-d1jb + polish)
   Daily intention .................................. ✅ DONE (mezo-a686)  [spontaneous]

SLEEP CLUSTER (the new foundation — video 2):
   A. Sleep goal + day-anchor + enriched log + manual  🔄 IN PROGRESS (mezo-dbsr, spec written)
   B. Sleep Cycle SCREENSHOT ingestion (LLM-vision) ... ⏳ NEXT (was "②"); lands into A's model
   C. Video-2 practical layers ....................... ⏳ LATER (see §4 for the reserved ideas)

CONSUMERS of the anchor (were video-1 ③④):
   Fuel "Mai" slot-timing fix + slot-level AI logging  ⏳ (consumes the anchor; relocates mealsPerDay to Fuel)
   Morning-training reschedule + Tasty Dose/Origin protocol setup ⏳ (consumes the wake anchor)
```

**Why sleep-first (Daniel's insight):** the day's timing anchor (wake/bed) currently lives
buried in the **weight goal's** "Napi ritmus" day-planner (an architectural smell).
`buildDayPlan.ts` already derives meal slots from wake/bed (reggeli = wake+45, kitchenClose =
bed−90), and `HabitTargets` reads goal wake/bed. Making a first-class **sleep goal** own the
anchor means: set an 8h target + fixed wake → derive bed → and *everything* (meal slots, morning
workout window, caffeine cutoff, kitchen close) cascades from one source. Slice A does exactly
this migration (see the spec).

### Slice B — Sleep Cycle screenshot ingestion (the immediate follow-on)

The enriched `sleep_log` (slice A, spec §D5) is built to receive these. **Fields Sleep Cycle
shows** (from Daniel's example screenshot, `qxxnRMT9C-8`-era app):

- **In bed** 8h 21m · **Asleep** 7h 29m (asleep ÷ in-bed = ~90% efficiency)
- **Went to bed** 0:42 · **Woke up** 9:03
- **Sleep stages:** Awake 0h 52m · Light 3h 26m · **Dream (=REM)** 2h 24m · Deep 1h 40m
- **Quality** 95% (Sleep Cycle's own 0–100 metric)
- (Also shows a "Sleep Goal: Missed" with target bed/wake + deltas — mirrors our own goal.)

**Pattern to reuse:** the project already has TWO LLM-vision/extraction pipelines with a clean
**consumer-owned LLM port** (ADR 0012): `feature/pantry` scrape (`ScrapeLlm`) and `feature/meal`
AI-draft (`MealDraftLlm`, multimodal vision). Slice B = a `SleepShotLlm` port, a vision call
extracting the fields above into an **editable draft**, confirmed down the same
`POST /api/biometrics/sleep` (enriched) path. Gated on a feature flag. Manual logging (slice A)
and screenshot (slice B) both land in the same model.

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

1. **Resume slice A (`mezo-dbsr`).** The spec is written + committed on branch `feat/sleep-anchor`.
   Ask Daniel if he's reviewed [`2026-07-23-sleep-anchor-design.md`](2026-07-23-sleep-anchor-design.md);
   if approved → invoke **`superpowers:writing-plans`** to produce the implementation plan, then
   **`superpowers:subagent-driven-development`** to execute (the same loop used for mezo-d1jb / mezo-a686:
   task-brief → implementer → review-package → task-reviewer → fix-wave → ledger; final whole-branch
   review; runtime-verify via chrome-devtools mock FE; darwin+linux visual goldens if a golden screen
   changed — note `/me/sleep` is NOT in the visual set, so likely none; PR → CI-green → `gh pr merge --merge`).
2. **Key locked decisions for slice A** (don't re-litigate): sleep goal = target + fixed WAKE|BED →
   derive other; ±15 regularity band; sleep_goal = single source of truth, repoint HabitTargets/
   buildDayPlan/buildProtocol/timeline; "Napi ritmus" moves to SleepPage; mealsPerDay stays on the
   goal for now; enriched sleep_log (in_bed_min + phase minutes + source_quality_pct + source);
   efficiency = asleep÷in-bed ≥85%; habits re-center but keep the 45-min config window.
3. **Then slice B** (screenshot ingestion) — new brainstorm+spec, §3 has the field list + the port pattern.
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

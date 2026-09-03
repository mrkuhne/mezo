# Proactive Coaching Round 1 — Design

**Date:** 2026-09-03 · **Status:** approved in brainstorm, pending spec review
**Driving complaint (user, 2026-09-03):** the app's parts work statically and in isolation —
no proactive detection of sleep debt vs. goal, no nudge after days of skipped meal logging /
check-ins, no overtraining warning for 5 gym + 4 volleyball sessions/week vs. logged food and
sleep, and no adjustment-suggestion mechanism. "Nincs meg az élmény, hogy mindennel képben van
az AI."

## 0. Evidence (live DB, 2026-08-24 → 2026-09-03)

All live data starts 2026-08-24 (~10 days of history — this matters for baselines).

- Sleep: 7/11 nights logged, avg ~6.4 h, one night ≥8 h; **`sleep_goal` table is empty** —
  the sleep_debt rule silently runs on its 8 h config default.
- Meals: fine through 08-26 (2100–2950 kcal, 133–173 g protein), then collapse: 08-27 415 kcal,
  08-28 and 08-30 empty, 1000–1100 kcal days after; dinner slot dead since 08-25.
- Check-ins: last one 08-29 14:00 — 5+ days of silence.
- Training: gym completed 08-24/25/26/28, **nothing since**, despite Mon–Fri 07:00 slots;
  volleyball 08-25 (120′), 08-29 (240′, RPE 7), 08-31 (120′); shoulder_strain 4→6→6.
- Habits: 10–13/15 done → 1–3/15 since 08-27. Weight: 84.2 → 82.4 kg in 10 days.
- What the system did: `sleep_debt` flag raised 08-25..28, intervention card+push on 08-25 and
  08-27, then **honest silence** — unlogged nights are skipped by the rule, so the detector
  mutes exactly when logging stops. 20–30 pushes/day drowned the two that mattered. The
  on-demand fatigue diagnosis (09-02) correctly named all three factors; nothing proactive did.
- Check-in body/energy/mental are recorded but no rule reads them (08-24 10:00 body=2 → no
  reaction). Meals batch-logged retroactively (08-26: 4 meals at 16:08; 09-02: 5 meals at
  22:07–22:16). Late-night eating (dinner 23:38, snack 23:43). lights_out push (22:00) ignored
  every night (actual bedtimes 23:00–00:22). Mind features abandoned after one try.

**Scope decision (user):** option B — build detection + signaling + plan adjustment on the
existing flag→intervention spine now; push-noise reduction is a later project (beta users
self-tune via notification prefs meanwhile).

## 1. Prior art

Researcher recon (2026-09-03), filtered:

- **WHOOP** — daily roll-up (sleep debt compounds into future need; coaching expressed as
  today's budget, not retrospective scolding). Adopted: debt framing and "what to do today"
  card voice. Rejected: readiness score (no HRV hardware). https://www.whoop.com/us/en/how-it-works/
- **MacroFactor** — adherence-neutral coaching: nudge only on *missing data* ("log so I can
  help"), never on missed targets; weekly smoothed adjustments. Adopted wholesale for the
  logging-gap rule's tone and for keeping plan edits suggestion-gated. https://www.strongerbyscience.com/macrofactor-algorithms-philosophy/ · https://macrofactorapp.com/adherence-neutral/
- **ACWR literature** — acute:chronic workload ratio, sweet spot ≈0.8–1.3, >1.5 risky; the
  review warns against using it as a lone hard alarm. Adopted: combined-load rule uses load ×
  fuel/sleep conjunction, not a bare ratio; with ~10 days of history the chronic side is
  honest-gated. https://www.scienceforsport.com/acutechronic-workload-ratio/ · https://pmc.ncbi.nlm.nih.gov/articles/PMC12487117/
- **RP Hypertrophy app** — every flag ships a one-tap concrete adjustment (add/drop sets,
  deload), never a bare alert. Adopted: the narrow mutation set (§6). https://dr-muscle.com/rp-hypertrophy-app-for-strength-training-expert-review/
- **JITAI literature** — decision rules with receptivity windows, cooldowns, and a nudge
  budget; over-nudging drives muting. Adopted: one advice card/day, per-rule cooldowns,
  severity priority; full delivery-layer redesign deferred (user's option B). https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8943689/ · https://mhealth.jmir.org/2023/1/e38342

## 2. Codebase terrain

Investigator recon (2026-09-03), filtered — the monitoring spine already exists; this design
extends it rather than building a parallel layer:

- **Rules:** `feature/companion/flags/service/FlagEvaluator.java` — 5 deterministic rules
  (`sustained_stress`, `sleep_debt`, `momentum_at_risk`, `recovery_needed`, `all_healthy`),
  every threshold in config (`mezo.companion.flags.*`, `FlagProperties`). Triggers: on-write
  listener (check-in/sleep saves) + hourly `FlagSweepJob` (cron `:05`).
- **Nudges:** `feature/proactive/service/InterventionService.java` — config intervention
  library, one card/day (first-wins), per-key cooldowns, effectiveness-weighted pick,
  deliberately LLM-free. Wired via `FlagRaisedEvent` → `@Async AFTER_COMMIT` listener.
- **Metrics:** `feature/companion/service/MetricSeriesService.java` + `MetricKey` (32 keys
  incl. ACWR, TRAINING_MONOTONY) — the single query abstraction all rules must read through.
- **Freshness:** `feature/proactive/service/LogFreshnessProbe.java` — "is logging stale"
  probe over weight/sleep/check-in/meal; today feeds only the character pipeline. Seed for
  rule (1).
- **Messages/jobs:** `CompanionMessageJob` (05:45/12:30/20:30 crons), `companion_message`
  table (7 kinds), `ProactiveFeedService.getFeed` (deliberately not `@Transactional`).
- **LLM idiom:** pure-code gather → ONE `CompanionLlm` call → defensive parse → bounds-checked
  (model selects, never invents refs); `FakeCompanionLlm` in ITs.
- **Delivery:** notification (Web Push, 22 categories, quiet hours defer-never-drop) and
  appnotification (in-app outbox) — `feature/appnotification` exists *specifically* to break a
  companion↔notification↔proactive cycle.
- **Traps:** frozen ArchUnit `feature_slices_are_cycle_free` + layer subpackages; contract
  drift gate (`api/feature/*/*.yml` first); CODEMAP freshness gate; no `updated_at` on
  `OwnedEntity` (edited logs invisible to freshness logic — only `created_at` observable);
  `flag_key` DB CHECK mirrors `FlagKey` constants; diagnosis quota counts soft-deleted rows;
  workout template rows have nullable `date` (only started instances carry one).

## 3. Architecture (approach C — hybrid)

Three cuts along existing idioms:

1. **Rule spine refactor.** `FlagEvaluator` becomes an orchestrator over one-class-per-rule
   `FlagRule` implementations (the existing 5 migrate unchanged in behavior). All thresholds
   stay in `FlagProperties`-style config. All data reads go through `MetricSeriesService`; new
   `MetricKey`s (available to chat tools for free): `COMBINED_TRAINING_LOAD` (gym + sport,
   RPE×minutes/day), `LAST_MEAL_CLOCK` (last logged meal wall-clock per day),
   `SHOULDER_STRAIN` (sport_session), `WEIGHT_TREND_PCT_WK` (7-day slope as %/week).
2. **Setup checks** (missing sleep goal; plan feasibility) are *not* flags — they are checks
   the daily companion job runs against configuration, emitting a setup card at most weekly
   until the configuration contradicts them (goal row exists / plan fits).
3. **Advice card layer.** The intervention card's successor: deterministic facts + a rich
   suggestion list + up to 2 action buttons whose parameters come from the rule payload; prose
   written by ONE `CompanionLlm` call over the facts (template fallback on LLM failure — the
   card is never dropped). One card/day is kept, but **severity priority** replaces first-wins.

## 4. Round-1 detections (all thresholds config; values below are defaults)

State rules (flag spine — evaluated on write + hourly sweep):

| # | Rule (flag key) | Trigger logic |
|---|---|---|
| 1 | `logging_gap` | no meal row in 36 h / no check-in in 48 h / no sleep log for 2 mornings → one flag carrying the stale-domain list; cooldown 48 h. Generalizes `LogFreshnessProbe`. |
| 5 | sleep-debt data-aware (extends `sleep_debt`) | when logged nights < `min-nights` in the window BUT the logged ones average ≥1 h deficit → the `logging_gap` card gets a "gap + suspicion" variant instead of silence. |
| 3 | `missed_workouts` | ≥2 consecutive planned gym weekdays with no completed workout instance; payload lists the days; the morning companion prompt receives this as a fact (no more blind cheering). |
| 2 | `load_fuel_mismatch` | 7-day `COMBINED_TRAINING_LOAD` above threshold AND (7-day kcal avg < 80 % of target OR 7-day sleep avg < 7 h); honesty gate: ≥4 logged days on each side, else rule (1) owns the story. |
| 10 | `rapid_weight_loss` | `WEIGHT_TREND_PCT_WK` < −0.7 %/week with ≥4 weigh-ins and goal ≠ cut; also embedded as a corroborating fact in (2)'s payload. |
| 8 | `late_eating` | last meal within 90′ of the bedtime anchor or after 22:30 on ≥2 of the last 3 days. |
| 7 | `ignored_nudge` | a nudge category (round 1: `lights_out`) sent ≥5 consecutive days while the behavior never complied (bedtime >60′ later each time) → escalation card: adjust the goal OR one-tap anchor shift; the point is to stop repeating and start a conversation. |
| 14 | `acute_bad_day` | same-day ≥2 check-ins with body ≤3 or energy ≤3 → same-day gentle card; also fed to the evening message prompt. |
| 16 | `joint_overuse` | sport `SHOULDER_STRAIN` 7-day avg ≥5 AND next gym day is shoulder-focused (muscle contains shoulder) → "go lighter" + lighten button. |

Setup checks (daily job, weekly re-emit until resolved):

| # | Check | Logic |
|---|---|---|
| 4 | missing sleep goal | `sleep_goal` empty → "let's set it" card; prerequisite for the anchor-shift action. |
| 6 | plan feasibility | required lights-out = earliest morning obligation − wake buffer − target sleep; evening sport end (slot time + duration + commute buffer) and observed median bedtime vs. that; if the plan misses by >45′, card with plan-level suggestions (later target OR shorter/fewer sessions). **Corrected in S3's whole-branch review (owner decision, bd `mezo-d58h.3`):** the evening sport slot is compared against the morning obligation of the FOLLOWING day (weekday `(D + 1) mod 7`), not the earliest morning anywhere in the week — a Friday-night session has nothing to do with Monday's early gym slot. The observed median bedtime stays day-agnostic (compared against the week's tightest morning), since it is a nightly habit rather than a one-off evening. |

Severity order (highest wins the daily card): acute_bad_day > load_fuel_mismatch >
rapid_weight_loss > joint_overuse > missed_workouts > sleep_debt > logging_gap >
ignored_nudge > late_eating > setup cards > existing round-0 flags.

## 5. Advice card

New `companion_message` kind `advice`; jsonb content:

```json
{
  "facts":       ["…deterministic, numeric, rule-provided…"],
  "prose":       "LLM-written Hungarian text over the facts (or template fallback)",
  "suggestions": ["rich text suggestions — may be several"],
  "actions":     [{"key": "lighten_tomorrow", "label": "…", "params": {…}}],
  "applied":     {"action": "…", "at": "…"} 
}
```

- Action parameters are ALWAYS produced by the deterministic rule; the LLM writes prose only
  and can never invent an action or a number that isn't in `facts` (existing bounds-checked
  idiom).
- Delivery on the existing intervention channel (feed card + push, quiet-hours aware); shows
  in the Today MezoChip thread; keeps the „Segített?" feedback → effectiveness rollup.
- One card/day via severity priority; per-rule cooldowns as configured.

## 6. Mutation set (contract-first, 3 endpoints)

1. **Lighten tomorrow's workout** (train): −1 target set per exercise (min 1) on tomorrow's
   planned workout instance, through the existing prescription-recompute path (`updateBlock`
   recompute idiom).
2. **Skip one sport slot this week** (train): new small `sport_slot_skip` table (slot id +
   date); Today/briefing/feasibility logic respect it.
3. **Shift bedtime anchor** (biometrics): update `sleep_goal.anchor_time` by ±N minutes;
   only offered when a goal row exists (card 4 is its prerequisite).

Each application writes `applied` back onto the card and is idempotent (re-applying is a
no-op returning the applied state). proactive→train and proactive→biometrics dependencies are
acyclic today; ArchUnit cycle-freedom is an explicit checkpoint in the plan.

## 7. Honesty & error handling

- Too little data ⇒ the rule stays silent or says "data gap" explicitly — never estimates.
- LLM failure ⇒ template prose, card still delivered; mutation failure ⇒ card intact, button
  surfaces the error, no partial application.
- Unlogged days are never counted as compliant OR as violating — they route to rule (1).
- All new endpoints follow `200 []`-never-404 and contract-first gates.

## 8. Testing

- Per-rule ITs on the `FlagEvaluatorSleepDebtIT` pattern (fixture days → expected flag/no-flag,
  incl. honesty gates); spine-refactor regression ITs prove the 5 legacy rules unchanged.
- Advice-card IT with `FakeCompanionLlm` (prose parse, fallback path, priority gate).
- Mutation endpoint ITs (apply, idempotent re-apply, precondition failures).
- FE: both modes (mock + live), card render + action buttons + applied state.
- Full suite + ArchUnit + contract-drift on CI (self-PR gate); focused tests locally.

## 9. Slicing

S1 rule-spine refactor + new MetricKeys → S2 rules batch A (1, 5, 3) → S3 setup checks (4, 6)
→ S4 advice card + LLM prose + severity gate → S5 mutations + FE buttons → S6 rules batch B
(2, 10, 8, 7, 14, 16). Each slice: own bd issue, feat branch, self-PR, CI green, --no-ff.

## 10. Deferred (file as bd issues, round 2)

- (9) retro/batch-logging awareness (midday prompts shouldn't trust "nothing eaten today")
- (11) supplement/protocol adherence stop · (12) hydration minimum on training days
- (13) meal-rhythm drift (slots vs. reality, dead dinner slot) · (15) midday energy-dip
  pattern vs. meal timing · (17) feature-abandonment one-time honest question (mind features,
  AI chat) · (18) flat exercise-feedback data-quality one-time question
- Push-noise/delivery redesign (user's option B deferral; beta pref data will inform defaults)
- Ops: investigate the backend deploy CrashLoopBackOff observed 2026-09-03 (pod starts, then
  immediate graceful shutdown — probe suspicion); unrelated to this feature.

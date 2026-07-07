# Proactive Roadmap — the layer that speaks first, phased master plan (B1.1–P2)

> **What this is.** The single durable map for building the **proactive layer** — generated
> briefing, weekly prose, heartbeat, predictions/experiments — in 8 session-sized slices across
> 4 value stages. It is a *roadmap of slices*, not an implementation plan: each slice gets its
> OWN detailed plan (and, where marked, a dated `specs/` decision artifact) in the session that
> builds it. Track live state in **bd** (epic `mezo-h4wp`, one child per slice); read THIS for
> the why/scope/dependencies of each slice. Design spec (read FIRST):
> [`../specs/2026-07-06-proactive-layer-design.md`](../specs/2026-07-06-proactive-layer-design.md).
>
> **How to carry it forward in a fresh session (the handoff contract):**
> ```
> Olvasd el docs/superpowers/specs/2026-07-06-proactive-layer-design.md-t
> és docs/superpowers/plans/2026-07-06-proactive-roadmap.md §<SLICE>-t
> (+ docs/features/proactive.md-t, ha már létezik), aztán bd show <bd-id>,
> claim, implementáld. Végén: kapuk zölden, feature-doc frissítés, push, close.
> ```
> `bd ready` shows the next unblocked slice.

**Driving principles (decided 2026-07-06):**

- **Flagship-first** — B (the generated morning briefing) is v1 and ships alone; everything else
  layers after it. v1 exit criterion: *Daniel opens the phone in the morning and the companion
  writes about HIS night and HIS day — zero demo copy.*
- **Reuse by call, not copy** — every generator composes the SHIPPED companion stack
  (`CompanionLlm` port, `ContextSnapshotAssembler`, `daily_summary`, facts block, patterns);
  proactive → companion + others, one-way (ArchUnit).
- **Deterministic-first, LLM at the edges** — gather/staleness/validation logic is pure code,
  tested without any LLM; each generation is ONE port call with strict-JSON output; refs/anchors
  are code-collected and model-selected, never model-invented.
- **Cheap daily, smart weekly** — Flash for briefing/heartbeat, Pro for weekly narratives
  (suggestion, memoir, predictions, experiment proposals); tier per generator is config.
- **Hybrid freshness** — early cron pre-generates (idempotent catch-up = backfill), on-open GET
  reads instantly, lazy fallback covers a missed cron, key-input arrival triggers a capped regen.
- **Honest states everywhere** — null confidence = „tanulom"; failed generation = honest absence;
  switch off = the app is fully usable without the layer.
- **Session-sized slices** — the proven companion size. If a slice needs two branches, split it.

**Where we are (2026-07-06).** Phase 2 closed (2026-07-05): every real-mode surface is honest.
The companion epic (`mezo-fnnq`, all 14 slices) is live on k3s. The landing zones: Today's
briefing card is static prose behind a „Demo tartalom" label (`briefingDemo: true`); Insights
Weekly renders *"A társ heti tervjavaslata hamarosan."*; Memoir/Predictions/Experiments are
real-mode ghosts (`PHASE3_TAB_IDS` + per-page `PhaseTeaserCard` guards); `prediction`/
`volleyballNote` are null in real mode. PWA manifest + service worker exist (vite-plugin-pwa);
**no push subscription infra**. No `feature/proactive` package, no proactive tables.

**Out of this epic (spec §1):** vulnerable/niggle real sources, AnchorMode real triggers, crisis/
drift detection, opportunity scanner, identity-anchor, anniversary automation, PERMA entities —
later epics. **Fuel P8 (`mezo-0h6w`) stays separate** (cross-referenced; it reuses the same stack
and this layer's generator conventions when its own mapping session runs).

---

## Slice brief format

**Goal · Builds · Out/deferred · Backend · FE · Depends on · Size · Open decisions · bd.**
Every slice implicitly includes: contract-first (`api/feature/proactive/proactive.yml`),
Liquibase `{ts}_{bd-id}_{desc}.sql`, ITs (populators + `ResetDatabase` TRUNCATE for new tables,
fake-port generators), dual-mode FE gates where hooks change, feature-doc update
(`docs/features/proactive.md` + the touched surface docs), lint-docs, milestone row.

---

## B — „megszólal reggel" (v1, the flagship)

### B1.1 — Proactive skeleton + briefing spine ✅ (shipped 2026-07-06)

**Goal:** the layer exists and a briefing can be generated + read — the spine everything hangs on.
**Builds:** `feature/proactive/` package born; `mezo.feature.proactive.enabled` switch +
`@Validated ProactiveProperties` (`mezo.proactive.*`); `briefing` table (content = typed jsonb
envelope mirroring the FE `Briefing`; partial unique per user+date, regenerate = soft-delete +
insert); `BriefingGenerator` — pure-code gather (snapshot render + last-7d `daily_summary` +
facts block + today's plan + code-collected ref candidates) → ONE cheap-tier `CompanionLlm` call
(strict JSON `{eyebrow, body[], refIndexes[]}`; the model selects refs by index, never invents) →
persisted row; new contract fragment `api/feature/proactive/proactive.yml`:
`GET /api/proactive/briefing?date=` with lazy synchronous generation when no row exists.
**Out/deferred:** cron + staleness (B1.2); any FE change.
**Backend:** entities/repo/service/controller per house layout; `BriefingPopulator` +
`ResetDatabase`; ITs with the fake port asserting gather content, ref selection, persistence,
ownership isolation. **Living doc `docs/features/proactive.md` is born in this slice.**
**FE:** none yet.
**Depends on:** nothing (companion stack shipped). **Size:** M/L.
**Open decisions:** envelope fields (tone? confidence?); sleep-first-triage prompt wording;
lazy-path latency budget.
**bd:** `mezo-h4wp.1`.

### B1.2 — Briefing cron + hybrid freshness + FE swap ✅ (shipped 2026-07-06)

**Goal:** the flagship goes live — the phone shows the companion's own morning words, zero demo copy.
**Builds:** `BriefingJob` (early cron, `mezo.techcore.cron.briefing-job.enabled` +
`mezo.proactive.briefing.cron`; idempotent catch-up = backfill, per-user/per-date failures
isolated — the `DailySummaryJob` idiom); staleness rule: a key input (last night's `sleep_log`)
arriving after `generated_at` ⇒ the next GET regenerates once (daily regen cap, config); FE swap:
`useToday().briefing` dual-mode — real mode reads the GET, renders generated prose + REAL ref
chips, `briefingDemo: false` (the „Demo tartalom" label drops); mock keeps the Phase-1 statics +
`briefingVariants` untouched; honest degraded state when the switch is off / generation failed.
**Out/deferred:** heartbeat windows (H1); push (H2).
**Backend:** job + staleness service (pure, unit-tested); regen cap config.
**FE:** `todayHooks.ts` briefing path + `BriefingCard` real refs; both modes green;
`today.md` update.
**Depends on:** B1.1. **Size:** L.
**Open decisions:** staleness trigger list + cap value; switch-off card treatment (labelled
static vs trimmed honest card); cron time (before typical wake).
**bd:** `mezo-h4wp.2`. **v1 exit criterion lives here.**

---

## W — „ír rólam hetente"

### W1 — weeklySuggestion prose ✅ (shipped 2026-07-06)

**Shipped as built:** `weekly_suggestion` table (ISO-Monday `week_start`, partial unique) +
smart-tier `WeeklySuggestionGenerator` (pure-code gather = V0.3 snapshot + facts + the prior week's
`daily_summary` narratives strictly before `week_start` + the pattern list → ONE
`CompanionLlm.completeSmart` call → plain HU prose, honest-null on empty prior week/blank answer) +
`WeeklySuggestionJob` (Monday 06:00, `mezo.proactive.weekly.cron`, three-switch, current-week only,
idempotent, no backfill) + lazy `GET /api/proactive/weekly-suggestion?date=` (404 = the FE's honest
placeholder). FE: `useWeekly().weeklySuggestion` real (404→null) — the D′ null-path became the
degraded path — and the inert „Elfogad/Hangoljuk" buttons hidden in live mode. **In-slice decisions
resolved:** cron = Monday 06:00 (suggestion FOR the starting week, gathered from the finished
previous week); buttons **hidden** (not just inert) in live; **NO** weekly staleness/regen (weekly
cadence, YAGNI); D′ score-constants promotion **deferred** to a follow-up bd issue (not in-slice).
Docs: `docs/features/proactive.md` (§1-§10) + `docs/features/insights.md` (§2.2/§4/§9). **bd:**
`mezo-h4wp.3`.

**Goal:** the Weekly page's "Mezo · heti tervjavaslat" card stops being a placeholder.
**Builds:** `weekly_suggestion` table; weekly smart-tier generator over the week's
`daily_summary` narratives + the D′ deterministic weekly metrics (the same reads `useWeekly`
composes); weekly cron (day/time config, catch-up); `GET /api/proactive/weekly-suggestion`;
FE: `useWeekly().weeklySuggestion` real in real mode (the D′ null-path becomes the degraded
path); `insights.md` update.
**Out/deferred:** accept/tune interactivity (the „Elfogad / Hangoljuk" buttons stay inert or
hidden — in-slice decision); promoting the D′ FE score constants to backend config (do it here
if cheap — `insights.md` §9 flags it — else file follow-up).
**Depends on:** B1.1 (skeleton). **Size:** M.
**Open decisions:** cron day/time (Sunday evening vs Monday early); buttons inert vs hidden.
**bd:** `mezo-h4wp.3`.

### W2 — Memoir ✅ (shipped 2026-07-06)

**Shipped as built:** `memoir` table (ISO-Monday `week_start`, `title`/`body`, typed-jsonb `anchors`
envelope `MemoirAnchorsEnvelope{List<Anchor(kind,label)>}`, partial unique) + smart-tier
`MemoirGenerator` (pure-code gather = the week's OWN `daily_summary` narratives `[weekStart,
weekStart+6]` + facts + patterns + numbered anchor candidates → ONE `CompanionLlm.completeSmart` call
→ strict-JSON `{title, body, anchorIndexes}`, model-SELECTED bounds-checked/deduped anchors,
honest-null on empty week / unusable answer) + `MemoirJob` (Sunday 19:00 `mezo.proactive.memoir.cron`,
three-switch, the week ENDING that Sunday, idempotent, no backfill) + `ProactiveMemoirService` (latest
row, else lazy-generate the LAST COMPLETED week `previousOrSame(MONDAY).minusWeeks(1)`) + lazy
`GET /api/proactive/memoir` (NO params; 404 = the FE's honest „készül" state). FE: `useMemoir()` real
(404→null), `memoir` left `PHASE3_TAB_IDS`, `MemoirPage` `PhaseTeaserCard` guard dropped, real memoir
+ derived `Hét N …` label + anchor RefTags, else the honest null-state; reactions + anniversary +
archive **mock-only** (unpersisted = false affordance, the W1 button precedent). **In-slice decisions
resolved:** cron = Sunday 19:00 (memoir for the week ending that Sunday — Sunday's own summary is born
next dawn, accepted); lazy fallback = the LAST COMPLETED week (different window from the cron, by
trigger); reactions **mock-only v1** (persisted reactions as a companion signal = a follow-up bd issue
the controller files at close-out); anniversary card + archive footer mock-only (deferred epic); the
`[fake-memoir:{…}]` sentinel rides a daily-summary NARRATIVE (the memoir gather has no snapshot, so the
check-in-note channel is unavailable); marker `"HETI-MEMOIR-FELADAT"` prefix-collision-checked. **NO
temp stub ever existed** (the W1 lesson — Task 1 shipped the real read). Docs: `docs/features/proactive.md`
(§1-§10) + `docs/features/insights.md` (§1/§2.3/§3/§4/§9/§10). **bd:** `mezo-h4wp.4`.

**Goal:** the companion writes the week's story — the first ghost tab un-ghosts.
**Builds:** `memoir` table (week_start, title, body, anchors jsonb); Sunday smart-tier generator
(old journey 5.8 distilled: the week's real entities + pattern hits + fact updates → one
narrative; anchors code-collected, model-selected); `GET /api/proactive/memoir` (latest; archive
later); FE: MemoirPage real dual-mode — drop `memoir` from `PHASE3_TAB_IDS`, remove the page
guard, render the real memoir + anchor RefTags; mock keeps the demo.
**Out/deferred:** memoir archive (footer stays inert); anniversary card (deferred epic);
`MemoirCapsule`/quarterly forms (out, spec §1).
**Depends on:** W1 (shares the weekly cron pattern; soft). **Size:** L.
**Open decisions:** reactions persist vs stay local; how many weeks back the generator may
catch up.
**bd:** `mezo-h4wp.4`.

---

## H — „napközben is jelen van"

### H1 — In-app heartbeat ✅ (shipped 2026-07-07)

**Shipped as built:** `heartbeat_note` table (user+day+`window_key` partial unique; `window_key` NOT
`window` — reserved word; kind `nudge`/`closing` CHECK-pinned) + **cheap-tier** `HeartbeatGenerator`
(gather = snapshot + facts + latest daily summary + today's-briefing `MAI BRIEFING (ne ismételd)`
dedupe block + `ABLAK:` window instruction → ONE `complete` call, honest-null on empty narrative
memory / blank answer) + `HeartbeatJob` (TWO `@Scheduled` methods: `midday-cron` 12:30 nudge +
`evening-cron` 20:30 closing, ONE third switch `heartbeat-job.enabled`, today-only, no backfill) +
lazy `GET /api/proactive/heartbeat?date=` (day's latest note; for TODAY the latest already-elapsed
window generates on a miss — fire-times derived from the SAME crons via Spring `CronExpression`;
past dates never generate). FE: `useCompanionNote()` dual-mode (mock always null — Phase-1 parity)
+ **`CompanionNoteCard`** on Today under the check-in strip; honest absence = no card. **In-slice
decisions resolved:** two explicit config windows (no dynamic list — YAGNI); briefing dedupe =
prompt-level block; NO staleness/regen; emptiness gate reuses `briefing.past-days`; component named
`CompanionNoteCard` (the check-in strip owns the "Heartbeat" copy). Docs:
`docs/features/proactive.md` (§1-§10) + `docs/features/today.md` (§2/§3/§10). Plan:
[`2026-07-07-proactive-h1-heartbeat.md`](2026-07-07-proactive-h1-heartbeat.md). **bd:** `mezo-h4wp.5`.

**Goal:** the companion is present during the day, not only at dawn — in-app first.
**Builds:** `heartbeat_note` table (date, window, kind `nudge`/`closing`, content);
window-scheduled cheap-tier generation (config window list, e.g. midday + evening close;
grounded in the day's actual state: fuel-day progress, planned-vs-done training, check-ins);
`GET /api/proactive/heartbeat?date=`; FE: a new Today card rendering the current window's note
(honest absence otherwise). ⚠️ the check-in strip already uses the "Heartbeat" name in copy —
the new component needs a distinct name (e.g. `CompanionNoteCard`).
**Out/deferred:** push delivery (H2); opportunity-scanner-style lookahead (deferred epic).
**Depends on:** B1.2 (the briefing covers the morning slot of the IDENT-3 rhythm). **Size:** L.
**Open decisions:** window list (count/times); overlap-dedupe with the briefing; component name.
**bd:** `mezo-h4wp.5`.

### H2 — Web Push infra

**Goal:** the heartbeat reaches Daniel with the app closed.
**Builds:** VAPID keypair (SealedSecret on k3s — coordinate `docs/infrastructure/`);
`push_subscription` table + subscribe/unsubscribe endpoints; service-worker push handler (the
vite-plugin-pwa SW exists; add the push event path); opt-in toggle in the FE; push delivery of
heartbeat notes (+ briefing-ready); iOS installed-PWA constraints documented.
**Out/deferred:** notification preferences UI beyond a single opt-in; quiet hours (config only).
**Depends on:** H1 (content proven first). **Size:** L (infra-heavy).
**Open decisions:** Java web-push library; opt-in UX placement; retry/expiry handling for dead
subscriptions.
**bd:** `mezo-h4wp.6`.

---

## P — „előre lát"

### P1 — Predictions + validation ✅ (shipped 2026-07-07)

**Shipped as built:** `prediction` table (non-unique `week_start` idempotence probe, nullable
`confidence`, CHECK-pinned `expected_direction`/`status`, code-set `valid_from`/`valid_to`) +
**smart-tier** `PredictionGenerator` (gather = V0.3 snapshot + facts + numbered CONFIRMED-pattern
candidates + a fixed 3-key metric catalog → ONE `completeSmart`, strict-JSON `{predictions:[{title,
basis, patternIndex, metricKey, expectedDirection}]}`, **code-set windows**, **pattern-copied
confidence** — null = „tanulom", never invented — catalog/enum validation drops unvalidatable rows,
`max-per-week` cap, empty-list on zero confirmed patterns) + **deterministic**
`PredictionValidationService` (window avg/count vs the prior 7 days, epsilon-banded direction,
no-data ⇒ stays pending — LLM-free) + `PredictionJob` two crons (`runWeekly` Mon 06:30 + `runValidation`
daily 06:15, one third switch `prediction-job.enabled`) + list `GET /api/proactive/prediction` (lazy
current-week; **`200 []` = honest empty, never 404**). FE: `usePredictions()` dual-mode (list;
`[]`→still-learning null-state) + `PredictionsPage` un-ghost („tanulom" on null confidence, `✗ Missed`
state, accuracy header derived from closed rows; mock keeps the Phase-1 literal), `predictions` left
`PHASE3_TAB_IDS` (only Experiments hidden now). **In-slice decisions resolved:** metric catalog =
3 deterministic keys (`weight_trend`/`sleep_avg`/`training_volume`, epsilon-banded); window = the
generation week, closed by the daily run, no-data ⇒ pending; grounding gate = CONFIRMED patterns only;
confidence COPIED from the pattern (statistical ⇒ null); list read returns `[]` not 404. Deviations
from the spec §3 row: added `week_start` (idempotence) + `expected_direction` (the machine-checkable
claim). The `[fake-prediction:{…}]` sentinel is GREEDY (nested payload). Docs: `docs/features/proactive.md`
(§1-§10) + `docs/features/insights.md` (§1/§2/§2.6/§3/§8/§9/§10). Plan:
[`2026-07-07-proactive-p1-predictions.md`](2026-07-07-proactive-p1-predictions.md). **bd:** `mezo-h4wp.7`.

**Goal:** the Predictions tab stops being fiction — pattern-grounded forecasts that get judged
against reality.
**Builds:** `prediction` table (title, basis, nullable confidence, status
`pending`/`validated`/`missed`, validation window + metric key, actual); weekly smart-tier
generation grounded in CONFIRMED patterns + next-week context (schedules, meso week, Reta
cycle); a validation job evaluating closed windows deterministically where possible;
`GET /api/proactive/prediction`; FE: PredictionsPage real dual-mode (un-ghost: drop from
`PHASE3_TAB_IDS` + guard), „tanulom" for null confidence; the mock's hard-coded accuracy header
goes honest (derived or absent).
**Out/deferred:** prediction-driven briefing lines (a later polish); CausalChain entities (out).
**Depends on:** B1.1 (skeleton); patterns shipped ✅. **Size:** L.
**Open decisions:** metric-key catalog v1; window-close semantics; who judges soft outcomes
(deterministic vs L2 ask).
**bd:** `mezo-h4wp.7`.

### P2 — N=1 experiments ✅ (shipped 2026-07-07 — the epic closes)

**Shipped as built:** `experiment` table (proposed→active→completed \| dismissed lifecycle, nullable
`start_date`/`outcome_good`, `@Pattern`+CHECK guards) + **smart-tier** `ExperimentProposalGenerator`
(the PredictionGenerator idiom — CONFIRMED-pattern-grounded, open-cap-gated, `clampDays` to
`[min,max]`) + **deterministic** `ExperimentOutcomeService` (reusing the NEW shared
`MetricWindowEvaluator` extracted from `PredictionValidationService`) + a **WRITE path**:
`POST /api/proactive/experiment/{id}/decision` (L2 accept→active/dismiss, fetch-owned-or-404 → **409**
on non-proposed → mutate, the companion `PatternService.decide` idiom) + `POST …/propose` (the "+ Új
kísérlet javasol Mezo" button, now REAL) + list `GET` (lazy propose, `200 []` = honest, never 404) +
`ExperimentJob` two crons (`runPropose` Mon 06:45 + `runOutcome` daily 06:20, one third switch). FE:
`useExperiments()` + `useExperimentActions()` (the pattern-decision `useMutation`+`invalidateQueries`
idiom) + `ExperimentsPage` un-ghost (proposed→Elfogadom/Elvetem, active→progress, completed→outcome
chips; real propose CTA), `experiments` left `PHASE3_TAB_IDS` (**now EMPTY — all 7 tabs real**).
**In-slice decisions resolved:** propose trigger = cron + button; open-cap (3) bounds both; lifecycle
guards (409 on re-decide); outcome_good nullable (inconclusive = no data); dismissed excluded from the
list; `MetricWindowEvaluator` DRY-shared with P1 (P1 ITs guard the refactor). The `[fake-experiment:{…}]`
sentinel is GREEDY. Docs: `docs/features/proactive.md` (§1-§10, status→**complete**) +
`docs/features/insights.md` (all 7 tabs real). Plan:
[`2026-07-07-proactive-p2-experiments.md`](2026-07-07-proactive-p2-experiments.md). **bd:** `mezo-h4wp.8`.
**This slice closes the proactive epic — only H2 (Web Push) remains deferred.**

**Goal:** the companion proposes experiments on Daniel's own data; he accepts with one tap; the
system tracks and evaluates.
**Builds:** `experiment` domain (hypothesis, status `proposed`/`active`/`completed`/`dismissed`,
start + total days, outcome + outcome_good); smart-tier proposal generation (from
patterns/predictions); **L2 accept** — `POST /api/proactive/experiment/{id}/decision`; day
counter + metric tracking over existing reads; outcome evaluation (deterministic core + prose
summary); FE: ExperimentsPage real dual-mode (un-ghost), the „+ Új kísérlet javasol Mezo" button
becomes the propose trigger (or cron-only — in-slice decision).
**Out/deferred:** multi-arm experiments; experiment-sourced facts (wire to the V3.3 promotion
family later).
**Depends on:** P1 (shares grounding + generation cadence; soft). **Size:** L/XL — split into
proposal+accept / tracking+outcome if it outgrows a session.
**Open decisions:** lifecycle rules (close conditions, what counts as confirmed); propose trigger.
**bd:** `mezo-h4wp.8`.

---

## Dependency graph (quick reference)

```
B1.1 ─► B1.2 ─► H1 ─► H2
   ├──────────► W1 ─► W2
   └──────────► P1 ─► P2
```

Suggested value order: **B1.1 → B1.2 → W1 → W2 → H1 → P1 → P2 → H2** (W/H/P are
parallel-friendly after B1.1; H2 is pure delivery infra and can slide to the end).

## Relationship to other roadmaps

- **Companion (`mezo-fnnq`, ✅ complete)** — the substrate; this epic only READS its services and
  follows its conventions (port, fake-LLM tests, cron idiom, honest-null).
- **Fuel P8 (`mezo-0h6w`)** — separate umbrella, unchanged; its mapping session should read this
  roadmap's generator conventions first.
- **Phase 2 completion (`mezo-t16y`, ✅)** — this epic resolves every surface that roadmap marked
  ⛔ *proactive epic*: the briefing „Demo tartalom" label, the Weekly suggestion placeholder, the
  three ghost tabs.
- **Deferred-signals epic (future, unmapped)** — vulnerable/niggle real sources, AnchorMode real
  triggers, crisis/drift, opportunity scanner, identity-anchor, anniversaries; map it
  companion-style when this epic's B+H stages prove the delivery rhythm.

## Per-slice execution checklist (when you start a slice)

1. `bd update <slice-id> --claim`; read the spec + this roadmap §slice (+
   `docs/features/proactive.md` if born). L-sized slice → dated `docs/superpowers/plans/`
   implementation plan (superpowers:writing-plans) before code.
2. Contract-first: edit `api/feature/proactive/proactive.yml` BEFORE code; merge
   (`api/generate`); regen FE (`pnpm generate:api`) + BE types.
3. TDD per `docs/references/`: integration-first, populators, `ResetDatabase` TRUNCATE growth,
   AssertJ; **LLM always behind the port with the profile-gated fake — no network in tests**.
4. Dual-mode FE where the slice touches hooks: signatures stable, both modes green + `pnpm build`.
5. Update `docs/features/proactive.md` (+ `today.md`/`insights.md` where the surface changed) +
   `docs/milestones/roadmap.md` milestone row; `node scripts/lint-docs.mjs`.
6. One bd issue + one `feat/proactive-<slice>` branch; `--no-ff` merge (`git pull --rebase`
   BEFORE the merge, never after); `bd dolt push && git push`; close the slice issue with notes.

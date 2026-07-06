# Proactive Layer — design spec (B/W/H/P)

- **Date:** 2026-07-06
- **Status:** accepted (point-in-time design artifact)
- **Driver:** bd `mezo-h4wp` (epic) · roadmap: [`../plans/2026-07-06-proactive-roadmap.md`](../plans/2026-07-06-proactive-roadmap.md)
- **Sources:** the shipped companion stack ([`../specs/2026-07-03-phase3-companion-chat-design.md`](2026-07-03-phase3-companion-chat-design.md) + [`docs/features/companion.md`](../../features/companion.md)) and the old Supabase-era docs' proactive sections ([`../../old docs/mezo-prd.md`](../../old%20docs/mezo-prd.md) §5.1/5.8, FR-1.3.x — distilled here; slice sessions read THIS, not the old docs).

## 1. Product goal — the pain this kills

The app still greets Daniel with **static demo prose every morning**: the Today briefing card is
hand-authored copy behind a „Demo tartalom" label, the Insights Weekly suggestion is an honest
placeholder, and Memoir/Predictions/Experiments are hidden ghosts — even though the companion
stack already knows everything about his day (snapshot, facts, summaries, patterns — all live).
The proactive layer makes the companion **speak first**:

- **B — „megszólal reggel":** a generated morning briefing about *his* night and *his* day.
- **W — „ír rólam hetente":** the weekly suggestion prose + the memoir become real narratives.
- **H — „napközben is jelen van":** in-app heartbeat notes (IDENT-3), later delivered via Web Push.
- **P — „előre lát":** pattern-grounded predictions with outcome validation + companion-proposed
  N=1 experiments.

This epic owns **every prose/LLM item Phase 2 marked ⛔** *except* the ones explicitly deferred below.

**Explicitly deferred to later epics** (decision 2026-07-06, this spec — the companion-spec §1 pattern):

- **Real-signal reactivity:** `vulnerable`/`niggle` real sources, AnchorMode triggered by real
  signals (A/D subdivision), crisis detection (old NFR-CR-8), drift detection + opportunity
  scanner, identity-anchor mirroring, anniversary automation, PERMA/life-context entities.
  The Today URL-param demo controls stay the only AnchorMode trigger for now.
- **Fuel P8 (`mezo-0h6w`) stays a separate umbrella** — meal-score prose, AI replan, stack
  recommendations, learned timing. It reuses the same stack (LLM port tiers, patterns,
  embeddings) but is a Fuel-domain surface; it gets its own mapping session. This spec only
  fixes the seam: P8 consumes the proactive layer's *conventions* (generator-behind-port,
  strict-JSON, honest-null), not its tables.
- **Old Phase-7 motivation system** (RecoveryCapital/IdentityStage/MemoirCapsule/QuarterlyMemoir…)
  — unchanged: out, pending the anti-XP reconciliation ADR.

## 2. Target architecture

**New backend feature package `feature/proactive/`** + contract fragment
`api/feature/proactive/proactive.yml` (tag `Proactive`) + its own switch
**`mezo.feature.proactive.enabled`** (+ `@Validated ProactiveProperties` under `mezo.proactive.*`).
Turning it on presupposes the companion switch — every generator calls the `CompanionLlm` port.

**Coupling is one-way and reuse is by call, not copy:** proactive → companion + other features
(no cycle; ArchUnit-guarded like companion → others):

| Reused (all shipped, all live) | For |
|---|---|
| `CompanionLlm` port, cheap + smart tiers (ADR 0008) | every generation; tier per policy below |
| `ContextSnapshotAssembler` (V0.3) | the "today" block of the briefing gather |
| `daily_summary` reads (V2.2) | past-narrative blocks (briefing last-7d, weekly prose) |
| `KnowledgeFactService.renderPromptBlock` (V1.1) | personalisation in every generator prompt |
| `pattern` reads (V3.1–3.3) | prediction grounding; experiment proposals |
| cron idiom: `mezo.techcore.cron.*` switch + idempotent catch-up (`DailySummaryJob`) | every proactive job |

**Model-tier policy (decided):** cheap tier (Flash) for daily generations (briefing, heartbeat),
smart tier (Pro) for weekly narratives (weekly suggestion, memoir, predictions, experiment
proposals). Tier per generator is config, not code.

**Generation timing (decided — hybrid):** an early-morning cron pre-generates (idempotent
catch-up = the backfill, per the `DailySummaryJob` idiom); the app-open `GET` returns the
persisted row instantly; a lazy fallback generates synchronously when the cron missed; when a
key input (e.g. last night's `sleep_log`) arrives AFTER `generated_at`, the next `GET`
regenerates once (daily regen cap — config).

## 3. Data model (new tables; house rules — UUID PK, `created_by`, soft delete, Liquibase `{ts}_{bd-id}_{desc}.sql`)

| Table | Slice | Fields (essence) |
|---|---|---|
| `briefing` | B1.1 | `briefing_date`, `content` jsonb (typed envelope mirroring the FE `Briefing`: eyebrow, body paragraphs, refs), `generated_at`; **partial unique** (created_by, briefing_date) where live — regenerate = soft-delete + insert (the `daily_summary` precedent) |
| `weekly_suggestion` | W1 | `week_start`, `prose` text |
| `memoir` | W2 | `week_start`, `title`, `body` text, `anchors` jsonb (RefTag shape) |
| `heartbeat_note` | H1 | `note_date`, `window` (config key), `kind` (`nudge`/`closing`), `content` text |
| `push_subscription` | H2 | `endpoint`, `keys` jsonb, `user_agent` |
| `prediction` | P1 | `title`, `basis` text, `confidence` (nullable!), `status` (`pending`/`validated`/`missed`), validation window (`valid_from`/`valid_to` + metric key), `actual` text |
| `experiment` | P2 | `title`, `hypothesis`, `status` (`proposed`/`active`/`completed`/`dismissed`), `start_date`, `total_days`, `outcome` text, `outcome_good` |

jsonb columns are typed embedded objects (`@JdbcTypeCode(SqlTypes.JSON)`, the `ProvenanceEnvelope`
precedent). **No fabricated values** anywhere: a prediction without statistical grounding carries
`confidence = null` → the FE renders „tanulom", never an invented number.

## 4. The briefing pipeline (B — the heart of the epic)

```
hajnali cron  BriefingJob  (mezo.techcore.cron.briefing-job.enabled, time = mezo.proactive.briefing.cron)
  gather (PURE CODE, LLM-free, unit-testable):
    snapshot = ContextSnapshotAssembler.render(userId, today)        — the "now" block
    past     = last-7d daily_summary narratives                       — the trend voice
    facts    = KnowledgeFactService.renderPromptBlock(userId)         — personalisation
    plan     = today's Train session + gym slot + Fuel targets + retaDay/phase
    ref candidates = code-collected {kind,id} refs of every block included
  → ONE cheap-tier CompanionLlm call (BRIEFING_MARKER prompt; strict JSON out:
      {eyebrow, body[], refIndexes[]} — the model SELECTS refs from the offered
      candidates by index; it can never invent a ref)
  → persist briefing row (typed jsonb envelope)
GET /api/proactive/briefing?date=today
  → no row          ⇒ synchronous lazy generation (the catch-up IS the fallback)
  → row, but a key input (sleep_log for the night) arrived after generated_at
                    ⇒ regenerate once (soft-delete + insert; daily regen cap)
  → return the persisted briefing
```

Old-PRD requirements distilled into the prompt contract: **sleep-first triage** (FR-2.1.1 — poor
sleep is named as the day's primary factor before anything else), multi-horizon (today + the
7-day trend), 2–3 actionable micro-focus items, Reta-phase context. Generation must stay under
the old NFR-P-2 spirit (fast enough for the lazy path; measure in-slice).

**FE swap (B1.2):** `useToday().briefing` goes dual-mode — real mode reads the GET, renders the
generated prose + **real ref chips**, and drops the „Demo tartalom" label (`briefingDemo: false`).
The mock seed + `briefingVariants`/`resolveBriefing` dayState-merging stay **mock-only**; real
mode returns the server briefing as-is. Switch-off / degraded keeps an honest state (in-slice
decision: retain the current labelled static card vs a trimmed honest card — never silent).

## 5. The other surfaces (W / H / P)

- **W1 weeklySuggestion:** weekly smart-tier cron over the week's `daily_summary` narratives +
  the D′ deterministic weekly metrics (the same reads `useWeekly` composes). Resolves the
  WeeklyPage's *"A társ heti tervjavaslata hamarosan."* placeholder. The „Elfogad / Hangoljuk"
  buttons stay inert or hidden in v1 (in-slice decision).
- **W2 memoir:** Sunday-evening smart-tier narrative (old journey 5.8): title + body + anchors
  referencing the week's REAL entities (anchor refs code-collected, LLM-selected — the briefing
  ref rule). The Insights **Memoir tab un-ghosts** in real mode (drop from `PHASE3_TAB_IDS` +
  remove the page guard). Reactions persist-or-stay-local: in-slice decision. Anniversary card +
  archive footer stay demo/deferred.
- **H1 in-app heartbeat:** cron-written, time-window-aware notes (e.g. midday nudge + evening
  close — window list is config) grounded in the day's actual state (fuel-day progress, planned
  vs done training, check-ins). Surfaced as a new card on Today. Together with the briefing this
  delivers the IDENT-3 rhythm (≥3 touches/day) **in-app first**. ⚠️ Naming: the Today check-in
  strip is already called "Heartbeat" in copy — the new surface needs a distinct component name
  (e.g. `CompanionNoteCard`); settle in-slice.
- **H2 Web Push:** the delivery channel on top of proven content — VAPID keys (SealedSecret on
  k3s), `push_subscription` + subscribe endpoint, service-worker push handler (the PWA
  manifest/SW already exist via vite-plugin-pwa; no push subscription today), an opt-in toggle,
  iOS-installed-PWA caveats documented. Push sends the heartbeat/briefing-ready notes.
- **P1 predictions:** weekly generation grounded in CONFIRMED patterns + next-week context
  (schedules, meso week, Reta cycle). Every prediction carries an explicit validation window +
  metric; a job evaluates closed windows deterministically where possible → `validated`/`missed`
  + `actual`. `confidence` comes from the underlying pattern's stats or is null („tanulom").
  The Insights **Predictions tab un-ghosts**.
- **P2 N=1 experiments:** the companion proposes an experiment (smart tier, from
  patterns/predictions) → explicit **L2 accept** (`POST .../experiment/{id}/decision`) → day
  counter + metric tracking over existing reads → outcome evaluation (deterministic core + prose
  summary). The Insights **Experiments tab un-ghosts**; the „+ Új kísérlet javasol Mezo" button
  becomes the propose trigger (or stays cron-only — in-slice decision).

## 6. Guardrails carried over (non-negotiable, all inherited from the companion spec §6)

- **No fabricated numbers/confidence** — null = „tanulom"; refs/anchors are code-collected and
  model-SELECTED, never model-invented.
- **Clinical guard** in every generator prompt (no Rx dose suggestions — Reta!).
- **IDENT-2 internal sphere** — proactive writes only its own tables and (H2) pushes to the
  user's own device; no outward-acting integration, ever.
- **IDENT-3 never silent, honestly** — every surface has an explicit degraded/absent state; a
  failed generation renders honest absence, never a broken screen or stale-as-fresh content.
- **Switch-gated + LLM-free tests** — everything behind `mezo.feature.proactive.enabled`;
  generators tested with the profile-gated fake port (scripted strict-JSON answers); all gather/
  staleness/validation logic is pure code, tested without any LLM.
- **Hook-signature stability** — every FE swap keeps the hook's returned shape; both FE test
  modes green.

## 7. Open decisions → where they get decided

| Decision | Where |
|---|---|
| Briefing content envelope fields (tone? confidence?) + real-mode `resolveBriefing`/variant semantics | B1.1 |
| Staleness triggers (which inputs; regen cap/day) + switch-off BriefingCard treatment | B1.2 |
| Weekly cron day/time; „Elfogad/Hangoljuk" inert vs hidden | W1 |
| Memoir reactions persist vs local; anniversary card handling | W2 |
| Heartbeat window list (count/times); overlap-dedupe with the briefing; surface component name | H1 |
| Java web-push library; iOS PWA constraints; opt-in UX placement | H2 |
| Prediction validation semantics (metric keys, window close, who judges soft outcomes) | P1 |
| Experiment lifecycle (propose trigger, close rules, what counts as confirmed) | P2 |

## 8. Slice map (see roadmap for full briefs)

**B „megszólal reggel" (v1):** B1.1 skeleton + briefing spine → B1.2 cron + hybrid freshness + FE swap.
**W „ír rólam hetente":** W1 weeklySuggestion prose → W2 memoir.
**H „napközben is jelen van":** H1 in-app heartbeat → H2 Web Push infra.
**P „előre lát":** P1 predictions + validation → P2 N=1 experiments.

After B1.2 the flagship is live (v1 exit criterion: *Daniel opens the phone in the morning and
the companion writes about HIS night and HIS day — zero demo copy*). W/H/P are parallel-friendly
after B1.1. Living doc born at B1.1: `docs/features/proactive.md`; updates ripple into
`today.md` (briefing, heartbeat card) and `insights.md` (Weekly suggestion, un-ghosted tabs).

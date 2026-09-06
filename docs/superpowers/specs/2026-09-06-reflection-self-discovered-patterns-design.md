# Reflexió — Mezo saját észrevételei, hipotézis-életciklus, Észrevételek fül — Design

**Date:** 2026-09-06 · **Status:** approved in brainstorm, pending spec review

**Driver:** `mezo-eq85` (epic; six slices `mezo-eq85.1` … `mezo-eq85.6`, to be created by the plan)

**Builds on:** `2026-09-04-shared-rag-memory-platform-design.md` (`mezo-6dii`, slices .1–.8 on
main, .9 in draft PR #499), `2026-09-04-pattern-catalog-design.md`,
`2026-09-04-pattern-detail-redesign-design.md`, `2026-09-05-coaching-observer-design.md`.

**Visual truth:** `docs/design_2.0/prototypes/eszrevetelek.html` (source
`prototypes/src/eszrevetelek-body.html`, published at
https://claude.ai/code/artifact/2f5e64be-de78-481a-9320-35e84706bf52). Approved v1 as-is.

**Driving request (user, 2026-09-06):** *"van lehetőség arra is, hogy Mezo magától vegyen észre
érdekességeket és mintákat, amiket utána figyel? … azt akarom, hogy a user azt érezze, hogy
úristen ez az AI él és engem vizsgál, foglalkozik velem és nem determinisztikus dolgokat dobál
nekem."*

## 0. The gap this closes

Mezo today has four hand-authored rule systems and one weekly LLM step:

| Layer | Shape | Cadence | Follows up? |
|---|---|---|---|
| 29 metric pairs (`mezo.companion.patterns.pairs`) | Pearson over two `MetricKey` series, `PatternGate` | nightly 02:40 | yes, but only as re-detection |
| ~45 character detectors (`DetectorRegistry`) | pure-code signals for the konzílium | nightly | no |
| 13+ flag rules (`FlagEvaluator`) | hourly JITAI raise/clear/unavailable | hourly | no |
| `HypothesisPipelineService` | propose → critique → revise, `kind=ai_hypothesis` | Sunday 03:00 | **no** — proposed once, identity = title hash, never re-evaluated |

Free text (journal, gratitude, chat) is a retrieval memory only; it is never a variable. Nothing
comes back to the user days later to say "this held" or "this did not". That is the missing
"alive" quality: **noticing, asking, remembering the answer, and returning.**

## 1. Decisions made during brainstorm

1. **C — curious observer first, lab notebook second.** The living voice is a new third tab on
   the Nap→Mezo page (*Észrevételek*); the Minták detail page becomes the *laborfüzet* where a
   hypothesis' full history is visible. (Rejected: B "scientist only" — the deterministic feel
   the user named; A "observer only" — no auditable trail.)
2. **A + B triggers.** Event-driven quick notice after a text save (daily budget) **plus** a
   nightly reflection at 03:40. (Deferred: C importance-budget reflection à la Park et al.;
   revisit once A+B run.) The weekly cadence was judged too rare.
3. **Thread voice with chips, free text also counts.** Observations land as a new
   `companion_message` kind; chips *Igen, figyeld · Nem stimmel · Mesélj*; a chat reply after
   *Mesélj* is recorded as evidence and may revise the test plan.
4. **Use the memory platform now.** A new `REFLECTION` consumer policy calls
   `MemoryContextService` directly. The RAG spec's §11.D is amended (see §9) to name reflection
   as an offline consumer allowed before the chat gate. (Rejected: reading source tables only —
   the user explicitly asked to use RAG more; waiting for `mezo-6dii.9` — weeks of standstill.)
5. **Product-owner decision: chat switches to `NEW` serving mode** before the `mezo-6dii.9`
   real-Gemini eval has run. Recorded as a conscious gate skip; `NEW` keeps its audited fallback
   to the legacy path on total retriever failure; the switch is one env var. The eval remains
   runnable later and PR #499 is not merged by this work.
6. **Approach 1 — a reflection layer above the existing rules**, not a fifth rule catalog and not
   a free tool-using agent (rejected: nondeterministic, costly, the RAG spec deferred agent
   workflows).
7. **Gemini phrases, code decides.** No numeric claim reaches the user that `PatternGate` did not
   pass; hypothesis state and belief are moved only by deterministic evaluation and the user's
   replies.
8. **Morning cross-reference on.** The morning message may carry one sentence about a hypothesis
   that changed overnight; details stay on the Észrevételek tab.
9. **Visual v1 approved unchanged**: tab name *Észrevételek*; the *Beépült* card stays on the
   tab; the belief ring stays in the laborfüzet.

## 2. Prior art

Researcher recon, 2026-09-06, five sources.

**Adopted:**

- **Reflection with evidence pointers** — Park et al., *Generative Agents*
  (https://arxiv.org/html/2304.03442v2): higher-level insights are generated from recent
  memories and each cites the record IDs that support it. Adopted as the discipline that every
  observation carries `evidence` refs (journal ids, dates) so the laborfüzet can show "based on
  these 4 entries and 4 nights". Their importance-budget trigger is deferred (decision 2).
- **Hypothesis lifecycle with evidence-gated belief** — *Hypothesis Evolution Protocol*
  (https://arxiv.org/html/2607.09195v1): `proposed → under_test → supported | refuted | dormant`,
  belief moved only by validated evidence, tests pre-registered before more data arrives,
  immutable per-hypothesis event log. Adopted almost verbatim as §4 (states, pre-registered
  `test_plan`, `pattern_event` log).
- **"Gemini plans, backend executes"** — Google Personal Health Agent
  (https://research.google/blog/the-anatomy-of-a-personal-health-agent/): the LLM decides what to
  test and how to phrase it; deterministic code decides whether it holds. Adopted as the
  test-plan contract (§4.2) and the phrase/decide split (decision 7).
- **Continuously updated, plain-language probability + user-startable mini-experiments** —
  SleepCoacher / SleepBandits (https://sleepcoacher.cs.brown.edu/,
  https://jeffhuang.com/papers/SleepBandits_CHI20.pdf): "83% likely that X helps", updated
  nightly. Adopted as the belief ring and the "Figyeljem?" question; the existing Experiments
  feature stays the home of active interventions (not re-designed here).

**Rejected:**

- **Correlation lists as the product** — Exist.io (https://developer.exist.io/reference/correlations/).
  Its schema (n, lag, p, stars, user rating) is close to what `PatternGate` + `pattern` already
  hold and stays the evidence contract; a list of correlations as the surface is exactly the
  deterministic feel this work exists to escape.

## 3. Codebase terrain

Investigator recon, 2026-09-06, re-run after the RAG platform landed on main.

**Affected features:** companion (patterns, hypotheses, metric series, memory platform, chat
prompt), proactive (`companion_message` feed, morning generator), journal (entry/gratitude/
reflection listeners), insights FE (`/mezo/patterns`, `/mezo/patterns/:pairKey`), today FE
(`NapMezoPage`), appnotification (bell/push kinds).

**Key files and the patterns to follow:**

- Pattern engine: `companion/service/PatternGate.java` (pure static gate, shared by job and
  monitor — reuse for every evaluation), `PatternDetectionService.java` (LIVE-only persistence,
  frozen user judgements, `pattern_event` writers), `PatternService.decide()` (repeatable
  transitions, first confirm → `knowledge_fact`), `HypothesisPipelineService.java` (gather →
  propose → critique → score; identity `hyp-<hash(title)>` — the identity this spec replaces),
  `MetricKey.java` (34 keys; adding one widens the hypothesis table, monitor coverage and
  observatory for free), `MetricSeriesService.java` (one extractor per key, missing days absent).
- Entities/CHECKs: `PatternEntity` (`kind ∈ statistical|ai_hypothesis`, `status ∈
  proposed|monitoring|confirmed|rejected`), `PatternEventEntity` (kinds
  `snapshot|confirmed|monitoring|rejected|reinforced|promoted`) — every new value is a Liquibase
  CHECK migration + entity `@Pattern` + FE union.
- Memory platform (all on main): `memory/service/MemoryContextService.java`
  (`retrieve(MemoryRequest)`), `memory/dto/ConsumerPolicy.java` (add `REFLECTION`),
  `MemoryPlatformProperties` + `application.yml` `mezo.companion.memory-platform.*`
  (`serving-mode: ${MEZO_MEMORY_SERVING_MODE:SHADOW}`), `ChatMemoryContextAdapter` (OLD/SHADOW/
  NEW switch), `MemoryItemEntity` (`people[]`, `topics[]` exist and are empty; `salience` must not
  be LLM-mutated).
- Text ingestion seam: `companion/embedding/JournalEmbeddingListener.java` (+ gratitude,
  reflection): `@Async @TransactionalEventListener(AFTER_COMMIT)`, own switch pair,
  catch-everything — the signal extractor is a sibling listener.
- Proactive voice: `proactive/entity/CompanionMessageEntity.java` (`kind` CHECK; add
  `observation`), `CompanionMessageGenerator.generateMorning` (gather = snapshot + facts +
  summaries; add the reflection fact), `ProactiveFeedService.ensureTodayCronKinds` (do NOT add
  `observation` — it is event-driven, not a cron slot), `AppNotificationEmitter.emit(...)` with
  `dedupeKey` for bell/push.
- Cross-feature reads: companion may not import proactive/journal services (ArchUnit
  `feature_slices_are_cycle_free`); use the existing port-inversion idiom (`PatternImpactSource`,
  `NudgeSendPort`) — companion declares, the other feature implements, injected via
  `ObjectProvider`.
- Jobs: `@ConditionalOnProperty` on `COMPANION_SWITCH` + own `mezo.techcore.cron.<job>.enabled`,
  `UserFanOut.forEachActiveUser`, no class-level `@Transactional`; dawn slots taken 02:20, 02:40,
  03:00 SUN, 03:10, 03:20, 03:30 MON, 03:50, 04:10 — **03:40 is free** and is this job's slot.
- LLM calls: one `*_MARKER` per prompt, `FakeCompanionLlm` literal mirror, strict JSON with
  defensive parsing (broken answer = no output), `LlmCallContextHolder.runWith(...)`.
- FE: `frontend/src/features/today/pages/NapMezoPage.tsx` (`?tab=` split, session-local dots),
  `features/insights/pages/PatternDetailPage.tsx` + `components/PatternArtifactDetail.tsx`,
  `data/insights/patternsHooks.ts` (`useDualQuery`, 404 → degraded), `logic/lifecycle.ts`
  (`bucketize`, six buckets), Mozaik kit `shared/ui/mozaik`, `shared/ui/clay`.

**Known traps:** contract-drift gate (fragment + `api/openapi.yml` + `api.gen.ts` in one commit);
CODEMAP freshness (`node scripts/gen-codemap.mjs --check`); `lint-liquibase` naming; new tables
into `ResetDatabase` + a populator; `VITE_USE_MOCK` unset = mock — every new hook needs a mock
seed and MSW handler and tests in both modes; Testcontainers for the full backend suite;
`AppNotificationKind` deeplinks still say `/insights/...` — new kinds use `/mezo/...`;
`lastDetectedAt` means last detection, not job health; `hypothesisKey` title-hash identity must
not be reused for reflection rows.

## 4. Architecture

```text
 INPUTS                          ENGINE (companion/reflection)                  OUTPUTS
 journal, gratitude, chat ─┐     ① Signal extraction (LLM, after save)          Észrevételek tab
 sleep, weight, training  ─┤ ──► text_signal → MOOD/ENERGY/STRESS/SOCIAL      (3rd tab, chips)
 flag rules               ─┤       people[] / topics[] into memory_item             ▲
 29 pairs, detectors      ─┘                                                        │
                                 ② Quick notice (after save, daily budget)   ──►    │
                                 pre-screen (code) → 1 LLM call → observation       │
                                                                                    │
                                 ③ Nightly reflection 03:40                   ──►    │
                                 evaluate open hypotheses (PatternGate),            │
                                 propose ≤2 new (smart tier, critique),       ──►  morning message
                                 memory context via REFLECTION policy              (one sentence)
                                                                                    
                                 ④ Hypothesis lifecycle (code moves it)      ──►  Minták laborfüzet
                                 proposed → monitoring → confirmed/refuted/dormant
                                 pattern_event evidence log + user replies
                                                          ▲
 user chip / chat replies ───────────────────────────────┘
```

Package: `feature/companion/reflection/{config,entity,repository,service}` plus the additive
changes to `companion/service/Pattern*` and `companion/memory`. Two principles run through every
part: **Gemini phrases, code decides**; **every observation cites its evidence**.

### 4.1 Signal extraction (`text_signal`)

- **Trigger:** a new `TextSignalListener` beside the embedding listeners: `@Async`,
  `AFTER_COMMIT`, on `JournalEntrySaved`, `GratitudeEntrySaved`, reflection close; gated on
  `COMPANION_SWITCH` ∧ `mezo.companion.reflection.enabled`. Chat is **not** per-turn: the nightly
  job aggregates the day's user turns into one call (`source_kind = chat_day`).
- **One cheap-tier call** (`SIGNAL_MARKER`), strict JSON:
  `{mood:1-5|null, energy:1-5|null, stress:1-5|null, confidence:"sure"|"unsure",
  people:[string], topics:[enum], keywords:[string]}`. `topics` is a fixed Hungarian vocabulary
  (munka, család, kapcsolatok, sport, egészség, pihenés, alvás, evés, pénz, alkotás, tanulás,
  otthon). A neutral two-line entry must come back `unsure` and is excluded from series.
- **Table `text_signal`** (`OwnedEntity`, soft-delete): `source_kind` (`journal_entry |
  gratitude | reflection | chat_day`), `source_id`, `occurred_on`, `content_hash`, `version`,
  `mood`, `energy`, `stress`, `confidence`, `people text[]`, `topics text[]`, `keywords text[]`,
  `provenance jsonb`. Unique partial index on `(created_by, source_kind, source_id, version)`.
  An edited entry gets a new version; series read the newest version per source. Deleting the
  source soft-deletes its signals (the existing `*DeletedEvent` listeners).
- **Series:** four new `MetricKey`s — `MOOD`, `ENERGY`, `STRESS` (NUMBER, mean of `sure`
  signals per day), `SOCIAL_CONTACT` (BINARY: any person mentioned that day). `MetricSeriesService`
  gets one extractor each; the pair catalog, `PatternGate`, the hypothesis table and the monitor
  see them automatically.
- **Dynamic series:** `people:<name>` and `topic:<key>` are computed on demand from
  `text_signal` as 0/1 daily series by a `DerivedSeriesService`; they are addressable in a
  test plan but are not `MetricKey`s.
- **Projection enrichment:** the same result writes `people[]`/`topics[]` onto the matching
  `memory_item` via `MemoryProjectionWriter` (idempotent; `salience` untouched).

### 4.2 Hypothesis model (the `pattern` table grows)

Additive columns on `pattern`:

| Column | Type | Meaning |
|---|---|---|
| `kind` | CHECK widened | `statistical \| ai_hypothesis \| reflection` |
| `status` | CHECK widened | `proposed \| monitoring \| confirmed \| rejected \| refuted \| dormant` |
| `hypothesis_key` | text, unique per user | `sha256` of the canonical test plan (or of the qualitative statement when no plan) — replaces the title hash for new rows |
| `test_plan` | jsonb, nullable | `{seriesA, seriesB, lagDays, expectedDirection, minN, minGroupN, windowDays}`; `seriesA/B` ∈ `MetricKey.wireKey \| people:<name> \| topic:<key>` |
| `belief` | numeric 0..1 | deterministic (§4.3) |
| `evidence_hits` / `evidence_misses` | int | nightly tallies |
| `origin` | text | `pair_catalog \| weekly_hypothesis \| quick_notice \| nightly_reflection` |

Statistical rows get `test_plan` from their catalog pair on first evaluation; `ai_hypothesis`
rows get one when the critic can name a testable pair, else stay **qualitative** (no plan;
moved only by user replies and text-signal streaks). The existing `r/n/p`, `critique`,
`promoted_fact_id` semantics are unchanged; a user's `confirmed`/`rejected` stays frozen.

`pattern_event.kind` widens with `observation`, `evidence`, `user_reply`, `revised`,
`refuted`, `dormant`. Payloads: `observation {messageId, text, evidenceRefs[]}`,
`evidence {r, n, p, verdict, hit:boolean}`, `user_reply {channel: chip|chat, choice, text}`,
`revised {fromPlan, toPlan, reason}`.

### 4.3 Lifecycle and belief (code only)

```text
proposed ──(user "figyeld" | gate LIVE strong)──► monitoring ──► confirmed
   │                                                  │
   │ user "nem stimmel" ×2 · gate: no relation at ≥minN │──► refuted
   └──────────── 30 days without evaluable data ───────┴──► dormant (returns when data arrives)
```

- **Confirm:** three consecutive nightly `evidence` events with `PatternGate` LIVE and strong
  (`|r| ≥ 0.3`, `p ≤ 0.15`) **and** at least one positive user reply, **or** the user presses
  *Megerősítem*. First confirm promotes to `knowledge_fact` exactly as today.
- **Refute:** gate LIVE with `n ≥ minN` and no relation over three consecutive evaluations, or
  two *Nem stimmel* replies. User *Elvetem* → `rejected` (frozen, never re-proposed for the same
  `hypothesis_key`).
- **Dormant:** no evaluable window for 30 days; a new `evidence` event revives it to its prior
  state.
- **Belief** = `clamp(0.5·gateScore + 0.3·userScore + 0.2·streakScore, 0, 1)` where `gateScore`
  maps `|r|` and `p` through the existing strong/weak bands, `userScore` is
  `(positive − negative) / (positive + negative + 1)` over `user_reply` events, `streakScore` is
  `hits / (hits + misses + 1)`. Weights are code constants with a unit test, like the hypothesis
  scoring today.
- The LLM never writes `status`, `belief` or a fact; it may only create a `proposed` row and an
  `observation` event.

### 4.4 Quick notice (event-driven)

1. After a `text_signal` row is written, `QuickNoticePreScreen` (pure code) checks: does the
   entry touch an open hypothesis (same person, topic or metric), or is there a salient novelty
   (a person's third mention within 7 days, `mood ≤ 1 | ≥ 5` with `sure`, a topic on four
   consecutive days)? No hit → nothing happens.
2. Hit → **one** cheap-tier call (`NOTICE_MARKER`): input = the entry, the touched hypotheses'
   state (belief, tallies), `MemoryContextService.retrieve(REFLECTION, query = entry gist,
   budget 800)`. Output JSON: `{text, question, hypothesisKey | newTestPlan, evidenceRefs[]}`.
   The plan, if new, is validated (known series, sane lag/minN) or dropped.
3. **Budget** (`mezo.companion.reflection.notice.*`): `max-per-day: 2`, `min-gap-hours: 4`,
   `quiet-from: 22:00`, `quiet-to: 07:00`. Over budget → the `observation` event is still
   appended (silent) and the nightly step decides whether it surfaces.
4. Surfacing = a `companion_message` row with `kind = observation` (new CHECK value; **not** in
   `ensureTodayCronKinds`), `refs` = evidence, and an `AppNotificationEmitter.emit` with
   `kind = OBSERVATION_NEW` (deeplink `/nap/mezo?tab=eszrevetelek&n=<id>`), push only if the
   user enabled this kind.

### 4.5 Nightly reflection (03:40, `ReflectionJob`)

Per active user, in order, each step isolated:

1. **Chat day signal** — one extraction call over yesterday's user turns (§4.1).
2. **Evaluate** every `proposed|monitoring|dormant` row with a `test_plan` through
   `PatternGate.evaluate` over `DerivedSeriesService`/`MetricSeriesService` series → one
   `evidence` event each → state machine (§4.3). Pure code.
3. **Propose** — gather = yesterday's signals + open hypotheses (state, tallies) + non-LIVE pair
   diagnostics + `MemoryContextService.retrieve(REFLECTION, query = "tegnap" digest,
   deep = true)` → smart-tier `REFLECT_MARKER`, ≤ 2 proposals with test plans → existing
   critique + score stages → persist `proposed` rows with `origin = nightly_reflection`.
   `HypothesisJob` (Sunday) is **retired**; its pipeline classes are reused here.
4. **Queue** the silent observations from §4.4 step 3: the strongest one (by belief delta) is
   marked for surfacing at `quiet-to` (07:00) if the new day's budget allows; the rest stay
   silent events visible only in the laborfüzet.
5. **Morning fact** — pick one row that changed state or gained evidence and write a
   `reflection_digest` (one Hungarian sentence + ref) that `CompanionMessageGenerator.generateMorning`
   reads through a companion-owned port (`ReflectionDigestSource`, implemented in companion,
   consumed by proactive — the existing inversion direction).

### 4.6 Memory platform: `REFLECTION` policy and chat `NEW`

- `ConsumerPolicy.REFLECTION`: candidate depth 30, token budget 800, window 180 days, reranker
  allowed (offline), `deep` allowed, source kinds all narrative kinds. Audit rows carry the
  policy; nothing else in the pipeline changes.
- `mezo.companion.reflection.enabled` (default `true` at delivery — decision 4/5) gates the
  listener, the job and the policy's use.
- Chat: `MEZO_MEMORY_SERVING_MODE=NEW` in the deployment env. The chat system prompt gains a
  compact `[Észrevételek]` block (open hypotheses: title, state, tally; ≤ 5 rows) so a *Mesélj*
  hand-off has context. A user turn in a conversation opened from a chip (`conversation.seed =
  hypothesisKey`) is appended as a `user_reply {channel: chat}` event by `ChatService` after the
  turn commits.

### 4.7 Surfaces

**Észrevételek tab** (`NapMezoPage`, `?tab=eszrevetelek`, session-local dot like the other two):
four card kinds per the prototype — *Feltűnt* (coral; text, question, evidence chips, three
chips), *Visszatérés* (lavender; recalls the user's own reply, asks), *Figyelem* (gold; 8-slot
tally + evidence bar + "Laborfüzet ›"), *Beépült* (sage; confirmed overnight). Footer line shows
the remaining daily budget and quiet hours. Chips call
`POST /api/companion/pattern/{id}/reply {choice: watch|reject|talk}`; `talk` returns a
conversation id seeded with the hypothesis. Answered cards flip to an acknowledgement in place.

**Morning message:** one sentence from the reflection digest, rendered by the existing generator;
no new UI.

**Laborfüzet** (`/mezo/patterns/:key`, extends `PatternDetailPage`): state card (question →
human answer → belief ring → Megerősítem/Figyeljük/Elvetem), pre-registered test plan (Ha… /
…akkor / lag / minN / window), two-group dot chart (existing component, dashed wash for a thin
group), evidence log timeline (`observation`, `user_reply` in italic, `revised`, `evidence`),
collapsed "Hogyan számoltuk" with r/p/gate. Reads: existing pair-detail endpoint widened with
`testPlan`, `belief`, `tallies`, and the new event kinds.

## 5. Failure handling and privacy

- Extraction failure: entry untouched, no signal; nightly catch-up regenerates missing signals
  for the last 7 days. `unsure` never enters a series.
- Quick-notice LLM failure or invalid JSON: no `observation`, nothing shown.
- Memory platform failure inside reflection: the step continues with an empty, audited context.
- Per-user job failure is isolated (`UserFanOut`); per-hypothesis evaluation failure is
  isolated and logged, the row keeps its state.
- The LLM cannot change `status`, `belief`, facts or `salience`.
- All `text_signal` and derived-series queries filter `created_by` in SQL. People names are
  stored as written by the user, never enriched from other sources. Deleting a source entry
  soft-deletes its signals; the next nightly evaluation recomputes.
- *Elvetem* / *Nem stimmel* take effect immediately; a rejected `hypothesis_key` is never
  re-proposed.
- Prompts do not include raw provider payloads in audit; trace retention follows the memory
  platform's `audit.retention-days`.

## 6. Testing

Deterministic, network-free ITs with `FakeCompanionLlm` markers: signal JSON parsing and
`unsure` exclusion; series extractors for the four keys and the derived `people:`/`topic:`
series; pre-screen rules; daily budget, gap and quiet hours; state machine transitions
including user override and dormancy; `hypothesis_key` stability under rewording; belief
formula unit test; `ReflectionJobSwitchOffIT` and `TextSignalListenerSwitchOffIT`;
`REFLECTION` policy audit row; chat `NEW` + `[Észrevételek]` block; reply endpoint ownership.
FE: `NapMezoPage` tab tests in both modes (mock seed + MSW), chip flip, dot behaviour;
`PatternDetailPage` laborfüzet sections with and without a test plan. Real-Gemini quality stays
on the manual eval tier.

## 7. Configuration

```yaml
mezo:
  companion:
    reflection:
      enabled: true
      cron: "0 40 3 * * *"          # free dawn slot; document in the yml slot comment block
      catch-up-days: 7
      notice:
        max-per-day: 2
        min-gap-hours: 4
        quiet-from: "22:00"
        quiet-to: "07:00"
      propose:
        max-per-night: 2
      lifecycle:
        confirm-streak: 3
        refute-streak: 3
        dormant-after-days: 30
        strong-r: 0.3
        strong-p: 0.15
    memory-platform:
      policies:
        reflection:
          candidate-limit: 30
          max-tokens: 800
          window-days: 180
          rerank: true
  techcore:
    cron:
      reflection-job:
        enabled: true
      hypothesis-job:
        enabled: false               # retired; bean removed in slice 2
```

`MEZO_MEMORY_SERVING_MODE=NEW` is set in the deployment environment, not in the yml default.

## 8. Delivery slices

Each is one bd issue under `mezo-eq85`, one `feat/` branch, one self-PR.

1. **Signals** — `text_signal` table + populator + `ResetDatabase`; `TextSignalListener`;
   four `MetricKey`s + extractors; `DerivedSeriesService`; `memory_item` people/topics
   enrichment; nightly catch-up hook.
2. **Lifecycle** — `pattern` and `pattern_event` migrations; `hypothesis_key`, `test_plan`,
   `belief`, tallies; state machine + nightly evaluation step; retire `HypothesisJob` into
   `ReflectionJob` (steps 1–2 of §4.5 + the propose step reusing the pipeline).
3. **Memory + chat** — `ConsumerPolicy.REFLECTION` + properties; reflection uses
   `MemoryContextService`; RAG spec §11.D amendment (done in this commit); `[Észrevételek]`
   prompt block; chat-turn `user_reply` capture; deployment note for `NEW`.
4. **Quick notice** — pre-screen, `NOTICE_MARKER` call, budget, `companion_message.kind =
   observation`, `OBSERVATION_NEW` notification kind, reply endpoint (contract + FE client),
   morning `ReflectionDigestSource` port.
5. **FE tab** — Észrevételek tab on `NapMezoPage` per the prototype; mock seeds, MSW, tests in
   both modes; morning cross-reference rendering needs no change.
6. **FE laborfüzet** — `PatternDetailPage` sections per the prototype; pair-detail contract
   widening; `lifecycle.ts` buckets for `refuted`/`dormant`; Minták catalogue status filter.

## 9. Amendment to the RAG platform spec

`2026-09-04-shared-rag-memory-platform-design.md` §11.D gains: *"Reflection (`REFLECTION`
policy, `mezo-eq85`) is an offline consumer whose output passes its own hypothesis gate and never
serves a user-facing latency path; it may adopt the platform before the chat gate, behind
`mezo.companion.reflection.enabled`."* §9's promotion order is unchanged for briefing, memoir
and prediction. The product-owner decision to serve chat in `NEW` before `mezo-6dii.9` is
recorded on `mezo-6dii` and `mezo-eq85`.

## 10. Explicitly deferred

- Importance-budget (Park-style) reflection triggers.
- Active interventions from hypotheses (stays in Experiments).
- Learned weights for belief; LLM-estimated belief.
- Per-turn chat signal extraction.
- Automatic fact rewriting or salience mutation.
- Bulk hypothesis management UI; push for every observation by default.
- Merging the character detectors or flag rules into the hypothesis table (they remain inputs).

## 11. Acceptance criteria

- Spec approved by the product owner; six slices filed under `mezo-eq85`.
- A journal or gratitude save produces a `text_signal` row and, when the pre-screen fires and
  the budget allows, an *Feltűnt* card within a minute, citing its evidence.
- A hypothesis moves `proposed → monitoring → confirmed|refuted|dormant` only through
  `evidence`/`user_reply` events; the laborfüzet shows the full trail.
- The morning message references a changed hypothesis in one sentence when one exists.
- Chat serves in `NEW` mode with the `[Észrevételek]` block; reflection retrieval rows appear in
  `memory_retrieval_run` with `consumer_policy = REFLECTION`.
- Deterministic CI green; CODEMAP, contract and Liquibase gates pass per slice.

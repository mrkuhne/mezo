# Mezo emlékezete — confirmed-insight persistence, person memory, effect tracking, transparency hub

**Date:** 2026-09-24 · **Status:** approved; programme running via the `/emlekezet` skill
**Epic:** `mezo-d6ivw` (slices `mezo-d6ivw.1`–`.6` = S1–S6 below)

> **Addendum (owner, 2026-09-24, after spec approval):** the programme's standing goal is
> wider than the six slices — the separate learning subsystems (RAG/unified memory, knowledge
> facts + graph, Konzílium, chat, proactive messages) must converge into **one coherent
> engine and one AI experience**, and that experience most likely lives on the **csapatfal**
> (mezo-a9bo7 world). Therefore **every slice session opens with a brainstorm**
> (brainstorm-recon: web prior art + codebase terrain) that re-examines the slice against
> this goal before planning; spec deltas land as dated sections here. Driver:
> `.claude/skills/emlekezet/SKILL.md`.

## Problem

The nightly reflection pipeline produces good grounded observations (e.g. "on the date
day with Barbi, mental 8→10, stress 2→1, energy 7→4"), but almost nothing it learns is
retained or reused:

1. **"Igen, jellemző" is only a status flag.** A user confirm moves the pattern row to
   `monitoring` and recomputes belief; only an *engine* confirm creates a
   `knowledge_fact` + graph node. Grounded holding rows (no test plan) are never
   evaluated, so a user "yes" on them never becomes durable knowledge.
2. **No person memory.** `person.known_facts` exists but has no writer besides seed
   data; chat context deliberately excludes it. Facts about people mentioned in notes
   ("Barbival újra van flow") are never extracted.
3. **No named long-term effect tracking.** `PeopleMoodLinkDetector` is anonymous and
   character-feed-only; `PersonAffectTrendCalculator` uses mention tone, not check-in
   mood/energy/stress. Nothing answers "how does Barbi / a date affect me over time".
4. **No single transparency surface.** Tudástár shows chat-extracted facts only;
   confirmed observations, person facts and effects appear nowhere the user can
   inspect, edit or disable.
5. **UX defects on the observation card:** ambiguous button copy ("Igen, jellemző"),
   and evidence chips render raw `key=value` strings persisted server-side.

## Owner decisions (2026-09-24)

- **Auto-save person facts** (no approval queue), with full view/edit/delete on the
  person page. A discreet inline **"Megjegyeztem: …" chip with undo** appears at
  capture time; "ezt ne jegyezd meg" works in-conversation.
- **All three effect trackings:** per-person, per-event-type, and re-checking of
  confirmed observations over time.
- **One central hub:** Tudástár extended (Rólad / Emberek / Megerősített észrevételek
  / Hatások), with provenance links and per-item use-toggle; person pages also show
  their own slice.
- **Proactive use:** confirmed knowledge must reach *messages/interventions*, not only
  chat — "if I don't chat with it, it never shows what it knows."
- Approach: **extend the existing Deep-Memory platform** (mezo-b3pp, 90% complete) —
  no new parallel memory system.

## Design

### S1 — Observation card UX (quick fixes)

- Button copy: **"Igen, ez igaz rám" / "Nem, ez nem stimmel" / "Beszéljük meg"**.
  Chip `choice` values (`watch`/`reject`/`talk`) unchanged — copy only.
- Evidence chips: replace raw `key=value` labels with a human format:
  `Napi check-in · szept. 22., délután — „«note» …" · energia 7 · stressz 2 · hangulat 8`.
  Because labels are **persisted** in `pattern_event.evidenceRefs` and are also the
  LLM-visible text, do this at **read time**: keep storing the structured source ref,
  and format for display in `ObservationFeedService` (BE-side formatter, HU copy) so
  old, already-emitted observations are reformatted too. The prompt-side excerpt in
  `ObservationContextService.excerpt` may stay machine-oriented (it serves grounding),
  but should gain the same prose-first ordering it already has.

### S2 — Confirmed observation → durable knowledge

- On the user's **second-signal-free confirm** ("Igen, ez igaz rám"): in addition to
  `proposed → monitoring`, run the same promotion the engine confirm runs —
  `knowledge_fact` insert + `PatternConfirmedEvent` → graph node (reuse
  `PatternService.applyEngineConfirm` internals; introduce a shared
  `applyConfirm(source)` with source = ENGINE | USER; the fact records its provenance
  pattern id).
- Grounded holding rows (no test plan): a user confirm promotes them directly (they
  are otherwise never evaluated). Where a test plan exists, monitoring continues as
  today and can later *strengthen* the fact's confidence.
- "Nem, ez nem stimmel": keep today's two-strike → `refuted` lifecycle, plus a
  guard: a refuted pattern's fingerprint must not be re-proposed by the nightly
  pipeline (extend the critique/dedup input with refuted rows).
- Confirmed observations get an `includeInPrompt`-style toggle like knowledge facts
  and surface in the hub (S6).
- **Re-check loop:** monitoring rows created from user confirms are re-evaluated on a
  slow cadence (reuse `HypothesisEvaluationService` where a series exists; where not,
  a quarterly LLM re-check against fresh context). On drift, emit a new observation:
  "ez korábban igaz volt, az utóbbi hetekben másképp alakul".

### S3 — Person fact memory

- **Storage: a normalized `person_fact` table** (per-fact provenance, active flag,
  toggle, undo — impossible on the legacy `person.known_facts` text field, which stays
  read-only legacy/seed data). Sources:
  - chat turns: extend the existing `FactExtractionListener` flow with a
    person-directed variant (facts *about a mentioned person*, not the user);
  - nightly: extend `PersonExtractionService` (already reads check-in notes via
    `CheckInNoteSourceAdapter`) to also emit person facts, not only mentions/candidates.
- Extraction target schema (Monica-inspired, deliberately narrow, ≤5 kinds):
  `preference`, `relationship_state`, `shared_activity`, `important_date`,
  `sensitivity` — each with text, confidence, sourceRef, extractedAt, active flag.
- **Capture chip:** when a fact is auto-saved from a live chat turn, the reply carries
  a "Megjegyeztem: …" chip with undo (deactivates the fact). Nightly captures don't
  toast; they appear in the hub as "új" until first seen.
- **Consumption:** remove the deliberate exclusion in `PersonChatContext`; person
  facts join the people snapshot block in chat AND the intervention/message context
  (S5). Respect active flag + per-fact toggle.
- ArchUnit direction stays companion → people only; the extraction listeners live in
  companion, writing through a people-owned service port.

### S4 — Named effect tracking (people + event types)

- **Per-person series:** generalize `PeopleMoodLinkDetector`'s
  with-mention/without-mention comparison to *named* persons over a rolling window
  (42–90d), against check-in `mental`, `energy`, `stress` (not just mental). Store as
  a per-person effect row (direction, effect size, sample sizes, confidence tier).
- **Per-event-type series:** same comparison keyed by event/activity type present on
  the day (randi, edzés, családi program, munka-hajtás — start from existing activity
  taxonomy; the plan enumerates the initial set).
- **Presentation rules (Exist.io-inspired):** strength and confidence shown as two
  separate signals; hedged, non-causal HU copy ("úgy tűnik", "azokon a napokon,
  amikor…"); a minimum-data threshold before anything is shown; owner confirmation of
  a related observation raises displayed confidence.
- Surfaces: the person page and the hub's Hatások section; strong findings may also
  feed the nightly observation proposer as candidate hypotheses (closing the loop
  with S2).

### S5 — Proactive use in messages

- Confirmed observations + person facts + effect rows become inputs to the existing
  JITAI-lite intervention/heartbeat pipeline (mezo-b3pp W5.2) and the daily message
  composer: e.g. a planned date event today + confirmed "randi feltölt, de estére
  lemerít" → a morning message suggesting a light evening.
- Mechanics: a new prompt/context block (analogous to `ReflectionPromptBlock`) exposed
  to the intervention composer; trigger matching stays in code (event type / person
  match), the LLM only phrases. Budgeted like other proactive messages.

### S6 — Transparency hub + forget controls

- **Tudástár extended into four sections:** Rólad (existing facts, now with all
  sources), Emberek (per-person fact summaries → person page), Megerősített
  észrevételek (with "still holding?" status from S2's re-check), Hatások (S4 rows).
- Every item: edit / delete / use-toggle + **provenance link** to the source record
  (journal entry, check-in, chat turn) — reuse the existing ref-chip pattern.
- **"Ezt ne jegyezd meg"** in chat: an intent the assistant maps to deactivating the
  just-captured fact(s) of the current conversation (code-side: last N fact writes of
  the conversation are addressable). Deletion is honored everywhere consumption reads
  the active flag.
- All new FE surfaces follow the **Üveg** canon (glass cards, one accent per card,
  Titanium sprite icons, reduced-motion branch); each slice with UI ships a prototype
  for owner OK first, per /uvegesites process.

### Slice order & dependencies

S1 (independent, immediate) → S2 → S3 → S4 (needs S3's person grounding for named
series) → S5 (consumes S2+S3+S4) → S6 (hub; can start after S2, finishes last).
Each slice = one bd child issue under the epic, one branch, own plan, owner prototype
OK where UI changes.

## Prior art

(researcher recon, 2026-09-24)

- **ChatGPT memory** — itemized, editable/deletable memory ledger; in-chat "forget X";
  provenance icon showing which memory shaped an answer. Adopted: ledger, forget-in-
  the-moment, provenance. Rejected: their opaque synthesis layer that isn't fully
  listable — everything Mezo feeds prompts from must be visible in the hub.
  <https://help.openai.com/en/articles/8590148-memory-in-chatgpt>
- **Shape of AI memory patterns** — inline capture chips ("Saved to memory") keep
  consent active; scoped/ephemeral memory for sensitive topics. Adopted: capture chip
  with undo. <https://www.shapeof.ai/patterns/memory>
- **Monica (personal CRM)** — person entity with structured facts + interaction
  timeline; private, no-ranking posture keeps a people DB from feeling creepy.
  Adopted: the schema shape, automated by extraction; rejected: full CRM breadth
  (≤5 fact kinds). <https://github.com/monicahq/monica>
- **Exist.io correlations** — strength and confidence displayed separately; strictly
  non-causal phrasing; minimum-data thresholds. Adopted wholesale for S4; Mezo's
  confirm loop is an advance over Exist and feeds confidence.
  <https://kb.exist.io/article/37-what-are-correlations>
- **AI UX Playground memory guide** — failure modes: silent writes, un-forgettable
  facts, stale third-party inferences resurfacing (a breakup). Adopted: forget-at-the-
  moment, fact staleness/active flags, refuted observations never resurface.
  <https://aiuxplayground.com/guides/how-to-design-ai-memory-personalization/>

## Codebase terrain

(investigator recon, 2026-09-24; anchors verified then)

- **Observation pipeline:** `ReflectionJob.java:50` → `HypothesisPipelineService`
  (PROPOSE `:89`, CRITIQUE `:114`) → `GroundedHypothesisPublisher.java:95-130`.
  Context: `ObservationContextService` (28d window; excerpt builder `:115-141` — the
  raw `key=value` labels, **persisted** into event `evidenceRefs`, served verbatim by
  `ObservationFeedService.java:213-240`, rendered by `ObservationCard.tsx:137-139`).
- **Buttons:** `ObservationCard.tsx:62-64` → POST `/api/companion/pattern/{id}/reply`
  (`CompanionObservationController.java:42`) → `ReflectionReplyService.java:78-121`
  (watch `:95-99`, two-strike reject `:105-112`, talk `:125-128`).
- **Engine-only promotion:** `PatternService.applyEngineConfirm`
  (`PatternService.java:126-139`) → `knowledge_fact` + `PatternConfirmedEvent` →
  `GraphPromotionListener.java:39`. Trap: rows without a test plan are never
  evaluated (`HypothesisEvaluationService.java:89`).
- **People:** `PersonEntity.java:50` `known_facts` (no writer; seed only,
  `PeopleSeedData.java:101`); chat exclusion `PersonChatContext.java:5-8`; mentions
  via `MentionDetectionService` (active persons, word-start match); nightly check-in
  note sweep `NoteMentionCatchUp` in `DailySummaryJob`; candidate extraction
  `PersonExtractionService:149-170,442` (needs KNOWLEDGE_GRAPH + graph-maintenance
  switches).
- **Knowledge facts:** chat-only extraction (`FactExtractionListener.java:31`),
  candidate inbox, `includeInPrompt`, prompt block
  (`KnowledgeFactService.renderPromptBlock:150`; consumed `ChatService.java:416,771`).
  UI: Tudástár `/mezo/knowledge` (`router.tsx:438`), `BoopAboutPage` `/mezo/rolad`,
  settings preview via `PersonalContextAssembler.java:26-46`.
- **Correlation today:** `PatternDetectionJob.java:27` (metric Pearson);
  `PeopleMoodLinkDetector.java:27-50` (anonymous, mental-only, 42d, character feed);
  `PersonAffectTrendCalculator` (tone-based); `DerivedSeriesService.java:42`
  (`people:<name>` series from text signals only — check-in notes NOT included).
- **Patterns to follow:** code decides status, LLM never (`ReflectionReplyService`,
  `HypothesisLifecycle`); optional collaborators via `ObjectProvider`, fail-open
  (`ChatService.java:192,823`); async after-commit listeners swallow-and-log
  (IDENT-3); prompt blocks assembled in `ChatService.turnContext:764-778`.
- **Traps:** ArchUnit — companion → people only, never reverse; feature switches
  (`REFLECTION_SWITCH`, `PEOPLE_SWITCH`, `KNOWLEDGE_GRAPH_SWITCH`); persisted evidence
  labels need read-time formatting (S1 does exactly this); observation/pattern reply
  contract changes hit the contract-drift gate; regenerate `docs/CODEMAP.md`
  (`node scripts/gen-codemap.mjs`); FE tests in both mock and real mode.
- **Doc staleness found:** `me.md:425` ("mentions don't feed chat snapshot") is
  contradicted by `ContextSnapshotAssembler.java:139-169`; `PersonEntity.knownFacts`
  comment claims an AI writer that doesn't exist. Fix alongside S3.
- **Related bd issues:** epic mezo-b3pp (Deep Memory, foundation), mezo-eq85
  (Reflexió), mezo-eq85.12 (personal context for domain assistants), mezo-06o0
  (Emberek), mezo-i7x5v (unified memory serving mode), mezo-b3pp.39 (Tudástár profile
  card date), mezo-me75u.9 (U9 insights re-dress — coordinate S1/S6 with it).

## Out of scope

- No new memory/storage platform (mezo-i7x5v continues independently).
- No ranking or scoring of relationships ("who is your best friend") — private,
  non-judgmental posture (Monica lesson).
- Light mode (app is dark-only per Üveg canon).
- Approval-queue for person facts (owner chose auto-save + undo).

## Testing

Per slice, the usual gates: backend focused ITs (promotion path, refuted-never-
reproposed guard, extraction writers, effect calculators with threshold edge cases —
midnight-anchored fixtures per the known trap), FE tests in both modes, contract-drift
gate for API changes, CODEMAP regeneration. S4 calculators get pure-unit coverage with
synthetic series (small-N below threshold ⇒ hidden; direction/confidence tiers).

## S1 delta — structured evidence on the wire (2026-09-25, owner-approved direction)

**Session brainstorm finding (S1 recon):** the base spec's §S1 premise is stale. Since
mezo-me75u.12 the observation card already renders human evidence FE-side:
`observationEvidence.ts` regex-parses the raw persisted label
(`Source · YYYY-MM-DD · key=value; …`) into structured rows, and
`ObservationEvidence.tsx` renders icons, value pills, quotes and the check-in shift
chart. Raw `key=value` text survives only in (a) the team-feed post body
(`teamFeed.ts:200` joins `o.evidence` into prose) and (b) `tag`-fallback labels.
Moving *prose* formatting BE-side as originally written would break this rich
rendering and duplicate work.

**Owner decision (2026-09-25): "igazi egységesítés" now.** The long-term unification
is **structured evidence data from the backend + one shared FE display block**, not
prose from the server and not the FE's fragile regex re-parse of a machine string.
The backend owns the data and re-fetches sources losslessly; the frontend owns
presentation (labels, units, icons, layout).

### Design

1. **Contract:** `ObservationResponse.evidence` changes from `array of string` to an
   array of structured items (`companion.yml`):
   - `record`: `{ type: "record", source: <catalogue kind, e.g. check_in>,
     date: YYYY-MM-DD, time?: HH:mm, fields: map<string,string>, quote?: string,
     ref?: canonical ref }` — `fields` are the source record's own fields (metric
     values, no prose), `quote` the record's prose field, **untruncated at source**
     (BE caps at a generous display bound, ~500 chars).
   - `tag`: `{ type: "tag", text: string }` — legacy/statistical short labels pass
     through verbatim.
   FE and BE deploy together; no dual-format transition period. Contract-drift gate
   applies (regenerate `api/generate` + FE `pnpm generate:api`; mock fixtures in
   `frontend/src/data/insights/observations.ts` mirror the new wire shape).
2. **BE (`ObservationFeedService`):** for grounded cards, resolve each canonical ref
   in `evidenceRefs` through the same original-record catalogue
   `ObservationContextService` already uses (`exists()` pattern → a new structured
   `fetch()`): **re-read the source record and emit full, lossless fields** — this is
   the "use the data platform" move; the persisted, possibly truncated label is no
   longer the display source. Fail-open: an unresolvable ref (shouldn't occur —
   `validEventEvidence` already hides such cards) degrades to a `tag` item carrying
   the stored label. Legacy channel: stored free-text labels → `tag` items unchanged.
   **`pattern_event.evidenceRefs` is never rewritten** (LLM grounding text stays).
3. **FE:** `observationEvidence.ts` drops the regex parse + truncation-repair
   (`parseEvidence` on raw strings) and becomes a thin mapper DTO → the existing
   `EvidenceRecord`/`EvidenceTag` model; `FIELDS`/`SOURCE_ICON`/`SOURCE_NAME`
   presentation tables, `evidenceBlocks` (shift chart) and `ObservationEvidence.tsx`
   stay. `truncated` display state disappears (data is lossless now).
4. **Team feed unification:** `teamFeed.ts` stops dumping evidence strings into the
   post body; observation posts carry `evidence` structurally and the feed post
   renders the same shared evidence block (compact variant) as the card — one
   building block, every surface (card today; csapatfal S6 and hub inherit it).
5. **Button copy (unchanged from base §S1):** "Igen, ez igaz rám" / "Nem, ez nem
   stimmel" / "Beszéljük meg" in `ObservationCard.tsx` (+ `ackLine`),
   `NapPersonalInsight.tsx`, `FeedTrio.tsx`; choice values `watch`/`reject`/`talk`
   unchanged. Post-click ack copy names a concrete consequence (PAIR pattern), staying
   honest about today's behavior (watch = figyelés; durable memory arrives in S2).
6. **Out of S1 scope:** BE-side HU prose formatting (dropped — presentation stays FE);
   any change to `ObservationContextService.excerpt` (LLM grounding untouched);
   S2 promotion semantics.

### Testing (S1)

BE: focused ITs — structured evidence for grounded cards (re-fetched fields match the
source record, quote capped, no truncation marker), legacy labels as tags, fail-open
on missing ref; `CompanionObservationApiIT` round-trip updated. FE: both modes —
mapper unit tests replace parser tests (`observationEvidence.test.ts`), card/feed
component tests updated for new copy (6 test files sweep in one commit), team-feed
post shows evidence block not raw text. Contract regen + CODEMAP.

## S2 delta — user confirm → durable knowledge (2026-09-25, owner-approved)

**Session brainstorm findings (S2 recon):**

- The confirm button ("Igen, ez igaz rám") already sends `choice=watch` on the
  existing `/api/companion/pattern/{id}/reply` contract, and
  `HypothesisLifecycle.POSITIVE_CHOICES` already reserves both `watch` and `confirm`.
  **No contract change is needed**: S2 keeps `watch` on the wire and gives it its
  S1-approved meaning ("Megjegyeztem, hogy ez igaz rád") server-side.
- `knowledge_fact.include_in_prompt` **already exists** (default true) with a working
  PATCH endpoint and a toggle in the Tudástár (`KnowledgeListPage.tsx`). The base
  spec's "includeInPrompt-style toggle" needs **no new column and no new UI**:
  promotion lands the confirmed observation in the Tudástár where the toggle already
  works. S6 re-homes the view; S2 ships the linkage.
- Exact-fingerprint re-proposal of a refuted row is **already blocked** by the partial
  unique index on `hypothesis_key` (no status filter in `alreadyKnown`). The real gap:
  `openHypotheses` feeds only `proposed|monitoring` rows to the PROPOSE/CRITIQUE
  prompts, so a *reworded* duplicate of a refuted idea sails through.
- Prior art (researcher): Zep/Graphiti soft-supersession (never delete, timestamp +
  supersede), Letta/Claude discrete per-item prompt toggles, and the ChatGPT-memory
  lesson that a refutation must be a durable stored veto checked semantically at
  proposal time — exact-match absence is not enough. Proactive user-facing drift
  ("this may no longer hold") has no consumer precedent; keep it conservative.

### Design (S2)

1. **Shared confirm body.** `PatternService.applyEngineConfirm` becomes
   `applyConfirm(userId, pattern, source)` with source `ENGINE | USER` (existing
   callers pass ENGINE). Both paths: status→`confirmed` where terminal, append
   `confirmed` event (payload records the source), first-confirm promotion to
   `knowledge_fact` (guarded by `promotedFactId`), publish `PatternConfirmedEvent`.
   The promotion now **fills the fact's `provenance` envelope** with the pattern id
   and the confirm source (today it is empty). **Build deviation (conscious decision):**
   a planned row's user confirm (point 2 below) calls the promotion body directly rather
   than the shared `applyConfirm`, so it publishes `KnowledgeFactPromotedEvent` but
   **not** `PatternConfirmedEvent` — the pattern itself is not confirmed yet (it stays
   `monitoring`), so its graph pattern-node mirror still only follows an ENGINE confirm;
   only the knowledge-fact mirror reacts to a planned row's user confirm. A later engine
   confirm of the same row still fires `PatternConfirmedEvent` (promotion itself is a
   no-op via the `promotedFactId` guard), catching the graph node up.
2. **User confirm semantics** in `ReflectionReplyService` (`watch` choice):
   - Row **with a test plan**: promote (fact + graph) immediately, but status stays
     `monitoring` — the nightly engine loop continues and a later engine confirm
     strengthens/freezes as today (re-confirm never re-promotes; `promotedFactId`
     guard).
   - **Plan-less grounded holding row**: promote AND set status `confirmed`
     directly — the evaluator never touches plan-less rows, so leaving it
     `monitoring` would show "GYŰLIK" forever with nothing gathering.
3. **Refuted never resurfaces.** `openHypotheses` context for PROPOSE and CRITIQUE is
   extended with `refuted` and `rejected` rows (title + topic key) under a "NE
   javasold újra, átfogalmazva sem" instruction; the critique dedup check receives
   them too. Code-side guard stays the source of truth (unique index).
4. **Slow re-check + drift.** New quarterly job (own cron property + kill switch,
   `QuarterlyReviewJob` idiom, **09:20 — deliberately OUTSIDE the dawn cluster**: the job
   opens by calling `ObservationBudget.allows`, and the dawn cluster's obvious "free slot"
   sits inside the budget's own 22:00–07:00 quiet hours, which would have silently zero'd
   every quarterly pass; build deviation from the plan text's 04:20) over rows that are
   user-confirmed AND plan-less (planned rows are re-checked nightly by the
   evaluator already). For each, an LLM re-check against fresh
   `ObservationContextService` context (28d) returns holds/drifts/unknown + hedged
   prose; **code decides**: only on a drift verdict does it append an `observation`
   event via `PatternEventAppender` ("ez korábban igaz volt, az utóbbi hetekben
   másképp alakul" tone), surfaced through the existing feed +
   `AppNotificationKind.OBSERVATION_NEW` budget/dedup idiom (`QuickNoticeService`
   precedent). The confirmed fact is never edited or deleted by the job; at most the
   drift observation, once user-confirmed in a later cycle, supersedes it (S6 scope).
5. **Switches & layers.** Reply-path promotion runs under
   `COMPANION_SWITCH`+`REFLECTION_SWITCH` (reflection→companion.service import is
   established); graph sync stays the existing after-commit listener
   (`KNOWLEDGE_GRAPH_SWITCH` gated, fail-open). No new feature switch; the new job
   gets its own `cron.*.enabled` kill switch per house convention.

### Testing (S2)

BE focused ITs: user confirm on a planned monitoring row (fact inserted once,
provenance filled, status stays monitoring, graph event fires), user confirm on a
plan-less grounded row (fact + status confirmed), re-confirm idempotency, refuted
rows present in PROPOSE/CRITIQUE context, drift job appends exactly one hedged
observation event on a drift verdict and nothing on holds/unknown (midnight-anchored
fixtures). FE: both modes — no wire change expected; Tudástár shows the promoted
fact with the existing toggle. CODEMAP regen; contract-drift gate untouched (no yml
change).

### Final-review adjudications (2026-09-25)

- A drift row's own confirm (watch on a `pairKey` starting `PatternEntity.PAIR_KEY_DRIFT_PREFIX`)
  freezes `status=confirmed` and records the `confirmed` event, but does NOT promote a fact or
  publish `PatternConfirmedEvent`/`KnowledgeFactPromotedEvent` — superseding the ORIGINAL confirmed
  fact with the drifted claim is S6's scope, not this delta's.
- A refuted row (two-strike chip reject, or the engine's own miss-streak refute) that carries a
  `promotedFactId` and was never user-frozen mutes that fact (`include_in_prompt=false` via
  `KnowledgeFactService.muteFromRefutedPattern`, firing `KnowledgeFactChangedEvent`) rather than
  leaving a refuted claim still live in the prompt/graph; the fact is never deleted, only muted.
- A drift row itself is excluded from `KnowledgeRecheckService`'s own candidate set — it is the
  quarterly pass's OUTPUT, not a plan-less confirmed claim to re-litigate a second time.

## S3 delta — person fact memory (2026-09-26, owner-approved direction)

**Owner decisions (2026-09-26):**

1. **Known persons only.** Facts are captured only for persons already present (active)
   in the people list. An unknown name never auto-creates a person or a fact; it flows
   into the existing candidate-suggestion path ("vegyük fel?") and nothing is stored
   about them until the owner accepts. Low-confidence person resolution suppresses
   capture — never guess between two similar names.
2. **Sensitivity policy.** `sensitivity`-kind facts ARE captured and used in the chat
   context (where the owner initiates), but are **never eligible for the proactive
   message/intervention pipeline** — S5 must enforce this kind-level exclusion.
3. **Post-hoc chip with a minimal pending indicator.** Extraction stays async
   after-commit (reply latency unchanged). After each user turn the chat shows a
   minimal "still listening" indicator while the capture window is open; if a fact
   was captured, the "Megjegyeztem: …" chip with undo slides in beneath the reply;
   if not, the indicator disappears silently.

### Prior art (S3 recon)

- **ChatGPT memory** (openai.com/index/memory-and-new-controls-for-chatgpt): inline
  "Memory updated" chip at capture + a settings list with per-item delete + a
  no-capture mode. Adopted (chip upgraded to undo-first for a single-user app).
- **Claude memory** (claude.com/blog/claudes-memory-works-everywhere...): recall-time
  transparency (provenance makes a used fact inspectable) and default-quiet handling
  of sensitive categories. Adopted — matches owner decision 2.
- **Monica CRM schema** (drawsql.app/templates/monica): validates the ≤5-kind
  taxonomy almost 1:1; its important_date→yearly-reminder pairing is noted for S5.
  Its many-satellite table design is rejected in favor of one flat per-fact row.
- **Clay CRM**: external enrichment about third parties — **rejected outright**.
  First-party-only provenance ("csak azt tudom, amit te mondtál el") is the app's
  anti-creepiness firewall and part of the feature's voice.
- **Stale-fact analysis** (daily.dev "your AI's most dangerous memory"): the worst
  failure is a fact that *was* true. Adopted: timestamp + active flag,
  **supersede-not-append** for volatile kinds (`relationship_state`: a new active
  fact of the same kind for the same person deactivates the previous one), undo is
  a durable veto (no resurrection).

### Codebase terrain (S3 recon)

- Chat writer pattern: `FactExtractionListener.java:22-38` (`@Async` AFTER_COMMIT on
  `ChatTurnCompleted`, swallow-and-log) + `FactExtractionService.java:73` (one
  cheap-tier call, normalized dedupe `:93-123`, per-turn cap). The person variant is a
  sibling listener/service in companion on the same event.
- Nightly: `PersonExtractionService.java:207` `extractFor` (pre-spend gate `:215-223`,
  single LLM call, `persistNight` one TX via self-proxy `:190,250`); reached from
  `GraphMaintenanceJob.java:76-79` phase 4 via `ObjectProvider`. Person facts join the
  same LLM call; their persistence must not be able to sink `persistNight`
  (spec lesson 11: per-row `TransactionTemplate`+`REQUIRES_NEW`).
- Storage home: `feature/people`; changelog `db/changelog/1.1.0/script/` with
  `202609241200_mezo-a9bo7_team_edition.sql` as the create-table example;
  `OwnedEntity` + `@SQLDelete/@SQLRestriction` like `PersonEntity`. No-resurrection
  needs a soft-delete-blind existence check (`existsSourceRefIncludingDeleted` idiom).
- Consumption: `PersonChatContext.java:5-8` holds the deliberate exclusion;
  `PeopleSnapshotBlock.java:55-79` renders `[Emberek]`; snapshot rides only the full
  `render` path (`ContextSnapshotAssembler.java:139-169`) — CHAT-gear turns
  (`ChatService.chatGearContext:786`) carry no snapshot, deliberately unchanged.
  Fact reads in the turn must use projections (MentionSignal idiom) and add no new
  DB failure modes (PeopleSnapshotBlock javadoc :30-38 TX-poison trap).
- Chip wire: `MessageResponse` (`companion.yml:946-980`) has no annotation array;
  streamed chips would have to ride the `done` row — but extraction finishes AFTER
  `done`, hence the post-hoc fetch design below. Undo precedent:
  `DELETE /api/people/{personId}/mentions/{mentionId}` + `usePeople().undoMention`.
- Toggle/list FE pattern: `knowledgeApi.ts:12-40` + `knowledgeHooks.ts:67-98` +
  `KnowledgeFactRow.tsx`; person page card: `PersonDetailPage.tsx:205-215`
  ("Amit Mezo tud", renders legacy `knownFacts`); mock seeds `data/me/people.ts`,
  `data/insights/chat.ts`.
- Switches: no new switch (S2 precedent). Chat writer gates
  `COMPANION ∧ COMPANION_EXTRACTION ∧ PEOPLE` (people beans via `ObjectProvider`);
  nightly inherits `COMPANION ∧ PEOPLE` from `PersonExtractionService`. New
  `LlmCallContext` slug needs an FE admin label (lesson 14).
- Staleness to fix in this slice: `docs/features/me.md:431` (mentions "don't feed the
  snapshot yet" — they do), `PeopleService.java:301` + `people.yml:56` ("AI-curated"
  knownFacts — no AI writer exists) vs `PersonEntity.java:20-23` ("owner-curated") —
  align all on "legacy/seed, read-only".

### Design (S3)

1. **Storage (feature/people).** New `person_fact` table + `PersonFactEntity`
   (`OwnedEntity`, soft delete): `person_id` FK, `kind` enum
   (`preference | relationship_state | shared_activity | important_date | sensitivity`),
   `text`, `confidence`, `source_ref_kind` + `source_ref_id` (chat turn / nightly day),
   `extracted_at`, `active` (undo/supersede target), `include_in_prompt`
   (default true), `seen_at` (nullable — nightly captures show "új" until first seen).
   Writes go through a people-owned **`PersonFactService`**: capture (with normalized
   dedupe + soft-delete-blind no-resurrection check on source ref + supersede logic
   for volatile kinds), undo/deactivate, toggle, list. `person.known_facts` stays
   read-only legacy/seed.
2. **Chat writer (companion).** `PersonFactExtractionListener` — sibling of
   `FactExtractionListener` on `ChatTurnCompleted`, gated
   `COMPANION ∧ COMPANION_EXTRACTION ∧ PEOPLE`, people beans via `ObjectProvider`,
   swallow-and-log. One cheap-tier call (new slug `companion_person_fact_extract` +
   admin label) extracting facts *about mentioned persons*; grounding: only persons
   resolvable with high confidence to an existing active person; unresolved names →
   existing candidate path, no fact. Per-turn cap; kind whitelist enforced in code.
3. **Nightly writer.** `PersonExtractionService`'s single LLM call additionally emits
   person facts for known persons from the night's narrative. Persistence runs after
   `persistNight` in its own per-fact TX (`TransactionTemplate` + `REQUIRES_NEW`,
   lesson 11) so a fact failure never sinks mentions. No toast; `seen_at=null`.
4. **Chip (post-hoc fetch).** No change to reply generation. New people-owned
   endpoint `GET /api/people/facts?sourceRefKind=chat_turn&sourceRefId={messageId}`
   (returns captured facts for that turn) and
   `DELETE /api/people/{personId}/facts/{factId}` (undo = deactivate). FE: after a
   user turn, ChatPage shows a minimal pending indicator and polls the fetch endpoint
   on a short backoff (~2s/5s/10s, then gives up silently); on hits it renders the
   "Megjegyeztem: …" chip(s) with undo beneath the reply (RefChips/RecalledMemoriesRow
   idiom). "Ezt ne jegyezd meg" in-conversation works because undo deactivates and
   the no-resurrection key blocks re-capture. **No `MessageResponse` change** — the
   chip is FE state fed by the fetch endpoint; only `people.yml` changes
   (contract-drift gate + `pnpm generate:api` still apply).
5. **Consumption.** `PersonChatContext` gains a facts list (active AND
   `include_in_prompt`, projection query); `PeopleSnapshotBlock` renders them under
   `[Emberek]` with hedged phrasing and updates its "SOSEM" javadoc. Full-context
   turns only (chatGearContext untouched). `sensitivity` facts are included here but
   the block/service marks the kind's proactive exclusion for S5 (constant on the
   people side, documented).
6. **Person page FE.** The "Amit Mezo tud" card lists `person_fact` rows: text, kind
   tag, provenance (honnan/mikor), "új" badge (`seen_at` null → mark seen on view),
   per-fact include-toggle (knowledge toggle idiom) and delete/undo. Legacy
   `knownFacts` strings remain as static legacy entries. Üveg canon; **clickable
   prototype (chip + person card) before implementation, owner OK required** per
   /uvegesites §1.
7. **Docs.** Fix the three stale claims (me.md, PeopleService javadoc, people.yml
   summary, PersonEntity comment); update `docs/features/me.md` + `companion.md`
   (knowledge-base skill); CODEMAP regen.
8. **Unification note.** No new screen: capture lives in chat, management on the
   person page; the hub view is S6 (csapatfal world). Person facts enter the same
   prompt-block system as knowledge facts and observations, feeding S4 (named series
   grounding) and S5 (proactive inputs) — one engine, one experience.

### Testing (S3)

BE focused ITs: chat capture for a known person; unknown name → candidate only, no
fact; low-confidence resolution → no capture; supersede on `relationship_state`;
dedupe + per-turn cap; undo → deactivated fact and no resurrection on re-sweep of the
same source ref; nightly emit persists per-fact (one poisoned fact doesn't sink the
night); snapshot block includes active+toggled facts and excludes inactive/toggled-off;
midnight-anchored fixtures. Contract tests for the two new people endpoints. FE both
modes (`CI=true`): chip + pending indicator + undo flow, person card list/toggle/
delete/"új" badge, mock fixtures (`data/me/people.ts`, chat fixture) updated;
`pnpm build`; affected layout specs; labels completeness (new LLM slug); contract-drift
gate on `people.yml`; CODEMAP regen; runtime pass with the `verify` skill (dark, 320px,
reduced motion).

## S4 delta — named effect tracking (2026-09-26, owner-approved direction)

**Owner decisions (2026-09-26):**

1. **Person effects surface NOW, on the person page.** A restrained "Hatás" glass card
   on `PersonDetailPage` (üveg canon, prototype + owner OK before build) shows the
   per-person effects on mood/energy/stress. S6's hub re-lists the same rows later.
2. **Event-type effects learn silently.** They are computed and feed the nightly
   reflection as hypothesis candidates, but get NO visible surface in S4 — the hub's
   Hatások section (S6) is their first listing. No temporary Minták-page list.

### Prior art (S4 recon)

- **Exist.io** (kb.exist.io/article/37, developer.exist.io/reference/correlations/) —
  adopted: strength and confidence as two orthogonal signals; symmetric, non-causal
  sentences readable in either direction; an explicit "strong but low-confidence" state;
  drift handled by full periodic recompute, no expiry machinery. Rejected: Pearson on
  raw values (weak for ordinal 1–10 self-reports).
- **Bearable** (bearable.app/support/howto/the-factor-effect-report/) — adopted: the
  tagged-day vs untagged-day comparison as the core framing, and a per-metric
  minimum-data gate of the shape "≥N days with, ≥M days without, metric logged on
  each". Rejected: their 3+3 threshold (too noisy) and the 4-window fan-out
  (multiplies comparisons; we keep same-day only in S4, offset windows are a future
  option).
- **Daylio** (daylio.net/faq/activity-and-mood-statistics/) — adopted: a coarse
  qualitative confidence tier is enough for a lay audience (matches the house
  `gyenge/közepes/erős` words); "might be influencing"-style hedging by construction.
- **Cliff's delta** (Robust CIs for effect sizes, ResearchGate 252242985; CRAN
  `effsize`) — adopted as the strength statistic: non-parametric, tie- and
  outlier-robust, valid at 10–60 points, reads as a probability statement ("napokon,
  amikor X, ez többször volt magasabb, mint nem"). Magnitude bands: |δ|<0.147
  negligible, <0.33 small, <0.474 medium, else large. Mean difference shown alongside
  as the human-scale number ("átlagosan ~fél ponttal").
- Nobody in this space does formal multiple-comparison correction; the practical guard
  is the minimum-data gate + only-above-band surfacing. Adopted.

### Codebase terrain (S4 recon)

- **Detector to generalize:** `feature/character/detector/PeopleMoodLinkDetector.java`
  — today anonymous (any mention), MENTAL-only, 42d, band-flip character-feed signal.
  It STAYS as the character-feed echo; S4 builds the named engine on the companion
  side, it does not rewrite the detector.
- **Person-day signal:** the mention table (`MentionEntity`: person_id, ts,
  context_label, source_ref_kind incl. `checkin_note`, `chat_turn`) is the richest
  "interacted with X on day D" source — richer than `DerivedSeriesService`'s
  text-signal `people:<név>` series (journal+gratitude only, name-keyed not id-keyed).
- **Metrics:** `check_in` day means via `MetricSeriesService`
  (`CHECKIN_MENTAL/ENERGY/STRESS`); per-metric nulls must be skipped per metric;
  **stress polarity is inverted** (higher = worse) — copy direction flips.
- **Event-type taxonomy reality check:** `activity_log` has NO event taxonomy
  (gamification skill keys only). Real day-flag sources: `workout_session` (edzés),
  mention `context_label` aggregated to day (closed 8-value set: munka, csalad,
  baratok, edzes, konfliktus, kozos_program, segitseg, egyeb), text-signal `TOPICS`
  day topics. The plan enumerates the initial set from THESE.
- **Machinery to reuse:** `PatternGate.evaluate` BINARY branch (with/without gating,
  IMBALANCED_GROUPS verdict); `PatternDetectionService` upsert-by-key nightly idiom;
  `HypothesisPipelineService.run(userId, extraContext)` — the documented injection
  seam `ReflectionJob` currently passes `null` to.
- **Layering:** computation lives in companion (companion→people reads are legal, the
  reverse is not); people code never imports companion; `companion.service` never
  imports `companion.reflection`. Effects live in a companion-owned table; the person
  page reads them through a companion endpoint, so no people-owned write port needed.
- Traps inherited: per-row `TransactionTemplate`+`REQUIRES_NEW` for multi-row nightly
  writes (lesson 11); stable hypothesis keys or re-propose loops (S2 fingerprints);
  no new LLM call planned → no FakeCompanionLlm/admin-label work (lesson 17 applies
  only if that changes); `PersonAffectTrendCalculator` (mention-tone weekly arc) is a
  DIFFERENT thing that stays — naming on the person page must distinguish them.

### Design (S4)

**Engine (companion, code decides everything, no LLM in the loop):**

- New pure calculator `EffectLinkCalculator` (companion): for a subject-day set
  (days the subject "happened") vs complement days inside a **60-day rolling window**,
  per metric (mental, energy, stress day means, per-metric null-skip), computes
  Cliff's delta, mean difference, group sizes. Pure, stateless, `today` a parameter.
- **Subjects:**
  - `person:<personId>` — day set = distinct mention days for that person (all
    mention sources).
  - `event:<key>` — day set from the enumerated initial taxonomy (workout days,
    mention-context day flags, text-signal topic days; exact set in the plan).
- **Minimum-data gate per (subject, metric):** ≥5 subject-days and ≥10
  complement-days, each with that metric logged; below it no row is stored (or an
  existing row is marked below-threshold and hidden). `PatternGate`-style imbalance
  guard applies.
- **Strength & confidence separated:** strength = |δ| band (negligible/small/medium/
  large → HU: elhanyagolható/enyhe/közepes/erős, negligible rows are not shown);
  confidence = `gyenge/közepes/erős` tier from sample sizes (house words), computed
  independently of strength. Owner confirmation of a RELATED observation (same
  subject+metric) raises the displayed confidence one tier (cap erős) — read at
  render time from confirmed pattern rows, not stored.
- **Storage:** new companion-owned table `effect_link` (Liquibase 1.1.0): user_id,
  subject_kind (person|event), subject_key (uuid or taxonomy key), metric, direction,
  cliffs_delta, mean_diff, subject_days, complement_days, strength_band,
  confidence_tier, window_days, computed_at; unique (user, subject_kind, subject_key,
  metric). **Nightly full recompute + upsert** (Exist-style drift handling); rows
  falling below gate/band are deleted — the table is a cache of the current window,
  never history.
- **Scheduling:** computed inside the nightly reflection job as a pre-step before the
  hypothesis pipeline (fail-open try/catch; no LLM, no ObservationBudget concern),
  behind the existing COMPANION∧REFLECTION switches. No new feature switch.
- **Hypothesis injection:** strong findings (|δ| ≥ medium AND confidence ≥ közepes)
  are formatted (code-side, hedged HU, stable ordering) into the `extraContext`
  string of `HypothesisPipelineService.run` — replacing the current `null` from
  `ReflectionJob`. The LLM may then propose them as observations through the normal
  PROPOSE/CRITIQUE path; S2's fingerprints/closed-rows guard prevents re-proposing
  refuted ones. No direct `GroundedHypothesisPublisher` minting in S4.

**API + FE (person effects only, per owner decision):**

- New companion endpoint `GET /companion/effects?personId=` (companion.yml, contract
  gate) returning the person's effect rows: metric, direction, strength_band,
  confidence_tier, mean_diff, subject_days, hedged HU sentence assembled ON THE FE
  from structured fields (no server-side prose).
- `PersonDetailPage` "Hatás" card (üveg canon: glass, one accent, Titanium sprite
  icon, reduced-motion branch): up to 3 rows (one per metric), each showing the
  hedged sentence ("Úgy tűnik, azokon a napokon, amikor X szóba kerül, nyugodtabb
  vagy" style), strength and confidence as two separate small indicators, and the
  sample-size hint ("N nap alapján"). Below-gate: the card simply doesn't render
  (no "needs more data" nag). Copy is symmetric and non-causal; stress direction
  flipped. Named clearly apart from the existing mention-tone weekly arc.
- Prototype extends the person-page pattern per /uvegesites §1 (HTTP serve, ?v=N),
  owner OK before build. Mock mode: fixture effects in `data/me/people.ts` mocks.

**Unification note (standing question):** S4 deliberately routes its strong findings
into the SAME nightly hypothesis pipeline (S2) instead of growing a parallel
insight channel — effects become observations → confirmed knowledge → S5 proactive
use, one engine. The visible surface stays on the person page now and joins the hub
(S6) later; no csapatfal surface in S4 (the csapatfal consumes downstream S5/S6
output).

### Testing (S4)

Pure unit coverage for `EffectLinkCalculator` (synthetic series: clear positive,
clear negative, ties, per-metric nulls, below-gate, imbalance, stress polarity);
midnight-anchored fixtures for window math. Focused ITs: nightly recompute upsert +
delete-below-gate; extraContext injection contains only above-band findings, stable
order; confirmed-observation confidence bump. Contract tests for the new companion
endpoint + contract-drift gate (companion.yml, `pnpm generate:api`, mock fixtures).
FE both modes (`CI=true`): Hatás card render/hide, strength vs confidence shown
separately, mock fixtures; `pnpm build`; affected layout specs; CODEMAP regen;
runtime pass with the `verify` skill (dark, 320px, reduced motion).

## S5 delta — proactive use of confirmed knowledge (2026-09-26, owner-approved direction)

**Terminology correction:** the base spec's "JITAI-lite intervention/heartbeat pipeline
(mezo-b3pp W5.2)" names retired machinery. The living proactive channel is the unified
**companion feed** (`companion_message` kinds morning/midday/evening/sleep/weight/people)
plus the one-advice-card-per-day channel (`docs/features/proactive.md:20-41`). S5 targets
the feed kinds; the advice channel is untouched.

**Owner decisions (2026-09-26):**

1. **Apropó-only.** Proactive memory use fires only on a concrete, code-matched trigger
   ("null intervention" is first-class); no trigger-less "did you know about yourself"
   reminders — periodic recall is the S6 hub's job.
2. **No calendar/plans feature.** Triggers come only from what the user already tells
   the app: (a) same-day mentions of a person/event-type, (b) yesterday's events,
   (c) today's planned workout (the only genuinely forward-looking signal).
3. **Hybrid surface.** Timely inserts ride the EXISTING scheduled feed messages
   (no new notification kinds); effect insights ALSO become a new csapatfal
   evening-edition candidate source, narrated by a character.
4. **At most one memory-grounded insert per message** (each of the three daily kinds
   may carry one); code pre-selects the single best trigger, the LLM only phrases it.
5. **Sensitivity person facts are INCLUDED in proactive context** — the owner wants
   the "it really knows me" feeling; this consciously overrides S3's
   `PROACTIVE_EXCLUDED_KINDS` stance for the S5 consumer. Guard: the prompt instructs
   that sensitive facts are raised tactfully, in gentle question form, never
   declaratively.
6. **Hedged, non-causal phrasing always** ("általában", "hajlamos", never "mert"),
   strength/confidence-aware, per the Exist.io contract already used by S4.

### Prior art (S5 recon)

- **JITAI decision framework** (m-path.io/learn/what-is-jitai/) — adopted: the exact
  S5 shape is canonical JITAI: tailoring variables (confirmed facts/effect links),
  decision points (scheduled feed generations), decision rules (deterministic code
  matching, with *not intervening* as a first-class option), intervention options
  (phrasing variants). Rejected: micro-randomized trials / learned decision rules
  (single-user overkill).
- **Notification-fatigue trials** (journals.plos.org/plosone 0169162; CHI 2024
  3613904.3641993) — adopted: few well-timed context-anchored prompts beat volume;
  context-matched delivery outperforms time-only schedules. Confirms riding existing
  scheduled messages instead of new pushes, and the per-message cap.
- **Exist.io** (kb.exist.io/article/37) — adopted: hedged non-causal language baked
  into product copy; only confirmed/strong knowledge earns proactive rights.
  Rejected: weekly retrospective cadence (S5 needs same-day timing).
- **Google Now** (en.wikipedia.org/wiki/Google_Now) — adopted: the hybrid answer to
  the surface question — browsable cards (csapatfal edition posts) for insights,
  timely delivery reserved for the small budgeted set; per-insight "why"/mute
  affordances (full controls land in S6). This resolved the unification question:
  the engine is ONE (effect_link + knowledge_fact + person_fact read paths), the
  surfaces are the feed and the csapatfal, each doing what it is for.
- **Replika** (apps.apple.com replika) — adopted: persona-voiced proactive check-ins
  grounded in visible, user-confirmed memory; every message must trace to a fact the
  user can inspect (S6). Rejected: check-ins without a concrete trigger (the recorded
  annoyance/creepiness path).

### Codebase terrain (S5 recon)

- **Composer:** `CompanionMessageGenerator.generateMorning`
  (`proactive/service/CompanionMessageGenerator.java:282-356`) has TWO paths — legacy
  inline payload (already carries `knowledgeFactService.renderPromptBlock` at `:312`,
  midday/evening ~`:580`) and the contextual path (`generateContextual:828` →
  `FeedGenerationService` with `FeedContextAssembler.java:23-42`). **A block added to
  only one path is dead under the other** — S5 wires BOTH seams. Optional-collaborator
  idiom: `ObjectProvider` + fail-open try/catch (`reflectionDigest:368-380`).
- **Crons:** `CompanionMessageJob` 05:45/12:30/20:30, one switch
  `mezo.techcore.cron.feed-job.enabled`; kinds idempotent by `(user, date, kind)`.
- **S2 read path:** `KnowledgeFactService.renderPromptBlock`
  (`companion/service/KnowledgeFactService.java:160-174`) — already in chat AND the
  legacy composer path; NOT in the contextual path (`PersonalContextAssembler` carries
  preferences/persona only).
- **S3 read path:** `PersonFactService.promptFacts` (`people/service/
  PersonFactService.java:145`); `PROACTIVE_EXCLUDED_KINDS={sensitivity}` at `:44` was
  minted for S5 — per owner decision 5 it is NOT applied by the S5 consumer; its
  javadoc and `PeopleSnapshotBlock.java:31-32` (the "no [Emberek] in proactive" stance)
  are updated to record the reversal.
- **S4 read path:** `EffectLinkService.promptBlock` (`companion/reflection/service/
  EffectLinkService.java:150`, strong+confident rows, cap 6, hedged HU) — reusable
  nearly as-is; `effectsForPerson:174`; taxonomy `:84-89`
  (edzes, munka, csalad, kozos_program, konfliktus, pihenes). Topic-key matching must
  use `normalizedTopicKey` semantics (lesson 20).
- **Trigger signal sources:** same-day/yesterday person-days from the mention table
  (`MentionEntity`: person_id, ts, context_label); day event-flags from the S4
  retrospective taxonomy sources; planned workout via `WorkoutSessionEntity`
  status=planned (snapshot's "Ma (terv):" line, `ContextSnapshotAssembler.java:310`).
- **Csapatfal:** evening edition exists (`feature/character/service/edition/`,
  `TeamEditionService`, `EditionCandidateCollector.java:49-56` — sources today:
  pattern/pair/prediction/experiment/konzilium/fuel_day/checkin_coverage;
  NO companion_message/effect source yet). `TEAM_EDITION_SWITCH`; slug
  `character_edition` already on the budget throttled-features list.
- **Layering:** proactive imports companion.service freely; character→companion.reflection
  legality must be verified against `ArchitectureTest` — if forbidden, use the port
  inversion idiom (`FeedMessageKindSource` precedent). `companion.service` never
  imports `companion.reflection` (lesson 12).
- **Budget:** global USD cap pre-flight in `LlmCallContextHolder.runWith`; S5 adds NO
  new LLM call (rides `proactive_feed` and `character_edition` slugs) → no new admin
  label, no FakeCompanionLlm branch (lesson 17); no throttled-list decision needed.

### Design (S5)

**Trigger engine (code decides, LLM phrases):**

- New `ProactiveMemoryBlock` collaborator in `proactive` (exact package/layering per
  plan + ArchUnit): given (userId, messageKind, today), it
  1. collects candidate triggers: same-day person mentions + event-type day flags
     (midday/evening kinds), yesterday's person/event-type days (morning kind),
     today's planned workout (morning kind);
  2. matches candidates against `effect_link` rows (person by id; event-type via
     normalized topic key) — only strong+confident rows fire;
  3. applies a **cooldown**: a fired (subject, metric-direction) pair does not fire
     again for 3 days — the fired trigger key is persisted (smallest workable
     mechanism chosen in the plan, e.g. a marker on the `companion_message` row);
  4. deterministically selects **at most ONE** trigger (priority: same-day > planned
     workout > yesterday), and renders an `[Aktuális apropó]` prompt block: the
     matched fact/effect in hedged wording + an instruction to weave AT MOST one
     caring, forward-looking (same-day/planned) or follow-up (yesterday) sentence
     into the message — or nothing if it does not fit naturally.
- The block is injected at BOTH composer seams: the legacy inline payload of
  morning/midday/evening, and the contextual path's `facts` seam /
  `FeedContextAssembler`.
- **Person facts in the composer:** morning context additionally gets
  `PersonFactService.promptFacts` for the people actually involved in the selected
  trigger (not a dump of everyone) — ALL kinds including sensitivity, with the tact
  instruction (owner decision 5). `PeopleSnapshotBlock`/`PersonFactService` javadocs
  updated to record the stance reversal.
- Knowledge facts (`renderPromptBlock`) are added to the CONTEXTUAL path so both
  paths carry them (today only the legacy path does).

**Csapatfal edition source (character):**

- A new edition candidate source: effect insights — `effect_link` rows that are
  strong+confident and NEW or materially CHANGED since the previous edition
  (band change or sign flip), capped (e.g. 1 per edition), mapped to an
  `EditionCandidate` and narrated by `EditionVoiceWriter` in the character's voice,
  hedged non-causal. Gated by the existing `TEAM_EDITION_SWITCH`; degrades exactly
  like other candidate sources. Layering via direct import if legal, else a
  companion-owned port.

**Non-goals (S5):** no new message kinds, no new notification/push channel, no new
LLM slug, no new FE surface (feed + csapatfal render what already exists), no
calendar/plans feature, no why-chip/mute UI (S6 owns transparency controls).
No OpenAPI contract change is expected; if the plan finds one necessary it goes
through the full merge chain (lessons 21–22).

### Testing (S5)

- Unit: trigger collection per kind (same-day/yesterday/planned), effect matching via
  normalized topic keys (seed through the publisher's normalizer, lesson 20),
  cooldown suppression, single-trigger selection priority, block rendering (hedged
  wording, tact instruction present when a sensitivity fact is included, empty
  output when nothing fires).
- Fixtures anchored to the queried day, never now-minus-N-hours (midnight trap).
- Composer ITs: BOTH paths carry the block (legacy payload contains
  `[Aktuális apropó]`; contextual path context contains it too); no block → message
  generates unchanged.
- Edition ITs: effect candidate appears only when new/changed strong+confident rows
  exist; switch off → source silent; existing candidate sources unaffected.
- Budget/idempotency untouched: one message per (user, date, kind) still holds.

## Facts-always delta — minden bekapcsolt tény, minden csatornán (2026-09-27, owner-approved direction, mezo-d6ivw.8)

### Owner decisions (2026-09-27)

- **Every enabled fact is always in the companion's head.** The top-10 selection goes
  away: `include_in_prompt` becomes the ONLY filter, on every injection channel (chat
  AND proactive/generators). The user's toggle is the contract; "bekapcsolva, de most
  kimarad" must cease to exist as a state.
- **The conversation-first chat path injects the facts block automatically** — the
  block is passively available; the model need not use or mention it ("mindig benne
  van, de nem kell mindig használnia").
- **High safety ceiling (owner set 200, 2026-09-27), not a working limit**: a cap exists only as a never-normally-hit
  brake; when it is ever approached, the answer is consolidation (merge/compress facts),
  not rank-and-drop. Consolidation itself is out of scope here (S6+).

### Design

**Backend — injection**

- `ChatService.conversationContext` (`ChatService.java:503-508`) appends
  `knowledgeFactService.renderPromptBlock(userId)` as a sibling block, exactly as the
  legacy `turnContext` does. This single edit covers sync `sendMessage`, SSE
  `prepareTurn`, and `openingTurn` (all route through `routeAndAssemble` /
  `conversationContext`). NOT inside `PersonalContextAssembler` — that would leak facts
  into the settings preview endpoint and break its "preview = prompt" contract.
- The block lives in the **volatile half** (second system message after history), never
  in the cacheable stable voice prompt (mezo-ozri.5 discipline).
- The legacy path, CHAT gear behavior, and `renderNewPatternFactsBlock` (ÚJ FELISMERÉSEK)
  are untouched: with all facts injected, the fresh-pattern inclusion guarantee is
  subsumed on the conversation path; the legacy highlight channel stays as is.
- `get_personal_context(scope=facts)` tool description gains a note that the confirmed
  facts are already present in context (avoids a wasted planner read); the tool itself
  stays (it is the path for `scope=all` and legacy-off setups).

**Backend — limit semantics**

- `mezo.companion.facts.top-n: 10` (1..50) is replaced by
  `mezo.companion.facts.prompt-cap: 200` (1..500) in `CompanionProperties.Facts`.
  `topFactsForPrompt` keeps its ordering (reinforcement DESC → citation tie-break →
  createdAt DESC) and applies the cap as a safety brake only; when the cap trims
  anything, log a WARN naming the count (the future S6 hub can surface it).
- The rename deliberately breaks any stale `top-n` override at startup (fail-fast via
  `@ConfigurationProperties` binding) rather than silently keeping 10.
- Fan-out is intentional: all `renderPromptBlock` consumers (8+ proactive generators,
  `FeedContextAssembler`, `HypothesisPipelineService`, the tool) widen to "all enabled"
  — owner explicitly wants one memory, same everywhere. `CharacterHistoryReads`' own
  top-40/300-char cap is a different, deliberate budget and stays.

**Backend — passive-use preamble**

- `FACTS_HEADER` gains one instruction line (Claude-memory pattern): use naturally when
  relevant; never enumerate, never cite the memory ("Ezeket tudod róla korábbról.
  Használd természetesen, amikor releváns — ne sorold fel, és ne hivatkozz arra, hogy
  'megjegyezted'."). Shared across channels on purpose.

**Frontend — Tények view stops lying**

- `bucketFacts` collapses to two buckets: enabled (all injected) and disabled.
  The "Bekapcsolva, de most kimarad" section is deleted. `PROMPT_TOP_N` mirror constant
  is removed (`knowledge.ts:9`); `PATTERN_ACK_DAYS` stays (legacy highlight channel).
- Hero + section copy (`FactsView.tsx:107`, `KnowledgeListPage` hero) and the FAQ
  (`HowItWorksView.tsx:21`) are rewritten: "ami be van kapcsolva, azt a társ minden
  beszélgetésben és üzenetben tudja rólad". `?fact=` deep link and highlight unchanged.

**ADR/doc updates**

- ADR 0043 gets an amendment note: confirmed personal facts join date/preferences as
  initial background (they are identity, not data lookup); data snapshots/memory search
  remain tool-only. `companion.md` §facts injection (:924, :1943-1945, :2319, config
  table :6239) and `insights.md` §2.4 updated to the new reality.

### Prior art (researcher, 2026-09-27)

- **Adopted — ChatGPT "Model Set Context"**: production pattern for confirmed facts is
  inject-all-every-turn as a flat one-line list, storage-capped rather than
  injection-ranked ([embracethered deep dive](https://embracethered.com/blog/posts/2025/chatgpt-how-does-chat-history-memory-preferences-work/)).
- **Adopted — Claude memory passive phrasing**: preamble instructing natural, silent
  use; never enumerate or attribute to memory ([prompt archive](https://github.com/jeremylongshore/prompts-intent-solutions/blob/main/claude-memory-system-prompt.md)).
- **Adopted (as future valve) — Letta/MemGPT budgeted core blocks**: when the block
  outgrows its budget, consolidate/rewrite, don't rank-and-drop ([Letta blog](https://www.letta.com/blog/agent-memory/)). Here: the prompt-cap WARN is the tripwire; consolidation is S6+.
- **Considered, mitigated — Willison's context-contamination critique**: facts are
  user-confirmed, user-visible, per-fact toggleable, so the involuntary-dossier risk is
  addressed; keep the block clearly delimited ([post](https://simonwillison.net/2025/May/21/chatgpt-new-memory/)).
- **Grounding — Lost in the Middle (Liu et al., TACL 2024)**: 30–80 terse facts
  (~0.5–1.5k tokens) are well below measurable degradation; keep the block contiguous
  and near an edge of the context ([arXiv 2307.03172](https://arxiv.org/abs/2307.03172)).
- **Rejected for now**: per-line save-date stamps (ChatGPT does this; adds tokens, no
  owner need yet), retrieval-based selection for chat (NEW memory mode stays SHADOW).

### Codebase terrain (investigator, 2026-09-27)

- Injection point: `ChatService.java:484-508` (`routeAndAssemble` → `conversationContext`);
  volatile-half delivery `SpringAiCompanionLlm.java:405-423`; planner/answerer both see
  the context (`ConversationTurnService.java:73-125`, `TurnPlanner.java:92`).
- Block renderer: `KnowledgeFactService.java:45,161-204` (`FACTS_HEADER`,
  `renderPromptBlock`, `topFactsForPrompt`); config `CompanionProperties.java:174-180`,
  `application.yml:911-914`.
- FE mirror: `knowledge.ts:9`, `factCopy.ts:125`, `FactsView.tsx:107`,
  `HowItWorksView.tsx:21`, `KnowledgeListPage.tsx:130`.
- Test surface: `PersonalContextConversationIT` (+ FakeCompanionLlm echoes system halves
  → cheap block-presence IT), `KnowledgeFactServiceIT:163-204` (top-10 cutoff fixture →
  becomes cap test), `CompanionPropertiesIT:59` (asserts 10 → new cap),
  `ConversationFirstIT` family, FE `factCopy.test.ts`.
- **Traps**: context re-sent every planner round → the block is paid ~(rounds+2)× per
  turn (fine at this scale, noted); no input-side token budget exists — the prompt-cap
  is the only brake; ADR 0043 wording must be amended, not silently violated;
  contract-drift gate only if an API field is added (none planned — FE no longer needs
  the number once buckets collapse).

### Out of scope (facts-always)

- Fact consolidation/merge when approaching the cap (S6+, with the hub).
- NEW memory-mode retrieval for chat; per-conversation memory off-switch.
- Editing/deleting facts from the Tények view, per-fact provenance detail rows,
  pagination — S6 hub scope (owner flagged them 2026-09-27; carried on mezo-d6ivw.6).

### Testing (facts-always)

- IT: conversation path context contains `MEGERŐSÍTETT TÉNYEK` with an 11th+ fact
  present (proves no top-10), and honors `include_in_prompt=false`; opening turn too.
- IT: cap trim logs WARN and keeps strongest-first ordering.
- Existing fixture updates: `KnowledgeFactServiceIT` cutoff, `CompanionPropertiesIT`.
- FE: bucketing tests collapse to enabled/disabled; copy snapshot updates; both modes.

## S6 delta — the Tudástár hub + forget controls (2026-09-27, owner-approved direction)

**Owner decisions (2026-09-27):**

1. **Two steps.** S6 = the hub (four sections, provenance, mute / forget / edit, drift
   supersession). The in-chat "ezt ne jegyezd meg" intent moves to a follow-up slice
   (S6b, own bead); today's S3 "Megjegyeztem" chip + Visszavonom stays as is.
2. **Forget is permanent.** "Elfelejtem" deletes, is undoable for a few seconds, and the
   same thing is never re-learned **from the same source** (a veto, the `person_fact`
   precedent). New, different information may still be learned. For observations and
   effects "Elfelejtem" = never shown or used again (they are computed, so the
   computation cannot be erased — only permanently suppressed).
3. **Character claims: visible only.** The Rólad section gets one door row
   ("A csapat véleménye rólad · N állítás") into the existing dossier; no mute/forget for
   claims in S6 — filed as a separate bead.
4. **Drift confirm = automatic replacement.** Confirming a drift card promotes the drifted
   claim to a new fact and mutes the original with a visible reason
   ("felülírta egy újabb észrevétel, <dátum>"); the user can re-enable the old one.
5. **Folded in:** mezo-4rh4r (backfill pre-S2 user-confirmed plan-less rows into facts) so
   the Észrevételek section never shows a confirmed observation without its fact.
   **Not folded in:** mezo-fp95 (archived graph nodes), mezo-b3pp.39 (profile card now
   lives in settings), mezo-n7y9j.

**Home (unification answer):** the hub IS the csapatfal world already — `/mezo/knowledge`
is owned by the **Rólad** dock tab (`navModel.ts:113`), Üveg-dressed by U9
(`mezo-me75u.9`, `.tud9` + `tf-*` kit), and `RoladFacts`' "Mind a N tény" door leads
there. S6 extends that surface in place; no new route family, nothing built twice.

### Prior art (S6 recon)

- **ChatGPT Memory** (help.openai.com/en/articles/8590148-memory-faq): one flat, auditable
  list with three distinct verbs — delete, de-prioritise, restore. **Adopted:** separate
  verbs (Elfelejtem ≠ Elhallgattatom ≠ Javítom). **Rejected:** a hidden second recall layer
  with no list — the root of "I can't find what it knows"; and deletes that do not cascade
  (deleting a chat leaves its memories). Pre-2025 "memory full" silently dropped entries.
- **Claude memory** (support.claude.com/en/articles/11817273): entries grouped by topic
  (incl. "people in your life"), in-chat "forget X" takes effect immediately, citations
  link to source chats. **Adopted:** topic sections + per-item provenance link.
  **Deferred:** the conversational forget → S6b.
- **Replika memory** (help.replika.com/hc/en-us/articles/360000874712): the memory list
  lives on the character's own surface. **Adopted:** entry from the character world (Rólad
  dock). **Rejected:** no provenance, no mute tier, an undisclosed "deeper" layer.
- **Exist.io correlations** (kb.exist.io/article/37-what-are-correlations): strength and
  confidence shown separately; explicit "not cause and effect". **Adopted** for Hatások
  (already the S4 contract).
- **ChatGPT "Dreaming" critique** (techtimes.com, 2026-06-05): silent rewriting of
  out-of-date memories destroys the audit trail; "don't mention this" that only
  de-prioritises feels like a broken delete. **Adopted:** superseded/refuted facts stay
  visible as muted with reason + date; "forget" really deletes and vetoes re-learning.

### Codebase terrain (S6 recon)

- **FE:** `frontend/src/features/insights/pages/KnowledgeListPage.tsx` (URL-driven
  `?view=` switch, `TudasFrame` shell, honest pending/error/degraded branches),
  `components/KnowledgeBaseView.tsx` (today: pointer card + 2 tiles), `FactsView.tsx`,
  `KnowledgeFactRow.tsx` (Toggle only), `logic/factCopy.ts` (all fact copy, `bucketFacts`),
  `data/insights/knowledgeApi.ts` / `knowledgeHooks.ts` (`useDualQuery`).
  Person side: `features/me/pages/PersonDetailPage.tsx:305-335` (toggle + undo idiom),
  `data/me/peopleHooks.ts`, `personEffectsHooks.ts`. Provenance canon:
  `shared/ui/evidence` (`mapEvidence` + `EvidenceList`, lesson 6) — the base spec's
  "ref-chip pattern" wording is superseded by lesson 6. Prototype canon:
  `uveg-mezo-teljes.html:5470-5500` (Tudástár), `ember-hatas-uveg.html` (`.effrow`/
  `.effdots`, lesson 24), `uveg-uzenofal.html:2184-2200` ("Miből látszik?" + Elhallgattatom).
- **knowledge_fact:** GET/POST/PATCH exist (`companion.yml:286,329`; PATCH already takes
  `factText`/`category`/`includeInPrompt`); **no DELETE**; `KnowledgeFactResponse` carries
  no provenance / mute reason. Entity has an unused `superseded_by` and a `provenance`
  jsonb S2 fills (`PatternService.promote`). `include_in_prompt` is honoured by every
  consumer (chat, nightly, 9 proactive generators, retrieval, graph via
  `KnowledgeFactChangedEvent`) — **muting via `include_in_prompt` is the only path
  already honoured everywhere**; `superseded_by` is read only by
  `KnowledgeFactRetrievalQuery:39`.
- **Chat facts** are candidates first (`FactExtractionService` → `LearnedFactEntity`,
  `derived_from_message_id`); dedupe is normalized text against **non-deleted** facts +
  pending candidates — a soft-deleted fact does NOT block re-proposal today.
- **person_fact:** per-person facts ride in `PersonResponse.facts`; DELETE = undo
  (`active=false`, row kept as normalized-text veto); PATCH `includeInPrompt` only;
  `PersonFactResponse` has no `sourceRefKind/Id`.
- **pattern:** `GET /api/companion/pattern` lists live rows; `KnowledgeRecheckService`
  persists nothing on a "holds" verdict; `applyDriftConfirm` freezes only; the drift row's
  `pairKey = "drift-" + originalPatternId`, the original's `promotedFactId` is the fact.
- **effect_link:** `GET /api/companion/effects?personId=` (required) only; the table is a
  nightly cache (rows upserted / soft-deleted by threshold) — a mute ON the row dies with
  it. Readers: `gatedEffects` (apropó + csapatfal edition), `promptBlock` (nightly),
  `effectsForPerson` (person page).
- **Traps:** ArchUnit (`companion.service` ↛ `companion.reflection`; people ↛ companion);
  contract chain (lessons 21–22; `UpdateFactRequest.category` still uses `pattern:`);
  switch-gated beans via `ObjectProvider` (lesson 19); effects/recheck gated COMPANION ∧
  REFLECTION; row evidence cap 5 (lesson 3); PWA stale bundle after a wire change
  (lesson 7); codemap after every merge.

### Design (S6)

**Vocabulary (one contract across all four sections):**

| Verb | Meaning | Reversible |
|---|---|---|
| **Honnan tudom?** | expands the item's provenance (shared `EvidenceList`, ≤5 items) | — |
| **Elhallgattatom / Visszakapcsolom** | kept, visible under "Elhallgattatott", used nowhere | yes, any time |
| **Elfelejtem** | removed + vetoed from the same source; FE shows a ~5 s undo toast and only then sends the delete (no server-side restore endpoint) | only during the toast |
| **Javítom** | inline text edit — facts only (Rólad, Emberek) | yes (edit again) |

Every muted item shows WHY: *te hallgattattad el* · *később nem igazolódott* (refute,
S2) · *felülírta egy újabb észrevétel, <dátum>* (drift, decision 4).

**Backend**

1. **knowledge_fact**
   - New columns `muted_reason` (`user|refuted|superseded`, null when active) and
     `muted_at`; `update(includeInPrompt=false)` sets `user`, re-enable clears both;
     `muteFromRefutedPattern` sets `refuted`. Existing muted rows backfill to `user`
     unless their promoting pattern is refuted (→ `refuted`).
   - **`DELETE /api/companion/fact/{id}`** = forget: soft-delete + a veto row +
     `KnowledgeFactChangedEvent` (graph re-syncs / archives the node — plan verifies the
     listener handles a gone fact).
   - **Veto store** `memory_forget_veto` (user, domain, key, created_at; unique):
     domain `fact_text` (normalized text) is checked by `FactExtractionService`'s dedupe
     (no new candidate from a forgotten text) and by every other fact writer that mints
     from text (weekly review, question — plan enumerates); domain `pattern` (pattern id)
     is checked by `PatternService` promotion so a forgotten observation's fact is never
     re-minted.
   - `KnowledgeFactResponse` gains: `mutedReason`, `mutedAt`, `supersededBy`,
     `provenance` {`sourceKind`, `patternId?`, `sourceMessageId?`} and `evidence`
     (`ObservationEvidenceItem[]`, ≤5): chat facts → the source chat turn (via the
     accepted candidate's `derived_from_message_id`); pattern facts → the pattern's row
     evidence (built by `ObservationFeedService`, never re-formatted); manual → none.
     Enum-like fields use `enum:` (lesson 21); fix `UpdateFactRequest.category` to `enum:`
     while touching it.
2. **Drift supersession** (`PatternService.applyDriftConfirm`): promote the drift row's
   claim to a new fact (source `pattern`, provenance → the drift row); set the original
   fact `include_in_prompt=false`, `muted_reason=superseded`, `superseded_by=<new id>`;
   publish the fact events for both. Missing/already-deleted original → promote only
   (fail-open, logged).
3. **Recheck trace:** `KnowledgeRecheckService` stamps `pattern.rechecked_at` on every
   evaluated row (holds AND drift), so the hub can say "legutóbb ellenőrizve <dátum>,
   még igaz".
4. **Observations:** the hub lists user/engine-confirmed reflection rows (+ drift rows)
   with: title, confirm date, `rechecked_at`, drift state, linked fact id + its mute state,
   row evidence (≤5). Mute = mute the linked fact. **Forget** = forget the linked fact
   (veto `pattern`) + mark the pattern forgotten so it never resurfaces as a card and its
   pair key is never re-published (plan finds the publisher's dedupe point and whether a
   new status or the veto table carries this; the refute-never-resurfaces invariant is
   the model). Endpoint cut (extend `GET /pattern` vs. a hub-specific read) is the plan's
   call.
5. **Backfill (mezo-4rh4r):** one-off job/migration promotes pre-S2 user-confirmed
   plan-less rows that have no `promotedFactId`, through the S2 promotion path.
6. **person_fact:** `PersonFactResponse` gains `sourceRefKind`/`sourceRefId` (+ resolved
   evidence item); PATCH accepts `factText` (re-normalized; an edit to a text equal to a
   vetoed one is allowed — the user typed it). Forget = existing DELETE (already a veto).
   Hub reads everything from `GET /api/people` (facts incl. muted ones); no new list
   endpoint unless the plan proves the payload too heavy. Remember the four hand-assembled
   `PersonResponse` paths (lesson 18).
7. **Effects:** `GET /api/companion/effects` — `personId` becomes optional; without it,
   all live person + event subjects. New table `effect_mute` (user, subject_kind,
   subject_key, mode `muted|forgotten`, created_at; unique per subject) — **per subject**,
   covering all its metrics; it survives the nightly cache. `gatedEffects`, `promptBlock`
   and the edition source skip muted+forgotten subjects; `effectsForPerson` and the hub
   skip forgotten ones and return muted ones flagged. New PUT/DELETE on the mute
   (plan names the paths).

**Frontend (`/mezo/knowledge`, Üveg canon, dark only)**

- **Base view:** four section tiles with counts — **Rólad · Emberek · Észrevételek ·
  Hatások** — replacing today's two tiles; "Kategóriák" and "Hogyan tanul?" become quiet
  secondary links below. Honest pending/error/degraded per section (no invented numbers).
- **`?view=tenyek` (Rólad):** today's `FactsView` buckets kept (in prompt / on but
  left out), the "off" bucket becomes the collapsed **Elhallgattatott** list with reasons;
  each row gets the four verbs; pattern-sourced facts carry an "észrevételből" tag linking
  to the Észrevételek item. Bottom door row: "A csapat véleménye rólad · N állítás" →
  the existing dossier route.
- **`?view=emberek`:** grouped per person, **alphabetical** (no ranking), each group
  links to `/me/people/<id>`; rows with the four verbs.
- **`?view=eszrevetelek`:** confirmed observations with a status line (ellenőrizve /
  felülírva / elhallgattatva + reason), Honnan tudom?, Elhallgattatom, Elfelejtem.
- **`?view=hatasok`:** two groups — Emberek (alphabetical) and Események (by strength);
  each subject one card with its metrics in the approved `.effrow/.effdots` indicators,
  strength and confidence separate, standing non-causal footnote; Elhallgattatom /
  Elfelejtem per subject.
- One shared row-action building block for all four sections; every Hungarian string in a
  pure, unit-tested copy module (the `factCopy.ts` / `roladCopy.ts` idiom).
- **Prototype first:** a new `docs/design_2.0/prototypes/tudastar-hub-uveg.html` per
  /uvegesites §1 (HTTP serve, `?v=N`, chrome from `fuel-uveg.html` untouched, §3.4
  ranking — rows are NOT each a glass card; one glass card per section tile / per effect
  subject), reusing the U9 Tudástár block and `ember-hatas-uveg.html`'s effect block.
  Owner OK before code.

**Non-goals (S6):** the chat "ezt ne jegyezd meg" intent (S6b); mute/forget for character
claims (own bead); archived graph nodes (mezo-fp95); any new LLM call or slug; cascade
from deleting a source record (journal/check-in) to its derived facts — noted as a
follow-up bead (prior-art lesson), not in S6.

### Testing (S6)

- **Unit:** veto normalization + lookup; mute-reason transitions (user / refuted /
  superseded / re-enable clears); drift supersession (new fact minted, original muted +
  `superseded_by`, both events; missing original → promote only); effect-mute filtering
  in all three readers; FE copy module (every status line, empty/degraded texts), undo
  toast timing (fake timers: undo inside the window sends nothing; expiry sends one
  DELETE).
- **ITs (Testcontainers):** DELETE fact → absent from list/prompt/graph + chat extraction
  of the same text creates no candidate; forgotten observation's pattern never
  re-promotes and never resurfaces as a card; effect mute survives a nightly recompute
  that drops and re-creates the row; `gatedEffects`/`promptBlock` skip muted subjects;
  recheck stamps `rechecked_at` on a holds verdict; backfill promotes stuck rows exactly
  once (idempotent); `PersonFactResponse` source ref on all four `PersonResponse` paths.
- **Contract:** drift gate green; MSW handlers + mock fixtures carry the new fields;
  FE tests in both modes (`CI=true`, `VITE_USE_MOCK` unset AND `=false`); `pnpm build`;
  affected `tests/layout` specs; runtime pass (verify skill) dark, 320 px, reduced motion.

## Slice lessons

(numbered; only what a later slice would otherwise pay for again)

1. **(S1)** A source record may carry MORE THAN ONE prose field (`workout_session`:
   `note` + `closing_note`). Any "the prose field" logic must join all non-blank
   prose values (S1 joins with " — ") or it silently drops user-authored text.
2. **(S1)** `validEventEvidence` hides an event card when ANY canonical ref is dead
   (`allMatch`), so per-item fallback paths are only reachable through ROW cards —
   fixture accordingly; an event-based fixture for a dead-ref fallback cannot pass.
3. **(S1)** Grounded ROW evidence grows without bound (the publisher keeps appending
   still-live refs on every merge). Any surface that renders row evidence must cap it
   (`ROW_EVIDENCE_LIMIT = 5`, newest last) — S6's hub inherits this.
4. **(S1)** Quick-notice (legacy channel) `evidenceRefs` DO start with canonical-shaped
   refs (`journal_entry:<uuid>`, plus non-catalogue `gratitude:`/`chat_day:` shapes) —
   the "legacy is free text only" assumption is false. Resolve canonical ones, drop
   unresolvable ones, keep free text as tags.
5. **(S1)** On this case-insensitive macOS volume two files differing only by case
   (`observationEvidence.ts` vs `ObservationEvidence.tsx`) break Vite's extensionless
   resolution. Never colocate case-clashing names; the component is `EvidenceList.tsx`.
6. **(S1)** The shared evidence building block for ALL surfaces is
   `frontend/src/shared/ui/evidence/` (`mapEvidence` + `EvidenceList`); the wire is
   `ObservationEvidenceItem` (record/tag). S6 hub and any csapatfal work reuse this —
   do not re-parse or re-format server-side.
7. **(S1)** The PWA is `registerType: 'autoUpdate'` with no update-reload: after a
   deploy that changes a wire format, the FIRST open still runs the precached old
   bundle (one error screen, reload fixes). Either accept knowingly (single-user app)
   or bundle an update-reload with the wire change.
8. **(S1)** Follow-up beads worth filing when the area is touched again: batch the
   per-ref evidence lookups (`id IN (...)`, merge `exists` into `fetch`); move `SPORTS`
   out of `features/train` if shared/ui keeps importing it.
9. **(S2)** `ObservationBudget` quiet hours (22:00–07:00) silently kill ANY
   dawn-scheduled surfacing job — the card is "over budget", the LLM call is already
   spent. Schedule surfacing jobs ≥ 07:00 (the recheck's 09:20 precedent) and check
   the budget BEFORE the LLM call, never after.
10. **(S2)** `patternPopulator.reflection(owner, null, status)` NPEs on a null plan
    (`TestPlanEnvelope.key(null)`); plan-less reflection fixtures use
    `patternPopulator.reflectionNoPlan(...)` (added in S2). `createPattern(...)` makes
    a `statistical` row that fails `isReflectionOwned` — wrong for reply-path tests.
11. **(S2)** Per-row try/catch inside one shared `@Transactional` is illusory: a DB
    failure marks the whole transaction rollback-only while `REQUIRES_NEW` pushes for
    earlier rows are already committed (push to a card that never lands). Per-row
    `TransactionTemplate` + `REQUIRES_NEW`, like `KnowledgeRecheckService.recheckOne`.
12. **(S2)** Drift rows are marked by `PatternEntity.PAIR_KEY_DRIFT_PREFIX`
    (`isDrift()`): excluded from recheck candidates, and a user confirm on one freezes
    the row WITHOUT minting a fact — S6 owns supersession of the original fact.
    Shared constants live on entities: `companion.service` may never import
    `companion.reflection`.
13. **(S2)** A refute (user two-strike or engine) MUTES a promoted, never-frozen
    fact (`includeInPrompt=false` via `KnowledgeFactService.muteFromRefutedPattern`),
    never deletes it — the S6 hub should show "elnémítva cáfolat miatt" provenance.
14. **(S2)** Every new `LlmCallContext` slug needs an FE admin label
    (`labels.completeness.test.ts` gates it), and touching
    `frontend/src/features/admin` stales `docs/features/admin-hub.md` (key_files) —
    update both in the same change.
15. **(S2)** Follow-up beads: cap `closedHypotheses` at the newest N rows (unbounded
    nightly prompt growth); one-off backfill for pre-S2 plan-less rows the owner
    already confirmed (stuck `monitoring`, never promoted); S6 drift supersession
    semantics (confirmed drift row → supersede + mute the original fact).
16. **(S3)** Mock chat user bubbles carry NO persisted id (ChatPage's key comment says
    so) — any post-turn FE feature anchored on "the last user message id" silently
    never renders in mock mode unless it falls back to a synthetic anchor
    (`mock-turn-<n>`); runtime verify caught what 8k unit tests did not, because the
    component tests passed the id in directly.
17. **(S3)** Extending the NIGHTLY extractor's answer needs no FakeCompanionLlm work —
    `[fake-people:{json}]` scripts the whole object, new keys ride along. A NEW
    marker-keyed LLM call does need its own fake branch + sentinel
    (`PERSON_FACTS_SENTINEL` idiom) AND an FE admin label for the slug.
18. **(S3)** `PersonResponse` is hand-assembled on FOUR paths (getBootstrap,
    createPerson, updatePerson, decidePerson×2) — a new required contract field must
    be set on every one (`setGraphEdges` is the grep marker), and the MapStruct
    mapper needs `@Mapping(target=..., ignore=true)` plus enum `fromValue` defaults.
19. **(S3)** `PeopleService` itself is UNGATED; only listeners/companion beans sit on
    `PEOPLE_SWITCH`. A new people service gated on the switch must therefore be
    reached via `ObjectProvider` even from people-internal callers (PeopleService,
    PeopleController), or a switched-off environment fails context startup.
20. **(S4)** `GroundedHypothesisPublisher` stores `observation-topic-key:` evidence
    NORMALIZED (`normalizedTopicKey`: lowercase, split on non-alphanumerics, deduped,
    SORTED — `effect-person-1a2b-mental` becomes `1a2b-effect-mental-person`). Any
    engine matching its own topic keys against pattern evidence must compare
    `normalizedTopicKey(rawKey)`, never the raw key. The raw comparison passed a
    hand-seeded IT and would have been silently dead in production — seed such
    fixtures through the publisher's own normalizer.
21. **(S4)** OpenAPI enum-like fields take `enum:` lists, never `pattern:` regexes —
    `pattern` generates plain `string` FE types (no literal unions) and skips the
    generator's nested-enum controller mapping (`XxxEnum.fromValue`), silently
    diverging from the house convention (`owner` enums in companion.yml).
22. **(S4)** A companion.yml edit reaches the backend only after the api MERGE step
    (`api/generate`'s `npm run generate:api` → api/openapi.yml), then maven
    generate-sources, then FE `pnpm generate:api`. A literal apostrophe inside a
    single-quoted YAML flow scalar breaks the merge parser; block scalars keep it.
23. **(S4)** `effect_link` is a cache of the current window: the nightly recompute
    must also visit subjects that exist only as live rows (not just subjects present
    in today's window), or rows for fallen-silent subjects are never deleted.
24. **(S4)** The üveg person-page prototype canon is `uveg-en2.html`'s `ember()`;
    S4's Hatás card extends it in `ember-hatas-uveg.html` (`.effrow`/`.effdots`
    CSS block). S6 hub work should grep the approved prototypes for its route first
    (bible rule 66) and reuse that block rather than redrawing the indicators.
25. **(S5)** Spring Data `GreaterThanEqual` cooldown floors are off-by-one: an N-day
    cooldown fired on d0 that must reopen at d0+N needs `minusDays(N - 1)` as the
    query floor, never `minusDays(N)` — trace all N+1 days against the `>=` before
    trusting the literal spec formula.
26. **(S5)** `CompanionMessageGeneratorIT` runs with the reflection switch OFF, so a
    positive test of any reflection-gated garnish (EffectLinkService consumers) can
    never fire there — it needs a sibling IT class with reflection ON
    (`ReflectionDigestMorningIT` / `CompanionMessageGeneratorApropoIT` precedent).
27. **(S5)** Parallel Claude sessions running backend Maven against the shared fixed
    dev DB produce spurious deadlocks/FK violations and even corrupted target/ dirs;
    `-Dmezo.test.use-testcontainers=true` isolates and is the first retry, not the
    last resort.
28. **(S5)** A "fail-open" write helper whose `@Transactional` JOINS the caller's TX
    only looks fail-open: the deferred INSERT can still fail the outer commit past
    the try/catch. True fail-open needs `REQUIRES_NEW` + `saveAndFlush` inside the
    try (follow-up: mezo-8eg96).
29. **(S5)** The apropó matcher reads only the two mention projections — done-workout
    days and text-signal topic days (the other halves of `EffectLinkService.subjects`)
    do NOT fire same-day apropók; deliberate scope, documented in mezo-8eg96.
30. **(facts-always)** The FE fact-bucket model leaks beyond the insights folder:
    `KnowledgeBaseView` types the buckets structurally, and three test files
    (`KnowledgeFactRow`/`KnowledgeListPage`/`MezoHubPage`) hard-code counts derived
    from the 15-fact mock seed (14 active / 1 inactive) — a bucketing change must
    re-derive those counts from `data/insights/knowledge.ts` or the suite fails on
    numbers, not logic. Session-tooling trap paid for too: the Maven wrapper lives at
    `backend/mvnw` (repo root has none), and `cmd | tail` swallows a launch failure —
    `set -o pipefail` before piping gate commands.

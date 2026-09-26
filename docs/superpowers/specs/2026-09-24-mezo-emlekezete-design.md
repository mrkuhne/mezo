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

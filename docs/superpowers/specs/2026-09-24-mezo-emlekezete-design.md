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

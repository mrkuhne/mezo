---
title: Karakter (user character dossier)
type: feature-domain
status: shipped
updated: 2026-08-31
tags: [character, karakter, ai, llm, backend, frontend, phase-3]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/character
  - api/feature/character/character.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/CharacterPromptSource.java
  - backend/src/main/resources/db/changelog/1.0.0/script/202608272000_mezo-1gim.1_create_character_tables.sql
  - frontend/src/data/character
  - frontend/src/features/character
related: [companion, proactive, insights, me, _platform-api-backend]
---

# Karakter (user character dossier) — Feature Documentation

> One-line: a synthesis layer over everything mezo already remembers — a persisted,
> dimension-structured picture of *who Daniel is*, built by a visible team of 7 domain-expert
> personas + a Szkeptikus, chaired by Mezo. **Status: backend ✅ S1–S7 (schema/reads, detectors +
> nightly pass, weekly konzílium, bootstrap + monthly deep read, `[Karakter]` prompt block on
> all four narrative surfaces, claim feedback loop, widened bootstrap corpus, detector polish);
> FE ✅ shipped (`mezo-1gim.13`, the Design 2.0 Karakter FE slice, Tasks 1–5): a Karakter hub on
> the Én tab (maturity-ring hero + a 4-tile mosaic — Dimenziók, Feed, Csapat, Konzílium) with full
> `/me/karakter/*` page siblings for each tile, claim feedback wired to the real endpoint, the
> bootstrap ceremony, and the konzílium transcript view.** Driving spec:
> [`docs/superpowers/specs/2026-08-27-user-character-dossier-design.md`](../superpowers/specs/2026-08-27-user-character-dossier-design.md)
> (bd epic `mezo-1gim`); the backend slice plans (`docs/superpowers/plans/2026-08-2*-character-slice*.md`,
> `2026-08-3*-character-slice*.md`) and the FE slice plan
> (`docs/superpowers/plans/2026-09-01-character-slice8-fe.md`) are the point-in-time build record.
> **This doc reflects the code as it stands after the FE slice's Task 5** (route/page/doc
> ship-prep — the backend side is unchanged since the S7 consolidation slice, `mezo-1gim.11`).

## 1. Summary

Mezo already remembers a lot — L1 episodic embeddings, confirmed knowledge facts, the
statistical pattern engine, life-event graph nodes, memoir, predictions, weekly review (all
[companion](companion.md)/[proactive](proactive.md)-owned). Karakter is the **synthesis layer**
on top: it doesn't add new raw signal, it turns existing signal into a structured, evolving
opinion about the user, dimension by dimension, claim by claim.

- **Dual consumer, equal rank** (spec §1): (a) the user — a future Én-tab surface where he
  watches the profile being built and gives feedback (not built yet, §9); (b) the AI — a
  deterministically rendered `[Karakter]` block injected into the companion chat prompt and all
  three proactive narrative generators (memoir, prediction, weekly review).
- **Structure**: 7 fixed CORE dimensions (seeded, never deleted) + AI-opened CHAPTER dimensions
  (proposed by the weekly konzílium, survives the Szkeptikus, can later be retired by the
  monthly pass).
- **Built by a visible AI team**: 7 named domain-expert personas + a cross-cutting Szkeptikus
  (devil's advocate) + Mezo as Integrátor/chair. IDENT-1 is preserved — experts never message
  the user directly; the user only *reads* the team's work (feed, konzílium transcript).
- **Unit of truth**: the **claim** — confidence, evidence refs, a status
  (`ACTIVE`/`RETIRED`), a lifecycle. Dimension portrait prose is written FROM claims, never the
  other way around.
- **User feedback is claim-level** (`TALAL`/`NEM_IGAZ`/`PONTOSITOM`) and is itself fed back into
  the pipeline as a `character_observation` — the team has to reckon with being told it's wrong.

All seven backend slices (`mezo-1gim.1` schema+reads, `.3` detectors+nightly, `.5` weekly
konzílium, `.6` bootstrap+monthly, `.8` prompt block, `.10`/S6 claim feedback, `.11`/S7
consolidation — exact ids per the slice plans) are shipped. The detector catalog is still
**narrower than the spec's v1 wishlist** (§9) — spec §5 names ~22 detector keys (some as
variants of one bullet), and only 5 of them are implemented (`mezo-1gim.12` tracks most of the
rest) — but the `[Karakter]` block now reaches
all four narrative surfaces (chat, memoir, prediction, weekly review) and the bootstrap evidence
corpus now matches the spec's full source list (daily summaries, patterns, facts, weekly
reviews, journal entries, life events).

## 2. User-facing behavior

The Én tab carries a **Karakter** tile (`EnHubPage`) that opens `/me/karakter`, the dossier hub —
Design 2.0's Mozaik idiom throughout: a hero + a compact tile mosaic, full-page siblings for each
tile rather than in-page accordions.

- **Hub** (`/me/karakter`, `KarakterHubPage`): a 7-segment maturity ring (one arc per CORE
  dimension, expert domain color, arc length = maturity, center count-up %) above a 4-tile
  mosaic — **Dimenziók** (avg maturity + dimension count), **Feed** (latest observation preview),
  **Csapat** (9-persona orb cluster), **Konzílium** (latest conference date, a gold dot when one
  landed in the last 3 days). A pre-bootstrap dossier (all CORE dims at maturity 0, no claims —
  `isDossierEmpty`) shows the bootstrap intro face instead of the mosaic; `POST
  /api/character/bootstrap` drives a staggered progress face, then a reveal ("A dossziéd
  elkészült") whose CTA opens the first konzílium's transcript. The switch-off/degraded state
  (overview `404`) is a quiet card, never a crash — the same tone `ChatPage` uses.
- **Dimenziók** (`/me/karakter/dimenziok`, `DimensionsPage`): all 7 CORE + the 1 CHAPTER
  dimension as tiles (CHAPTER gets a dashed variant); each opens its own dimension page
  (`/me/karakter/dimenzio/:key`, `DimensionPage`) — a tinted hero (persona orb + maturity
  count-up), the portrait prose (only when non-empty), and every ACTIVE claim as a `ClaimTile`:
  a confidence-word chip (`biztos`/`valószínű`/`figyeljük`, never a raw number), the claim text
  (an ÉRZÉKENY frame for `sensitive` claims), and the three feedback pills — **Talál** (thanks
  microcopy, disables), **Nem igaz** (a locally-retired dashed face + toast — the API serves
  ACTIVE claims only, so a "nem igaz" verdict removes the claim from the live cache; the tile
  keeps rendering its own retired face from local state so the interaction doesn't yank the row
  out from under the user mid-click), **Pontosítom** (an inline textarea → `Küldés`). A
  "Beszélgess erről Mezóval" chip hands off to `/mezo/chat` (plain navigation — no anchored
  chat-context idiom exists yet for a claim/dimension).
- **Feed** (`/me/karakter/feed`, `CharacterFeedPage`): day-grouped observation rows (persona orb
  + text) plus konzílium-diff rows (a coral pill linking to `/me/karakter/konzilium`).
- **Csapat** (`/me/karakter/csapat`, `CsapatPage`): the 9 persona cards straight off
  `GET /api/character/experts` — 7 EXPERT cards (domain-color orb, voiceLine subtitle, "mit
  figyel:" watch line, a role chip), the Szkeptikus (graphite gradient card), and Mezo (the
  coral-gradient card with the real `s-orb`, no chip — `CharacterService.experts()` sets Mezo's
  `role` to the same string as its `voiceLine`, so the page prints that one subtitle line ONCE,
  never twice).
- **Konzílium** (`/me/karakter/konzilium`, `KonziliumPage`): a list of conference summaries (date
  + a HETI/HAVI/BOOTSTRAP badge — `?id=` opens one transcript, the WeekHub sibling idiom, not a
  child route). The transcript view (`TranscriptTurn`) shows the Kimenet outcome as 3 stat cells
  (elfogadva/nyugdíjazva/portré átírva, mapped off `changes[].kind`; any other change kind —
  `CLAIM_CONFIDENCE_UP/DOWN`, `CHAPTER_OPENED`, `CHAPTER_RETIRED`, `BOOTSTRAP` — renders as an
  extra text line, never a fabricated 4th cell), phase labels derived from each turn's persona
  kind ("Javaslatok" for EXPERT turns, "A Szkeptikus", "Döntés" for Mezo's ruling), and
  persona-railed bubbles (the Szkeptikus gets the graphite face, Mezo's ruling gets the
  full-width coral tint). A line inside an expert's turn text that starts with the backend's own
  `"DANIEL VÁLASZA — "` marker (`KonziliumProposalRound.USER_FEEDBACK_PREFIX` — there is no
  structured "this is the user's own words" field on `ConferenceTurn`) is detected and re-styled
  with the gold rail. The closing honesty note ("A fenti a valódi beszélgetés...") makes explicit
  that the transcript is the real exchange, never re-dramatized.

The claim-level `TALAL`/`NEM_IGAZ`/`PONTOSITOM` feedback UI POSTs to
`POST /api/character/claim/{id}/feedback` (`CharacterFeedbackService`) for real; nothing else in
the pipeline changed — a submitted correction still only shows up at the next konzílium, exactly
as the backend already worked before the FE existed. Beyond that, the indirect effect from before
still holds: claims that clear the prompt-injection threshold (§8 below) shape what Mezo says in
chat, in the weekly Memoir, in Predictions, and in the weekly review.

**Deliberately deferred / out of v1** (see §9): the "Történet" portrait-revision timeline, the
hero's self-portrait bio line (no backend field to source it from), a konzílium
read/unread notification beyond the hub tile's "newer than 3 days" heuristic, and outcome counts
on the conference **list** row (`CharacterConferenceSummary` has no `changes` field — only the
full per-id `CharacterConferenceResponse` does).

## 3. Architecture & data flow

No `view → hook` path exists (§2). The backend flow is:

```
nightly:  domain reads (14-day window) → DetectorRegistry → per-expert cheap-tier LLM call
          → character_observation rows (no LLM call on a quiet day)

weekly:   unconsumed character_observation rows (grouped by expert)
          → KonziliumProposalRound (per-expert cheap-tier call, ≤3 proposals each)
          → KonziliumVerdictRound: Szkeptikus (smart-tier, KEEP|KILL) → Mezo/Integrátor
             (smart-tier, accept/confidence/reason + optional chapter proposal)
          → ClaimLifecycle.apply (NEW/UP/DOWN/RETIRE → character_claim rows)
          → PortraitWriter.rewrite (one smart-tier call per touched dimension)
          → character_conference (transcript + outcome diff) persisted; observations marked
             consumed — ALL of the above in ONE @Transactional method (all-or-nothing)

monthly:  same proposal/verdict/portrait tail, but reads ACTIVE claims (not fresh observations)
          and steers toward UP/DOWN/RETIRE; then a separate stale-CHAPTER-retirement pass

bootstrap: one-time; same proposal/verdict/portrait tail over CharacterHistoryReads.gatherHistory
          (daily summaries + confirmed patterns + prompt-eligible facts + weekly reviews +
          journal entries + active LIFE_EVENT graph nodes)

consume:  CharacterPromptAssembler.render(userId) → deterministic "[Karakter]" text block
          → injected into ChatService / MemoirGenerator / PredictionGenerator /
             WeeklyReviewGenerator system prompts
```

Every LLM call in this pipeline flows through the same `CompanionLlm` port
([companion.md](companion.md)) and is audited under the `character` feature tag
(`feature/llmlog`) — Karakter adds no new LLM adapter, only new callers. The choreography
(proposal → Szkeptikus → Mezo ruling → portrait rewrite) is real code, not a single "do
everything" prompt — it is the same "no theater" idiom the spec calls out (§3): the persisted
`character_conference.transcript` is the actual multi-turn exchange that ran, never
re-dramatized after the fact.

## 4. Data model & API

Five owned tables (`feature/character/entity/`), all house idioms (UUID PK, `@SQLDelete`/
`@SQLRestriction` soft delete, `created_by`, typed jsonb via `@JdbcTypeCode(SqlTypes.JSON)`).
Migration: `db/changelog/1.0.0/script/202608272000_mezo-1gim.1_create_character_tables.sql`
(the 5 tables + the CORE-7 seed) plus two later unique-index fixes,
`202608311000_mezo-1gim.6_character_conference_monthly_unique.sql` and
`202608311100_mezo-1gim.6_character_conference_bootstrap_unique.sql`.

- **`character_dimension`** — `key` (unique per live user row), `title`, `kind`
  (`CORE`/`CHAPTER`), `expert_key` (nullable for chapters), `portrait text` (default `""`),
  `maturity smallint` (default 0, computed roll-up — see §3's `PortraitWriter` formula below),
  `version int`, `updated_at`.
- **`character_claim`** — `dimension_id` FK, `text`, `confidence numeric(3,2)`, `status`
  (`ACTIVE`/`RETIRED`), `origin_conference_id` FK, `proposed_by` (expert key), `sensitive
  boolean`, and three typed-jsonb envelopes: `evidence` (`ClaimEvidenceEnvelope` — a list of
  `{kind,id,label}` refs), `user_feedback` (`ClaimFeedbackEnvelope` — a list of
  `{kind,text,at}` events), `confidence_history` (`ClaimConfidenceHistoryEnvelope` — a list of
  `{value,cause,at}` points).
- **`character_observation`** — `expert_key` (`user` for feedback-originated rows too),
  `dimension_keys jsonb` (`ObservationDimensionKeysEnvelope{List<String> keys}` — a **typed
  jsonb wrapper**, not a raw `text[]` array column; fixed post-hoc at `mezo-1gim.1` after the
  List<String>-onto-ARRAY mapping leak, see the commit history on this file), `day`, `text`
  (expert voice), `salience smallint` 1–5, `signals jsonb` (`ObservationSignalsEnvelope` — a
  list of `{detectorKey,summary,refIds}`), `consumed_by_conference_id` FK (nullable).
- **`character_conference`** — `kind` (`BOOTSTRAP`/`WEEKLY`/`MONTHLY`), `week_start date`
  (nullable for BOOTSTRAP; **MONTHLY reuses this column for the month's first day** —
  `CharacterMonthlyService`), `transcript jsonb` (`ConferenceTranscriptEnvelope` — ordered
  `{persona,text,refIds}` turns), `outcome jsonb` (`ConferenceOutcomeEnvelope` — a list of
  `{kind,dimensionKey,claimId,summary}` changes; the feed's diff source), `generated_at`.
  Partial unique indexes: one LIVE row per user+week (WEEKLY) and per user (BOOTSTRAP).
- **`character_portrait_revision`** — `dimension_id` FK, `version int`, `portrait text`,
  `conference_id` FK, `created_at`. Every successful portrait rewrite appends one; a blank/failed
  rewrite leaves the dimension entirely untouched (no revision, no version bump).

### API (`api/feature/character/character.yml`)

All seven endpoints gated on `CHARACTER_SWITCH` (`mezo.feature.character.enabled`); reads still
work with the companion switch off (S1 deliberately kept dossier reads companion-free —
`CharacterController` class javadoc), only `POST /api/character/bootstrap` needs
`COMPANION_SWITCH` too (degrades to 404 via an absent `ObjectProvider<CharacterBootstrapService>`
bean, never a silent 200).

| Method + path | Returns | Notes |
|---|---|---|
| `GET /api/character` | `CharacterOverviewResponse` (all dimensions) | Lazily seeds the 7 CORE dimensions on first read |
| `GET /api/character/dimension/{key}` | `CharacterDimensionResponse` | Portrait + ACTIVE claims + recent revisions; 404 unknown key |
| `GET /api/character/feed?limit=` (1–100, default 30) | `CharacterFeedItem[]` | Observations + latest conference outcome diff, merged/sorted desc; `[]` honest empty, never 404 |
| `GET /api/character/conference` | `CharacterConferenceSummary[]` | Summaries only |
| `GET /api/character/conference/{id}` | `CharacterConferenceResponse` | Full persisted transcript + outcome; 404 unknown |
| `POST /api/character/claim/{id}/feedback` | `CharacterClaimDto` | `{kind: TALAL\|NEM_IGAZ\|PONTOSITOM, text?}`; 400 malformed, 404 unknown, 409 already-retired |
| `POST /api/character/bootstrap` | `CharacterConferenceResponse` \| 204 | 409 if a live BOOTSTRAP conference already exists; 204 if there is no history to read |

Confidence is **never** returned as a raw number for display purposes in prose (the FE, once
built, is expected to render human words — the Minták precedent); the wire DTO does carry the
raw `0..1` decimal (`CharacterClaimDto.confidence`) for the FE to translate.

## 5. Integrations

- **[Companion](companion.md)** — every LLM call rides `CompanionLlm` (cheap tier for
  per-expert proposals/observations, smart tier for Szkeptikus/Mezo/portrait writes), audited
  under the `character` feature tag. `CharacterPromptSource` (port defined in
  `feature/companion/CharacterPromptSource.java`, implemented by `CharacterPromptAssembler`) is
  consumed by `ChatService` (`feature/companion/service/ChatService.java`) to inject the
  `[Karakter]` block into the chat system prompt, right alongside the confirmed-facts block —
  facts are atomic data, claims are interpretation, both belong (spec §8).
- **[Proactive](proactive.md)** — `CharacterPromptSource` is also consumed by
  `MemoirGenerator`, `PredictionGenerator`, and `WeeklyReviewGenerator` (all three inject
  `[Karakter]` into their gather, right next to `WeeklyReviewGenerator`'s own "ÚJ TÉNYEK"
  section — the same `ObjectProvider<CharacterPromptSource>` + `""`-when-absent idiom at every
  site). All four narrative-facing surfaces (chat, memoir, prediction, weekly review) now speak
  from the one formatter.
- **Daily summaries, confirmed patterns, prompt-eligible knowledge facts, weekly reviews,
  journal entries, active `LIFE_EVENT` graph nodes** — read (not written) by
  `CharacterHistoryReads` as the bootstrap's evidence corpus (weekly reviews fan out to every
  expert; journal entries route to `pszichologus` only; life events route to `antropologus`
  only — each source individually capped, see §9); by the nightly detectors' domain reads
  (meals, weight, check-ins, journal via `CharacterSignalReads`); and by the monthly pass over
  the existing `character_claim` base. Karakter owns no meal/weight/check-in/journal/weekly-
  review data itself — those live in their respective feature packages
  (train/fuel/companion-journal/proactive), read cross-slice via direct repository injection
  (`CharacterHistoryReads` → `feature.proactive`/`feature.journal` are new one-directional
  edges, not the closing leg of a cycle — see the class javadoc for why that is safe here while
  the companion → proactive direction needed a port).
- **`feature/llmlog`** — every character LLM call is audited (feature tag `character`,
  call-kind per pipeline step), the same idiom every other AI-domain doc documents.

- **[Me](me.md)** — `EnHubPage` carries the Karakter tile that opens `/me/karakter`; the FE data
  layer (`frontend/src/data/character/`) is a plain OpenAPI-client consumer of the seven
  endpoints in §4, following the house dual-mode idiom (`@/data/_client/mode.ts`) shared with
  every other Design 2.0 feature — no new cross-domain FE seam beyond the generated client.

## 6. How to use it (consume)

- **Inside another backend generator that wants the `[Karakter]` block**: inject
  `ObjectProvider<CharacterPromptSource>` (the house pattern for an optional cross-feature
  dependency whose owning switch may be off), call `.getIfAvailable()` / `.render(userId)`, and
  treat an empty/null result as "nothing to add" (never fail the caller).
  See `MemoirGenerator`/`PredictionGenerator`/`WeeklyReviewGenerator` for the reference call
  sites.
- **Reading the dossier from a test or a script**: `GET /api/character` (owner-scoped via the
  JWT) always returns a 200 with the 7 CORE dimensions present, even pre-bootstrap — the
  "honest pre-bootstrap state" (empty portraits, maturity 0, no claims). There is no
  unauthenticated read.
- **From the FE**: `frontend/src/data/hooks.ts` re-exports every Karakter hook from
  `frontend/src/data/character/characterHooks.ts` — `useCharacterOverview()`,
  `useCharacterDimension(key)`, `useCharacterFeed(limit?)`, `useCharacterExperts()`,
  `useCharacterConferences()`/`useCharacterConference(id)`, `useClaimFeedback()`,
  `useCharacterBootstrap()`. Every read hook maps a 404 (character switch off) to `null`/`[]`,
  never throws — the same `useBiometricProfile` idiom every other dual-mode hook in this
  codebase follows. Confidence is never rendered as a raw number — always run it through
  `confidenceWord()` (`characterApi.ts`, the same 0.75/0.5 thresholds as
  `CharacterConfidenceWords` server-side) first.

## 7. How to extend it

- **Add a detector**: implement `CharacterDetector` (`detector/CharacterDetector.java`,
  `String key(); List<DetectorSignal> detect(DetectorInput)`) as a `@Component` gated
  `@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")`
  (all 5 concrete detectors follow this, S7 polish — with the switch off the beans don't exist,
  not merely no-op, so `DetectorRegistry`'s injected `List<CharacterDetector>` is legitimately
  empty rather than short-circuited) — it is auto-discovered by `DetectorRegistry.runAll` and
  gains a free per-key kill switch too (`mezo.character.detector.<key>.enabled`, defaults
  enabled when the key is absent from the map). Feed it from `CharacterSignalReads` if it needs
  a new domain read; keep it pure code — interpretation of a detector's output is strictly the
  expert LLM's job downstream, per the honest-state axiom (no number is ever invented by a
  model); render any Hungarian-locale number deterministically via a decimal-comma helper
  (`UnderLoggingDetector.huNumber`) rather than `BigDecimal.toString()`/a locale-dependent
  `NumberFormat`, and when a detector's window can't distinguish "streak = window size" from
  "streak = much longer", say so honestly (`LoggingGapDetector`'s 14-day cap) instead of
  asserting a precise count.
- **Add/change a CORE dimension or expert persona**: `CharacterCoreCatalog` /
  `CharacterExpertCatalog` are static lists — adding a CORE dimension needs a migration to seed
  it for existing users (the S1 seed migration is the precedent) plus a catalog entry; CORE
  dimensions are spec-fixed at 7 and are not expected to grow casually.
- **Wire the prompt block into a new generator**: mirror `MemoirGenerator`'s
  `ObjectProvider<CharacterPromptSource>` injection — never a hard `@Autowired` (the character
  feature can be off while the caller's own feature stays on).
- **New Konzílium round behavior**: `KonziliumProposalRound`/`KonziliumVerdictRound` are the
  choreography; each step is one `CompanionLlm` call with a strict-JSON contract and a defensive
  parse — follow the existing marker-constant + `FakeCompanionLlm` sentinel idiom for testability
  (§8).
- **Add a Csapat card or a Konzílium transcript face for a new persona `kind`**: the FE derives
  every persona-specific styling choice (graphite Szkeptikus, coral Mezo, phase labels in
  `KonziliumPage.turnKindOf`/`phaseOf`) off `CharacterExpertDto.kind`
  (`EXPERT`/`SKEPTIC`/`CHAIR`) — never off a hardcoded persona key — so a new `kind` value needs
  a contract change (Task 1's shape) before the FE can special-case it; a new EXPERT persona
  needs no FE change at all beyond a new `s-orb-*` sprite (`ClaySpotName` union,
  `frontend/src/shared/ui/clay/`) and a `PersonaOrb.ORB_BY_EXPERT` entry — `PersonaOrb` already
  falls back to the coral `s-orb` for any key it doesn't recognize, so a missing sprite degrades
  rather than crashes.

Backend conventions generally: [`docs/references/*.md`](../references/) for the exact house
patterns (entities, migrations, tests); this doc only states what Karakter specifically does
with them. FE conventions generally: [`_platform-data-layer.md`](_platform-data-layer.md) (the
dual-mode hook idiom) and the Mozaik component set (`frontend/src/shared/ui/mozaik/`).

## 8. Testing

Backend: `backend/src/test/java/io/mrkuhne/mezo/feature/character/` (24 files, listed below by
shape). FE: `frontend/src/data/character/characterHooks.test.tsx` (dual-mode hook coverage) +
one `.test.tsx` per page/component under `frontend/src/features/character/` — every page test
uses the `DimensionsPage.test.tsx` hook-override idiom (stub `@/data/hooks` directly), which
makes the SAME test mode-agnostic rather than duplicating it per mode; `DimensionPage.realMode.test.tsx`
is the one true real-mode integration test (renders through the actual msw-backed data layer to
pin that a claim-feedback POST really invalidates and really refetches). `navigation.test.tsx`
covers every `/me/karakter/*` route's reachability and runs under both `pnpm test` and
`VITE_USE_MOCK=false pnpm test` (bd memory `vite-use-mock-unset-means-mock` — never trust a bare
`pnpm test` alone as dual-mode coverage). No Playwright visual goldens exist for any
`/me/karakter/*` page — `frontend/tests/visual/visual.spec.ts`'s `SCREENS` list is a hand-curated
subset of routes, not "every page," and none of the Karakter FE slice's five pages (hub included)
were added to it.

- **API/IT surface**: `CharacterApiIT` (overview lazy-seed, dimension 404, feed/conference
  merge), `CharacterApiCompanionOffIT` (reads OK with companion off, bootstrap 404s),
  `CharacterApiSwitchOffIT` (`CHARACTER_SWITCH` off degrade).
- **Pipeline ITs**: `CharacterBootstrapIT`, `CharacterConferenceJobIT`,
  `CharacterConferenceServiceIT`, `CharacterHistoryReadsIT`, `CharacterMonthlyServiceIT`,
  `CharacterObservationJobIT`, `CharacterObservationServiceIT`, `CharacterFeedbackIT`,
  `CharacterPersistenceIT` (entity round-trip + jsonb envelopes + soft-delete unique-key
  behavior).
- **Konzílium choreography**: `KonziliumProposalRoundIT`, `KonziliumVerdictRoundIT`,
  `KonziliumUserFeedbackIT`, `ClaimLifecycleIT` — all via `FakeCompanionLlm` sentinels keyed on
  a marker constant per round step (`PROPOSAL_MARKER`, `SKEPTIC_MARKER`, `INTEGRATOR_MARKER`,
  `PORTRAIT_MARKER`, `BOOTSTRAP_MARKER`, `OBSERVATION_MARKER`) — the `[fake-memoir:…]` precedent
  from [proactive.md](proactive.md).
- **Prompt block**: `CharacterPromptAssemblerIT`, `CharacterPromptAssemblerOversizedDimensionIT`
  (whole-block-drop-on-overflow), `CharacterPromptWiringIT` (`@Nested`: `SwitchOn` covers all
  four wired surfaces — chat, memoir, prediction, weekly review; `SwitchOff` covers chat only).
- **Unit tests (pure code, no Spring context)**: `detector/DetectorTest` (fixture-day-in/
  signal-out for all 5 detectors, incl. the HU decimal-comma formatting and the 14-day honest
  streak-cap case), `CharacterConferenceWeekDerivationTest`,
  `CharacterMonthlyScheduleTest` (`isDeepReadDay` date pinning), `CharacterExpertCatalogTest`,
  `service/PortraitWriterTest`.

Run focused locally: `./mvnw test -Dtest='*Character*,Konzilium*' -Dmezo.test.use-testcontainers=true`
(Testcontainers mode — the default fixed-DB mode races/fakes failures per house convention).
Full suite is CI-gated (self-PR). A `deadlock detected` `ResetDatabase` TRUNCATE failure between
tests is known cross-domain flakiness, not a character regression — bd `mezo-oou9`; rerun once
before investigating.

## 9. Decisions, gotchas & deferred

- **Detector catalog is still narrower than spec §5's v1 wishlist** (S7 closed the polish items —
  HU decimal-comma formatting, switch-gated beans, honest streak-capping — but did NOT add new
  detectors). Spec §5 names ~22 detector keys, several as variants noted under one bullet (the
  `logging-gap` bullet covers "N consecutive days without meal logs (also variants: weight,
  check-in, journal silence)"). 5 are implemented: `checkin-gap`, `journal-silence`,
  `logging-gap`, `under-logging` (the meta-behavior/single-domain group, owned by
  `drill`/`pszichologus`/`taplalkozo`) and `journal-note` — the last of which is a shipped
  detector that is NOT one of the spec's named keys (it surfaces raw journal text; treat it as
  an addition beyond §5, not a §5 key ticked off). The entire cross-domain group
  (`comfort-eating`, `sleep-performance-chain`, `sport-interference`, `med-cycle-covariance`,
  `people-mood-link`, `weekend-gap`), the character-traits group (`resilience`,
  `all-or-nothing`, `restart-pattern`, `promise-vs-delivery`, `self-calibration`,
  `decision-profile`), the physiological group (`rir-calibration`, `niggle-map`,
  `hr-recovery-trend`), the remaining meta-behavior detectors (`retro-logging-ratio`,
  `checkin-latency`, `night-activity`, `chat-topic-shift`, `knowledge-rejection-pattern`), and
  the `logging-gap` bullet's `weight` variant (no `WeightGapDetector` exists) are **not
  implemented**. Practically: `edzo`, `szomnologus`, `doki`, and `antropologus` never receive a
  nightly-detector-sourced observation today — they only accumulate evidence via the
  weekly/monthly claim rounds' own reads (now widened, see below) and user-feedback routing.
  `mezo-1gim.12` tracks writing most of the remaining detectors, but its description does not
  currently name the `weight`-gap variant.
- **Detector beans are switch-gated, not just no-op** (S7). Each of the 5 detectors carries
  `@ConditionalOnProperty(CHARACTER_SWITCH)` directly, so with the switch off the beans don't
  exist at all — `CharacterApiSwitchOffIT.the_detector_beans_are_absent` asserts every detector
  bean and `DetectorRegistry` itself are absent from the context, not merely quiet.
- **`LoggingGapDetector` caps its streak count honestly at the read window's boundary.** The
  domain read only looks back 14 days, so a streak that reaches 14 could actually be much
  longer; past that point the detector reports "legalább 14 napja nincs étkezés logolva"
  instead of asserting a precise day count (and drops the now-meaningless "utolsó:" clause).
- **Numbers embedded in detector prose render with a Hungarian decimal comma,
  deterministically.** `UnderLoggingDetector.huNumber` renders `BigDecimal.toPlainString()`
  with `.` replaced by `,` — never `BigDecimal.toString()` (whose exponent form can leak) or a
  locale-dependent `NumberFormat` (whose output would vary with the JVM default locale).
- **Bootstrap's evidence corpus now matches spec §6's full source list** (S7 widening,
  `CharacterHistoryReads`): daily-summary narratives (newest 60), CONFIRMED patterns
  (newest 60), prompt-eligible knowledge facts (top 40 by reinforcement, 300-char cap), weekly
  reviews (newest 60, fanned out to EVERY expert, 300-char summary cap), journal entries
  (newest 60, routed to `pszichologus` only, 300-char cap), and active `LIFE_EVENT` graph nodes
  (newest 40, routed to `antropologus` only, 300-char title cap). `character → proactive`
  (`WeeklyReviewRepository`) and `character → journal` (`JournalEntryRepository`) are new
  one-directional dependency edges — safe because neither `proactive` nor `journal` depends on
  `character`, unlike `companion → proactive`, which DOES close a cycle and is why the
  `WeekReviewSource` port exists instead of a direct repository import (see
  `CharacterHistoryReads`'s class javadoc for the full reasoning `ArchitectureTest` enforces).
- **`[Karakter]` prompt wiring now reaches all four narrative surfaces** (S7). `ChatService`,
  `MemoirGenerator`, `PredictionGenerator`, and `WeeklyReviewGenerator` all inject the block via
  the same `ObjectProvider<CharacterPromptSource>` + `""`-when-absent idiom —
  `WeeklyReviewGenerator`'s injection point sits next to its own "ÚJ TÉNYEK" section in
  `gather()`, the deliberate insertion point since that generator never called
  `KnowledgeFactService.renderPromptBlock` directly (unlike the other three).
- **Confidence ceilings differ by path, deliberately, and there are TWO different konzílium
  clamps, not one.** `KonziliumVerdictRound`'s own accepted-ruling clamp (Mezo's ruling
  confidence, and — mirrored defensively — a NEW claim's confidence in `ClaimLifecycle`) is
  `[0.30, 0.90]`. Separately, `ClaimLifecycle`'s UP/DOWN "MOVE" path — used when a ruling
  doesn't carry an explicit numeric confidence, applying the default `±0.10` step instead — is
  a wider `[0.05, 0.95]`; `CharacterFeedbackService`'s own javadoc calls this out explicitly as
  "the konzílium's own, higher 0.95 ceiling". User "talál" feedback only ever adds `+0.05`
  capped at a still-lower **0.85** — a self-confirmation from the user alone can never saturate
  a claim to near-certainty without independent evidence (`CharacterFeedbackService`). "nem
  igaz" is immediate `RETIRED`, no konzílium round-trip needed. "pontosítom" never moves
  confidence directly — the free text is logged as a top-salience `user` observation and left
  for the owning expert(s) to weigh at the
  next konzílium; an unaddressed correction is logged (WARN), not silently dropped
  (`CharacterConferenceService.warnUnaddressedUserFeedback`).
- **`MONTHLY` conferences reuse the `week_start` column** to store the month's first day
  (`CharacterMonthlyService`) rather than adding a new column — a deliberate reuse, not a bug;
  don't be surprised reading raw rows.
- **Monthly cron fires every Sunday but only acts on the first one of the month**
  (`CharacterMonthlyJob.isDeepReadDay`, `dayOfMonth <= 7`) — Spring's cron syntax can't AND a
  day-of-month with a day-of-week, so the narrowing lives in code, not the cron expression
  (`mezo.character.monthly.cron = "0 0 20 * * SUN"`). Every other Sunday is a silent no-op.
- **Chapter retirement is implemented** (monthly pass, `CharacterMonthlyService.retireStaleChapters`):
  a `CHAPTER` dimension with zero ACTIVE claims and `updated_at` older than
  `mezo.character.monthly.stale-chapter-days` (90d default) is soft-deleted, appending a
  `CHAPTER_RETIRED` outcome change. CORE dimensions are never eligible.
- **FE shipped, with deliberate deferrals** (§2, `mezo-1gim.13` Tasks 1–5): the hero renders
  WITHOUT a self-portrait bio line — the backend serves no such field, and inventing prose
  client-side would violate the honest-states axiom; the "Történet" portrait-revision timeline
  is spec-stated out of scope (never v1, see below); a konzílium "unread" signal is only the
  hub tile's "generated in the last 3 days" heuristic, not a real read/unseen flag (none
  exists on `CharacterConferenceSummary`); the conference **list** row shows date + kind badge
  only, never an outcome count (`CharacterConferenceSummary` carries no `changes` field — only
  the full per-id `CharacterConferenceResponse` does, and the list doesn't fetch every
  conference's detail just to summarize it) — the same gap the hub's Konzílium tile already
  documents inline.
- **Out of scope, spec-stated (never / not v1)**: the "Történet" (portrait-revision-timeline)
  view, the identity-hero live self-portrait bio line, any expert direct-messaging to the user
  (IDENT-1, never), any outward action from Karakter (IDENT-2).
- **Companion tone guardrail** for `sensitive` claims (self-calibration,
  knowledge-rejection-pattern classes per spec §3) is a persona-prompt instruction inside the
  Szkeptikus/proposal prompts, not a separately enforced code gate — there is no automated test
  asserting the mirror/question phrasing; it rides the same trust-the-persona-prompt model the
  rest of the companion stack uses.

## 10. Key files

**Backend — feature package** (`backend/src/main/java/io/mrkuhne/mezo/feature/character/`):
- `config/CharacterProperties.java` — every `mezo.character.*` tunable (§ below)
- `controller/CharacterController.java` — the 7 endpoints, `CHARACTER_SWITCH`-gated
- `entity/` — `CharacterDimensionEntity`, `CharacterClaimEntity`, `CharacterObservationEntity`,
  `CharacterConferenceEntity`, `CharacterPortraitRevisionEntity` + the typed-jsonb envelope
  records used by their jsonb columns (`ClaimEvidenceEnvelope`, `ClaimFeedbackEnvelope`,
  `ClaimConfidenceHistoryEnvelope`, `ObservationDimensionKeysEnvelope`,
  `ObservationSignalsEnvelope`, `ConferenceTranscriptEnvelope`, `ConferenceOutcomeEnvelope`)
- `detector/` — `CharacterDetector`, `DetectorRegistry`, `DetectorInput`/`DetectorSignal`, and
  the 5 concrete detectors (`CheckinGapDetector`, `JournalNoteDetector`,
  `JournalSilenceDetector`, `LoggingGapDetector`, `UnderLoggingDetector`)
- `service/CharacterCoreCatalog.java` / `CharacterExpertCatalog.java` — the 7 CORE
  dimensions / 7 expert personas (static catalogs)
- `service/CharacterObservationJob.java` / `CharacterObservationService.java` — nightly pass
- `service/CharacterConferenceJob.java` / `CharacterConferenceService.java` — weekly konzílium
- `service/KonziliumProposalRound.java` / `KonziliumVerdictRound.java` / `ClaimLifecycle.java` /
  `ClaimProposal.java` / `ClaimRuling.java` / `ExpertEvidence.java` — the choreography
- `service/PortraitWriter.java` — per-dimension portrait rewrite + maturity roll-up
- `service/CharacterMonthlyJob.java` / `CharacterMonthlyService.java` — monthly deep read +
  stale-chapter retirement
- `service/CharacterBootstrapService.java` / `CharacterHistoryReads.java` — one-time bootstrap
- `service/CharacterFeedbackService.java` — TALAL/NEM_IGAZ/PONTOSITOM
- `service/CharacterPromptAssembler.java` — the `[Karakter]` block renderer
- `service/CharacterService.java` / `CharacterSignalReads.java` /
  `CharacterConfidenceWords.java` — reads, detector-input gathering, human-words confidence

**Cross-feature port**: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/CharacterPromptSource.java`
(interface) — consumed by `feature/companion/service/ChatService.java`,
`feature/proactive/service/MemoirGenerator.java`, `feature/proactive/service/PredictionGenerator.java`,
`feature/proactive/service/WeeklyReviewGenerator.java`.

**API contract**: `api/feature/character/character.yml`

**Migrations**: `backend/src/main/resources/db/changelog/1.0.0/script/202608272000_mezo-1gim.1_create_character_tables.sql`,
`202608311000_mezo-1gim.6_character_conference_monthly_unique.sql`,
`202608311100_mezo-1gim.6_character_conference_bootstrap_unique.sql`

**Switches/crons** (`backend/src/main/resources/application.yml`):
- `mezo.feature.character.enabled: true` — the feature switch (`CHARACTER_SWITCH`); LLM-calling
  beans additionally require `mezo.feature.companion.enabled`
- `mezo.techcore.cron.character-observation-job.enabled: true`,
  `character-conference-job.enabled: true`, `character-monthly-job.enabled: true` — per-job
  backstop switches
- `mezo.character.observation.cron: "0 50 2 * * *"`, `observation.catch-up-days: 3`
- `mezo.character.conference.cron: "0 30 19 * * SUN"`, `conference.catch-up-weeks: 2`
- `mezo.character.monthly.cron: "0 0 20 * * SUN"` (narrowed to the first Sunday in code),
  `monthly.stale-chapter-days: 90`
- `mezo.character.prompt.min-confidence: 0.45`, `prompt.max-claims-per-dimension: 3`,
  `prompt.max-total-chars: 1800`, `prompt.portrait-min-maturity: 30`
- `mezo.character.detector: {}` (per-key kill switches, all enabled by default/absence)

**Tests**: `backend/src/test/java/io/mrkuhne/mezo/feature/character/` (24 files, see §8)

**Frontend — data layer** (`frontend/src/data/character/`):
- `characterApi.ts` — the fetch client + `confidenceWord()` (the 0.75/0.5 word thresholds)
- `characterHooks.ts` — every `useCharacterX()` dual-mode hook (§6), re-exported through
  `frontend/src/data/hooks.ts`
- `characterMock.ts` — the mock seeds (mirrors the approved prototype's `DIMS`/`CSAPAT`/`FEED`/
  `KONZ`/`TRANSCRIPT` content verbatim, mapped onto the real DTO shapes)

**Frontend — feature package** (`frontend/src/features/character/`):
- `pages/KarakterHubPage.tsx` — the hub (ring hero + 4-tile mosaic + bootstrap ceremony faces)
- `pages/DimensionsPage.tsx` / `DimensionPage.tsx` — the 8-tile list + one dimension's claims
- `pages/CharacterFeedPage.tsx` — the day-grouped observation feed
- `pages/CsapatPage.tsx` — the 9 persona cards
- `pages/KonziliumPage.tsx` — the conference list + `?id=` transcript view
- `components/PersonaOrb.tsx` — the domain-color orb-variant sprite wrapper (`s-orb-*`)
- `components/MaturityRing.tsx` — the 7-arc SVG ring
- `components/ClaimTile.tsx` — one claim's confidence chip + feedback pills
- `components/TranscriptTurn.tsx` — one konzílium transcript turn (persona rail, szkeptikus/
  ruling faces, the "DANIEL VÁLASZA — " gold-rail line detection)
- `expertColors.ts` — the one shared `EXPERT_COLORS` map (ring arcs, orbs, tiles all key off it)
- `dossierState.ts` — `isDossierEmpty()`, the one shared pre-bootstrap predicate (hub +
  `EnHubPage`'s Karakter tile both call it, never re-derive it)
- `character.css` — every `.kr-*` rule (source-cited per section against
  `docs/design_2.0/prototypes/src/karakter-head.html`/`karakter-body.html`)

**Router**: `frontend/src/app/router.tsx` — `me/karakter`, `me/karakter/dimenziok`,
`me/karakter/dimenzio/:key`, `me/karakter/feed`, `me/karakter/csapat`, `me/karakter/konzilium`
(the last carries its own `?id=` transcript state, not a child route)

**Docs**: this file; driving spec
[`docs/superpowers/specs/2026-08-27-user-character-dossier-design.md`](../superpowers/specs/2026-08-27-user-character-dossier-design.md);
backend slice plans `docs/superpowers/plans/2026-08-2*-character-slice*.md`,
`docs/superpowers/plans/2026-08-3*-character-slice*.md`, the S7 consolidation slice
(`docs/superpowers/plans/2026-08-31-character-slice7-consolidation.md`); the FE slice plan
`docs/superpowers/plans/2026-09-01-character-slice8-fe.md` (`mezo-1gim.13`, Tasks 1–5).

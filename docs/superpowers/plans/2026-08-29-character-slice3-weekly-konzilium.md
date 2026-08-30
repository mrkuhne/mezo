# Karakter Slice 3 — Weekly Konzílium Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The weekly konzílium — a really-executed multi-turn exchange (experts propose → Szkeptikus attacks → Mezo rules) that turns a week's observations into claim transitions and rewritten dimension portraits, persisted with its transcript — bd `mezo-1gim.5`, spec `docs/superpowers/specs/2026-08-27-user-character-dossier-design.md` §3/§6/§7.

**Architecture:** Four new services in `feature/character/service/`: `KonziliumProposalRound` (per-expert flash-tier proposals over the week's unconsumed observations), `KonziliumVerdictRound` (Szkeptikus + Integrátor, smart tier, producing rulings), `ClaimLifecycle` (pure application of rulings to `character_claim` rows), and `CharacterConferenceService` (the orchestrator: runs the rounds, rewrites portraits, appends revisions, assembles the outcome diff, marks observations consumed, persists one `character_conference` row with the real transcript — all in one transaction), plus `CharacterConferenceJob` (Sunday 19:30 cron, after `MemoirJob`).

**Tech Stack:** Spring Boot 4, `CompanionLlm` port (`complete` cheap tier for experts, `completeSmart` for Szkeptikus/Integrátor/portraits), `FakeCompanionLlm` marker mirrors, JPA repositories from S1, `LlmCallContextHolder` audit binding, JUnit Testcontainers ITs.

## Global Constraints

- Every konzílium bean conditions on BOTH `FeaturesConfiguration.CHARACTER_SWITCH` AND `COMPANION_SWITCH`; the job adds `CHARACTER_CONFERENCE_JOB_SWITCH = "mezo.techcore.cron.character-conference-job.enabled"` (new constant).
- Cron: `mezo.character.conference.cron: "0 30 19 * * SUN"` — Sunday 19:30, AFTER `mezo.proactive.memoir.cron` (19:00). Verify no other cron occupies 19:30 before committing.
- Claim status enum is `ACTIVE|RETIRED` only — a proposal Mezo rejects NEVER becomes a claim row; it lives only in the transcript (spec §4).
- Confidence is `numeric(3,2)` in `[0,1]`; every change appends a `ClaimConfidenceHistoryEnvelope.Point(value, cause, at)`. New claims start at the Integrátor's ruled confidence, clamped to `[0.30, 0.90]` (nothing is certain from one week; nothing enters below the prompt-injection floor's usefulness).
- Marker constants (fake dispatches on them; `FakeCompanionLlm` mirrors them as LITERALS to avoid a `companion → character` package cycle — the S2 `OBSERVATION_MARKER_MIRROR` precedent, pinned equal by an IT assertion):
  `PROPOSAL_MARKER = "KARAKTER-JAVASLAT-FELADAT"`, `SKEPTIC_MARKER = "KARAKTER-SZKEPTIKUS-FELADAT"`,
  `INTEGRATOR_MARKER = "KARAKTER-INTEGRATOR-FELADAT"`, `PORTRAIT_MARKER = "KARAKTER-PORTRE-FELADAT"`.
- LLM audit: every call wrapped in `llmCallContextHolder.runWith(new LlmCallContext("character", <op>, <entityKind>, null), ...)` with ops `propose` / `skeptic` / `integrate` / `portrait` (the S2 `observe` precedent).
- Honest states: no unconsumed observations for the week ⇒ NO conference row, no LLM calls, return null. An unusable answer in a round ⇒ that round contributes nothing and the conference still persists what actually happened (never a fabricated turn). Portrait rewrite failure for one dimension ⇒ that dimension keeps its old portrait; the rest proceed.
- One LIVE `WEEKLY` conference per user+week (S1 partial unique index) — re-running a generated week is a no-op returning the existing row.
- NEVER map a bare `List<String>` with `SqlTypes.JSON` (bd memory `hibernate-list-string-json-array-leak`); no new entity fields are needed in this slice.
- ArchUnit: no raw `RuntimeException`/`IllegalStateException`/`IllegalArgumentException` outside `techcore` (use `SystemRuntimeErrorException` + `SystemMessage`, and add every new code to `messages.properties`); `@Transactional` method-level only; services live in `..service..`.
- Local tests (focused only): `cd backend && ./mvnw test -Dtest=<Pattern> -Dmezo.test.use-testcontainers=true`. CI (self-PR) is the authoritative full-suite gate.
- Conventional commits with bd id `mezo-1gim.5`; regenerate `docs/CODEMAP.md` in the same change (CI lint gate).

---

### Task 1: Week gather + expert proposal round

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumProposalRound.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/ClaimProposal.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/CharacterObservationRepository.java` (week finder)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/CharacterClaimRepository.java` (all-active finder)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (proposal marker mirror + sentinel)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumProposalRoundIT.java`

**Interfaces:**
- Consumes: S1 `CharacterObservationEntity` (`expertKey`, `day`, `text`, `salience`, `signals`, `consumedByConferenceId`), `CharacterClaimEntity`, `CharacterDimensionEntity`; S2 `CharacterExpertCatalog.Expert(key, displayName, primaryDimensionKey, systemPersona)`, `CharacterObservationService.OBSERVATION_MARKER` (as the mirror precedent only).
- Produces (Tasks 2–3 rely on these EXACT names):
  - `record ClaimProposal(String expertKey, String kind, String dimensionKey, UUID claimId, String text, java.math.BigDecimal confidence, boolean sensitive, String rationale)` where `kind ∈ {"NEW","UP","DOWN","RETIRE"}` (`claimId` non-null for UP/DOWN/RETIRE, null for NEW; `dimensionKey` non-null for NEW).
  - `KonziliumProposalRound.Result(List<ClaimProposal> proposals, List<ConferenceTranscriptEnvelope.Turn> turns, List<UUID> observationIds)`
  - `KonziliumProposalRound.run(UUID owner, LocalDate weekStart, List<CharacterObservationEntity> weekObservations)` → `Result`
  - `CharacterObservationRepository.findByCreatedByAndDayBetweenAndConsumedByConferenceIdIsNullOrderByDayAscCreatedAtAsc(UUID createdBy, LocalDate from, LocalDate to)`
  - `CharacterClaimRepository.findByCreatedByAndStatusOrderByConfidenceDesc(UUID createdBy, String status)`

- [ ] **Step 1: Write the failing IT**

`KonziliumProposalRoundIT.java` — `@ActiveProfiles("companion-fake")`, extends `ApiIntegrationTest`; seed observations directly through `CharacterObservationRepository` (the `CharacterObservationServiceIT` seeding idiom — read it first for the owner-id plumbing):

```java
    private static final LocalDate WEEK_START = LocalDate.of(2026, 8, 24); // ISO Monday

    @Test
    void run_groupsByExpert_returnsProposalsAndOneTurnPerExpert() {
        UUID owner = ownerId();
        seedObservation(owner, "drill", WEEK_START.plusDays(1), "3 napja nincs kaja-log.", (short) 4);
        seedObservation(owner, "drill", WEEK_START.plusDays(3), "Check-in kihagyás.", (short) 3);
        seedObservation(owner, "pszichologus", WEEK_START.plusDays(2), "Feszült napló.", (short) 3);

        KonziliumProposalRound.Result result = proposalRound.run(owner, WEEK_START,
                observationRepository.findByCreatedByAndDayBetweenAndConsumedByConferenceIdIsNullOrderByDayAscCreatedAtAsc(
                        owner, WEEK_START, WEEK_START.plusDays(6)));

        // canned fake answer = one NEW proposal per expert
        assertThat(result.proposals()).hasSize(2)
                .extracting(ClaimProposal::expertKey)
                .containsExactlyInAnyOrder("drill", "pszichologus");
        assertThat(result.proposals()).allSatisfy(p -> {
            assertThat(p.kind()).isEqualTo("NEW");
            assertThat(p.confidence()).isBetween(new BigDecimal("0.00"), new BigDecimal("1.00"));
            assertThat(p.text()).isNotBlank();
        });
        assertThat(result.turns()).hasSize(2)
                .extracting(ConferenceTranscriptEnvelope.Turn::persona)
                .containsExactlyInAnyOrder("drill", "pszichologus");
        assertThat(result.observationIds()).hasSize(3);
    }

    @Test
    void run_sentinelScriptsProposals_invalidOnesAreDropped() {
        UUID owner = ownerId();
        // the sentinel rides in the observation TEXT, which the user message carries
        seedObservation(owner, "drill", WEEK_START.plusDays(1),
                "Jel. [fake-char-proposals:[" 
                + "{\"kind\":\"NEW\",\"dimensionKey\":\"discipline\",\"text\":\"Stresszes héten elmarad a logolás.\",\"confidence\":0.62,\"sensitive\":false,\"rationale\":\"3 nap kihagyás.\"},"
                + "{\"kind\":\"NEW\",\"dimensionKey\":\"nonsense\",\"text\":\"Rossz dimenzió.\",\"confidence\":0.5},"
                + "{\"kind\":\"UP\",\"text\":\"Hiányzik a claimId.\",\"confidence\":0.7},"
                + "{\"kind\":\"NEW\",\"dimensionKey\":\"discipline\",\"text\":\"  \",\"confidence\":0.5}"
                + "]]", (short) 4);

        KonziliumProposalRound.Result result = proposalRound.run(owner, WEEK_START, /* the week's rows */ …);

        assertThat(result.proposals()).singleElement().satisfies(p -> {
            assertThat(p.dimensionKey()).isEqualTo("discipline");
            assertThat(p.confidence()).isEqualByComparingTo(new BigDecimal("0.62"));
            assertThat(p.expertKey()).isEqualTo("drill");
        });
    }

    @Test
    void run_unknownExpertKey_skipsOnlyThatExpert() {
        UUID owner = ownerId();
        seedObservation(owner, "nonsense-expert", WEEK_START.plusDays(1), "Árva megfigyelés.", (short) 3);
        seedObservation(owner, "drill", WEEK_START.plusDays(2), "Valódi jel.", (short) 4);

        KonziliumProposalRound.Result result = proposalRound.run(owner, WEEK_START, /* the week's rows */ …);

        assertThat(result.proposals()).extracting(ClaimProposal::expertKey).containsExactly("drill");
    }
```

(Write the `…` gathers out fully with the repository finder; `seedObservation` builds a
`CharacterObservationEntity` exactly as `CharacterObservationServiceIT` does — `createdBy`,
`expertKey`, `dimensionKeys = new ObservationDimensionKeysEnvelope(List.of(<expert's primary dimension>))`,
`day`, `text`, `salience`, `signals = new ObservationSignalsEnvelope(List.of())`.)

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && ./mvnw test -Dtest=KonziliumProposalRoundIT -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implement**

`ClaimProposal.java` — the record from Interfaces-Produces, with a short javadoc naming spec §6 step 1.

`KonziliumProposalRound.java` — `@Slf4j @Service @RequiredArgsConstructor`, conditioned on both switches. Contract:

1. Group `weekObservations` by `expertKey` (LinkedHashMap, catalog order preserved by input order).
2. Per expert (skip + log on unknown key — `CharacterExpertCatalog.byKey` inside the try):
   - system prompt = `PROPOSAL_MARKER + "\n" + expert.systemPersona() + "\n" + PROPOSAL_CONTRACT`,
     where `PROPOSAL_CONTRACT` (HU) instructs: answer STRICTLY a JSON array, 0–3 items, each
     `{"kind":"NEW|UP|DOWN|RETIRE","dimensionKey":"...","claimId":"...","text":"...","confidence":0.0-1.0,"sensitive":true|false,"rationale":"..."}`;
     NEW needs `dimensionKey`, UP/DOWN/RETIRE need `claimId` from the listed active claims; ground
     every proposal in the listed observations, invent no numbers; mark `sensitive` for
     self-perception / rejection-pattern / medication-cycle claims (spec §3).
   - user message = `"Hét: " + weekStart + " – " + weekStart.plusDays(6)` + the expert's
     observations as numbered `"<day> (súly <salience>): <text>"` lines + a
     `"Meglévő aktív állítások:"` block listing that expert's dimensions' ACTIVE claims as
     `"<claimId> (biztonság <confidence>): <text>"` (empty ⇒ `"nincs"`).
   - one `companionLlm.complete(system, user)` (cheap tier) inside
     `llmCallContextHolder.runWith(new LlmCallContext("character", "propose", "expert", null), …)`.
   - parse strictly (the `CharacterObservationService.parse` fence-strip idiom — read it and reuse
     the same defensive shape), validate: drop blank `text`; drop NEW without a known dimension key
     (`CharacterCoreCatalog` keys OR an existing CHAPTER dimension key for this owner —
     pass the owner's dimension keys in); drop UP/DOWN/RETIRE without a `claimId` that parses as a
     UUID and belongs to the owner's ACTIVE claims; clamp `confidence` into `[0,1]`, default `0.50`
     when absent; cap 3 per expert.
   - one transcript turn per expert that produced ANY answer: `persona = expert.key()`,
     `text` = the expert's own summary line (first sentence of the raw answer is NOT reliable —
     instead render a deterministic HU line: `expert.displayName() + ": " + proposals.size()
     + " javaslat a hét " + observations.size() + " megfigyeléséből."` followed by each proposal's
     `text` on its own line), `refIds` = the expert's observation ids as strings.
3. Failures are per-expert isolated (`try/catch` + `log.warn`, continue).
4. `Result.observationIds()` = every input observation's id (the conference consumes them all,
   including those whose expert failed — otherwise a broken expert would replay forever).

`FakeCompanionLlm` — add next to the S2 observation branch:

```java
    /** Mirror of KonziliumProposalRound.PROPOSAL_MARKER (feature/character) — LITERAL, cycle rule. */
    public static final String PROPOSAL_MARKER_MIRROR = "KARAKTER-JAVASLAT-FELADAT";

    /** Scripted konzílium proposals (mezo-1gim.5): {@code [fake-char-proposals:[…]]}. */
    public static final Pattern CHAR_PROPOSALS_SENTINEL =
            Pattern.compile("\\[fake-char-proposals:(\\[.*])]", Pattern.DOTALL);
```

dispatch branch (before the generic branches, next to the observation branch): if the system
prompt starts with `PROPOSAL_MARKER_MIRROR`, return the sentinel group when present, else the
canned single-proposal array:

```java
"[{\"kind\":\"NEW\",\"dimensionKey\":\"%s\",\"text\":\"Fake javaslat.\",\"confidence\":0.55,\"sensitive\":false,\"rationale\":\"Fake indoklás.\"}]"
```

where `%s` is resolved by the fake from the user message's first `"dimenzió: <key>"` hint —
simpler and deterministic: have `KonziliumProposalRound` append a final user-message line
`"Alapértelmezett dimenzió: " + expert.primaryDimensionKey()` and let the fake regex that value
out (`Pattern.compile("Alapértelmezett dimenzió: ([a-z]+)")`, fallback `"discipline"`).

- [ ] **Step 4: Run — expect PASS** (same command) + `./mvnw test -Dtest=ArchitectureTest`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(character): konzílium proposal round — per-expert claim proposals (mezo-1gim.5)"
```

---

### Task 2: Szkeptikus + Integrátor rounds and the claim lifecycle

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumVerdictRound.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/ClaimRuling.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/ClaimLifecycle.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (skeptic + integrator mirrors/sentinels)
- Modify: `backend/src/main/resources/messages.properties` (any new error code used)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumVerdictRoundIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/ClaimLifecycleIT.java`

**Interfaces:**
- Consumes: Task 1 `ClaimProposal`; S1 claim/dimension entities + repositories.
- Produces (Task 3 relies on these EXACT names):
  - `record ClaimRuling(ClaimProposal proposal, boolean accepted, java.math.BigDecimal ruledConfidence, String reason)`
  - `record ChapterProposal(String title, String rationale)`
  - `KonziliumVerdictRound.Result(List<ClaimRuling> rulings, List<ChapterProposal> chapters, List<ConferenceTranscriptEnvelope.Turn> turns)`
  - `KonziliumVerdictRound.run(UUID owner, LocalDate weekStart, List<ClaimProposal> proposals)` → `Result`
  - `ClaimLifecycle.apply(UUID owner, UUID conferenceId, List<ClaimRuling> rulings)` → `List<ConferenceOutcomeEnvelope.Change>`
  - `ClaimLifecycle.openChapters(UUID owner, UUID conferenceId, List<ChapterProposal> chapters)` → `List<ConferenceOutcomeEnvelope.Change>`

Verdict round contract:

1. Nothing to judge (`proposals.isEmpty()`) ⇒ empty `Result`, no LLM calls.
2. **Szkeptikus** — ONE `completeSmart` call (op `skeptic`): system = `SKEPTIC_MARKER` + the
   Szkeptikus persona (dry, contrarian; brief: attack every proposal — evidence sufficiency,
   alternative explanations, over-interpretation; extra scrutiny on `sensitive` ones) + a contract
   demanding a STRICT JSON array of `{"index":<0-based>,"verdict":"KEEP|KILL","argument":"..."}`,
   one entry per numbered proposal. User message = the numbered proposals (`kind`, target,
   `text`, `confidence`, `sensitive`, `rationale`). Parse; missing/invalid entries default to
   `KEEP` with `argument = "nincs ellenérv"` (the honest default: silence is not a kill).
   One transcript turn `persona = "szkeptikus"` rendering each index's verdict + argument.
3. **Integrátor** — ONE `completeSmart` call (op `integrate`): system = `INTEGRATOR_MARKER` + Mezo's
   companion voice + a contract demanding STRICT JSON
   `{"rulings":[{"index":n,"accept":true|false,"confidence":0.0-1.0,"reason":"..."}],"chapters":[{"title":"...","rationale":"..."}]}`.
   User = the numbered proposals + the Szkeptikus's verdicts. Parse; a proposal with no ruling
   defaults to `accepted=false, reason="nem került döntésre"`. Accepted rulings clamp confidence to
   `[0.30, 0.90]`; when the model omits it, fall back to the proposal's own confidence clamped the
   same way. Chapters: drop blank titles, cap 1 per conference (spec §2 — a chapter is rare).
   One transcript turn `persona = "mezo"` rendering each ruling + any chapter proposal.
4. Any round failing to parse ⇒ that round contributes an empty list and a turn stating the honest
   outcome is NOT written (never fabricate a turn); log.warn and continue.

`ClaimLifecycle.apply` (pure persistence, no LLM):

- `NEW` accepted ⇒ insert `CharacterClaimEntity` (dimension resolved by `dimensionKey` for the
  owner; skip + log if the dimension is missing), `status="ACTIVE"`, `confidence = ruledConfidence`,
  `originConferenceId = conferenceId`, `proposedBy = proposal.expertKey()`, `sensitive`,
  `evidence = new ClaimEvidenceEnvelope(List.of(new Ref("conference", conferenceId.toString(), "konzílium")))`,
  `userFeedback = new ClaimFeedbackEnvelope(List.of())`,
  `confidenceHistory = new ClaimConfidenceHistoryEnvelope(List.of(new Point(ruledConfidence, "konzílium", Instant.now())))`
  ⇒ Change `("CLAIM_ACCEPTED", dimensionKey, claimId, text)`.
- `UP` / `DOWN` accepted ⇒ load the claim (owner-scoped, ACTIVE); new confidence = ruled value, or
  `±0.10` from the current value when the ruling carried none; clamp `[0.05, 0.95]`; append a
  history point (`cause = "konzílium"`); `updatedAt = Instant.now()` ⇒ Change
  `("CLAIM_CONFIDENCE_UP"/"CLAIM_CONFIDENCE_DOWN", dimensionKey, claimId, text)`.
- `RETIRE` accepted ⇒ `status = "RETIRED"`, history point (`cause = "konzílium: nyugdíjazva"`),
  `updatedAt` ⇒ Change `("CLAIM_RETIRED", …)`.
- Rejected rulings ⇒ NO row change, NO change entry (the transcript already carries them).
- Unknown/foreign claim id ⇒ log.warn, skip (never throw).

`ClaimLifecycle.openChapters` ⇒ for each chapter: insert a `CharacterDimensionEntity` with
`kind="CHAPTER"`, `key = slug(title)` (lowercase, non-alphanumerics → `-`, max 40 chars, suffix
`-2`, `-3`… on collision with an existing key for this owner), `title`, `expertKey = null`,
empty portrait, maturity 0 ⇒ Change `("CHAPTER_OPENED", key, null, title)`.

- [ ] **Step 1: Write the failing ITs**

`KonziliumVerdictRoundIT` — three tests: (a) empty proposals ⇒ empty result and (asserted via
repository/fake) no rows/turns; (b) canned fake ⇒ every proposal accepted with clamped
confidence and exactly two turns (`szkeptikus`, `mezo`); (c) sentinel-scripted
`[fake-char-skeptic:[…]]` + `[fake-char-integrator:{…}]` (planted in a proposal's text via the
Task-1 sentinel) ⇒ a KILLed proposal is rejected, an out-of-range confidence is clamped to
`0.90`, a blank-titled chapter is dropped.

`ClaimLifecycleIT` — one test per branch: NEW insert (field-by-field assertions incl. envelopes),
UP/DOWN confidence move + history append + clamp, RETIRE status flip, rejected ruling leaves no
trace, unknown claim id skips without throwing, and `openChapters` slug collision (`"Munka stressz"`
twice ⇒ keys `munka-stressz` and `munka-stressz-2`).

Write both files out fully, following `CharacterObservationServiceIT`'s owner/seed plumbing.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && ./mvnw test -Dtest='KonziliumVerdictRoundIT,ClaimLifecycleIT' -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implement** the three classes + the two fake branches.

**Proposal numbering (load-bearing — the fake keys off it):** `KonziliumVerdictRound` numbers the
proposals in BOTH user messages as lines starting `"P<index>. "` (`P0. `, `P1. `, …).

Fake additions (mirrors + sentinels, next to the Task-1 proposal branch):

```java
    /** Mirror of KonziliumVerdictRound.SKEPTIC_MARKER (feature/character) — LITERAL, cycle rule. */
    public static final String SKEPTIC_MARKER_MIRROR = "KARAKTER-SZKEPTIKUS-FELADAT";
    /** Mirror of KonziliumVerdictRound.INTEGRATOR_MARKER (feature/character) — LITERAL, cycle rule. */
    public static final String INTEGRATOR_MARKER_MIRROR = "KARAKTER-INTEGRATOR-FELADAT";

    public static final Pattern CHAR_SKEPTIC_SENTINEL =
            Pattern.compile("\\[fake-char-skeptic:(\\[.*])]", Pattern.DOTALL);
    public static final Pattern CHAR_INTEGRATOR_SENTINEL =
            Pattern.compile("\\[fake-char-integrator:(\\{.*})]", Pattern.DOTALL);
    /** The proposal numbering the konzílium user messages carry — the canned answers count these. */
    private static final Pattern CHAR_PROPOSAL_INDEX = Pattern.compile("(?m)^P(\\d+)\\. ");
```

Canned fallbacks (deterministic, index-complete):

- **Szkeptikus** — for every `P<n>` found in the user message, emit
  `{"index":n,"verdict":"KEEP","argument":"Fake ellenérv: elfogadható."}`; no matches ⇒ `[]`.
- **Integrátor** — for every `P<n>` found, emit
  `{"index":n,"accept":true,"confidence":0.6,"reason":"Fake döntés."}` inside
  `{"rulings":[…],"chapters":[]}`; no matches ⇒ `{"rulings":[],"chapters":[]}`.

The verdict-round ITs assert exactly this: every canned proposal is ACCEPTED at confidence
`0.60`, and the default-reject path is exercised only through the `[fake-char-integrator:{…}]`
sentinel (a ruling list that omits an index).

- [ ] **Step 4: Run — expect PASS** (same command) + `./mvnw test -Dtest=ArchitectureTest`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(character): szkeptikus + integrátor rounds and claim lifecycle (mezo-1gim.5)"
```

---

### Task 3: Conference orchestration — portraits, transcript, outcome, consumption

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterConferenceService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/PortraitWriter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (portrait mirror + sentinel)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/CharacterConferenceRepository.java` (week finder)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterConferenceServiceIT.java`

**Interfaces:**
- Consumes: Tasks 1–2 (`KonziliumProposalRound.run`, `KonziliumVerdictRound.run`,
  `ClaimLifecycle.apply/openChapters`); S1 entities/repositories.
- Produces (Task 4 relies on): `CharacterConferenceService.runWeekly(UUID owner, LocalDate weekStart)`
  → `CharacterConferenceEntity` (null when the week has no unconsumed observations);
  `CharacterConferenceRepository.findByCreatedByAndKindAndWeekStart(UUID, String, LocalDate)`.

`PortraitWriter.rewrite(UUID owner, CharacterDimensionEntity dimension, List<CharacterClaimEntity> activeClaims, UUID conferenceId)` → `boolean`:
one `completeSmart` call (op `portrait`) with system = `PORTRAIT_MARKER` + the dimension's expert
persona (CHAPTER ⇒ Mezo's integrátor voice) + a contract demanding 2–5 plain HU sentences,
second person, companion tone, grounded ONLY in the listed claims, sensitive claims phrased as a
mirror/question, no numbers that are not in the claims. User = the dimension title + previous
portrait (or `"nincs"`) + the ACTIVE claims with confidence words (`biztos` ≥ 0.75,
`valószínű` ≥ 0.5, `figyeljük` below). On a blank/failed answer: return `false`, leave the
portrait untouched. On success: bump `version`, set `portrait`, set `updatedAt`, recompute
`maturity` = `min(100, round(20 * activeClaims.size() + 40 * meanConfidence))` (a coverage×confidence
roll-up; document the formula in the javadoc), and append a `CharacterPortraitRevisionEntity`
(`dimensionId`, `version`, `portrait`, `conferenceId`).

`CharacterConferenceService.runWeekly` (`@Transactional`):

1. Existing LIVE WEEKLY row for the week ⇒ return it (idempotent).
2. Gather unconsumed observations for `weekStart..weekStart+6`; empty ⇒ return `null` (no row, no
   LLM calls — the honest empty week).
3. `KonziliumProposalRound.run` → proposals + turns.
4. `KonziliumVerdictRound.run` → rulings + chapters + turns.
5. Persist the conference row FIRST (kind `WEEKLY`, `weekStart`, `generatedAt = Instant.now()`,
   transcript = proposal turns + verdict turns, outcome = empty for now) so claims can reference
   its id; then `ClaimLifecycle.openChapters` + `ClaimLifecycle.apply` → changes.
6. Rewrite the portrait of every dimension touched by an accepted ruling (dedup by dimension id;
   a CHAPTER opened this run is included) via `PortraitWriter`; each success adds a Change
   `("PORTRAIT_REWRITTEN", dimensionKey, null, dimension title)`.
7. Set the conference's `outcome = new ConferenceOutcomeEnvelope(changes)` and mark every gathered
   observation's `consumedByConferenceId = conference.getId()`.
8. Return the row. Any single failure inside steps 3–6 is contained by the services themselves; an
   exception escaping step 5–7 rolls the whole transaction back (no partial conference).

- [ ] **Step 1: Write the failing IT**

`CharacterConferenceServiceIT` — five tests:
(a) **empty week** ⇒ `runWeekly` returns null, no conference rows, no claims;
(b) **canned end-to-end** ⇒ observations for two experts produce one conference row whose
transcript has expert turns + `szkeptikus` + `mezo`, ACTIVE claims exist for the accepted
proposals, every gathered observation now carries `consumedByConferenceId`, the touched dimensions
have non-empty portraits with `version = 1` and a matching `character_portrait_revision` row, and
`outcome.changes()` contains `CLAIM_ACCEPTED` + `PORTRAIT_REWRITTEN` kinds;
(c) **idempotency** ⇒ a second `runWeekly` for the same week returns the same row id and creates no
new claims/revisions;
(d) **portrait failure isolation** ⇒ plant the portrait sentinel with an EMPTY payload
(`[fake-char-portrait:]`, which the branch returns verbatim as a blank answer) in an observation's
text, so only the portrait call degrades: assert the dimension keeps `portrait` empty with
`version` 0 and no `character_portrait_revision` row, while the accepted claims DID land and the
conference row exists (with no `PORTRAIT_REWRITTEN` change);
(e) **chapter opening** ⇒ an integrator sentinel proposing a chapter creates a `CHAPTER` dimension
with the slugged key and a `CHAPTER_OPENED` change.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && ./mvnw test -Dtest=CharacterConferenceServiceIT -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implement** the two classes + the fake portrait branch
  (`PORTRAIT_MARKER_MIRROR = "KARAKTER-PORTRE-FELADAT"`,
  `CHAR_PORTRAIT_SENTINEL = Pattern.compile("\\[fake-char-portrait:([^\\]]*)]", Pattern.DOTALL)`,
  canned fallback: `"Ezen a héten a fegyelem képe formálódik. Figyeljük tovább."`).

- [ ] **Step 4: Run — expect PASS**; also re-run `./mvnw test -Dtest='Character*,Konzilium*,ClaimLifecycle*,ArchitectureTest' -Dmezo.test.use-testcontainers=true`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(character): weekly konzílium orchestration + portrait rewrite (mezo-1gim.5)"
```

---

### Task 4: Sunday cron + switch-off IT + ship

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterConferenceJob.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (`CHARACTER_CONFERENCE_JOB_SWITCH`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/config/CharacterProperties.java` (`Conference conference` sub-record)
- Modify: `backend/src/main/resources/application.yml` (cron + switch defaults)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterConferenceJobIT.java`
- Modify: `docs/CODEMAP.md` (regenerate)

**Interfaces:**
- Consumes: Task 3 `CharacterConferenceService.runWeekly(UUID, LocalDate)`; `AppUserRepository.findAll()`.
- Produces: the cron bean.

`CharacterProperties` gains `@NotNull @Valid Conference conference` with
`record Conference(@NotBlank String cron, @Min(1) @Max(8) int catchUpWeeks)`; defaults
`cron: "0 30 19 * * SUN"`, `catch-up-weeks: 2`.

`CharacterConferenceJob` — the `CharacterObservationJob` shape, triple-switch-gated
(`CHARACTER_SWITCH`, `COMPANION_SWITCH`, `CHARACTER_CONFERENCE_JOB_SWITCH`),
`@Scheduled(cron = "${mezo.character.conference.cron}")`. `run()`: the just-finished week's ISO
Monday is `LocalDate.now().with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))`
when today is Sunday — compute it as `LocalDate.now().minusDays(6).with(previousOrSame(MONDAY))`
so a Sunday run targets the week that is ending; then loop back `catchUpWeeks - 1` further weeks,
oldest first, calling `runWeekly` per user per week inside a per-week `try/catch` (the
`DailySummaryJob` isolation idiom) and logging the per-user total.

- [ ] **Step 1: Write the failing IT**

`CharacterConferenceJobIT` — two nested slices (the `CharacterObservationJobIT` structure):
**Enabled** — seed unconsumed observations dated inside the target week, call `job.run()` directly,
assert a WEEKLY conference row exists for that week and a second `run()` adds none; **Disabled** —
`@TestPropertySource(properties = "mezo.techcore.cron.character-conference-job.enabled=false")`,
assert `context.getBeanNamesForType(CharacterConferenceJob.class)` is empty.

NOTE for the implementer: the job derives its target week from `LocalDate.now()`. Seed the
observations relative to the SAME derivation (compute the expected week in the test with the same
expression) so the test is date-independent.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && ./mvnw test -Dtest=CharacterConferenceJobIT -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implement** job + properties + yml defaults (verify 19:30 Sunday is free before
  committing: `grep -n 'cron: "0 30 19' backend/src/main/resources/application.yml` must show only
  the new entry).

- [ ] **Step 4: Run — expect PASS**, then the full local gate set:
  `./mvnw test -Dtest='Character*,Konzilium*,ClaimLifecycle*,DetectorTest,ArchitectureTest' -Dmezo.test.use-testcontainers=true`,
  `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check`, `node scripts/lint-liquibase.mjs`.

- [ ] **Step 5: Commit**

```bash
git add backend/src docs/CODEMAP.md
git commit -m "feat(character): Sunday konzílium cron + catch-up (mezo-1gim.5)"
```

---

### Task 5: Ship the slice

- [ ] Final focused gates (command above) + `./mvnw compile -q`.
- [ ] House flow: push `feat/character-s3-konzilium`, self-PR → CI green → `git pull --rebase` on
  main → `--no-ff` merge (use `ALLOW_MAIN_COMMIT=1` if the merge needs a manual commit) → push →
  delete branch → `bd close mezo-1gim.5` → `bd dolt push`.

## Out of scope (later slices)

S4 bootstrap + monthly deep read (reuses these rounds with a different gather), S5 `[Karakter]`
prompt block, S6 claim feedback endpoint + user observations, S7 FE. No API/contract changes in
this slice — the S1 read endpoints already expose conferences, claims and portraits.

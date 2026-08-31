# Karakter Slice 4 — Bootstrap + Monthly Deep Read Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The one-time BOOTSTRAP konzílium that stands up the dossier from the user's whole existing history, and the MONTHLY deep read that re-evaluates the standing claim base for slow drift — bd `mezo-1gim.6`, spec `docs/superpowers/specs/2026-08-27-user-character-dossier-design.md` §6.

**Architecture:** `KonziliumProposalRound` grows an evidence-block seam so the S3 rounds can be driven by something other than a week's observations; `CharacterHistoryReads` composes per-expert evidence from the existing memory layers (daily summaries, confirmed patterns, prompt-eligible knowledge facts, weekly reviews); `CharacterBootstrapService` runs the BOOTSTRAP conference once; `CharacterMonthlyService` runs the MONTHLY conference (claim-base re-evaluation + stale-chapter retirement); `CharacterMonthlyJob` fires it on the first Sunday of each month. The verdict round, claim lifecycle, portrait writer and conference persistence are reused UNCHANGED.

**Tech Stack:** Spring Boot 4, `CompanionLlm` (cheap tier for expert evidence rounds, smart tier for Szkeptikus/Integrátor/portraits — inherited from S3), JPA repositories, contract-first OpenAPI (`api/feature/character/character.yml` + regeneration), JUnit Testcontainers ITs.

## Global Constraints

- Every new bean conditions on BOTH `FeaturesConfiguration.CHARACTER_SWITCH` AND `COMPANION_SWITCH`; the monthly job adds `CHARACTER_MONTHLY_JOB_SWITCH = "mezo.techcore.cron.character-monthly-job.enabled"` (new constant).
- Conference kinds are exactly `BOOTSTRAP|WEEKLY|MONTHLY` (S1 CHECK constraint) — no new kinds, no migration in this slice.
- Reuse, don't fork: `KonziliumVerdictRound.run`, `ClaimLifecycle.apply/openChapters`, `PortraitWriter.rewrite` and the conference-persistence shape are used as they are. Only `KonziliumProposalRound` is extended (additively — its existing `run(owner, weekStart, observations)` signature and behavior must not change; the S3 ITs must stay green untouched).
- Honest states: a bootstrap with no history ⇒ NO conference row, no LLM calls, `404`-free `409`-free honest empty answer (see §Task 2 for the exact contract); a monthly run with no ACTIVE claims ⇒ no row, no LLM calls.
- One live BOOTSTRAP conference per user (enforced in code — S1's partial unique index only covers WEEKLY): a second bootstrap attempt returns HTTP `409`.
- Idempotent monthly: one live MONTHLY conference per user+month, keyed on `weekStart` holding the month's FIRST day (the column is reused as the period anchor; document this in the entity-adjacent javadoc and in the service).
- LLM audit: `llmCallContextHolder.runWith(new LlmCallContext("character", <op>, <entityKind>, null), …)` with ops `bootstrap` (expert evidence round) and `monthly` (claim-base round); the reused verdict/portrait calls keep their S3 ops.
- Marker constants get LITERAL mirrors in `FakeCompanionLlm` (no `companion → character` import) pinned equal by IT assertions — the S2/S3 precedent. New markers: `BOOTSTRAP_MARKER = "KARAKTER-BOOTSTRAP-FELADAT"`, `MONTHLY_MARKER = "KARAKTER-HAVI-FELADAT"`.
- ArchUnit: no raw `RuntimeException`/`IllegalStateException`/`IllegalArgumentException` outside `techcore` (use `SystemRuntimeErrorException` + `SystemMessage`, every code added to `messages.properties`); `@Transactional` method-level only; services in `..service..`; controllers implement the generated API.
- Contract change in Task 2 ⇒ regenerate BOTH artifacts and commit them (`cd api/generate && npm run generate:api`, `cd frontend && pnpm generate:api`) — CI's contract-drift gate compares them.
- Local tests focused only: `cd backend && ./mvnw test -Dtest=<Pattern> -Dmezo.test.use-testcontainers=true`. Never the full suite; CI's self-PR is the authoritative gate.
- Conventional commits with bd id `mezo-1gim.6`; regenerate `docs/CODEMAP.md` whenever files are added.

---

### Task 1: Evidence-block seam + history reads

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumProposalRound.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/ExpertEvidence.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterHistoryReads.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterHistoryReadsIT.java`

**Interfaces:**
- Consumes: S3 `KonziliumProposalRound` internals (its per-expert prompt/parse/validate/turn pipeline), `ClaimProposal`, `CharacterExpertCatalog`; companion repositories `DailySummaryRepository.findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(UUID, LocalDate)` (entity fields `summaryDate`, `narrative`), `PatternRepository.findByCreatedByAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(UUID, String)` (use `PatternEntity.STATUS_CONFIRMED`), `KnowledgeFactRepository.findByCreatedByAndIncludeInPromptTrueAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(UUID)` — READ each entity for its real field/getter names before rendering.
- Produces (Tasks 2–3 rely on these EXACT names):
  - `record ExpertEvidence(String expertKey, List<String> lines, List<String> refIds)`
  - `KonziliumProposalRound.runOnEvidence(UUID owner, String periodLabel, String marker, String auditOp, List<ExpertEvidence> evidence)` → the SAME `KonziliumProposalRound.Result` type as `run(...)`
  - `CharacterHistoryReads.gatherHistory(UUID owner)` → `List<ExpertEvidence>` (one entry per expert that has any evidence; empty list when the user has no history)

- [ ] **Step 1: Write the failing IT**

`CharacterHistoryReadsIT.java` (`extends ApiIntegrationTest`, `@ActiveProfiles("companion-fake")` — mirror `CharacterObservationServiceIT`'s owner plumbing; seed through the existing populators in `backend/src/test/java/io/mrkuhne/mezo/support/populator/` — `DailySummaryPopulator`, `PatternPopulator`, `KnowledgeFactPopulator` all exist; READ their method signatures first):

```java
    @Test
    void gatherHistory_emptyHistory_returnsEmptyList() {
        assertThat(historyReads.gatherHistory(ownerId())).isEmpty();
    }

    @Test
    void gatherHistory_seededHistory_buildsPerExpertEvidenceWithRefs() {
        UUID owner = ownerId();
        // seed: 3 daily summaries (distinct dates), 1 CONFIRMED pattern, 1 prompt-eligible fact
        …
        List<ExpertEvidence> evidence = historyReads.gatherHistory(owner);

        // every expert that gets evidence is a known catalog key, no duplicates
        assertThat(evidence).isNotEmpty()
                .extracting(ExpertEvidence::expertKey)
                .doesNotHaveDuplicates()
                .allSatisfy(k -> assertThat(CharacterExpertCatalog.byKey(k)).isNotNull());
        // narratives/patterns/facts reach SOMEBODY's lines verbatim (no invented text)
        assertThat(evidence).anySatisfy(e ->
                assertThat(String.join("\n", e.lines())).contains("<the seeded narrative text>"));
        assertThat(evidence).allSatisfy(e -> {
            assertThat(e.lines()).isNotEmpty();
            assertThat(e.refIds()).isNotNull();
        });
    }
```

(Write the seeds and the elided `…` out fully with the real populator signatures.)

**Routing rule for `gatherHistory` (deterministic, no LLM):** daily-summary narratives go to EVERY
expert (they are whole-life prose — cap the newest `HISTORY_SUMMARY_CAP = 60` days, one line each,
`"<date>: <narrative capped at 300 chars>"`); a CONFIRMED pattern goes to the expert(s) whose
dimension its `metricKey`/`pairKey` mentions via a small explicit keyword map (document the map in
the javadoc; anything unmatched goes to `drill` as the cross-cutting behaviour expert); a
prompt-eligible knowledge fact goes to the expert whose dimension its category matches by the same
map, unmatched → `antropologus` (life context). Every line carries the source's real id in
`refIds` as `"<kind>:<uuid>"`.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && ./mvnw test -Dtest=CharacterHistoryReadsIT -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implement**

Refactor `KonziliumProposalRound` additively:

- Extract the existing per-expert body into a private method that takes
  `(UUID owner, String periodLabel, String marker, String auditOp, ExpertEvidence evidence, <the validation context it already builds: known dimension keys + owner ACTIVE claims>)` and returns
  `(proposals, turn)`.
- `run(owner, weekStart, observations)` (UNCHANGED SIGNATURE) builds one `ExpertEvidence` per expert
  from the observations — line format exactly as today (`"<day> (súly <salience>): <text>"`),
  `refIds` = observation ids — and delegates with
  `periodLabel = "Hét: " + weekStart + " – " + weekStart.plusDays(6)`, `marker = PROPOSAL_MARKER`,
  `auditOp = "propose"`. Its observable behaviour (prompt text, turns, validation, isolation) must
  not change — the S3 ITs stay green as the proof.
- `runOnEvidence(owner, periodLabel, marker, auditOp, evidence)` runs the same pipeline over
  caller-supplied blocks.

`CharacterHistoryReads` — `@Service`, both switches, read-only, no LLM; implements the routing rule
above.

- [ ] **Step 4: Run — expect PASS**, plus the S3 regression proof:
  `./mvnw test -Dtest='CharacterHistoryReadsIT,KonziliumProposalRoundIT,CharacterConferenceServiceIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(character): evidence-block seam + history reads for bootstrap (mezo-1gim.6)"
```

---

### Task 2: Bootstrap conference + endpoint

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterBootstrapService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/controller/CharacterController.java`
- Modify: `api/feature/character/character.yml` (+ regenerated `api/openapi.yml`, FE client)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (bootstrap mirror + sentinel)
- Modify: `backend/src/main/resources/messages.properties`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/CharacterConferenceRepository.java` (kind finder)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterBootstrapIT.java`

**Interfaces:**
- Consumes: Task 1 `CharacterHistoryReads.gatherHistory`, `KonziliumProposalRound.runOnEvidence`; S3 `KonziliumVerdictRound.run`, `ClaimLifecycle.apply/openChapters`, `PortraitWriter.rewrite`, `CharacterConferenceRepository`.
- Produces: `CharacterBootstrapService.run(UUID owner)` → `CharacterConferenceEntity` (null when the user has no history); `CharacterConferenceRepository.findFirstByCreatedByAndKindOrderByGeneratedAtDesc(UUID, String)`.

Service contract (`@Transactional`):

1. An existing live BOOTSTRAP row ⇒ throw
   `SystemRuntimeErrorException(SystemMessage.error("CHARACTER_BOOTSTRAP_ALREADY_RUN").build(), HttpStatus.CONFLICT)`.
2. `gatherHistory` empty ⇒ return `null` (no row, no LLM calls).
3. `runOnEvidence(owner, "Teljes eddigi történet", BOOTSTRAP_MARKER, "bootstrap", evidence)` → proposals + turns.
4. `verdictRound.run(owner, null, proposals)` — pass `null` for the week; VERIFY the S3 round tolerates
   a null week label (it renders it into prompt text) and, if it does not, add a null-safe label
   there in this task and note it in the report.
5. Persist the conference (`kind = "BOOTSTRAP"`, `weekStart = null`, transcript = proposal + verdict
   turns), then chapters + claims via `ClaimLifecycle`, then portraits for touched dimensions via
   `PortraitWriter` — the exact sequence `CharacterConferenceService.runWeekly` uses (extract the
   shared tail into a package-visible helper on `CharacterConferenceService` and call it from both
   rather than copying it — DRY, and it keeps the two paths from drifting).
6. Set the outcome diff. No observation consumption (bootstrap reads history, not observations).

Contract addition to `api/feature/character/character.yml`:

```yaml
  /api/character/bootstrap:
    post:
      tags: [Character]
      operationId: bootstrapCharacter
      summary: One-time deep read over the whole existing history that stands up the dossier
      responses:
        '200':
          description: The bootstrap konzílium that just ran
          content:
            application/json:
              schema: { $ref: '#/components/schemas/CharacterConferenceResponse' }
        '204':
          description: No history to read — nothing was generated (the honest empty state)
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '409':
          description: A bootstrap konzílium already exists for this user
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

Controller: implement the generated method — `null` service result ⇒ `ResponseEntity` with
`204` (check what the generated interface returns; if it returns the DTO directly rather than a
`ResponseEntity`, return `null` only if the generator maps that to 204 — otherwise switch the
generated signature to `ResponseEntity<CharacterConferenceResponse>` by declaring both `200` and
`204` as this contract does, and confirm after regeneration).

Fake: `BOOTSTRAP_MARKER_MIRROR = "KARAKTER-BOOTSTRAP-FELADAT"` + reuse of the proposal sentinel
shape (`CHAR_PROPOSALS_SENTINEL`) — the bootstrap round asks for the same proposal JSON, so the
branch may share the proposal branch's answer logic; keep the canned fallback identical.

- [ ] **Step 1: Write the failing IT**

`CharacterBootstrapIT.java` — four tests: (a) **no history** ⇒ `POST /api/character/bootstrap` →
`204`, no conference rows; (b) **with history** ⇒ `200` with a `BOOTSTRAP` conference whose
transcript carries expert turns + `szkeptikus` + `mezo`, ACTIVE claims exist, touched dimensions
have non-empty portraits with `version = 1` and revision rows, and NO observation is consumed;
(c) **second call** ⇒ `409` and still exactly one BOOTSTRAP row; (d) marker mirror pinned equal.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && ./mvnw test -Dtest=CharacterBootstrapIT -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implement** service + controller + contract + regeneration (`cd api/generate && npm run generate:api`, `cd frontend && pnpm generate:api`) + fake branch + message keys.

- [ ] **Step 4: Run — expect PASS**, plus `./mvnw test -Dtest='Character*,Konzilium*,ClaimLifecycle*,ArchitectureTest' -Dmezo.test.use-testcontainers=true` and `./mvnw compile -q`.

- [ ] **Step 5: Commit** (include the regenerated `api/openapi.yml` + FE client)

```bash
git add api frontend backend/src docs
git commit -m "feat(character): bootstrap konzílium over the full history + endpoint (mezo-1gim.6)"
```

---

### Task 3: Monthly deep read + chapter retirement + cron

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterMonthlyService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterMonthlyJob.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/config/CharacterProperties.java` (`Monthly` sub-record)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (`CHARACTER_MONTHLY_JOB_SWITCH`)
- Modify: `backend/src/main/resources/application.yml` (cron + switch + tunables)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (monthly mirror)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/CharacterClaimRepository.java` (if a finder is missing for "all ACTIVE claims with their dimension") 
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterMonthlyServiceIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterMonthlyScheduleTest.java`
- Modify: `docs/CODEMAP.md` (regenerate)

**Interfaces:**
- Consumes: Task 1 `runOnEvidence`; S3 verdict round / lifecycle / portrait writer / conference tail helper (Task 2 extracted it).
- Produces: `CharacterMonthlyService.run(UUID owner, LocalDate monthStart)` → `CharacterConferenceEntity` (null when there is nothing to re-evaluate); `CharacterMonthlyJob.isDeepReadDay(LocalDate today)` (pure static, `true` iff today is a Sunday with day-of-month ≤ 7).

Monthly contract (`@Transactional`):

1. Live MONTHLY row for `monthStart` (the month's first day, stored in `weekStart`) ⇒ return it.
2. Gather the owner's ACTIVE claims; empty ⇒ return `null` (no row, no LLM calls).
3. Build one `ExpertEvidence` per expert from ITS dimensions' ACTIVE claims, each line
   `"<claimId> (biztonság <confidence>, kora <days> nap, utolsó mozgás <days> nap): <text>"`
   (ages from `createdAt`/`updatedAt`), `refIds` = claim ids. CHAPTER dimensions' claims go to
   `drill` (no owning expert).
4. `runOnEvidence(owner, "Havi mélyolvasás: " + monthStart, MONTHLY_MARKER, "monthly", evidence)` —
   the monthly prompt contract (a distinct HU block appended by the caller through the marker's own
   contract text) tells experts to look for SLOW DRIFT and stale claims: prefer `UP`/`DOWN`/`RETIRE`
   over `NEW`, and to retire what the data no longer supports.
5. Verdict round → lifecycle → portraits → outcome, via the same shared tail as bootstrap/weekly.
6. **Chapter retirement**: after the lifecycle, soft-delete every `CHAPTER` dimension that (a) has no
   ACTIVE claim left AND (b) whose `updatedAt` is older than `staleChapterDays` (config, default 90)
   ⇒ Change `("CHAPTER_RETIRED", key, null, title)`. CORE dimensions are never retired.

`CharacterProperties.Monthly(@NotBlank String cron, @Min(1) @Max(365) int staleChapterDays)`;
`application.yml`: `mezo.character.monthly.cron: "0 0 20 * * SUN"` (Sunday 20:00 — verify the slot is
free) and `stale-chapter-days: 90`; the job's `run()` first-line guard is
`if (!isDeepReadDay(LocalDate.now())) return;` so only the month's FIRST Sunday actually works —
Spring's day-of-month + day-of-week combination is ambiguous, hence the code guard (document this
reasoning in the job's javadoc).

`CharacterMonthlyJob` — triple switch-gated (`CHARACTER_SWITCH`, `COMPANION_SWITCH`,
`CHARACTER_MONTHLY_JOB_SWITCH`), `@Scheduled(cron = "${mezo.character.monthly.cron}")`, loops users
with per-user `try/catch`, targets `monthStart = LocalDate.now().withDayOfMonth(1)`.

- [ ] **Step 1: Write the failing tests**

`CharacterMonthlyScheduleTest` (plain unit, no Spring) pins `isDeepReadDay` against hardcoded dates:
`2026-09-06` (first Sunday) → true; `2026-09-13` (second Sunday) → false; `2026-09-07` (Monday) →
false; `2026-10-04` (first Sunday) → true; `2026-11-01` (first Sunday, day 1) → true.

`CharacterMonthlyServiceIT` — five tests: (a) no ACTIVE claims ⇒ null, no rows; (b) canned
end-to-end ⇒ a MONTHLY conference row with `weekStart = monthStart`, transcript personas, claim
transitions applied, portraits rewritten; (c) idempotency ⇒ second run returns the same row and
adds nothing; (d) chapter retirement ⇒ a CHAPTER dimension with no ACTIVE claims and an old
`updatedAt` is soft-deleted with a `CHAPTER_RETIRED` change, while a CORE dimension in the same
state is untouched; (e) a `RETIRE` ruling scripted through the integrator sentinel actually flips
the claim to `RETIRED`.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && ./mvnw test -Dtest='CharacterMonthlyScheduleTest,CharacterMonthlyServiceIT' -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implement** service + job + properties + yml + fake mirror.

- [ ] **Step 4: Run — expect PASS**, then the full local gate set:
  `./mvnw test -Dtest='Character*,Konzilium*,ClaimLifecycle*,DetectorTest,ArchitectureTest' -Dmezo.test.use-testcontainers=true`,
  `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check`, `node scripts/lint-liquibase.mjs`.

- [ ] **Step 5: Commit**

```bash
git add backend/src docs/CODEMAP.md
git commit -m "feat(character): monthly deep read + chapter retirement + cron (mezo-1gim.6)"
```

---

### Task 4: Ship the slice

- [ ] Final focused gates (command above) + `./mvnw compile -q` + contract regeneration check
  (`cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api` must leave
  the tree clean — `git status --short` empty).
- [ ] House flow: push `feat/character-s4-bootstrap`, self-PR → CI green → `git pull --rebase` on
  main → `--no-ff` merge (`ALLOW_MAIN_COMMIT=1` if the merge needs a manual commit) → push →
  delete branch → `bd close mezo-1gim.6` → `bd dolt push`.

## Out of scope (later slices)

S5 `[Karakter]` prompt block, S6 claim feedback endpoint + user observations, S7 FE (after the
design 2.0 Karakter prototype round). The bootstrap endpoint has no UI in this slice — it is
callable by the FE once S7 lands.

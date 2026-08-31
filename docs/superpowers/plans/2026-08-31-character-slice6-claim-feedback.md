# Karakter Slice 6 — Claim Feedback + the User-Observation Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dossier two-way — Daniel answers each claim with *talál* / *nem igaz* / *pontosítom*, the claim reacts immediately, and the answer itself becomes a signal the next konzílium must reckon with — bd `mezo-1gim.10`, spec `docs/superpowers/specs/2026-08-27-user-character-dossier-design.md` §7 (and §4's claim lifecycle).

**Architecture:** `CharacterFeedbackService` (feature/character) applies one feedback event to a claim inside one transaction and writes the twin `character_observation` row with `expert_key = "user"`; `CharacterController` gains the generated `POST /api/character/claim/{claimId}/feedback`. The konzílium's proposal round learns to route `user` observations to the experts that own the affected dimensions instead of skipping them, and to mark `PONTOSITOM` corrections as must-address input.

**Tech Stack:** Spring Boot 4, contract-first OpenAPI (fragment + regeneration), JPA (S1 entities/envelopes), the S3 konzílium rounds, JUnit Testcontainers ITs.

## Global Constraints

- Feedback kinds are exactly `TALAL | NEM_IGAZ | PONTOSITOM` (contract enum, uppercase, no Hungarian accents in the wire values). `PONTOSITOM` REQUIRES a non-blank `text` (max 500 chars); the others must NOT carry one (`400` if they do — the honest contract, not silent ignoring).
- Effects (spec §7), all inside ONE `@Transactional` method:
  - `TALAL` — confidence `+0.05` with a **flat ceiling at `0.85`**, so self-confirmation can never saturate a claim without new evidence; a claim a konzílium raised above the ceiling is left alone, never dragged down. A capped (no-op) bump still records the event and the observation — the answer is a signal even when the number cannot move. Append a `ClaimConfidenceHistoryEnvelope.Point(newValue, "felhasználói visszajelzés: talál", now)` whenever the value actually changes.
  - `NEM_IGAZ` — `status = "RETIRED"` immediately, history point `"felhasználói visszajelzés: nem igaz"`, confidence untouched (the row keeps its last value for the audit trail).
  - `PONTOSITOM` — claim otherwise unchanged; the correction text is stored and MUST reach the next konzílium.
  - Every kind appends a `ClaimFeedbackEnvelope.Event(kind, text, now)` to `user_feedback` and sets `updatedAt`.
- Every feedback event ALSO writes one `character_observation`: `expert_key = "user"`, `day = LocalDate.now()`, `dimension_keys` = the claim's dimension, `salience` = `5` for `NEM_IGAZ`/`PONTOSITOM` and `3` for `TALAL` (a correction outranks a confirmation), `text` = a deterministic HU rendering naming the claim and what Daniel said (never model-authored), `signals` = one `ObservationSignalsEnvelope.Signal("user-feedback", <kind>, List.of(claimId))`.
- Feedback on a `RETIRED` claim ⇒ `409` (`CHARACTER_CLAIM_NOT_ACTIVE`); unknown/foreign claim ⇒ `404` (`CHARACTER_CLAIM_NOT_FOUND`). Every new code gets a `messages.properties` entry.
- Owner scoping on every read and write (`findByIdAndCreatedBy…`), the S1 idiom.
- Beans condition on BOTH `CHARACTER_SWITCH` and `COMPANION_SWITCH`; the controller keeps working with companion off (the S4 `ObjectProvider` precedent — feedback is character-only logic with no LLM, so prefer gating the service on `CHARACTER_SWITCH` alone and verify the companion-off quadrant in an IT either way).
- **The konzílium must not skip `user` observations.** Today `KonziliumProposalRound` resolves `expertKey` through `CharacterExpertCatalog.byKey`, which throws for `"user"`, so the whole group would be dropped. Task 2 fixes this; it is the half of the feature that makes feedback *matter*.
- No LLM anywhere in Task 1. Deterministic text only.
- Contract change ⇒ regenerate and commit BOTH `api/openapi.yml` and the FE client (`cd api/generate && npm run generate:api`, `cd frontend && pnpm generate:api`) — CI's contract-drift gate.
- ArchUnit: no raw exceptions outside `techcore`; `@Transactional` method-level only; controllers implement the generated API; no `companion → character` import.
- Local tests focused only: `cd backend && ./mvnw test -Dtest=<Pattern> -Dmezo.test.use-testcontainers=true`. CI's self-PR is the authoritative gate.
- Conventional commits with bd id `mezo-1gim.10`; regenerate `docs/CODEMAP.md` in the same change.

---

### Task 1: Feedback endpoint + service

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterFeedbackService.java`
- Modify: `api/feature/character/character.yml` (+ regenerated `api/openapi.yml`, FE client)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/controller/CharacterController.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/repository/CharacterClaimRepository.java` (owner-scoped id finder if absent)
- Modify: `backend/src/main/resources/messages.properties`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterFeedbackIT.java`

**Interfaces:**
- Consumes: S1 `CharacterClaimEntity` (+ `ClaimFeedbackEnvelope`, `ClaimConfidenceHistoryEnvelope`), `CharacterObservationEntity` (+ `ObservationDimensionKeysEnvelope`, `ObservationSignalsEnvelope`), `CharacterDimensionRepository`.
- Produces (Task 2 relies on these EXACT names): `CharacterFeedbackService.apply(UUID owner, UUID claimId, String kind, String text)` → `CharacterClaimEntity` (the updated row); the constant `CharacterFeedbackService.USER_EXPERT_KEY = "user"`; the signal key `"user-feedback"`.

Contract addition to `api/feature/character/character.yml`:

```yaml
  '/api/character/claim/{claimId}/feedback':
    post:
      tags: [Character]
      operationId: submitCharacterClaimFeedback
      summary: Daniel's answer to one claim — talál / nem igaz / pontosítom (spec §7)
      parameters:
        - name: claimId
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CharacterClaimFeedbackRequest' }
      responses:
        '200':
          description: The claim after the feedback was applied
          content:
            application/json:
              schema: { $ref: '#/components/schemas/CharacterClaimDto' }
        '400':
          description: PONTOSITOM without text, or text sent with a kind that takes none
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: No such claim for this user
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '409':
          description: The claim is already retired — nothing to answer
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

plus the schema (add next to the other Character schemas):

```yaml
    CharacterClaimFeedbackRequest:
      type: object
      required: [kind]
      properties:
        kind: { type: string, enum: [TALAL, NEM_IGAZ, PONTOSITOM] }
        text:
          type: string
          maxLength: 500
          description: Required for PONTOSITOM (the correction), forbidden otherwise
```

- [ ] **Step 1: Write the failing IT**

`CharacterFeedbackIT.java` (`extends ApiIntegrationTest`; seed a dimension + ACTIVE claim through
the repositories — read `CharacterPromptAssemblerIT`/`ClaimLifecycleIT` for the seeding idiom).
Eight tests:

1. `talal_raisesConfidence_appendsHistoryAndEvent_andWritesUserObservation` — seed a claim at
   `0.50`; `POST` `{"kind":"TALAL"}` → `200`; assert confidence `0.55`, one history point whose
   cause names the user feedback, one `user_feedback` event with kind `TALAL`, and exactly one new
   `character_observation` with `expertKey = "user"`, salience `3`, the claim's dimension key, and a
   `user-feedback` signal carrying the claim id.
2. `talal_isCappedWithoutNewKonziliumEvidence` — seed a claim at `0.84`, send `TALAL` twice; assert
   the confidence stops at `0.85` and the second call does not exceed it (self-confirmation cannot
   saturate).
3. `nemIgaz_retiresImmediately_andWritesHighSalienceObservation` — `200`, claim `status = RETIRED`,
   observation salience `5`; a second feedback on it → `409`.
4. `pontositom_storesTheCorrection_andWritesHighSalienceObservation` — text stored in the feedback
   envelope, claim still `ACTIVE`, confidence untouched, observation salience `5` and its text
   contains the correction.
5. `pontositom_withoutText_is400` and `talal_withText_is400`.
6. `unknownClaim_is404` and `otherUsersClaim_is404` (owner scoping — seed a second user's claim).
7. `feedback_isAdditive_multipleEventsAccumulate` — TALAL then PONTOSITOM ⇒ two events in the
   envelope, in order.
8. `feedbackObservation_isUnconsumed_soTheNextKonziliumWillSeeIt` — the new observation's
   `consumedByConferenceId` is null.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && ./mvnw test -Dtest=CharacterFeedbackIT -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implement** the contract + regeneration + service + controller + message keys.

The TALAL cap rule, precisely: if the claim's current confidence is already `≥ 0.85`, the bump is a
no-op (still records the event + observation — the answer is a signal even when the number cannot
move). Otherwise `min(current + 0.05, 0.85)`. Document this in the method's javadoc, and pin it
with test 2 — including that the no-op call still appends the event and writes the observation.

- [ ] **Step 4: Run — expect PASS** + `./mvnw test -Dtest='Character*,ArchitectureTest' -Dmezo.test.use-testcontainers=true` + `./mvnw compile -q`.

- [ ] **Step 5: Commit** (include the regenerated contract + FE client)

```bash
git add api frontend backend/src
git commit -m "feat(character): claim feedback endpoint — talál / nem igaz / pontosítom (mezo-1gim.10)"
```

---

### Task 2: Feed the answers back into the konzílium

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumProposalRound.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterConferenceService.java` (only if the routing needs the dimension→expert map there)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumUserFeedbackIT.java`
- Modify: `docs/CODEMAP.md` (regenerate)

**Interfaces:**
- Consumes: Task 1's observation shape (`expertKey = "user"`, signal key `"user-feedback"`),
  `CharacterExpertCatalog`, `CharacterCoreCatalog`.
- Produces: no new public API — behavioral change only.

Routing contract:

1. When grouping the week's observations by expert, observations with `expertKey = "user"` are NOT
   a group of their own (there is no `user` persona). Instead each such observation is routed to
   the expert(s) owning the dimensions in its `dimensionKeys` (CORE → that dimension's expert;
   CHAPTER or unknown → `drill`, the cross-cutting behaviour expert, the `CharacterHistoryReads`
   precedent). One observation may join two experts' evidence when it names two dimensions.
2. A routed user observation renders in the expert's evidence with an explicit prefix that makes
   its authorship unmistakable — e.g. `"DANIEL VÁLASZA — <text>"` — so the expert cannot mistake
   Daniel's words for a detector signal.
3. The proposal contract text gains one sentence: Daniel's own answers OUTRANK detector signals; a
   `nem igaz` or a correction should be addressed (by a `RETIRE`/`DOWN` proposal or by an explicit
   `NEW` that supersedes it), not ignored. This is a prompt instruction to the LLM, not an enforced
   rule — nothing upstream verifies a proposal actually addressed it, and every gathered observation
   (including an ignored one) is marked consumed unconditionally after the round. What IS guaranteed
   (fix round 2, F3, mezo-1gim.10): the answer is surfaced to its owning expert's evidence with top
   salience (`nem igaz`/`pontosítom` = 5, the highest weight a routed observation can carry), and
   `CharacterConferenceService` logs a WARN naming the claim id whenever a consumed user-feedback
   observation had no proposal referencing its claim id — so an ignored answer is visible in logs
   instead of silently vanishing.
4. An expert whose ONLY evidence is user feedback still runs (a correction alone is worth a round).
5. Weekly/bootstrap/monthly all inherit this automatically through the shared round; verify the
   existing ITs stay green (they are the regression proof).

- [ ] **Step 1: Write the failing IT**

`KonziliumUserFeedbackIT.java` — four tests:
(a) a `user` observation naming `discipline` reaches `drill`'s evidence (assert via the resulting
proposals/turn text or by the fake's echo of the user message — read `FakeCompanionLlm` for the
cleanest available seam) and carries the `DANIEL VÁLASZA` prefix; (b) a `user` observation naming
a CHAPTER dimension routes to `drill`; (c) an expert whose only evidence is a user observation
still produces a turn; (d) end-to-end: `POST` feedback (Task 1) then run the weekly konzílium and
assert the feedback observation is consumed (`consumedByConferenceId` set) — i.e. Daniel's answer
provably entered the next konzílium.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && ./mvnw test -Dtest=KonziliumUserFeedbackIT -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implement** the routing + prompt-contract sentence.

- [ ] **Step 4: Run — expect PASS**, then the regression sweep:
  `./mvnw test -Dtest='Character*,Konzilium*,ClaimLifecycle*,ArchitectureTest' -Dmezo.test.use-testcontainers=true`,
  `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check`, `node scripts/lint-liquibase.mjs`.

- [ ] **Step 5: Commit**

```bash
git add backend/src docs/CODEMAP.md
git commit -m "feat(character): route Daniel's answers into the konzílium (mezo-1gim.10)"
```

---

### Task 3: Ship the slice

- [ ] Final focused gates (command above) + `./mvnw compile -q` + contract regeneration leaves the
  tree clean (`git status --short` empty after regenerating both artifacts).
- [ ] House flow: push `feat/character-s6-feedback`, self-PR → CI green (a flaky
  `ResetDatabase` TRUNCATE deadlock is a known infra issue, bd `mezo-oou9` — rerun once before
  investigating) → `git pull --rebase` on main → `--no-ff` merge (`ALLOW_MAIN_COMMIT=1` if the
  merge needs a manual commit) → push → delete branch → `bd close mezo-1gim.10` → `bd dolt push`.

## Out of scope (later)

S7 FE (after the design 2.0 Karakter prototype round) — the buttons that call this endpoint;
`mezo-1gim.9` (WeeklyReviewGenerator prompt-block wiring); `mezo-1gim.7` (bootstrap corpus);
`mezo-1gim.4` (detector polish); `mezo-1gim.2` (feature doc).

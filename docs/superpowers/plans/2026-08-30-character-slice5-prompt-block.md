# Karakter Slice 5 — The `[Karakter]` Prompt Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Mezo actually *use* the dossier — one deterministically rendered `[Karakter]` block, produced by a single shared formatter and injected into the chat system prompt and the proactive generators, so no two surfaces can disagree about who the user is — bd `mezo-1gim.8`, spec `docs/superpowers/specs/2026-08-27-user-character-dossier-design.md` §8.

**Architecture:** A new port `CharacterPromptSource` in `feature/companion` (the `WeekReviewSource`/`TodayQuestSource` precedent — `character` already depends on `companion`, so a direct import back would close a slice cycle), implemented by `CharacterPromptAssembler` in `feature/character`. Consumers inject it via `ObjectProvider` and append its rendered block next to the confirmed-facts block; an absent bean or an empty dossier renders `""`, never a fabricated block.

**Tech Stack:** Spring Boot 4 (`ObjectProvider`, `@ConditionalOnProperty`), the existing `KnowledgeFactService.renderPromptBlock` rendering idiom, JPA reads from S1, JUnit Testcontainers ITs.

## Global Constraints

- The bean conditions on BOTH `FeaturesConfiguration.CHARACTER_SWITCH` AND `COMPANION_SWITCH`; every consumer injects it through `ObjectProvider` and treats an absent bean as `""` — the companion-off / character-off quadrants must keep working (the S4 `CharacterApiCompanionOffIT` lesson).
- **One formatter, no second renderer.** Every consumer calls the same `render(UUID)`; nothing may re-implement claim formatting. This is the spec §8 requirement ("rendered by a single shared formatter … so no two surfaces can disagree").
- Deterministic, no LLM anywhere in this slice; no writes; read-only repository access.
- Honest empty: a dossier with no ACTIVE claims above the threshold AND no mature portraits renders `""` (the `KnowledgeFactService.renderPromptBlock` precedent returns `""` on an empty list — mirror it exactly).
- Confidence is NEVER printed as a raw number in the prompt — render human words (`biztos` ≥ 0.75, `valószínű` ≥ 0.5, `figyeljük` below), the same vocabulary `PortraitWriter` already uses (read it and reuse the thresholds; extract them to one place if that is cheap).
- Sensitive claims (`CharacterClaimEntity.sensitive`) carry the `ÉRZÉKENY` marker in the block, exactly as `PortraitWriter`/`KonziliumVerdictRound` mark them, so the companion's tone rules can act on it.
- Config (`CharacterProperties.Prompt`): `minConfidence` (default `0.45`), `maxClaimsPerDimension` (default `3`), `maxTotalChars` (default `1800`), `portraitMinMaturity` (default `30`). All `@Validated`.
- Ordering: claims sorted by `confidence × recency` — recency from `updatedAt`, using an explicit documented decay (the `MemoryRecallService` `similarity × exp(-age/τ)` precedent: read it and mirror the shape, with τ in days from config or a documented constant).
- Truncation is honest: when `maxTotalChars` would be exceeded, drop whole claim lines from the end (never mid-sentence) and never drop a dimension header that still has lines under it.
- ArchUnit: no raw exceptions outside `techcore`; `@Transactional` method-level only (this slice needs none — reads only); the port lives in `feature/companion`, the adapter in `feature/character`, and NO `companion → character` import may appear.
- Local tests focused only: `cd backend && ./mvnw test -Dtest=<Pattern> -Dmezo.test.use-testcontainers=true`. CI's self-PR is the authoritative gate.
- Conventional commits with bd id `mezo-1gim.8`; regenerate `docs/CODEMAP.md` in the same change.

---

### Task 1: The port, the assembler, and its rendering contract

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/CharacterPromptSource.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterPromptAssembler.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/config/CharacterProperties.java` (`Prompt` sub-record)
- Modify: `backend/src/main/resources/application.yml` (`mezo.character.prompt.*` defaults)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterPromptAssemblerIT.java`

**Interfaces:**
- Consumes: S1 `CharacterDimensionEntity` (`key`, `title`, `kind`, `portrait`, `maturity`), `CharacterClaimEntity` (`dimensionId`, `text`, `confidence`, `status`, `sensitive`, `updatedAt`), their repositories; `CharacterCoreCatalog` for ordering.
- Produces (Task 2 relies on these EXACT names): `CharacterPromptSource.render(UUID userId)` → `String`; `CharacterPromptAssembler implements CharacterPromptSource`.

Rendering contract (deterministic; the block is Hungarian, matching the other prompt blocks):

```
[Karakter — amit eddig megtudtam Danielről]
Fizikai (Doki): <one-line portrait digest, only when maturity ≥ portraitMinMaturity>
- (biztos) A reggeli mérés stabil rutin.
- (valószínű, ÉRZÉKENY) Hajlamos felfelé kerekíteni az energiáját.
Motiváció & fegyelem (Drill):
- (figyeljük) Stresszes heteken elmarad a kajalogolás.
```

- Dimensions in `CharacterCoreCatalog` order, then CHAPTERs by `createdAt`; a dimension with no
  qualifying claim AND no qualifying portrait is omitted entirely.
- The portrait digest is the portrait's FIRST sentence (split on `. `), capped at 160 chars — never
  the whole prose (that is the UI's job, not the prompt's).
- The expert display name in parentheses comes from `CharacterExpertCatalog`; CHAPTERs render just
  the title.
- Empty result ⇒ `""` (no header).

- [ ] **Step 1: Write the failing IT**

`CharacterPromptAssemblerIT.java` (`extends ApiIntegrationTest`; seed dimensions/claims directly
through the repositories — read `CharacterPersistenceIT` and `CharacterConferenceServiceIT` for
the seeding idiom and owner plumbing). Six tests:

1. `render_emptyDossier_returnsEmptyString` — no dimensions/claims ⇒ `""` exactly.
2. `render_onlyLowConfidenceClaims_returnsEmptyString` — a claim at `0.20` (below `minConfidence`)
   and no mature portrait ⇒ `""`.
3. `render_claimsAndPortraits_rendersCatalogOrderWithHumanConfidenceWords` — seed claims at
   `0.80` / `0.60` / `0.50` across `physical` and `discipline`, plus a portrait with maturity `60`
   on `physical` and maturity `10` on `discipline`; assert: header present once; `physical`
   appears BEFORE `discipline`; the `physical` line carries the portrait's first sentence and the
   `discipline` one does not (maturity below threshold); the words `biztos`/`valószínű` appear and
   NO raw decimal (`assertThat(block).doesNotContain("0.8").doesNotContain("0,8")`).
4. `render_sensitiveClaim_carriesTheMarker` — a `sensitive` claim renders `, ÉRZÉKENY` in its
   parenthetical.
5. `render_capsPerDimensionAndTotalChars_dropsWholeLinesOnly` — seed 6 qualifying claims on one
   dimension; assert at most `maxClaimsPerDimension` lines for it; then seed enough dimensions to
   exceed `maxTotalChars` and assert the result is `≤ maxTotalChars`, ends with a newline (no
   mid-sentence cut), and contains no header without at least one line under it.
6. `render_ordersByConfidenceTimesRecency` — two claims on the same dimension: one `0.90` updated
   200 days ago, one `0.60` updated today; assert the fresher one renders FIRST (pin the decay's
   intent, not its exact formula).

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && ./mvnw test -Dtest=CharacterPromptAssemblerIT -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implement**

`CharacterPromptSource.java` (in `feature/companion`, mirroring `WeekReviewSource`'s javadoc style —
state the cycle rationale, the ObjectProvider consumption rule, and that an absent bean means the
block is simply omitted, never fabricated):

```java
package io.mrkuhne.mezo.feature.companion;

import java.util.UUID;

/**
 * Port for the [Karakter] dossier block (Karakter spec §8, mezo-1gim.8): the companion needs the
 * rendered prompt text, while the dossier itself belongs to {@code feature/character}, which
 * implements this ({@code character/service/CharacterPromptAssembler}). The dependency stays
 * character → companion, never back — {@code feature/character} already depends on companion (the
 * {@code CompanionLlm} port), so a direct {@code companion.service → character.repository} import
 * would close a NEW slice cycle ({@code ArchitectureTest#feature_slices_are_cycle_free}); this port
 * keeps it one-directional, the {@code WeekReviewSource}/{@code TodayQuestSource} precedent. The
 * bean exists only when both the character and companion switches are on; consume via
 * {@code ObjectProvider} — an absent bean means the block is OMITTED, never fabricated.
 */
public interface CharacterPromptSource {

    /** The deterministic [Karakter] block, or "" when the dossier has nothing worth injecting. */
    String render(UUID userId);
}
```

`CharacterPromptAssembler` — `@Service`, `@RequiredArgsConstructor`, both switches, implements the
port, follows the rendering contract above. `CharacterProperties.Prompt(@DecimalMin("0.0") @DecimalMax("1.0") BigDecimal minConfidence, @Min(1) @Max(10) int maxClaimsPerDimension, @Min(200) @Max(8000) int maxTotalChars, @Min(0) @Max(100) int portraitMinMaturity)` added as a `@NotNull @Valid` component of the record, with defaults in `application.yml` under the existing `mezo.character` block.

- [ ] **Step 4: Run — expect PASS** + `./mvnw test -Dtest=ArchitectureTest`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(character): [Karakter] prompt block assembler + port (mezo-1gim.8)"
```

---

### Task 2: Wire every consumer through the one formatter

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/MemoirGenerator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/PredictionGenerator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewGenerator.java` (find its real path first — it may live under `feature/proactive/service`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterPromptWiringIT.java`

**Interfaces:**
- Consumes: Task 1 `CharacterPromptSource.render(UUID)`.
- Produces: nothing new — this task only wires.

Wiring rules:

- `ChatService.assembleSystemPrompt` appends the block IMMEDIATELY AFTER
  `knowledgeFactService.renderPromptBlock(userId)` / `renderNewPatternFactsBlock(userId)` and
  BEFORE `profileBlock(userId)` — facts (atomic data) then claims (interpretation), as spec §8
  states. Inject as `ObjectProvider<CharacterPromptSource>` and add a private
  `characterBlock(UUID)` helper mirroring the existing `profileBlock(UUID)` one-liner exactly.
  Update the method's javadoc chain description (it enumerates the block order — keep it accurate).
- The three generators append the same block into their gathered payload wherever they already
  include the facts block; each uses its own `ObjectProvider` + `"" `-when-absent helper. If a
  generator does NOT currently include facts, do NOT invent a new insertion point — skip it and say
  so in the report.

- [ ] **Step 1: Write the failing IT**

`CharacterPromptWiringIT.java` — the point is to prove ONE formatter reaches every surface. Use the
`FakeCompanionLlm` seam: seed a dossier with a distinctive claim text (e.g.
`"KARAKTER-PROBA-ALLITAS"`), then for each wired surface assert the system prompt actually carried
it. Read `FakeCompanionLlm` first: if it cannot echo the system prompt, add a narrowly-scoped
test-only sentinel that returns a marker when the system prompt contains a given needle (mirror the
existing `HISTORY_SEEN_SENTINEL` idiom — that constant exists for exactly this kind of assertion),
and pin the marker with a mirror-equality assertion like the other markers.

Tests: (a) chat turn ⇒ the prompt contained the block; (b) memoir generation ⇒ same; (c) prediction
generation ⇒ same; (d) with the character switch off (`@TestPropertySource`) the chat turn still
succeeds and the block is absent — the honest-omission path.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd backend && ./mvnw test -Dtest=CharacterPromptWiringIT -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implement** the wiring per the rules above.

- [ ] **Step 4: Run — expect PASS**, then the regression sweep:
  `./mvnw test -Dtest='Character*,Konzilium*,ClaimLifecycle*,Chat*IT,Memoir*IT,Prediction*IT,JournalApiCompanionOffIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
  (the existing chat/memoir/prediction ITs are the regression proof that the added block breaks no
  prompt-shape assertion — if one of them asserts an exact prompt, update it deliberately and say
  so in the report).

- [ ] **Step 5: Commit**

```bash
git add backend/src docs/CODEMAP.md
git commit -m "feat(character): inject the [Karakter] block into chat + generators (mezo-1gim.8)"
```

---

### Task 3: Ship the slice

- [ ] Regenerate `docs/CODEMAP.md`, run `node scripts/gen-codemap.mjs --check`,
  `node scripts/lint-liquibase.mjs` (no migration this slice — must stay green), `./mvnw compile -q`.
- [ ] House flow: push `feat/character-s5-prompt-block`, self-PR → CI green → `git pull --rebase` on
  main → `--no-ff` merge (`ALLOW_MAIN_COMMIT=1` if the merge needs a manual commit) → push → delete
  branch → `bd close mezo-1gim.8` → `bd dolt push`.

## Out of scope (later slices)

S6 claim feedback endpoint + user observations; S7 FE (after the design 2.0 Karakter prototype
round). No contract change in this slice — the block is prompt-internal, invisible to the API.

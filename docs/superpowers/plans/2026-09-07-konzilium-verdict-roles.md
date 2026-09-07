# Konzílium Verdict Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the konzílium's chair (Mezo) from paraphrasing the Szkeptikus, by giving the two personas different jobs, different evidence, and a rendering that only speaks where it adds something.

**Architecture:** The Szkeptikus keeps the evidence question and gains a graded verdict (`KEEP|WEAKEN|KILL` + a suggested confidence). Mezo gains the dossier — the owner's ACTIVE claims, the targeted claim's confidence history and user feedback — and a brief limited to integration questions, plus an asymmetric right to overrule that is enforced in code, not only in the prompt. Both the prose transcript and the structured deliberation envelope render a chair ruling only when it contributed something.

**Tech Stack:** Java 21 / Spring Boot (records, `@ConfigurationProperties`, Spring Data JPA), JUnit 5 + AssertJ + Testcontainers, OpenAPI-generated contract (`api/feature/character/character.yml` → `api.gen.ts`), React 19 + Vitest.

**Spec:** [`docs/superpowers/specs/2026-09-07-konzilium-verdict-roles-design.md`](../specs/2026-09-07-konzilium-verdict-roles-design.md)

**Driving bd issue:** `mezo-lghn` — put it in every commit subject.

## Global Constraints

- **Code, comments, commit messages: English.** Prompt text and user-facing copy: Hungarian.
- **Confidence is NEVER surfaced as a raw decimal** — only as `biztos` / `valószínű` / `figyeljük`, via `CharacterConfidenceWords.word(BigDecimal)` (package-private, same package as `KonziliumVerdictRound`).
- **Honest states, no theater:** a round whose answer failed to parse must contribute no transcript turn and no shown ruling. The existing `parsed` / `chairParsed` / `shownRulings()` contracts stay exactly as they are.
- **`rulings` stays index-complete** for `ClaimLifecycle` (a missing ruling defaults to rejected, reason `"nem került döntésre"`); only the *shown* surfaces may be empty.
- **Never `git add -A`, never a bare `git stash`.** Commit with explicit paths plus `--no-verify` — the beads pre-commit hook force-stages a gitignored root `issues.jsonl` otherwise. Do NOT commit `.beads/issues.jsonl` from these tasks.
- **Focused tests only, never the full backend suite** (it OOM-dies on this machine). The command for every backend task:
  `cd backend && ./mvnw test -Dtest='Konzilium*,ClaimLifecycleIT,DeliberationAssemblerTest' -Dmezo.test.use-testcontainers=true`
- Backend `-Dtest` matches on the **simple class name only**.
- **The `*Character*` breadth is deliberately NOT in that pattern either.** Two runs on the same commit failed different test sets (16 errors in `CharacterApiIT` on an ApplicationContext load, then 8 errors across three other classes while `CharacterApiIT` passed) — the local `jdtls`/m2e builder rebuilds `backend/target` underneath Maven, so the broad sweep produces false reds. CLAUDE.md already makes CI the authoritative full-suite gate and prescribes only focused tests locally. The pattern above covers every line this branch changes; the breadth runs in CI on a clean machine. This is a relocated gate, not a dropped one.
- **`ArchitectureTest` is deliberately NOT in that pattern** — its ArchUnit frozen store is a shared file a local run can empty, so it gets exactly one run, in Task 7 Step 3, where the store is checked afterwards. This is a relocated gate, not a dropped one.
- **Never run `mvn clean`.** A background `jdtls` process holds `backend/target`; `clean` fails to delete it and leaves the OpenAPI-generated DTOs half-built.
- Adding or removing a source file reddens CI's `lint` job unless `docs/CODEMAP.md` is regenerated (`node scripts/gen-codemap.mjs`). No task here adds a file, so this should not trigger — verify with `node scripts/gen-codemap.mjs --check` in Task 7.

---

## File Structure

| File | Responsibility after this change |
|---|---|
| `backend/.../character/service/KonziliumVerdictRound.java` | Both persona prompts and contracts, the dossier assembly, the enforced dissent rule, the two transcript builders. Already ~420 lines and will grow ~150 more; it stays one file because the two rounds share the prompt-rendering and JSON-fence helpers, and splitting them would duplicate that half. |
| `backend/.../character/service/ClaimRuling.java` | Gains `dissent` / `note` / `suggestedDimensionKey` plus a 4-arg compatibility constructor. |
| `backend/.../character/service/DeliberationAssembler.java` | Passes the three new ruling fields and the skeptic's suggested confidence into the envelope. |
| `backend/.../character/entity/ConferenceDeliberationEnvelope.java` | `ChairRuling` / `SkepticVerdict` gain the new nullable fields. |
| `backend/.../character/config/CharacterProperties.java` | `Conference.maxDossierClaims`. |
| `backend/.../character/service/CharacterService.java` | Maps the new envelope fields onto the generated DTOs. |
| `api/feature/character/character.yml` | Additive, nullable contract fields. |
| `frontend/src/features/character/components/ConferenceThreadCard.tsx` | Renders `WEAKEN`, the dissent/note grounds, and the short ratification form. |
| `docs/features/character.md` | The role split and the new gotchas. |

---

## Task 1: Szkeptikus — graded verdict

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumVerdictRound.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumVerdictRoundIT.java`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `KonziliumVerdictRound.SkepticVerdict(int index, String verdict, String argument, BigDecimal suggestedConfidence)` — a public record on the round's `Result`, read by `DeliberationAssembler` in Task 6. The package-private `SkepticVerdictDraft(Integer index, String verdict, String argument, BigDecimal suggestedConfidence)` is used by Tasks 4 and 5. New constant `WEAKEN = "WEAKEN"`.

- [ ] **Step 1: Write the failing test**

Add to `KonziliumVerdictRoundIT`. The sentinel `[fake-char-skeptic:[…]]` is planted in a proposal's `text`, because `numberedProposals` renders `p.text()` into the user message.

```java
    @Test
    void skepticWeakenVerdictSurvivesIntoTheShownVerdictsAndTheTranscript() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. [fake-char-skeptic:[{\"index\":0,\"verdict\":\"WEAKEN\","
                        + "\"argument\":\"Három adatpont kevés a biztos szóhoz.\","
                        + "\"suggestedConfidence\":0.55}]]",
                new BigDecimal("0.80"), false, "Három heti mérés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.verdicts()).singleElement().satisfies(verdict -> {
            assertThat(verdict.index()).isZero();
            assertThat(verdict.verdict()).isEqualTo("WEAKEN");
            assertThat(verdict.suggestedConfidence()).isEqualByComparingTo("0.55");
        });
        ConferenceTranscriptEnvelope.Turn skepticTurn = result.turns().stream()
                .filter(turn -> turn.persona().equals("szkeptikus"))
                .findFirst().orElseThrow();
        assertThat(skepticTurn.text()).contains("WEAKEN").contains("valószínű");
        assertThat(skepticTurn.text()).doesNotContain("0.55");
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='KonziliumVerdictRoundIT#skepticWeakenVerdictSurvivesIntoTheShownVerdictsAndTheTranscript' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — it will not compile, because `SkepticVerdict` has no `suggestedConfidence()` accessor.

- [ ] **Step 3: Add `WEAKEN` and the suggested confidence**

In `KonziliumVerdictRound`, add the constant next to `KEEP`/`KILL`:

```java
    private static final String WEAKEN = "WEAKEN";
```

Widen the draft and the shown record:

```java
    /** One Szkeptikus verdict, before defaulting. {@code suggestedConfidence} is the strength the
     *  Szkeptikus thinks the evidence carries — meaningful for KEEP and WEAKEN, ignored for KILL,
     *  and null whenever the model omitted it (mezo-lghn). */
    record SkepticVerdictDraft(Integer index, String verdict, String argument,
                               BigDecimal suggestedConfidence) {}
```

```java
    /** One Szkeptikus verdict as it will be SHOWN — carrying the proposal index it answers.
     *  Produced only when the Szkeptikus round parsed AND only for the indexes it actually
     *  answered; an unanswered index simply has no entry here (mezo-xlvr). */
    public record SkepticVerdict(int index, String verdict, String argument,
                                 BigDecimal suggestedConfidence) {}
```

Accept `WEAKEN` as a shown verdict — in `run`, replace the verdict-filter condition:

```java
                if (draft == null || !isShownVerdict(draft.verdict())) {
                    continue;
                }
                String argument = draft.argument() != null && !draft.argument().isBlank()
                        ? draft.argument() : DEFAULT_ARGUMENT;
                verdicts.add(new SkepticVerdict(i, draft.verdict(), argument, draft.suggestedConfidence()));
```

and add the helper:

```java
    /** A verdict the Szkeptikus genuinely gave. Anything else (null, a typo, an unknown grade)
     *  is NOT shown — emitting a defaulted verdict would put words in its mouth (mezo-xlvr I2). */
    private static boolean isShownVerdict(String verdict) {
        return KEEP.equals(verdict) || WEAKEN.equals(verdict) || KILL.equals(verdict);
    }
```

- [ ] **Step 4: Render the grade in both the turn and the chair's prompt block**

Replace `skepticTurn` and `skepticVerdictsBlock` with one shared line renderer, so the two can never disagree about what the Szkeptikus said:

```java
    private static ConferenceTranscriptEnvelope.Turn skepticTurn(List<ClaimProposal> proposals,
                                                                  Map<Integer, SkepticVerdictDraft> verdicts) {
        StringBuilder sb = new StringBuilder("Szkeptikus: ").append(proposals.size()).append(" javaslat véleményezve.");
        for (int i = 0; i < proposals.size(); i++) {
            sb.append("\nP").append(i).append(": ").append(skepticLine(verdicts.get(i)));
        }
        return new ConferenceTranscriptEnvelope.Turn("szkeptikus", sb.toString(), List.of());
    }

    private static String skepticVerdictsBlock(List<ClaimProposal> proposals,
                                                Map<Integer, SkepticVerdictDraft> verdicts) {
        StringBuilder sb = new StringBuilder("Szkeptikus döntések:");
        for (int i = 0; i < proposals.size(); i++) {
            sb.append("\nP").append(i).append(": ").append(skepticLine(verdicts.get(i)));
        }
        return sb.toString();
    }

    /** One verdict as text, for the transcript AND the chair's prompt block. An unanswered or
     *  unknown grade defaults to KEEP here — this is about what the chair is TOLD and what the
     *  meeting recorded, not about what the user is shown (see {@link #isShownVerdict}). The
     *  suggested strength is rendered as a WORD, never a decimal. */
    private static String skepticLine(SkepticVerdictDraft draft) {
        String verdict = draft != null && isShownVerdict(draft.verdict()) ? draft.verdict() : KEEP;
        String argument = draft != null && draft.argument() != null && !draft.argument().isBlank()
                ? draft.argument() : DEFAULT_ARGUMENT;
        String suggested = draft == null || draft.suggestedConfidence() == null || KILL.equals(verdict)
                ? "" : " → " + CharacterConfidenceWords.word(draft.suggestedConfidence());
        return verdict + suggested + " — " + argument;
    }
```

- [ ] **Step 5: Rewrite the Szkeptikus prompt — graded contract, no `sensitive` clause**

The grades get definitions so the middle option cannot become a hedge, and the `sensitive` strictness sentence is **deleted** (it moves to Mezo in Task 4):

```java
    private static String skepticPersona() {
        return """
                Te vagy a Szkeptikus, {{NÉV}} profilozó csapatának kritikus tagja. Száraz, tárgyilagos \
                hangon írsz. A feladatod, hogy minden javaslatot megtámadj: kérdőjelezd meg a \
                bizonyíték elégségességét, keress alternatív magyarázatot, és figyelj a \
                túlinterpretálásra. Egyetlen kérdésre válaszolsz: alátámasztja-e a bizonyíték az \
                állítást, és milyen erősségen? Hogy egy állítás bekerüljön-e a dossziéba, nem a te \
                dolgod — azt az Integrátor dönti el. \
                A "self-audit" dimenzió javaslatai a saját megfigyelő-szerepedből \
                jöttek — ezeket ugyanezzel a szigorral bíráld, és külön ellenőrizd, hogy az alanyuk \
                valóban a rendszer (Mezo teljesítménye), nem a felhasználó ({{NÉV}}) tulajdonsága.""";
    }

    private static String skepticContract() {
        return """
                Minden javaslathoz pontosan egy fokozatot adj:
                - KILL: a bizonyíték egyáltalán nem támasztja alá az állítást, vagy túlinterpretálás.
                - WEAKEN: van benne valami, de nem ezen az erősségen.
                - KEEP: a bizonyíték elbírja a javasolt erősséget.
                A "suggestedConfidence" az az erősség, amit a bizonyíték szerinted elbír (0.0-1.0) — \
                KEEP és WEAKEN esetén add meg, KILL esetén hagyd el.
                Válaszolj KIZÁRÓLAG egy JSON tömbbel, magyarázat és formázás nélkül, pontosan ebben \
                a formában: [{"index":0,"verdict":"KEEP|WEAKEN|KILL","argument":"...",\
                "suggestedConfidence":0.55}]. A felsorolt javaslatok mindegyikéhez (P0, P1, …) \
                pontosan egy bejegyzést adj, a sorszáma szerinti "index" mezővel.""";
    }
```

- [ ] **Step 6: Run the focused suite**

Run: `cd backend && ./mvnw test -Dtest='Konzilium*,ClaimLifecycleIT,DeliberationAssemblerTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS. `FakeCompanionLlm.skepticCannedAnswer` still emits `{"index":i,"verdict":"KEEP","argument":…}` with no `suggestedConfidence`, which parses to null — the existing happy-path ITs keep passing unchanged.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumVerdictRound.java backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumVerdictRoundIT.java
git commit --no-verify -m "feat(character): give the konzílium Szkeptikus a graded verdict (mezo-lghn)"
```

---

## Task 2: Both judges see the claim they are moving

Today `numberedProposals` renders `String.valueOf(p.claimId())` for `UP`/`DOWN`/`RETIRE`, so both judges are asked to rule on a bare UUID.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumVerdictRound.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumVerdictRoundIT.java`

**Interfaces:**
- Consumes: Task 1's `SkepticVerdictDraft`.
- Produces: `private DossierContext loadDossier(UUID owner)` and the private record `DossierContext(Map<UUID, CharacterClaimEntity> claimsById, Map<UUID, CharacterDimensionEntity> dimensionsById, List<CharacterClaimEntity> shownClaims, boolean truncated)`. Task 3 reads `shownClaims` / `dimensionsById` / `truncated`. `numberedProposals` becomes an **instance** method: `private String numberedProposals(LocalDate weekStart, List<ClaimProposal> proposals, DossierContext dossier)`.

- [ ] **Step 1: Write the failing test**

The `[fake-char-proposals-echo]`-style prompt-assembly assertion is not available on this path, so assert through the Szkeptikus's own echo: plant a sentinel that returns the assembled user message is *not* possible here either — instead assert the effect that IS observable, the transcript's proposal line. Add:

```java
    @Test
    void anUpProposalShowsTheTargetedClaimsTextAndWordNotItsUuid() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        CharacterClaimEntity claim = seedClaim(owner, dimension.getId(),
                "Hétvégén lazul a logolási fegyelme.", new BigDecimal("0.60"));
        ClaimProposal proposal = new ClaimProposal("doki", "UP", null, claim.getId(),
                "Erősítsük meg. [fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":true,"
                        + "\"confidence\":0.7,\"reason\":\"Negyedik hét is így jött.\"}],\"chapters\":[]}]",
                new BigDecimal("0.70"), false, "Negyedik egymást követő hét.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement()
                .satisfies(ruling -> assertThat(ruling.accepted()).isTrue());
        // The Szkeptikus's canned answer echoes nothing, so assert the prompt reached the model
        // through the ONE observable channel: the round resolved the claim, so no UUID text can
        // appear in any turn.
        assertThat(result.turns()).allSatisfy(turn ->
                assertThat(turn.text()).doesNotContain(claim.getId().toString()));
    }

    @Test
    void anUnresolvableClaimIdRendersAnExplicitNotFoundInsteadOfAUuid() {
        UUID owner = ownerId();
        seedDimension(owner, "physical", "doki");
        UUID missing = UUID.randomUUID();
        ClaimProposal proposal = new ClaimProposal("doki", "UP", null, missing,
                "Erősítsük meg.", new BigDecimal("0.70"), false, "Indoklás.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).hasSize(1);
        assertThat(result.turns()).allSatisfy(turn ->
                assertThat(turn.text()).doesNotContain(missing.toString()));
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./mvnw test -Dtest='KonziliumVerdictRoundIT#anUpProposalShowsTheTargetedClaimsTextAndWordNotItsUuid+anUnresolvableClaimIdRendersAnExplicitNotFoundInsteadOfAUuid' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — the turn text currently carries the raw UUID, so `doesNotContain` fails.

- [ ] **Step 3: Inject the two repositories and load the dossier once**

Add the imports and fields:

```java
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import java.util.Comparator;
import java.util.function.Function;
import java.util.stream.Collectors;
```

```java
    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;
    private final PromptPersona promptPersona;
    private final CharacterClaimRepository claimRepository;
    private final CharacterDimensionRepository dimensionRepository;
    private final CharacterProperties characterProperties;
```

(The `CharacterProperties` field is used in Task 3; add it now so the constructor is not churned twice. Import `io.mrkuhne.mezo.feature.character.config.CharacterProperties`.)

Add the context record and its loader:

```java
    private static final String ACTIVE = "ACTIVE";
    private static final String CLAIM_NOT_FOUND = "a célzott állítás nem található";

    /** The dossier as the round reads it once per run: every ACTIVE claim by id (so a proposal's
     *  target resolves without a query per proposal), the owner's dimensions by id, the claims the
     *  chair's dossier block may show, and whether that list was capped (mezo-lghn). */
    private record DossierContext(Map<UUID, CharacterClaimEntity> claimsById,
                                  Map<UUID, CharacterDimensionEntity> dimensionsById,
                                  List<CharacterClaimEntity> shownClaims,
                                  boolean truncated) {}

    private DossierContext loadDossier(UUID owner) {
        List<CharacterClaimEntity> active =
                claimRepository.findByCreatedByAndStatusOrderByConfidenceDesc(owner, ACTIVE);
        Map<UUID, CharacterClaimEntity> claimsById = active.stream()
                .collect(Collectors.toMap(CharacterClaimEntity::getId, Function.identity(),
                        (first, second) -> first, LinkedHashMap::new));
        Map<UUID, CharacterDimensionEntity> dimensionsById = dimensionRepository.findByCreatedBy(owner).stream()
                .collect(Collectors.toMap(CharacterDimensionEntity::getId, Function.identity(),
                        (first, second) -> first, LinkedHashMap::new));

        int cap = characterProperties.conference().maxDossierClaims();
        boolean truncated = active.size() > cap;
        // Freshest first when capping: a claim nobody has touched in a year is the least useful
        // context for this week's decision. The kept slice is re-sorted by confidence so the block
        // reads the way every other claim surface does.
        List<CharacterClaimEntity> shown = truncated
                ? active.stream()
                        .sorted(Comparator.comparing(CharacterClaimEntity::getUpdatedAt).reversed())
                        .limit(cap)
                        .sorted(Comparator.comparing(CharacterClaimEntity::getConfidence).reversed())
                        .toList()
                : active;
        return new DossierContext(claimsById, dimensionsById, shown, truncated);
    }
```

- [ ] **Step 4: Resolve the target in `numberedProposals`**

Make it an instance method and thread the context through. In `run`, load once and pass it to both rounds:

```java
        DossierContext dossier = loadDossier(owner);
        SkepticResult skepticResult = runSkeptic(owner, weekStart, proposals, dossier);
```

```java
        IntegratorResult integratorResult = runIntegrator(owner, weekStart, proposals,
                skepticResult.verdicts(), reactions, dossier);
```

Update the two round methods' signatures to take `DossierContext dossier` and pass it into their `numberedProposals(weekStart, proposals, dossier)` call, then rewrite the renderer:

```java
    private String numberedProposals(LocalDate weekStart, List<ClaimProposal> proposals,
                                      DossierContext dossier) {
        // The monthly bootstrap konzílium (Karakter S4, mezo-1gim.6) has no week —
        // CharacterBootstrapService passes weekStart=null here. weekStart.plusDays(6) would NPE,
        // so render a null-safe label instead of a week range for that path.
        String periodLabel = weekStart != null
                ? "Hét: " + weekStart + " – " + weekStart.plusDays(6)
                : "Teljes eddigi történet";
        StringBuilder sb = new StringBuilder(periodLabel)
                .append(" (a javaslatok korábbi, még fel nem dolgozott megfigyelésekből is származhatnak)");
        for (int i = 0; i < proposals.size(); i++) {
            ClaimProposal p = proposals.get(i);
            sb.append("\nP").append(i).append(". ").append(p.kind()).append(' ').append(target(p, dossier))
                    .append(" — ").append(p.text()).append(" (biztonság ").append(p.confidence())
                    .append(p.sensitive() ? ", ÉRZÉKENY" : "").append(") indoklás: ").append(p.rationale());
        }
        return sb.toString();
    }

    /** What the proposal is ABOUT, in words a judge can rule on. A NEW proposal names its
     *  dimension; anything else names the claim it moves — its current text and confidence WORD,
     *  never its UUID, which told neither judge anything (mezo-lghn). */
    private static String target(ClaimProposal proposal, DossierContext dossier) {
        if (NEW_KIND.equals(proposal.kind())) {
            return proposal.dimensionKey();
        }
        CharacterClaimEntity claim = proposal.claimId() == null
                ? null : dossier.claimsById().get(proposal.claimId());
        if (claim == null) {
            return CLAIM_NOT_FOUND;
        }
        return "a jelenlegi állítás (" + CharacterConfidenceWords.word(claim.getConfidence()) + "): "
                + claim.getText();
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && ./mvnw test -Dtest='KonziliumVerdictRoundIT#anUpProposalShowsTheTargetedClaimsTextAndWordNotItsUuid+anUnresolvableClaimIdRendersAnExplicitNotFoundInsteadOfAUuid' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

Note: `characterProperties.conference().maxDossierClaims()` does not exist yet — Task 3 adds it. To keep this task independently green, add the property in Task 3 **first** if the compiler complains; the two tasks may be merged by the executor if that ordering is awkward. Prefer: do Task 3's Step 3 (the property + yml default) as this task's Step 3a.

- [ ] **Step 6: Run the focused suite, then commit**

Run: `cd backend && ./mvnw test -Dtest='Konzilium*,ClaimLifecycleIT,DeliberationAssemblerTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumVerdictRound.java backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumVerdictRoundIT.java
git commit --no-verify -m "feat(character): show both konzílium judges the claim a proposal moves (mezo-lghn)"
```

---

## Task 3: The chair's dossier block

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/config/CharacterProperties.java`
- Modify: `backend/src/main/resources/application.yml:1738-1743`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumVerdictRound.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (one `userMessages()` accessor — Step 2)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumVerdictRoundIT.java`

**Interfaces:**
- Consumes: Task 2's `DossierContext`.
- Produces: `CharacterProperties.Conference.maxDossierClaims()` (int) and `private String dossierBlock(DossierContext dossier)`. The block goes into the **Integrátor's** user message only — the Szkeptikus never receives it (spec §10).

- [ ] **Step 1: Confirm the property is already there (Task 2 front-loaded it)**

`CharacterProperties.Conference.maxDossierClaims` and the `application.yml` default
`max-dossier-claims: 80` landed in Task 2, because Task 2's own code calls them and would not
compile otherwise. Verify with `grep -n maxDossierClaims backend/src/main/java/io/mrkuhne/mezo/feature/character/config/CharacterProperties.java`
and move on — do NOT add them again. The block below is the state you should find.

<details><summary>The property as it already exists</summary>

In `CharacterProperties`, extend the existing `Conference` record:

```java
    public record Conference(
            /** Weekly konzílium cron (server zone) — fires for the week that just finished. */
            @NotBlank String cron,
            /** How many finished weeks back the job heals (the observation catch-up idiom). */
            @Min(1) @Max(8) int catchUpWeeks,
            /** How many ACTIVE claims the chair's dossier block may carry. Over this the block is
             *  capped freshest-first AND says so — a silently trimmed dossier would let the chair
             *  conclude "we hold nothing like this" from an absence we created (mezo-lghn). */
            @Min(10) @Max(500) int maxDossierClaims) {}
```

In `application.yml`, under `character: conference:`:

```yaml
    conference:
      # Sunday 19:30 — the week that is ending; 19:30 slot free (checked against every other
      # cron in this file before landing here, mezo-1gim.5).
      cron: "0 30 19 * * SUN"
      # Finished weeks back the job checks and self-heals (the observation catch-up idiom)
      catch-up-weeks: 2
      # ACTIVE claims the chair's dossier block may carry before it is capped freshest-first.
      max-dossier-claims: 80
```

</details>

- [ ] **Step 2: Extend the test double's existing prompt recorder by one accessor**

`FakeCompanionLlm` already records prompts: `lastUserMessage` (field `:576`, accessor `:586`, set
in `complete(...)` at `:594`), and its javadoc states the intent plainly — it exists so an IT can
assert a prompt-assembly detail "without needing a dedicated sentinel/echo for every such detail".
`KonziliumVerdictRoundIT.java:236` already uses it. **Use this channel, not a new echo sentinel.**

One gap: `lastUserMessage()` keeps only the LAST message, and this round makes two calls (Szkeptikus
first, then Integrátor). This task's test needs a positive about the chair's prompt AND a negative
about the Szkeptikus's, so record all of them. In
`backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`, beside the
existing `lastUserMessage` field:

```java
    /** mezo-lghn: EVERY user message that reached {@link #complete}, in call order — the konzílium
     *  rounds make several calls per run, so an IT that must assert about an EARLIER call's prompt
     *  (e.g. that the chair's dossier block did NOT reach the Szkeptikus) cannot use
     *  {@link #lastUserMessage}, which the next call overwrites. Same channel, same intent: no
     *  per-detail sentinel. */
    private final List<String> userMessages = new java.util.concurrent.CopyOnWriteArrayList<>();

    public List<String> userMessages() {
        return List.copyOf(userMessages);
    }
```

and add one line next to the existing `lastUserMessage = userMessage;` in `complete(...)`:

```java
        userMessages.add(userMessage);
```

Do NOT add echo sentinels for this — the recorder is the established idiom and one channel beats
three.

- [ ] **Step 2b: Write the failing test**

```java
    @Test
    void theChairsPromptCarriesTheDossierAndTheSzkeptikusDoesNot() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        seedClaim(owner, dimension.getId(), "MARKER-DOSSZIE-ALLITAS", new BigDecimal("0.60"));
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Új állítás.", new BigDecimal("0.60"), false, "Indoklás.");

        verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        // The chair is called last, so lastUserMessage() is ITS prompt — it must carry the dossier.
        assertThat(fakeCompanionLlm.lastUserMessage())
                .contains("Dosszié:")
                .contains("MARKER-DOSSZIE-ALLITAS");
        // Exactly ONE of the round's prompts may carry it: the Szkeptikus judges the proposal
        // against its own evidence and must not see the dossier (spec §10).
        assertThat(fakeCompanionLlm.userMessages())
                .filteredOn(message -> message.contains("Dosszié:"))
                .hasSize(1);
    }
```

Add `@Autowired private FakeCompanionLlm fakeCompanionLlm;` to the IT only if it is not already
there (the test at `:236` uses it, so it very likely is).

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='KonziliumVerdictRoundIT#theChairsPromptCarriesTheDossierAndTheSzkeptikusDoesNot' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — no `Dosszié:` block is assembled yet.

- [ ] **Step 4: Build the block**

```java
    /** The dossier as the CHAIR sees it (never the Szkeptikus — spec §10): every ACTIVE claim
     *  grouped by dimension, with the targeted claims' confidence history and user feedback so the
     *  chair can judge how far a number may move and what {{NÉV}} has already said about it. */
    private static String dossierBlock(List<ClaimProposal> proposals, DossierContext dossier) {
        StringBuilder sb = new StringBuilder("\nDosszié:");
        if (dossier.shownClaims().isEmpty()) {
            sb.append("\n(még egyetlen aktív állítás sincs)");
            return sb.toString();
        }
        Map<UUID, List<CharacterClaimEntity>> byDimension = new LinkedHashMap<>();
        for (CharacterClaimEntity claim : dossier.shownClaims()) {
            byDimension.computeIfAbsent(claim.getDimensionId(), key -> new ArrayList<>()).add(claim);
        }
        for (Map.Entry<UUID, List<CharacterClaimEntity>> entry : byDimension.entrySet()) {
            CharacterDimensionEntity dimension = dossier.dimensionsById().get(entry.getKey());
            sb.append("\n").append(dimension == null ? "(ismeretlen dimenzió)" : dimension.getTitle()).append(':');
            for (CharacterClaimEntity claim : entry.getValue()) {
                sb.append("\n- (").append(CharacterConfidenceWords.word(claim.getConfidence())).append(") ")
                        .append(claim.getText());
            }
        }
        if (dossier.truncated()) {
            sb.append("\n(A lista a legfrissebb ").append(dossier.shownClaims().size())
                    .append(" állításra van szűkítve — nem a teljes dosszié.)");
        }
        String targeted = targetedClaimDetails(proposals, dossier);
        return sb.append(targeted).toString();
    }

    /** Confidence history and user feedback for the claims a proposal actually targets — the two
     *  things that tell the chair how far the number may move and whether {{NÉV}} has already
     *  pushed back on this exact claim. */
    private static String targetedClaimDetails(List<ClaimProposal> proposals, DossierContext dossier) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < proposals.size(); i++) {
            ClaimProposal proposal = proposals.get(i);
            if (proposal.claimId() == null) {
                continue;
            }
            CharacterClaimEntity claim = dossier.claimsById().get(proposal.claimId());
            if (claim == null) {
                continue;
            }
            List<String> history = claim.getConfidenceHistory() == null
                    ? List.of()
                    : claim.getConfidenceHistory().points().stream()
                            .map(point -> CharacterConfidenceWords.word(point.value()) + " (" + point.cause() + ")")
                            .toList();
            List<String> feedback = claim.getUserFeedback() == null
                    ? List.of()
                    : claim.getUserFeedback().events().stream()
                            .map(event -> event.kind()
                                    + (event.text() == null || event.text().isBlank() ? "" : ": " + event.text()))
                            .toList();
            if (history.isEmpty() && feedback.isEmpty()) {
                continue;
            }
            sb.append("\nP").append(i).append(" célzott állításának előzményei:");
            if (!history.isEmpty()) {
                sb.append("\n  bizalom útja: ").append(String.join(" → ", history));
            }
            if (!feedback.isEmpty()) {
                sb.append("\n  felhasználói visszajelzés: ").append(String.join(" | ", feedback));
            }
        }
        return sb.toString();
    }
```

Wire it into `runIntegrator`'s user message only:

```java
        String userMessage = numberedProposals(weekStart, proposals, dossier) + "\n"
                + skepticVerdictsBlock(proposals, verdicts) + peerReactionsBlock(reactions)
                + dossierBlock(proposals, dossier);
```

- [ ] **Step 5: Write the truncation test**

```java
    @Test
    void anOversizedDossierIsCappedAndTheBlockSaysSo() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        int cap = characterProperties.conference().maxDossierClaims();
        for (int i = 0; i <= cap; i++) {
            seedClaim(owner, dimension.getId(), "Állítás " + i, new BigDecimal("0.60"));
        }
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Új állítás.", new BigDecimal("0.60"), false, "Indoklás.");

        verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(fakeCompanionLlm.lastUserMessage()).contains("van szűkítve");
    }
```

Add `@Autowired private CharacterProperties characterProperties;` to the IT. Complete the final assertion using the channel Step 2 established.

- [ ] **Step 6: Run the focused suite, then commit**

Run: `cd backend && ./mvnw test -Dtest='Konzilium*,ClaimLifecycleIT,DeliberationAssemblerTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumVerdictRound.java backend/src/main/java/io/mrkuhne/mezo/feature/character/config/CharacterProperties.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumVerdictRoundIT.java
git commit --no-verify -m "feat(character): give the konzílium chair the dossier it rules on (mezo-lghn)"
```

---

## Task 4: Mezo's brief, contract, and the enforced asymmetric dissent

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/ClaimRuling.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumVerdictRound.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumVerdictRoundIT.java`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `ClaimRuling(ClaimProposal proposal, boolean accepted, BigDecimal ruledConfidence, String reason, boolean dissent, String note, String suggestedDimensionKey)` **plus a 4-arg compatibility constructor** so the 14 existing `new ClaimRuling(...)` call sites in `ClaimLifecycleIT` and `DeliberationAssemblerTest` keep compiling. `IntegratorRulingDraft(Integer index, Boolean accept, BigDecimal confidence, String reason, Boolean dissent, String note, String suggestedDimensionKey)`. `toRuling` becomes `private static ClaimRuling toRuling(ClaimProposal proposal, IntegratorRulingDraft draft, SkepticVerdictDraft verdict)`. Task 5 and Task 6 read `dissent()` / `note()` / `suggestedDimensionKey()`.

- [ ] **Step 1: Widen `ClaimRuling` with a compatibility constructor**

```java
/**
 * The Integrátor's final verdict on one {@link ClaimProposal} from a weekly konzílium round
 * (Karakter spec §6 step 2, mezo-1gim.5). {@code ruledConfidence} is the new/insert confidence
 * when {@code accepted} — clamped to {@code [0.30, 0.90]} by {@link KonziliumVerdictRound} — and
 * is informational only when rejected (never applied). {@link ClaimLifecycle#apply} is the pure
 * persistence half that turns an accepted ruling into a row change.
 *
 * <p>{@code dissent} marks a ruling that contradicts the Szkeptikus's verdict, and {@code note}
 * the integration ground the chair found ({@code DUPLICATE}, {@code CONTRADICTS},
 * {@code NOT_FOR_DOSSIER}, {@code REHOME}) — the two fields that let a surface show only what the
 * chair ADDED instead of paraphrasing the Szkeptikus (mezo-lghn). {@code suggestedDimensionKey}
 * accompanies {@code REHOME} and is advisory only: nothing moves a claim between dimensions.
 */
public record ClaimRuling(ClaimProposal proposal, boolean accepted, BigDecimal ruledConfidence, String reason,
                          boolean dissent, String note, String suggestedDimensionKey) {

    /** The pre-mezo-lghn four-argument form: no dissent, no integration note. Keeps every
     *  construction site that is not the chair's own ruling unchanged. */
    public ClaimRuling(ClaimProposal proposal, boolean accepted, BigDecimal ruledConfidence, String reason) {
        this(proposal, accepted, ruledConfidence, reason, false, null, null);
    }
}
```

- [ ] **Step 2: Write the failing tests — the guardrail is the important one**

```java
    @Test
    void theChairMayNotAcceptOverASensitiveKill() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "mental", "pszichologus");
        ClaimProposal proposal = new ClaimProposal("pszichologus", "NEW", dimension.getKey(), null,
                "Belső feszültség a randizás körül. "
                        + "[fake-char-skeptic:[{\"index\":0,\"verdict\":\"KILL\","
                        + "\"argument\":\"Két megfigyelés egy napról — túlinterpretálás.\"}]] "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":true,"
                        + "\"confidence\":0.6,\"reason\":\"Mégis felveszem.\",\"dissent\":true}],"
                        + "\"chapters\":[]}]",
                new BigDecimal("0.60"), true, "Két naplóbejegyzés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement().satisfies(ruling -> {
            assertThat(ruling.accepted()).isFalse();
            assertThat(ruling.dissent()).isFalse();
        });
        claimLifecycle.apply(owner, UUID.randomUUID(), result.rulings());
        assertThat(claimRepository.findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(
                owner, dimension.getId(), "ACTIVE")).isEmpty();
    }

    @Test
    void theChairMayAcceptOverANonSensitiveKillWithDissent() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. "
                        + "[fake-char-skeptic:[{\"index\":0,\"verdict\":\"KILL\","
                        + "\"argument\":\"Három adatpont kevés.\"}]] "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":true,"
                        + "\"confidence\":0.6,\"reason\":\"A dossziéban két korábbi mérés is ezt mutatja, "
                        + "amit a Szkeptikus nem látott.\",\"dissent\":true}],\"chapters\":[]}]",
                new BigDecimal("0.60"), false, "Három heti mérés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement().satisfies(ruling -> {
            assertThat(ruling.accepted()).isTrue();
            assertThat(ruling.dissent()).isTrue();
        });
    }

    @Test
    void theChairsIntegrationNoteSurvivesOntoTheRuling() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":false,"
                        + "\"reason\":\"Ezt már tartjuk a Fizikai dimenzióban.\",\"note\":\"DUPLICATE\"}],"
                        + "\"chapters\":[]}]",
                new BigDecimal("0.60"), false, "Három heti mérés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement().satisfies(ruling -> {
            assertThat(ruling.accepted()).isFalse();
            assertThat(ruling.note()).isEqualTo("DUPLICATE");
        });
    }
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && ./mvnw test -Dtest='KonziliumVerdictRoundIT#theChairMayNotAcceptOverASensitiveKill+theChairMayAcceptOverANonSensitiveKillWithDissent+theChairsIntegrationNoteSurvivesOntoTheRuling' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `ruling.dissent()` / `ruling.note()` do not compile yet, and the sensitive-KILL accept currently goes through.

- [ ] **Step 4: Widen the draft and enforce the rule in `toRuling`**

```java
    /** One Integrátor ruling, before defaulting/clamping. */
    record IntegratorRulingDraft(Integer index, Boolean accept, BigDecimal confidence, String reason,
                                 Boolean dissent, String note, String suggestedDimensionKey) {}
```

```java
    private static final Set<String> VALID_NOTES =
            Set.of("DUPLICATE", "CONTRADICTS", "NOT_FOR_DOSSIER", "REHOME");
```

(Import `java.util.Set`.)

```java
    /**
     * One proposal's ruling, with the chair's asymmetric right to overrule the Szkeptikus enforced
     * HERE rather than in the prompt (mezo-lghn): tightening is always allowed, but an accept over
     * a KILL is only allowed when the proposal is not sensitive. The Szkeptikus is the guardrail on
     * over-interpreting a sensitive signal, so that one KILL is final — a prompt sentence alone
     * would leave the guardrail to the model's goodwill.
     */
    private static ClaimRuling toRuling(ClaimProposal proposal, IntegratorRulingDraft draft,
                                         SkepticVerdictDraft verdict) {
        if (draft == null) {
            return new ClaimRuling(proposal, false, null, DEFAULT_REASON);
        }
        boolean accepted = draft.accept() != null && draft.accept();
        String reason = draft.reason() != null && !draft.reason().isBlank() ? draft.reason() : DEFAULT_REASON;

        boolean sensitiveKill = proposal.sensitive() && verdict != null && KILL.equals(verdict.verdict());
        if (accepted && sensitiveKill) {
            log.warn("Chair accepted an ÉRZÉKENY proposal the Szkeptikus killed — dropping the accept "
                    + "(kind {}, dimension {}, claim {})", proposal.kind(), proposal.dimensionKey(),
                    proposal.claimId());
            return new ClaimRuling(proposal, false, null, reason, false, "NOT_FOR_DOSSIER", null);
        }

        BigDecimal confidence = draft.confidence();
        // The proposal-confidence fallback is a NEW-only concern (there is no "current value" to
        // move for a brand-new claim). For UP/DOWN an omitted confidence must stay null so
        // ClaimLifecycle applies its own ±0.10 step off the CLAIM's current confidence — silently
        // substituting the proposal's confidence here would make that fallback unreachable.
        if (confidence == null && NEW_KIND.equals(proposal.kind())) {
            confidence = proposal.confidence();
        }
        if (accepted && confidence != null) {
            confidence = clamp(confidence);
        }
        boolean dissent = draft.dissent() != null && draft.dissent()
                && verdict != null && contradicts(accepted, verdict.verdict());
        String note = draft.note() != null && VALID_NOTES.contains(draft.note()) ? draft.note() : null;
        String rehome = "REHOME".equals(note) ? draft.suggestedDimensionKey() : null;
        return new ClaimRuling(proposal, accepted, confidence, reason, dissent, note, rehome);
    }

    /** Whether the chair's decision actually goes against the Szkeptikus — a self-declared
     *  {@code dissent} on a ruling that agrees with the verdict is dropped, so the flag can be
     *  trusted by every surface that renders it. */
    private static boolean contradicts(boolean accepted, String verdict) {
        return accepted ? KILL.equals(verdict) : KEEP.equals(verdict) || WEAKEN.equals(verdict);
    }
```

Update the call site in `run`:

```java
            rulings.add(toRuling(proposal, draft, skepticResult.verdicts().get(i)));
```

- [ ] **Step 5: Rewrite Mezo's brief and contract**

```java
    private static String integratorPersona() {
        return """
                Te vagy Mezo, {{NÉV}} személyes egészség- és teljesítmény-társa, most integrátor \
                szerepben a heti konzíliumon. Higgadt, tárgyszerű hangon döntesz. \
                A bizonyíték elégségességét a Szkeptikus már megítélte — ne bíráld felül újra. \
                Csak ott térj el tőle, ahol olyat látsz, amit ő nem láthatott: a dossziét. \
                A te öt kérdésed: tartunk-e már ilyen állítást (duplikáció) · ellentmond-e \
                valamelyik meglévő állításnak, és akkor melyik mozduljon · a bizalom eddigi útja \
                alapján mennyit mozdulhat most a szint · beírjuk-e ezt egy emberről szóló állandó \
                dossziéba, még ha igaz is (az érzékeny állításokat itt mérlegeld) · önálló, \
                tartós téma-e, ami külön fejezetet érdemel — ez ritka. \
                Ahol a szakértők egymás javaslatára is állást foglaltak, azt is figyelembe veszed. \
                A Szkeptikus KEEP vagy WEAKEN döntése ellenére elvethetsz. KILL ellenére csak \
                akkor fogadhatsz el, ha a javaslat NEM érzékeny — érzékeny KILL végleges.""";
    }

    private static String integratorContract() {
        return """
                Válaszolj KIZÁRÓLAG egy JSON objektummal, magyarázat és formázás nélkül, pontosan \
                ebben a formában: {"rulings":[{"index":0,"accept":true|false,"confidence":0.0-1.0,\
                "reason":"...","dissent":true|false,"note":"DUPLICATE|CONTRADICTS|NOT_FOR_DOSSIER|\
                REHOME","suggestedDimensionKey":"..."}],"chapters":[{"title":"...",\
                "rationale":"..."}]}.
                A "reason" CSAK azt tartalmazza, amit te teszel hozzá — a Szkeptikus érvét ne \
                mondd el újra. Ha egyetértesz vele és nincs mit hozzátenned, a "reason" legyen \
                rövid és mondja ezt ki.
                A "dissent" akkor true, ha a döntésed szembemegy a Szkeptikus döntésével; ilyenkor \
                a "reason" nevezze meg, mit nem láthatott a Szkeptikus.
                A "note" csak akkor szerepeljen, ha tényleg találtál ilyet; a \
                "suggestedDimensionKey" csak REHOME mellé.
                A felsorolt javaslatok mindegyikéhez (P0, P1, …) adj egy rulings-bejegyzést. \
                Legfeljebb 1 chapters-bejegyzést adj, és csak akkor, ha tényleg indokolt.""";
    }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && ./mvnw test -Dtest='KonziliumVerdictRoundIT#theChairMayNotAcceptOverASensitiveKill+theChairMayAcceptOverANonSensitiveKillWithDissent+theChairsIntegrationNoteSurvivesOntoTheRuling' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 7: Run the focused suite, then commit**

Run: `cd backend && ./mvnw test -Dtest='Konzilium*,ClaimLifecycleIT,DeliberationAssemblerTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS — `ClaimLifecycleIT` and `DeliberationAssemblerTest` compile unchanged thanks to the 4-arg constructor.

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character/service/ClaimRuling.java backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumVerdictRound.java backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumVerdictRoundIT.java
git commit --no-verify -m "feat(character): give the konzílium chair its own brief and an enforced dissent rule (mezo-lghn)"
```

---

## Task 5: The chair's turn speaks only where it adds

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumVerdictRound.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumVerdictRoundIT.java`

**Interfaces:**
- Consumes: Task 4's `ClaimRuling.dissent()` / `note()`, Task 1's `SkepticVerdictDraft.suggestedConfidence()`.
- Produces: `integratorTurn(List<ClaimRuling> rulings, List<ChapterProposal> chapters, Map<Integer, SkepticVerdictDraft> verdicts)`. Nothing later depends on its text shape except the tests.

- [ ] **Step 1: Write the failing tests**

```java
    @Test
    void aPlainRatificationRoundLeavesNoPerProposalEchoInTheChairsTurn() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        // Canned fake: Szkeptikus KEEPs with no suggested confidence, chair accepts at 0.6 with no
        // dissent and no note — the paraphrase case this whole change exists to remove.
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik.", new BigDecimal("0.60"), false, "Három heti mérés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        ConferenceTranscriptEnvelope.Turn chair = result.turns().stream()
                .filter(turn -> turn.persona().equals("mezo"))
                .findFirst().orElseThrow();
        assertThat(chair.text()).contains("nem teszek hozzá");
        assertThat(chair.text()).doesNotContain("Fake döntés.");
    }

    @Test
    void theChairsTurnNeverCarriesARawDecimal() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":true,"
                        + "\"confidence\":0.8,\"reason\":\"A dosszié két korábbi mérése is ezt mutatja.\","
                        + "\"note\":\"CONTRADICTS\"}],\"chapters\":[]}]",
                new BigDecimal("0.60"), false, "Három heti mérés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        ConferenceTranscriptEnvelope.Turn chair = result.turns().stream()
                .filter(turn -> turn.persona().equals("mezo"))
                .findFirst().orElseThrow();
        assertThat(chair.text()).containsPattern("biztos|valószínű|figyeljük");
        assertThat(chair.text()).doesNotContainPattern("\\d\\.\\d");
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./mvnw test -Dtest='KonziliumVerdictRoundIT#aPlainRatificationRoundLeavesNoPerProposalEchoInTheChairsTurn+theChairsTurnNeverCarriesARawDecimal' -Dmezo.test.use-testcontainers=true`
Expected: FAIL — the turn currently echoes every ruling's reason and prints `(0.80)`.

- [ ] **Step 3: Rewrite `integratorTurn`**

```java
    private static final String NOTHING_TO_ADD = "a Szkeptikus érvét elfogadom, nem teszek hozzá.";

    private static final Map<String, String> NOTE_LABELS = Map.of(
            "DUPLICATE", "már tartunk ilyet",
            "CONTRADICTS", "ellentmond a dossziénak",
            "NOT_FOR_DOSSIER", "nem dossziéba való",
            "REHOME", "máshová tartozik");

    /**
     * The chair's turn, carrying a per-proposal line ONLY where the ruling added something to what
     * the Szkeptikus already said (mezo-lghn). Everything the chair merely ratified collapses into
     * one honest aggregate line instead of a paraphrase, and confidence is rendered as a WORD —
     * this turn used to print a raw decimal into a user-facing surface, against the invariant
     * {@link CharacterConfidenceWords} states.
     */
    private static ConferenceTranscriptEnvelope.Turn integratorTurn(List<ClaimRuling> rulings,
                                                                     List<ChapterProposal> chapters,
                                                                     Map<Integer, SkepticVerdictDraft> verdicts) {
        long accepted = rulings.stream().filter(ClaimRuling::accepted).count();
        StringBuilder sb = new StringBuilder("Mezo: ").append(accepted).append('/').append(rulings.size())
                .append(" javaslat elfogadva.");
        List<String> ratified = new ArrayList<>();
        for (int i = 0; i < rulings.size(); i++) {
            ClaimRuling ruling = rulings.get(i);
            if (!addsSomething(ruling, verdicts.get(i))) {
                ratified.add("P" + i);
                continue;
            }
            sb.append("\nP").append(i).append(": ").append(ruling.accepted() ? "ELFOGADVA" : "ELUTASÍTVA");
            if (ruling.accepted() && ruling.ruledConfidence() != null) {
                sb.append(" (").append(CharacterConfidenceWords.word(ruling.ruledConfidence())).append(')');
            }
            if (ruling.dissent()) {
                sb.append(" [a Szkeptikus döntése ellenében]");
            }
            String label = ruling.note() == null ? null : NOTE_LABELS.get(ruling.note());
            if (label != null) {
                sb.append(" [").append(label);
                if (ruling.suggestedDimensionKey() != null) {
                    sb.append(": ").append(ruling.suggestedDimensionKey());
                }
                sb.append(']');
            }
            sb.append(" — ").append(ruling.reason());
        }
        if (!ratified.isEmpty()) {
            sb.append('\n').append(String.join(", ", ratified)).append(": ").append(NOTHING_TO_ADD);
        }
        for (ChapterProposal chapter : chapters) {
            sb.append("\nÚj fejezet: ").append(chapter.title()).append(" — ").append(chapter.rationale());
        }
        return new ConferenceTranscriptEnvelope.Turn("mezo", sb.toString(), List.of());
    }

    /**
     * Whether this ruling contributed anything the Szkeptikus had not already said. A rejection
     * that ratifies a KILL adds nothing; a rejection over KEEP/WEAKEN or over no answer at all is
     * always shown, so a real disagreement can never hide behind a model that forgot to set
     * {@code dissent}.
     */
    private static boolean addsSomething(ClaimRuling ruling, SkepticVerdictDraft verdict) {
        if (ruling.dissent() || ruling.note() != null) {
            return true;
        }
        if (!ruling.accepted()) {
            return verdict == null || !KILL.equals(verdict.verdict());
        }
        if (ruling.ruledConfidence() == null) {
            return true;
        }
        BigDecimal suggested = verdict == null ? null : verdict.suggestedConfidence();
        if (suggested == null) {
            return true;
        }
        return !CharacterConfidenceWords.word(ruling.ruledConfidence())
                .equals(CharacterConfidenceWords.word(suggested));
    }
```

Update the call site in `run`:

```java
        if (integratorResult.parsed()) {
            turns.add(integratorTurn(rulings, chapters, skepticResult.verdicts()));
        }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && ./mvnw test -Dtest='KonziliumVerdictRoundIT#aPlainRatificationRoundLeavesNoPerProposalEchoInTheChairsTurn+theChairsTurnNeverCarriesARawDecimal' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

**If the first test fails** because the canned fake supplies no `suggestedConfidence` (so `addsSomething` returns true on the `suggested == null` branch): that is the correct behaviour — a chair-set word nobody suggested IS new information. Fix the *test* by scripting a Szkeptikus sentinel with `"suggestedConfidence":0.6` (same word tier as the chair's canned 0.6), not by weakening `addsSomething`.

- [ ] **Step 5: Run the focused suite, then commit**

Run: `cd backend && ./mvnw test -Dtest='Konzilium*,ClaimLifecycleIT,DeliberationAssemblerTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS. Existing ITs asserting the old `ELFOGADVA (0.60)` shape must be **updated**, not deleted — the new expectation is the confidence word.

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character/service/KonziliumVerdictRound.java backend/src/test/java/io/mrkuhne/mezo/feature/character/KonziliumVerdictRoundIT.java
git commit --no-verify -m "fix(character): stop the konzílium chair echoing the Szkeptikus and leaking a raw decimal (mezo-lghn)"
```

---

## Task 6: Envelope, contract, and the thread card

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/ConferenceDeliberationEnvelope.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/DeliberationAssembler.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/LegacyTranscriptParser.java:176,194`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterService.java:325-334`
- Modify: `api/feature/character/character.yml:389-397`
- Modify: `frontend/src/features/character/components/ConferenceThreadCard.tsx`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/DeliberationAssemblerTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/ConferenceDeliberationEnvelopeIT.java:47-48`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterApiIT.java:396-397`
- Test: `frontend/src/features/character/components/ConferenceThreadCard.test.tsx`

**Widening these two records breaks every direct constructor call — here is the complete list**
(the controller scanned for it; do not go hunting):

| record | call site | what to pass for the new fields |
|---|---|---|
| `SkepticVerdict` | `DeliberationAssembler.java:46` | `verdict.suggestedConfidence()` (the real value) |
| `SkepticVerdict` | `LegacyTranscriptParser.java:176` | `null` — a legacy prose transcript records no suggested strength |
| `SkepticVerdict` | `ConferenceDeliberationEnvelopeIT.java:47` | `null` |
| `SkepticVerdict` | `CharacterApiIT.java:396` | `null` |
| `ChairRuling` | `DeliberationAssembler.java:55` | the real `dissent()` / `note()` / `suggestedDimensionKey()` |
| `ChairRuling` | `LegacyTranscriptParser.java:194` | `null, null, null` |
| `ChairRuling` | `ConferenceDeliberationEnvelopeIT.java:48` | `null, null, null` |
| `ChairRuling` | `CharacterApiIT.java:397` | `null, null, null` |

`LegacyTranscriptParser` is **production** code: it reconstructs the structured envelope from
conferences persisted as prose before the envelope existed. Passing `null` there is the honest
answer, not a shortcut — those meetings genuinely produced no dissent or integration note, and
the frontend already renders a null `dissent` as false. Do **not** invent values for them, and do
**not** give these two records compatibility constructors: unlike `ClaimRuling` (whose 16 call
sites all legitimately mean "no dissent"), every one of these eight sites is a place where the
right value must be chosen deliberately.

**Interfaces:**
- Consumes: Task 4's `ClaimRuling` fields, Task 1's `SkepticVerdict.suggestedConfidence()`.
- Produces: `ConferenceDeliberationEnvelope.SkepticVerdict(String verdict, String argument, BigDecimal suggestedConfidence)` and `ConferenceDeliberationEnvelope.ChairRuling(boolean accepted, BigDecimal confidence, String reason, Boolean dissent, String note, String suggestedDimensionKey)`. On the wire: `ConferenceSkepticVerdict.suggestedConfidence`, `ConferenceChairRuling.dissent`, `.note`, `.suggestedDimensionKey`.

- [ ] **Step 1: Widen the envelope**

```java
    /** {@code verdict} is {@code KEEP}, {@code WEAKEN} or {@code KILL}. {@code suggestedConfidence}
     *  is the strength the Szkeptikus thinks the evidence carries, null when it gave none. */
    public record SkepticVerdict(String verdict, String argument, BigDecimal suggestedConfidence) {
    }

    /** {@code dissent} is a boxed Boolean and {@code note}/{@code suggestedDimensionKey} are
     *  nullable so a conference persisted before mezo-lghn deserializes with them absent (Jackson
     *  reads that as null) — no migration. */
    public record ChairRuling(boolean accepted, BigDecimal confidence, String reason,
                              Boolean dissent, String note, String suggestedDimensionKey) {
    }
```

- [ ] **Step 2: Write the failing assembler test**

Add to `DeliberationAssemblerTest`:

```java
    @Test
    void theChairsDissentAndNoteReachTheEnvelope() {
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", "physical", null,
                "Rekompozíció zajlik.", new BigDecimal("0.60"), false, "Három heti mérés.");
        ConferenceDeliberationEnvelope envelope = DeliberationAssembler.assemble(
                List.of(proposal),
                List.of(),
                List.of(new KonziliumVerdictRound.SkepticVerdict(0, "WEAKEN", "Kevés adat.",
                        new BigDecimal("0.55"))),
                List.of(new ClaimRuling(proposal, true, new BigDecimal("0.60"), "A dosszié ezt erősíti.",
                        true, "CONTRADICTS", null)),
                KonziliumChapters.of(List.of(), Map.of()));

        ConferenceDeliberationEnvelope.Item item = envelope.threads().get(0).items().get(0);
        assertThat(item.skeptic().verdict()).isEqualTo("WEAKEN");
        assertThat(item.skeptic().suggestedConfidence()).isEqualByComparingTo("0.55");
        assertThat(item.chair().dissent()).isTrue();
        assertThat(item.chair().note()).isEqualTo("CONTRADICTS");
    }
```

**Read `DeliberationAssemblerTest`'s existing tests first** and copy their exact `KonziliumChapters` construction — the `KonziliumChapters.of(...)` call above is a guess at the factory's shape. Use whatever the neighbouring tests use verbatim.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='DeliberationAssemblerTest#theChairsDissentAndNoteReachTheEnvelope' -Dmezo.test.use-testcontainers=true`
Expected: FAIL to compile — the records have three fewer components.

- [ ] **Step 4: Pass the fields through the assembler**

```java
            verdictByIndex.put(verdict.index(),
                    new ConferenceDeliberationEnvelope.SkepticVerdict(
                            verdict.verdict(), verdict.argument(), verdict.suggestedConfidence()));
```

```java
            ConferenceDeliberationEnvelope.ChairRuling chair = i < rulings.size()
                    ? new ConferenceDeliberationEnvelope.ChairRuling(
                            rulings.get(i).accepted(), rulings.get(i).ruledConfidence(),
                            rulings.get(i).reason(), rulings.get(i).dissent(),
                            rulings.get(i).note(), rulings.get(i).suggestedDimensionKey())
                    : null;
```

- [ ] **Step 5: Extend the contract and the DTO mapping**

In `api/feature/character/character.yml`:

```yaml
    ConferenceSkepticVerdict:
      type: object
      required: [verdict, argument]
      properties:
        verdict: { type: string, enum: [KEEP, WEAKEN, KILL] }
        argument: { type: string }
        suggestedConfidence: { type: number, format: double, nullable: true }
    ConferenceChairRuling:
      type: object
      required: [accepted, reason]
      properties:
        accepted: { type: boolean }
        confidence: { type: number, format: double, nullable: true }
        reason: { type: string }
        dissent: { type: boolean, nullable: true }
        note:
          type: string
          nullable: true
          enum: [DUPLICATE, CONTRADICTS, NOT_FOR_DOSSIER, REHOME]
        suggestedDimensionKey: { type: string, nullable: true }
```

In `CharacterService`, extend the two builders:

```java
                .skeptic(item.skeptic() == null ? null : ConferenceSkepticVerdict.builder()
                        .verdict(ConferenceSkepticVerdict.VerdictEnum.fromValue(item.skeptic().verdict()))
                        .argument(item.skeptic().argument())
                        .suggestedConfidence(item.skeptic().suggestedConfidence() == null
                                ? null : item.skeptic().suggestedConfidence().doubleValue())
                        .build())
                .chair(item.chair() == null ? null : ConferenceChairRuling.builder()
                        .accepted(item.chair().accepted())
                        .confidence(item.chair().confidence() == null
                                ? null : item.chair().confidence().doubleValue())
                        .reason(item.chair().reason())
                        .dissent(item.chair().dissent())
                        .note(item.chair().note() == null
                                ? null : ConferenceChairRuling.NoteEnum.fromValue(item.chair().note()))
                        .suggestedDimensionKey(item.chair().suggestedDimensionKey())
                        .build())
```

Regenerate the client and confirm no drift:

```bash
cd frontend && pnpm run gen:api && cd ..
```

(Confirm the script name from `frontend/package.json` — use whatever the repo's OpenAPI generation script is actually called.)

- [ ] **Step 6: Write the failing frontend test**

Add to `ConferenceThreadCard.test.tsx`, following the existing tests' fixture builders:

```tsx
  test('a WEAKEN verdikt saját címkét kap, a chair dissent és note megjelenik', async () => {
    renderCard({
      skeptic: { verdict: 'WEAKEN', argument: 'Kevés adat.', suggestedConfidence: 0.55 },
      chair: { accepted: true, confidence: 0.6, reason: 'A dosszié ezt erősíti.', dissent: true, note: 'CONTRADICTS' },
    })
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/Gyengítette/)).toBeInTheDocument()
    expect(screen.getByText(/a Szkeptikus döntése ellenében/)).toBeInTheDocument()
    expect(screen.getByText(/ellentmond a dossziénak/)).toBeInTheDocument()
  })

  test('a puszta ratifikáció nem parafrazál, hanem kimondja hogy nincs hozzátenni való', async () => {
    renderCard({
      skeptic: { verdict: 'KILL', argument: 'Két megfigyelés egy napról.' },
      chair: { accepted: false, confidence: null, reason: 'Egyetértek.', dissent: false, note: null },
    })
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/nem teszek hozzá/)).toBeInTheDocument()
  })
```

**Read the existing test file first** and reuse its render helper and fixture shape rather than the invented `renderCard` above.

- [ ] **Step 7: Run frontend test to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/character/components/ConferenceThreadCard.test.tsx`
Expected: FAIL.

- [ ] **Step 8: Render the new fields**

In `ConferenceThreadCard.tsx`, add the labels and rewrite the two chain steps:

```tsx
const SKEPTIC_LABEL: Record<string, string> = {
  KILL: 'Kukázta',
  WEAKEN: 'Gyengítette',
  KEEP: 'Meghagyta',
}

const NOTE_LABEL: Record<string, string> = {
  DUPLICATE: 'már tartunk ilyet',
  CONTRADICTS: 'ellentmond a dossziénak',
  NOT_FOR_DOSSIER: 'nem dossziéba való',
  REHOME: 'máshová tartozik',
}

const NOTHING_TO_ADD = 'A Szkeptikus érvét elfogadom, nem teszek hozzá.'

/** What the chair CONTRIBUTED, or the honest short form when it only ratified. A rejection that
 *  ratifies a KILL, and an acceptance at the strength the Szkeptikus suggested, both add nothing —
 *  paraphrasing the Szkeptikus there is the theater this card exists to avoid (mezo-lghn). */
function chairAddedSomething(item: ConferenceItem): boolean {
  const chair = item.chair
  if (chair == null) return false
  if (chair.dissent === true || chair.note != null) return true
  if (!chair.accepted) return item.skeptic == null || item.skeptic.verdict !== 'KILL'
  if (chair.confidence == null) return true
  const suggested = item.skeptic?.suggestedConfidence
  if (suggested == null) return true
  return confidenceWord(chair.confidence) !== confidenceWord(suggested)
}
```

Replace the two `ChainStep`s inside `ItemChain`:

```tsx
      <ChainStep who="Szkeptikus" color={expertColor('szkeptikus')}>
        {item.skeptic == null
          ? NO_ANSWER
          : `${SKEPTIC_LABEL[item.skeptic.verdict] ?? 'Válaszolt'}${
              item.skeptic.suggestedConfidence != null && item.skeptic.verdict !== 'KILL'
                ? ` · ${confidenceWord(item.skeptic.suggestedConfidence)}`
                : ''
            } — ${item.skeptic.argument}`}
      </ChainStep>
      <ChainStep who="Mezo" color={expertColor('mezo')}>
        {item.chair == null
          ? NO_ANSWER
          : !chairAddedSomething(item)
            ? NOTHING_TO_ADD
            : `${item.chair.accepted ? 'Elfogadva' : 'Elvetve'}${
                item.chair.accepted && item.chair.confidence != null
                  ? ` · ${confidenceWord(item.chair.confidence)}`
                  : ''
              }${item.chair.dissent === true ? ' · a Szkeptikus döntése ellenében' : ''}${
                item.chair.note != null && NOTE_LABEL[item.chair.note] != null
                  ? ` · ${NOTE_LABEL[item.chair.note]}${
                      item.chair.suggestedDimensionKey != null ? `: ${item.chair.suggestedDimensionKey}` : ''
                    }`
                  : ''
              } — ${item.chair.reason}`}
      </ChainStep>
```

- [ ] **Step 9: Run both suites**

Run: `cd frontend && pnpm vitest run src/features/character/ && cd ..`
Expected: PASS.
Run: `cd backend && ./mvnw test -Dtest='Konzilium*,ClaimLifecycleIT,DeliberationAssemblerTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character/entity/ConferenceDeliberationEnvelope.java backend/src/main/java/io/mrkuhne/mezo/feature/character/service/DeliberationAssembler.java backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterService.java backend/src/test/java/io/mrkuhne/mezo/feature/character/DeliberationAssemblerTest.java api/feature/character/character.yml frontend/src/data/_client/api.gen.ts frontend/src/features/character/components/ConferenceThreadCard.tsx frontend/src/features/character/components/ConferenceThreadCard.test.tsx
git commit --no-verify -m "feat(character): show what the konzílium chair added, not what it repeated (mezo-lghn)"
```

---

## Task 7: Docs and the full local gate

**Files:**
- Modify: `docs/features/character.md`

- [ ] **Step 1: Update the feature doc**

Three edits, each in the section that already covers the topic:

1. **§3 flow diagram** — the `weekly:` block's verdict line becomes:
   `KonziliumVerdictRound: Szkeptikus (smart-tier, KEEP|WEAKEN|KILL + javasolt bizalom) → Mezo/Integrátor (smart-tier, a dosszié birtokában: accept/confidence/reason/dissent/note + optional chapter proposal)`
2. **The role description** (§ "Built by a visible AI team" and the Konzílium FE section) — state the split: the Szkeptikus owns "is it true", Mezo owns "do we write it down, and how". Note that the Szkeptikus deliberately sees neither the dossier nor the peer stances.
3. **Gotchas** — add three entries next to the existing "Confidence ceilings differ by path" note:
   - the chair's dossier block is capped by `mezo.character.conference.max-dossier-claims` (80) and **says so when capped**;
   - the asymmetric dissent rule is enforced in `KonziliumVerdictRound.toRuling`, not only in the
     prompt, and it **fails closed**: accepting a `sensitive` **`NEW`/`UP`** proposal requires an
     affirmative `KEEP` or `WEAKEN` from the Szkeptikus, so a `KILL`, a `null` verdict (that round
     failed to parse) and an unrecognised grade all block it; the blocked ruling becomes a
     rejection with a **system-authored** reason (never the chair's own accept text),
     `note=NOT_FOR_DOSSIER`, and a WARN. `DOWN`/`RETIRE` accepts are never blocked — they tighten
     the dossier, and blocking them would leave a sensitive claim in place while stamping it
     "not for the dossier";
   - `skepticLine` renders an explicit "gave no answer" line for an index the Szkeptikus never
     answered, on the transcript and in the chair's prompt block alike, from one shared helper. It
     used to synthesise `KEEP — nincs ellenérv` there, which told the chair the Szkeptikus had
     approved something it never saw;
   - the chair's transcript turn renders confidence as a WORD (it used to print a raw decimal, against `CharacterConfidenceWords`'s stated invariant) and carries a per-proposal line only where the ruling added something.

- [ ] **Step 2: Verify the codemap is still fresh**

Run: `node scripts/gen-codemap.mjs --check`
Expected: clean (no file was added or removed). If it reports drift, run `node scripts/gen-codemap.mjs` and include `docs/CODEMAP.md` in the commit.

- [ ] **Step 3: Run the ArchUnit gate on its own, and check its frozen store**

`ArchitectureTest` is deliberately absent from every per-task pattern: its frozen store
(`backend/src/test/resources/archunit-store/`) is a shared file that a local run can silently
**empty**, which then fails for reasons unrelated to any task here. It gets exactly one run, here:

```bash
cd backend && ./mvnw test -Dtest='ArchitectureTest' -Dmezo.test.use-testcontainers=true
cd .. && git diff --stat origin/main -- backend/src/test/resources/archunit-store
```

Expected: the test passes, and the `git diff` is **empty**. If the diff is non-empty, the run
emptied the store — restore it (`git restore --source=origin/main backend/src/test/resources/archunit-store`)
and never commit that deletion. If the test genuinely FAILS on a new package dependency, the only
new one this branch introduces is `KonziliumVerdictRound` → `character.repository.*` /
`character.config.*`, which `KonziliumProposalRound` already has — so a failure there is a real
finding, not noise. Report it rather than freezing a new rule.

- [ ] **Step 4: Run every other local gate**

```bash
cd backend && ./mvnw test -Dtest='Konzilium*,ClaimLifecycleIT,DeliberationAssemblerTest' -Dmezo.test.use-testcontainers=true
cd frontend && pnpm vitest run src/features/character/ && pnpm build && cd ..
git status --short
```

**Known local hazard:** a background `jdtls` (Eclipse JDT Language Server) process holds
`backend/target` and races Maven's compiler, which makes `mvn clean` fail to delete the directory
and can make a run fail on missing OpenAPI-generated `*Builder` classes. Do not `clean`. If a run
fails on generated-DTO symbols rather than on this branch's code, re-run once without `clean`;
if it persists, report it — do not start killing the user's editor processes.

Expected: green backend, green frontend, successful build. `git status` must show no unexpected file — in particular **check `git diff --cached` for a `.beads/issues.jsonl` re-export the hook may have staged, and unstage it.**

- [ ] **Step 5: Commit**

```bash
git add docs/features/character.md
git commit --no-verify -m "docs(character): record the konzílium's split judge roles (mezo-lghn)"
```

- [ ] **Step 6: Ship**

Push the branch, open a self-PR as the CI gate, wait for green (re-run `gh pr checks <n>` and read the table — never trust the watch's exit code), then merge locally with `--no-ff` and push main. `bd close mezo-lghn` once main is green.

---

## Self-Review Notes

**Spec coverage:** §3 → Task 1. §4 → Tasks 2–3. §5 → Task 4. §6 → Tasks 5–6. §7 → Task 6 Step 5. §8 → preserved throughout, asserted in Task 1 Step 6 and Task 5 Step 5. §9 → the tests distributed across Tasks 1–6. §10 (deferrals) → no task, by design; the Szkeptikus's narrow input is a stated non-goal. §11 → the File Structure table.

**Known soft spots the executor must resolve by reading code, not guessing:**
- Task 3 Step 2 — the prompt-assertion channel (audit-log prompt column vs. a new echo sentinel). The plan names both options and forbids inventing a third.
- Task 6 Step 2 — `KonziliumChapters`'s factory signature.
- Task 6 Step 6 — the existing test file's render helper.
- Task 6 Step 5 — the frontend's OpenAPI generation script name.

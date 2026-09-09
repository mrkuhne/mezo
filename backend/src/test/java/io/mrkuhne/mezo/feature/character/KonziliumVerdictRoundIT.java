package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.config.CharacterProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.service.ClaimLifecycle;
import io.mrkuhne.mezo.feature.character.service.ClaimProposal;
import io.mrkuhne.mezo.feature.character.service.ClaimRuling;
import io.mrkuhne.mezo.feature.character.service.KonziliumCrossTalkRound;
import io.mrkuhne.mezo.feature.character.service.KonziliumVerdictRound;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * IT for the weekly konzílium verdict round (mezo-1gim.5): the empty-proposals fast path (no LLM
 * calls), the canned-fake happy path (every proposal accepted at the canned confidence, exactly
 * two transcript turns), the sentinel-scripted KILL/clamp/blank-chapter/cap path, the honest-
 * transcript contract on a parse failure (no fabricated turn), and the UP/DOWN null-confidence
 * fallback threading through into {@link ClaimLifecycle}.
 */
@ActiveProfiles("companion-fake")
class KonziliumVerdictRoundIT extends ApiIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 8, 24); // ISO Monday
    /** Mirror of {@code KonziliumVerdictRound.SENSITIVE_BLOCKED_REASON} (private, different
     *  sub-package) — pins that a blocked sensitive accept's {@code reason} is ALWAYS this
     *  system-authored text, never the chair's own accept rationale (mezo-lghn fix round 2,
     *  item 3). */
    private static final String SENSITIVE_BLOCKED_REASON =
            "Érzékeny állítás, amit a Szkeptikus nem hagyott jóvá — a rendszer nem írja a dossziéba.";

    @Autowired private KonziliumVerdictRound verdictRound;
    @Autowired private ClaimLifecycle claimLifecycle;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;
    @Autowired private CharacterDimensionRepository dimensionRepository;
    @Autowired private CharacterClaimRepository claimRepository;
    @Autowired private CharacterProperties characterProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private CharacterDimensionEntity seedDimension(UUID owner, String key, String expertKey) {
        CharacterDimensionEntity entity = new CharacterDimensionEntity();
        entity.setCreatedBy(owner);
        entity.setKey(key);
        entity.setTitle(key);
        entity.setKind("CORE");
        entity.setExpertKey(expertKey);
        return dimensionRepository.save(entity);
    }

    private CharacterClaimEntity seedClaim(UUID owner, UUID dimensionId, String text, BigDecimal confidence) {
        CharacterClaimEntity entity = new CharacterClaimEntity();
        entity.setCreatedBy(owner);
        entity.setDimensionId(dimensionId);
        entity.setText(text);
        entity.setConfidence(confidence);
        entity.setStatus("ACTIVE");
        entity.setProposedBy("drill");
        entity.setEvidence(new ClaimEvidenceEnvelope(List.of()));
        entity.setSensitive(false);
        entity.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        entity.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(
                List.of(new ClaimConfidenceHistoryEnvelope.Point(confidence, "kezdet", Instant.now()))));
        return claimRepository.save(entity);
    }

    /** Sibling to {@link #seedClaim} for tests that need a claim carrying REAL confidence-history
     *  and user-feedback envelopes (mezo-lghn fix round 1) — {@code seedClaim}'s single-point
     *  history and empty feedback are deliberately kept as-is for the tests that already rely on
     *  that minimal shape. */
    private CharacterClaimEntity seedClaimWithHistoryAndFeedback(UUID owner, UUID dimensionId, String text,
            BigDecimal confidence, ClaimConfidenceHistoryEnvelope history, ClaimFeedbackEnvelope feedback) {
        CharacterClaimEntity entity = new CharacterClaimEntity();
        entity.setCreatedBy(owner);
        entity.setDimensionId(dimensionId);
        entity.setText(text);
        entity.setConfidence(confidence);
        entity.setStatus("ACTIVE");
        entity.setProposedBy("drill");
        entity.setEvidence(new ClaimEvidenceEnvelope(List.of()));
        entity.setSensitive(false);
        entity.setUserFeedback(feedback);
        entity.setConfidenceHistory(history);
        return claimRepository.save(entity);
    }

    @Test
    void markers_mirroredInFakeLlm_stayInSync() {
        assertThat(FakeCompanionLlm.SKEPTIC_MARKER_MIRROR).isEqualTo(KonziliumVerdictRound.SKEPTIC_MARKER);
        assertThat(FakeCompanionLlm.INTEGRATOR_MARKER_MIRROR).isEqualTo(KonziliumVerdictRound.INTEGRATOR_MARKER);
    }

    @Test
    void run_emptyProposals_returnsEmptyResultWithoutAnyLlmCall() {
        UUID owner = ownerId();
        int before = fakeCompanionLlm.completeCallCount();

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, List.of(), List.of());

        assertThat(result.rulings()).isEmpty();
        assertThat(result.chapters()).isEmpty();
        assertThat(result.turns()).isEmpty();
        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(before);
    }

    @Test
    void run_cannedFakeAnswer_everyProposalAcceptedAtCannedConfidence_twoTurns() {
        UUID owner = ownerId();
        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("drill", "NEW", "discipline", null, "Elmarad a logolás.",
                        new BigDecimal("0.50"), false, "3 nap kihagyás."),
                new ClaimProposal("pszichologus", "NEW", "mental", null, "Feszült hét.",
                        new BigDecimal("0.40"), false, "Napló jelzi."));

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, proposals, List.of());

        assertThat(result.rulings()).hasSize(2).allSatisfy(r -> {
            assertThat(r.accepted()).isTrue();
            assertThat(r.ruledConfidence()).isEqualByComparingTo(new BigDecimal("0.60"));
        });
        assertThat(result.chapters()).isEmpty();
        assertThat(result.turns()).hasSize(2)
                .extracting(ConferenceTranscriptEnvelope.Turn::persona)
                .containsExactly("szkeptikus", "mezo");
    }

    @Test
    void run_sentinelScriptsBothRounds_killedProposalRejected_confidenceClamped_blankChapterDropped() {
        UUID owner = ownerId();
        String skepticSentinel = "[fake-char-skeptic:["
                + "{\"index\":0,\"verdict\":\"KILL\",\"argument\":\"Nincs elég bizonyíték.\"},"
                + "{\"index\":1,\"verdict\":\"KEEP\",\"argument\":\"Rendben.\"}"
                + "]]";
        String integratorSentinel = "[fake-char-integrator:{"
                + "\"rulings\":["
                + "{\"index\":0,\"accept\":false,\"confidence\":0.10,\"reason\":\"killed\"},"
                + "{\"index\":1,\"accept\":true,\"confidence\":0.99,\"reason\":\"ok\"}"
                + "],"
                + "\"chapters\":["
                + "{\"title\":\"\",\"rationale\":\"üres cím\"},"
                + "{\"title\":\"Valid Chapter\",\"rationale\":\"tényleg önálló téma\"}"
                + "]}]";

        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("drill", "NEW", "discipline", null, "Vitatott javaslat.",
                        new BigDecimal("0.50"), false, skepticSentinel),
                new ClaimProposal("pszichologus", "NEW", "mental", null, "Elfogadott javaslat.",
                        new BigDecimal("0.50"), false, integratorSentinel));

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, proposals, List.of());

        assertThat(result.rulings()).hasSize(2);
        ClaimRuling r0 = result.rulings().get(0);
        ClaimRuling r1 = result.rulings().get(1);
        assertThat(r0.accepted()).isFalse();
        assertThat(r1.accepted()).isTrue();
        assertThat(r1.ruledConfidence()).isEqualByComparingTo(new BigDecimal("0.90")); // 0.99 clamped

        assertThat(result.chapters()).singleElement()
                .satisfies(c -> assertThat(c.title()).isEqualTo("Valid Chapter"));
    }

    @Test
    void run_twoValidChapterTitles_capsAtOne_onlyFirstSurvives() {
        UUID owner = ownerId();
        String integratorSentinel = "[fake-char-integrator:{"
                + "\"rulings\":[{\"index\":0,\"accept\":true,\"confidence\":0.5,\"reason\":\"ok\"}],"
                + "\"chapters\":["
                + "{\"title\":\"Első fejezet\",\"rationale\":\"r1\"},"
                + "{\"title\":\"Második fejezet\",\"rationale\":\"r2\"}"
                + "]}]";
        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("drill", "NEW", "discipline", null, "Javaslat.",
                        new BigDecimal("0.50"), false, integratorSentinel));

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, proposals, List.of());

        assertThat(result.chapters()).singleElement()
                .satisfies(c -> assertThat(c.title()).isEqualTo("Első fejezet"));
    }

    @Test
    void run_skepticAnswerFailsToParse_noSzkeptikusTurn_butIntegratorTurnStillWritten() {
        UUID owner = ownerId();
        // matching brackets so the sentinel regex matches, but invalid JSON syntax inside — forces
        // the catch-and-log parse-failure path, NOT the "empty answer" default path
        String brokenSkepticSentinel = "[fake-char-skeptic:[{\"index\":0,\"verdict\":}]]";
        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("drill", "NEW", "discipline", null, "Javaslat.",
                        new BigDecimal("0.50"), false, brokenSkepticSentinel));

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, proposals, List.of());

        // the Integrátor still gets a canned fallback answer (no integrator sentinel here), so its
        // turn is genuinely parsed and honest — only the szkeptikus turn is suppressed
        assertThat(result.turns()).extracting(ConferenceTranscriptEnvelope.Turn::persona).containsExactly("mezo");
        assertThat(result.rulings()).hasSize(1); // downstream defaulting still ran off the empty verdict map
    }

    @Test
    void run_upRulingOmitsConfidence_leavesRuledConfidenceNull_lifecycleStepsFromCurrent() {
        UUID owner = ownerId();
        UUID conferenceId = UUID.randomUUID();
        CharacterDimensionEntity dimension = seedDimension(owner, "discipline", "drill");
        CharacterClaimEntity claim = seedClaim(owner, dimension.getId(), "Fegyelmezett hét.", new BigDecimal("0.50"));

        // the ruling deliberately OMITS "confidence" — proves the round does not silently fall back
        // to the proposal's own confidence for a non-NEW kind
        String integratorSentinel = "[fake-char-integrator:{"
                + "\"rulings\":[{\"index\":0,\"accept\":true,\"reason\":\"erősödött\"}],"
                + "\"chapters\":[]}]";
        ClaimProposal proposal = new ClaimProposal("drill", "UP", null, claim.getId(),
                "Fegyelmezett hét.", new BigDecimal("0.99"), false, integratorSentinel);

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        ClaimRuling ruling = result.rulings().get(0);
        assertThat(ruling.accepted()).isTrue();
        assertThat(ruling.ruledConfidence()).isNull();

        List<ConferenceOutcomeEnvelope.Change> changes = claimLifecycle.apply(owner, conferenceId, result.rulings());

        assertThat(changes).singleElement().satisfies(c -> assertThat(c.kind()).isEqualTo("CLAIM_CONFIDENCE_UP"));
        CharacterClaimEntity updated = claimRepository.findById(claim.getId()).orElseThrow();
        assertThat(updated.getConfidence()).isEqualByComparingTo(new BigDecimal("0.60")); // 0.50 + 0.10 step
    }

    @Test
    void run_peerReactions_reachTheIntegratorPrompt() {
        UUID owner = ownerId();
        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("szomnologus", "NEW", "recovery", null, "Romlik az alvás.",
                        new BigDecimal("0.50"), false, "Három rossz éjszaka."),
                new ClaimProposal("pszichologus", "NEW", "mental", null, "Feszült hét.",
                        new BigDecimal("0.40"), false, "Napló jelzi."));
        List<KonziliumCrossTalkRound.Reaction> reactions = List.of(
                new KonziliumCrossTalkRound.Reaction(0, "pszichologus", "CHALLENGE",
                        "A feszültség is okozhatta, nem csak az alvás."));

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, proposals, reactions);

        assertThat(result.rulings()).hasSize(2);
        assertThat(fakeCompanionLlm.lastUserMessage()).contains("A feszültség is okozhatta");
    }

    @Test
    void run_parsedSkepticAnswer_exposesItsVerdictsPerProposalIndex() {
        UUID owner = ownerId();
        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("drill", "NEW", "discipline", null, "Elmarad a logolás.",
                        new BigDecimal("0.50"), false, "3 nap kihagyás."));

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, proposals, List.of());

        // isNotBlank() alone would also pass on the "nincs ellenérv" default a fabricated verdict
        // would carry — assert the Szkeptikus's OWN answer instead (final review, I5c).
        assertThat(result.verdicts()).singleElement().satisfies(verdict -> {
            assertThat(verdict.index()).isZero();
            assertThat(verdict.verdict()).isEqualTo("KEEP");
            assertThat(verdict.argument()).isEqualTo("Fake ellenérv: elfogadható.");
        });
        assertThat(result.chairParsed()).isTrue();
        assertThat(result.shownRulings()).hasSize(1);
    }

    /** I2 (mezo-xlvr final review): the Szkeptikus answered index 0 only — index 1 must carry NO
     *  verdict at all rather than a fabricated KEEP / "nincs ellenérv". */
    @Test
    void run_skepticAnswersOnlySomeIndexes_theOthersGetNoVerdict() {
        UUID owner = ownerId();
        String skepticSentinel = "[fake-char-skeptic:["
                + "{\"index\":0,\"verdict\":\"KILL\",\"argument\":\"Nincs elég bizonyíték.\"}"
                + "]]";
        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("drill", "NEW", "discipline", null, "Első javaslat.",
                        new BigDecimal("0.50"), false, skepticSentinel),
                new ClaimProposal("pszichologus", "NEW", "mental", null, "Második javaslat.",
                        new BigDecimal("0.50"), false, "Napló jelzi."));

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, proposals, List.of());

        assertThat(result.verdicts()).singleElement().satisfies(verdict -> {
            assertThat(verdict.index()).isZero();
            assertThat(verdict.verdict()).isEqualTo("KILL");
            assertThat(verdict.argument()).isEqualTo("Nincs elég bizonyíték.");
        });
        // the lifecycle still gets an index-complete ruling list — only the SHOWN verdicts shrink
        assertThat(result.rulings()).hasSize(2);
    }

    /** I1 (mezo-xlvr final review): an unparsed Integrátor answer still defaults every ruling for
     *  the lifecycle, but must expose NOTHING as a ruling the chair gave. */
    @Test
    void run_integratorAnswerFailsToParse_rulingsStayDefaulted_butNothingIsShownAsARuling() {
        UUID owner = ownerId();
        String brokenIntegratorSentinel = "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":}]}]";
        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("drill", "NEW", "discipline", null, "Javaslat.",
                        new BigDecimal("0.50"), false, brokenIntegratorSentinel));

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, proposals, List.of());

        assertThat(result.chairParsed()).isFalse();
        assertThat(result.shownRulings()).isEmpty();
        assertThat(result.turns()).extracting(ConferenceTranscriptEnvelope.Turn::persona)
                .containsExactly("szkeptikus");
        assertThat(result.rulings()).singleElement().satisfies(ruling -> {
            assertThat(ruling.accepted()).isFalse();
            assertThat(ruling.reason()).isEqualTo("nem került döntésre");
        });
    }

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
        // The round calls the Szkeptikus first, then the Integrátor, so lastUserMessage() holds
        // the Integrátor's prompt — the one channel that actually renders target(...). Assert the
        // resolved claim's text and confidence WORD reached it, and the raw UUID did not.
        assertThat(fakeCompanionLlm.lastUserMessage())
                .contains(claim.getText())
                .contains("valószínű")
                .doesNotContain(claim.getId().toString());
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
        assertThat(fakeCompanionLlm.lastUserMessage())
                .contains("a célzott állítás nem található")
                .doesNotContain(missing.toString());
    }

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

    /** mezo-lghn task 5: a ruling that merely RATIFIES the Szkeptikus — same accept, same
     *  confidence WORD tier, no dissent, no note — must not paraphrase the Szkeptikus's own
     *  argument into a per-proposal chair line; it collapses into the aggregate "nem teszek hozzá"
     *  line instead. The canned Szkeptikus KEEPs with no {@code suggestedConfidence} of its own, so
     *  the skeptic verdict here is SCRIPTED with one in the same word tier (0.6 → "valószínű") as
     *  the chair's canned 0.6 — otherwise {@code addsSomething}'s word-comparison arm would
     *  (correctly) treat a chair-set word nobody suggested as new information, which is not the
     *  scenario this test is pinning. */
    @Test
    void aPlainRatificationRoundLeavesNoPerProposalEchoInTheChairsTurn() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. [fake-char-skeptic:[{\"index\":0,\"verdict\":\"KEEP\","
                        + "\"argument\":\"Fake ellenérv: elfogadható.\",\"suggestedConfidence\":0.6}]]",
                new BigDecimal("0.60"), false, "Három heti mérés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        ConferenceTranscriptEnvelope.Turn chair = result.turns().stream()
                .filter(turn -> turn.persona().equals("mezo"))
                .findFirst().orElseThrow();
        assertThat(chair.text()).contains("nem teszek hozzá");
        assertThat(chair.text()).doesNotContain("Fake döntés.");
    }

    /** mezo-lghn task 5: confidence must reach the transcript as a WORD, never a raw decimal —
     *  the old code appended {@code ruling.ruledConfidence()} directly. The header is asserted
     *  first so the negative decimal-pattern check below cannot false-positive on the "1/1" count. */
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
        assertThat(chair.text()).contains("Mezo: 1/1 javaslat elfogadva.");
        assertThat(chair.text()).containsPattern("biztos|valószínű|figyeljük");
        assertThat(chair.text()).doesNotContainPattern("\\d\\.\\d");
    }

    /** mezo-lghn task 5, {@code addsSomething}'s DISSENT arm: a self-declared dissent must show a
     *  per-proposal line even when the chair's confidence word matches what the Szkeptikus
     *  suggested (which alone would ratify) — so deleting the {@code ruling.dissent() ||} disjunct
     *  cannot hide behind the word-comparison arm returning the same answer. */
    @Test
    void aDissentingAcceptIsShownEvenWhenTheConfidenceWordWouldOtherwiseRatify() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. "
                        + "[fake-char-skeptic:[{\"index\":0,\"verdict\":\"KILL\","
                        + "\"argument\":\"Túlinterpretálás.\",\"suggestedConfidence\":0.6}]] "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":true,"
                        + "\"confidence\":0.6,\"reason\":\"A dossziéban két korábbi mérés is ezt mutatja, "
                        + "amit a Szkeptikus nem látott.\",\"dissent\":true}],\"chapters\":[]}]",
                new BigDecimal("0.60"), false, "Három heti mérés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        ConferenceTranscriptEnvelope.Turn chair = result.turns().stream()
                .filter(turn -> turn.persona().equals("mezo"))
                .findFirst().orElseThrow();
        assertThat(chair.text()).contains("[a Szkeptikus döntése ellenében]");
        assertThat(chair.text()).doesNotContain("nem teszek hozzá");
    }

    /** mezo-lghn task 5, {@code addsSomething}'s NOTE arm: an integration note must show a
     *  per-proposal line even when the confidence word matches (no dissent either) — so deleting
     *  the {@code || ruling.note() != null} disjunct cannot hide behind the word-comparison arm.
     *  {@link #theChairsTurnNeverCarriesARawDecimal} also carries a note, but its Szkeptikus never
     *  suggests a confidence, so the word-comparison arm's {@code suggested == null} short-circuit
     *  would ALSO return true if the note check were deleted — it cannot isolate this branch on its
     *  own; this test scripts a matching suggestion specifically to close that gap. */
    @Test
    void theNoteArmIsShownEvenWhenTheConfidenceWordWouldOtherwiseRatify() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. "
                        + "[fake-char-skeptic:[{\"index\":0,\"verdict\":\"KEEP\","
                        + "\"argument\":\"Fake ellenérv: elfogadható.\",\"suggestedConfidence\":0.8}]] "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":true,"
                        + "\"confidence\":0.8,\"reason\":\"Ezt már tartjuk.\",\"note\":\"DUPLICATE\"}],"
                        + "\"chapters\":[]}]",
                new BigDecimal("0.60"), false, "Három heti mérés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        ConferenceTranscriptEnvelope.Turn chair = result.turns().stream()
                .filter(turn -> turn.persona().equals("mezo"))
                .findFirst().orElseThrow();
        assertThat(chair.text()).contains("már tartunk ilyet");
        assertThat(chair.text()).doesNotContain("nem teszek hozzá");
    }

    /** mezo-lghn task 5, {@code addsSomething}'s REJECTION arm, KILL half: a plain rejection that
     *  merely ratifies the Szkeptikus's own KILL adds nothing and collapses into the aggregate
     *  line — it must NOT get a per-proposal echo of the chair's reason. */
    @Test
    void aRejectionThatRatifiesAKillCollapsesIntoTheAggregateLine() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. "
                        + "[fake-char-skeptic:[{\"index\":0,\"verdict\":\"KILL\","
                        + "\"argument\":\"Túlinterpretálás.\"}]] "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":false,"
                        + "\"reason\":\"Egyetértek, nincs elég bizonyíték.\"}],\"chapters\":[]}]",
                new BigDecimal("0.60"), false, "Három heti mérés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        ConferenceTranscriptEnvelope.Turn chair = result.turns().stream()
                .filter(turn -> turn.persona().equals("mezo"))
                .findFirst().orElseThrow();
        assertThat(chair.text()).contains("nem teszek hozzá");
        assertThat(chair.text()).doesNotContain("Egyetértek, nincs elég bizonyíték.");
    }

    /** mezo-lghn task 5, {@code addsSomething}'s REJECTION arm, KEEP half: a rejection that goes
     *  AGAINST the Szkeptikus's KEEP must be shown even when the model never bothers to set
     *  {@code dissent} — a real disagreement must not be able to hide behind a forgetful model. */
    @Test
    void aRejectionOverAKeepIsShownEvenWithoutADissentFlag() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. "
                        + "[fake-char-skeptic:[{\"index\":0,\"verdict\":\"KEEP\","
                        + "\"argument\":\"Fake ellenérv: elfogadható.\"}]] "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":false,"
                        + "\"reason\":\"A dossziéban két ellentétes mérés is van.\"}],\"chapters\":[]}]",
                new BigDecimal("0.60"), false, "Három heti mérés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        ConferenceTranscriptEnvelope.Turn chair = result.turns().stream()
                .filter(turn -> turn.persona().equals("mezo"))
                .findFirst().orElseThrow();
        assertThat(chair.text()).contains("A dossziéban két ellentétes mérés is van.");
        assertThat(chair.text()).doesNotContain("nem teszek hozzá");
    }

    /** Sibling to {@link #aRejectionOverAKeepIsShownEvenWithoutADissentFlag}: the OTHER half of the
     *  rejection arm's {@code verdict == null} disjunct — a rejection where the Szkeptikus never
     *  answered this index at all must also be shown, not ratified, since silence is not a KILL to
     *  ratify. */
    @Test
    void aRejectionWithNoSkeptikusAnswerIsShown() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        // matching brackets so the sentinel regex matches, but invalid JSON syntax inside — forces
        // the catch-and-log parse-failure path, so skepticResult.verdicts() is genuinely EMPTY
        // (the canned fallback would otherwise answer KEEP for every P<n> it finds, which would
        // never reach the verdict == null branch at all).
        String brokenSkepticSentinel = "[fake-char-skeptic:[{\"index\":0,\"verdict\":}]]";
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. " + brokenSkepticSentinel + " "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":false,"
                        + "\"reason\":\"Önmagában nem elég erős a megfigyelés.\"}],\"chapters\":[]}]",
                new BigDecimal("0.60"), false, "Három heti mérés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.verdicts()).isEmpty();
        ConferenceTranscriptEnvelope.Turn chair = result.turns().stream()
                .filter(turn -> turn.persona().equals("mezo"))
                .findFirst().orElseThrow();
        assertThat(chair.text()).contains("Önmagában nem elég erős a megfigyelés.");
        assertThat(chair.text()).doesNotContain("nem teszek hozzá");
    }

    /** mezo-lghn task 5, {@code addsSomething}'s NULL-CONFIDENCE arm: an accepted UP/DOWN ruling
     *  that omits its own confidence (the lifecycle then steps off the claim's CURRENT value) must
     *  always be shown — there is no chair-set word to compare against a suggestion at all. The
     *  Szkeptikus's suggestion is deliberately scripted here (rather than left absent) so that
     *  deleting this arm does not silently fall through to the ALSO-true {@code suggested == null}
     *  short-circuit: without this arm, {@code CharacterConfidenceWords.word(null)} on the chair's
     *  own (missing) confidence throws instead, still turning the mutation red. */
    @Test
    void anAcceptedRulingWithNoRuledConfidenceIsAlwaysShown() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        CharacterClaimEntity claim = seedClaim(owner, dimension.getId(), "Fegyelmezett hét.", new BigDecimal("0.50"));
        ClaimProposal proposal = new ClaimProposal("doki", "UP", null, claim.getId(),
                "Erősödik. "
                        + "[fake-char-skeptic:[{\"index\":0,\"verdict\":\"KEEP\",\"argument\":\"Rendben.\","
                        + "\"suggestedConfidence\":0.6}]] "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":true,"
                        + "\"reason\":\"A lifecycle lépteti a szintet.\"}],\"chapters\":[]}]",
                new BigDecimal("0.70"), false, "Indoklás.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement()
                .satisfies(r -> assertThat(r.ruledConfidence()).isNull());
        ConferenceTranscriptEnvelope.Turn chair = result.turns().stream()
                .filter(turn -> turn.persona().equals("mezo"))
                .findFirst().orElseThrow();
        assertThat(chair.text()).contains("A lifecycle lépteti a szintet.");
        assertThat(chair.text()).doesNotContain("nem teszek hozzá");
    }

    /** mezo-lghn task 5, {@code addsSomething}'s WORD-COMPARISON arm, the "different" half: a
     *  chair-set confidence in a DIFFERENT word tier from what the Szkeptikus suggested is new
     *  information and must be shown. {@link #aPlainRatificationRoundLeavesNoPerProposalEchoInTheChairsTurn}
     *  pins the other half (same tier ⇒ ratified). */
    @Test
    void aChairSetWordDifferentFromTheSzkeptikusSuggestionIsShown() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. "
                        + "[fake-char-skeptic:[{\"index\":0,\"verdict\":\"KEEP\","
                        + "\"argument\":\"Fake ellenérv: elfogadható.\",\"suggestedConfidence\":0.4}]] "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":true,"
                        + "\"confidence\":0.8,\"reason\":\"Erősebbre teszem, mint amit a Szkeptikus javasolt.\"}],"
                        + "\"chapters\":[]}]",
                new BigDecimal("0.60"), false, "Három heti mérés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        ConferenceTranscriptEnvelope.Turn chair = result.turns().stream()
                .filter(turn -> turn.persona().equals("mezo"))
                .findFirst().orElseThrow();
        assertThat(chair.text()).contains("Erősebbre teszem, mint amit a Szkeptikus javasolt.");
        assertThat(chair.text()).doesNotContain("nem teszek hozzá");
    }

    /** mezo-lghn fix round 4, item 1 (MUST-FIX): an accept that OVERRULES an explicit KILL must
     *  always be shown — even when the model never sets {@code dissent} AND a stray
     *  {@code suggestedConfidence} on that KILL happens to land in the SAME confidence-word tier
     *  as the chair's own number (both 0.6 → "valószínű" here), which is exactly the combination
     *  that used to fall through to the word-comparison arm, compare equal, and collapse into the
     *  aggregate "nem teszek hozzá" line while the claim was written to the dossier regardless.
     *  Mirrors {@link #aRejectionOverAKeepIsShownEvenWithoutADissentFlag}'s hardening on the other
     *  side: a real disagreement (overruling a kill is the strongest thing the chair can do) must
     *  never hide behind a model that forgot to set dissent. */
    @Test
    void anAcceptOverAKillIsShownEvenWithoutADissentFlagAndAMatchingSuggestedConfidence() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. "
                        + "[fake-char-skeptic:[{\"index\":0,\"verdict\":\"KILL\","
                        + "\"argument\":\"Túlinterpretálás.\",\"suggestedConfidence\":0.6}]] "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":true,"
                        + "\"confidence\":0.6,\"reason\":\"A dossziéban két korábbi mérés is ezt mutatja, "
                        + "amit a Szkeptikus nem látott.\"}],\"chapters\":[]}]",
                new BigDecimal("0.60"), false, "Három heti mérés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement()
                .satisfies(ruling -> assertThat(ruling.accepted()).isTrue());
        ConferenceTranscriptEnvelope.Turn chair = result.turns().stream()
                .filter(turn -> turn.persona().equals("mezo"))
                .findFirst().orElseThrow();
        assertThat(chair.text()).contains(
                "A dossziéban két korábbi mérés is ezt mutatja, amit a Szkeptikus nem látott.");
        assertThat(chair.text()).doesNotContain("nem teszek hozzá");
    }

    /** mezo-lghn fix round 4, item 2: a KILL carries no suggested strength ({@code skepticLine}'s
     *  {@code || KILL.equals(draft.verdict())} disjunct) — a stray {@code suggestedConfidence} on
     *  an explicit KILL must never render as a confidence word on the Szkeptikus's transcript
     *  line, since a KILL has nothing to suggest a strength FOR. Deleting that disjunct left this
     *  unpinned: no existing test's KILL verdict ever carried a {@code suggestedConfidence}. */
    @Test
    void aKillVerdictNeverRendersASuggestedConfidenceWordEvenWhenTheDraftCarriesOne() {
        UUID owner = ownerId();
        String skepticSentinel = "[fake-char-skeptic:["
                + "{\"index\":0,\"verdict\":\"KILL\",\"argument\":\"Túlinterpretálás.\",\"suggestedConfidence\":0.8}"
                + "]]";
        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("drill", "NEW", "discipline", null, "Javaslat.",
                        new BigDecimal("0.50"), false, skepticSentinel));

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, proposals, List.of());

        ConferenceTranscriptEnvelope.Turn skepticTurn = result.turns().stream()
                .filter(turn -> turn.persona().equals("szkeptikus"))
                .findFirst().orElseThrow();
        assertThat(skepticTurn.text()).contains("P0: KILL — Túlinterpretálás.");
        assertThat(skepticTurn.text()).doesNotContainPattern("biztos|valószínű|figyeljük");
    }

    /** mezo-lghn task 5 fix round 1, gap 1: the {@code ruling.accepted() &&} conjunct guarding
     *  confidence rendering — a REJECTED ruling can carry a non-null {@code ruledConfidence}
     *  (informational only, never applied — {@link ClaimRuling}'s javadoc), and it must never
     *  render as a confidence word. This rejects over a Szkeptikus KEEP so {@code addsSomething}
     *  shows the line at all (a plain KILL-ratified rejection would collapse into the aggregate
     *  line and never reach the rendering branch under test). Confidence-word rendering is the
     *  ONLY place this method emits a parenthesis, so a bare {@code doesNotContain("(")} pins it
     *  precisely without needing to spell out every alternative word. */
    @Test
    void aShownRejectionNeverRendersAConfidenceWordEvenWithANonNullRuledConfidence() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. "
                        + "[fake-char-skeptic:[{\"index\":0,\"verdict\":\"KEEP\","
                        + "\"argument\":\"Fake ellenérv: elfogadható.\"}]] "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":false,"
                        + "\"confidence\":0.6,\"reason\":\"A dossziéban két ellentétes mérés is van.\"}],"
                        + "\"chapters\":[]}]",
                new BigDecimal("0.60"), false, "Három heti mérés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement().satisfies(ruling -> {
            assertThat(ruling.accepted()).isFalse();
            assertThat(ruling.ruledConfidence()).isEqualByComparingTo(new BigDecimal("0.60"));
        });
        ConferenceTranscriptEnvelope.Turn chair = result.turns().stream()
                .filter(turn -> turn.persona().equals("mezo"))
                .findFirst().orElseThrow();
        assertThat(chair.text()).contains("A dossziéban két ellentétes mérés is van.");
        assertThat(chair.text()).doesNotContain("(");
    }

    /** mezo-lghn task 5 fix round 1, gap 2: a FIRED sensitive-write guardrail must be visible in
     *  the chair's transcript, not just on {@code result.rulings()} — every existing guardrail
     *  test asserts only the ruling, never {@code chair.text()}. Same proposal shape as
     *  {@link #theChairMayNotAcceptOverASensitiveKill}, this time checking the transcript: the
     *  {@code NOT_FOR_DOSSIER} note label and the system-authored reason must both surface, and
     *  the event must NOT collapse into the aggregate "nothing added" line. */
    @Test
    void aFiredSensitiveGuardrailStaysVisibleInTheChairsTranscript() {
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

        ConferenceTranscriptEnvelope.Turn chair = result.turns().stream()
                .filter(turn -> turn.persona().equals("mezo"))
                .findFirst().orElseThrow();
        assertThat(chair.text()).contains("nem dossziéba való");
        assertThat(chair.text()).contains(SENSITIVE_BLOCKED_REASON);
        assertThat(chair.text()).doesNotContain("nem teszek hozzá");
    }

    /** mezo-lghn task 5 fix round 1, gap 3: every OTHER test in this file runs a single proposal,
     *  so the aggregate line's {@code String.join(", ", ratified)} separator, index ordering, and
     *  interleaving with a genuinely shown line were never exercised in their real multi-proposal
     *  use case. Three proposals in one round: P0 is a dissenting accept (always shown), P1 and P2
     *  both plainly ratify (matching confidence word, no dissent, no note) and must collapse
     *  together into ONE aggregate line — not two, and not inline with P0's line. The {@code \n}
     *  anchor in the negative patterns is deliberate: the aggregate line itself legitimately
     *  contains the substring {@code "P2:"} (inside {@code "P1, P2: ..."} ), so a plain
     *  {@code doesNotContain("P2:")} would be a false failure — only a NEWLINE-prefixed "P2: " is a
     *  genuine standalone per-proposal line. */
    @Test
    void multipleProposalsCollapseTheRatifiedOnesIntoOneAggregateLineAndKeepTheShownOneSeparate() {
        UUID owner = ownerId();
        String skepticSentinel = "[fake-char-skeptic:["
                + "{\"index\":0,\"verdict\":\"KILL\",\"argument\":\"Túlinterpretálás.\"},"
                + "{\"index\":1,\"verdict\":\"KEEP\",\"argument\":\"Rendben.\",\"suggestedConfidence\":0.6},"
                + "{\"index\":2,\"verdict\":\"KEEP\",\"argument\":\"Szintén rendben.\",\"suggestedConfidence\":0.6}"
                + "]]";
        String integratorSentinel = "[fake-char-integrator:{"
                + "\"rulings\":["
                + "{\"index\":0,\"accept\":true,\"confidence\":0.6,"
                + "\"reason\":\"A dossziéban két korábbi mérés is ezt mutatja, amit a Szkeptikus nem látott.\","
                + "\"dissent\":true},"
                + "{\"index\":1,\"accept\":true,\"confidence\":0.6,\"reason\":\"Fake döntés P1.\"},"
                + "{\"index\":2,\"accept\":true,\"confidence\":0.6,\"reason\":\"Fake döntés P2.\"}"
                + "],"
                + "\"chapters\":[]}]";
        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("doki", "NEW", "physical", null, "P0 javaslat.",
                        new BigDecimal("0.60"), false, skepticSentinel),
                new ClaimProposal("doki", "NEW", "physical", null, "P1 javaslat.",
                        new BigDecimal("0.60"), false, "Indoklás P1."),
                new ClaimProposal("doki", "NEW", "physical", null, "P2 javaslat.",
                        new BigDecimal("0.60"), false, integratorSentinel));

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, proposals, List.of());

        ConferenceTranscriptEnvelope.Turn chair = result.turns().stream()
                .filter(turn -> turn.persona().equals("mezo"))
                .findFirst().orElseThrow();
        assertThat(chair.text()).containsPattern("\\nP0: ");
        assertThat(chair.text()).contains(
                "A dossziéban két korábbi mérés is ezt mutatja, amit a Szkeptikus nem látott.");
        assertThat(chair.text()).contains("[a Szkeptikus döntése ellenében]");
        assertThat(chair.text()).contains("P1, P2: a Szkeptikus érvét elfogadom, nem teszek hozzá.");
        assertThat(chair.text()).doesNotContainPattern("\\nP1: ");
        assertThat(chair.text()).doesNotContainPattern("\\nP2: ");
        assertThat(chair.text()).doesNotContain("Fake döntés P1.");
        assertThat(chair.text()).doesNotContain("Fake döntés P2.");
    }

    /** Sibling to {@link #multipleProposalsCollapseTheRatifiedOnesIntoOneAggregateLineAndKeepTheShownOneSeparate}:
     *  when EVERY proposal in a multi-proposal round ratifies, the whole turn is just the header
     *  plus the ONE aggregate line — nothing else. */
    @Test
    void whenEveryProposalRatifiesTheTurnIsJustTheHeaderAndOneAggregateLine() {
        UUID owner = ownerId();
        String skepticSentinel = "[fake-char-skeptic:["
                + "{\"index\":0,\"verdict\":\"KEEP\",\"argument\":\"Rendben.\",\"suggestedConfidence\":0.6},"
                + "{\"index\":1,\"verdict\":\"KEEP\",\"argument\":\"Rendben.\",\"suggestedConfidence\":0.6},"
                + "{\"index\":2,\"verdict\":\"KEEP\",\"argument\":\"Rendben.\",\"suggestedConfidence\":0.6}"
                + "]]";
        String integratorSentinel = "[fake-char-integrator:{"
                + "\"rulings\":["
                + "{\"index\":0,\"accept\":true,\"confidence\":0.6,\"reason\":\"Fake döntés P0.\"},"
                + "{\"index\":1,\"accept\":true,\"confidence\":0.6,\"reason\":\"Fake döntés P1.\"},"
                + "{\"index\":2,\"accept\":true,\"confidence\":0.6,\"reason\":\"Fake döntés P2.\"}"
                + "],"
                + "\"chapters\":[]}]";
        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("doki", "NEW", "physical", null, "P0 javaslat.",
                        new BigDecimal("0.60"), false, skepticSentinel),
                new ClaimProposal("doki", "NEW", "physical", null, "P1 javaslat.",
                        new BigDecimal("0.60"), false, "Indoklás P1."),
                new ClaimProposal("doki", "NEW", "physical", null, "P2 javaslat.",
                        new BigDecimal("0.60"), false, integratorSentinel));

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, proposals, List.of());

        ConferenceTranscriptEnvelope.Turn chair = result.turns().stream()
                .filter(turn -> turn.persona().equals("mezo"))
                .findFirst().orElseThrow();
        assertThat(chair.text()).isEqualTo(
                "Mezo: 3/3 javaslat elfogadva.\nP0, P1, P2: a Szkeptikus érvét elfogadom, nem teszek hozzá.");
    }

    @Test
    void theChairsPromptCarriesTheDossierAndTheSzkeptikusDoesNot() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        seedClaim(owner, dimension.getId(), "MARKER-DOSSZIE-ALLITAS", new BigDecimal("0.60"));
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Új állítás.", new BigDecimal("0.60"), false, "Indoklás.");

        // userMessages() accumulates across the WHOLE shared Spring context for the life of the
        // test JVM (same idiom as completeCallCount() above) — sibling tests in this class also
        // call runIntegrator, which now ALWAYS appends a "Dosszié:" header even for an empty
        // dossier, so a raw hasSize(1) over the full list is order-dependent and was observed to
        // fail when run alongside anOversizedDossierIsCappedAndTheBlockSaysSo. Slice to just the
        // messages THIS run produced, the same before/after idiom used elsewhere in this class.
        int messagesBefore = fakeCompanionLlm.userMessages().size();
        verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());
        List<String> thisRunsMessages = fakeCompanionLlm.userMessages()
                .subList(messagesBefore, fakeCompanionLlm.userMessages().size());

        // The chair is called last, so lastUserMessage() is ITS prompt — it must carry the dossier.
        assertThat(fakeCompanionLlm.lastUserMessage())
                .contains("Dosszié:")
                .contains("MARKER-DOSSZIE-ALLITAS");
        // Exactly ONE of the round's prompts may carry it: the Szkeptikus judges the proposal
        // against its own evidence and must not see the dossier (spec §10).
        assertThat(thisRunsMessages)
                .filteredOn(message -> message.contains("Dosszié:"))
                .hasSize(1);
    }

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

    /** mezo-lghn fix round 1: the two tests above both use NEW proposals (claimId == null), so
     *  {@code targetedClaimDetails}'s per-target loop never runs — this is the covering test for
     *  that half of the dossier block: the targeted claim's confidence-history and user-feedback
     *  lines, with confidence rendered ONLY as a word, never a raw decimal. */
    @Test
    void theChairsPromptCarriesTheTargetedClaimsHistoryAndFeedback() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimConfidenceHistoryEnvelope history = new ClaimConfidenceHistoryEnvelope(List.of(
                new ClaimConfidenceHistoryEnvelope.Point(new BigDecimal("0.40"), "kezdet", Instant.now().minusSeconds(200)),
                new ClaimConfidenceHistoryEnvelope.Point(new BigDecimal("0.60"), "megerősítés", Instant.now())));
        ClaimFeedbackEnvelope feedback = new ClaimFeedbackEnvelope(
                List.of(new ClaimFeedbackEnvelope.Event("TALAL", "egyetértek", Instant.now())));
        CharacterClaimEntity claim = seedClaimWithHistoryAndFeedback(owner, dimension.getId(),
                "Fegyelmezett hét.", new BigDecimal("0.60"), history, feedback);
        ClaimProposal proposal = new ClaimProposal("doki", "UP", null, claim.getId(),
                "Erősítsük meg.", new BigDecimal("0.70"), false, "Negyedik egymást követő hét.");

        verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        // The chair is called last, so lastUserMessage() is ITS prompt.
        assertThat(fakeCompanionLlm.lastUserMessage())
                .contains("bizalom útja")
                // one joined-substring assertion, not two separate contains(): plain contains on
                // each point alone would not pin their relative ORDER, so a pure reversal (which
                // would tell the chair confidence is FALLING when it is actually rising) would
                // still pass (mezo-lghn task 4 drive-by fix).
                .contains("figyeljük (kezdet) → valószínű (megerősítés)")
                .contains("felhasználói visszajelzés")
                .contains("TALAL")
                .contains("egyetértek")
                .doesNotContainPattern("0\\.40|0\\.60");
    }

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
            assertThat(ruling.reason()).isEqualTo(SENSITIVE_BLOCKED_REASON);
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

    /** mezo-lghn fix round 1, item 4: pins the 4-arg compatibility constructor's defaults directly
     *  — mutating any of the three hardcoded defaults (dissent to true, note/suggestedDimensionKey
     *  to a non-null literal) must fail this. No Spring context needed for this one, but the class
     *  stays a single IT so every konzílium-verdict assertion lives together. */
    @Test
    void theFourArgClaimRulingConstructorDefaultsDissentNoteAndDimensionKey() {
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", "physical", null, "text",
                new BigDecimal("0.50"), false, "rationale");

        ClaimRuling ruling = new ClaimRuling(proposal, true, new BigDecimal("0.50"), "reason");

        assertThat(ruling.dissent()).isFalse();
        assertThat(ruling.note()).isNull();
        assertThat(ruling.suggestedDimensionKey()).isNull();
    }

    /** mezo-lghn fix round 1, item 4: a self-declared {@code dissent:true} that actually AGREES
     *  with the Szkeptikus (accept over its own KEEP) must be dropped by {@code contradicts(...)}
     *  — deleting that conjunct in {@code toRuling} left this scenario asserting {@code true} and
     *  passing, since the ONLY other test with {@code dissent:true} declared genuinely contradicts
     *  the verdict, so it can never catch a broken {@code contradicts(...)} on its own. */
    @Test
    void aSelfDeclaredDissentThatActuallyAgreesWithKeepIsDropped() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. "
                        + "[fake-char-skeptic:[{\"index\":0,\"verdict\":\"KEEP\",\"argument\":\"Rendben.\"}]] "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":true,"
                        + "\"confidence\":0.6,\"reason\":\"Egyetértek.\",\"dissent\":true}],\"chapters\":[]}]",
                new BigDecimal("0.60"), false, "Három heti mérés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement().satisfies(ruling -> {
            assertThat(ruling.accepted()).isTrue();
            assertThat(ruling.dissent()).isFalse();
        });
    }

    /** mezo-lghn fix round 1, item 4: a model-invented note outside {@code VALID_NOTES} must not
     *  reach {@code ClaimRuling.note()} — deleting the {@code VALID_NOTES.contains(...)} check
     *  left this bogus value flowing straight through. */
    @Test
    void anUnknownNoteFromTheChairIsDropped() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":false,"
                        + "\"reason\":\"Nem indokolt.\",\"note\":\"BOGUS_NOTE\"}],\"chapters\":[]}]",
                new BigDecimal("0.60"), false, "Indoklás.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement()
                .satisfies(ruling -> assertThat(ruling.note()).isNull());
    }

    /** mezo-lghn fix round 1, item 4: a REHOME note's suggestedDimensionKey must survive onto the
     *  ruling — the {@code "REHOME".equals(note)} gate was previously exercised by nothing at all. */
    @Test
    void aRehomeNoteCarriesItsSuggestedDimensionKey() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":false,"
                        + "\"reason\":\"Inkább a mentális dimenzióba illik.\",\"note\":\"REHOME\","
                        + "\"suggestedDimensionKey\":\"mental\"}],\"chapters\":[]}]",
                new BigDecimal("0.60"), false, "Indoklás.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement().satisfies(ruling -> {
            assertThat(ruling.note()).isEqualTo("REHOME");
            assertThat(ruling.suggestedDimensionKey()).isEqualTo("mental");
        });
    }

    /** Sibling to {@link #aRehomeNoteCarriesItsSuggestedDimensionKey}: a suggestedDimensionKey
     *  attached to a NON-REHOME note must be dropped — the model naming a dimension is only
     *  meaningful alongside REHOME. */
    @Test
    void aSuggestedDimensionKeyIsDroppedWhenTheNoteIsNotRehome() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "physical", "doki");
        ClaimProposal proposal = new ClaimProposal("doki", "NEW", dimension.getKey(), null,
                "Rekompozíció zajlik. "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":false,"
                        + "\"reason\":\"Ezt már tartjuk.\",\"note\":\"DUPLICATE\","
                        + "\"suggestedDimensionKey\":\"mental\"}],\"chapters\":[]}]",
                new BigDecimal("0.60"), false, "Indoklás.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement().satisfies(ruling -> {
            assertThat(ruling.note()).isEqualTo("DUPLICATE");
            assertThat(ruling.suggestedDimensionKey()).isNull();
        });
    }

    /** mezo-lghn fix round 1, item 1 (the critical one): a BROKEN Szkeptikus round (unparseable
     *  JSON, not merely blank) leaves {@code verdicts} genuinely empty — {@code verdict == null}
     *  for the sensitive proposal's index. Before the fix, {@code sensitiveKill} required a
     *  non-null verdict AND a literal KILL, so silence sailed straight through as an accept; the
     *  guardrail must now block it exactly as it blocks an explicit KILL. */
    @Test
    void aSensitiveAcceptIsBlockedWhenTheSkepticRoundNeverAnswered() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "mental", "pszichologus");
        // matching brackets so the sentinel regex matches, but invalid JSON syntax inside — forces
        // the catch-and-log parse-failure path, so skepticResult.verdicts() is genuinely EMPTY
        // (not the canned fallback, which would answer KEEP for every P<n> it finds).
        String brokenSkepticSentinel = "[fake-char-skeptic:[{\"index\":0,\"verdict\":}]]";
        ClaimProposal proposal = new ClaimProposal("pszichologus", "NEW", dimension.getKey(), null,
                "Belső feszültség. " + brokenSkepticSentinel + " "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":true,"
                        + "\"confidence\":0.6,\"reason\":\"Felveszem.\"}],\"chapters\":[]}]",
                new BigDecimal("0.60"), true, "Egy megfigyelés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement().satisfies(ruling -> {
            assertThat(ruling.accepted()).isFalse();
            assertThat(ruling.note()).isEqualTo("NOT_FOR_DOSSIER");
            assertThat(ruling.reason()).isEqualTo(SENSITIVE_BLOCKED_REASON);
        });
        claimLifecycle.apply(owner, UUID.randomUUID(), result.rulings());
        assertThat(claimRepository.findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(
                owner, dimension.getId(), "ACTIVE")).isEmpty();
    }

    /** mezo-lghn fix round 1, item 3: RETIRE always makes a claim LESS present in the dossier, so
     *  the sensitive-write guardrail must never touch it — even sensitive, even over an explicit
     *  KILL. Before the fix the guardrail keyed on accept/reject alone, so this accept was wrongly
     *  dropped and stamped {@code NOT_FOR_DOSSIER} — a note whose plain meaning is the OPPOSITE of
     *  what actually happens on a retire (the claim leaves the dossier either way). */
    @Test
    void aSensitiveRetireAcceptPassesThroughEvenOverAKill() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "mental", "pszichologus");
        CharacterClaimEntity claim = seedClaim(owner, dimension.getId(), "Érzékeny állítás.", new BigDecimal("0.60"));
        ClaimProposal proposal = new ClaimProposal("pszichologus", "RETIRE", null, claim.getId(),
                "Már nem releváns. "
                        + "[fake-char-skeptic:[{\"index\":0,\"verdict\":\"KILL\","
                        + "\"argument\":\"Túlinterpretálás.\"}]] "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":true,"
                        + "\"reason\":\"Nyugdíjazom.\"}],\"chapters\":[]}]",
                new BigDecimal("0.60"), true, "Indoklás.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement().satisfies(ruling -> {
            assertThat(ruling.accepted()).isTrue();
            assertThat(ruling.note()).isNotEqualTo("NOT_FOR_DOSSIER");
        });
        List<ConferenceOutcomeEnvelope.Change> changes =
                claimLifecycle.apply(owner, UUID.randomUUID(), result.rulings());
        assertThat(changes).singleElement().satisfies(c -> assertThat(c.kind()).isEqualTo("CLAIM_RETIRED"));
    }

    /** mezo-lghn fix round 2, item 1: an {@code UP} is a STRENGTHENING kind (it raises an existing
     *  claim's confidence), so — unlike the {@code RETIRE} sibling above — the guardrail must
     *  engage for it exactly like it does for {@code NEW}. Before this round's fix, the kind check
     *  only named {@code NEW} and {@code UP} explicitly but was never exercised for {@code UP} by
     *  any test, so deleting the {@code UP} half silently reopened this hole. */
    @Test
    void aSensitiveUpAcceptIsBlockedOverAKill() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "mental", "pszichologus");
        CharacterClaimEntity claim = seedClaim(owner, dimension.getId(), "Érzékeny állítás.", new BigDecimal("0.50"));
        ClaimProposal proposal = new ClaimProposal("pszichologus", "UP", null, claim.getId(),
                "Erősödik. "
                        + "[fake-char-skeptic:[{\"index\":0,\"verdict\":\"KILL\","
                        + "\"argument\":\"Túlinterpretálás.\"}]] "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":true,"
                        + "\"confidence\":0.7,\"reason\":\"Mégis erősítem.\"}],\"chapters\":[]}]",
                new BigDecimal("0.70"), true, "Indoklás.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement().satisfies(ruling -> {
            assertThat(ruling.accepted()).isFalse();
            assertThat(ruling.note()).isEqualTo("NOT_FOR_DOSSIER");
            assertThat(ruling.reason()).isEqualTo(SENSITIVE_BLOCKED_REASON);
        });
        claimLifecycle.apply(owner, UUID.randomUUID(), result.rulings());
        CharacterClaimEntity unchanged = claimRepository.findById(claim.getId()).orElseThrow();
        assertThat(unchanged.getConfidence()).isEqualByComparingTo(new BigDecimal("0.50"));
    }

    /** mezo-lghn fix round 2, item 2: {@code lacksSensitiveClearance} must be an ALLOWLIST
     *  (only KEEP/WEAKEN clear a sensitive accept), not a denylist (only KILL blocks one) — a
     *  denylist would treat any unrecognized grade as clearance. Neither the round-1 null-verdict
     *  test nor the explicit-KILL test can catch a regression back to a denylist, since both of
     *  those still block under EITHER shape. This is the test that actually pins the allowlist. */
    @Test
    void aSensitiveAcceptIsBlockedWhenTheSkepticGaveAnUnrecognizedGrade() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "mental", "pszichologus");
        ClaimProposal proposal = new ClaimProposal("pszichologus", "NEW", dimension.getKey(), null,
                "Belső feszültség. "
                        + "[fake-char-skeptic:[{\"index\":0,\"verdict\":\"BOGUS\","
                        + "\"argument\":\"Nem egyértelmű.\"}]] "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":true,"
                        + "\"confidence\":0.6,\"reason\":\"Felveszem.\"}],\"chapters\":[]}]",
                new BigDecimal("0.60"), true, "Egy megfigyelés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement().satisfies(ruling -> {
            assertThat(ruling.accepted()).isFalse();
            assertThat(ruling.note()).isEqualTo("NOT_FOR_DOSSIER");
        });
    }

    /** Sibling to {@link #aSensitiveAcceptIsBlockedWhenTheSkepticGaveAnUnrecognizedGrade}: a
     *  lowercase {@code "kill"} must ALSO fail to clear (it is not a literal {@code KEEP}/
     *  {@code WEAKEN} match either) — cheap extra coverage the re-review asked for. */
    @Test
    void aSensitiveAcceptIsBlockedWhenTheSkepticGaveALowercaseKill() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "mental", "pszichologus");
        ClaimProposal proposal = new ClaimProposal("pszichologus", "NEW", dimension.getKey(), null,
                "Belső feszültség. "
                        + "[fake-char-skeptic:[{\"index\":0,\"verdict\":\"kill\","
                        + "\"argument\":\"Túlinterpretálás.\"}]] "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":true,"
                        + "\"confidence\":0.6,\"reason\":\"Felveszem.\"}],\"chapters\":[]}]",
                new BigDecimal("0.60"), true, "Egy megfigyelés.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement().satisfies(ruling -> {
            assertThat(ruling.accepted()).isFalse();
            assertThat(ruling.note()).isEqualTo("NOT_FOR_DOSSIER");
        });
    }

    /** mezo-lghn fix round 3, item 1 + item 3: a sensitive DOWN is EXEMPT from the guardrail — it
     *  weakens the dossier, so it may be accepted even over a KILL — but the exemption's premise
     *  ("DOWN weakens") is not automatically true: {@code ClaimLifecycle.applyMove} writes the
     *  chair's own confidence AS-IS whenever it is non-null, and steps -0.10 off the CURRENT value
     *  only when it is null. Without the round-3 force-to-null fix, this exact scenario (a
     *  sensitive DOWN, KILLed, accepted with an inflated 0.90) would silently STRENGTHEN a claim
     *  sitting at 0.50 — the very strengthening the guardrail exists to stop, reached through the
     *  DOWN exemption meant to be safe by construction. This test pins BOTH halves at once: the
     *  exemption itself (accepted stays true — deleting the {@code DOWN_KIND} disjunct from
     *  {@code weakensDossier} would flip this to false) and the force-to-null fix (the final
     *  confidence is the lifecycle's own -0.10 step, 0.40, never the chair's 0.90). */
    @Test
    void aSensitiveDownAcceptOverAKillIgnoresTheChairsInflatedConfidence() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "mental", "pszichologus");
        CharacterClaimEntity claim = seedClaim(owner, dimension.getId(), "Érzékeny állítás.", new BigDecimal("0.50"));
        ClaimProposal proposal = new ClaimProposal("pszichologus", "DOWN", null, claim.getId(),
                "Gyengítsük. "
                        + "[fake-char-skeptic:[{\"index\":0,\"verdict\":\"KILL\","
                        + "\"argument\":\"Túlinterpretálás.\"}]] "
                        + "[fake-char-integrator:{\"rulings\":[{\"index\":0,\"accept\":true,"
                        + "\"confidence\":0.9,\"reason\":\"Mégis gyengítem, de magasra teszem.\"}],"
                        + "\"chapters\":[]}]",
                new BigDecimal("0.50"), true, "Indoklás.");

        KonziliumVerdictRound.Result result =
                verdictRound.run(owner, WEEK_START, List.of(proposal), List.of());

        assertThat(result.rulings()).singleElement()
                .satisfies(ruling -> assertThat(ruling.accepted()).isTrue());
        claimLifecycle.apply(owner, UUID.randomUUID(), result.rulings());
        CharacterClaimEntity updated = claimRepository.findById(claim.getId()).orElseThrow();
        assertThat(updated.getConfidence()).isEqualByComparingTo(new BigDecimal("0.40")); // 0.50 - 0.10 step
    }
}

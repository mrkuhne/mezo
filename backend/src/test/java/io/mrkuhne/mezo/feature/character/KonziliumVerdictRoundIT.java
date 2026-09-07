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
}

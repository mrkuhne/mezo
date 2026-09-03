package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CharacterClaimDto;
import io.mrkuhne.mezo.api.dto.CharacterClaimFeedbackRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationDimensionKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationSignalsEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterConferenceService;
import io.mrkuhne.mezo.feature.character.service.CharacterFeedbackService;
import io.mrkuhne.mezo.feature.character.service.ClaimProposal;
import io.mrkuhne.mezo.feature.character.service.KonziliumProposalRound;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * IT for routing Daniel's answers into the konzílium (Karakter S6 spec §6, mezo-1gim.10): before
 * this fix, {@code KonziliumProposalRound} grouped observations by {@code expertKey} and resolved
 * each group through {@link io.mrkuhne.mezo.feature.character.service.CharacterExpertCatalog#byKey},
 * which THROWS for {@link CharacterFeedbackService#USER_EXPERT_KEY} ("user") — so a feedback
 * observation was logged and then silently skipped by every konzílium. This IT proves a
 * user-feedback observation is instead routed to the expert(s) owning the dimension(s) it names
 * (CORE -> that dimension's expert; CHAPTER/unknown -> {@code drill}), carries the
 * "FELHASZNÁLÓ VÁLASZA —" authorship prefix in the expert's evidence, still triggers a turn even when
 * it is an expert's ONLY evidence, and is genuinely consumed end to end by a real weekly run.
 */
@ActiveProfiles("companion-fake")
class KonziliumUserFeedbackIT extends ApiIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 8, 24); // ISO Monday

    @Autowired private KonziliumProposalRound proposalRound;
    @Autowired private CharacterConferenceService conferenceService;
    @Autowired private CharacterObservationRepository observationRepository;
    @Autowired private CharacterDimensionRepository dimensionRepository;
    @Autowired private CharacterClaimRepository claimRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    /** Seeds a bare user-feedback observation (expertKey = "user") naming the given dimension
     *  key(s) — mirrors what {@link CharacterFeedbackService#apply} itself writes, without going
     *  through the HTTP endpoint (cases a/b/c only need the observation shape, not the claim it
     *  answers; case d exercises the real endpoint end to end). */
    private CharacterObservationEntity seedUserObservation(UUID owner, LocalDate day, String text,
                                                            short salience, List<String> dimensionKeys) {
        CharacterObservationEntity entity = new CharacterObservationEntity();
        entity.setCreatedBy(owner);
        entity.setExpertKey(CharacterFeedbackService.USER_EXPERT_KEY);
        entity.setDimensionKeys(new ObservationDimensionKeysEnvelope(dimensionKeys));
        entity.setDay(day);
        entity.setText(text);
        entity.setSalience(salience);
        entity.setSignals(new ObservationSignalsEnvelope(List.of(
                new ObservationSignalsEnvelope.Signal(CharacterFeedbackService.SIGNAL_KEY, text, List.of()))));
        return observationRepository.save(entity);
    }

    private CharacterDimensionEntity seedChapterDimension(UUID owner, String key) {
        CharacterDimensionEntity entity = new CharacterDimensionEntity();
        entity.setCreatedBy(owner);
        entity.setKey(key);
        entity.setTitle("Egy fejezet");
        entity.setKind("CHAPTER");
        entity.setExpertKey(null);
        return dimensionRepository.save(entity);
    }

    private List<CharacterObservationEntity> weekObservations(UUID owner) {
        return observationRepository
                .findByCreatedByAndDayBetweenAndConsumedByConferenceIdIsNullOrderByDayAscCreatedAtAsc(
                        owner, WEEK_START, WEEK_START.plusDays(6));
    }

    @Test
    void userObservation_namingCoreDimension_routesToOwningExpert_withUserPrefix() {
        UUID owner = ownerId();
        String text = "Cáfolat: rendszeresen kihagyja a naplózást. " + FakeCompanionLlm.CHAR_PROPOSALS_ECHO;
        seedUserObservation(owner, WEEK_START.plusDays(1), text, (short) 5, List.of("discipline"));

        KonziliumProposalRound.Result result = proposalRound.run(owner, WEEK_START, weekObservations(owner));

        // routed to "drill" (discipline's owning expert per CharacterCoreCatalog) — NOT a "user" group
        assertThat(result.proposals()).singleElement()
                .satisfies(p -> assertThat(p.expertKey()).isEqualTo("drill"));
        assertThat(result.turns()).singleElement()
                .satisfies(t -> assertThat(t.persona()).isEqualTo("drill"));
        // the echoed rationale is the FULL assembled user message — proves the evidence line
        // Drill actually saw carries the authorship prefix in front of Daniel's own text
        assertThat(result.proposals()).singleElement()
                .satisfies(p -> assertThat(p.rationale())
                        .contains("FELHASZNÁLÓ VÁLASZA — Cáfolat: rendszeresen kihagyja a naplózást."));
        assertThat(result.proposals()).singleElement()
                .satisfies(p -> assertThat(p.rationale()).doesNotContain("DANIEL VÁLASZA").doesNotContain("{{NÉV}}"));
    }

    @Test
    void userObservation_namingChapterDimension_routesToDrillFallback() {
        UUID owner = ownerId();
        CharacterDimensionEntity chapter = seedChapterDimension(owner, "kapcsolat_egy_kolleganoval");
        seedUserObservation(owner, WEEK_START.plusDays(2), "Pontosítás egy fejezethez.",
                (short) 5, List.of(chapter.getKey()));

        KonziliumProposalRound.Result result = proposalRound.run(owner, WEEK_START, weekObservations(owner));

        assertThat(result.proposals()).singleElement()
                .satisfies(p -> assertThat(p.expertKey()).isEqualTo("drill"));
        assertThat(result.turns()).singleElement()
                .satisfies(t -> assertThat(t.persona()).isEqualTo("drill"));
    }

    @Test
    void expertWithOnlyUserFeedbackEvidence_stillProducesATurn() {
        UUID owner = ownerId();
        // "nutrition" is a CORE dimension owned by "taplalkozo" — no OTHER observation for it.
        seedUserObservation(owner, WEEK_START.plusDays(3), "A felhasználó megerősítette a táplálkozási állítást.",
                (short) 3, List.of("nutrition"));

        KonziliumProposalRound.Result result = proposalRound.run(owner, WEEK_START, weekObservations(owner));

        assertThat(result.turns()).singleElement()
                .satisfies(t -> assertThat(t.persona()).isEqualTo("taplalkozo"));
        assertThat(result.proposals()).singleElement()
                .satisfies(p -> assertThat(p.expertKey()).isEqualTo("taplalkozo"));
    }

    @Test
    void feedbackEndpoint_thenWeeklyRun_daniel_sAnswerIsConsumedByTheConference() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = new CharacterDimensionEntity();
        dimension.setCreatedBy(owner);
        dimension.setKey("discipline");
        dimension.setTitle("Fegyelem");
        dimension.setKind("CORE");
        dimension.setExpertKey("drill");
        dimension = dimensionRepository.save(dimension);

        CharacterClaimEntity claim = new CharacterClaimEntity();
        claim.setCreatedBy(owner);
        claim.setDimensionId(dimension.getId());
        claim.setText("Rendszeresen kihagyja a reggeli naplózást.");
        claim.setConfidence(new BigDecimal("0.50"));
        claim.setStatus("ACTIVE");
        claim.setProposedBy("drill");
        claim.setEvidence(new ClaimEvidenceEnvelope(List.of()));
        claim.setSensitive(false);
        claim.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        claim.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(List.of()));
        claim = claimRepository.save(claim);

        HttpHeaders headers = ownerAuthHeaders();
        postForBody("/api/character/claim/" + claim.getId() + "/feedback",
                CharacterClaimFeedbackRequest.builder().kind(CharacterClaimFeedbackRequest.KindEnum.TALAL).build(),
                headers, HttpStatus.OK, CharacterClaimDto.class);

        List<CharacterObservationEntity> before = observationRepository.findAll().stream()
                .filter(o -> o.getCreatedBy().equals(owner)).toList();
        assertThat(before).singleElement()
                .satisfies(o -> assertThat(o.getExpertKey()).isEqualTo(CharacterFeedbackService.USER_EXPERT_KEY));

        // the observation's day is LocalDate.now() (CharacterFeedbackService writes "today") — run
        // the weekly konzílium for the ISO Monday of the CURRENT week so it is genuinely gathered.
        LocalDate today = LocalDate.now();
        LocalDate currentWeekStart = today.minus(today.getDayOfWeek().getValue() - 1, ChronoUnit.DAYS);
        CharacterConferenceEntity conference = conferenceService.runWeekly(owner, currentWeekStart);

        assertThat(conference).isNotNull();
        CharacterObservationEntity after = observationRepository.findById(before.get(0).getId()).orElseThrow();
        assertThat(after.getConsumedByConferenceId()).isEqualTo(conference.getId());
    }

    // proves the fake's proposal-branch marker constants haven't drifted from the real ones — the
    // sibling KonziliumProposalRoundIT already pins PROPOSAL_MARKER_MIRROR itself; this just
    // documents that ClaimProposal is the type the round hands back for the assertions above.
    @Test
    void claimProposal_expertKey_isTheROUTEDExpert_notTheOriginalUserKey() {
        UUID owner = ownerId();
        seedUserObservation(owner, WEEK_START.plusDays(1), "Sima megerősítés.", (short) 3, List.of("discipline"));

        KonziliumProposalRound.Result result = proposalRound.run(owner, WEEK_START, weekObservations(owner));

        assertThat(result.proposals()).extracting(ClaimProposal::expertKey)
                .doesNotContain(CharacterFeedbackService.USER_EXPERT_KEY);
    }
}

package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterMonthlyService;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * IT for the monthly deep-read konzílium (Karakter S4, mezo-1gim.6): the honest empty state (no
 * ACTIVE claims -> null, no rows), the canned end-to-end happy path (MONTHLY conference row keyed
 * on {@code monthStart}, transcript personas, claim transitions applied, portraits rewritten),
 * idempotency, chapter retirement (CHAPTER only, CORE untouched), and an accepted RETIRE ruling
 * actually flipping a claim to RETIRED.
 */
@ActiveProfiles("companion-fake")
class CharacterMonthlyServiceIT extends ApiIntegrationTest {

    private static final LocalDate MONTH_START = LocalDate.of(2026, 8, 1);

    @Autowired private CharacterMonthlyService monthlyService;
    @Autowired private CharacterConferenceRepository conferenceRepository;
    @Autowired private CharacterDimensionRepository dimensionRepository;
    @Autowired private CharacterClaimRepository claimRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private CharacterDimensionEntity seedDimension(UUID owner, String key, String kind, String expertKey) {
        CharacterDimensionEntity entity = new CharacterDimensionEntity();
        entity.setCreatedBy(owner);
        entity.setKey(key);
        entity.setTitle(key);
        entity.setKind(kind);
        entity.setExpertKey(expertKey);
        return dimensionRepository.save(entity);
    }

    private CharacterClaimEntity seedClaim(UUID owner, UUID dimensionId, String text, BigDecimal confidence,
                                            String proposedBy) {
        CharacterClaimEntity entity = new CharacterClaimEntity();
        entity.setCreatedBy(owner);
        entity.setDimensionId(dimensionId);
        entity.setText(text);
        entity.setConfidence(confidence);
        entity.setStatus("ACTIVE");
        entity.setProposedBy(proposedBy);
        entity.setEvidence(new ClaimEvidenceEnvelope(List.of()));
        entity.setSensitive(false);
        entity.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        entity.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(
                List.of(new ClaimConfidenceHistoryEnvelope.Point(confidence, "kezdet", Instant.now()))));
        return claimRepository.save(entity);
    }

    @Test
    void markers_mirroredInFakeLlm_stayInSync() {
        assertThat(FakeCompanionLlm.MONTHLY_MARKER_MIRROR).isEqualTo(CharacterMonthlyService.MONTHLY_MARKER);
    }

    @Test
    void run_noActiveClaims_returnsNull_noRows() {
        UUID owner = ownerId();

        CharacterConferenceEntity result = monthlyService.run(owner, MONTH_START);

        assertThat(result).isNull();
        assertThat(conferenceRepository.findByCreatedByAndKindAndWeekStart(owner, "MONTHLY", MONTH_START)).isEmpty();
    }

    @Test
    void run_cannedEndToEnd_persistsMonthlyConference_claimsAndPortraits() {
        UUID owner = ownerId();
        CharacterDimensionEntity discipline = seedDimension(owner, "discipline", "CORE", "drill");
        seedClaim(owner, discipline.getId(), "Régóta nem loggol reggelente.", new BigDecimal("0.55"), "drill");

        CharacterConferenceEntity conference = monthlyService.run(owner, MONTH_START);

        assertThat(conference).isNotNull();
        assertThat(conference.getKind()).isEqualTo("MONTHLY");
        assertThat(conference.getWeekStart()).isEqualTo(MONTH_START);

        assertThat(conference.getTranscript().turns())
                .extracting(ConferenceTranscriptEnvelope.Turn::persona)
                .contains("drill", "szkeptikus", "mezo");

        // final-review Finding M4: the monthly transcript re-reads ACTIVE claims, not a week's
        // observations — the drill turn must say so honestly, never the weekly "hét" phrasing.
        assertThat(conference.getTranscript().turns())
                .filteredOn(t -> "drill".equals(t.persona()))
                .singleElement()
                .satisfies(t -> {
                    assertThat(t.text()).contains("aktív állításból");
                    assertThat(t.text()).doesNotContain("hét").doesNotContain("megfigyeléséből");
                });

        assertThat(claimRepository.findByCreatedByAndStatusOrderByConfidenceDesc(owner, "ACTIVE")).isNotEmpty();

        CharacterDimensionEntity refreshed =
                dimensionRepository.findByCreatedByAndKey(owner, "discipline").orElseThrow();
        assertThat(refreshed.getPortrait()).isNotBlank();
        assertThat(refreshed.getVersion()).isGreaterThanOrEqualTo(1);

        assertThat(conference.getOutcome().changes()).extracting(ConferenceOutcomeEnvelope.Change::kind)
                .contains("CLAIM_ACCEPTED", "PORTRAIT_REWRITTEN");
    }

    @Test
    void run_secondCallSameMonth_isIdempotent_returnsSameRow_addsNothing() {
        UUID owner = ownerId();
        CharacterDimensionEntity discipline = seedDimension(owner, "discipline", "CORE", "drill");
        seedClaim(owner, discipline.getId(), "Régóta nem loggol reggelente.", new BigDecimal("0.55"), "drill");

        CharacterConferenceEntity first = monthlyService.run(owner, MONTH_START);
        int claimsAfterFirst = claimRepository.findByCreatedByAndStatusOrderByConfidenceDesc(owner, "ACTIVE").size();

        CharacterConferenceEntity second = monthlyService.run(owner, MONTH_START);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(claimRepository.findByCreatedByAndStatusOrderByConfidenceDesc(owner, "ACTIVE"))
                .hasSize(claimsAfterFirst);
        assertThat(conferenceRepository.findByCreatedByOrderByGeneratedAtDesc(owner))
                .filteredOn(s -> "MONTHLY".equals(s.getKind()))
                .hasSize(1);
    }

    @Test
    void run_staleEmptyChapter_isRetired_coreDimensionInSameStateIsUntouched() {
        UUID owner = ownerId();
        // an ACTIVE claim elsewhere is required so the monthly round has evidence to act on at all
        CharacterDimensionEntity discipline = seedDimension(owner, "discipline", "CORE", "drill");
        seedClaim(owner, discipline.getId(), "Friss állítás.", new BigDecimal("0.55"), "drill");

        CharacterDimensionEntity chapter = seedDimension(owner, "regi-fejezet", "CHAPTER", null);
        chapter.setUpdatedAt(Instant.now().minus(120, ChronoUnit.DAYS));
        dimensionRepository.save(chapter);

        CharacterDimensionEntity staleCore = seedDimension(owner, "recovery", "CORE", "szomnologus");
        staleCore.setUpdatedAt(Instant.now().minus(120, ChronoUnit.DAYS));
        dimensionRepository.save(staleCore);

        CharacterConferenceEntity conference = monthlyService.run(owner, MONTH_START);

        assertThat(conference).isNotNull();
        assertThat(dimensionRepository.findByCreatedByAndKey(owner, "regi-fejezet")).isEmpty();
        assertThat(dimensionRepository.findByCreatedByAndKey(owner, "recovery")).isPresent();

        assertThat(conference.getOutcome().changes())
                .anySatisfy(c -> {
                    assertThat(c.kind()).isEqualTo("CHAPTER_RETIRED");
                    assertThat(c.dimensionKey()).isEqualTo("regi-fejezet");
                });
    }

    @Test
    void run_retireRulingAcceptedThroughIntegrator_flipsClaimToRetired() {
        UUID owner = ownerId();
        // A CORE dimension's own claim — the primary path (fix round 1, mezo-1gim.6): now that
        // CharacterMonthlyService calls runOnEvidence with includeActiveClaimsTrailer=false, the
        // proposal round's "Meglévő aktív állítások" trailer is omitted entirely for the monthly
        // caller, so this claim's sentinel-bearing text is rendered exactly ONCE in the user
        // message (previously a CORE dimension's claim was duplicated into that trailer too, which
        // broke the fake LLM's greedy sentinel regex — see git history for the CHAPTER workaround
        // this replaces).
        CharacterDimensionEntity discipline = seedDimension(owner, "discipline", "CORE", "drill");
        CharacterClaimEntity claim =
                seedClaim(owner, discipline.getId(), "placeholder", new BigDecimal("0.55"), "drill");
        claim.setText("Elavult megfigyelés. [fake-char-proposals:[{\"kind\":\"RETIRE\",\"claimId\":\""
                + claim.getId() + "\",\"text\":\"Már nem támasztja alá az adat.\",\"confidence\":0.1,"
                + "\"sensitive\":false,\"rationale\":\"stale\"}]]");
        claimRepository.save(claim);

        CharacterConferenceEntity conference = monthlyService.run(owner, MONTH_START);

        assertThat(conference).isNotNull();
        CharacterClaimEntity refreshed = claimRepository.findById(claim.getId()).orElseThrow();
        assertThat(refreshed.getStatus()).isEqualTo("RETIRED");
        assertThat(conference.getOutcome().changes()).extracting(ConferenceOutcomeEnvelope.Change::kind)
                .contains("CLAIM_RETIRED");
    }
}

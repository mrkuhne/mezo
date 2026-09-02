package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationDimensionKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationSignalsEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterExpertCatalog;
import io.mrkuhne.mezo.feature.character.service.KonziliumProposalRound;
import io.mrkuhne.mezo.feature.character.service.ClaimProposal;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * IT for the weekly konzílium proposal round (mezo-1gim.5): per-expert grouping, one turn per
 * expert, sentinel-scripted proposal validation/clamping, and unknown-expert isolation.
 */
@ActiveProfiles("companion-fake")
class KonziliumProposalRoundIT extends ApiIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 8, 24); // ISO Monday

    @Autowired private KonziliumProposalRound proposalRound;
    @Autowired private CharacterObservationRepository observationRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private void seedObservation(UUID owner, String expertKey, LocalDate day, String text, short salience) {
        CharacterExpertCatalog.Expert expert = CharacterExpertCatalog.byKey(expertKey);
        CharacterObservationEntity entity = new CharacterObservationEntity();
        entity.setCreatedBy(owner);
        entity.setExpertKey(expertKey);
        entity.setDimensionKeys(new ObservationDimensionKeysEnvelope(List.of(expert.primaryDimensionKey())));
        entity.setDay(day);
        entity.setText(text);
        entity.setSalience(salience);
        entity.setSignals(new ObservationSignalsEnvelope(List.of()));
        observationRepository.save(entity);
    }

    /** Seeds a bare observation for an unknown expert key — byKey() would throw, so this bypasses
     *  the catalog lookup the normal seedObservation helper does. */
    private void seedRawObservation(UUID owner, String expertKey, LocalDate day, String text, short salience) {
        CharacterObservationEntity entity = new CharacterObservationEntity();
        entity.setCreatedBy(owner);
        entity.setExpertKey(expertKey);
        entity.setDimensionKeys(new ObservationDimensionKeysEnvelope(List.of("discipline")));
        entity.setDay(day);
        entity.setText(text);
        entity.setSalience(salience);
        entity.setSignals(new ObservationSignalsEnvelope(List.of()));
        observationRepository.save(entity);
    }

    @Test
    void marker_mirroredInFakeLlm_staysInSync() {
        assertThat(FakeCompanionLlm.PROPOSAL_MARKER_MIRROR).isEqualTo(KonziliumProposalRound.PROPOSAL_MARKER);
    }

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

        KonziliumProposalRound.Result result = proposalRound.run(owner, WEEK_START,
                observationRepository.findByCreatedByAndDayBetweenAndConsumedByConferenceIdIsNullOrderByDayAscCreatedAtAsc(
                        owner, WEEK_START, WEEK_START.plusDays(6)));

        assertThat(result.proposals()).singleElement().satisfies(p -> {
            assertThat(p.dimensionKey()).isEqualTo("discipline");
            assertThat(p.confidence()).isEqualByComparingTo(new BigDecimal("0.62"));
            assertThat(p.expertKey()).isEqualTo("drill");
        });
    }

    @Test
    void run_unknownExpertKey_skipsOnlyThatExpert() {
        UUID owner = ownerId();
        seedRawObservation(owner, "nonsense-expert", WEEK_START.plusDays(1), "Árva megfigyelés.", (short) 3);
        seedObservation(owner, "drill", WEEK_START.plusDays(2), "Valódi jel.", (short) 4);

        KonziliumProposalRound.Result result = proposalRound.run(owner, WEEK_START,
                observationRepository.findByCreatedByAndDayBetweenAndConsumedByConferenceIdIsNullOrderByDayAscCreatedAtAsc(
                        owner, WEEK_START, WEEK_START.plusDays(6)));

        assertThat(result.proposals()).extracting(ClaimProposal::expertKey).containsExactly("drill");
    }

    @Test
    void run_szkeptikusObservation_proposesIntoTheSelfAuditDimension() {
        UUID owner = ownerId();
        seedObservation(owner, "szkeptikus", WEEK_START.plusDays(2), "A predikcióim közül 4-ből 1 talált.", (short) 4);

        KonziliumProposalRound.Result result = proposalRound.run(owner, WEEK_START,
                observationRepository.findByCreatedByAndDayBetweenAndConsumedByConferenceIdIsNullOrderByDayAscCreatedAtAsc(
                        owner, WEEK_START, WEEK_START.plusDays(6)));

        assertThat(result.proposals()).singleElement().satisfies(p -> {
            assertThat(p.expertKey()).isEqualTo("szkeptikus");
            assertThat(p.dimensionKey()).isEqualTo("self-audit");
        });
    }
}

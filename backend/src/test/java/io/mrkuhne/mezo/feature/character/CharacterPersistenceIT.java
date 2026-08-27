package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterPortraitRevisionEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationSignalsEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterPortraitRevisionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

class CharacterPersistenceIT extends AbstractIntegrationTest {

    @Autowired
    private CharacterDimensionRepository dimensionRepository;

    @Autowired
    private CharacterClaimRepository claimRepository;

    @Autowired
    private CharacterObservationRepository observationRepository;

    @Autowired
    private CharacterConferenceRepository conferenceRepository;

    @Autowired
    private CharacterPortraitRevisionRepository revisionRepository;

    @Autowired
    private DatabasePopulator databasePopulator;

    @Autowired
    private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void dimensionClaimObservationConferenceRevision_roundTripWithEnvelopes() {
        UUID owner = ownerId();

        CharacterDimensionEntity dim = new CharacterDimensionEntity();
        dim.setCreatedBy(owner);
        dim.setKey("discipline");
        dim.setTitle("Motiváció & fegyelem");
        dim.setKind("CORE");
        dim.setExpertKey("drill");
        dim = dimensionRepository.save(dim);
        assertThat(dim.getPortrait()).isEmpty();
        assertThat(dim.getMaturity()).isZero();

        CharacterConferenceEntity conf = new CharacterConferenceEntity();
        conf.setCreatedBy(owner);
        conf.setKind("WEEKLY");
        conf.setWeekStart(LocalDate.of(2026, 8, 24));
        conf.setTranscript(new ConferenceTranscriptEnvelope(List.of(
                new ConferenceTranscriptEnvelope.Turn("drill", "A héten 3 nap üres kajanapló.", List.of()))));
        conf.setOutcome(new ConferenceOutcomeEnvelope(List.of(
                new ConferenceOutcomeEnvelope.Change("CLAIM_ACCEPTED", "discipline", null, "Új claim."))));
        conf.setGeneratedAt(Instant.now());
        conf = conferenceRepository.save(conf);

        CharacterClaimEntity claim = new CharacterClaimEntity();
        claim.setCreatedBy(owner);
        claim.setDimensionId(dim.getId());
        claim.setText("Stresszes hetekben elmarad a kajalogolás.");
        claim.setConfidence(new BigDecimal("0.60"));
        claim.setStatus("ACTIVE");
        claim.setOriginConferenceId(conf.getId());
        claim.setProposedBy("drill");
        claim.setEvidence(new ClaimEvidenceEnvelope(List.of(
                new ClaimEvidenceEnvelope.Ref("observation", "x", "3 nap kihagyás"))));
        claim.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        claim.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(List.of(
                new ClaimConfidenceHistoryEnvelope.Point(new BigDecimal("0.60"), "konzílium", Instant.now()))));
        claim = claimRepository.save(claim);

        CharacterObservationEntity obs = new CharacterObservationEntity();
        obs.setCreatedBy(owner);
        obs.setExpertKey("drill");
        obs.setDimensionKeys(List.of("discipline", "nutrition"));
        obs.setDay(LocalDate.of(2026, 8, 26));
        obs.setText("Ma sem került be étkezés, 4. napja.");
        obs.setSalience((short) 4);
        obs.setSignals(new ObservationSignalsEnvelope(List.of(
                new ObservationSignalsEnvelope.Signal("logging-gap", "4 nap", List.of()))));
        observationRepository.save(obs);

        CharacterPortraitRevisionEntity rev = new CharacterPortraitRevisionEntity();
        rev.setCreatedBy(owner);
        rev.setDimensionId(dim.getId());
        rev.setVersion(1);
        rev.setPortrait("Első portré.");
        rev.setConferenceId(conf.getId());
        revisionRepository.save(rev);

        CharacterClaimEntity reloaded = claimRepository.findById(claim.getId()).orElseThrow();
        assertThat(reloaded.getEvidence().refs()).hasSize(1);
        assertThat(reloaded.getEvidence().refs().getFirst().kind()).isEqualTo("observation");
        assertThat(reloaded.getConfidenceHistory().points()).hasSize(1);
        assertThat(reloaded.getUserFeedback().events()).isEmpty();

        CharacterConferenceEntity reloadedConf = conferenceRepository.findById(conf.getId()).orElseThrow();
        assertThat(reloadedConf.getTranscript().turns()).hasSize(1);
        assertThat(reloadedConf.getOutcome().changes()).hasSize(1);

        CharacterObservationEntity reloadedObs = observationRepository
                .findByCreatedByOrderByDayDescCreatedAtDesc(owner, org.springframework.data.domain.PageRequest.of(0, 10))
                .getFirst();
        assertThat(reloadedObs.getSignals().signals()).hasSize(1);
        assertThat(reloadedObs.getDimensionKeys()).containsExactly("discipline", "nutrition");

        List<CharacterPortraitRevisionEntity> revisions = revisionRepository
                .findByCreatedByAndDimensionIdOrderByVersionDesc(owner, dim.getId());
        assertThat(revisions).hasSize(1);
        assertThat(revisions.getFirst().getPortrait()).isEqualTo("Első portré.");
    }

    @Test
    void dimensionKey_uniquePerLiveOwnerRow_softDeleteFreesIt() {
        UUID owner = ownerId();

        CharacterDimensionEntity first = new CharacterDimensionEntity();
        first.setCreatedBy(owner);
        first.setKey("mental");
        first.setTitle("Mentális állapot");
        first.setKind("CORE");
        first = dimensionRepository.saveAndFlush(first);

        CharacterDimensionEntity second = new CharacterDimensionEntity();
        second.setCreatedBy(owner);
        second.setKey("mental");
        second.setTitle("Mentális állapot 2.");
        second.setKind("CORE");

        assertThatThrownBy(() -> dimensionRepository.saveAndFlush(second))
                .isInstanceOf(DataIntegrityViolationException.class);

        dimensionRepository.delete(first);
        dimensionRepository.flush();

        CharacterDimensionEntity third = new CharacterDimensionEntity();
        third.setCreatedBy(owner);
        third.setKey("mental");
        third.setTitle("Mentális állapot 3.");
        third.setKind("CORE");
        dimensionRepository.saveAndFlush(third);

        assertThat(dimensionRepository.findByCreatedByAndKey(owner, "mental")).isPresent();
    }
}

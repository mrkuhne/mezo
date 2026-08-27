package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CharacterConferenceSummary;
import io.mrkuhne.mezo.api.dto.CharacterDimensionResponse;
import io.mrkuhne.mezo.api.dto.CharacterDimensionSummary;
import io.mrkuhne.mezo.api.dto.CharacterFeedItem;
import io.mrkuhne.mezo.api.dto.CharacterOverviewResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationDimensionKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationSignalsEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

class CharacterApiIT extends ApiIntegrationTest {

    @Autowired
    private CharacterObservationRepository observationRepository;

    @Autowired
    private CharacterConferenceRepository conferenceRepository;

    @Autowired
    private DatabasePopulator databasePopulator;

    @Autowired
    private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void overview_firstRead_lazilySeedsTheSevenCoreDimensions_emptyPortraits() {
        CharacterOverviewResponse res = getForBody("/api/character", ownerAuthHeaders(),
                HttpStatus.OK, CharacterOverviewResponse.class);
        assertThat(res.getDimensions()).hasSize(7);
        assertThat(res.getDimensions()).extracting(CharacterDimensionSummary::getKey)
                .containsExactly("physical", "athletic", "nutrition", "recovery",
                        "mental", "discipline", "life");
        assertThat(res.getDimensions()).allSatisfy(d -> {
            assertThat(d.getKind()).isEqualTo(CharacterDimensionSummary.KindEnum.CORE);
            assertThat(d.getMaturity()).isZero();
            assertThat(d.getPortrait()).isEmpty();
            assertThat(d.getTopClaims()).isEmpty();
        });
        // second read: still exactly 7 (idempotent seeding)
        CharacterOverviewResponse again = getForBody("/api/character", ownerAuthHeaders(),
                HttpStatus.OK, CharacterOverviewResponse.class);
        assertThat(again.getDimensions()).hasSize(7);
    }

    @Test
    void dimension_knownKey_returnsIt_unknownKeyIs404() {
        getForBody("/api/character", ownerAuthHeaders(), HttpStatus.OK, CharacterOverviewResponse.class);
        CharacterDimensionResponse d = getForBody("/api/character/dimension/discipline",
                ownerAuthHeaders(), HttpStatus.OK, CharacterDimensionResponse.class);
        assertThat(d.getTitle()).isEqualTo("Motiváció & fegyelem");
        assertThat(d.getExpertKey()).isEqualTo("drill");
        assertThat(d.getClaims()).isEmpty();
        assertThat(d.getRevisions()).isEmpty();
        String body = getForBody("/api/character/dimension/nonsense", ownerAuthHeaders(),
                HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "CHARACTER_DIMENSION_NOT_FOUND");
    }

    @Test
    void feedAndConferences_emptyDossier_honestEmptyArrays() {
        assertThat(getForBody("/api/character/feed", ownerAuthHeaders(),
                HttpStatus.OK, CharacterFeedItem[].class)).isEmpty();
        assertThat(getForBody("/api/character/conference", ownerAuthHeaders(),
                HttpStatus.OK, CharacterConferenceSummary[].class)).isEmpty();
        String body = getForBody("/api/character/conference/" + UUID.randomUUID(), ownerAuthHeaders(),
                HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "CHARACTER_CONFERENCE_NOT_FOUND");
    }

    @Test
    void feed_withSeededObservationAndConference_mergesNewestFirst() {
        UUID owner = ownerId();

        CharacterObservationEntity obs = new CharacterObservationEntity();
        obs.setCreatedBy(owner);
        obs.setExpertKey("drill");
        obs.setDimensionKeys(new ObservationDimensionKeysEnvelope(List.of("discipline")));
        obs.setDay(LocalDate.now().minusDays(1));
        obs.setText("Tegnap sem került be edzésnapló.");
        obs.setSalience((short) 3);
        obs.setSignals(new ObservationSignalsEnvelope(List.of(
                new ObservationSignalsEnvelope.Signal("logging-gap", "1 nap", List.of()))));
        observationRepository.save(obs);

        CharacterConferenceEntity conf = new CharacterConferenceEntity();
        conf.setCreatedBy(owner);
        conf.setKind("WEEKLY");
        conf.setTranscript(new ConferenceTranscriptEnvelope(List.of()));
        conf.setOutcome(new ConferenceOutcomeEnvelope(List.of(
                new ConferenceOutcomeEnvelope.Change(
                        "CLAIM_ACCEPTED", "discipline", null, "Új megfigyelés a fegyelemről."))));
        conf.setGeneratedAt(Instant.now());
        conferenceRepository.save(conf);

        CharacterFeedItem[] itemsArray = getForBody("/api/character/feed", ownerAuthHeaders(),
                HttpStatus.OK, CharacterFeedItem[].class);
        List<CharacterFeedItem> items = List.of(itemsArray);

        assertThat(items).hasSize(2);
        CharacterFeedItem first = items.get(0);
        CharacterFeedItem second = items.get(1);
        assertThat(first.getKind()).isEqualTo(CharacterFeedItem.KindEnum.CONFERENCE_CHANGE);
        assertThat(first.getText()).isEqualTo("Új megfigyelés a fegyelemről.");
        assertThat(first.getDimensionKeys()).containsExactly("discipline");
        assertThat(second.getKind()).isEqualTo(CharacterFeedItem.KindEnum.OBSERVATION);
        assertThat(second.getExpertKey()).isEqualTo("drill");
        assertThat(second.getText()).isEqualTo("Tegnap sem került be edzésnapló.");
    }
}

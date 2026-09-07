package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CharacterConferenceResponse;
import io.mrkuhne.mezo.api.dto.CharacterConferenceSummary;
import io.mrkuhne.mezo.api.dto.ConferenceOutcomeCounts;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The konzílium LIST endpoint reports what each round changed in the dossier (outcome counts),
 * and the DETAIL endpoint says whether its structured threads were stored by the council itself
 * or read back out of an old prose transcript (mezo-sp9w).
 */
class CharacterConferenceListIT extends ApiIntegrationTest {

    @Autowired private CharacterService characterService;
    @Autowired private CharacterConferenceRepository conferenceRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private CharacterConferenceEntity newConference(UUID owner, LocalDate weekStart, Instant generatedAt) {
        CharacterConferenceEntity conference = new CharacterConferenceEntity();
        conference.setCreatedBy(owner);
        conference.setKind("WEEKLY");
        conference.setWeekStart(weekStart);
        conference.setGeneratedAt(generatedAt);
        return conference;
    }

    @Test
    void conferenceList_countsOutcomeKinds() {
        UUID owner = ownerId();
        CharacterConferenceEntity conference = newConference(owner, LocalDate.of(2026, 8, 24),
                Instant.parse("2026-08-30T07:00:00Z"));
        conference.setTranscript(new ConferenceTranscriptEnvelope(List.of()));
        conference.setOutcome(new ConferenceOutcomeEnvelope(List.of(
                new ConferenceOutcomeEnvelope.Change("CLAIM_ACCEPTED", "physical", null, "a"),
                new ConferenceOutcomeEnvelope.Change("CLAIM_ACCEPTED", "mental", null, "b"),
                new ConferenceOutcomeEnvelope.Change("CLAIM_RETIRED", "nutrition", null, "c"),
                new ConferenceOutcomeEnvelope.Change("PORTRAIT_REWRITTEN", null, null, "d"),
                new ConferenceOutcomeEnvelope.Change("CHAPTER_OPENED", "recovery", null, "e"))));
        conferenceRepository.save(conference);

        List<CharacterConferenceSummary> list = characterService.conferences(owner);

        assertThat(list).hasSize(1);
        ConferenceOutcomeCounts counts = list.get(0).getOutcome();
        assertThat(counts.getAccepted()).isEqualTo(2);
        assertThat(counts.getRetired()).isEqualTo(1);
        assertThat(counts.getPortraitRewritten()).isEqualTo(1);
        assertThat(counts.getOther()).isEqualTo(1);
    }

    @Test
    void conferenceDetail_reportsStoredSource_whenTheColumnIsFilled() {
        UUID owner = ownerId();
        CharacterConferenceEntity conference = newConference(owner, LocalDate.of(2026, 8, 24),
                Instant.parse("2026-08-30T07:00:00Z"));
        conference.setTranscript(new ConferenceTranscriptEnvelope(List.of()));
        conference.setOutcome(new ConferenceOutcomeEnvelope(List.of()));
        conference.setDeliberation(new ConferenceDeliberationEnvelope(List.of(
                new ConferenceDeliberationEnvelope.Thread("physical", "Fizikai", List.of()))));
        CharacterConferenceEntity saved = conferenceRepository.save(conference);

        CharacterConferenceResponse response = characterService.conference(owner, saved.getId());

        assertThat(response.getDeliberationSource())
                .isEqualTo(CharacterConferenceResponse.DeliberationSourceEnum.STORED);
    }

    @Test
    void conferenceDetail_reportsDerivedSource_whenTheColumnIsNull() {
        UUID owner = ownerId();
        CharacterConferenceEntity conference = newConference(owner, LocalDate.of(2026, 8, 17),
                Instant.parse("2026-08-23T07:00:00Z"));
        conference.setTranscript(new ConferenceTranscriptEnvelope(List.of(
                new ConferenceTranscriptEnvelope.Turn("doki", "Doki: 1 javaslat\n[1] A testzsír-trend rekompozícióra utal.",
                        List.of()))));
        conference.setOutcome(new ConferenceOutcomeEnvelope(List.of()));
        CharacterConferenceEntity saved = conferenceRepository.save(conference);

        CharacterConferenceResponse response = characterService.conference(owner, saved.getId());

        assertThat(response.getDeliberationSource())
                .isEqualTo(CharacterConferenceResponse.DeliberationSourceEnum.DERIVED);
        assertThat(response.getDeliberation()).isNotNull();
    }
}

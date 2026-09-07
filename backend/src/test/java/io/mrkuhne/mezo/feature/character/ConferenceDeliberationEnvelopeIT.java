package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The new deliberation jsonb column round-trips, and stays null on rows that never had one. */
class ConferenceDeliberationEnvelopeIT extends ApiIntegrationTest {

    @Autowired private CharacterConferenceRepository conferenceRepository;
    @Autowired private OwnerProperties ownerProperties;

    private CharacterConferenceEntity newConference(UUID owner) {
        CharacterConferenceEntity conference = new CharacterConferenceEntity();
        conference.setCreatedBy(owner);
        conference.setKind("WEEKLY");
        conference.setWeekStart(LocalDate.of(2026, 8, 24));
        conference.setGeneratedAt(Instant.now());
        conference.setTranscript(new ConferenceTranscriptEnvelope(List.of()));
        conference.setOutcome(new ConferenceOutcomeEnvelope(List.of()));
        return conference;
    }

    @Test
    void deliberation_roundTripsThroughJsonb() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        CharacterConferenceEntity conference = newConference(owner);
        conference.setDeliberation(new ConferenceDeliberationEnvelope(List.of(
                new ConferenceDeliberationEnvelope.Thread("recovery", "Regeneráció", List.of(
                        new ConferenceDeliberationEnvelope.Item(0, "szomnologus", "Romlik az alvás.", "NEW",
                                null, false,
                                List.of(new ConferenceDeliberationEnvelope.PeerReaction(
                                        "pszichologus", "CHALLENGE", "Lehet stressz is.")),
                                new ConferenceDeliberationEnvelope.SkepticVerdict("KILL", "Kevés adat.", null),
                                new ConferenceDeliberationEnvelope.ChairRuling(
                                        false, new BigDecimal("0.40"), "Nem engedem be.", null, null, null)))))));

        UUID id = conferenceRepository.saveAndFlush(conference).getId();
        conferenceRepository.flush();
        CharacterConferenceEntity loaded = conferenceRepository.findById(id).orElseThrow();

        assertThat(loaded.getDeliberation().threads()).hasSize(1);
        ConferenceDeliberationEnvelope.Thread thread = loaded.getDeliberation().threads().get(0);
        assertThat(thread.dimensionKey()).isEqualTo("recovery");
        assertThat(thread.title()).isEqualTo("Regeneráció");
        assertThat(thread.items()).hasSize(1);
        ConferenceDeliberationEnvelope.Item item = thread.items().get(0);
        assertThat(item.index()).isZero();
        assertThat(item.expertKey()).isEqualTo("szomnologus");
        assertThat(item.reactions()).singleElement()
                .satisfies(reaction -> assertThat(reaction.stance()).isEqualTo("CHALLENGE"));
        assertThat(item.skeptic().verdict()).isEqualTo("KILL");
        assertThat(item.chair().accepted()).isFalse();
        assertThat(item.chair().confidence()).isEqualByComparingTo(new BigDecimal("0.40"));
    }

    @Test
    void deliberation_staysNull_whenNeverSet() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());

        UUID id = conferenceRepository.saveAndFlush(newConference(owner)).getId();
        conferenceRepository.flush();

        assertThat(conferenceRepository.findById(id).orElseThrow().getDeliberation()).isNull();
    }
}

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
import tools.jackson.databind.ObjectMapper;

/** The new deliberation jsonb column round-trips, and stays null on rows that never had one. */
class ConferenceDeliberationEnvelopeIT extends ApiIntegrationTest {

    @Autowired private CharacterConferenceRepository conferenceRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private ObjectMapper objectMapper;

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

    /**
     * mezo-lghn item 4: pins the "no migration needed" claim (docs/features/character.md +
     * {@link ConferenceDeliberationEnvelope.ChairRuling}'s javadoc) that a conference persisted
     * BEFORE mezo-lghn still deserializes, because Jackson reads an ABSENT field as {@code null}.
     * {@link #deliberation_roundTripsThroughJsonb} above (and {@code CharacterApiIT}) construct
     * the record in Java with explicit {@code null}s, which serializes {@code "dissent":null} —
     * that only exercises PRESENT-but-null, never genuinely ABSENT. This test deserializes a
     * hand-written JSON string, whose {@code skeptic} object omits {@code suggestedConfidence}
     * and whose {@code chair} object omits {@code dissent}/{@code note}/
     * {@code suggestedDimensionKey} entirely (no key at all, not even {@code null}), through the
     * SAME injected {@link ObjectMapper} the entity's {@code @JdbcTypeCode(SqlTypes.JSON)} column
     * uses for its jsonb (de)serialization — a raw {@code ::jsonb} native-query insert would pin
     * the same Jackson behaviour with no clearer signal, since the claim under test is about
     * Jackson's absent-field handling, not about Hibernate's JSON column mapping itself; going
     * straight through the ObjectMapper keeps the test focused and avoids a native-query detour.
     */
    @Test
    void deliberation_deserializesFromRawJsonThatOmitsTheNewFieldsEntirely() throws Exception {
        String rawJson = "{\"threads\":[{\"dimensionKey\":\"recovery\",\"title\":\"Regeneráció\","
                + "\"items\":[{\"index\":0,\"expertKey\":\"szomnologus\",\"text\":\"Romlik az alvás.\","
                + "\"kind\":\"NEW\",\"claimId\":null,\"sensitive\":false,\"reactions\":[],"
                + "\"skeptic\":{\"verdict\":\"KILL\",\"argument\":\"Kevés adat.\"},"
                + "\"chair\":{\"accepted\":false,\"confidence\":0.40,\"reason\":\"Nem engedem be.\"}}]}]}";

        ConferenceDeliberationEnvelope envelope =
                objectMapper.readValue(rawJson, ConferenceDeliberationEnvelope.class);

        assertThat(envelope.threads()).hasSize(1);
        ConferenceDeliberationEnvelope.Thread thread = envelope.threads().get(0);
        assertThat(thread.dimensionKey()).isEqualTo("recovery");
        assertThat(thread.title()).isEqualTo("Regeneráció");
        assertThat(thread.items()).hasSize(1);
        ConferenceDeliberationEnvelope.Item item = thread.items().get(0);
        assertThat(item.expertKey()).isEqualTo("szomnologus");
        assertThat(item.text()).isEqualTo("Romlik az alvás.");

        ConferenceDeliberationEnvelope.SkepticVerdict skeptic = item.skeptic();
        assertThat(skeptic.verdict()).isEqualTo("KILL");
        assertThat(skeptic.argument()).isEqualTo("Kevés adat.");
        assertThat(skeptic.suggestedConfidence()).isNull();

        ConferenceDeliberationEnvelope.ChairRuling chair = item.chair();
        assertThat(chair.accepted()).isFalse();
        assertThat(chair.confidence()).isEqualByComparingTo(new BigDecimal("0.40"));
        assertThat(chair.reason()).isEqualTo("Nem engedem be.");
        assertThat(chair.dissent()).isNull();
        assertThat(chair.note()).isNull();
        assertThat(chair.suggestedDimensionKey()).isNull();
    }
}

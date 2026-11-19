package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * S2 note-mention sweep (spec §3.2 "jegyzet-catchup", bd mezo-06o0.1): {@link NoteMentionCatchUp}
 * runs {@code MentionDetectionService} over every {@code NarrativeNoteSource}'s live notes — see
 * class javadoc for why {@code minChars=1} and {@code ts = occurredOn} start-of-day UTC.
 */
class NoteMentionCatchUpIT extends ApiIntegrationTest {

    @Autowired private NoteMentionCatchUp noteMentionCatchUp;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MentionRepository mentionRepository;

    @Test
    void testRun_shouldWriteMentionFromCheckInNote_whenPersonNameMatches() {
        UUID owner = userPopulator.createUser().getId();
        PersonEntity adam = personPopulator.createPerson(owner, "Ádám");
        LocalDate occurredOn = LocalDate.now();
        CheckInEntity checkIn = checkInPopulator.createCheckIn(
                owner, occurredOn, "18:00", 3, 4, "Tegnap Adammal futottam egy jót.");

        int written = noteMentionCatchUp.run(owner, LocalDate.now());

        assertThat(written).isEqualTo(1);
        List<MentionEntity> mentions =
                mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner);
        assertThat(mentions).hasSize(1);
        MentionEntity m = mentions.getFirst();
        assertThat(m.getPersonId()).isEqualTo(adam.getId());
        assertThat(m.getSource()).isEqualTo("text");
        assertThat(m.getSourceRefKind()).isEqualTo("checkin_note");
        assertThat(m.getSourceRefId()).isEqualTo(checkIn.getId());
        assertThat(m.getTs()).isEqualTo(occurredOn.atStartOfDay(ZoneOffset.UTC).toInstant());
    }

    @Test
    void testRun_shouldWriteNothingNew_whenRunTwice() {
        UUID owner = userPopulator.createUser().getId();
        personPopulator.createPerson(owner, "Ádám");
        LocalDate occurredOn = LocalDate.now();
        checkInPopulator.createCheckIn(owner, occurredOn, "18:00", 3, 4, "Tegnap Adammal futottam egy jót.");

        int firstWritten = noteMentionCatchUp.run(owner, LocalDate.now());
        int secondWritten = noteMentionCatchUp.run(owner, LocalDate.now());

        assertThat(firstWritten).isEqualTo(1);
        assertThat(secondWritten).isZero();
        assertThat(mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner)).hasSize(1);
    }

    @Test
    void testRun_shouldWriteNothing_whenNoteBlankOrNoNameMatch() {
        UUID owner = userPopulator.createUser().getId();
        personPopulator.createPerson(owner, "Ádám");
        LocalDate occurredOn = LocalDate.now();
        checkInPopulator.createCheckIn(owner, occurredOn, "18:00", 3, 4, "Ma semmi különös nem történt.");

        int written = noteMentionCatchUp.run(owner, LocalDate.now());

        assertThat(written).isZero();
        assertThat(mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner)).isEmpty();
    }
}

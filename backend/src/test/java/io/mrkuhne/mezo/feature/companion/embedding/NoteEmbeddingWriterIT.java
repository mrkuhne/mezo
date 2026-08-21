package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.service.ActivityNoteSourceAdapter;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource;
import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource.Note;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * The W1.5 note units on the SINGLE write path: the {@link NarrativeNoteSource} adapters hand out
 * live, length-gated candidates chronologically, and the writer turns one candidate into one
 * idempotent vector.
 */
@ActiveProfiles("companion-fake")
class NoteEmbeddingWriterIT extends AbstractIntegrationTest {

    private static final String LONG_NOTE =
            "Ma este végre leültem és átgondoltam a hetet, sokkal nyugodtabb voltam mint általában, "
            + "és ez a séta után jött meg igazán.";
    private static final String SHORT_NOTE = "fáradt";

    @Autowired private MemoryEmbeddingWriter writer;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private ActivityNoteSourceAdapter activityNoteSourceAdapter;
    @Autowired private CheckInNoteSourceAdapter checkInNoteSourceAdapter;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    @Test
    void testNotesToEmbed_shouldGateOnLengthAndDate_whenActivityRowsExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        ActivityLogEntity longOne = activityPopulator.activity(owner, yesterday, LONG_NOTE, "mindset", 10, "AI");
        activityPopulator.activity(owner, yesterday, SHORT_NOTE, "mindset", 10, "AI");
        activityPopulator.activity(owner, LocalDate.now().plusDays(1), LONG_NOTE, "mindset", 10, "AI");

        var candidates = activityNoteSourceAdapter.notesToEmbed(owner, yesterday, 80);

        assertThat(candidates).extracting(Note::id).containsExactly(longOne.getId());
    }

    @Test
    void testNotesToEmbed_shouldGateOnLengthAndSkipNullNotes_whenCheckInsExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        CheckInEntity longOne = checkInPopulator.createCheckIn(owner, yesterday, "08:00", 4, 2, LONG_NOTE);
        checkInPopulator.createCheckIn(owner, yesterday, "12:00", 4, 2, SHORT_NOTE);
        checkInPopulator.createCheckIn(owner, yesterday, "18:00", 4, 2, null);

        var candidates = checkInNoteSourceAdapter.notesToEmbed(owner, yesterday, 80);

        assertThat(candidates).extracting(Note::id).containsExactly(longOne.getId());
    }

    @Test
    void testWriteNote_shouldEmbedOnceOnTheEntryDay_whenCalledTwiceForAnActivityNote() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(3);
        ActivityLogEntity entry = activityPopulator.activity(owner, day, LONG_NOTE, "mindset", 10, "AI");
        Note note = new Note(entry.getId(), entry.getCreatedBy(), entry.getText(), entry.getOccurredOn());

        writer.writeNote(NarrativeNoteSource.ACTIVITY_NOTE, note);
        writer.writeNote(NarrativeNoteSource.ACTIVITY_NOTE, note);

        MemoryEmbeddingEntity vector = memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, entry.getId()).orElseThrow();
        assertThat(vector.getContent()).isEqualTo(LONG_NOTE);
        assertThat(vector.getOccurredOn()).isEqualTo(day);
        assertThat(vector.getCreatedBy()).isEqualTo(owner);
        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(
                owner, MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE)).isEqualTo(1);
    }

    @Test
    void testWriteNote_shouldEmbedOnTheCheckInDay_whenNoteIsSubstantive() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(2);
        CheckInEntity checkIn = checkInPopulator.createCheckIn(owner, day, "18:00", 3, 4, LONG_NOTE);
        Note note = new Note(checkIn.getId(), checkIn.getCreatedBy(), checkIn.getNote(), checkIn.getDate());

        writer.writeNote(NarrativeNoteSource.CHECKIN_NOTE, note);

        MemoryEmbeddingEntity vector = memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_CHECKIN_NOTE, checkIn.getId()).orElseThrow();
        assertThat(vector.getContent()).isEqualTo(LONG_NOTE);
        assertThat(vector.getOccurredOn()).isEqualTo(day);
    }
}

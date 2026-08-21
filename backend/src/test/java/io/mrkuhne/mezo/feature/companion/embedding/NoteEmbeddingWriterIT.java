package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * The W1.5 note units on the SINGLE write path: the repositories hand out live, length-gated
 * candidates chronologically, and the writer turns one candidate into one idempotent vector.
 */
@ActiveProfiles("companion-fake")
class NoteEmbeddingWriterIT extends AbstractIntegrationTest {

    private static final String LONG_NOTE =
            "Ma este végre leültem és átgondoltam a hetet, sokkal nyugodtabb voltam mint általában, "
            + "és ez a séta után jött meg igazán.";
    private static final String SHORT_NOTE = "fáradt";

    @Autowired private MemoryEmbeddingWriter writer;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private CheckInRepository checkInRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    @Test
    void testFindNoteCandidates_shouldGateOnLengthAndDate_whenActivityRowsExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        ActivityLogEntity longOne = activityPopulator.activity(owner, yesterday, LONG_NOTE, "mindset", 10, "AI");
        activityPopulator.activity(owner, yesterday, SHORT_NOTE, "mindset", 10, "AI");
        activityPopulator.activity(owner, LocalDate.now().plusDays(1), LONG_NOTE, "mindset", 10, "AI");

        List<ActivityLogEntity> candidates = activityLogRepository.findNoteCandidates(owner, yesterday, 80);

        assertThat(candidates).extracting(ActivityLogEntity::getId).containsExactly(longOne.getId());
    }

    @Test
    void testFindNoteCandidates_shouldGateOnLengthAndSkipNullNotes_whenCheckInsExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        CheckInEntity longOne = checkInPopulator.createCheckIn(owner, yesterday, "08:00", 4, 2, LONG_NOTE);
        checkInPopulator.createCheckIn(owner, yesterday, "12:00", 4, 2, SHORT_NOTE);
        checkInPopulator.createCheckIn(owner, yesterday, "18:00", 4, 2, null);

        List<CheckInEntity> candidates = checkInRepository.findNoteCandidates(owner, yesterday, 80);

        assertThat(candidates).extracting(CheckInEntity::getId).containsExactly(longOne.getId());
    }

    @Test
    void testWriteActivityNote_shouldEmbedOnceOnTheEntryDay_whenCalledTwice() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(3);
        ActivityLogEntity entry = activityPopulator.activity(owner, day, LONG_NOTE, "mindset", 10, "AI");

        writer.writeActivityNote(entry);
        writer.writeActivityNote(entry);

        MemoryEmbeddingEntity vector = memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, entry.getId()).orElseThrow();
        assertThat(vector.getContent()).isEqualTo(LONG_NOTE);
        assertThat(vector.getOccurredOn()).isEqualTo(day);
        assertThat(vector.getCreatedBy()).isEqualTo(owner);
        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(
                owner, MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE)).isEqualTo(1);
    }

    @Test
    void testWriteCheckInNote_shouldEmbedOnTheCheckInDay_whenNoteIsSubstantive() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(2);
        CheckInEntity checkIn = checkInPopulator.createCheckIn(owner, day, "18:00", 3, 4, LONG_NOTE);

        writer.writeCheckInNote(checkIn);

        MemoryEmbeddingEntity vector = memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_CHECKIN_NOTE, checkIn.getId()).orElseThrow();
        assertThat(vector.getContent()).isEqualTo(LONG_NOTE);
        assertThat(vector.getOccurredOn()).isEqualTo(day);
    }
}

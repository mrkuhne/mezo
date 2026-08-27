package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * The W1.5 nightly note sweep: length gate, idempotent re-runs, and a history backfill that is NOT
 * bounded by the daily-summary catch-up window (a not-yet-embedded row from months ago is still a
 * candidate — that IS the one-time backfill).
 *
 * <p>{@code @MockitoSpyBean} forks the application context (the {@code
 * GraphPromotionServiceReconcileIsolationIT} precedent) — every test in THIS class shares that
 * forked context, which is fine since a spy with no stubbing behaves exactly like the real bean.
 */
@ActiveProfiles("companion-fake")
class NoteEmbeddingCatchUpIT extends AbstractIntegrationTest {

    private static final String LONG_NOTE =
            "Ma este végre leültem és átgondoltam a hetet, sokkal nyugodtabb voltam mint általában, "
            + "és ez a séta után jött meg igazán.";
    private static final String SHORT_NOTE = "fáradt";

    @Autowired private NoteEmbeddingCatchUp noteEmbeddingCatchUp;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @MockitoSpyBean private MemoryEmbeddingWriter memoryEmbeddingWriter;

    @Test
    void testRun_shouldEmbedBothKindsAndGateOnLength_whenNotesExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        ActivityLogEntity activity = activityPopulator.activity(owner, yesterday, LONG_NOTE, "mindset", 10, "AI");
        activityPopulator.activity(owner, yesterday, SHORT_NOTE, "mindset", 10, "AI");
        CheckInEntity checkIn = checkInPopulator.createCheckIn(owner, yesterday, "18:00", 3, 4, LONG_NOTE);
        checkInPopulator.createCheckIn(owner, yesterday, "08:00", 3, 4, SHORT_NOTE);

        int written = noteEmbeddingCatchUp.run(owner, yesterday);

        assertThat(written).isEqualTo(2);
        assertThat(memoryEmbeddingRepository.existsByKindAndRefId(
                MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, activity.getId())).isTrue();
        assertThat(memoryEmbeddingRepository.existsByKindAndRefId(
                MemoryEmbeddingEntity.KIND_CHECKIN_NOTE, checkIn.getId())).isTrue();
        assertThat(memoryEmbeddingRepository.count()).isEqualTo(2);
    }

    @Test
    void testRun_shouldWriteNothingNew_whenRunTwice() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        activityPopulator.activity(owner, yesterday, LONG_NOTE, "mindset", 10, "AI");
        checkInPopulator.createCheckIn(owner, yesterday, "18:00", 3, 4, LONG_NOTE);

        noteEmbeddingCatchUp.run(owner, yesterday);
        long afterFirst = memoryEmbeddingRepository.count();
        int written = noteEmbeddingCatchUp.run(owner, yesterday);

        assertThat(written).isZero();
        assertThat(memoryEmbeddingRepository.count()).isEqualTo(afterFirst);
    }

    @Test
    void testRun_shouldNotCallSyncNote_whenTheCorpusIsUnchanged() {
        // FINDING 2: syncNote's own internal check already returns false for unchanged notes, so
        // the OLD test above (asserting written==0) already passed pre-fix — it never proved the
        // per-candidate transaction+query was avoided. This proves the call itself never happens.
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        activityPopulator.activity(owner, yesterday, LONG_NOTE, "mindset", 10, "AI");
        checkInPopulator.createCheckIn(owner, yesterday, "18:00", 3, 4, LONG_NOTE);
        noteEmbeddingCatchUp.run(owner, yesterday); // first-write both notes
        Mockito.clearInvocations(memoryEmbeddingWriter);

        int written = noteEmbeddingCatchUp.run(owner, yesterday);

        assertThat(written).isZero();
        Mockito.verify(memoryEmbeddingWriter, Mockito.never())
                .syncNote(Mockito.anyString(), Mockito.any());
    }

    @Test
    void testRun_shouldBackfillOldHistory_whenRowsPredateTheSummaryWindow() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        ActivityLogEntity ancient = activityPopulator.activity(
                owner, yesterday.minusDays(400), LONG_NOTE, "mindset", 10, "AI");

        int written = noteEmbeddingCatchUp.run(owner, yesterday);

        assertThat(written).isEqualTo(1);
        assertThat(memoryEmbeddingRepository.findByKindAndRefId(
                MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, ancient.getId()))
                .get().extracting(MemoryEmbeddingEntity::getOccurredOn)
                .isEqualTo(yesterday.minusDays(400));
    }

    @Test
    void testRun_shouldSkipSoftDeletedSources_whenAnEntryWasDeleted() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        ActivityLogEntity deleted = activityPopulator.activity(owner, yesterday, LONG_NOTE, "mindset", 10, "AI");
        activityLogRepository.delete(deleted); // @SQLDelete → soft delete

        int written = noteEmbeddingCatchUp.run(owner, yesterday);

        assertThat(written).isZero();
        assertThat(memoryEmbeddingRepository.count()).isZero();
    }

    @Test
    void testRun_shouldIgnoreOtherUsersNotes_whenTwoUsersHaveHistory() {
        UUID owner = userPopulator.createUser().getId();
        UUID other = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        activityPopulator.activity(other, yesterday, LONG_NOTE, "mindset", 10, "AI");

        int written = noteEmbeddingCatchUp.run(owner, yesterday);

        assertThat(written).isZero();
        assertThat(memoryEmbeddingRepository.count()).isZero();
    }
}

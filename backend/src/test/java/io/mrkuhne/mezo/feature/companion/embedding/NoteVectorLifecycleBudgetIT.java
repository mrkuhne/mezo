package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource;
import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource.Note;
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
import org.springframework.test.context.TestPropertySource;

/**
 * The lifecycle sweep's budget interaction (mezo-b3pp.26), isolated from {@link NoteVectorLifecycleIT}
 * for the same reason {@link NoteEmbeddingBudgetIT} is isolated from {@code NoteEmbeddingCatchUpIT}:
 * it needs its own {@code note-batch-size} override.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.embedding.note-batch-size=1")
class NoteVectorLifecycleBudgetIT extends AbstractIntegrationTest {

    private static final String LONG_NOTE_A =
            "Ma este végre leültem és átgondoltam a hetet, sokkal nyugodtabb voltam mint általában, "
            + "és ez a séta után jött meg igazán.";
    private static final String LONG_NOTE_B =
            "Reggel korán keltem, megnéztem a napi tervet, és elindultam futni a parkba, ahogy szoktam.";
    private static final String LONG_NOTE_A_DRIFTED =
            "Ma este végre leültem és átgondoltam a hetet, de közben rájöttem, hogy valami mást is "
            + "el kell mesélnem, mert most már egészen más a helyzet, mint amit korábban leírtam.";

    @Autowired private NoteEmbeddingCatchUp noteEmbeddingCatchUp;
    @Autowired private MemoryEmbeddingWriter memoryEmbeddingWriter;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private CheckInRepository checkInRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    @Test
    void testRun_shouldChargeTheBudgetForAReembed_butNotForAReap() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        ActivityLogEntity toDrift = activityPopulator.activity(owner, day, LONG_NOTE_A, "mindset", 10, "AI");
        ActivityLogEntity toReap = activityPopulator.activity(owner, day, LONG_NOTE_B, "mindset", 10, "AI");
        // budget=1: two runs needed to get both notes their first vector.
        noteEmbeddingCatchUp.run(owner, day);
        noteEmbeddingCatchUp.run(owner, day);
        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(owner, NarrativeNoteSource.ACTIVITY_NOTE))
                .isEqualTo(2);

        ActivityLogEntity drifted = activityLogRepository.findById(toDrift.getId()).orElseThrow();
        drifted.setText(LONG_NOTE_A_DRIFTED);
        activityLogRepository.saveAndFlush(drifted);
        activityLogRepository.delete(activityLogRepository.findById(toReap.getId()).orElseThrow()); // soft delete

        int written = noteEmbeddingCatchUp.run(owner, day);

        assertThat(written).isEqualTo(1); // the reap is free; the drift re-embed spends the whole budget
        assertThat(memoryEmbeddingRepository.findByKindAndRefId(NarrativeNoteSource.ACTIVITY_NOTE, toDrift.getId()))
                .hasValueSatisfying(row -> assertThat(row.getContent()).isEqualTo(LONG_NOTE_A_DRIFTED));
        assertThat(memoryEmbeddingRepository.findByKindAndRefId(NarrativeNoteSource.ACTIVITY_NOTE, toReap.getId()))
                .isEmpty();
        assertThat(memoryEmbeddingRepository.findByKindAndRefIdIncludingDeleted(
                NarrativeNoteSource.ACTIVITY_NOTE, toReap.getId()))
                .hasValueSatisfying(row -> assertThat(row.isDeleted()).isTrue());
    }

    @Test
    void testRun_shouldStillReapTheSecondSource_whenTheFirstSourceExhaustedTheBudget() {
        // mezo-b3pp.26 regression: orderedStream() runs activity_note before checkin_note (see
        // NoteEmbeddingCatchUp's own javadoc on the shared budget pool). With note-batch-size=1,
        // a fresh activity note spends the WHOLE run budget, so checkin_note's turn starts with
        // budget=0 — its reap must still fire; only its embed loop may be starved.
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        activityPopulator.activity(owner, day, LONG_NOTE_A, "mindset", 10, "AI"); // will consume the budget
        CheckInEntity checkIn = checkInPopulator.createCheckIn(owner, day, "18:00", 3, 4, LONG_NOTE_B);
        // Seed the checkin_note vector directly (not through the sweep, so setup spends no run budget),
        // then orphan its source row the only way today's app allows — a repository-level delete.
        memoryEmbeddingWriter.syncNote(NarrativeNoteSource.CHECKIN_NOTE,
                new Note(checkIn.getId(), checkIn.getCreatedBy(), LONG_NOTE_B, day));
        checkInRepository.delete(checkIn); // @SQLDelete → soft delete

        int written = noteEmbeddingCatchUp.run(owner, day);

        assertThat(written).isEqualTo(1); // the activity note spent the whole budget
        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(owner, NarrativeNoteSource.ACTIVITY_NOTE))
                .isEqualTo(1);
        // the orphaned checkin_note vector must be reaped EVEN THOUGH its source's turn started
        // with the budget already exhausted — findByKindAndRefId cannot tell a soft delete from
        // "never existed", so assert through the including-deleted finder per the brief's idiom.
        assertThat(memoryEmbeddingRepository.findByKindAndRefId(
                NarrativeNoteSource.CHECKIN_NOTE, checkIn.getId())).isEmpty();
        assertThat(memoryEmbeddingRepository.findByKindAndRefIdIncludingDeleted(
                NarrativeNoteSource.CHECKIN_NOTE, checkIn.getId()))
                .hasValueSatisfying(row -> assertThat(row.isDeleted()).isTrue());
    }
}

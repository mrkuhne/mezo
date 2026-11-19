package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
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
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private CheckInRepository checkInRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    @Test
    void testRun_shouldChargeTheBudgetForAReembed_butNotForAReap() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        CheckInEntity toDrift = checkInPopulator.createCheckIn(owner, day, "08:00", 3, 4, LONG_NOTE_A);
        CheckInEntity toReap = checkInPopulator.createCheckIn(owner, day, "18:00", 3, 4, LONG_NOTE_B);
        // budget=1: two runs needed to get both notes their first vector.
        noteEmbeddingCatchUp.run(owner, day);
        noteEmbeddingCatchUp.run(owner, day);
        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(owner, NarrativeNoteSource.CHECKIN_NOTE))
                .isEqualTo(2);

        CheckInEntity drifted = checkInRepository.findById(toDrift.getId()).orElseThrow();
        drifted.setNote(LONG_NOTE_A_DRIFTED);
        checkInRepository.saveAndFlush(drifted);
        checkInRepository.delete(checkInRepository.findById(toReap.getId()).orElseThrow()); // soft delete

        int written = noteEmbeddingCatchUp.run(owner, day);

        assertThat(written).isEqualTo(1); // the reap is free; the drift re-embed spends the whole budget
        assertThat(memoryEmbeddingRepository.findByKindAndRefId(NarrativeNoteSource.CHECKIN_NOTE, toDrift.getId()))
                .hasValueSatisfying(row -> assertThat(row.getContent()).isEqualTo(LONG_NOTE_A_DRIFTED));
        assertThat(memoryEmbeddingRepository.findByKindAndRefId(NarrativeNoteSource.CHECKIN_NOTE, toReap.getId()))
                .isEmpty();
        assertThat(memoryEmbeddingRepository.findByKindAndRefIdIncludingDeleted(
                NarrativeNoteSource.CHECKIN_NOTE, toReap.getId()))
                .hasValueSatisfying(row -> assertThat(row.isDeleted()).isTrue());
    }
}

package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import io.mrkuhne.mezo.api.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource;
import io.mrkuhne.mezo.feature.companion.NarrativeNoteSource.Note;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
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
 * W1.5 lifecycle (mezo-b3pp.26): the writer-level drift-detection and reap cases for
 * {@link MemoryEmbeddingWriter#syncNote} / {@link MemoryEmbeddingWriter#deleteNoteEmbedding}. The
 * {@code NoteEmbeddingWriterIT} harness — {@code companion-fake} profile, plain populators, direct
 * writer calls (no async hop, unlike the ritual reflection precedent this mirrors for the
 * revive-trap case). Task 2 adds the nightly-sweep-level cases alongside these.
 */
@ActiveProfiles("companion-fake")
class NoteVectorLifecycleIT extends AbstractIntegrationTest {

    private static final String KIND = NarrativeNoteSource.ACTIVITY_NOTE;

    private static final String LONG_NOTE =
            "Ma este végre leültem és átgondoltam a hetet, sokkal nyugodtabb voltam mint általában, "
            + "és ez a séta után jött meg igazán.";

    @Autowired private MemoryEmbeddingWriter writer;
    @Autowired private NoteEmbeddingCatchUp noteEmbeddingCatchUp;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private CheckInService checkInService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    private Note note(UUID owner, LocalDate day, String text) {
        ActivityLogEntity entry = activityPopulator.activity(owner, day, text, "mindset", 10, "AI");
        return new Note(entry.getId(), entry.getCreatedBy(), text, day);
    }

    private Note noteForExistingRef(UUID owner, UUID refId, LocalDate day, String text) {
        return new Note(refId, owner, text, day);
    }

    @Test
    void testSyncNote_shouldWriteOneVector_whenTheNoteHasNoneYet() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        Note note = note(owner, day, "Ma este végre leültem és átgondoltam a hetet.");

        boolean spent = writer.syncNote(KIND, note);

        assertThat(spent).isTrue();
        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(owner, KIND)).isEqualTo(1);
        MemoryEmbeddingEntity row = memoryEmbeddingRepository.findByKindAndRefId(KIND, note.id()).orElseThrow();
        assertThat(row.getContent()).isEqualTo(note.text());
    }

    @Test
    void testSyncNote_shouldDoNothingAndSpendNothing_whenTheContentIsUnchanged() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        Note note = note(owner, day, "Nyugodt hét volt, sokat sétáltam.");
        writer.syncNote(KIND, note);
        UUID rowIdBefore = memoryEmbeddingRepository.findByKindAndRefId(KIND, note.id()).orElseThrow().getId();

        boolean spent = writer.syncNote(KIND, note);

        assertThat(spent).isFalse();
        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(owner, KIND)).isEqualTo(1);
        // the id must be UNCHANGED — an invisible delete+insert would still land on one row and
        // pass a weaker assertion
        assertThat(memoryEmbeddingRepository.findByKindAndRefId(KIND, note.id()).orElseThrow().getId())
                .isEqualTo(rowIdBefore);
    }

    @Test
    void testSyncNote_shouldReembedInPlace_whenTheSourceTextChanged() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        Note original = note(owner, day, "Eredeti szöveg a napról.");
        writer.syncNote(KIND, original);
        UUID rowIdBefore = memoryEmbeddingRepository.findByKindAndRefId(KIND, original.id()).orElseThrow().getId();
        Note edited = noteForExistingRef(owner, original.id(), day, "Módosított szöveg a napról.");

        boolean spent = writer.syncNote(KIND, edited);

        assertThat(spent).isTrue();
        MemoryEmbeddingEntity row = memoryEmbeddingRepository.findByKindAndRefId(KIND, original.id()).orElseThrow();
        assertThat(row.getId()).isEqualTo(rowIdBefore);
        assertThat(row.getContent()).isEqualTo("Módosított szöveg a napról.");
        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(owner, KIND)).isEqualTo(1);
    }

    @Test
    void testSyncNote_shouldNotReembed_whenOnlyTheTextBeyondTheCapChanged() {
        // THE CAP TRAP: embed-max-chars defaults to 2000 (application.yml). A note longer than
        // that is stored (and must be compared) as its CAPPED text — the raw text is never what
        // gets embedded, so a tail-only edit must not look like drift.
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        String head = "a".repeat(2000);
        Note first = note(owner, day, head + "eredeti farok");
        writer.syncNote(KIND, first);
        UUID rowIdBefore = memoryEmbeddingRepository.findByKindAndRefId(KIND, first.id()).orElseThrow().getId();
        Note sameHeadDifferentTail = noteForExistingRef(owner, first.id(), day, head + "más farok utólag");

        boolean spent = writer.syncNote(KIND, sameHeadDifferentTail);

        assertThat(spent).isFalse();
        MemoryEmbeddingEntity row = memoryEmbeddingRepository.findByKindAndRefId(KIND, first.id()).orElseThrow();
        assertThat(row.getId()).isEqualTo(rowIdBefore);
        assertThat(row.getContent()).hasSize(2000).isEqualTo(head);
    }

    @Test
    void testSyncNote_shouldReviveTheVector_whenItWasPreviouslyReaped() {
        // the mezo-b3pp.2 trap: uq_memory_embedding_kind_ref_id is a PLAIN (non-partial) unique
        // index, so the reaped row still owns the (kind, ref_id) slot. Routing through the
        // insert-only `write` here would hit that constraint and roll back — this must revive the
        // SAME row via `upsert` instead.
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        Note note = note(owner, day, "Ez a bejegyzés törlésre kerül majd.");
        writer.syncNote(KIND, note);
        UUID rowIdBefore = memoryEmbeddingRepository.findByKindAndRefId(KIND, note.id()).orElseThrow().getId();
        writer.deleteNoteEmbedding(KIND, note.id());
        assertThat(memoryEmbeddingRepository.findByKindAndRefId(KIND, note.id())).isEmpty();

        boolean spent = writer.syncNote(KIND, note);

        assertThat(spent).isTrue();
        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(owner, KIND)).isEqualTo(1);
        MemoryEmbeddingEntity row = memoryEmbeddingRepository.findByKindAndRefId(KIND, note.id()).orElseThrow();
        assertThat(row.getId()).isEqualTo(rowIdBefore); // revived, not a second row
    }

    @Test
    void testDeleteNoteEmbedding_shouldSoftDeleteTheVector_whenOneExists() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        Note note = note(owner, day, "Ezt a vektort ki kell ütni.");
        writer.syncNote(KIND, note);

        writer.deleteNoteEmbedding(KIND, note.id());

        // findAll()/findByKindAndRefId cannot tell a soft delete from a hard one on their own —
        // assert through BOTH finders per the brief.
        assertThat(memoryEmbeddingRepository.findByKindAndRefId(KIND, note.id())).isEmpty();
        assertThat(memoryEmbeddingRepository.findByKindAndRefIdIncludingDeleted(KIND, note.id()))
                .hasValueSatisfying(row -> assertThat(row.isDeleted()).isTrue());
    }

    @Test
    void testDeleteNoteEmbedding_shouldDoNothing_whenThereIsNoVector() {
        UUID owner = userPopulator.createUser().getId();
        UUID refId = UUID.randomUUID();

        writer.deleteNoteEmbedding(KIND, refId);

        assertThat(memoryEmbeddingRepository.findByKindAndRefIdIncludingDeleted(KIND, refId)).isEmpty();
        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(owner, KIND)).isZero();
    }

    // --- Task 2: sweep-level lifecycle cases (mezo-b3pp.26) ---------------------------------

    @Test
    void testRun_shouldReembed_whenACheckInNoteWasOverwrittenInPlace() {
        // THE LIVE PATH: check-in save is an upsert on the (date, slotTime) slot — reachable
        // through the API today, unlike a source-row delete (see the reap case below).
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        CheckInEntity checkIn = checkInPopulator.createCheckIn(owner, day, "18:00", 3, 4, LONG_NOTE);
        noteEmbeddingCatchUp.run(owner, day);
        UUID rowIdBefore = memoryEmbeddingRepository
                .findByKindAndRefId(NarrativeNoteSource.CHECKIN_NOTE, checkIn.getId()).orElseThrow().getId();
        String overwritten = "Teljesen más szöveg került ide utólag, jóval hosszabb és részletesebb, mint korábban.";

        SaveCheckInRequest request = SaveCheckInRequest.builder()
                .date(day).slotTime("18:00").state("done").energy(3).stress(4).note(overwritten).build();
        checkInService.save(owner, request);
        int written = noteEmbeddingCatchUp.run(owner, day);

        assertThat(written).isEqualTo(1);
        MemoryEmbeddingEntity row = memoryEmbeddingRepository
                .findByKindAndRefId(NarrativeNoteSource.CHECKIN_NOTE, checkIn.getId()).orElseThrow();
        assertThat(row.getId()).isEqualTo(rowIdBefore); // same vector row, re-embedded in place
        assertThat(row.getContent()).isEqualTo(overwritten);
    }

    @Test
    void testRun_shouldReapTheVector_whenTheSourceRowIsNoLongerLive() {
        // No service-level delete surface exists for either source today — the repository write
        // is the only way to reach this, and that is exactly why the sweep, not an event, is fix.
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        ActivityLogEntity activity = activityPopulator.activity(owner, day, LONG_NOTE, "mindset", 10, "AI");
        noteEmbeddingCatchUp.run(owner, day);
        assertThat(memoryEmbeddingRepository.existsByKindAndRefId(
                NarrativeNoteSource.ACTIVITY_NOTE, activity.getId())).isTrue();

        activityLogRepository.delete(activity); // @SQLDelete → soft delete
        noteEmbeddingCatchUp.run(owner, day);

        // findByKindAndRefId cannot tell a soft delete from "never existed" — assert through the
        // including-deleted finder per the brief.
        assertThat(memoryEmbeddingRepository.findByKindAndRefId(
                NarrativeNoteSource.ACTIVITY_NOTE, activity.getId())).isEmpty();
        assertThat(memoryEmbeddingRepository.findByKindAndRefIdIncludingDeleted(
                NarrativeNoteSource.ACTIVITY_NOTE, activity.getId()))
                .hasValueSatisfying(row -> assertThat(row.isDeleted()).isTrue());
    }

    @Test
    void testRun_shouldSpendNothing_whenNothingChanged() {
        // Guard against a re-embed-every-night regression: an unchanged note must cost nothing.
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        ActivityLogEntity activity = activityPopulator.activity(owner, day, LONG_NOTE, "mindset", 10, "AI");
        noteEmbeddingCatchUp.run(owner, day);
        UUID rowIdBefore = memoryEmbeddingRepository
                .findByKindAndRefId(NarrativeNoteSource.ACTIVITY_NOTE, activity.getId()).orElseThrow().getId();

        int written = noteEmbeddingCatchUp.run(owner, day);

        assertThat(written).isZero();
        assertThat(memoryEmbeddingRepository
                .findByKindAndRefId(NarrativeNoteSource.ACTIVITY_NOTE, activity.getId()).orElseThrow().getId())
                .isEqualTo(rowIdBefore);
    }

    @Test
    void testRun_shouldNotReap_whenALiveNoteFellBelowMinChars() {
        // Deliberate residue (mezo-b3pp.26): liveness and length are different questions. A note
        // edited down below note-min-chars drops out of the CANDIDATE set (length-gated), so it
        // is neither re-embedded nor reaped — its stale vector survives untouched. Reaping on the
        // length gate would mean merely RAISING note-min-chars mass-deletes a user's existing
        // vectors on the next nightly run.
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        ActivityLogEntity activity = activityPopulator.activity(owner, day, LONG_NOTE, "mindset", 10, "AI");
        noteEmbeddingCatchUp.run(owner, day);
        UUID rowIdBefore = memoryEmbeddingRepository
                .findByKindAndRefId(NarrativeNoteSource.ACTIVITY_NOTE, activity.getId()).orElseThrow().getId();

        ActivityLogEntity live = activityLogRepository.findById(activity.getId()).orElseThrow();
        live.setText("fáradt"); // well below note-min-chars (80)
        activityLogRepository.saveAndFlush(live);
        int written = noteEmbeddingCatchUp.run(owner, day);

        assertThat(written).isZero();
        MemoryEmbeddingEntity row = memoryEmbeddingRepository
                .findByKindAndRefId(NarrativeNoteSource.ACTIVITY_NOTE, activity.getId()).orElseThrow();
        assertThat(row.getId()).isEqualTo(rowIdBefore); // not reaped
        assertThat(row.getContent()).isEqualTo(LONG_NOTE); // and not re-embedded — stale on purpose
    }

    @Test
    void testRun_shouldKeepSweeping_whenOneRowFails() {
        // Per-row isolation is unchanged by the rework: one row whose embed call throws must not
        // abort the rest of the pass. FakeEmbeddingAdapter.FAIL_EMBED stages that without Mockito.
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(1);
        String failingText = FakeEmbeddingAdapter.FAIL_EMBED + " " + LONG_NOTE;
        ActivityLogEntity failing = activityPopulator.activity(owner, day, failingText, "mindset", 10, "AI");
        ActivityLogEntity ok = activityPopulator.activity(owner, day, LONG_NOTE, "mindset", 10, "AI");

        int[] written = new int[1];
        assertThatCode(() -> written[0] = noteEmbeddingCatchUp.run(owner, day)).doesNotThrowAnyException();

        assertThat(written[0]).isEqualTo(1);
        assertThat(memoryEmbeddingRepository.existsByKindAndRefId(
                NarrativeNoteSource.ACTIVITY_NOTE, ok.getId())).isTrue();
        assertThat(memoryEmbeddingRepository.existsByKindAndRefId(
                NarrativeNoteSource.ACTIVITY_NOTE, failing.getId())).isFalse();
    }
}

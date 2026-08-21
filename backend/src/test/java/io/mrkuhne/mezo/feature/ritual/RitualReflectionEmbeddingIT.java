package io.mrkuhne.mezo.feature.ritual;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.RitualCloseRequest;
import io.mrkuhne.mezo.api.dto.RitualDayResponse;
import io.mrkuhne.mezo.api.dto.RitualReflectionRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * Acceptance test for the W1.2 evening-reflection embed pipeline (bd mezo-b3pp.2, spec §5.2):
 * POST /api/ritual/close → AFTER_COMMIT {@code RitualClosedEvent} → async {@code
 * ReflectionEmbeddingListener} → {@code MemoryEmbeddingWriter.writeReflection} → exactly ONE
 * {@code memory_embedding(kind=reflection)} row. The {@code JournalEmbeddingEventIT} idiom: NOT
 * {@code @Transactional} so the server-side commit really happens and AFTER_COMMIT genuinely
 * fires, Awaitility rides out the async hop.
 *
 * <p>The two "nothing is embedded" cases below use Awaitility's {@code during(...)} settle window
 * rather than a bare read: in the skipped-prose case the close DOES publish and the listener DOES
 * run (it just finds nothing embeddable), so a synchronous assertion could pass before the async
 * hop even started. Where a settle window alone would still be weak, a positive control follows
 * it — the vector that DOES appear after the close proves the earlier wait was not vacuous.
 */
@ActiveProfiles("companion-fake")
class RitualReflectionEmbeddingIT extends ApiIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private RitualDayRepository ritualDayRepository;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private List<MemoryEmbeddingEntity> reflectionRows(UUID owner) {
        return memoryEmbeddingRepository.findAll().stream()
            .filter(r -> r.getCreatedBy().equals(owner))
            .filter(r -> MemoryEmbeddingEntity.KIND_REFLECTION.equals(r.getKind()))
            .toList();
    }

    private void saveReflection(String text) {
        putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(TODAY).text(text).build(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
    }

    private void close() {
        postForBody("/api/ritual/close", RitualCloseRequest.builder().date(TODAY).build(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
    }

    private UUID ritualDayId(UUID owner) {
        return ritualDayRepository.findByCreatedByAndRitualDate(owner, TODAY).orElseThrow().getId();
    }

    @Test
    void testClose_shouldEmbedTheReflection_whenProseWasWritten() {
        UUID owner = ownerId();
        saveReflection("Nehéz nap volt, de bírtam.");

        close();

        UUID dayId = ritualDayId(owner);
        await().atMost(10, SECONDS).untilAsserted(() -> {
            List<MemoryEmbeddingEntity> rows = reflectionRows(owner);
            assertThat(rows).hasSize(1);
            MemoryEmbeddingEntity row = rows.getFirst();
            assertThat(row.getRefId()).isEqualTo(dayId);
            assertThat(row.getContent()).isEqualTo("Nehéz nap volt, de bírtam.");
            assertThat(row.getOccurredOn()).isEqualTo(TODAY);
            assertThat(row.getEmbedding()).hasSize(EmbeddingPort.DIMENSIONS);
        });
    }

    @Test
    void testClose_shouldEmbedNothing_whenTheReflectionWasSkipped() {
        UUID owner = ownerId();

        close();

        // the close publishes even with no prose — hold the assertion across the async hop
        await().during(2, SECONDS).atMost(6, SECONDS)
            .untilAsserted(() -> assertThat(reflectionRows(owner)).isEmpty());
    }

    @Test
    void testSaveReflection_shouldNotEmbed_beforeTheClose() {
        UUID owner = ownerId();

        saveReflection("Zárás előtti próza.");

        await().during(2, SECONDS).atMost(6, SECONDS)
            .untilAsserted(() -> assertThat(reflectionRows(owner)).isEmpty());

        // positive control: the SAME prose becomes recallable once the day closes, so the empty
        // window above pinned "not yet", not "the pipeline is dead"
        close();
        await().atMost(10, SECONDS).untilAsserted(() ->
            assertThat(reflectionRows(owner)).singleElement()
                .satisfies(r -> assertThat(r.getContent()).isEqualTo("Zárás előtti próza.")));
    }

    @Test
    void testSaveReflection_shouldReembedInPlace_whenTheProseIsEditedAfterTheClose() {
        UUID owner = ownerId();
        saveReflection("Eredeti este.");
        close();
        UUID dayId = ritualDayId(owner);

        await().atMost(10, SECONDS).untilAsserted(() -> assertThat(memoryEmbeddingRepository
            .findByKindAndRefId(MemoryEmbeddingEntity.KIND_REFLECTION, dayId)).isPresent());
        MemoryEmbeddingEntity before = memoryEmbeddingRepository
            .findByKindAndRefId(MemoryEmbeddingEntity.KIND_REFLECTION, dayId).orElseThrow();
        UUID rowIdBefore = before.getId();
        float[] vectorBefore = before.getEmbedding();

        saveReflection("Utólag pontosítom.");

        await().atMost(10, SECONDS).untilAsserted(() -> assertThat(memoryEmbeddingRepository
            .findByKindAndRefId(MemoryEmbeddingEntity.KIND_REFLECTION, dayId))
            .hasValueSatisfying(row -> {
                assertThat(row.getId()).isEqualTo(rowIdBefore); // update in place, never a 2nd row
                assertThat(row.getContent()).isEqualTo("Utólag pontosítom.");
                // the fake adapter is deterministic per input text, so a changed vector proves
                // the prose was genuinely re-embedded rather than only re-stored
                assertThat(row.getEmbedding()).isNotEqualTo(vectorBefore);
            }));
        assertThat(reflectionRows(owner)).hasSize(1);
    }

    @Test
    void testSaveReflection_shouldRemoveTheVector_whenTheProseIsClearedAfterTheClose() {
        UUID owner = ownerId();
        saveReflection("Ezt mégis törlöm.");
        close();
        UUID dayId = ritualDayId(owner);

        await().atMost(10, SECONDS).untilAsserted(() -> assertThat(memoryEmbeddingRepository
            .findByKindAndRefId(MemoryEmbeddingEntity.KIND_REFLECTION, dayId)).isPresent());

        saveReflection("   "); // blank clears the prose — an erased evening must stop being recallable

        await().atMost(10, SECONDS).untilAsserted(() -> assertThat(reflectionRows(owner)).isEmpty());

        // the clear must be a SOFT delete, not a hard one: findAll() above is
        // @SQLRestriction-filtered, so it reads identically either way. The row has to SURVIVE —
        // uq_memory_embedding_kind_ref_id is plain (not partial), so the dead row still owns the
        // (kind, ref_id) slot and a later re-write has to revive THIS row rather than insert.
        assertThat(memoryEmbeddingRepository.findByKindAndRefIdIncludingDeleted(
            MemoryEmbeddingEntity.KIND_REFLECTION, dayId))
            .hasValueSatisfying(row -> assertThat(row.isDeleted()).isTrue());
    }

    @Test
    void testSaveReflection_shouldReviveTheVector_whenProseIsWrittenAgainAfterAClear() {
        UUID owner = ownerId();
        saveReflection("Első este.");
        close();
        UUID dayId = ritualDayId(owner);

        await().atMost(10, SECONDS).untilAsserted(() -> assertThat(memoryEmbeddingRepository
            .findByKindAndRefId(MemoryEmbeddingEntity.KIND_REFLECTION, dayId)).isPresent());
        UUID rowIdBefore = memoryEmbeddingRepository
            .findByKindAndRefId(MemoryEmbeddingEntity.KIND_REFLECTION, dayId).orElseThrow().getId();

        saveReflection("  "); // clear → soft delete, but the (kind, ref_id) slot stays occupied
        await().atMost(10, SECONDS).untilAsserted(() -> assertThat(reflectionRows(owner)).isEmpty());

        saveReflection("Mégis leírom."); // write again on the still-closed day

        // without the revive this re-write takes the insert branch, hits the plain unique
        // constraint, and the listener's catch-and-warn swallows it — the day would be silently
        // un-embeddable forever. It must instead come back to life on the SAME row.
        await().atMost(10, SECONDS).untilAsserted(() -> {
            List<MemoryEmbeddingEntity> rows = reflectionRows(owner);
            assertThat(rows).hasSize(1);
            MemoryEmbeddingEntity row = rows.getFirst();
            assertThat(row.getId()).isEqualTo(rowIdBefore);
            assertThat(row.getRefId()).isEqualTo(dayId);
            assertThat(row.getContent()).isEqualTo("Mégis leírom.");
            assertThat(row.isDeleted()).isFalse();
            assertThat(row.getEmbedding()).hasSize(EmbeddingPort.DIMENSIONS);
        });
    }
}

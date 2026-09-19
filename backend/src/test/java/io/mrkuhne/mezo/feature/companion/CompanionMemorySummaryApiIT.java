package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MemorySummaryItem;
import io.mrkuhne.mezo.api.dto.MemorySummaryListResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryVectorEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.util.UUID;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;

/** Az L1 napló-lista HTTP-kontraktusa (mezo-al1i) — rendezés, tartomány-szűrés, vetítés-jelző. */
class CompanionMemorySummaryApiIT extends ApiIntegrationTest {

    private static final LocalDate D = LocalDate.of(2026, 8, 1);
    /** mezo.companion.memory-platform.serving-embedding-version (application.yml). */
    private static final String SERVING_VERSION = "gemini-embedding-001-768-v1";
    /** A well-formed sha-256 that is NOT the item's own content hash (the column is @Pattern-ed). */
    private static final String STALE_HASH = "0".repeat(64);

    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private MemoryItemPopulator memoryItemPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository memoryItemRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private MemorySummaryListResponse list(String query) {
        return getForBody("/api/companion/memory/summary" + query, ownerAuthHeaders(),
                HttpStatus.OK, MemorySummaryListResponse.class);
    }

    /** mezo-eq85.10: the "embedded" flag is now a live serving-version {@code memory_vector} on a
     *  {@code memory_item} whose {@code source_id} is the daily_summary row's id — the same
     *  predicate {@code DenseMemoryQuery} uses for ANN eligibility. */
    private void vectorizedProjection(UUID owner, DailySummaryEntity summary) {
        MemoryItemEntity item = memoryItemPopulator.item(owner, "daily_summary", summary.getId(),
                null, summary.getNarrative(), summary.getSummaryDate(), new String[0], new String[0],
                MemoryProvenanceEnvelope.empty());
        memoryItemPopulator.vector(item, SERVING_VERSION, axisVector(0));
    }

    @Test
    void testListMemorySummaries_shouldOrderDateDescWithEmbedFlags_whenNoRangeGiven() {
        UUID owner = ownerId();
        dailySummaryPopulator.summary(owner, D, "első nap");
        DailySummaryEntity middle = dailySummaryPopulator.summary(owner, D.plusDays(5), "második nap");
        dailySummaryPopulator.summary(owner, D.plusDays(10), "harmadik nap");
        vectorizedProjection(owner, middle);

        MemorySummaryListResponse response = list("");

        assertThat(response.getItems()).extracting(MemorySummaryItem::getDate)
                .containsExactly(D.plusDays(10), D.plusDays(5), D);
        assertThat(response.getItems()).extracting(MemorySummaryItem::getEmbedded)
                .containsExactly(false, true, false);
        assertThat(response.getItems().get(1).getNarrative()).isEqualTo("második nap");
    }

    /**
     * mezo-eq85.10 fix round 1, FIX 7 — the {@code summaries} half of the eligibility predicate,
     * case by case. Each of these rows LOOKS embedded but is ANN-ineligible, so the napló dot must
     * stay dark: a serving-generation mismatch (the case only {@code overview} covered), a
     * suppressed item, a vector whose {@code embedded_content_hash} no longer matches the text,
     * and a vector that is not {@code ready}.
     */
    @Test
    void testListMemorySummaries_shouldNotFlagEmbedded_whenTheVectorIsAnolderGeneration() {
        UUID owner = ownerId();
        DailySummaryEntity summary = dailySummaryPopulator.summary(owner, D, "régi generáció");
        MemoryItemEntity item = projection(owner, summary);
        memoryItemPopulator.vector(item, "some-retired-generation-v0", axisVector(0));

        assertThat(list("").getItems()).extracting(MemorySummaryItem::getEmbedded).containsExactly(false);
    }

    @Test
    void testListMemorySummaries_shouldNotFlagEmbedded_whenTheItemIsSuppressed() {
        UUID owner = ownerId();
        DailySummaryEntity summary = dailySummaryPopulator.summary(owner, D, "elnyomott");
        MemoryItemEntity item = projection(owner, summary);
        memoryItemPopulator.vector(item, SERVING_VERSION, axisVector(0));
        item.setState(MemoryItemEntity.STATE_SUPPRESSED);
        memoryItemRepository.saveAndFlush(item);

        assertThat(list("").getItems()).extracting(MemorySummaryItem::getEmbedded).containsExactly(false);
    }

    @Test
    void testListMemorySummaries_shouldNotFlagEmbedded_whenTheTextChangedSinceEmbedding() {
        UUID owner = ownerId();
        DailySummaryEntity summary = dailySummaryPopulator.summary(owner, D, "átírt nap");
        memoryItemPopulator.vector(projection(owner, summary), SERVING_VERSION, axisVector(0),
                MemoryVectorEntity.STATUS_READY, null, STALE_HASH);

        assertThat(list("").getItems()).extracting(MemorySummaryItem::getEmbedded).containsExactly(false);
    }

    @Test
    void testListMemorySummaries_shouldNotFlagEmbedded_whenTheVectorIsPendingOrFailed() {
        UUID owner = ownerId();
        DailySummaryEntity pending = dailySummaryPopulator.summary(owner, D, "függőben");
        memoryItemPopulator.vector(projection(owner, pending), SERVING_VERSION, null,
                MemoryVectorEntity.STATUS_PENDING, null, null);
        DailySummaryEntity failed = dailySummaryPopulator.summary(owner, D.plusDays(1), "hibás");
        memoryItemPopulator.vector(projection(owner, failed), SERVING_VERSION, axisVector(1),
                MemoryVectorEntity.STATUS_FAILED, "PROVIDER_ERROR", null);

        assertThat(list("").getItems()).extracting(MemorySummaryItem::getEmbedded)
                .containsExactly(false, false);
    }

    /** The projection row only — the caller attaches whatever vector the case needs. */
    private MemoryItemEntity projection(UUID owner, DailySummaryEntity summary) {
        return memoryItemPopulator.item(owner, "daily_summary", summary.getId(), null,
                summary.getNarrative(), summary.getSummaryDate(), new String[0], new String[0],
                MemoryProvenanceEnvelope.empty());
    }

    @Test
    void testListMemorySummaries_shouldFilterInclusive_whenRangeGiven() {
        UUID owner = ownerId();
        dailySummaryPopulator.summary(owner, D, "kint");
        dailySummaryPopulator.summary(owner, D.plusDays(5), "bent");
        dailySummaryPopulator.summary(owner, D.plusDays(10), "kint");

        MemorySummaryListResponse response = list("?from=2026-08-02&to=2026-08-08");

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().getFirst().getDate()).isEqualTo(D.plusDays(5));
    }

    @Test
    void testListMemorySummaries_shouldIgnoreForeignRows_whenAnotherUserHasSummaries() {
        dailySummaryPopulator.summary(userPopulator.createUser().getId(), D, "idegen");

        assertThat(list("").getItems()).isEmpty();
    }
}

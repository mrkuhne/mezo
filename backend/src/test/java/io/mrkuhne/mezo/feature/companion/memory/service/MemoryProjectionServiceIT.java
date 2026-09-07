package io.mrkuhne.mezo.feature.companion.memory.service;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.blendVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryVectorPointQuery.PointRow;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryProjectionService.Projection;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryProjectionService.ProjectionRequest;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.assertj.core.data.Offset;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * The server-side PCA (mezo-4qyt.2). Determinism is the load-bearing property: the client caches
 * its UMAP per user and places a replayed query into the SAME space, so two calls for one user
 * must return byte-identical coordinates.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.companion.enabled=true")
class MemoryProjectionServiceIT extends AbstractIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";
    private static final int TARGET_DIMS = 50;
    private static final int SAMPLE_THRESHOLD = 5000;
    private static final int SNIPPET_CHARS = 600;

    @Autowired private MemoryProjectionService projectionService;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testProject_shouldBeDeterministic_whenCalledTwice() {
        UUID owner = databasePopulator.populateUser("projection-determinism@test.local");
        seed(owner, 0, 0, 1, 1);

        Projection first = projectionService.project(owner, request());
        Projection second = projectionService.project(owner, request());

        assertThat(itemIds(second)).isEqualTo(itemIds(first));
        assertThat(second.coordinates()).isDeepEqualTo(first.coordinates());
    }

    @Test
    void testProject_shouldSeparateTwoAxisClusters_whenVectorsAreOrthogonal() {
        UUID owner = databasePopulator.populateUser("projection-clusters@test.local");
        // Two clusters on orthogonal axes; the dominant variance direction IS the axis between
        // their centroids, so component 0 must split them cleanly.
        seed(owner, 0, 0, 0, 10, 10, 10);

        Projection projection = projectionService.project(owner, request());

        double[] component0 = Arrays.stream(projection.coordinates())
                .mapToDouble(row -> row[0])
                .toArray();
        long positive = Arrays.stream(component0).filter(value -> value > 0).count();
        assertThat(positive).isEqualTo(3L);
        double gap = Arrays.stream(component0).max().orElseThrow()
                - Arrays.stream(component0).min().orElseThrow();
        // Within a cluster the spread is exactly zero here, so any positive gap separates them;
        // the assertion is deliberately loose about the sign convention a power iteration picks.
        assertThat(gap).isGreaterThan(0.5);
    }

    @Test
    void testProject_shouldInvalidateCache_whenANewVectorLands() {
        UUID owner = databasePopulator.populateUser("projection-cache@test.local");
        seed(owner, 0, 1);

        Projection before = projectionService.project(owner, request());
        seed(owner, 20);
        Projection after = projectionService.project(owner, request());

        // The probe (ready count + newest memory_item.updated_at) invalidated it; no TTL involved.
        assertThat(before.items()).hasSize(2);
        assertThat(after.items()).hasSize(3);
    }

    @Test
    void testTransform_shouldPlaceAKnownVectorNearItsOwnCoordinates_whenTransformed() {
        UUID owner = databasePopulator.populateUser("projection-transform@test.local");
        seed(owner, 0, 1, 2, 3);

        Projection projection = projectionService.project(owner, request());
        float[] stored = projection.items().getFirst().embedding();
        float[] placed = projectionService.transform(projection, stored);

        for (int k = 0; k < projection.dims(); k++) {
            assertThat((double) placed[k])
                    .isCloseTo(projection.coordinates()[0][k], Offset.offset(1e-3));
        }
    }

    @Test
    void testProject_shouldNotDivideByZero_whenTheUserHasASingleVector() {
        UUID owner = databasePopulator.populateUser("projection-single@test.local");
        seed(owner, 0);

        Projection projection = projectionService.project(owner, request());

        // One point has no variance to decompose; dims still tells the client its array width.
        assertThat(projection.items()).hasSize(1);
        assertThat(projection.dims()).isEqualTo(1);
        assertThat(projection.coordinates()[0]).containsExactly(0f);
        assertThat(projection.sampled()).isFalse();
    }

    @Test
    void testProject_shouldFlagSampled_whenOverTheThreshold() {
        UUID owner = databasePopulator.populateUser("projection-sampled@test.local");
        seed(owner, 0, 1, 2, 3, 4);
        ProjectionRequest sampling = new ProjectionRequest(VERSION, TARGET_DIMS, 3, SNIPPET_CHARS);

        Projection projection = projectionService.project(owner, sampling);

        assertThat(projection.sampled()).isTrue();
        assertThat(projection.items()).hasSize(3);
        assertThat(projection.total()).isEqualTo(5L);
    }

    @Test
    void testProject_shouldBlendedVectorsStillProduceABasis_whenGeometryIsNotAxisAligned() {
        UUID owner = databasePopulator.populateUser("projection-blend@test.local");
        MemoryItemEntity first = item(owner, 0);
        memoryPopulator.vector(first, VERSION, axisVector(0));
        MemoryItemEntity second = item(owner, 1);
        memoryPopulator.vector(second, VERSION, blendVector(0, 1));

        Projection projection = projectionService.project(owner, request());

        assertThat(projection.dims()).isEqualTo(2);
        assertThat(projection.basis()[0]).isNotNull();
        // A real first component, not the zero vector the degenerate guard would return.
        assertThat(Arrays.stream(projection.basis()[0]).map(Math::abs).max().orElseThrow())
                .isGreaterThan(0.1);
    }

    // ==== helpers ====

    private static ProjectionRequest request() {
        return new ProjectionRequest(VERSION, TARGET_DIMS, SAMPLE_THRESHOLD, SNIPPET_CHARS);
    }

    private static List<UUID> itemIds(Projection projection) {
        return projection.items().stream().map(PointRow::itemId).toList();
    }

    /** One ready item + axis-aligned vector per given axis, one day apart for a stable order. */
    private void seed(UUID owner, int... axes) {
        for (int i = 0; i < axes.length; i++) {
            MemoryItemEntity item = item(owner, i);
            memoryPopulator.vector(item, VERSION, axisVector(axes[i]));
        }
    }

    private MemoryItemEntity item(UUID owner, int index) {
        return memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "emlék " + index + " " + UUID.randomUUID(), LocalDate.of(2026, 6, 1).plusDays(index));
    }
}

package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Test data factory for {@code memory_embedding} rows (V2.1). Vectors are hand-seeded —
 * similarity tests stage exact cosine geometry with {@link #axisVector(int)} /
 * {@link #blendVector(int, int)} instead of calling any embedding provider.
 */
@TestComponent
@RequiredArgsConstructor
public class MemoryEmbeddingPopulator {

    private final MemoryEmbeddingRepository memoryEmbeddingRepository;

    /** Any valid row — axis-aligned unit vector, unique ref_id. */
    public MemoryEmbeddingEntity embedding(UUID createdBy, String kind, LocalDate occurredOn, int axis) {
        return embedding(createdBy, kind, UUID.randomUUID(), "memory axis " + axis, occurredOn, axisVector(axis));
    }

    /** Full control. */
    public MemoryEmbeddingEntity embedding(UUID createdBy, String kind, UUID refId, String content,
                                           LocalDate occurredOn, float[] vector) {
        MemoryEmbeddingEntity entity = new MemoryEmbeddingEntity();
        entity.setCreatedBy(createdBy);
        entity.setKind(kind);
        entity.setRefId(refId);
        entity.setContent(content);
        entity.setOccurredOn(occurredOn);
        entity.setEmbedding(vector);
        return memoryEmbeddingRepository.saveAndFlush(entity);
    }

    /** Unit vector along one axis — cosine distance: same axis 0.0, different axes 1.0. */
    public static float[] axisVector(int axis) {
        float[] vector = new float[EmbeddingPort.DIMENSIONS];
        vector[axis] = 1f;
        return vector;
    }

    /** Unit vector between two axes — cosine distance to either axis ≈ 0.2929 (1 − cos 45°). */
    public static float[] blendVector(int axisA, int axisB) {
        float[] vector = new float[EmbeddingPort.DIMENSIONS];
        float component = (float) (1 / Math.sqrt(2));
        vector[axisA] = component;
        vector[axisB] = component;
        return vector;
    }
}

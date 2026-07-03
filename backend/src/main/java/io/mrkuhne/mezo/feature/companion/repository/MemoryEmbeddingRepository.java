package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface MemoryEmbeddingRepository extends JpaRepository<MemoryEmbeddingEntity, UUID> {

    /** One ANN hit — entity fields plus the cosine distance the ordering used (V2.3 ranks on it). */
    interface MemoryMatch {
        UUID getId();
        String getKind();
        UUID getRefId();
        String getContent();
        LocalDate getOccurredOn();
        double getDistance();
    }

    /**
     * ANN cosine search over the caller's memories, nearest first. Native SQL — the {@code <=>}
     * operator has no JPQL form, so {@code @SQLRestriction} does not apply and {@code is_deleted}
     * is filtered explicitly. {@code kind} null = all kinds. The query vector travels as a
     * pgvector literal (see {@link #toVectorLiteral(float[])}).
     */
    @Query(value = """
        select id, kind, ref_id as "refId", content, occurred_on as "occurredOn",
               (embedding <=> cast(:queryVector as vector)) as distance
        from memory_embedding
        where created_by = :userId
          and is_deleted = false
          and (:kind is null or kind = :kind)
        order by embedding <=> cast(:queryVector as vector)
        limit :k
        """, nativeQuery = true)
    List<MemoryMatch> findNearest(@Param("userId") UUID userId, @Param("kind") String kind,
                                  @Param("queryVector") String queryVector, @Param("k") int k);

    /** Renders a float[] as the pgvector text literal ({@code [0.1,0.2,...]}) native queries bind. */
    static String toVectorLiteral(float[] vector) {
        StringBuilder literal = new StringBuilder("[");
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) {
                literal.append(',');
            }
            literal.append(vector[i]);
        }
        return literal.append(']').toString();
    }
}

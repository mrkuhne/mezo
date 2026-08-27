package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
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

    /** The embed pipeline's idempotence probe (V2.2) — one live embedding per source unit. */
    boolean existsByKindAndRefId(String kind, UUID refId);

    /** The journal embed pipeline's update-in-place lookup (W1.1) — the live row for a source unit. */
    Optional<MemoryEmbeddingEntity> findByKindAndRefId(String kind, UUID refId);

    /**
     * The SAME row, soft-deleted ones INCLUDED — the revive lookup behind
     * {@code MemoryEmbeddingWriter}'s upsert (mezo-b3pp.2).
     *
     * <p>Native by necessity: {@code @SQLRestriction("is_deleted = false")} is applied by Hibernate
     * to every entity query — derived AND JPQL alike (see {@link #findRefIdsByCreatedByAndKind},
     * whose javadoc records the same) — so only a native query can see past it. It has to see past
     * it because {@code uq_memory_embedding_kind_ref_id} is a PLAIN unique constraint (no
     * {@code where is_deleted = false} partial predicate, unlike {@code uq_ritual_day_user_date}):
     * a soft-deleted row keeps occupying its {@code (kind, ref_id)} slot, so a later re-write of
     * the same unit must UPDATE that row back to life instead of inserting a colliding one.
     */
    @Query(value = "select * from memory_embedding where kind = :kind and ref_id = :refId",
           nativeQuery = true)
    Optional<MemoryEmbeddingEntity> findByKindAndRefIdIncludingDeleted(@Param("kind") String kind,
                                                                      @Param("refId") UUID refId);

    /** Same-day live rows of a kind — the summary replace-by-day guard (V2.2). */
    List<MemoryEmbeddingEntity> findByCreatedByAndKindAndOccurredOn(UUID createdBy, String kind, LocalDate occurredOn);

    /** Memória-obszervatórium (mezo-al1i) — vektor-darabszám rétegenként. */
    long countByCreatedByAndKind(UUID createdBy, String kind);

    /** Every populated kind for one user, with its live-vector count — the memory observatory's L1
     *  read (mezo-b3pp.22). ONE query instead of one {@code countByCreatedByAndKind} per kind: the
     *  {@code ck_memory_embedding_kind} CHECK has already grown from three values to ten, and the
     *  observatory must not need a code change every time it grows again. JPQL, so
     *  {@code @SQLRestriction("is_deleted = false")} applies — a reaped vector (mezo-b3pp.26) is
     *  correctly absent rather than inflating the reported store size. */
    interface KindCount {
        String getKind();
        long getCount();
    }

    @Query("select m.kind as kind, count(m) as count from MemoryEmbeddingEntity m "
            + "where m.createdBy = :createdBy group by m.kind order by count(m) desc, m.kind asc")
    List<KindCount> countByKindForUser(@Param("createdBy") UUID createdBy);

    /** A napló-nézet batch embed-jelzője — a kind élő ref-id-i (a @SQLRestriction JPQL-re is áll). */
    @Query("select m.refId from MemoryEmbeddingEntity m where m.createdBy = :createdBy and m.kind = :kind")
    Set<UUID> findRefIdsByCreatedByAndKind(@Param("createdBy") UUID createdBy, @Param("kind") String kind);

    /** W1.5 lifecycle (mezo-b3pp.26) — ref-id + stored content for one user's vectors of a kind:
     *  what the nightly sweep compares against the live source text to detect drift. A projection,
     *  not the entity: loading full rows here would drag a 768-float vector per note through the
     *  sweep for nothing. {@code @SQLRestriction}-filtered like every JPQL query, so a reaped
     *  vector is correctly absent — the sweep must treat "no live vector" as "needs writing", and
     *  {@link io.mrkuhne.mezo.feature.companion.embedding.MemoryEmbeddingWriter#syncNote} then
     *  revives the parked row through the upsert path. */
    interface RefContent {
        UUID getRefId();
        String getContent();
    }

    @Query("select m.refId as refId, m.content as content from MemoryEmbeddingEntity m "
            + "where m.createdBy = :createdBy and m.kind = :kind")
    List<RefContent> findRefContentByCreatedByAndKind(@Param("createdBy") UUID createdBy,
                                                      @Param("kind") String kind);

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

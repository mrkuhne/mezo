package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Child-table repository (MealItemRepository style) — always accessed conversation- and owner-scoped. */
public interface AiMessageRepository extends JpaRepository<AiMessageEntity, UUID> {

    /** Full history, oldest first — the read surface of GET .../messages. */
    List<AiMessageEntity> findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(
            UUID conversationId, UUID createdBy);

    /** Newest-first page for prompt windowing — ChatService reverses it. */
    List<AiMessageEntity> findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtDesc(
            UUID conversationId, UUID createdBy, Pageable pageable);

    /** V2.2 turn-embedding catch-up: recent assistant rows to probe for missing vectors. */
    List<AiMessageEntity> findByCreatedByAndRoleAndDeletedFalseAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(
            UUID createdBy, String role, Instant since);

    /** Karakter round-3 read layer: the owner's own chat timestamps in a window, upper-bounded so a
     *  catch-up run for a past day cannot see later activity. */
    List<AiMessageEntity> findByCreatedByAndRoleAndDeletedFalseAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(
            UUID createdBy, String role, Instant from, Instant toExclusive);

    /**
     * V2.2 turn-embedding catch-up: the user half of a turn = the closest not-later user row
     * (≤, not < — the two rows of a turn can share a flush timestamp; role disambiguates).
     */
    Optional<AiMessageEntity> findFirstByConversationIdAndRoleAndDeletedFalseAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
            UUID conversationId, String role, Instant atOrBefore);

    /** Feature-abandonment usage reads (round 2 S5, bd mezo-d58h.7.5, spec 2026-09-05 §(17)) —
     *  ROLE-SCOPED: the assistant's own replies are not the user using the chat. */
    long countByCreatedByAndRole(UUID createdBy, String role);

    boolean existsByCreatedByAndRoleAndCreatedAtAfter(UUID createdBy, String role, Instant createdAt);

    /**
     * The S9.7 provenance retention primitive (mezo-rj214.7), mirroring
     * {@code LlmLogRepository#scrubPayloadsOlderThan}: one idempotent bulk UPDATE that NULLs the
     * RESULT half of every row older than {@code cutoff}. {@code toolCalls} (the ask, including
     * its {@code why}) is deliberately untouched — irreversible by design, no row is ever
     * deleted, only this one column is cleared. The {@code tool_outcomes is not null} guard keeps
     * re-runs free: an already-scrubbed row is not counted again.
     */
    @Modifying(clearAutomatically = true)
    @Query("""
        update AiMessageEntity m
           set m.toolOutcomes = null
         where m.createdAt < :cutoff
           and m.toolOutcomes is not null
        """)
    int scrubToolOutcomesOlderThan(@Param("cutoff") Instant cutoff);
}

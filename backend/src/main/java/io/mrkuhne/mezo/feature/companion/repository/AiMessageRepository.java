package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

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

    /**
     * V2.2 turn-embedding catch-up: the user half of a turn = the closest not-later user row
     * (≤, not < — the two rows of a turn can share a flush timestamp; role disambiguates).
     */
    Optional<AiMessageEntity> findFirstByConversationIdAndRoleAndDeletedFalseAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
            UUID conversationId, String role, Instant atOrBefore);
}

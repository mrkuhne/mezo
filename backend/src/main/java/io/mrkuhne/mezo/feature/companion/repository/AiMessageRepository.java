package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** Child-table repository (MealItemRepository style) — always accessed conversation- and owner-scoped. */
public interface AiMessageRepository extends JpaRepository<AiMessageEntity, UUID> {

    /** Full history, oldest first — the read surface of GET .../messages. */
    List<AiMessageEntity> findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(
            UUID conversationId, UUID createdBy);

    /** Newest-first page for prompt windowing — ChatService reverses it. */
    List<AiMessageEntity> findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtDesc(
            UUID conversationId, UUID createdBy, Pageable pageable);
}

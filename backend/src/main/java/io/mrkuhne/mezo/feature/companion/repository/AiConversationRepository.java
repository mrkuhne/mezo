package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiConversationRepository extends OwnedRepository<AiConversationEntity> {

    /** ai_conversation has no `date` column — order by last activity instead. */
    @Override
    @Query("""
            select c from AiConversationEntity c
            where c.createdBy = :createdBy and c.deleted = false
            order by coalesce(c.lastMessageAt, c.createdAt) desc
            """)
    List<AiConversationEntity> findAllOwned(UUID createdBy);

    Optional<AiConversationEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}

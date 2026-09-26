package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamChatLineRepository extends JpaRepository<TeamChatLineEntity, UUID> {

    List<TeamChatLineEntity> findByCreatedByAndOccurredAtBetweenAndDeletedFalseOrderByOccurredAtAsc(
            UUID createdBy, Instant from, Instant to);

    long countByCreatedByAndCharacterIsNotNullAndOccurredAtBetweenAndDeletedFalse(
            UUID createdBy, Instant from, Instant to);

    List<TeamChatLineEntity> findByIdInAndCreatedBy(Collection<UUID> ids, UUID createdBy);

    boolean existsByThreadIdAndKind(UUID threadId, String kind);
}

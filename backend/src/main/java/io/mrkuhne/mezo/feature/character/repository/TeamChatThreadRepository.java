package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamChatThreadRepository extends JpaRepository<TeamChatThreadEntity, UUID> {

    Optional<TeamChatThreadEntity> findFirstByCreatedByAndFlagKeyAndStatusAndDeletedFalse(
            UUID createdBy, String flagKey, String status);

    List<TeamChatThreadEntity> findByCreatedByAndStatusAndDeletedFalseOrderByOpenedAtAsc(
            UUID createdBy, String status);

    List<TeamChatThreadEntity> findByStatusAndOpenedAtBeforeAndDeletedFalse(String status, Instant before);

    List<TeamChatThreadEntity> findByCreatedByAndOpenedAtBetweenAndDeletedFalse(
            UUID createdBy, Instant from, Instant to);

    Optional<TeamChatThreadEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}

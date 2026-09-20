package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.CharacterReplyEntity;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CharacterReplyRepository extends JpaRepository<CharacterReplyEntity, UUID> {
    List<CharacterReplyEntity>
            findByCreatedByAndSourceTypeAndSourceIdAndSourceIndexOrderByCreatedAtAsc(
                    UUID owner, String type, UUID sourceId, Integer index);

    Optional<CharacterReplyEntity> findByCreatedByAndClientRequestId(UUID owner, UUID key);

    List<CharacterReplyEntity> findTop5ByCreatedByOrderByCreatedAtDesc(UUID owner);

    List<CharacterReplyEntity> findByCreatedByOrderByCreatedAtAsc(UUID owner);

    List<CharacterReplyEntity> findByCreatedByAndIdIn(UUID owner, Collection<UUID> ids);

    @Query(
            "select r from CharacterReplyEntity r where r.createdBy=:owner and (r.status='SAVED' or"
                    + " (r.status='PROCESSING' and r.processingStartedAt < :before)) order by"
                    + " r.createdAt")
    List<CharacterReplyEntity> recoverable(UUID owner, Instant before, Pageable page);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from CharacterReplyEntity r where r.id = :id and r.createdBy = :owner")
    Optional<CharacterReplyEntity> lockOwned(UUID id, UUID owner);
}

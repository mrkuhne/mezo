package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimRevisionEntity;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface CharacterClaimRevisionRepository extends JpaRepository<CharacterClaimRevisionEntity, UUID> {
    List<CharacterClaimRevisionEntity> findByCreatedByAndClaimIdOrderByCreatedAtDesc(UUID owner, UUID claimId);
    List<CharacterClaimRevisionEntity> findByCreatedByAndOperationAndUndoneAtIsNotNull(UUID owner, String operation);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from CharacterClaimRevisionEntity r where r.createdBy = :owner and r.id = :id")
    Optional<CharacterClaimRevisionEntity> lockOwned(UUID owner, UUID id);
}

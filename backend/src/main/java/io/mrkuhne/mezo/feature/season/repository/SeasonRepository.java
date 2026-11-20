package io.mrkuhne.mezo.feature.season.repository;

import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SeasonRepository extends JpaRepository<SeasonEntity, UUID> {

    /** The owner's one active season (the partial unique index guarantees at most one). */
    @Query("select s from SeasonEntity s where s.createdBy = :owner and s.status = 'active'")
    Optional<SeasonEntity> findActive(@Param("owner") UUID owner);

    List<SeasonEntity> findByCreatedByAndDeletedFalseOrderByStartDateDesc(UUID owner);

    List<SeasonEntity> findByCreatedByAndStatus(UUID owner, String status);

    Optional<SeasonEntity> findByIdAndCreatedBy(UUID id, UUID owner);
}

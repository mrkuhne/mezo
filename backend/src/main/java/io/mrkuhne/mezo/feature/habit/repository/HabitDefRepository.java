package io.mrkuhne.mezo.feature.habit.repository;

import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HabitDefRepository extends JpaRepository<HabitDefEntity, UUID> {

    List<HabitDefEntity> findByCreatedByAndDeletedFalseOrderByPositionAsc(UUID createdBy);

    Optional<HabitDefEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<HabitDefEntity> findByCreatedByAndHabitKeyAndDeletedFalse(UUID createdBy, String habitKey);

    List<HabitDefEntity> findByChainIdAndDeletedFalse(UUID chainId);

    /**
     * Deleted-inclusive existence probe: {@code @SQLRestriction} only rewrites
     * JPQL/derived queries, not native SQL, so this is the seam that lets
     * {@code HabitCatalogService} tell "never imported" apart from "user deleted it"
     * (mezo-n5e9.1 D2 — a soft-deleted seed def must never be resurrected).
     */
    @Query(value = "select count(*) from habit_def where created_by = :userId and habit_key = :habitKey",
        nativeQuery = true)
    long countEverByCreatedByAndHabitKey(@Param("userId") UUID userId, @Param("habitKey") String habitKey);
}

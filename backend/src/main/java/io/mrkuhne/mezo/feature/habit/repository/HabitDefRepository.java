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

    List<HabitDefEntity> findByCreatedByAndAnchorHabitKeyAndDeletedFalse(UUID createdBy, String anchorHabitKey);

    /**
     * Every {@code habit_key} ever imported for a user — LIVE or soft-deleted — in ONE query:
     * {@code @SQLRestriction} only rewrites JPQL/derived queries, not native SQL, so this is the
     * seam that lets {@code HabitCatalogService} tell "never imported" apart from "user deleted
     * it" (mezo-n5e9.1 D2 — a soft-deleted seed def must never be resurrected) without an
     * O(seed-size) per-def existence probe (mezo-n5e9.1 review finding 1).
     */
    @Query(value = "select habit_key from habit_def where created_by = :userId", nativeQuery = true)
    List<String> findAllKeysEver(@Param("userId") UUID userId);
}

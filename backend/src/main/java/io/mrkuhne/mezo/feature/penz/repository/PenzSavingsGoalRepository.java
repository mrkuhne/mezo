package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzSavingsGoalEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Savings goals carry no {@code date}: bespoke owner-scoped finders. */
public interface PenzSavingsGoalRepository extends JpaRepository<PenzSavingsGoalEntity, UUID> {

    List<PenzSavingsGoalEntity> findByCreatedByAndDeletedFalseOrderByPositionAscCreatedAtAsc(UUID createdBy);

    Optional<PenzSavingsGoalEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<PenzSavingsGoalEntity> findByCreatedByAndClientRefAndDeletedFalse(UUID createdBy, UUID clientRef);

    /** The next free position at the end of the owner's live list (0 for the first goal). */
    @Query(value = """
        select coalesce(max(position) + 1, 0) from penz_savings_goal
        where created_by = :createdBy and is_deleted = false
        """, nativeQuery = true)
    int nextPosition(@Param("createdBy") UUID createdBy);

    /**
     * The idempotent phone write: inserts the goal unless the owner already has a live one with this
     * {@code clientRef} (a retry, or a concurrent duplicate). The caller reads it back by client ref.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into penz_savings_goal (created_by, name, kind, target_minor, saved_minor, due_date, note, position,
                                       client_ref)
        values (:createdBy, :name, :kind, :targetMinor, :savedMinor, :dueDate, :note, :position, :clientRef)
        on conflict (created_by, client_ref) where client_ref is not null and is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfAbsent(@Param("createdBy") UUID createdBy, @Param("name") String name, @Param("kind") String kind,
                       @Param("targetMinor") long targetMinor, @Param("savedMinor") long savedMinor,
                       @Param("dueDate") LocalDate dueDate, @Param("note") String note,
                       @Param("position") int position, @Param("clientRef") UUID clientRef);
}

package io.mrkuhne.mezo.feature.intention.repository;

import io.mrkuhne.mezo.feature.intention.entity.IntentionFocusEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface IntentionFocusRepository extends JpaRepository<IntentionFocusEntity, UUID> {

    Optional<IntentionFocusEntity> findByCreatedByAndClientRefAndDeletedFalse(UUID createdBy, UUID clientRef);

    /** Race-safe insert for a Boop retry (see JournalEntryRepository#insertIfClientRefAbsent). */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into intention_focus (created_by, focus_date, text, client_ref)
        values (:createdBy, :focusDate, :text, :clientRef)
        on conflict (created_by, client_ref) where client_ref is not null and is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfClientRefAbsent(@Param("createdBy") UUID createdBy, @Param("focusDate") LocalDate focusDate,
                                @Param("text") String text, @Param("clientRef") UUID clientRef);

    List<IntentionFocusEntity> findByCreatedByAndFocusDateAndDeletedFalseOrderByCreatedAtAsc(
        UUID createdBy, LocalDate focusDate);

    Optional<IntentionFocusEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    List<IntentionFocusEntity> findByCreatedByAndFocusDateBetweenAndDeletedFalseOrderByFocusDateAsc(
            UUID createdBy, LocalDate from, LocalDate to);
}

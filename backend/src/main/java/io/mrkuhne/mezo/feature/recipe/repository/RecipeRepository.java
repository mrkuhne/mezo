package io.mrkuhne.mezo.feature.recipe.repository;

import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

// No 'date' base field => extend JpaRepository directly (cf. PantryItemRepository), not OwnedRepository.
public interface RecipeRepository extends JpaRepository<RecipeEntity, UUID> {

    List<RecipeEntity> findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(UUID createdBy);

    Optional<RecipeEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /**
     * The owner's live recipes that have at least one line on the given shelf row (mezo-r36n9.63) — the
     * recipes whose frozen line snapshots follow when that food's numbers are replaced.
     */
    @Query("select distinct r from RecipeEntity r join r.lines l "
        + "where r.createdBy = :createdBy and r.deleted = false and l.pantryItemId = :pantryItemId")
    List<RecipeEntity> findOwnedUsingPantryItem(@Param("createdBy") UUID createdBy,
                                                @Param("pantryItemId") UUID pantryItemId);

    /** The owner's live recipe created with this idempotency key (mezo-dguzv). */
    Optional<RecipeEntity> findByCreatedByAndClientRefAndDeletedFalse(UUID createdBy, UUID clientRef);

    /**
     * Race-safe claim for a retried create (the meal / journal shape): writes only the header, and a
     * concurrent insert of the same {@code clientRef} makes this one wait and then do nothing — no unique
     * violation, so the caller's transaction is never aborted. Returns 1 when this call created the row;
     * the caller reads it back and fills the rest only when it was the creator.
     */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into recipe (created_by, name, category, client_ref)
        values (:createdBy, :name, :category, :clientRef)
        on conflict (created_by, client_ref) where client_ref is not null and is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfClientRefAbsent(@Param("createdBy") UUID createdBy, @Param("name") String name,
                                @Param("category") String category, @Param("clientRef") UUID clientRef);
}

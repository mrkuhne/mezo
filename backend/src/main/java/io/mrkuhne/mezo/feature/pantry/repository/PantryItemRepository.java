package io.mrkuhne.mezo.feature.pantry.repository;

import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * No 'date' base field => extend JpaRepository directly (cf. GoalRepository), not OwnedRepository.
 * Since S4 (mezo-qw37.4) the definition lives on {@code catalog}; every finder that hands rows to a
 * mapper or a name reader {@code join fetch}es it so no caller trips a LazyInitializationException
 * or an N+1. {@code deleted = false} is belt-and-braces with the entity's @SQLRestriction — keep both.
 */
public interface PantryItemRepository extends JpaRepository<PantryItemEntity, UUID> {

    /** The owner's live shelf, alphabetical by the DEFINITION name (kept name for the ~15 callers). */
    @Query("select i from PantryItemEntity i join fetch i.catalog c "
        + "where i.createdBy = :createdBy and i.deleted = false order by c.name asc")
    List<PantryItemEntity> findByCreatedByAndDeletedFalseOrderByNameAsc(@Param("createdBy") UUID createdBy);

    @Query("select i from PantryItemEntity i join fetch i.catalog "
        + "where i.id = :id and i.createdBy = :createdBy and i.deleted = false")
    Optional<PantryItemEntity> findByIdAndCreatedByAndDeletedFalse(@Param("id") UUID id, @Param("createdBy") UUID createdBy);

    /** Batch fetch for the recipe/meal fit passes (ids come from OWNED lines; @SQLRestriction hides deleted rows). */
    @Query("select i from PantryItemEntity i join fetch i.catalog where i.id in :ids")
    List<PantryItemEntity> findAllWithCatalogByIdIn(@Param("ids") Collection<UUID> ids);

    /** Unscoped by-id read with the definition attached (ProtocolService's name lookups). */
    @Query("select i from PantryItemEntity i join fetch i.catalog where i.id = :id")
    Optional<PantryItemEntity> findWithCatalogById(@Param("id") UUID id);

    /** The from-catalog idempotency key: one live row per (owner, definition). */
    Optional<PantryItemEntity> findByCreatedByAndCatalog_IdAndDeletedFalse(UUID createdBy, UUID catalogId);
}

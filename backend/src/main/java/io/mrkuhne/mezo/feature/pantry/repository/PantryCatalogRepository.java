package io.mrkuhne.mezo.feature.pantry.repository;

import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Global (not owner-scoped) definition catalog — see PantryCatalogEntity for the master/user split. */
public interface PantryCatalogRepository extends JpaRepository<PantryCatalogEntity, UUID> {

    /** Natural-key lookup, deleted rows INCLUDED (the caller revives or binds). {@code brandKey} = lowercased brand or "". */
    @Query("select c from PantryCatalogEntity c where lower(c.name) = lower(:name) "
        + "and lower(coalesce(c.brand, '')) = :brandKey")
    Optional<PantryCatalogEntity> findByNaturalKeyRaw(@Param("name") String name, @Param("brandKey") String brandKey);

    default Optional<PantryCatalogEntity> findByNaturalKey(String name, String brand) {
        return findByNaturalKeyRaw(name, brand == null ? "" : brand.strip().toLowerCase());
    }

    /** {@code like} is already lowercased + %-wrapped by the service. Two methods (no `:kind is null`) keep the bind types explicit. */
    @Query("select c from PantryCatalogEntity c where c.deleted = false "
        + "and (lower(c.name) like :like or lower(coalesce(c.brand, '')) like :like) order by c.name asc")
    List<PantryCatalogEntity> searchAll(@Param("like") String like, Limit limit);

    @Query("select c from PantryCatalogEntity c where c.deleted = false and c.kind = :kind "
        + "and (lower(c.name) like :like or lower(coalesce(c.brand, '')) like :like) order by c.name asc")
    List<PantryCatalogEntity> searchByKind(@Param("like") String like, @Param("kind") String kind, Limit limit);

    /** The live global index the AI name matcher is built from. */
    List<PantryCatalogEntity> findByDeletedFalseOrderByNameAsc();

    /** Master rows (loader-owned). */
    List<PantryCatalogEntity> findByCreatedByIsNull();
}

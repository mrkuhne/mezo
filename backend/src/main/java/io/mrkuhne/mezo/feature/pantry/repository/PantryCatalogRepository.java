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

    /**
     * Natural-key lookup, deleted rows INCLUDED (the caller revives or binds).
     *
     * <p>BOTH halves are trimmed and case-folded by POSTGRES, never by Java: the key must be folded
     * by exactly one implementation. Where {@code String.toLowerCase} and Postgres {@code lower()}
     * disagree (Turkish dotted I, Greek final sigma) a Java-folded lookup would miss, insert, hit
     * {@code uq_pantry_catalog_natural}, miss the re-lookup and surface as a 500.
     * {@code brandKey} is the caller's brand or {@code ""} — never null, so {@code coalesce} stays
     * on the column side and Hibernate needs no type hint for the parameter.
     */
    @Query("select c from PantryCatalogEntity c "
        + "where lower(trim(c.name)) = lower(trim(:name)) "
        + "and lower(trim(coalesce(c.brand, ''))) = lower(trim(:brandKey))")
    Optional<PantryCatalogEntity> findByNaturalKeyRaw(@Param("name") String name, @Param("brandKey") String brandKey);

    /**
     * The natural key is {@code (lower(trim(name)), lower(trim(coalesce(brand, ''))))} — the same
     * expression as the unique index {@code uq_pantry_catalog_natural}. Trimming lives in the key
     * itself (not only in the writers) so a legacy row stored as {@code "Túró "} is still found by
     * {@code findByNaturalKey("Túró")} instead of becoming an unreachable duplicate definition.
     */
    default Optional<PantryCatalogEntity> findByNaturalKey(String name, String brand) {
        return findByNaturalKeyRaw(name == null ? "" : name, brand == null ? "" : brand);
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

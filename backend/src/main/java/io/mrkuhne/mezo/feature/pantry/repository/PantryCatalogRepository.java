package io.mrkuhne.mezo.feature.pantry.repository;

import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    /**
     * {@code like} is already lowercased, TRIMMED and %-wrapped by the service. Two methods
     * (no `:kind is null`) keep the bind types explicit. {@code lower(trim(...))} mirrors the
     * natural key's fold so the search path cannot drift from the key path (mezo-imet) — a
     * legacy row stored as {@code "Túró "} is matched by the same expression that keys it.
     */
    @Query("select c from PantryCatalogEntity c where c.deleted = false and c.status = 'verified' "
        + "and (lower(trim(c.name)) like :like or lower(trim(coalesce(c.brand, ''))) like :like) "
        + "order by c.name asc")
    List<PantryCatalogEntity> searchAll(@Param("like") String like, Limit limit);

    @Query("select c from PantryCatalogEntity c where c.deleted = false and c.status = 'verified' "
        + "and c.kind = :kind "
        + "and (lower(trim(c.name)) like :like or lower(trim(coalesce(c.brand, ''))) like :like) "
        + "order by c.name asc")
    List<PantryCatalogEntity> searchByKind(@Param("like") String like, @Param("kind") String kind, Limit limit);

    /**
     * The live global index the AI name matcher and the Receptműhely are built from. Status-scoped
     * on purpose (mezo-qooi): an unreviewed draft must not be auto-matched into somebody's meal.
     * Callers pass {@link PantryCatalogEntity#STATUS_VERIFIED}.
     */
    List<PantryCatalogEntity> findByDeletedFalseAndStatusOrderByNameAsc(String status);

    /**
     * Master rows (loader-owned), soft-deleted ones INCLUDED — deliberately unfiltered, like
     * {@link #findByNaturalKey}: the entity carries no {@code @SQLRestriction} precisely so a
     * dead master row stays visible to whoever needs to revive or count it, and every caller
     * that wants only live rows filters {@code deleted} itself. Today the only caller is
     * {@code PantryCatalogLoaderIT}, which counts the seeded master set across a re-run
     * (mezo-gmy0).
     */
    List<PantryCatalogEntity> findByCreatedByIsNull();

    /**
     * Fills {@code saturated_fat_g} from a MACRO-IDENTICAL sibling row that already carries it
     * (mezo-mxmh S3). Not an estimate — a transfer.
     *
     * <p>The live catalog holds the same foods twice: the seeded English masters and the user's own
     * Hungarian-named rows ("Olívaolaj"/"Olive oil", "Kacsazsír"/"Duck fat"), with byte-identical
     * macros. 121 of the 134 gapped rows have exactly such a twin, and none has a conflicting one —
     * so the value can be moved rather than guessed, which is strictly better than re-deriving it
     * from a food-composition model.
     *
     * <p>Safety is in the {@code having count(distinct saturated_fat_g) = 1}: a macro signature
     * that two rows disagree about is skipped entirely rather than resolved by picking one.
     * {@code IS NULL} on the target makes it idempotent and keeps it off any value a real label
     * already supplied.
     */
    @Modifying
    @Query(value = """
        update pantry_catalog c
           set saturated_fat_g = t.sf
          from (select kcal, protein_g, carbs_g, fat_g, min(saturated_fat_g) sf
                  from pantry_catalog
                 where is_deleted = false and saturated_fat_g is not null
                   and kcal is not null and protein_g is not null
                   and carbs_g is not null and fat_g is not null
                 group by kcal, protein_g, carbs_g, fat_g
                having count(distinct saturated_fat_g) = 1) t
         where c.is_deleted = false
           and c.saturated_fat_g is null
           and c.kcal = t.kcal and c.protein_g = t.protein_g
           and c.carbs_g = t.carbs_g and c.fat_g = t.fat_g
        """, nativeQuery = true)
    int backfillSaturatedFatFromMacroTwin();

    /**
     * A fat-free row's zero is a FACT, not an estimate (mezo-mxmh S3): nothing with no fat can carry
     * saturated fat. Stating it turns 23 live rows from "nincs adat" — which degrades the
     * Zsírminőség dimension for every meal that contains them — into a real, correct zero.
     */
    @Modifying
    @Query(value = """
        update pantry_catalog
           set saturated_fat_g = 0
         where is_deleted = false and saturated_fat_g is null and fat_g = 0
        """, nativeQuery = true)
    int backfillZeroSaturatedFatOnFatFreeRows();
}

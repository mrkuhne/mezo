package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzCategoryEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Categories carry no {@code date}: bespoke owner-scoped finders. */
public interface PenzCategoryRepository extends JpaRepository<PenzCategoryEntity, UUID> {

    List<PenzCategoryEntity> findByCreatedByAndDeletedFalseOrderByKindAscPositionAscNameAsc(UUID createdBy);

    Optional<PenzCategoryEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<PenzCategoryEntity> findFirstByCreatedByAndKindAndNameIgnoreCaseAndDeletedFalse(UUID createdBy, String kind,
                                                                                           String name);

    /** Every category row the owner EVER had, soft-deleted included — the defaults are seeded only when 0. */
    @Query(value = "select count(*) from penz_category where created_by = :createdBy", nativeQuery = true)
    long countEverOwned(@Param("createdBy") UUID createdBy);

    /** Seeds one default category; a concurrent seed of the same name is a no-op. */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into penz_category (created_by, name, kind, icon, position)
        values (:createdBy, :name, :kind, :icon, :position)
        on conflict (created_by, kind, lower(name)) where is_deleted = false do nothing
        """, nativeQuery = true)
    int insertDefault(@Param("createdBy") UUID createdBy, @Param("name") String name, @Param("kind") String kind,
                      @Param("icon") String icon, @Param("position") int position);
}

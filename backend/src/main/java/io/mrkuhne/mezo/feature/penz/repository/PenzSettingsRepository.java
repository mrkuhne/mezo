package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzSettingsEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** One live row per owner; date-less, so bespoke finders (no {@code OwnedRepository}). */
public interface PenzSettingsRepository extends JpaRepository<PenzSettingsEntity, UUID> {

    Optional<PenzSettingsEntity> findByCreatedByAndDeletedFalse(UUID createdBy);

    /** Makes sure the owner has the one live settings row (a concurrent first access never duplicates it). */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into penz_settings (created_by, practice_monthly_minor)
        values (:createdBy, :practiceMinor)
        on conflict (created_by) where is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfAbsent(@Param("createdBy") UUID createdBy, @Param("practiceMinor") long practiceMinor);
}

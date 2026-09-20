package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.CompanionPreferencesEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompanionPreferencesRepository extends JpaRepository<CompanionPreferencesEntity, UUID> {
    Optional<CompanionPreferencesEntity> findByCreatedByAndDeletedFalse(UUID createdBy);

    // Atomic singleton upsert: concurrent first saves cannot violate the live-owner uniqueness.
    @Modifying
    @Query(value = """
        insert into companion_preferences(created_by, about_me, custom_instructions, use_learned_profile)
        values (:owner, :about, :instructions, :learned)
        on conflict (created_by) where is_deleted = false
        do update set about_me = excluded.about_me, custom_instructions = excluded.custom_instructions,
                      use_learned_profile = excluded.use_learned_profile
        """, nativeQuery = true)
    void upsert(@Param("owner") UUID owner, @Param("about") String about,
                @Param("instructions") String instructions, @Param("learned") boolean learned);
}

package io.mrkuhne.mezo.feature.companion.reflection.repository;

import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectMuteEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Owned reads for {@code effect_mute} — every finder filters {@code created_by} in SQL. */
public interface EffectMuteRepository extends JpaRepository<EffectMuteEntity, UUID> {

    List<EffectMuteEntity> findByCreatedByAndDeletedFalse(UUID createdBy);

    Optional<EffectMuteEntity> findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(
            UUID createdBy, String subjectKind, String subjectKey);
}

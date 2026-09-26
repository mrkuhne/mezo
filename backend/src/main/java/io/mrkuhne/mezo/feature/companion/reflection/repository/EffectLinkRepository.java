package io.mrkuhne.mezo.feature.companion.reflection.repository;

import io.mrkuhne.mezo.feature.companion.reflection.entity.EffectLinkEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Owned reads for {@code effect_link} — every finder filters {@code created_by} in SQL. */
public interface EffectLinkRepository extends JpaRepository<EffectLinkEntity, UUID> {

    List<EffectLinkEntity> findByCreatedByAndDeletedFalse(UUID createdBy);

    List<EffectLinkEntity> findByCreatedByAndSubjectKindAndSubjectKeyAndDeletedFalse(
            UUID createdBy, String subjectKind, String subjectKey);
}

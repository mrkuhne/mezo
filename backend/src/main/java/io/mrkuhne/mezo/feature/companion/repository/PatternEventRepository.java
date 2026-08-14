package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PatternEventRepository extends JpaRepository<PatternEventEntity, UUID> {

    List<PatternEventEntity> findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(
            UUID createdBy, UUID patternId);
}

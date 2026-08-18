package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatternEventRepository extends JpaRepository<PatternEventEntity, UUID> {

    List<PatternEventEntity> findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(
            UUID createdBy, UUID patternId);

    /** Feed (mezo-gzhp.1): the last snapshot before this one — to detect a band crossing. */
    Optional<PatternEventEntity> findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
            UUID createdBy, UUID patternId, String kind);
}

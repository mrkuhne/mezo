package io.mrkuhne.mezo.feature.people.repository;

import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Mention orders by {@code ts} (timestamptz), not the {@code OwnedRepository} {@code date} field. */
public interface MentionRepository extends JpaRepository<MentionEntity, UUID> {

    List<MentionEntity> findAllByCreatedByAndDeletedFalseOrderByTsDesc(UUID createdBy);
}

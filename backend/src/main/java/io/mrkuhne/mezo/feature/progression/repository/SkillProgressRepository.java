package io.mrkuhne.mezo.feature.progression.repository;

import io.mrkuhne.mezo.feature.progression.entity.SkillProgressEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Date-less owned entity → extend JpaRepository directly (not the date-ordered OwnedRepository);
// all finders are createdBy-scoped for ownership isolation.
public interface SkillProgressRepository extends JpaRepository<SkillProgressEntity, UUID> {

    Optional<SkillProgressEntity> findByCreatedByAndSkillKey(UUID createdBy, String skillKey);

    List<SkillProgressEntity> findByCreatedByOrderBySkillKeyAsc(UUID createdBy);
}

package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.progression.entity.SkillProgressEntity;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class SkillProgressPopulator {

    private final SkillProgressRepository repository;

    public SkillProgressEntity createSkill(UUID createdBy, String skillKey, String kind,
        long cumulativeXp, int level) {
        SkillProgressEntity e = new SkillProgressEntity();
        e.setCreatedBy(createdBy);
        e.setSkillKey(skillKey);
        e.setSkillKind(kind);
        e.setCumulativeXp(cumulativeXp);
        e.setCurrentLevel(level);
        return repository.saveAndFlush(e);
    }
}

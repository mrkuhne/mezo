package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.SkillProgressPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ProgressionPopulatorIT extends AbstractIntegrationTest {

    @Autowired private SkillProgressPopulator skillProgressPopulator;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testCreateSkill_shouldPersistSeededProgress_whenInvoked() {
        UUID user = databasePopulator.populateUser("pop@test.local");
        skillProgressPopulator.createSkill(user, "quad", "MUSCLE", 580L, 4);

        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "quad"))
            .get()
            .satisfies(s -> {
                assertThat(s.getCumulativeXp()).isEqualTo(580L);
                assertThat(s.getCurrentLevel()).isEqualTo(4);
            });
    }
}

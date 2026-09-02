package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class LifeGoalEntityIT extends AbstractIntegrationTest {

    @Autowired private LifeGoalPopulator populator;
    @Autowired private LifeGoalRepository goalRepository;
    @Autowired private LifeGoalPillarRepository pillarRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;

    // AbstractIntegrationTest does not run the demodata seed, so the owner app_user row is
    // find-or-created here (mirrors GratitudeEmbeddingEventIT's ownerId() pattern) rather than
    // assumed to pre-exist as the brief's literal appUserRepository.findByEmail(...) implied.
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testSave_shouldRoundTripJsonb_whenPillarHasSourceAndRule() {
        LifeGoalEntity g = populator.goal(ownerId(), "draft");
        LifeGoalPillarEntity p = populator.sleepPillar(g);

        LifeGoalPillarEntity found = pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(g.getId()).get(0);
        assertThat(found.getId()).isEqualTo(p.getId());
        assertThat(found.getSource().type()).isEqualTo("metric");
        assertThat(found.getSource().key()).isEqualTo("SLEEP_DURATION_H");
        assertThat(found.getRule().threshold()).isEqualByComparingTo("7.0");
        assertThat(goalRepository.findByIdAndCreatedByAndDeletedFalse(g.getId(), ownerId())).isPresent();
    }

    @Test
    void testSave_shouldRejectUnknownDimension_whenCheckViolated() {
        LifeGoalEntity g = new LifeGoalEntity();
        g.setCreatedBy(ownerId());
        g.setTitle("x");
        g.setDimension("fame");
        g.setStartDate(java.time.LocalDate.of(2026, 9, 1));
        assertThatThrownBy(() -> goalRepository.saveAndFlush(g)).isInstanceOf(DataIntegrityViolationException.class);
    }
}

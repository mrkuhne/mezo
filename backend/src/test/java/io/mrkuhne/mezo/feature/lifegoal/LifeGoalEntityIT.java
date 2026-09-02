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

    // The ownership invariant of the WHOLE slice: LifeGoalService.requireOwned reads through
    // findByIdAndCreatedByAndDeletedFalse, and LifeGoalApiIT only probes it with a random
    // nonexistent uuid — which a regression to plain findById would still answer 404 for. This
    // proves the createdBy predicate itself: a REAL, existing row owned by someone else is
    // invisible to the owner (missing and foreign are indistinguishable, both 404).
    @Test
    void testFindByIdAndCreatedBy_shouldBeEmpty_whenGoalBelongsToAnotherUser() {
        UUID otherId = databasePopulator.populateUser("other-owner@test.local");
        LifeGoalEntity foreign = populator.goal(otherId, "active");
        populator.sleepPillar(foreign);

        // Sanity: the row really exists and IS visible to its own owner.
        assertThat(goalRepository.findById(foreign.getId())).isPresent();
        assertThat(goalRepository.findByIdAndCreatedByAndDeletedFalse(foreign.getId(), otherId)).isPresent();

        assertThat(goalRepository.findByIdAndCreatedByAndDeletedFalse(foreign.getId(), ownerId())).isEmpty();
        assertThat(goalRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(ownerId()))
            .noneSatisfy(g -> assertThat(g.getId()).isEqualTo(foreign.getId()));
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

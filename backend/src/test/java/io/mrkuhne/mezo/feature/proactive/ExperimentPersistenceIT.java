package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ExperimentPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ExperimentPersistenceIT extends AbstractIntegrationTest {

    private static final List<String> LIVE = List.of(
            ExperimentEntity.STATUS_PROPOSED, ExperimentEntity.STATUS_ACTIVE, ExperimentEntity.STATUS_COMPLETED);

    @Autowired
    private ExperimentRepository repository;

    @Autowired
    private ExperimentPopulator populator;

    @Autowired
    private UserPopulator userPopulator;

    @Test
    void testSave_shouldRoundTripProposedRow_whenPersisted() {
        UUID user = userPopulator.createUser("exp-rt@test.local").getId();
        populator.experiment(user, ExperimentEntity.STATUS_PROPOSED,
                PredictionEntity.METRIC_SLEEP_AVG, PredictionEntity.DIRECTION_UP);
        ExperimentEntity found = repository
                .findByCreatedByAndStatusInOrderByGeneratedAtDesc(user, LIVE).getFirst();
        assertThat(found.getStartDate()).isNull();
        assertThat(found.getOutcomeGood()).isNull();
        assertThat(found.getTotalDays()).isEqualTo(7);
    }

    @Test
    void testSave_shouldRejectRow_whenStatusOutsideVocabulary() {
        UUID user = userPopulator.createUser("exp-ck@test.local").getId();
        // the entity's @Pattern guard fires before the DB CHECK (the PatternEntity template)
        assertThatThrownBy(() -> populator.experiment(user, "bogus",
                PredictionEntity.METRIC_SLEEP_AVG, PredictionEntity.DIRECTION_UP))
                .isInstanceOf(ConstraintViolationException.class);
    }

    @Test
    void testFindLive_shouldExcludeDismissedAndScopeToOwner_whenMixed() {
        UUID user = userPopulator.createUser("exp-live@test.local").getId();
        UUID other = userPopulator.createUser("exp-other@test.local").getId();
        populator.experiment(user, ExperimentEntity.STATUS_PROPOSED,
                PredictionEntity.METRIC_SLEEP_AVG, PredictionEntity.DIRECTION_UP);
        populator.experiment(user, ExperimentEntity.STATUS_DISMISSED,
                PredictionEntity.METRIC_WEIGHT_TREND, PredictionEntity.DIRECTION_DOWN);
        populator.experiment(other, ExperimentEntity.STATUS_PROPOSED,
                PredictionEntity.METRIC_SLEEP_AVG, PredictionEntity.DIRECTION_UP);

        List<ExperimentEntity> live = repository.findByCreatedByAndStatusInOrderByGeneratedAtDesc(user, LIVE);

        assertThat(live).hasSize(1);   // dismissed excluded, other user's row excluded
        assertThat(repository.countByCreatedByAndStatusIn(user,
                List.of(ExperimentEntity.STATUS_PROPOSED, ExperimentEntity.STATUS_ACTIVE))).isEqualTo(1);
    }
}

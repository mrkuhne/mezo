package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PredictionPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class PredictionPersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK = LocalDate.of(2026, 6, 29);

    @Autowired
    private PredictionRepository repository;

    @Autowired
    private PredictionPopulator populator;

    @Autowired
    private UserPopulator userPopulator;

    @Test
    void testSave_shouldRoundTripWithNullConfidence_whenPredictionPersisted() {
        UUID user = userPopulator.createUser("pred-rt@test.local").getId();
        populator.prediction(user, WEEK, PredictionEntity.METRIC_WEIGHT_TREND,
                PredictionEntity.DIRECTION_DOWN, PredictionEntity.STATUS_PENDING);
        List<PredictionEntity> found = repository.findByCreatedByOrderByValidFromDescGeneratedAtDesc(user);
        assertThat(found).hasSize(1);
        assertThat(found.getFirst().getConfidence()).isNull();
        assertThat(found.getFirst().getValidTo()).isEqualTo(WEEK.plusDays(6));
        assertThat(repository.existsByCreatedByAndWeekStart(user, WEEK)).isTrue();
    }

    @Test
    void testSave_shouldRejectRow_whenStatusOutsideVocabulary() {
        UUID user = userPopulator.createUser("pred-ck@test.local").getId();
        assertThatThrownBy(() -> populator.prediction(user, WEEK,
                PredictionEntity.METRIC_SLEEP_AVG, PredictionEntity.DIRECTION_UP, "bogus"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testFindOrdered_shouldReturnOwnRowsNewestWindowFirst_whenTwoWeeksExist() {
        UUID user = userPopulator.createUser("pred-own@test.local").getId();
        UUID other = userPopulator.createUser("pred-other@test.local").getId();
        populator.prediction(user, WEEK.minusWeeks(1), PredictionEntity.METRIC_WEIGHT_TREND,
                PredictionEntity.DIRECTION_DOWN, PredictionEntity.STATUS_VALIDATED);
        PredictionEntity newest = populator.prediction(user, WEEK, PredictionEntity.METRIC_SLEEP_AVG,
                PredictionEntity.DIRECTION_STABLE, PredictionEntity.STATUS_PENDING);
        populator.prediction(other, WEEK, PredictionEntity.METRIC_WEIGHT_TREND,
                PredictionEntity.DIRECTION_UP, PredictionEntity.STATUS_PENDING);
        List<PredictionEntity> found = repository.findByCreatedByOrderByValidFromDescGeneratedAtDesc(user);
        assertThat(found).hasSize(2);
        assertThat(found.getFirst().getId()).isEqualTo(newest.getId());
    }
}

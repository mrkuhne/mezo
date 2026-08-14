package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PatternPairDetailResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.PredictionPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** mezo-tk88.3: the one-stop detail read — meta+gate, nullable row, events, live days, impact. */
@ActiveProfiles("companion-fake")
class CompanionPatternPairDetailApiIT extends ApiIntegrationTest {

    private static final String PAIR_KEY = "checkin-stress~sleep-quality";

    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private PredictionPopulator predictionPopulator;
    @Autowired private PredictionRepository predictionRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private void seedAlignedDays(UUID owner, int days) {
        for (int i = 0; i < days; i++) {
            LocalDate day = LocalDate.now().minusDays(1L + i);
            int stress = (i % 5) + 1;
            checkInPopulator.createCheckIn(owner, day, "08:00", 3, stress, null);
            sleepLogPopulator.createSleepLog(owner, day, new BigDecimal("7.0"), 6 - stress);
        }
    }

    @Test
    void testPatternPairDetail_shouldReturnRowEventsDaysAndGate_whenPairHasHistory() {
        UUID owner = ownerId();
        seedAlignedDays(owner, 10);
        PatternEntity row = patternPopulator.statistical(owner, PAIR_KEY, PatternEntity.STATUS_PROPOSED);
        patternEventPopulator.snapshot(owner, row.getId(), -0.55, 10, 0.06, Instant.now());

        PatternPairDetailResponse detail = getForBody("/api/companion/pattern/pair/" + PAIR_KEY,
                ownerAuthHeaders(), HttpStatus.OK, PatternPairDetailResponse.class);

        assertThat(detail.getPair().getKey()).isEqualTo(PAIR_KEY);
        assertThat(detail.getPattern()).isNotNull();
        assertThat(detail.getPattern().getId()).isEqualTo(row.getId());
        assertThat(detail.getEvents()).hasSize(1);
        assertThat(detail.getEvents().getFirst().getKind()).isEqualTo("snapshot");
        assertThat(detail.getDays()).hasSize(10); // lag 0 — every seeded day aligns
        assertThat(detail.getImpact().getPredictions()).isEmpty();
    }

    @Test
    void testPatternPairDetail_shouldReturnNullPattern_whenPairNeverWentLive() {
        PatternPairDetailResponse detail = getForBody("/api/companion/pattern/pair/" + PAIR_KEY,
                ownerAuthHeaders(), HttpStatus.OK, PatternPairDetailResponse.class);

        assertThat(detail.getPattern()).isNull();
        assertThat(detail.getEvents()).isEmpty();
        assertThat(detail.getPair().getVerdict()).isIn("no_data", "few_days");
    }

    @Test
    void testPatternPairDetail_shouldReturn404_whenPairKeyUnknown() {
        getForBody("/api/companion/pattern/pair/nonsense~pair",
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    /** S2/mezo-tk88.3: the impact block joins a grounded prediction via {@code sourcePatternId}. */
    @Test
    void testPatternPairDetail_shouldReturnGroundedPrediction_whenConfirmedPatternHasPrediction() {
        UUID owner = ownerId();
        PatternEntity row = patternPopulator.statistical(owner, PAIR_KEY, PatternEntity.STATUS_CONFIRMED);
        PredictionEntity prediction = predictionPopulator.prediction(owner, LocalDate.now().minusDays(7),
                PredictionEntity.METRIC_SLEEP_AVG, PredictionEntity.DIRECTION_STABLE,
                PredictionEntity.STATUS_PENDING);
        prediction.setSourcePatternId(row.getId());
        predictionRepository.saveAndFlush(prediction);

        PatternPairDetailResponse detail = getForBody("/api/companion/pattern/pair/" + PAIR_KEY,
                ownerAuthHeaders(), HttpStatus.OK, PatternPairDetailResponse.class);

        assertThat(detail.getImpact().getPredictions()).hasSize(1);
        assertThat(detail.getImpact().getPredictions().getFirst().getId()).isEqualTo(prediction.getId());
        assertThat(detail.getImpact().getPredictions().getFirst().getTitle()).isEqualTo(prediction.getTitle());
        assertThat(detail.getImpact().getPredictions().getFirst().getStatus())
                .isEqualTo(PredictionEntity.STATUS_PENDING);
    }
}

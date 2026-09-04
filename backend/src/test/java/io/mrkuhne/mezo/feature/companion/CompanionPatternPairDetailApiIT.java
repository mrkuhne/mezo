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
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.PredictionPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

/** mezo-tk88.3: the one-stop detail read — meta+gate, nullable row, events, live days, impact. */
@ActiveProfiles("companion-fake")
class CompanionPatternPairDetailApiIT extends ApiIntegrationTest {

    private static final String PAIR_KEY = "checkin-stress~sleep-quality";

    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private PredictionPopulator predictionPopulator;
    @Autowired private PredictionRepository predictionRepository;
    @Autowired private UserPopulator userPopulator;
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

    private void seedImbalancedWeekendMeals(UUID owner) {
        int weekdays = 0;
        int weekends = 0;
        int index = 0;
        LocalDate day = LocalDate.now().minusDays(1);
        while (weekdays < 8 || weekends < 1) {
            boolean weekend = day.getDayOfWeek() == DayOfWeek.SATURDAY
                    || day.getDayOfWeek() == DayOfWeek.SUNDAY;
            boolean take = weekend ? weekends < 1 : weekdays < 8;
            if (take) {
                LocalTime time = LocalTime.of(10 + index, index * 7 % 60);
                Instant loggedAt = day.atTime(time).atZone(ZoneId.systemDefault()).toInstant();
                mealPopulator.createMealWithItems(owner, day, "dinner", loggedAt,
                        List.of(new MealPopulator.Line(
                                "Pattern fixture", "500", "30", "45", "18", (short) 2)));
                if (weekend) {
                    weekends++;
                } else {
                    weekdays++;
                }
                index++;
            }
            day = day.minusDays(1);
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
    void testPatternPairDetail_shouldMatchMonitorGroupBalance_whenWeekendHasOnlyOneDay() {
        seedImbalancedWeekendMeals(ownerId());

        PatternPairDetailResponse detail = getForBody(
                "/api/companion/pattern/pair/weekend~late-meal-hour",
                ownerAuthHeaders(), HttpStatus.OK, PatternPairDetailResponse.class);

        assertThat(detail.getPair().getVerdict()).isEqualTo("imbalanced_groups");
        assertThat(detail.getPair().getAlignedDays()).isEqualTo(9);
        assertThat(detail.getPair().getGroupZeroDays()).isEqualTo(8);
        assertThat(detail.getPair().getGroupOneDays()).isEqualTo(1);
        assertThat(detail.getPair().getRequiredPerGroup()).isEqualTo(3);
        assertThat(detail.getPair().getMetricAValueKind()).isEqualTo("binary");
        assertThat(detail.getPair().getMetricBValueKind()).isEqualTo("clock_hour");
        assertThat(detail.getDays()).hasSize(9);
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

    /**
     * Review finding (task-7 fix round 1): no test previously seeded a SECOND user's data on the
     * SAME pair key to confirm the detail read stays owner-scoped — the sibling
     * {@code CompanionPatternApiIT.testListPatterns_shouldReturnOnlyOwnRows_whenForeignPatternsExist}
     * convention, applied here. A foreign row on the identical {@code pairKey} is legal (the
     * partial unique index is {@code (created_by, kind, pair_key)}), so this is the realistic
     * cross-user collision shape.
     */
    @Test
    void testPatternPairDetail_shouldReturnOnlyOwnRowEventsAndImpact_whenForeignRowSharesPairKey() {
        UUID owner = ownerId();
        UUID foreign = userPopulator.createUser().getId();

        PatternEntity foreignRow = patternPopulator.statistical(foreign, PAIR_KEY, PatternEntity.STATUS_CONFIRMED);
        patternEventPopulator.snapshot(foreign, foreignRow.getId(), 0.99, 99, 0.01, Instant.now());
        PredictionEntity foreignPrediction = predictionPopulator.prediction(foreign, LocalDate.now().minusDays(7),
                PredictionEntity.METRIC_SLEEP_AVG, PredictionEntity.DIRECTION_STABLE,
                PredictionEntity.STATUS_PENDING);
        foreignPrediction.setSourcePatternId(foreignRow.getId());
        predictionRepository.saveAndFlush(foreignPrediction);

        PatternEntity ownRow = patternPopulator.statistical(owner, PAIR_KEY, PatternEntity.STATUS_PROPOSED);
        patternEventPopulator.snapshot(owner, ownRow.getId(), -0.55, 10, 0.06, Instant.now());

        PatternPairDetailResponse detail = getForBody("/api/companion/pattern/pair/" + PAIR_KEY,
                ownerAuthHeaders(), HttpStatus.OK, PatternPairDetailResponse.class);

        assertThat(detail.getPattern()).isNotNull();
        assertThat(detail.getPattern().getId()).isEqualTo(ownRow.getId()); // never the foreign row
        assertThat(detail.getEvents()).hasSize(1); // only the owner's own event
        assertThat(detail.getEvents().getFirst().getR()).isEqualTo(-0.55); // not the foreign 0.99
        assertThat(detail.getEvents().getFirst().getN()).isEqualTo(10); // not the foreign 99
        assertThat(detail.getImpact().getPredictions()).isEmpty(); // the foreign grounding must not leak
    }
}

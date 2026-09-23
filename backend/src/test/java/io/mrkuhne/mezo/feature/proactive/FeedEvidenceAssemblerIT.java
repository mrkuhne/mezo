package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.feature.proactive.service.FeedEvidenceAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(properties = "mezo.feature.contextual-feed.enabled=true")
class FeedEvidenceAssemblerIT extends AbstractIntegrationTest {
    private static final LocalDate DAY = LocalDate.of(2026, 9, 23);
    @Autowired private FeedEvidenceAssembler evidence;
    @Autowired private DatabasePopulator users;
    @Autowired private WeightLogPopulator weights;
    @Autowired private SleepLogPopulator sleeps;
    @Autowired private GoalPopulator goals;

    @Test
    void testRender_shouldSeparateRawSequenceAndRateWindows_whenRecentWeightsRise() {
        var user = users.populateUser("evidence-weight@test.local");
        var other = users.populateUser("evidence-other@test.local");
        weights.createWeightLog(user, DAY.minusDays(50), new BigDecimal("100"));
        for (int i = 6; i >= 0; i--) {
            weights.createWeightLog(user, DAY.minusDays(i), BigDecimal.valueOf(85 - i));
        }
        weights.createWeightLog(other, DAY, new BigDecimal("123.4"));
        goals.createGoalFull(user, DAY.minusDays(3), DAY.plusDays(90), null, null, null, null);
        String result = evidence.render(user, DAY, "weight");
        assertThat(result).contains("2026-09-17", "79,0 kg", "85,0 kg", "2026-09-20",
                "teljes mérési időszak", "2026-08-04", "28 nap", "2026-08-27", "kg/hét")
                .doesNotContain("123,4 kg");
    }

    @Test
    void testRender_shouldDistinguishLatestAndDailyAverage_whenSameDayHasMultipleMeasurements() {
        var user = users.populateUser("evidence-duplicate@test.local");
        weights.createWeightLogAt(user, DAY.minusDays(1), new BigDecimal("80"), Instant.parse("2026-09-22T08:00:00Z"));
        weights.createWeightLogAt(user, DAY, new BigDecimal("81"), Instant.parse("2026-09-23T08:00:00Z"));
        weights.createWeightLogAt(user, DAY, new BigDecimal("83"), Instant.parse("2026-09-23T09:00:00Z"));
        var result = evidence.render(user, DAY, "weight");
        assertThat(result).contains("legutóbbi mérés: 83,0 kg", "napi átlag: 82,0 kg",
                "előző mért nap utolsó méréséhez: 3,0 kg");
    }

    @Test
    void testRender_shouldReportUnknownDirection_whenOnlyOneObservationExists() {
        var user = users.populateUser("evidence-single@test.local");
        weights.createWeightLog(user, DAY, new BigDecimal("80"));
        var result = evidence.render(user, DAY, "weight");
        assertThat(result).contains("irány: nincs elég mérési nap").doesNotContain("kg/hét");
    }

    @Test
    void testRender_shouldReportMissingNightsWithoutInventingSleep_whenWindowHasGaps() {
        var user = users.populateUser("evidence-sleep@test.local");
        var other = users.populateUser("evidence-sleep-other@test.local");
        sleeps.createSleepLog(user, DAY.minusDays(1), new BigDecimal("6.5"), 7);
        sleeps.createSleepLog(other, DAY, new BigDecimal("9.9"), 10);
        sleeps.createSleepLog(user, DAY.plusDays(1), new BigDecimal("8.8"), 10);
        var result = evidence.render(user, DAY, "sleep");
        assertThat(result).contains("2026-09-22", "6,5", "7/10", "hiányzó éjszakák: 6")
                .doesNotContain("9,9", "8,8");
        assertThat(evidence.render(user, DAY, "people")).isEmpty();
    }
}

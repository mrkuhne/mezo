package io.mrkuhne.mezo.feature.boop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.boop.repository.BoopBriefRepository;
import io.mrkuhne.mezo.feature.boop.repository.WorkoutTimeOverrideRepository;
import io.mrkuhne.mezo.feature.wearable.repository.DailyMetricRepository;
import io.mrkuhne.mezo.feature.wearable.repository.WearableWorkoutRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BoopBriefPopulator;
import io.mrkuhne.mezo.support.populator.DailyMetricPopulator;
import io.mrkuhne.mezo.support.populator.WorkoutTimeOverridePopulator;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BoopRepositoriesIT extends AbstractIntegrationTest {

    @Autowired private BoopBriefRepository briefs;
    @Autowired private WorkoutTimeOverrideRepository overrides;
    @Autowired private DailyMetricRepository metrics;
    @Autowired private WearableWorkoutRepository workouts;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private BoopBriefPopulator briefPopulator;
    @Autowired private WorkoutTimeOverridePopulator overridePopulator;
    @Autowired private DailyMetricPopulator metricPopulator;
    @Autowired private JdbcTemplate jdbc;

    private static final LocalDate DAY = LocalDate.parse("2026-11-10");

    @Test
    void findsBriefByUserAndDateAndKeepsJsonPayload() {
        UUID user = databasePopulator.populateUser("brief@test.local");
        briefPopulator.createBrief(user, DAY, "{\"verdict\":\"Jó reggel\"}", "hash1");
        assertThat(briefs.findByCreatedByAndDate(user, DAY)).isPresent();
        assertThat(briefs.findByCreatedByAndDate(user, DAY.plusDays(1))).isEmpty();
        String verdict = jdbc.queryForObject(
            "select payload ->> 'verdict' from boop_brief where created_by = ?", String.class, user);
        assertThat(verdict).isEqualTo("Jó reggel");
    }

    @Test
    void secondBriefForSameUserAndDayViolatesUniqueIndex() {
        UUID user = databasePopulator.populateUser("dup@test.local");
        briefPopulator.createBrief(user, DAY, "{}", "h1");
        assertThatThrownBy(() -> briefPopulator.createBrief(user, DAY, "{}", "h2"))
            .hasMessageContaining("uq_boop_brief_user_date");
    }

    @Test
    void overrideLookupAndUnique() {
        UUID user = databasePopulator.populateUser("ovr@test.local");
        overridePopulator.createOverride(user, DAY, LocalTime.of(18, 30));
        assertThat(overrides.findByCreatedByAndDate(user, DAY)).get()
            .extracting(o -> o.getTime()).isEqualTo(LocalTime.of(18, 30));
        assertThatThrownBy(() -> overridePopulator.createOverride(user, DAY, LocalTime.of(7, 0)))
            .hasMessageContaining("uq_workout_time_override_user_date");
    }

    @Test
    void wearableRangeFindersAreOrderedAndInclusive() {
        UUID user = databasePopulator.populateUser("rng@test.local");
        metricPopulator.createDay(user, DAY.minusDays(1), 3000, 55);
        metricPopulator.createDay(user, DAY.minusDays(3), 4000, 56);
        metricPopulator.createDay(user, DAY.minusDays(10), 5000, 57);
        var rows = metrics.findByCreatedByAndDateBetweenOrderByDate(user, DAY.minusDays(5), DAY);
        assertThat(rows).extracting(r -> r.getDate()).containsExactly(DAY.minusDays(3), DAY.minusDays(1));
        assertThat(workouts.findByCreatedByAndDateBetweenOrderByDate(user, DAY.minusDays(5), DAY)).isEmpty();
    }
}

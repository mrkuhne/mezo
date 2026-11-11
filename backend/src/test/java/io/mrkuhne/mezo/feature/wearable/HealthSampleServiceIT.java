package io.mrkuhne.mezo.feature.wearable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import io.mrkuhne.mezo.api.dto.HealthSampleIn;
import io.mrkuhne.mezo.api.dto.HealthSampleIn.MetricEnum;
import io.mrkuhne.mezo.api.dto.IngestResult;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightLogSavedEvent;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.wearable.service.HealthSampleService;
import io.mrkuhne.mezo.feature.wearable.service.WearableDeletionService;
import io.mrkuhne.mezo.feature.wearable.service.WearableWorkoutService;
import io.mrkuhne.mezo.api.dto.WorkoutIn;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.transaction.annotation.Transactional;

@Transactional
@RecordApplicationEvents
class HealthSampleServiceIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.parse("2026-11-11");

    @Autowired private HealthSampleService samples;
    @Autowired private WearableDeletionService deletions;
    @Autowired private WearableWorkoutService workouts;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ApplicationEvents events;
    @MockitoSpyBean private GoalEngineService goalEngine;

    private static HealthSampleIn sample(String id, MetricEnum metric, OffsetDateTime start, double value) {
        return new HealthSampleIn().externalId(id).metric(metric).start(start).end(start.plusMinutes(5)).value(value)
            .unit("x").sourceName("Apple Watch").userEntered(false).meta(Map.of("min", 50, "max", 90));
    }

    private static HealthSampleIn mass(String id, LocalDate day, double kg) {
        return sample(id, MetricEnum.BODY_MASS, day.atTime(8, 0).atOffset(java.time.ZoneOffset.ofHours(1)), kg);
    }

    private int live(String table, UUID user) {
        return jdbc.queryForObject("select count(*) from " + table + " where created_by = ? and is_deleted = false",
            Integer.class, user);
    }

    @Test
    void resendIsIdempotentAndCounted() {
        UUID user = databasePopulator.populateUser("a@test.local");
        OffsetDateTime t = OffsetDateTime.parse("2026-11-10T08:00:00+01:00");
        var batch = List.of(sample("u1", MetricEnum.HRV_SDNN, t, 48.5), sample("u2", MetricEnum.HEART_RATE, t, 70));
        assertThat(samples.ingest(user, batch, TODAY)).isEqualTo(new IngestResult(2, 0));
        assertThat(samples.ingest(user, List.of(sample("u1", MetricEnum.HRV_SDNN, t, 51.0),
            sample("u3", MetricEnum.VO2MAX, t, 44)), TODAY)).isEqualTo(new IngestResult(1, 1));
        assertThat(live("health_sample", user)).isEqualTo(3);
        assertThat(jdbc.queryForObject("select value from health_sample where external_id = 'u1'", Double.class))
            .isEqualTo(51.0);
        assertThat(jdbc.queryForObject("select meta->>'max' from health_sample where external_id = 'u1'", String.class))
            .isEqualTo("90");
    }

    @Test
    void deleteThenReAddRevives() {
        UUID user = databasePopulator.populateUser("a@test.local");
        OffsetDateTime t = OffsetDateTime.parse("2026-11-10T08:00:00+01:00");
        samples.ingest(user, List.of(sample("u1", MetricEnum.HRV_SDNN, t, 48.5)), TODAY);
        assertThat(deletions.delete(user, List.of("u1"))).isEqualTo(1);
        assertThat(live("health_sample", user)).isZero();
        assertThat(samples.ingest(user, List.of(sample("u1", MetricEnum.HRV_SDNN, t, 49)), TODAY))
            .isEqualTo(new IngestResult(0, 1));
        assertThat(live("health_sample", user)).isEqualTo(1);
    }

    @Test
    void capAndEndBeforeStartAre400() {
        UUID user = databasePopulator.populateUser("a@test.local");
        OffsetDateTime t = OffsetDateTime.parse("2026-11-10T08:00:00+01:00");
        var tooMany = IntStream.range(0, 1001).mapToObj(i -> sample("c" + i, MetricEnum.HEART_RATE, t, 60)).toList();
        assertThatThrownBy(() -> samples.ingest(user, tooMany, TODAY)).isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("WEARABLE_BATCH_TOO_LARGE");
        var bad = sample("b", MetricEnum.HEART_RATE, t, 60).end(t.minusMinutes(1));
        assertThatThrownBy(() -> samples.ingest(user, List.of(bad), TODAY)).isInstanceOf(SystemRuntimeErrorException.class);
        assertThat(live("health_sample", user)).isZero();
    }

    @Test
    void sixtyBodyMassSamplesMakeSixtyWeightRowsAndOneEvent() {
        UUID user = databasePopulator.populateUser("a@test.local");
        var batch = IntStream.range(0, 60).mapToObj(i -> mass("m" + i, TODAY.minusDays(59 - i), 80.123 + i * 0.01)).toList();
        assertThat(samples.ingest(user, batch, TODAY)).isEqualTo(new IngestResult(60, 0));
        assertThat(jdbc.queryForObject("select count(*) from weight_log where created_by = ? and source = 'apple_health'",
            Integer.class, user)).isEqualTo(60);
        assertThat(jdbc.queryForObject("select weight_kg from weight_log where external_id = 'm0'", java.math.BigDecimal.class))
            .isEqualByComparingTo("80.12");
        assertThat(events.stream(WeightLogSavedEvent.class)).hasSize(1)
            .first().extracting(WeightLogSavedEvent::date).isEqualTo(TODAY);
        verify(goalEngine, times(1)).recomputeActiveGoal(user);
        // re-send: nothing new -> no further event / recompute
        samples.ingest(user, batch, TODAY);
        assertThat(events.stream(WeightLogSavedEvent.class)).hasSize(1);
        verify(goalEngine, times(1)).recomputeActiveGoal(user);
    }

    @Test
    void oldBackfillRaisesNoEventAndManualRowsStay() {
        UUID user = databasePopulator.populateUser("a@test.local");
        jdbc.update("insert into weight_log (created_by, date, weight_kg) values (?, ?, 81.5)", user, TODAY.minusDays(10));
        samples.ingest(user, List.of(mass("old", TODAY.minusDays(10), 80.0)), TODAY);
        assertThat(jdbc.queryForObject("select count(*) from weight_log where created_by = ? and date = ?", Integer.class,
            user, TODAY.minusDays(10))).isEqualTo(2);
        assertThat(events.stream(WeightLogSavedEvent.class)).isEmpty();
        verify(goalEngine, never()).recomputeActiveGoal(any());
    }

    @Test
    void deletionsHitAllThreeTablesIdempotentlyAndRespectOwnership() {
        UUID user = databasePopulator.populateUser("a@test.local");
        UUID other = databasePopulator.populateUser("b@test.local");
        OffsetDateTime t = OffsetDateTime.parse("2026-11-10T08:00:00+01:00");
        samples.ingest(user, List.of(sample("s1", MetricEnum.HRV_SDNN, t, 48), mass("w1", TODAY, 80)), TODAY);
        samples.ingest(other, List.of(sample("s1", MetricEnum.HRV_SDNN, t, 48), mass("w1", TODAY, 80)), TODAY);
        workouts.ingest(user, List.of(new WorkoutIn().externalId("hk-x").activityType("running").startAt(t).endAt(t.plusMinutes(30))));
        jdbc.update("insert into weight_log (created_by, date, weight_kg) values (?, ?, 81)", user, TODAY);

        // s1 (sample) + hk-x (workout) + w1 (sample + health weight row) = 4
        assertThat(deletions.delete(user, List.of("s1", "hk-x", "w1", "nothing"))).isEqualTo(4);
        assertThat(deletions.delete(user, List.of("s1", "hk-x", "w1"))).isZero();
        assertThat(live("health_sample", user)).isZero();
        assertThat(live("wearable_workout", user)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from weight_log where created_by = ? and is_deleted = false",
            Integer.class, user)).isEqualTo(1); // the manual row stays
        assertThat(live("health_sample", other)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from weight_log where created_by = ? and is_deleted = false",
            Integer.class, other)).isEqualTo(1);
    }

    @Test
    void implausibleBodyMassIsStoredButSkipsWeightLogAndDoesNotFailTheBatch() {
        UUID user = databasePopulator.populateUser("bounds@test.local");
        IngestResult r = samples.ingest(user, List.of(mass("m-ok", TODAY, 80.4), mass("m-huge", TODAY.minusDays(1), 99999.0),
            mass("m-tiny", TODAY.minusDays(2), 3.0)), TODAY);
        assertThat(r.getInserted()).isEqualTo(3);
        assertThat(live("health_sample", user)).isEqualTo(3);
        assertThat(live("weight_log", user)).isEqualTo(1);
    }
}

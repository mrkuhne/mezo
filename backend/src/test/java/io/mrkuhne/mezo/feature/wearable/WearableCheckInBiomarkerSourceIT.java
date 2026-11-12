package io.mrkuhne.mezo.feature.wearable;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.api.dto.CheckInSnapshot;
import io.mrkuhne.mezo.api.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInBiomarkerSource;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInBiomarkerSource.CheckInSnapshotValues;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.DailyMetricPopulator;
import io.mrkuhne.mezo.support.populator.HealthSamplePopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** Boop B3 (mezo-r36n9.13, spec §7.3): the server fills a check-in's snapshot from B1's Health data. */
@Transactional
class WearableCheckInBiomarkerSourceIT extends AbstractIntegrationTest {

    private static final Instant AT = Instant.parse("2026-11-10T09:00:00Z");

    @Autowired private CheckInBiomarkerSource source;
    @Autowired private CheckInService checkIns;
    @Autowired private WearableProperties wearableProperties;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private HealthSamplePopulator samples;
    @Autowired private DailyMetricPopulator dailyMetrics;
    @Autowired private SleepLogPopulator sleepLogs;
    @Autowired private JdbcTemplate jdbc;

    private static Instant minutes(long m) {
        return AT.plus(m, ChronoUnit.MINUTES);
    }

    @Test
    void averagesHrBucketsWithinFifteenMinutes() {
        UUID user = databasePopulator.populateUser("a@test.local");
        samples.createSample(user, "hr-20", "heart_rate", minutes(-20), 140);
        samples.createSample(user, "hr-10", "heart_rate", minutes(-10), 70);
        samples.createSample(user, "hr-5", "heart_rate", minutes(-5), 80);
        samples.createSample(user, "hr+10", "heart_rate", minutes(10), 91);
        samples.createSample(user, "hr+20", "heart_rate", minutes(20), 150);
        UUID other = databasePopulator.populateUser("b@test.local");
        samples.createSample(other, "hr-other", "heart_rate", minutes(0), 190);

        CheckInSnapshotValues v = source.snapshotAt(user, AT).orElseThrow();

        assertThat(v.hrBpm()).isEqualTo(80); // (70 + 80 + 91) / 3 = 80.3
        assertThat(v.hrAt()).isEqualTo(minutes(10));
    }

    @Test
    void latestHrvWithinEightHours() {
        UUID user = databasePopulator.populateUser("a@test.local");
        samples.createSample(user, "hrv-10d", "hrv_sdnn", AT.minus(10, ChronoUnit.DAYS), 50);
        samples.createSample(user, "hrv-5d", "hrv_sdnn", AT.minus(5, ChronoUnit.DAYS), 52);
        samples.createSample(user, "hrv-2d", "hrv_sdnn", AT.minus(2, ChronoUnit.DAYS), 50);
        samples.createSample(user, "hrv-9h", "hrv_sdnn", AT.minus(9, ChronoUnit.HOURS), 60);
        samples.createSample(user, "hrv-3h", "hrv_sdnn", AT.minus(3, ChronoUnit.HOURS), 38);
        samples.createSample(user, "hrv+1h", "hrv_sdnn", AT.plus(1, ChronoUnit.HOURS), 99);
        samples.createSample(user, "hrv-20d", "hrv_sdnn", AT.minus(20, ChronoUnit.DAYS), 10);

        CheckInSnapshotValues v = source.snapshotAt(user, AT).orElseThrow();

        assertThat(v.hrvMs()).isEqualTo(38.0);
        assertThat(v.hrvAt()).isEqualTo(AT.minus(3, ChronoUnit.HOURS));
        assertThat(v.hrvUsualMs()).isEqualTo(50.0); // median of 38, 50, 50, 52, 60
        assertThat(v.hrBpm()).isNull();
    }

    @Test
    void latestHrvIsNullWhenOlderThanEightHours() {
        UUID user = databasePopulator.populateUser("a@test.local");
        samples.createSample(user, "hrv-9h", "hrv_sdnn", AT.minus(9, ChronoUnit.HOURS), 60);

        CheckInSnapshotValues v = source.snapshotAt(user, AT).orElseThrow();

        assertThat(v.hrvMs()).isNull();
        assertThat(v.hrvAt()).isNull();
        assertThat(v.hrvUsualMs()).isEqualTo(60.0);
    }

    @Test
    void fillsStepsDayTotalAndSleepOfTheOwnerDay() {
        UUID user = databasePopulator.populateUser("a@test.local");
        LocalDate day = AT.atZone(ZoneId.of(wearableProperties.zone())).toLocalDate();
        dailyMetrics.createDay(user, day, 7420, 55);
        sleepLogs.createSleepLog(user, day, new BigDecimal("7.50"), 4);

        CheckInSnapshotValues v = source.snapshotAt(user, AT).orElseThrow();

        assertThat(v.steps()).isEqualTo(7420);
        assertThat(v.stepsIsDayTotal()).isTrue();
        assertThat(v.sleepMinutes()).isEqualTo(450);
    }

    /** An empty server snapshot is not frozen: a re-save after the Health data synced fills it — and a
     *  server snapshot with readings then stays as it was. */
    @Test
    void reSaveRecomputesAnEmptyServerSnapshotOnly() {
        UUID user = databasePopulator.populateUser("a@test.local");
        LocalDate today = LocalDate.now(ZoneId.of(wearableProperties.zone()));
        SaveCheckInRequest web = SaveCheckInRequest.builder()
            .date(today).slotTime("10:00").state("done").energy(6).build();

        assertThat(checkIns.save(user, web).getSnapshot().getHrBpm()).isNull();

        samples.createSample(user, "hr-now", "heart_rate", Instant.now().minus(5, ChronoUnit.MINUTES), 72);
        CheckInSnapshot filled = checkIns.save(user, web).getSnapshot();
        assertThat(filled.getHrBpm()).isEqualTo(72);
        assertThat(filled.getComputedBy()).isEqualTo(CheckInSnapshot.ComputedByEnum.SERVER);

        samples.createSample(user, "hr-now2", "heart_rate", Instant.now().minus(2, ChronoUnit.MINUTES), 120);
        assertThat(checkIns.save(user, web).getSnapshot().getHrBpm()).isEqualTo(72);
        assertThat(jdbc.queryForObject(
            "select count(*) from check_in_snapshot where created_by = ? and is_deleted = false", Integer.class, user))
            .isEqualTo(1);
    }

    @Test
    void fallbackWithNoSamplesStoresNulls() {
        UUID user = databasePopulator.populateUser("a@test.local");
        LocalDate today = LocalDate.now(ZoneId.of(wearableProperties.zone()));

        CheckInResponse saved = checkIns.save(user, SaveCheckInRequest.builder()
            .date(today).slotTime("10:00").state("done").energy(6).build());

        CheckInSnapshot s = saved.getSnapshot();
        assertThat(s).isNotNull();
        assertThat(s.getComputedBy()).isEqualTo(CheckInSnapshot.ComputedByEnum.SERVER);
        assertThat(s).extracting(CheckInSnapshot::getHrBpm, CheckInSnapshot::getHrAt, CheckInSnapshot::getHrvMs,
                CheckInSnapshot::getHrvAt, CheckInSnapshot::getHrvUsualMs, CheckInSnapshot::getSteps,
                CheckInSnapshot::getStepsIsDayTotal, CheckInSnapshot::getSleepMinutes, CheckInSnapshot::getSource)
            .containsOnlyNulls();
        assertThat(jdbc.queryForObject(
            "select computed_by from check_in_snapshot where created_by = ? and is_deleted = false", String.class, user))
            .isEqualTo("server");
    }
}

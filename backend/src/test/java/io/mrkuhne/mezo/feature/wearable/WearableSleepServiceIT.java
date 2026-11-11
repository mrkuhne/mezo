package io.mrkuhne.mezo.feature.wearable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.Hypnogram;
import io.mrkuhne.mezo.api.dto.IngestResult;
import io.mrkuhne.mezo.api.dto.SleepNightIn;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepLogSavedEvent;
import io.mrkuhne.mezo.feature.wearable.service.WearableSleepService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.transaction.annotation.Transactional;

@Transactional
@RecordApplicationEvents
class WearableSleepServiceIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.parse("2026-11-09");

    @Autowired private WearableSleepService service;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ApplicationEvents events;

    private static SleepNightIn night(LocalDate date, int deep) {
        return new SleepNightIn().externalId("hk-night-" + date).date(date).bedtime("23:40").wakeup("06:50")
            .durationH(new BigDecimal("6.83")).inBedMin(430).awakeMin(22).lightMin(228).remMin(98).deepMin(deep)
            .hypnogram(new Hypnogram().bucketMin(5).stages("LLLLDDRR")).sourceApp("Sleep Cycle").sleepingHr(52);
    }

    private static List<SleepNightIn> nightsEndingOn(LocalDate last, int count) {
        return IntStream.range(0, count).mapToObj(i -> night(last.minusDays(count - 1 - i), 80)).toList();
    }

    private List<Map<String, Object>> rows(UUID user) {
        return jdbc.queryForList(
            "select source, source_app, sleeping_hr, deep_min, hypnogram::text as hyp from sleep_log where created_by = ? order by date", user);
    }

    @Test
    void firstIngestInsertsOneRowPerNight() {
        UUID user = databasePopulator.populateUser("a@test.local");
        IngestResult r = service.ingest(user, nightsEndingOn(TODAY, 3), TODAY);
        assertThat(r.getInserted()).isEqualTo(3);
        assertThat(r.getUpdated()).isZero();
        assertThat(rows(user)).hasSize(3).allSatisfy(row -> {
            assertThat(row.get("source")).isEqualTo("apple_health");
            assertThat(row.get("deep_min")).isEqualTo(80);
            assertThat((String) row.get("hyp")).contains("LLLLDDRR");
            assertThat(row.get("source_app")).isEqualTo("Sleep Cycle");
            assertThat(row.get("sleeping_hr")).isEqualTo(52);
        });
    }

    @Test
    void resendingSameNightsUpdatesNotDuplicates() {
        UUID user = databasePopulator.populateUser("a@test.local");
        service.ingest(user, nightsEndingOn(TODAY, 3), TODAY);
        List<SleepNightIn> changed = nightsEndingOn(TODAY, 3).stream().map(n -> n.deepMin(95)).toList();
        IngestResult r = service.ingest(user, changed, TODAY);
        assertThat(r.getInserted()).isZero();
        assertThat(r.getUpdated()).isEqualTo(3);
        assertThat(rows(user)).hasSize(3).allSatisfy(row -> assertThat(row.get("deep_min")).isEqualTo(95));
    }

    @Test
    void sameExternalIdForAnotherUserIsSeparate() {
        UUID a = databasePopulator.populateUser("a@test.local");
        UUID b = databasePopulator.populateUser("b@test.local");
        service.ingest(a, nightsEndingOn(TODAY, 3), TODAY);
        IngestResult r = service.ingest(b, nightsEndingOn(TODAY, 3), TODAY);
        assertThat(r.getInserted()).isEqualTo(3);
        assertThat(rows(a)).hasSize(3);
        assertThat(rows(b)).hasSize(3);
    }

    @Test
    void backfillPublishesAtMostOneSleepEvent() {
        UUID user = databasePopulator.populateUser("a@test.local");
        service.ingest(user, nightsEndingOn(TODAY.minusDays(1), 60), TODAY);
        assertThat(events.stream(SleepLogSavedEvent.class)).hasSize(1)
            .first().extracting(SleepLogSavedEvent::date).isEqualTo(TODAY.minusDays(1));
    }

    @Test
    void oldBackfillPublishesNoSleepEvent() {
        UUID user = databasePopulator.populateUser("a@test.local");
        service.ingest(user, nightsEndingOn(TODAY.minusDays(10), 60), TODAY);
        assertThat(events.stream(SleepLogSavedEvent.class)).isEmpty();
    }

    @Test
    void resendOfRecentNightPublishesNoNewEvent() {
        UUID user = databasePopulator.populateUser("a@test.local");
        service.ingest(user, nightsEndingOn(TODAY, 2), TODAY);
        events.clear();
        service.ingest(user, nightsEndingOn(TODAY, 2), TODAY);
        assertThat(events.stream(SleepLogSavedEvent.class)).isEmpty();
    }

    @Test
    void overCapIsRejected() {
        UUID user = databasePopulator.populateUser("a@test.local");
        assertThatThrownBy(() -> service.ingest(user, nightsEndingOn(TODAY, 101), TODAY))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("WEARABLE_BATCH_TOO_LARGE");
    }

    // --- one night per date (Boop B1) ---

    @Autowired private io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepLogService sleepLogService;

    @Autowired private jakarta.persistence.EntityManager entityManager;

    private List<Map<String, Object>> live(UUID user) {
        entityManager.flush(); // the web log saves a managed row without flushing
        return jdbc.queryForList("select * from sleep_log where created_by = ? and is_deleted = false order by date", user);
    }

    private static io.mrkuhne.mezo.api.dto.LogSleepRequest manual(LocalDate date, Integer quality, Integer pct, String source) {
        return io.mrkuhne.mezo.api.dto.LogSleepRequest.builder().date(date).bedtime("22:00").wakeup("06:00")
            .durationH(new BigDecimal("8.00")).quality(quality).sourceQualityPct(pct).source(source).build();
    }

    @Test
    void manualThenHealthEndsAsOneRowWithSensorTimesAndManualQuality() {
        UUID user = databasePopulator.populateUser("a@test.local");
        sleepLogService.log(user, manual(TODAY, 8, null, null));
        IngestResult r = service.ingest(user, List.of(night(TODAY, 80)), TODAY);
        assertThat(r.getInserted()).isZero();
        assertThat(r.getUpdated()).isEqualTo(1);
        assertThat(live(user)).hasSize(1).first().satisfies(row -> {
            assertThat(row.get("source")).isEqualTo("apple_health");
            assertThat(row.get("bedtime")).isEqualTo("23:40");
            assertThat(row.get("deep_min")).isEqualTo(80);
            assertThat(row.get("quality")).isEqualTo(8);
            assertThat(row.get("external_id")).isEqualTo("hk-night-" + TODAY);
        });
        assertThat(events.stream(SleepLogSavedEvent.class)).hasSize(1); // the manual log only
    }

    @Test
    void healthThenManualFillsOnlySubjectiveIncludingScreenshotPct() {
        UUID user = databasePopulator.populateUser("a@test.local");
        service.ingest(user, List.of(night(TODAY, 80)), TODAY);
        sleepLogService.log(user, manual(TODAY, 7, 82, "screenshot"));
        assertThat(live(user)).hasSize(1).first().satisfies(row -> {
            assertThat(row.get("source")).isEqualTo("apple_health");
            assertThat(row.get("bedtime")).isEqualTo("23:40");
            assertThat(row.get("quality")).isEqualTo(7);
            assertThat(row.get("source_quality_pct")).isEqualTo(82);
        });
        IngestResult again = service.ingest(user, List.of(night(TODAY, 90)), TODAY);
        assertThat(again.getUpdated()).isEqualTo(1);
        assertThat(live(user)).hasSize(1).first().satisfies(row -> {
            assertThat(row.get("deep_min")).isEqualTo(90);
            assertThat(row.get("quality")).isEqualTo(7);
            assertThat(row.get("source_quality_pct")).isEqualTo(82);
        });
    }

    @Test
    void secondManualEntryOnTheSameDateUpdatesInPlace() {
        UUID user = databasePopulator.populateUser("a@test.local");
        sleepLogService.log(user, manual(TODAY, 5, null, null));
        sleepLogService.log(user, manual(TODAY, 9, 70, "screenshot"));
        assertThat(live(user)).hasSize(1).first().satisfies(row -> {
            assertThat(row.get("quality")).isEqualTo(9);
            assertThat(row.get("source")).isEqualTo("screenshot");
        });
    }

    @Test
    void revivedExternalIdDoesNotTripEitherUniqueIndex() {
        UUID user = databasePopulator.populateUser("a@test.local");
        service.ingest(user, List.of(night(TODAY, 80)), TODAY);
        jdbc.update("update sleep_log set is_deleted = true where created_by = ?", user);
        sleepLogService.log(user, manual(TODAY, 6, null, null)); // a live manual row now owns the date
        IngestResult r = service.ingest(user, List.of(night(TODAY, 80)), TODAY);
        assertThat(r.getUpdated()).isEqualTo(1);
        assertThat(live(user)).hasSize(1).first().satisfies(row -> {
            assertThat(row.get("external_id")).isEqualTo("hk-night-" + TODAY);
            assertThat(row.get("quality")).isEqualTo(6);
        });
        assertThat(jdbc.queryForObject("select count(*) from sleep_log where created_by = ? and external_id is not null",
            Integer.class, user)).isEqualTo(1);
    }

    @Test
    void windowDeletionSoftDeletesMissingHealthNights() {
        UUID user = databasePopulator.populateUser("a@test.local");
        service.ingest(user, nightsEndingOn(TODAY, 5), TODAY);
        List<SleepNightIn> kept = nightsEndingOn(TODAY, 5).stream()
            .filter(n -> !n.getDate().equals(TODAY.minusDays(2))).toList();
        service.ingest(user, kept, TODAY, TODAY.minusDays(4), TODAY);
        assertThat(live(user)).hasSize(4).noneMatch(row -> row.get("date").toString().equals(TODAY.minusDays(2).toString()));
    }

    @Test
    void windowDeletionLeavesNightsOutsideTheWindowAndManualRows() {
        UUID user = databasePopulator.populateUser("a@test.local");
        service.ingest(user, nightsEndingOn(TODAY, 5), TODAY);
        sleepLogService.log(user, manual(TODAY.minusDays(20), 7, null, null));
        service.ingest(user, List.of(night(TODAY, 80)), TODAY, TODAY, TODAY);
        assertThat(live(user)).hasSize(6); // 5 health nights (only TODAY is in the window, and it was re-sent) + the manual row
    }

    @Test
    void windowDeletionConvertsANightWithSubjectiveFieldsToManual() {
        UUID user = databasePopulator.populateUser("a@test.local");
        service.ingest(user, nightsEndingOn(TODAY, 2), TODAY);
        sleepLogService.log(user, manual(TODAY, 8, 77, null));
        service.ingest(user, List.of(night(TODAY.minusDays(1), 80)), TODAY, TODAY.minusDays(1), TODAY);
        Map<String, Object> row = live(user).stream().filter(r -> r.get("date").toString().equals(TODAY.toString()))
            .findFirst().orElseThrow();
        assertThat(row.get("source")).isEqualTo("manual");
        assertThat(row.get("external_id")).isNull();
        assertThat(row.get("hypnogram")).isNull();
        assertThat(row.get("deep_min")).isNull();
        assertThat(row.get("source_app")).isNull();
        assertThat(row.get("sleeping_hr")).isNull();
        assertThat(row.get("bedtime")).isEqualTo("23:40");
        assertThat(row.get("quality")).isEqualTo(8);
        assertThat(row.get("source_quality_pct")).isEqualTo(77);
    }

    @Test
    void resyncWithWindowIsIdempotentAndPublishesNoSecondEvent() {
        UUID user = databasePopulator.populateUser("a@test.local");
        IngestResult first = service.ingest(user, nightsEndingOn(TODAY, 3), TODAY, TODAY.minusDays(2), TODAY);
        assertThat(first.getInserted()).isEqualTo(3);
        events.clear();
        IngestResult second = service.ingest(user, nightsEndingOn(TODAY, 3), TODAY, TODAY.minusDays(2), TODAY);
        assertThat(second.getInserted()).isZero();
        assertThat(second.getUpdated()).isEqualTo(3);
        assertThat(live(user)).hasSize(3);
        assertThat(events.stream(SleepLogSavedEvent.class)).isEmpty();
    }
}

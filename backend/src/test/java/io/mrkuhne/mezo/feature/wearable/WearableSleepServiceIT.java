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
            .hypnogram(new Hypnogram().bucketMin(5).stages("LLLLDDRR"));
    }

    private static List<SleepNightIn> nightsEndingOn(LocalDate last, int count) {
        return IntStream.range(0, count).mapToObj(i -> night(last.minusDays(count - 1 - i), 80)).toList();
    }

    private List<Map<String, Object>> rows(UUID user) {
        return jdbc.queryForList(
            "select source, deep_min, hypnogram::text as hyp from sleep_log where created_by = ? order by date", user);
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
}

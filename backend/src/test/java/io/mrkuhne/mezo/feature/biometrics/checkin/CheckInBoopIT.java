package io.mrkuhne.mezo.feature.biometrics.checkin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.api.dto.CheckInItemId;
import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.api.dto.CheckInSnapshot;
import io.mrkuhne.mezo.api.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.feature.biometrics.checkin.config.OwnerZoneProperties;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInSnapshotEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInBiomarkerSource;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInText;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** Boop B3 (mezo-r36n9.13, spec §7.2–7.3): captured-at, the date window, the snapshot, the evening merge. */
@Transactional
class CheckInBoopIT extends AbstractIntegrationTest {

    @Autowired private CheckInService service;
    @Autowired private CheckInRepository repository;
    @Autowired private OwnerZoneProperties ownerZone;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private EntityManager entityManager;
    @Autowired private PlatformTransactionManager transactionManager;
    /** The server fallback's Health reads (wearable) — stubbed here; the real one is WearableCheckInBiomarkerSourceIT. */
    @MockitoBean private CheckInBiomarkerSource biomarkerSource;

    private ZoneId zone;
    private LocalDate today;

    @BeforeEach
    void setUp() {
        zone = ownerZone.zoneId();
        today = LocalDate.now(zone);
    }

    private static SaveCheckInRequest.SaveCheckInRequestBuilder request(LocalDate date, String slot) {
        return SaveCheckInRequest.builder().date(date).slotTime(slot).state("done")
            .energy(7).mood(6).stress(4).body(5).mental(8);
    }

    private CheckInSnapshot phoneSnapshot(Instant at) {
        return new CheckInSnapshot().hrBpm(78).hrAt(at.minus(3, ChronoUnit.MINUTES).atOffset(ZoneOffset.UTC))
            .hrvMs(38.4).hrvAt(at.minus(2, ChronoUnit.HOURS).atOffset(ZoneOffset.UTC)).hrvUsualMs(50.0)
            .steps(7420).stepsIsDayTotal(false).sleepMinutes(451).source("com.apple.health.watch")
            .computedBy(CheckInSnapshot.ComputedByEnum.PHONE);
    }

    private int count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    @Test
    void savesYesterdayWithCapturedAt() {
        UUID user = databasePopulator.populateUser("a@test.local");
        LocalDate yesterday = today.minusDays(1);
        OffsetDateTime captured = yesterday.atTime(16, 2).atZone(zone).toOffsetDateTime();

        CheckInResponse saved = service.save(user, request(yesterday, "14:00").capturedAt(captured).build());

        assertThat(saved.getSavedAt().toInstant()).isEqualTo(captured.toInstant());
        assertThat(repository.findByCreatedByAndDateAndSlotTime(user, yesterday, "14:00").orElseThrow().getSavedAt())
            .isEqualTo(captured.toInstant());
    }

    @Test
    void rejectsFutureAndOlderThanSevenDays() {
        UUID user = databasePopulator.populateUser("a@test.local");

        assertThatThrownBy(() -> service.save(user, request(today.plusDays(1), "06:30").build()))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThatThrownBy(() -> service.save(user, request(today.minusDays(8), "06:30").build()))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
        // The window's edges are inclusive: today − 7 and today are accepted.
        assertThat(service.save(user, request(today.minusDays(7), "06:30").build()).getDate())
            .isEqualTo(today.minusDays(7));
        assertThat(service.save(user, request(today, "06:30").build()).getDate()).isEqualTo(today);
    }

    @Test
    void rejectsCapturedAtMoreThanFiveMinutesAhead() {
        UUID user = databasePopulator.populateUser("a@test.local");
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        assertThatThrownBy(() -> service.save(user, request(today, "06:30").capturedAt(now.plusMinutes(10)).build()))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThatThrownBy(() -> service.mergeEvening(user, today, 7, 8, now.plusMinutes(10).toInstant()))
            .isInstanceOf(SystemRuntimeErrorException.class);
        // A phone clock a little ahead is tolerated.
        assertThat(service.save(user, request(today, "06:30").capturedAt(now.plusMinutes(2)).build()).getSavedAt())
            .isNotNull();
    }

    /** Spec §7.3: the server fallback must never lose the check-in — a throwing Health read leaves an empty
     *  server snapshot and the save commits (no rollback-only outer transaction). */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void fallbackFailureStillSavesWithEmptyServerSnapshot() {
        UUID user = databasePopulator.populateUser("a@test.local");
        when(biomarkerSource.snapshotAt(any(), any())).thenThrow(new IllegalStateException("health read failed"));

        CheckInResponse saved = service.save(user, request(today, "10:00").build());

        assertThat(saved.getSnapshot().getComputedBy()).isEqualTo(CheckInSnapshot.ComputedByEnum.SERVER);
        assertThat(saved.getSnapshot().getHrBpm()).isNull();
        assertThat(count("select count(*) from check_in where created_by = ? and is_deleted = false", user))
            .isEqualTo(1);
        assertThat(count("""
            select count(*) from check_in_snapshot where created_by = ? and is_deleted = false
              and computed_by = 'server' and hr_bpm is null and hrv_ms is null and hrv_usual_ms is null
              and steps is null and sleep_minutes is null and source is null
            """, user)).isEqualTo(1);
    }

    /** Task 4's day close calls mergeEvening from its own transaction: repeated writes of one slot inside an
     *  outer transaction still end in one row (no unique violation poisoning the caller). */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void writesInsideAnOuterTransactionKeepOneRowPerSlot() {
        UUID user = databasePopulator.populateUser("a@test.local");
        Instant at = Instant.now().truncatedTo(ChronoUnit.SECONDS);

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            service.mergeEvening(user, today, 6, 7, at);
            service.mergeEvening(user, today, 7, 8, at);
            service.save(user, request(today, "10:00").snapshot(phoneSnapshot(at)).build());
            service.save(user, request(today, "10:00").energy(9).snapshot(phoneSnapshot(at)).build());
        });

        assertThat(count("select count(*) from check_in where created_by = ? and slot_time = '20:00'", user))
            .isEqualTo(1);
        assertThat(count("select energy from check_in where created_by = ? and slot_time = '20:00'", user))
            .isEqualTo(7);
        assertThat(count("select count(*) from check_in where created_by = ? and slot_time = '10:00'", user))
            .isEqualTo(1);
        assertThat(count("select count(*) from check_in_snapshot where created_by = ? and is_deleted = false", user))
            .isEqualTo(1);
    }

    /** A real race: B's save of the same slot starts while A's transaction holds its fresh, uncommitted row.
     *  B waits on the insert, then finds A's row and replaces it — one row, one snapshot, no 500. */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentSavesOfOneSlotKeepOneRow() throws Exception {
        UUID user = databasePopulator.populateUser("a@test.local");
        Instant at = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        CountDownLatch aWrote = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> a = pool.submit(() -> new TransactionTemplate(transactionManager).executeWithoutResult(st -> {
                service.save(user, request(today, "14:00").energy(3).snapshot(phoneSnapshot(at)).build());
                aWrote.countDown();
                try {
                    Thread.sleep(500); // keep A's row uncommitted while B races it
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                }
            }));
            assertThat(aWrote.await(30, TimeUnit.SECONDS)).isTrue();
            Future<CheckInResponse> b = pool.submit(() ->
                service.save(user, request(today, "14:00").energy(9).snapshot(phoneSnapshot(at)).build()));
            a.get(30, TimeUnit.SECONDS);
            assertThat(b.get(30, TimeUnit.SECONDS).getEnergy()).isEqualTo(9);
        } finally {
            pool.shutdownNow();
        }

        assertThat(count("select count(*) from check_in where created_by = ? and slot_time = '14:00'", user))
            .isEqualTo(1);
        assertThat(count("select energy from check_in where created_by = ? and slot_time = '14:00'", user))
            .isEqualTo(9);
        assertThat(count("select count(*) from check_in_snapshot where created_by = ? and is_deleted = false", user))
            .isEqualTo(1);
    }

    /** The day close's case: two closes of the same evening race, EACH inside its caller's transaction. The
     *  loser must not hit a unique violation (it would poison its caller's transaction); it waits, then merges
     *  into the winner's row. */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentEveningMergesInsideCallerTransactionsKeepOneRow() throws Exception {
        UUID user = databasePopulator.populateUser("a@test.local");
        Instant at = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        CountDownLatch aWrote = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> a = pool.submit(() -> new TransactionTemplate(transactionManager).executeWithoutResult(st -> {
                service.mergeEvening(user, today, 4, 5, at);
                aWrote.countDown();
                try {
                    Thread.sleep(500);
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                }
            }));
            assertThat(aWrote.await(30, TimeUnit.SECONDS)).isTrue();
            Future<CheckInResponse> b = pool.submit(() -> new TransactionTemplate(transactionManager)
                .execute(st -> service.mergeEvening(user, today, 8, 9, at)));
            a.get(30, TimeUnit.SECONDS);
            assertThat(b.get(30, TimeUnit.SECONDS).getEnergy()).isEqualTo(8);
        } finally {
            pool.shutdownNow();
        }

        assertThat(count("select count(*) from check_in where created_by = ? and slot_time = '20:00'", user))
            .isEqualTo(1);
        assertThat(count("select day_rating from check_in where created_by = ? and slot_time = '20:00'", user))
            .isEqualTo(9);
    }

    @Test
    void storesPhoneSnapshot() {
        UUID user = databasePopulator.populateUser("a@test.local");
        Instant at = Instant.now().truncatedTo(ChronoUnit.SECONDS);

        CheckInResponse saved = service.save(user, request(today, "10:00")
            .capturedAt(at.atOffset(ZoneOffset.UTC)).snapshot(phoneSnapshot(at)).build());

        CheckInSnapshot s = saved.getSnapshot();
        assertThat(s).isNotNull();
        assertThat(s.getComputedBy()).isEqualTo(CheckInSnapshot.ComputedByEnum.PHONE);
        assertThat(s.getHrBpm()).isEqualTo(78);
        assertThat(s.getHrAt().toInstant()).isEqualTo(at.minus(3, ChronoUnit.MINUTES));
        assertThat(s.getHrvMs()).isEqualTo(38.4);
        assertThat(s.getHrvAt().toInstant()).isEqualTo(at.minus(2, ChronoUnit.HOURS));
        assertThat(s.getHrvUsualMs()).isEqualTo(50.0);
        assertThat(s.getSteps()).isEqualTo(7420);
        assertThat(s.getStepsIsDayTotal()).isFalse();
        assertThat(s.getSleepMinutes()).isEqualTo(451);
        assertThat(s.getSource()).isEqualTo("com.apple.health.watch");

        entityManager.flush();
        entityManager.clear();
        assertThat(service.listForDay(user, today).getFirst().getSnapshot().getHrBpm()).isEqualTo(78);
    }

    @Test
    void retryIsIdempotent() {
        UUID user = databasePopulator.populateUser("a@test.local");
        Instant at = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        SaveCheckInRequest same = request(today, "10:00")
            .capturedAt(at.atOffset(ZoneOffset.UTC)).snapshot(phoneSnapshot(at)).build();

        CheckInResponse first = service.save(user, same);
        CheckInResponse second = service.save(user, same);
        entityManager.flush();

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(count("select count(*) from check_in where created_by = ? and is_deleted = false", user))
            .isEqualTo(1);
        assertThat(count("select count(*) from check_in_snapshot where created_by = ? and is_deleted = false", user))
            .isEqualTo(1);
    }

    @Test
    void mergeEveningKeepsOtherFields() {
        UUID user = databasePopulator.populateUser("a@test.local");
        LocalDate yesterday = today.minusDays(1);
        service.save(user, request(yesterday, "20:00").state("skipped").energy(3).mood(6).dayRating(4)
            .note("web este").build());
        Instant captured = yesterday.atTime(LocalTime.of(21, 40)).atZone(zone).toInstant();

        CheckInResponse merged = service.mergeEvening(user, yesterday, 7, 8, captured);

        assertThat(merged.getState()).isEqualTo("done"); // the close answered a skipped evening
        assertThat(merged.getMood()).isEqualTo(6);
        assertThat(merged.getNote()).isEqualTo("web este");
        assertThat(merged.getEnergy()).isEqualTo(7);
        assertThat(merged.getDayRating()).isEqualTo(8);
        assertThat(merged.getSavedAt().toInstant()).isEqualTo(captured);
        assertThat(count("select count(*) from check_in where created_by = ? and slot_time = '20:00'", user))
            .isEqualTo(1);

        // No evening row yet: a minimal done row carrying only the two answers.
        CheckInResponse created = service.mergeEvening(user, today, 5, 6, Instant.now());
        assertThat(created.getSlotTime()).isEqualTo("20:00");
        assertThat(created.getState()).isEqualTo("done");
        assertThat(created.getEnergy()).isEqualTo(5);
        assertThat(created.getDayRating()).isEqualTo(6);
        assertThat(created.getMood()).isNull();
        assertThat(created.getQuickExit()).isFalse();
        assertThat(created.getAskedItems()).containsExactly(CheckInItemId.ENERGY, CheckInItemId.DAY);
    }

    @Test
    void checkInTextAddsSnapshotLine() {
        CheckInSnapshotEntity s = new CheckInSnapshotEntity();
        s.setHrBpm(78);
        s.setHrvMs(38.4);
        s.setHrvUsualMs(50.0);
        s.setSteps(7420);

        assertThat(CheckInText.snapshotLine(s)).contains("pulzus 78, HRV 38 (szokott 50)")
            .isEqualTo("pulzus 78, HRV 38 (szokott 50), 7 420 lépés");
        assertThat(CheckInText.snapshotLine(new CheckInSnapshotEntity())).isEmpty();
        assertThat(CheckInText.snapshotLine(null)).isEmpty();
    }
}

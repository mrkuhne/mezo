package io.mrkuhne.mezo.feature.biometrics.checkin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.api.dto.CheckInSnapshot;
import io.mrkuhne.mezo.api.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.feature.biometrics.checkin.config.OwnerZoneProperties;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInSnapshotEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** Boop B3 (mezo-r36n9.13, spec §7.2–7.3): captured-at, the date window, the snapshot, the evening merge. */
@Transactional
class CheckInBoopIT extends AbstractIntegrationTest {

    @Autowired private CheckInService service;
    @Autowired private CheckInRepository repository;
    @Autowired private OwnerZoneProperties ownerZone;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private EntityManager entityManager;

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
        service.save(user, request(yesterday, "20:00").energy(3).mood(6).dayRating(4).note("web este").build());
        Instant captured = yesterday.atTime(LocalTime.of(21, 40)).atZone(zone).toInstant();

        CheckInResponse merged = service.mergeEvening(user, yesterday, 7, 8, captured);

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

package io.mrkuhne.mezo.feature.capacity.service;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.CalendarDayIn;
import io.mrkuhne.mezo.api.dto.CalendarEventIn;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityLiveStateEntity;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityProposalEntity;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityLiveStateRepository;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityProposalRepository;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.feature.wearable.service.CalendarSnapshotService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Boop B7 K3 (mezo-r36n9.17, Task 20): the live re-plan loop. Driven through the real calendar PUT, so the
 * AFTER_COMMIT event fires on its own and the listener runs in the background. His "today" is pinned to a Thursday
 * 07:00 (the week after next, so every day of the week is ahead of the real clock) with a „Pull 1" gym session at
 * 17:30. A light calendar is the baseline; three meetings with people (6 hours) make the day worse by at least a step.
 * Names and figures are invented.
 */
@Import(DayAdjustmentServiceIT.ClockConfig.class)
class LiveReplanListenerIT extends AbstractIntegrationTest {

    @Autowired private CalendarSnapshotService calendarSnapshot;
    @Autowired private CapacityProposalRepository proposals;
    @Autowired private CapacityLiveStateRepository states;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private TrainPopulator train;
    @Autowired private WearableProperties wearable;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private DayAdjustmentServiceIT.MutableClock clock;

    private final LocalDate monday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        .plusWeeks(2);
    private final LocalDate today = monday.plusDays(3);
    private Instant seven;

    @BeforeEach
    void pinClock() {
        seven = today.atTime(7, 0).atZone(zone()).toInstant();
        clock.set(seven);
    }

    @AfterEach
    void resetClock() {
        clock.reset();
    }

    private ZoneId zone() {
        return ZoneId.of(wearable.zone());
    }

    private UUID owner(String label) {
        UUID owner = databasePopulator.populateUser(label + "-" + UUID.randomUUID() + "@test.local");
        var meso = train.createActiveMeso(owner);
        int dow = today.getDayOfWeek().getValue() - 1;
        WorkoutSessionEntity s = train.createWorkoutSession(owner, meso.getId(), WorkoutService.HU_DAY_LABELS.get(dow),
            "Pull 1", dow, "active");
        train.createExercise(owner, s.getId(), "Evezés", 0);
        train.createGymSlot(owner, dow, "17:30");
        return owner;
    }

    private OffsetDateTime at(int h, int m) {
        return today.atTime(LocalTime.of(h, m)).atZone(zone()).toOffsetDateTime();
    }

    private static CalendarEventIn event(String key, String title, OffsetDateTime start, int hours, int people) {
        return new CalendarEventIn().externalId(key).title(title).startAt(start).endAt(start.plusHours(hours))
            .allDay(false).attendeeCount(people);
    }

    /** A short solo block: the baseline day. */
    private void light(UUID owner) {
        put(owner, List.of(event("ek-focus|1", "Fókusz", at(8, 0), 1, 0)));
    }

    /** Three meetings with people, six hours. */
    private void packed(UUID owner) {
        put(owner, List.of(event("ek-plan|1", "Tervezés", at(8, 0), 4, 4),
            event("ek-sync|1", "Egyeztetés", at(13, 0), 1, 4),
            event("ek-handover|1", "Átadó", at(14, 30), 1, 4)));
    }

    private void put(UUID owner, List<CalendarEventIn> events) {
        calendarSnapshot.replace(owner, List.of(new CalendarDayIn().date(today).events(new ArrayList<>(events))));
    }

    private CapacityLiveStateEntity state(UUID owner) {
        return states.findByCreatedByAndDeletedFalse(owner).orElse(null);
    }

    private List<CapacityProposalEntity> openToday(UUID owner) {
        return proposals.findByCreatedByAndWeekStartAndDeletedFalse(owner, monday).stream()
            .filter(p -> "open".equals(p.getStatus()) && today.equals(p.getDay()))
            .toList();
    }

    private void baseline(UUID owner) {
        light(owner);
        await().atMost(30, SECONDS).untilAsserted(() -> {
            assertThat(state(owner)).isNotNull();
            assertThat(state(owner).getDay()).isEqualTo(today);
        });
        assertThat(LiveReplanListener.step(state(owner).getVerdict())).isLessThanOrEqualTo(1); // laza / rendben
        assertThat(proposals.findByCreatedByAndWeekStartAndDeletedFalse(owner, monday)).isEmpty();
    }

    @Test
    void worseningByAStepCreatesTodayProposal() {
        UUID owner = owner("live-worse");
        baseline(owner);

        packed(owner);

        await().atMost(30, SECONDS).untilAsserted(() -> assertThat(openToday(owner)).isNotEmpty());
        CapacityLiveStateEntity s = state(owner);
        assertThat(LiveReplanListener.step(s.getVerdict())).isGreaterThanOrEqualTo(2); // szoros / túl sok
        assertThat(s.getProposedAt()).isEqualTo(seven);
        CapacityProposalEntity p = openToday(owner).get(0);
        assertThat(p.getTitle()).isNotBlank();   // the template's words, at once
        assertThat(p.getFingerprint()).isNotNull();
    }

    @Test
    void sameVerdictCreatesNothing() {
        UUID owner = owner("live-same");
        baseline(owner);
        String verdict = state(owner).getVerdict();

        // another light calendar: the same verdict, nothing to propose
        put(owner, List.of(event("ek-focus|1", "Fókusz", at(9, 0), 1, 0)));

        await().during(3, SECONDS).atMost(10, SECONDS).untilAsserted(() -> {
            assertThat(proposals.findByCreatedByAndWeekStartAndDeletedFalse(owner, monday)).isEmpty();
            assertThat(state(owner).getVerdict()).isEqualTo(verdict);
            assertThat(state(owner).getProposedAt()).isNull();
        });
    }

    @Test
    void rateLimitedToOnePerThreeHours() {
        UUID owner = owner("live-limit");
        baseline(owner);
        packed(owner);
        await().atMost(30, SECONDS).untilAsserted(() -> assertThat(openToday(owner)).isNotEmpty());
        List<UUID> first = openToday(owner).stream().map(CapacityProposalEntity::getId).toList();
        // the cards lapsed (as a stale fingerprint would): each (kind, today) is free again
        first.forEach(id -> jdbc.update("update capacity_proposal set status = 'expired' where id = ?", id));

        // an hour later: the day eases, then gets worse again — inside the interval, nothing new
        clock.set(seven.plus(Duration.ofHours(1)));
        light(owner);
        await().atMost(30, SECONDS).untilAsserted(() ->
            assertThat(LiveReplanListener.step(state(owner).getVerdict())).isLessThanOrEqualTo(1));
        packed(owner);
        await().during(3, SECONDS).atMost(10, SECONDS).untilAsserted(() -> {
            assertThat(openToday(owner)).isEmpty();
            assertThat(state(owner).getProposedAt()).isEqualTo(seven);
            // held back: the eased reading stays, so the next trigger after the interval still sees a worse day
            assertThat(LiveReplanListener.step(state(owner).getVerdict())).isLessThanOrEqualTo(1);
        });

        // past three hours: the next trigger proposes again
        Instant later = seven.plus(Duration.ofHours(3)).plusSeconds(60);
        clock.set(later);
        packed(owner);
        await().atMost(30, SECONDS).untilAsserted(() -> assertThat(openToday(owner)).hasSize(1));
        assertThat(first).doesNotContain(openToday(owner).get(0).getId());
        assertThat(state(owner).getProposedAt()).isEqualTo(later);
    }
}

package io.mrkuhne.mezo.feature.notification;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.feature.medication.entity.MedicationCycleJson;
import io.mrkuhne.mezo.feature.medication.entity.MedicationDoseEntity;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationDoseRepository;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.notification.repository.PushLogRepository;
import io.mrkuhne.mezo.feature.notification.service.NotificationDispatchJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.NotificationPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.TestPropertySource;

/**
 * N2 per-minute dispatch (bd mezo-h4wp.6.2), driven directly through {@code runOnce} — this suite
 * never waits for a real cron minute to fire. Each test pins down one of the load-bearing
 * behaviors from the design: the write-log-then-async-send order, the {@code push_log} dedup, the
 * per-category enable gate, and per-user failure isolation.
 *
 * <p>{@code WEDNESDAY} matches {@code AnchorResolverIT}'s convention (today's date in this repo's
 * fixture era). The fixed minute-of-day values used below are chosen far from the ritual family's
 * own always-on default anchors (opens at bed-75={@code 21:45}, lights-out at the config-fallback
 * bed time {@code 23:00}) so those two default-enabled categories — present for every user,
 * including a freshly created one with no data — never interfere with the counts asserted here.
 *
 * <p>This job fires every minute ({@code mezo.notification.dispatch-cron: "0 * * * * *"}) — unlike
 * every other cron in this app, which anchors on a rare fixed time (nightly, weekly, "06:25
 * daily"). {@code src/test/resources/application.properties} therefore turns the dispatch-job
 * switch OFF for the whole test context by default: leaving it on globally lets the real scheduler
 * thread genuinely tick mid-suite and race another test class's {@code ResetDatabase} TRUNCATE
 * (verified: a real Postgres deadlock, {@code [scheduling-1]} firing at the real wall-clock
 * minute). This class still needs the bean to exist (to call {@link
 * NotificationDispatchJob#runOnce}), so it re-enables the switch via its own
 * {@code @TestPropertySource} — but ALSO pins {@code dispatch-cron} to a date that can never
 * occur ({@code 0 0 5 31 2 ?}, February 31st), so the {@code @Scheduled} method can never actually
 * fire in this class's own context either. Every test here drives {@code runOnce(date, minute)}
 * directly; none of them needs (or should depend on) the real tick — a per-minute schedule left
 * reachable, even confined to one test class, was empirically observed to fire inside this class's
 * own isolated run in several separate {@code clean test} invocations, so shrinking the window was
 * not enough; only an unreachable cron removes the race.
 */
@TestPropertySource(properties = {
        "mezo.techcore.cron.notification-dispatch-job.enabled=true",
        // February 31st never occurs — CronExpression accepts it as legal-but-unmatchable, so the
        // @Scheduled method is wired but can never fire. See the class javadoc above.
        "mezo.notification.dispatch-cron=0 0 5 31 2 ?"
})
class NotificationDispatchJobIT extends AbstractIntegrationTest {

    private static final LocalDate WEDNESDAY = LocalDate.of(2026, 7, 29);

    /** ISO 1=Mon..7=Sun minus 1 -> legacy 0=Mon..6=Sun (gym_schedule_slot's numbering). */
    private static final int WEDNESDAY_LEGACY_DOW = WEDNESDAY.getDayOfWeek().getValue() - 1;

    /** A 10:00 gym slot minus the GYM category's default 30-min lead -> fires at 09:30. */
    private static final int GYM_FIRE_MINUTE = 9 * 60 + 30;
    private static final String GYM_DEDUP_KEY = "gym:10:00";

    @Autowired private NotificationDispatchJob job;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private NotificationPopulator notificationPopulator;
    @Autowired private PushLogRepository pushLogRepository;
    @Autowired private MedicationRepository medicationRepository;
    @Autowired private MedicationDoseRepository medicationDoseRepository;
    @Autowired(required = false) private ThreadPoolTaskExecutor applicationTaskExecutor;

    private UUID newOwner(String emailLocalPart) {
        return userPopulator.createUser(emailLocalPart + "@test.local").getId();
    }

    @Test
    void testRunOnce_shouldWritePushLogAndReportOneDispatch_whenAGymSlotIsDueThisMinute() {
        UUID owner = newOwner("dispatch-due");
        trainPopulator.createGymSlot(owner, WEDNESDAY_LEGACY_DOW, "10:00");

        int dispatched = job.runOnce(WEDNESDAY, GYM_FIRE_MINUTE);

        assertThat(dispatched).isEqualTo(1);
        assertThat(pushLogRepository.existsByCreatedByAndLogDateAndDedupKey(owner, WEDNESDAY, GYM_DEDUP_KEY))
                .isTrue();
    }

    @Test
    void testRunOnce_shouldDispatchOnlyOnce_whenCalledTwiceForTheSameMinute() {
        UUID owner = newOwner("dispatch-dedup");
        trainPopulator.createGymSlot(owner, WEDNESDAY_LEGACY_DOW, "10:00");

        int first = job.runOnce(WEDNESDAY, GYM_FIRE_MINUTE);
        int second = job.runOnce(WEDNESDAY, GYM_FIRE_MINUTE);

        assertThat(first).isEqualTo(1);
        assertThat(second).as("the push_log dedup — running the same minute twice must not re-fire").isEqualTo(0);
        assertThat(pushLogRepository.findByCreatedByAndLogDate(owner, WEDNESDAY)).hasSize(1);
    }

    @Test
    void testRunOnce_shouldDispatchNothing_whenTheCategoryIsDisabled() {
        UUID owner = newOwner("dispatch-disabled");
        trainPopulator.createGymSlot(owner, WEDNESDAY_LEGACY_DOW, "10:00");
        notificationPopulator.pref(owner, "gym", false, 30);

        int dispatched = job.runOnce(WEDNESDAY, GYM_FIRE_MINUTE);

        assertThat(dispatched).isEqualTo(0);
        assertThat(pushLogRepository.findByCreatedByAndLogDate(owner, WEDNESDAY)).isEmpty();
    }

    @Test
    void testRunOnce_shouldStillDispatchForTheOtherUser_whenOneUsersResolverThrows() {
        UUID brokenOwner = newOwner("dispatch-broken");
        UUID healthyOwner = newOwner("dispatch-healthy");
        breakMedicationData(brokenOwner);
        trainPopulator.createGymSlot(healthyOwner, WEDNESDAY_LEGACY_DOW, "10:00");

        int dispatched = job.runOnce(WEDNESDAY, GYM_FIRE_MINUTE);

        assertThat(dispatched).as("the broken user's failure must not swallow the healthy user's dispatch")
                .isEqualTo(1);
        assertThat(pushLogRepository.findByCreatedByAndLogDate(healthyOwner, WEDNESDAY)).hasSize(1);
        assertThat(pushLogRepository.findByCreatedByAndLogDate(brokenOwner, WEDNESDAY)).isEmpty();
    }

    @Test
    void testRunOnce_shouldPersistThePushLogRowBeforeHandingTheSendToTheAsyncExecutor_whenAnItemIsDue() {
        UUID owner = newOwner("dispatch-async");
        trainPopulator.createGymSlot(owner, WEDNESDAY_LEGACY_DOW, "10:00");
        assertThat(applicationTaskExecutor).as("Boot's auto-configured async pool must be present").isNotNull();
        long completedBefore = applicationTaskExecutor.getThreadPoolExecutor().getCompletedTaskCount();

        int dispatched = job.runOnce(WEDNESDAY, GYM_FIRE_MINUTE);

        // Written on the CALLING thread, before the async handoff — already true the instant
        // runOnce() returns; no polling needed for this half of the ordering claim.
        assertThat(dispatched).isEqualTo(1);
        assertThat(pushLogRepository.existsByCreatedByAndLogDateAndDedupKey(owner, WEDNESDAY, GYM_DEDUP_KEY))
                .isTrue();
        // The send genuinely left the scheduler thread: this counter only moves if @Async took
        // effect through Spring's proxy — the self-invocation trap (a same-bean call instead of
        // going through PushDispatchExecutor) would leave applicationTaskExecutor's own counters
        // untouched forever, so this assertion would time out and fail on a regression.
        await().atMost(5, SECONDS).untilAsserted(() ->
                assertThat(applicationTaskExecutor.getThreadPoolExecutor().getCompletedTaskCount())
                        .isGreaterThan(completedBefore));
    }

    /**
     * An empty {@code phases} list: {@code MedicationCycleService.phaseOf} falls back to
     * {@code phases.get(phases.size() - 1)} when no range matches, which throws
     * {@code IndexOutOfBoundsException} on an empty list once a dose has been logged (so
     * {@code cycleDay} is positive, not the honest-zero no-dose case) — a deterministic, realistic
     * "this user's data is broken" scenario that reaches {@code AnchorResolver} through the
     * medication anchor, without needing any test double.
     */
    private void breakMedicationData(UUID owner) {
        MedicationEntity med = new MedicationEntity();
        med.setCreatedBy(owner);
        med.setName("Broken");
        med.setCadence("weekly");
        med.setActive(true);
        med.setCycle(new MedicationCycleJson(7, List.of()));
        med = medicationRepository.saveAndFlush(med);

        MedicationDoseEntity dose = new MedicationDoseEntity();
        dose.setCreatedBy(owner);
        dose.setMedicationId(med.getId());
        dose.setAdministeredAt(WEDNESDAY.atStartOfDay(ZoneOffset.UTC).toInstant());
        dose.setAdministeredDate(WEDNESDAY);
        dose.setDose(new BigDecimal("1"));
        medicationDoseRepository.saveAndFlush(dose);
    }
}

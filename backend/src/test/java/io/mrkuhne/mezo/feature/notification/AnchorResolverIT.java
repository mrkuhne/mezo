package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.notification.domain.AnchorSet;
import io.mrkuhne.mezo.feature.notification.domain.AnchorSet.AnchoredEvent;
import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import io.mrkuhne.mezo.feature.notification.service.AnchorResolver;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.MedicationDosePopulator;
import io.mrkuhne.mezo.support.populator.MedicationPopulator;
import io.mrkuhne.mezo.support.populator.MemoirPopulator;
import io.mrkuhne.mezo.support.populator.NotificationPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.SportSlotSkipPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeeklyReviewPopulator;
import io.mrkuhne.mezo.support.populator.WeeklySuggestionPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Anchor resolution across the 14 categories (bd mezo-h4wp.6.2, mezo-gst9), focused on the traps that would
 * silently misfire a notification: the gym/sport weekday's 0-based-vs-ISO conversion, prose
 * anchors existing only when their content row exists, medication's honest {@code cycleDay == 0},
 * the FE-written schedule's {@code weekday = null} "every day" semantics, the prose-generation
 * grace (trap #6 — an anchor on its own generator's minute never fires), and the guarantee that
 * ONE malformed {@code notification_schedule} row cannot silence every category for that user.
 */
class AnchorResolverIT extends AbstractIntegrationTest {

    /** A known Wednesday (matches the current-date convention used elsewhere in this suite). */
    private static final LocalDate WEDNESDAY = LocalDate.of(2026, 7, 29);
    /** The ISO Monday of WEDNESDAY's own week — used both as the resolving date for the
     *  {@code WEEKLY_REVIEW} anchor (which fires only when resolving ON a Monday) and as a
     *  week-start key for the weekly-suggestion/weekly-review/memoir fixtures below. */
    private static final LocalDate MONDAY = LocalDate.of(2026, 7, 27);
    /** The Sunday that ends WEDNESDAY's week — `memoir` only anchors on a Sunday. */
    private static final LocalDate SUNDAY = LocalDate.of(2026, 8, 2);

    /** mezo.proactive.memoir.cron `0 0 19 * * SUN` + 15. */
    private static final int MEMOIR_GRACED_MINUTE = 19 * 60 + 15;
    /** mezo.proactive.feed.midday-cron `0 30 12 * * *` + 15. */
    private static final int MIDDAY_GRACED_MINUTE = 12 * 60 + 45;
    /** mezo.proactive.feed.evening-cron `0 30 20 * * *` + 15. */
    private static final int EVENING_GRACED_MINUTE = 20 * 60 + 45;
    /** Comfortably after the weekly generator's 06:00 — no grace applies. */
    private static final String LATE_WAKE = "08:20";

    @Autowired private AnchorResolver anchorResolver;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private SportSlotSkipPopulator sportSlotSkipPopulator;
    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private MedicationPopulator medicationPopulator;
    @Autowired private MedicationDosePopulator medicationDosePopulator;
    @Autowired private NotificationPopulator notificationPopulator;
    @Autowired private WeeklySuggestionPopulator weeklySuggestionPopulator;
    @Autowired private WeeklyReviewPopulator weeklyReviewPopulator;
    @Autowired private MemoirPopulator memoirPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;

    /** A day+time this class controls explicitly for the two event-kind anchors
     *  (sleep_reaction/weight_reaction), whose anchor is the row's OWN generation minute —
     *  {@link Instant#now()} would make the assertion flaky at the top of a minute. */
    private static Instant generatedAt(LocalDate date, int hour, int minute) {
        return date.atTime(LocalTime.of(hour, minute)).atZone(ZoneId.systemDefault()).toInstant();
    }

    /**
     * A fresh, self-created owner per test rather than the demodata-seeded one: this class's
     * plain {@code AbstractIntegrationTest} context has no {@code @TestPropertySource}/
     * {@code @ActiveProfiles} of its own, so it happens to share a Testcontainers Postgres with
     * many other test classes in the suite — some of which find-or-create the demodata owner
     * before this class runs, which is how it passed in CI despite never seeding the owner
     * itself. That made it order-dependent (fails if run alone, as {@code
     * AnchorResolverRitualSwitchOffIT} did in its OWN dedicated context — see bd mezo-h4wp.6.2).
     * Self-sufficiency removes the dependency entirely.
     */
    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    @Test
    void testResolve_shouldPickOnlyTheSlotForTodaysWeekday_whenAGymSlotExistsForEveryDayOfTheWeek() {
        UUID owner = ownerId();
        // date.getDayOfWeek().getValue() is ISO 1=Mon..7=Sun; gym_schedule_slot.dayOfWeek is
        // legacy 0=Mon..6=Sun — this is the exact off-by-one the resolver must convert correctly.
        int expectedLegacyDayOfWeek = WEDNESDAY.getDayOfWeek().getValue() - 1;
        for (int dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
            String time = String.format("%02d:00", 6 + dayOfWeek); // a distinct time per day
            trainPopulator.createGymSlot(owner, dayOfWeek, time);
        }

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        List<AnchoredEvent> gymEvents = anchors.backendAnchors().stream()
                .filter(e -> e.category() == NotificationCategory.GYM)
                .toList();
        String expectedTime = String.format("%02d:00", 6 + expectedLegacyDayOfWeek);
        assertThat(gymEvents).as("exactly one gym slot resolves — the one for today's weekday")
                .hasSize(1);
        assertThat(gymEvents.get(0).dedupSuffix()).as("dedupSuffix is the raw HH:mm, zero-padded")
                .isEqualTo(expectedTime);
        assertThat(gymEvents.get(0).minuteOfDay()).isEqualTo((6 + expectedLegacyDayOfWeek) * 60);
    }

    @Test
    void testResolve_shouldYieldNoAnchorForTheSportSlot_whenItsDatedOccurrenceIsSkipped() {
        UUID owner = ownerId();
        int legacyDayOfWeek = WEDNESDAY.getDayOfWeek().getValue() - 1;
        trainPopulator.createGymSlot(owner, legacyDayOfWeek, "07:00"); // untouched control anchor
        trainPopulator.createScheduleSlot(owner, legacyDayOfWeek, "18:30", 90, "training");
        sportSlotSkipPopulator.createSkip(owner, legacyDayOfWeek, "18:30", WEDNESDAY);

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        List<AnchoredEvent> gymEvents = anchors.backendAnchors().stream()
                .filter(e -> e.category() == NotificationCategory.GYM)
                .toList();
        assertThat(gymEvents)
                .as("the gym slot still resolves — only the skipped sport slot's own anchor is gone")
                .hasSize(1);
        assertThat(gymEvents)
                .as("no anchor carries the skipped sport slot's own time")
                .noneMatch(e -> "18:30".equals(e.dedupSuffix()));
    }

    @Test
    void testResolve_shouldStillYieldTheSportSlotAnchor_onADifferentDateTheSameSlotIsNotSkipped() {
        UUID owner = ownerId();
        int legacyDayOfWeek = WEDNESDAY.getDayOfWeek().getValue() - 1;
        LocalDate laterSameWeekday = WEDNESDAY.plusWeeks(1);
        trainPopulator.createScheduleSlot(owner, legacyDayOfWeek, "18:30", 90, "training");
        sportSlotSkipPopulator.createSkip(owner, legacyDayOfWeek, "18:30", WEDNESDAY); // only this date

        AnchorSet anchors = anchorResolver.resolve(owner, laterSameWeekday);

        assertThat(anchors.backendAnchors())
                .filteredOn(e -> e.category() == NotificationCategory.GYM)
                .as("the same recurring slot still anchors on a date it was NOT skipped")
                .singleElement()
                .satisfies(e -> assertThat(e.dedupSuffix()).isEqualTo("18:30"));
    }

    @Test
    void testResolve_shouldYieldABriefingAnchor_whenAMorningCompanionMessageExistsForTheDay() {
        UUID owner = ownerId();
        companionMessagePopulator.createMessage(owner, WEDNESDAY, CompanionMessageEntity.KIND_MORNING,
                "Reggeli", List.of("Jó reggelt, Daniel!"));

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        assertThat(anchors.proseAnchors())
                .anyMatch(e -> e.category() == NotificationCategory.BRIEFING);
    }

    @Test
    void testResolve_shouldYieldNoBriefingAnchor_whenNoBriefingRowExistsForTheDay() {
        UUID owner = ownerId();

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        assertThat(anchors.proseAnchors())
                .noneMatch(e -> e.category() == NotificationCategory.BRIEFING);
    }

    @Test
    void testResolve_shouldYieldNoMedicationAnchor_whenCycleDayIsZeroBecauseNoDoseWasEverLogged() {
        UUID owner = ownerId();
        medicationPopulator.createMedication(owner);
        // No dose logged — MedicationCycleService.derive(...) reports the honest cycleDay == 0.

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        assertThat(anchors.backendAnchors())
                .noneMatch(e -> e.category() == NotificationCategory.MEDICATION);
    }

    @Test
    void testResolve_shouldYieldAMedicationAnchor_whenADoseWasLoggedSoCycleDayIsPositive() {
        UUID owner = ownerId();
        MedicationEntity med = medicationPopulator.createMedication(owner);
        medicationDosePopulator.createDose(owner, med.getId(), WEDNESDAY, new BigDecimal("6"));

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        assertThat(anchors.backendAnchors())
                .anyMatch(e -> e.category() == NotificationCategory.MEDICATION);
    }

    @Test
    void testResolve_shouldResolveOnAnyDay_whenAScheduleEntryHasNoWeekday() {
        UUID owner = ownerId();
        notificationPopulator.schedule(owner, null, "14:00", "checkin", "Check-in", null, "/today", "test");

        AnchorSet mondayAnchors = anchorResolver.resolve(owner, WEDNESDAY.minusDays(2)); // Monday
        AnchorSet wednesdayAnchors = anchorResolver.resolve(owner, WEDNESDAY);

        assertThat(mondayAnchors.scheduleAnchors())
                .as("weekday=null resolves on ANY day").anyMatch(e -> e.category() == NotificationCategory.CHECKIN);
        assertThat(wednesdayAnchors.scheduleAnchors())
                .anyMatch(e -> e.category() == NotificationCategory.CHECKIN);
    }

    @Test
    void testResolve_shouldResolveOnlyOnItsOwnWeekday_whenAScheduleEntryNamesASpecificWeekday() {
        UUID owner = ownerId();
        int isoWednesday = WEDNESDAY.getDayOfWeek().getValue();
        notificationPopulator.schedule(owner, isoWednesday, "10:00", "fuel_slot", "Stack", null, "/fuel/stack", "test");

        AnchorSet wednesdayAnchors = anchorResolver.resolve(owner, WEDNESDAY);
        AnchorSet thursdayAnchors = anchorResolver.resolve(owner, WEDNESDAY.plusDays(1));

        assertThat(wednesdayAnchors.scheduleAnchors())
                .as("fires on its named weekday").anyMatch(e -> e.category() == NotificationCategory.FUEL_SLOT);
        assertThat(thursdayAnchors.scheduleAnchors())
                .as("does not fire on any other weekday").noneMatch(e -> e.category() == NotificationCategory.FUEL_SLOT);
    }

    // ---- trap #6: a prose anchor must never land on its own generator's minute -------------------

    // ---- the retired `weekly` push must never emit again (mezo-p2tr) -----------------------------

    @Test
    void testResolve_shouldYieldNoWeeklyAnchor_whenAWeeklySuggestionRowExistsBecauseThePushWasRetired() {
        UUID owner = ownerId();
        // A weekly_suggestion row still exists (the /me/week plan-suggestion GET keeps using it),
        // but AnchorResolver no longer emits a `weekly` push for it — only weekly_review does now.
        weeklySuggestionPopulator.suggestion(owner, MONDAY);

        AnchorSet anchors = anchorResolver.resolve(owner, MONDAY);

        assertThat(anchors.proseAnchors())
                .noneMatch(e -> e.category() == NotificationCategory.WEEKLY);
    }

    // ---- weekly_review: Monday 10:00, keyed by the JUST-FINISHED week (mezo-p2tr) -----------------

    @Test
    void testResolve_shouldYieldAWeeklyReviewAnchor_whenARowExistsForTheJustFinishedWeek() {
        UUID owner = ownerId();
        // The job runs Monday morning and writes the row keyed by the FINISHED week's own Monday —
        // one week before the resolving date.
        LocalDate finishedWeekStart = MONDAY.minusWeeks(1);
        weeklyReviewPopulator.weeklyReview(owner, finishedWeekStart);

        AnchorSet anchors = anchorResolver.resolve(owner, MONDAY);

        AnchoredEvent review = proseEvent(anchors, NotificationCategory.WEEKLY_REVIEW);
        assertThat(review.minuteOfDay()).as("fixed 10:00, never generation-graced").isEqualTo(10 * 60);
        assertThat(review.dedupSuffix()).isEqualTo("10:00");
        assertThat(review.title()).isEqualTo("Mezo · heti elemzés");
        assertThat(review.body()).isEqualTo("Teszt heti elemzés.");
        assertThat(review.url()).isEqualTo("/me/week?start=" + finishedWeekStart);
    }

    @Test
    void testResolve_shouldYieldNoWeeklyReviewAnchor_whenNoRowExistsForTheJustFinishedWeek() {
        UUID owner = ownerId();

        AnchorSet anchors = anchorResolver.resolve(owner, MONDAY);

        assertThat(anchors.proseAnchors())
                .noneMatch(e -> e.category() == NotificationCategory.WEEKLY_REVIEW);
    }

    @Test
    void testResolve_shouldYieldNoWeeklyReviewAnchor_whenTheRowExistsButTodayIsNotMonday() {
        UUID owner = ownerId();
        // Keyed by WEDNESDAY's own week — irrelevant, since weekly_review only ever anchors on Monday.
        weeklyReviewPopulator.weeklyReview(owner, WEDNESDAY.minusWeeks(1));

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        assertThat(anchors.proseAnchors())
                .noneMatch(e -> e.category() == NotificationCategory.WEEKLY_REVIEW);
    }

    @Test
    void testResolve_shouldAnchorMemoirAfterItsGenerator_whenTheMemoirRowExistsForTheWeek() {
        UUID owner = ownerId();
        memoirPopulator.memoir(owner, MONDAY); // the ISO Monday of the week SUNDAY closes

        AnchorSet anchors = anchorResolver.resolve(owner, SUNDAY);

        AnchoredEvent memoir = proseEvent(anchors, NotificationCategory.MEMOIR);
        assertThat(memoir.minuteOfDay()).as("19:00 memoir cron + the 15-minute generation grace")
                .isEqualTo(MEMOIR_GRACED_MINUTE);
        assertThat(memoir.dedupSuffix()).isEqualTo("19:15");
    }

    @Test
    void testResolve_shouldAnchorMiddayAfterItsGenerator_whenTheMiddayCompanionMessageExists() {
        UUID owner = ownerId();
        companionMessagePopulator.createMessage(owner, WEDNESDAY, CompanionMessageEntity.KIND_MIDDAY,
                "Dél", List.of("Teszt napközbeni jegyzet."));

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        AnchoredEvent midday = proseEvent(anchors, NotificationCategory.MIDDAY);
        assertThat(midday.minuteOfDay()).as("12:30 midday cron + the 15-minute generation grace")
                .isEqualTo(MIDDAY_GRACED_MINUTE);
        assertThat(midday.dedupSuffix()).isEqualTo("12:45");
    }

    @Test
    void testResolve_shouldAnchorEveningAfterItsGenerator_whenTheEveningCompanionMessageExists() {
        UUID owner = ownerId();
        companionMessagePopulator.createMessage(owner, WEDNESDAY, CompanionMessageEntity.KIND_EVENING,
                "Napzárás", List.of("Ez volt a mai nap."));

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        AnchoredEvent evening = proseEvent(anchors, NotificationCategory.EVENING);
        assertThat(evening.minuteOfDay()).as("20:30 evening cron + the 15-minute generation grace")
                .isEqualTo(EVENING_GRACED_MINUTE);
        assertThat(evening.dedupSuffix()).isEqualTo("20:45");
    }

    @Test
    void testResolve_shouldAnchorSleepReactionOnItsOwnGenerationMinute_whenTheSleepCompanionMessageExists() {
        UUID owner = ownerId();
        companionMessagePopulator.createMessage(owner, WEDNESDAY, CompanionMessageEntity.KIND_SLEEP,
                "Alvás", List.of("7 óra 40 percet aludtál."), generatedAt(WEDNESDAY, 21, 7));

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        AnchoredEvent sleep = proseEvent(anchors, NotificationCategory.SLEEP_REACTION);
        assertThat(sleep.minuteOfDay()).as("the row's own generation minute, not a fixed constant")
                .isEqualTo(21 * 60 + 7);
        assertThat(sleep.dedupSuffix()).isEqualTo("21:07");
    }

    @Test
    void testResolve_shouldAnchorWeightReactionOnItsOwnGenerationMinute_whenTheWeightCompanionMessageExists() {
        UUID owner = ownerId();
        companionMessagePopulator.createMessage(owner, WEDNESDAY, CompanionMessageEntity.KIND_WEIGHT,
                "Testsúly", List.of("77.4 kg, stabil trend."), generatedAt(WEDNESDAY, 7, 15));

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        AnchoredEvent weight = proseEvent(anchors, NotificationCategory.WEIGHT_REACTION);
        assertThat(weight.minuteOfDay()).as("the row's own generation minute, not a fixed constant")
                .isEqualTo(7 * 60 + 15);
        assertThat(weight.dedupSuffix()).isEqualTo("07:15");
    }

    @Test
    void testResolve_shouldLeaveTheBriefingAnchorOnWake_whenItsGeneratorAlreadyRunsBeforeWake() {
        UUID owner = ownerId();
        companionMessagePopulator.createMessage(owner, WEDNESDAY, CompanionMessageEntity.KIND_MORNING,
                "Reggeli", List.of("Jó reggelt, Daniel!"));

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        // morning is the SAFE pattern the other prose anchors copy: generated 05:45, anchored at
        // the 06:00 ghost wake, so the same guard is a deliberate no-op here.
        assertThat(proseEvent(anchors, NotificationCategory.BRIEFING).minuteOfDay()).isEqualTo(6 * 60);
    }

    // ---- one malformed schedule row must never silence the whole user ----------------------------

    @Test
    void testResolve_shouldSkipOnlyTheBadRow_whenAScheduleRowCarriesAnUnparseableTime() {
        UUID owner = ownerId();
        // The contract only constrains `time` to 5 chars (minLength/maxLength) and there is no DB
        // CHECK, so "aa:bb" can genuinely reach the resolver. Unguarded it threw out of resolve()
        // BEFORE any anchor was returned -> that user received nothing at all, from any category.
        notificationPopulator.schedule(owner, null, "aa:bb", "checkin", "Bad", null, "/today", "test");
        notificationPopulator.schedule(owner, null, "14:00", "checkin", "Good", null, "/today?checkin=14:00", "test");
        trainPopulator.createGymSlot(owner, WEDNESDAY.getDayOfWeek().getValue() - 1, "17:30");

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        assertThat(anchors.scheduleAnchors()).as("only the healthy schedule row survives")
                .extracting(AnchoredEvent::dedupSuffix).containsExactly("14:00");
        assertThat(anchors.backendAnchors()).as("every OTHER category still resolves for this user")
                .anyMatch(e -> e.category() == NotificationCategory.GYM);
    }

    @Test
    void testResolve_shouldSkipTheRow_whenAScheduleRowNamesABackendNativeCategory() {
        UUID owner = ownerId();
        // Defense-in-depth: NotificationScheduleService.replace already rejects a non-feWritten
        // category, so today this row can only arrive some other way (e.g. a manual DB fix) — but
        // honouring it would give a client a second source of truth for a minute the backend owns.
        notificationPopulator.schedule(owner, null, "07:00", "briefing", "Nope", null, "/today", "test");

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        assertThat(anchors.scheduleAnchors()).isEmpty();
    }

    private static AnchoredEvent proseEvent(AnchorSet anchors, NotificationCategory category) {
        return anchors.proseAnchors().stream()
                .filter(e -> e.category() == category)
                .findFirst()
                .orElseThrow(() -> new AssertionError("no " + category + " prose anchor was resolved"));
    }
}

package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.notification.domain.AnchorSet;
import io.mrkuhne.mezo.feature.notification.domain.AnchorSet.AnchoredEvent;
import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import io.mrkuhne.mezo.feature.notification.service.AnchorResolver;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.BriefingPopulator;
import io.mrkuhne.mezo.support.populator.MedicationDosePopulator;
import io.mrkuhne.mezo.support.populator.MedicationPopulator;
import io.mrkuhne.mezo.support.populator.NotificationPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Anchor resolution across the 11 categories (bd mezo-h4wp.6.2), focused on the traps that would
 * silently misfire a notification: the gym/sport weekday's 0-based-vs-ISO conversion, prose
 * anchors existing only when their content row exists, medication's honest {@code retaDay == 0},
 * and the FE-written schedule's {@code weekday = null} "every day" semantics.
 */
class AnchorResolverIT extends AbstractIntegrationTest {

    /** A known Wednesday (matches the current-date convention used elsewhere in this suite). */
    private static final LocalDate WEDNESDAY = LocalDate.of(2026, 7, 29);

    @Autowired private AnchorResolver anchorResolver;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private BriefingPopulator briefingPopulator;
    @Autowired private MedicationPopulator medicationPopulator;
    @Autowired private MedicationDosePopulator medicationDosePopulator;
    @Autowired private NotificationPopulator notificationPopulator;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
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
    void testResolve_shouldYieldABriefingAnchor_whenABriefingRowExistsForTheDay() {
        UUID owner = ownerId();
        briefingPopulator.briefing(owner, WEDNESDAY);

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
    void testResolve_shouldYieldNoMedicationAnchor_whenRetaDayIsZeroBecauseNoDoseWasEverLogged() {
        UUID owner = ownerId();
        medicationPopulator.createReta(owner);
        // No dose logged — MedicationCycleService.derive(...) reports the honest retaDay == 0.

        AnchorSet anchors = anchorResolver.resolve(owner, WEDNESDAY);

        assertThat(anchors.backendAnchors())
                .noneMatch(e -> e.category() == NotificationCategory.MEDICATION);
    }

    @Test
    void testResolve_shouldYieldAMedicationAnchor_whenADoseWasLoggedSoRetaDayIsPositive() {
        UUID owner = ownerId();
        MedicationEntity med = medicationPopulator.createReta(owner);
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
}

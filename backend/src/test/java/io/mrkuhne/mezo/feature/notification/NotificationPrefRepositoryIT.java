package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.notification.entity.NotificationPrefEntity;
import io.mrkuhne.mezo.feature.notification.repository.NotificationPrefRepository;
import io.mrkuhne.mezo.feature.notification.repository.PushLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.NotificationPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class NotificationPrefRepositoryIT extends AbstractIntegrationTest {

    @Autowired private NotificationPrefRepository prefRepository;
    @Autowired private PushLogRepository pushLogRepository;
    @Autowired private NotificationPopulator notificationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private OwnerProperties ownerProperties;

    // find-or-create: no demodata profile in this context — findByEmail().orElseThrow() was order-dependent (mezo-ghug)
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testFindByCreatedByAndCategory_shouldLeaveOneRow_whenPrefIsUpserted() {
        UUID owner = ownerId();
        notificationPopulator.pref(owner, "workout_reminder", true, 30);

        NotificationPrefEntity existing =
            prefRepository.findByCreatedByAndCategory(owner, "workout_reminder").orElseThrow();
        existing.setEnabled(false);
        existing.setLeadMinutes(15);
        prefRepository.save(existing);

        assertThat(prefRepository.findByCreatedBy(owner)).hasSize(1);
        NotificationPrefEntity updated =
            prefRepository.findByCreatedByAndCategory(owner, "workout_reminder").orElseThrow();
        assertThat(updated.isEnabled()).isFalse();
        assertThat(updated.getLeadMinutes()).isEqualTo(15);
    }

    @Test
    void testFindByCreatedByAndCategory_shouldAllowReinsert_whenPriorPrefWasSoftDeleted() {
        UUID owner = ownerId();
        NotificationPrefEntity first = notificationPopulator.pref(owner, "meal_reminder", true, 0);
        prefRepository.delete(first); // @SQLDelete -> soft delete

        assertThat(prefRepository.findByCreatedByAndCategory(owner, "meal_reminder")).isEmpty();

        notificationPopulator.pref(owner, "meal_reminder", true, 45);

        assertThat(prefRepository.findByCreatedBy(owner)).hasSize(1);
        assertThat(prefRepository.findByCreatedByAndCategory(owner, "meal_reminder"))
            .isPresent()
            .get()
            .extracting(NotificationPrefEntity::getLeadMinutes)
            .isEqualTo(45);
    }

    @Test
    void testExistsByCreatedByAndLogDateAndDedupKey_shouldBeTrueForWrittenDay_andFalseForAnotherDay() {
        UUID owner = ownerId();
        LocalDate day = LocalDate.of(2026, 7, 29);
        notificationPopulator.pushLog(owner, day, "workout_reminder:2026-07-29", "workout_reminder");

        assertThat(pushLogRepository.existsByCreatedByAndLogDateAndDedupKey(
            owner, day, "workout_reminder:2026-07-29")).isTrue();
        assertThat(pushLogRepository.existsByCreatedByAndLogDateAndDedupKey(
            owner, day.plusDays(1), "workout_reminder:2026-07-29")).isFalse();
        assertThat(pushLogRepository.findByCreatedByAndLogDate(owner, day)).hasSize(1);
    }

    @Test
    void testExistsByCreatedByAndLogDateAndDedupKey_shouldAllowReinsert_whenPriorLogWasSoftDeleted() {
        UUID owner = ownerId();
        LocalDate day = LocalDate.of(2026, 7, 30);
        var first = notificationPopulator.pushLog(owner, day, "meal_reminder:2026-07-30", "meal_reminder");
        pushLogRepository.delete(first); // @SQLDelete -> soft delete

        assertThat(pushLogRepository.existsByCreatedByAndLogDateAndDedupKey(
            owner, day, "meal_reminder:2026-07-30")).isFalse();

        notificationPopulator.pushLog(owner, day, "meal_reminder:2026-07-30", "meal_reminder");

        assertThat(pushLogRepository.existsByCreatedByAndLogDateAndDedupKey(
            owner, day, "meal_reminder:2026-07-30")).isTrue();
        assertThat(pushLogRepository.findByCreatedByAndLogDate(owner, day)).hasSize(1);
    }
}

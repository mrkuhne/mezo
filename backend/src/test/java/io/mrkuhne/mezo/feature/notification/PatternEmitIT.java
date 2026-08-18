package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.PatternDetectionService;
import io.mrkuhne.mezo.feature.notification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Verifies the pattern-family feed emits (bd mezo-gzhp.1) end to end against Postgres. Reuses the
 * V3.1 detection fixture ({@code PatternDetectionServiceIT}'s checkin-stress↔sleep-quality
 * anti-correlated seed, driven through the same public {@link PatternDetectionService#detect}
 * entry the nightly job calls) — inventing a fresh seeding recipe would be less reliable than the
 * proven one.
 */
@ActiveProfiles("companion-fake")
class PatternEmitIT extends AbstractIntegrationTest {

    @Autowired private PatternDetectionService patternDetectionService;
    @Autowired private AppNotificationRepository appNotificationRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    /** Stress i ↔ quality inversely — a clean negative correlation over 10 finished days
     *  (copied verbatim from {@code PatternDetectionServiceIT}). */
    private void seedAntiCorrelatedDays(UUID owner, int days) {
        for (int i = 0; i < days; i++) {
            LocalDate day = LocalDate.now().minusDays(1L + i);
            int stress = (i % 5) + 1;
            int quality = 6 - stress;
            checkInPopulator.createCheckIn(owner, day, "08:00", 3, stress, null);
            sleepLogPopulator.createSleepLog(owner, day, new BigDecimal("7.0"), quality);
        }
    }

    @Test
    void testDetection_shouldEmitPatternInbox_whenNewStrongRowIsCreated() {
        UUID owner = userPopulator.createUser().getId();
        seedAntiCorrelatedDays(owner, 10);

        patternDetectionService.detect(owner);

        assertThat(appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner))
                .anySatisfy(n -> {
                    assertThat(n.getKind()).isEqualTo("pattern_inbox");
                    assertThat(n.getDeeplink()).startsWith("/insights/patterns/");
                });
    }

    @Test
    void testDetection_shouldEmitOnlyOneInboxRow_whenRunTwice() {
        UUID owner = userPopulator.createUser().getId();
        seedAntiCorrelatedDays(owner, 10);

        patternDetectionService.detect(owner);
        patternDetectionService.detect(owner);

        assertThat(appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner)
                .stream().filter(n -> n.getKind().equals("pattern_inbox")).count()).isEqualTo(1);
    }
}

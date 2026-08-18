package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.notification.domain.AnchorSet;
import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import io.mrkuhne.mezo.feature.notification.service.AnchorResolver;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AppNotificationPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The feed → push anchor mapping (bd mezo-gzhp.3, spec 2026-08-18 §4). */
class AnchorResolverFeedIT extends AbstractIntegrationTest {

    @Autowired private AnchorResolver anchorResolver;
    @Autowired private AppNotificationPopulator populator;
    @Autowired private UserPopulator userPopulator;

    /** A fresh, self-created owner per test — see AnchorResolverIT's ownerId() javadoc for why
     *  (order-dependency under a shared Testcontainers Postgres). */
    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    private static Instant onDay(LocalDate date, String hhmm) {
        return LocalDateTime.of(date, LocalTime.parse(hhmm)).atZone(ZoneId.systemDefault()).toInstant();
    }

    @Test
    void testResolve_shouldDeferOvernightEventToWake_whenOccurredBeforeWakeMinute() {
        LocalDate today = LocalDate.now();
        UUID owner = ownerId();
        populator.notification(owner, "pattern_inbox", "pattern_inbox:x", onDay(today, "02:40"));

        AnchorSet anchors = anchorResolver.resolve(owner, today);

        var feedEvent = anchors.backendAnchors().stream()
                .filter(a -> a.category() == NotificationCategory.PATTERN).findFirst().orElseThrow();
        // Default wake anchor is 06:00 (SleepGoalProperties default, no sleep_goal row for a
        // freshly created owner) — 02:40 defers to it.
        assertThat(feedEvent.minuteOfDay()).isEqualTo(6 * 60);
        assertThat(feedEvent.url()).contains("?n=");
        assertThat(feedEvent.dedupSuffix()).contains(":"); // HH:mm + ':' + id fragment
    }

    @Test
    void testResolve_shouldKeepDaytimeEventOnItsOwnMinute_whenOccurredAfterWake() {
        LocalDate today = LocalDate.now();
        UUID owner = ownerId();
        populator.notification(owner, "fact_candidate", "fact_candidate:c", onDay(today, "14:30"));

        AnchorSet anchors = anchorResolver.resolve(owner, today);

        var feedEvent = anchors.backendAnchors().stream()
                .filter(a -> a.category() == NotificationCategory.KNOWLEDGE).findFirst().orElseThrow();
        assertThat(feedEvent.minuteOfDay()).isEqualTo(14 * 60 + 30);
    }

    @Test
    void testResolve_shouldSkipMemoirReady_becauseTheMemoirCategoryAlreadyOwnsThatPush() {
        LocalDate today = LocalDate.now();
        UUID owner = ownerId();
        populator.notification(owner, "memoir_ready", "memoir_ready:w", onDay(today, "19:20"));

        AnchorSet anchors = anchorResolver.resolve(owner, today);

        assertThat(anchors.backendAnchors())
                .noneMatch(a -> a.dedupSuffix().contains("memoir_ready"));
        // (The prose `memoir` anchor may or may not exist — that path is untouched.)
    }
}

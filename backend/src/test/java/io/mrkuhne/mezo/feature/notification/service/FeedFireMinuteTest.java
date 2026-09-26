package io.mrkuhne.mezo.feature.notification.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

/**
 * {@link AnchorResolver#feedFireMinute} (bd mezo-co3r9): every feed event rides max(own minute,
 * wake); a workout-challenge event additionally honours the quiet window — "új kihívás" must never
 * ring the phone at night (owner, 2026-09-26).
 */
class FeedFireMinuteTest {

    private static final LocalTime QUIET_START = LocalTime.of(22, 0);
    private static final LocalTime QUIET_END = LocalTime.of(7, 0);
    private static final int WAKE_0600 = 6 * 60;
    private static final int WAKE_0730 = 7 * 60 + 30;

    private static java.util.OptionalInt fire(NotificationCategory c, LocalTime t, int wake) {
        return AnchorResolver.feedFireMinute(c, t, wake, QUIET_START, QUIET_END);
    }

    @Test
    void testFeedFireMinute_shouldDeferToQuietEnd_whenChallengeIsGeneratedAfterMidnightAndWakeIsEarlier() {
        assertThat(fire(NotificationCategory.CHALLENGE, LocalTime.of(0, 5), WAKE_0600)).hasValue(7 * 60);
    }

    @Test
    void testFeedFireMinute_shouldKeepTheWakeAnchor_whenWakeIsAfterQuietEnd() {
        assertThat(fire(NotificationCategory.CHALLENGE, LocalTime.of(0, 5), WAKE_0730)).hasValue(WAKE_0730);
    }

    @Test
    void testFeedFireMinute_shouldDropTheChallengePush_whenGeneratedInTheEveningQuietWindow() {
        assertThat(fire(NotificationCategory.CHALLENGE, LocalTime.of(22, 40), WAKE_0600)).isEmpty();
        assertThat(fire(NotificationCategory.CHALLENGE, LocalTime.of(23, 59), WAKE_0600)).isEmpty();
    }

    @Test
    void testFeedFireMinute_shouldFireOnItsOwnMinute_whenChallengeIsGeneratedInDaytime() {
        assertThat(fire(NotificationCategory.CHALLENGE, LocalTime.of(17, 12), WAKE_0600)).hasValue(17 * 60 + 12);
        assertThat(fire(NotificationCategory.CHALLENGE, LocalTime.of(21, 59), WAKE_0600)).hasValue(21 * 60 + 59);
    }

    @Test
    void testFeedFireMinute_shouldIgnoreQuietHoursForChallenge_whenTheWindowIsDisabled() {
        assertThat(AnchorResolver.feedFireMinute(NotificationCategory.CHALLENGE, LocalTime.of(23, 0), WAKE_0600,
                QUIET_START, QUIET_START)).hasValue(23 * 60);
    }

    @Test
    void testFeedFireMinute_shouldKeepTheWakeOnlyRule_whenCategoryIsNotChallenge() {
        assertThat(fire(NotificationCategory.PATTERN, LocalTime.of(2, 40), WAKE_0600)).hasValue(WAKE_0600);
        assertThat(fire(NotificationCategory.PATTERN, LocalTime.of(22, 40), WAKE_0600)).hasValue(22 * 60 + 40);
    }

    // ---- final review C1 (mezo-a9bo7.25): the intervention family (the team chat's pushes)
    // honours the quiet window exactly like a challenge; an exempt row only rides the wake. ----

    @Test
    void testFeedFireMinute_shouldDeferAnEarlyMorningTeamChatPushToMaxOfWakeAndQuietEnd() {
        assertThat(fire(NotificationCategory.INTERVENTION, LocalTime.of(3, 0), WAKE_0600)).hasValue(7 * 60);
        assertThat(fire(NotificationCategory.INTERVENTION, LocalTime.of(3, 0), WAKE_0730)).hasValue(WAKE_0730);
    }

    @Test
    void testFeedFireMinute_shouldDropAnEveningTeamChatPush() {
        assertThat(fire(NotificationCategory.INTERVENTION, LocalTime.of(22, 30), WAKE_0600)).isEmpty();
        assertThat(fire(NotificationCategory.INTERVENTION, LocalTime.of(21, 59), WAKE_0600)).hasValue(21 * 60 + 59);
    }

    @Test
    void testFeedFireMinute_shouldLetAQuietHoursExemptRowThrough_onTheWakeRuleOnly() {
        assertThat(AnchorResolver.feedFireMinute(NotificationCategory.INTERVENTION, LocalTime.of(22, 30), WAKE_0600,
                QUIET_START, QUIET_END, true)).hasValue(22 * 60 + 30);
        assertThat(AnchorResolver.feedFireMinute(NotificationCategory.INTERVENTION, LocalTime.of(3, 0), WAKE_0600,
                QUIET_START, QUIET_END, true)).hasValue(WAKE_0600);
    }
}

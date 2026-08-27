package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

class NotificationCategoryTest {

    @Test
    void testValues_shouldMatchTheSpecCatalog_whenListed() {
        assertThat(Arrays.stream(NotificationCategory.values()).map(NotificationCategory::key))
            .containsExactlyInAnyOrder("briefing", "gym", "medication", "ritual", "lights_out",
                "weekly", "weekly_review", "memoir", "wind_down", "midday", "checkin", "fuel_slot",
                "evening", "sleep_reaction", "weight_reaction", "pattern", "knowledge",
                "prediction", "experiment", "challenge", "memory", "decision_review",
                "intervention");
    }

    @Test
    void testDefaultEnabled_shouldBeNineteenSpecDefaults_whenFiltered() {
        assertThat(Arrays.stream(NotificationCategory.values())
                .filter(NotificationCategory::defaultEnabled).map(NotificationCategory::key))
            .containsExactlyInAnyOrder("briefing", "gym", "medication", "ritual", "lights_out",
                "weekly", "weekly_review", "memoir", "evening", "sleep_reaction", "weight_reaction",
                "pattern", "knowledge", "prediction", "experiment", "challenge", "memory",
                "decision_review", "intervention");
    }

    @Test
    void testDefaultLeadMinutes_shouldBeThirtyForGymAndZeroElsewhere_whenRead() {
        assertThat(NotificationCategory.GYM.defaultLeadMinutes()).isEqualTo(30);
        assertThat(Arrays.stream(NotificationCategory.values())
                .filter(c -> c != NotificationCategory.GYM)
                .allMatch(c -> c.defaultLeadMinutes() == 0)).isTrue();
    }

    @Test
    void testFeWritten_shouldBeCheckinAndFuelSlot_whenFiltered() {
        assertThat(Arrays.stream(NotificationCategory.values())
                .filter(NotificationCategory::feWritten).map(NotificationCategory::key))
            .containsExactlyInAnyOrder("checkin", "fuel_slot");
    }

    @Test
    void testFromKey_shouldBeEmpty_whenKeyIsUnknown() {
        assertThat(NotificationCategory.fromKey("nope")).isEmpty();
        assertThat(NotificationCategory.fromKey("gym")).contains(NotificationCategory.GYM);
    }

    @Test
    void testWeeklyReview_shouldStillResolveByKey_whenTheRetiredWeeklyEntryIsAlsoStillPresent() {
        // Both keys must keep resolving: `weekly` because persisted notification_pref rows still
        // reference it (mezo-p2tr retirement keeps the enum entry), `weekly_review` as its
        // backward-looking replacement.
        assertThat(NotificationCategory.fromKey("weekly")).contains(NotificationCategory.WEEKLY);
        assertThat(NotificationCategory.fromKey("weekly_review")).contains(NotificationCategory.WEEKLY_REVIEW);
        assertThat(NotificationCategory.WEEKLY_REVIEW.defaultEnabled()).isTrue();
        assertThat(NotificationCategory.WEEKLY_REVIEW.defaultLeadMinutes()).isZero();
        assertThat(NotificationCategory.WEEKLY_REVIEW.feWritten()).isFalse();
    }

    @Test
    void testFeedAnchoredCategories_shouldHaveCorrectDefaults_whenRead() {
        assertThat(NotificationCategory.PATTERN.defaultEnabled()).isTrue();
        assertThat(NotificationCategory.PATTERN.defaultLeadMinutes()).isZero();
        assertThat(NotificationCategory.PATTERN.feWritten()).isFalse();

        assertThat(NotificationCategory.KNOWLEDGE.defaultEnabled()).isTrue();
        assertThat(NotificationCategory.KNOWLEDGE.defaultLeadMinutes()).isZero();
        assertThat(NotificationCategory.KNOWLEDGE.feWritten()).isFalse();

        assertThat(NotificationCategory.PREDICTION.defaultEnabled()).isTrue();
        assertThat(NotificationCategory.PREDICTION.defaultLeadMinutes()).isZero();
        assertThat(NotificationCategory.PREDICTION.feWritten()).isFalse();

        assertThat(NotificationCategory.EXPERIMENT.defaultEnabled()).isTrue();
        assertThat(NotificationCategory.EXPERIMENT.defaultLeadMinutes()).isZero();
        assertThat(NotificationCategory.EXPERIMENT.feWritten()).isFalse();

        assertThat(NotificationCategory.CHALLENGE.defaultEnabled()).isTrue();
        assertThat(NotificationCategory.CHALLENGE.defaultLeadMinutes()).isZero();
        assertThat(NotificationCategory.CHALLENGE.feWritten()).isFalse();

        assertThat(NotificationCategory.MEMORY.defaultEnabled()).isTrue();
        assertThat(NotificationCategory.MEMORY.defaultLeadMinutes()).isZero();
        assertThat(NotificationCategory.MEMORY.feWritten()).isFalse();
    }
}

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
                "weekly", "memoir", "wind_down", "midday", "checkin", "fuel_slot",
                "evening", "sleep_reaction", "weight_reaction");
    }

    @Test
    void testDefaultEnabled_shouldBeTheTenSpecDefaults_whenFiltered() {
        assertThat(Arrays.stream(NotificationCategory.values())
                .filter(NotificationCategory::defaultEnabled).map(NotificationCategory::key))
            .containsExactlyInAnyOrder("briefing", "gym", "medication", "ritual", "lights_out",
                "weekly", "memoir", "evening", "sleep_reaction", "weight_reaction");
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
}

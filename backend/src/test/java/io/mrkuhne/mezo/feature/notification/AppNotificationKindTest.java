package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.notification.domain.AppNotificationKind;
import org.junit.jupiter.api.Test;

class AppNotificationKindTest {

    @Test
    void testCatalog_shouldPinTwelveKindsWithFamiliesAndDeeplinks_perSpec() {
        assertThat(AppNotificationKind.values()).hasSize(12);
        assertThat(AppNotificationKind.PATTERN_INBOX.key()).isEqualTo("pattern_inbox");
        assertThat(AppNotificationKind.PATTERN_INBOX.familyKey()).isEqualTo("pattern");
        assertThat(AppNotificationKind.PATTERN_SIGNAL.familyKey()).isEqualTo("pattern");
        assertThat(AppNotificationKind.HYPOTHESIS_NEW.familyKey()).isEqualTo("pattern");
        assertThat(AppNotificationKind.FACT_CANDIDATE.familyKey()).isEqualTo("knowledge");
        assertThat(AppNotificationKind.FACT_REINFORCED.familyKey()).isEqualTo("knowledge");
        // memoir_ready: the existing `memoir` push category already owns that push — no family.
        assertThat(AppNotificationKind.MEMOIR_READY.familyKey()).isNull();
        assertThat(AppNotificationKind.PREDICTION_NEW.familyKey()).isEqualTo("prediction");
        assertThat(AppNotificationKind.PREDICTION_OUTCOME.familyKey()).isEqualTo("prediction");
        assertThat(AppNotificationKind.EXPERIMENT_PROPOSED.familyKey()).isEqualTo("experiment");
        assertThat(AppNotificationKind.EXPERIMENT_CLOSED.familyKey()).isEqualTo("experiment");
        assertThat(AppNotificationKind.CHALLENGE_EVENT.familyKey()).isEqualTo("challenge");
        assertThat(AppNotificationKind.MEMORY_NOTE.familyKey()).isEqualTo("memory");
        assertThat(AppNotificationKind.FACT_CANDIDATE.deeplink()).isEqualTo("/insights/knowledge");
        assertThat(AppNotificationKind.CHALLENGE_EVENT.deeplink()).isEqualTo("/train");
        assertThat(AppNotificationKind.MEMORY_NOTE.deeplink()).isEqualTo("/insights/memoria");
        assertThat(AppNotificationKind.fromKey("pattern_inbox")).contains(AppNotificationKind.PATTERN_INBOX);
        assertThat(AppNotificationKind.fromKey("nope")).isEmpty();
    }
}

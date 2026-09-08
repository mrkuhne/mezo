package io.mrkuhne.mezo.feature.admin.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/** The shipped mezo.admin defaults must name columns that really exist (mezo-d5iy). */
@TestPropertySource(properties = {
        "mezo.admin.alerts.cost-spike-factor=3.0",
        "mezo.admin.artifact-feature-map.chat_message=companion_chat_override"
})
class AdminPropertiesTest extends AbstractIntegrationTest {

    @Autowired private AdminProperties properties;

    @Test
    void testFeatureMap_shouldUseRealColumnNames_whenDefaultsAreLoaded() {
        assertThat(properties.browser().maxPageSize()).isEqualTo(200);
        assertThat(properties.featureMap()).containsKeys("train", "food", "sleep", "journal", "habits", "water", "weight");
        assertThat(properties.featureMap().get("habits").timestampColumn()).isEqualTo("habit_date");
        assertThat(properties.featureMap().get("journal").timestampColumn()).isEqualTo("occurred_on");
        assertThat(properties.featureMap().get("water").timestampColumn()).isEqualTo("log_date");
        assertThat(properties.featureMap().get("weight").timestampColumn()).isEqualTo("date");
        assertThat(properties.featureMap().get("train").table()).isEqualTo("workout_session");
    }

    @Test
    void testAlerts_shouldBindOverrideAndDefaults_whenCostSpikeFactorIsOverridden() {
        assertThat(properties.alerts().costSpikeFactor()).isEqualTo(3.0);
        assertThat(properties.alerts().costSpikeMinUsd()).isEqualByComparingTo(BigDecimal.valueOf(0.50));
        assertThat(properties.alerts().llmErrorRatePct()).isEqualTo(20);
        assertThat(properties.alerts().llmErrorMinCalls()).isEqualTo(5);
        assertThat(properties.alerts().jobMissedAfterHours()).isEqualTo(26);
        assertThat(properties.alerts().testerQuietDays()).isEqualTo(7);
    }

    @Test
    void testArtifactFeatureMap_shouldBindOverrideAndDefaults_whenChatMessageIsOverridden() {
        assertThat(properties.artifactFeatureMap())
                .containsEntry("chat_message", "companion_chat_override")
                .containsEntry("feed_message", "proactive_feed")
                .containsEntry("weekly_suggestion", "proactive_weekly")
                .containsEntry("weekly_review", "proactive_weekly_review")
                .containsEntry("memoir", "proactive_memoir")
                .containsEntry("prediction", "proactive_prediction")
                .containsEntry("day_review", "day_review");
    }
}

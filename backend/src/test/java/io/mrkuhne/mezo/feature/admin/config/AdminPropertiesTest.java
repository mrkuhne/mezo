package io.mrkuhne.mezo.feature.admin.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The shipped mezo.admin defaults must name columns that really exist (mezo-d5iy). */
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
}

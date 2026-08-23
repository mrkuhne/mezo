package io.mrkuhne.mezo.feature.companion.profile;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.profile.config.ProfileProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** W4.3 (mezo-b3pp.17): the profile knobs are config, never code — this pins the shipped defaults. */
class ProfilePropertiesIT extends AbstractIntegrationTest {

    @Autowired
    private ProfileProperties properties;

    @Test
    void ships_weekly_monday_defaults() {
        assertThat(properties.cron()).isEqualTo("0 45 3 * * MON");
        assertThat(properties.renderMaxTokens()).isEqualTo(400);
        assertThat(properties.maxDecisions()).isEqualTo(10);
        assertThat(properties.maxGraphNodes()).isEqualTo(12);
    }
}

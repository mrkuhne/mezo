package io.mrkuhne.mezo.feature.companion.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

/**
 * S8 (mezo-d6ivw.12): a blank {@code MEZO_COMPANION_FACTTEXTBACKFILL_MODE} (e.g. someone blanks
 * the env var instead of removing it after the one-shot production deploy) must bind to
 * {@code off} and boot cleanly — not fail startup. See {@link FactTextBackfillProperties}'s
 * javadoc for why this is NOT {@code @Validated}/{@code @NotBlank}.
 */
class FactTextBackfillPropertiesTest {

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(FactTextBackfillProperties.class)
    static class TestConfig {
    }

    private final ApplicationContextRunner contextRunner =
            new ApplicationContextRunner().withUserConfiguration(TestConfig.class);

    @Test
    void testBinding_shouldDefaultToOff_whenModeIsUnset() {
        contextRunner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getBean(FactTextBackfillProperties.class).mode()).isEqualTo("off");
        });
    }

    @Test
    void testBinding_shouldFallBackToOff_whenModeIsBlank() {
        contextRunner.withPropertyValues("mezo.companion.fact-text-backfill.mode=").run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getBean(FactTextBackfillProperties.class).mode()).isEqualTo("off");
        });
    }

    @Test
    void testBinding_shouldKeepAnExplicitMode() {
        contextRunner.withPropertyValues("mezo.companion.fact-text-backfill.mode=dry-run").run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getBean(FactTextBackfillProperties.class).mode()).isEqualTo("dry-run");
        });
    }
}

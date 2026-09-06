package io.mrkuhne.mezo.techcore.scheduling;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.core.io.ClassPathResource;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;
import org.springframework.scheduling.config.ScheduledTaskHolder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guard for mezo-peh4: the test profile must run with NO scheduler.
 *
 * <p>A live {@code [scheduling-N]} thread holding a write transaction across an unrelated test
 * class's {@code ResetDatabase} TRUNCATE deadlocks Postgres, which surfaced as the random
 * {@code resetDatabaseState » PessimisticLock ... deadlock detected} CI flake. The cure is the
 * {@code mezo.techcore.scheduling.enabled=false} master switch in
 * {@code src/test/resources/application.properties}; this test fails the moment that switch is
 * flipped back on (or the {@code @ConditionalOnProperty} on {@code SchedulingConfiguration} is
 * removed), instead of letting the flake creep back in unnoticed.
 *
 * <p>{@code @EnableScheduling} is the ONLY thing that registers a
 * {@link ScheduledAnnotationBeanPostProcessor} (Spring Boot's task-scheduling auto-configuration
 * supplies a {@code TaskScheduler}, never the post-processor that arms {@code @Scheduled}
 * methods), so its absence is exactly the assertion "nothing can tick here".
 */
class SchedulingInertInTestProfileIT extends AbstractIntegrationTest {

    @Autowired
    private ApplicationContext applicationContext;

    @Test
    void noSchedulingInfrastructureIsRegistered() {
        assertThat(applicationContext.getBeanNamesForType(ScheduledAnnotationBeanPostProcessor.class))
            .as("@EnableScheduling must stay off in the test profile (mezo.techcore.scheduling.enabled=false, "
                + "mezo-peh4) — a real cron tick races ResetDatabase's TRUNCATE and deadlocks it")
            .isEmpty();
    }

    /**
     * The other half of the switch, and a gate this change had to bring with it. Because
     * {@code @ConditionalOnProperty} deliberately carries no {@code matchIfMissing}
     * (configuration_conventions.md), an ABSENT key means scheduling is OFF — so deleting or
     * misspelling this one line in the production {@code application.yml} would silently kill
     * every cron in production with no error, no log line and no failing test. That is exactly
     * the kind of silent green this whole change exists to remove, so it is asserted here rather
     * than trusted. (The k8s deployment mounts no config volume and sets no
     * {@code SPRING_CONFIG_LOCATION} — only env vars and a profile — so the baked YAML below is
     * genuinely what production reads.)
     */
    @Test
    void productionYmlStillDeclaresTheSwitchTrue() throws IOException {
        String yml = new String(new ClassPathResource("application.yml").getContentAsByteArray(),
            StandardCharsets.UTF_8);
        assertThat(yml)
            .as("backend/src/main/resources/application.yml must keep mezo.techcore.scheduling.enabled: true "
                + "— @ConditionalOnProperty has no matchIfMissing, so losing this line disables EVERY "
                + "production cron silently (mezo-peh4)")
            .containsPattern("(?s)techcore:.*?scheduling:\\s*\\n\\s*enabled:\\s*true");
    }

    @Test
    void noScheduledTaskIsArmed() {
        assertThat(applicationContext.getBeanProvider(ScheduledTaskHolder.class).stream()
            .flatMap(holder -> holder.getScheduledTasks().stream())
            .map(Object::toString)
            .toList())
            .as("no @Scheduled method may be armed in a test context (mezo-peh4)")
            .isEmpty();
    }
}

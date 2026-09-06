package io.mrkuhne.mezo.techcore.configuration;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Enables Spring's scheduling infrastructure (born with the V2.2 daily-summary job — the app's
 * first {@code @Scheduled}). Every job bean additionally gates itself with its own
 * {@code mezo.techcore.cron.*} switch; those decide whether the job BEAN exists, this one decides
 * whether a scheduler thread exists at all to fire the beans that do. Single instance by design —
 * no ShedLock until the app ever runs more than one replica (spec §2).
 *
 * <p>Gated (mezo-peh4 / mezo-v73w) because the test profile must have NO scheduler thread: a real
 * {@code [scheduling-N]} tick holding a write transaction across an unrelated test class's
 * {@code ResetDatabase} TRUNCATE deadlocks Postgres, and the per-job switches cannot close that
 * hole on their own (each IT that re-enables its job forks a cached context whose scheduler keeps
 * ticking against the same database for the rest of the surefire JVM). Production keeps it true —
 * declared explicitly in {@code application.yml}, no {@code matchIfMissing}
 * (docs/references/configuration_conventions.md).
 */
@Configuration
@ConditionalOnProperty(name = FeaturesConfiguration.SCHEDULING_SWITCH, havingValue = "true")
@EnableScheduling
public class SchedulingConfiguration {
}

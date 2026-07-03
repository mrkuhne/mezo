package io.mrkuhne.mezo.techcore.configuration;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Enables Spring's scheduling infrastructure (born with the V2.2 daily-summary job — the app's
 * first {@code @Scheduled}). The infrastructure is unconditional; every job bean gates itself
 * with its own {@code mezo.techcore.cron.*.enabled} switch. Single instance by design — no
 * ShedLock until the app ever runs more than one replica (spec §2).
 */
@Configuration
@EnableScheduling
public class SchedulingConfiguration {
}

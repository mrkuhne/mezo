package io.mrkuhne.mezo.feature.companion.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Typed binding of {@code mezo.feature.companion.enabled} (ADR 0008) for callers that branch
 * INSIDE a method rather than gate a whole bean — configuration_conventions.md's documented
 * exception to the {@code @ConditionalOnProperty}-at-the-bean-boundary rule.
 *
 * <p>{@code AdminAlertService} is the first consumer (mezo-kjwa): its two companion-dependent
 * alert rules (memory_stuck, job_missed) need to skip evaluation when the switch is off, not
 * disappear as a bean, since the other three rules in the same {@code alerts()} call must keep
 * running regardless. Every other companion-gated bean elsewhere in the codebase keeps using
 * {@code @ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH)} at the bean
 * boundary — this record is deliberately NOT a replacement for that idiom.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.feature.companion")
public record CompanionFeatureFlag(boolean enabled) {}

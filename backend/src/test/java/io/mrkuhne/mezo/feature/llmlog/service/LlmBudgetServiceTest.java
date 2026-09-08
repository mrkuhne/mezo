package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmBudgetLevel;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

/**
 * The cap's arithmetic (mezo-ozri.6). Pure unit: the repository is a stub, so what is under test is
 * only "spend + config → level" — which is exactly the part a misconfiguration gets silently wrong.
 *
 * <p>Several cases assert that the repository was NOT called. That is the point of them: an
 * unmeasurable call must be waved through WITHOUT paying for a database round trip on the pre-flight
 * path of every LLM call in the app.
 */
class LlmBudgetServiceTest {

    private static final UUID USER = UUID.randomUUID();

    private final LlmLogRepository repository = mock(LlmLogRepository.class);

    private static LlmLogProperties properties(boolean capEnabled) {
        return new LlmLogProperties(64000, ZoneId.of("Europe/Budapest"),
            new LlmLogProperties.Executor(1, 2, 500),
            new LlmLogProperties.Retention(90, "0 40 3 * * *"),
            new LlmLogProperties.Budget(capEnabled, new BigDecimal("5.00"), 30, 70, 90, 100,
                Set.of("proactive_memoir"), Set.of("admin_replay")));
    }

    @SuppressWarnings("unchecked")
    private LlmBudgetService service(boolean capEnabled, boolean auditOn) {
        ObjectProvider<EventPublishingLlmCallRecorder> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable())
            .thenReturn(auditOn ? mock(EventPublishingLlmCallRecorder.class) : null);
        return new LlmBudgetService(repository, properties(capEnabled), provider);
    }

    private void spent(String usd) {
        when(repository.sumCostSince(any(Instant.class), eq(USER), eq(CallStatus.ERROR)))
            .thenReturn(new BigDecimal(usd));
    }

    /** {@code LlmActorContext.runAs} is Runnable-shaped, so the answer comes back through a box. */
    private static LlmBudgetLevel levelAs(UUID actor, String feature, LlmBudgetService service) {
        AtomicReference<LlmBudgetLevel> seen = new AtomicReference<>();
        LlmActorContext.runAs(actor, () -> seen.set(service.levelFor(feature)));
        return seen.get();
    }

    @Test
    void testLevelFor_shouldReportOk_whenSpendIsBelowEveryThreshold() {
        spent("3.49");

        assertThat(levelAs(USER, "companion_chat", service(true, true))).isEqualTo(LlmBudgetLevel.OK);
    }

    /** Thresholds are INCLUSIVE: "70% spent" is already the degraded state, not the last OK one. */
    @Test
    void testLevelFor_shouldReportDegraded_whenSpendReachesSeventyPercent() {
        spent("3.50");

        assertThat(levelAs(USER, "companion_chat", service(true, true))).isEqualTo(LlmBudgetLevel.DEGRADED);
    }

    @Test
    void testLevelFor_shouldReportThrottled_whenSpendReachesNinetyPercent() {
        spent("4.50");

        assertThat(levelAs(USER, "companion_chat", service(true, true))).isEqualTo(LlmBudgetLevel.THROTTLED);
    }

    @Test
    void testLevelFor_shouldReportStopped_whenSpendReachesTheCap() {
        spent("5.00");

        assertThat(levelAs(USER, "companion_chat", service(true, true))).isEqualTo(LlmBudgetLevel.STOPPED);
    }

    /** An exempt feature is never capped, and must not even pay for the spend read. */
    @Test
    void testLevelFor_shouldReportOkWithoutReading_whenTheFeatureIsExempt() {
        LlmBudgetService service = service(true, true);

        assertThat(levelAs(USER, "admin_replay", service)).isEqualTo(LlmBudgetLevel.OK);
        verify(repository, never()).sumCostSince(any(), any(), any());
    }

    /**
     * No actor = a background call nobody can be billed for. Capping it would break background work
     * for a reason that could not be reported to any user, and there is nothing to measure it
     * against in the first place.
     */
    @Test
    void testLevelFor_shouldReportOkWithoutReading_whenThereIsNoActor() {
        LlmBudgetService service = service(true, true);

        assertThat(service.levelFor("companion_chat")).isEqualTo(LlmBudgetLevel.OK);
        verify(repository, never()).sumCostSince(any(), any(), any());
    }

    @Test
    void testLevelFor_shouldReportOkWithoutReading_whenTheCapIsDisabled() {
        spent("99.00");
        LlmBudgetService service = service(false, true);

        assertThat(levelAs(USER, "companion_chat", service)).isEqualTo(LlmBudgetLevel.OK);
        verify(repository, never()).sumCostSince(any(), any(), any());
    }

    /**
     * Spec §L1: turning the audit log off turns the cap off. Nothing is recorded, so the ceiling has
     * nothing to read; fail-closed was considered in the brainstorm and rejected, because a cap that
     * blocks everything the moment its measurement is switched off turns one config mistake into a
     * total outage.
     */
    @Test
    void testLevelFor_shouldReportOkWithoutReading_whenTheAuditLogIsOff() {
        spent("99.00");
        LlmBudgetService service = service(true, false);

        assertThat(levelAs(USER, "companion_chat", service)).isEqualTo(LlmBudgetLevel.OK);
        verify(repository, never()).sumCostSince(any(), any(), any());
    }

    @Test
    void testAllows_shouldRefuseOnlyTheThrottledFeatures_whenThrottled() {
        LlmBudgetService service = service(true, true);

        assertThat(service.allows("proactive_memoir", LlmBudgetLevel.THROTTLED)).isFalse();
        assertThat(service.allows("companion_chat", LlmBudgetLevel.THROTTLED)).isTrue();
        assertThat(service.allows("proactive_memoir", LlmBudgetLevel.DEGRADED)).isTrue();
    }

    @Test
    void testAllows_shouldRefuseEverything_whenStopped() {
        LlmBudgetService service = service(true, true);

        assertThat(service.allows("companion_chat", LlmBudgetLevel.STOPPED)).isFalse();
        assertThat(service.allows("proactive_memoir", LlmBudgetLevel.STOPPED)).isFalse();
    }

    @Test
    void testIsThrottled_shouldAnswerFromConfig_whenAsked() {
        LlmBudgetService service = service(true, true);

        assertThat(service.isThrottled("proactive_memoir")).isTrue();
        assertThat(service.isThrottled("companion_chat")).isFalse();
    }
}

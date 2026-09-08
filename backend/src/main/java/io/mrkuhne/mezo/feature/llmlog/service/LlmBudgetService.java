package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmBudgetGate;
import io.mrkuhne.mezo.feature.llmlog.context.LlmBudgetLevel;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The per-user rolling USD ceiling (mezo-ozri.6, spec §C1) — turns "what has this account spent in
 * the last {@code cycle-days} days" into the graded {@link LlmBudgetLevel} the call has to live
 * with. Reverses ADR 0035 §L1, which shipped cost VISIBILITY only.
 *
 * <p><b>Read once per tagged operation, not once per query.</b>
 * {@link io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder#runWith} asks and binds the
 * answer to the thread, so a chat turn that fans out into several LLM calls pays for one indexed
 * scalar read rather than one per call.
 *
 * <p><b>Why no in-memory counter.</b> The audit row is written asynchronously, so a burst can
 * overshoot the ceiling by whatever it issues before the writer catches up. That is accepted: the
 * writer's lag is milliseconds while an LLM call is seconds, and the $5 ceiling carries 1.6-2.3x of
 * headroom by construction (spec §4). A cache would trade that bounded overshoot for a staleness
 * window that behaves WORSE under exactly the burst it would exist to catch.
 *
 * <p><b>Never invents a number.</b> An unattributable call (no actor), a disabled cap and a disabled
 * audit log all answer {@link LlmBudgetLevel#OK} without touching the database.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LlmBudgetService implements LlmBudgetGate {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final LlmLogRepository llmLogRepository;
    private final LlmLogProperties llmLogProperties;
    /** The audit-switch probe: the recorder bean's presence IS the switch (no @Value, ArchUnit). */
    private final ObjectProvider<EventPublishingLlmCallRecorder> auditRecorder;

    /** The blind-cap warning is worth saying, and worth saying ONCE per boot rather than per call. */
    private final AtomicBoolean blindWarningLogged = new AtomicBoolean();

    @Override
    @Transactional(readOnly = true)
    public LlmBudgetLevel levelFor(String feature) {
        LlmLogProperties.Budget budget = llmLogProperties.budget();
        if (!budget.enabled() || budget.exemptFeatures().contains(feature)) {
            return LlmBudgetLevel.OK;
        }
        if (auditRecorder.getIfAvailable() == null) {
            warnBlindOnce();
            return LlmBudgetLevel.OK;
        }
        UUID actor = LlmActorContext.capture();
        if (actor == null) {
            return LlmBudgetLevel.OK;
        }

        Instant since = Instant.now().minus(Duration.ofDays(budget.cycleDays()));
        BigDecimal spent = llmLogRepository.sumCostSince(since, actor, CallStatus.ERROR);
        BigDecimal percent = spent.multiply(HUNDRED)
            .divide(budget.hardCapUsd(), 4, RoundingMode.HALF_UP);

        LlmBudgetLevel level = levelOf(percent, budget);
        if (level != LlmBudgetLevel.OK) {
            log.info("LLM budget {} for user {}: ${} of ${} over {}d ({}%)",
                level, actor, spent, budget.hardCapUsd(), budget.cycleDays(),
                percent.setScale(1, RoundingMode.HALF_UP));
        }
        return level;
    }

    @Override
    public boolean isThrottled(String feature) {
        return llmLogProperties.budget().throttledFeatures().contains(feature);
    }

    /**
     * May {@code feature} still go out at {@code level}? Kept beside the level so the two halves of
     * one policy cannot drift: DEGRADED is a ROUTING decision (every call still goes out, on the
     * cheap tier), THROTTLED additionally suspends the configured background generators, and STOPPED
     * refuses everything the cap can see.
     */
    public boolean allows(String feature, LlmBudgetLevel level) {
        if (level.atLeast(LlmBudgetLevel.STOPPED)) {
            return false;
        }
        return !(level.atLeast(LlmBudgetLevel.THROTTLED) && isThrottled(feature));
    }

    /** Thresholds are INCLUSIVE: "70% spent" is already the degraded state, not the last OK one. */
    private static LlmBudgetLevel levelOf(BigDecimal percent, LlmLogProperties.Budget budget) {
        if (percent.compareTo(BigDecimal.valueOf(budget.stopAtPercent())) >= 0) {
            return LlmBudgetLevel.STOPPED;
        }
        if (percent.compareTo(BigDecimal.valueOf(budget.throttleCronAtPercent())) >= 0) {
            return LlmBudgetLevel.THROTTLED;
        }
        if (percent.compareTo(BigDecimal.valueOf(budget.degradeAtPercent())) >= 0) {
            return LlmBudgetLevel.DEGRADED;
        }
        return LlmBudgetLevel.OK;
    }

    private void warnBlindOnce() {
        if (blindWarningLogged.compareAndSet(false, true)) {
            log.warn("mezo.llm-log.budget.enabled=true but the audit log is OFF "
                + "(mezo.feature.llm-log.enabled=false) — the per-user USD cap has nothing to read "
                + "and is INERT (spec §L1: turning the log off turns the cap off).");
        }
    }
}

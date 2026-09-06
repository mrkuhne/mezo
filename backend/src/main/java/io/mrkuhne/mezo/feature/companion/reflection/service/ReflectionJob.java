package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.companion.service.HypothesisPipelineService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Reflexió S2 (bd mezo-eq85.2, spec 2026-09-06 §4.4): the nightly reflection pass at 03:40. It
 * REPLACES the weekly {@code HypothesisJob} — a companion that only re-thinks its picture of the
 * user once a week cannot notice anything; the same four steps now run every night, in order:
 *
 * <ol>
 *   <li>catch-up — heal missing/stale text signals, so the series are complete before anything reads them;</li>
 *   <li>chat-day — extract yesterday's conversation as its own signal;</li>
 *   <li>evaluate — re-run every open hypothesis's test plan (pure code, no LLM);</li>
 *   <li>propose — the smart-tier hypothesis loop, capped by {@code reflection.propose.max-per-night}.</li>
 * </ol>
 *
 * <p>Gated on the master {@code REFLECTION_SWITCH} as well as its own cron switch: three of its
 * four collaborators only exist while Reflexió is on, so a job bean that survived the master
 * switch would fail the context on startup instead of standing down (TextSignalListenerSwitchOffIT).
 *
 * <p>Per-user isolation via {@link UserFanOut} (the V2.2/V3.1 idiom) AND per-step isolation inside
 * it: a failing LLM extraction must not cost the user tonight's evaluation, which needs no LLM at
 * all. The steps are ordered, not independent — evaluation reads what the catch-up just wrote.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH,
                FeaturesConfiguration.REFLECTION_JOB_SWITCH},
        havingValue = "true")
public class ReflectionJob {

    private final UserFanOut userFanOut;
    private final TextSignalCatchUpService catchUpService;
    private final ChatDaySignalService chatDaySignalService;
    private final HypothesisEvaluationService evaluationService;
    private final HypothesisPipelineService hypothesisPipelineService;

    @Scheduled(cron = "${mezo.companion.reflection.cron}")
    public void run() {
        runFor(LocalDate.now());
    }

    /** The direct-call seam {@code ReflectionJobIT} drives (the {@code DailySummaryJob} idiom).
     *  Every step isolated per user, on top of the fan-out's own per-user isolation. */
    public void runFor(LocalDate today) {
        userFanOut.forEachActiveUser("Reflection", user -> {
            UUID userId = user.getId();
            step("catch-up", userId, () -> catchUpService.catchUp(userId, today));
            step("chat-day", userId, () -> chatDaySignalService.extractDay(userId, today.minusDays(1)));
            step("evaluate", userId, () -> evaluationService.evaluate(userId, today));
            step("propose", userId, () -> hypothesisPipelineService.run(userId, null));
        });
    }

    private void step(String name, UUID userId, Supplier<?> body) {
        try {
            Object out = body.get();
            log.info("Reflection {} for user {}: {}", name, userId, out);
        } catch (Exception e) {
            log.warn("Reflection {} failed for user {}", name, userId, e);
        }
    }
}

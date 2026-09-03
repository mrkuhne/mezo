package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * W2 Sunday-evening memoir generation: the memoir for the week ENDING this Sunday per user
 * (the ISO-Monday of the current week). Idempotent; per-user failures isolated; the lazy GET
 * covers misses (last completed week).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.MEMOIR_JOB_SWITCH},
        havingValue = "true")
public class MemoirJob {

    private final UserFanOut userFanOut;
    private final MemoirGenerator generator;

    @Scheduled(cron = "${mezo.proactive.memoir.cron}")
    public void run() {
        LocalDate weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        AtomicInteger generated = new AtomicInteger();
        userFanOut.forEachActiveUser("Memoir", user -> {
            try {
                if (generator.generate(user.getId(), weekStart) != null) {
                    generated.incrementAndGet();
                }
            } catch (Exception e) {
                log.warn("Memoir generation failed for user {} week {}", user.getId(), weekStart, e);
            }
        });
        log.info("Memoir run for {}: {} memoir(s) present", weekStart, generated.get());
    }
}

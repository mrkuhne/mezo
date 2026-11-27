package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.repository.CalendarEventScoreRepository;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The move log's nightly pass (Boop B7 K4, mezo-r36n9.17, spec §5.8): at 03:30 in the owner zone every owner with a
 * proposal or a scored event lately gets yesterday's outcomes filled and his patterns recomputed
 * ({@link CapacityLearningService}). Each step runs in its own transaction; one owner's failure never stops the others.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "mezo.techcore.cron.capacity-outcome-job.enabled", havingValue = "true")
public class OutcomeJob {

    static final int SCORED_OWNER_DAYS = 30;

    private final CapacityLearningService learning;
    private final CalendarEventScoreRepository scores;

    @Scheduled(cron = "0 30 3 * * *", zone = "${mezo.wearable.zone:Europe/Budapest}")
    public void run() {
        LocalDate today = learning.today();
        List<UUID> scored = scores.ownersSince(learning.now().minus(SCORED_OWNER_DAYS, ChronoUnit.DAYS));
        for (UUID owner : learning.owners(scored, today)) {
            runFor(owner, today);
        }
    }

    /** One owner: outcomes first (the patterns read the accepted moves' outcomes), then the patterns. */
    void runFor(UUID owner, LocalDate today) {
        try {
            int written = learning.fillOutcomes(owner, today);
            long shown = learning.refreshPatterns(owner, today).stream().filter(CapacityPatterns.Found::shown).count();
            log.info("Capacity learning pass: owner {} — {} outcomes written, {} patterns shown", owner, written, shown);
        } catch (RuntimeException e) {
            log.warn("Capacity learning pass failed for owner {}", owner, e);
        }
    }
}

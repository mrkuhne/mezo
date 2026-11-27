package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.repository.CalendarEventScoreRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The Sunday preview (Boop B7 K4, mezo-r36n9.17, spec §5.9): on {@code mezo.capacity.sunday.cron} (18:00 Sunday) in the
 * owner zone every owner the learning pass visits gets next week's proposals generated — the same
 * {@link ProposalService#week} read the Átrendezés page does, so the wall card is ready on Sunday evening and Monday
 * morning without waiting for him to open the page. A week that already has proposals is left as it is.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "mezo.techcore.cron.capacity-sunday-job.enabled", havingValue = "true")
public class SundayPreviewJob {

    private final ProposalService proposals;
    private final CapacityLearningService learning;
    private final CalendarEventScoreRepository scores;

    @Scheduled(cron = "${mezo.capacity.sunday.cron:0 0 18 * * SUN}", zone = "${mezo.wearable.zone:Europe/Budapest}")
    public void run() {
        Instant now = learning.now();
        LocalDate today = LocalDate.ofInstant(now, learning.zoneId());
        List<UUID> scored = scores.ownersSince(now.minus(OutcomeJob.SCORED_OWNER_DAYS, ChronoUnit.DAYS));
        LocalDate monday = targetMonday(now, learning.zoneId());
        for (UUID owner : learning.owners(scored, today)) {
            try {
                int n = proposals.week(owner, monday).proposals().size();
                log.info("Capacity Sunday preview: owner {} — week {} has {} proposals", owner, monday, n);
            } catch (RuntimeException e) {
                log.warn("Capacity Sunday preview failed for owner {}", owner, e);
            }
        }
    }

    /**
     * The Monday after {@code now}'s day judged in his zone, never in UTC: a UTC Sunday 23:30 that is already Monday 00:30
     * in Budapest targets the Monday after that one.
     */
    static LocalDate targetMonday(Instant now, ZoneId zone) {
        return LocalDate.ofInstant(now, zone).with(TemporalAdjusters.next(DayOfWeek.MONDAY));
    }
}

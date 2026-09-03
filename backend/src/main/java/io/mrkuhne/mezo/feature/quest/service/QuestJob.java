package io.mrkuhne.mezo.feature.quest.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.quest.config.QuestProperties;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Daily-quest cron backstops (E1, bd mezo-df7q): the lazy GET path covers active users; these
 * cover the rest. Morning: generate today's offer for every user without rows (so quests exist
 * before the first app-open). Night: evaluate + quietly expire yesterday's offered rows (XP for
 * quests satisfied after the user's last read — e.g. late meal log — is still granted). Per-user
 * failures are isolated; both paths are idempotent.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.QUEST_SWITCH, FeaturesConfiguration.QUEST_JOB_SWITCH},
        havingValue = "true")
public class QuestJob {

    private final UserFanOut userFanOut;
    private final DailyQuestRepository repository;
    private final QuestSelector selector;
    private final QuestService questService;
    private final QuestProperties properties;
    private final org.springframework.beans.factory.ObjectProvider<QuestFlavor> questFlavor;

    @Scheduled(cron = "${mezo.quest.generate-cron}")
    public void runGenerate() {
        LocalDate today = LocalDate.now();
        AtomicInteger generatedCount = new AtomicInteger();
        userFanOut.forEachActiveUser("Quest generate", user -> {
            try {
                // S6 fix round 1 (mezo-qw37.6, HUMAN RULING): presence is read off
                // app_user.last_seen_at, NEVER off quest rows the cron itself just created —
                // a quest-existence check latches (this job's own writes would keep "proving"
                // presence forever, defeating spec L1's whole point of stopping the daily
                // flavor-LLM spend for someone who never opens the app again). last_seen_at is
                // stamped only by CurrentUser on an authenticated request, so the cron cannot
                // feed itself.
                Instant cutoff = Instant.now().minus(properties.cronPresenceDays(), ChronoUnit.DAYS);
                if (user.getLastSeenAt() == null || user.getLastSeenAt().isBefore(cutoff)) {
                    return; // spec L1: never seen, or not seen inside the window ⇒ no generation, no flavor LLM call
                }
                if (repository.findByCreatedByAndQuestDateOrderBySlotAsc(user.getId(), today).isEmpty()) {
                    List<DailyQuestEntity> fresh = selector.generate(user.getId(), today);
                    generatedCount.addAndGet(fresh.size());
                    QuestFlavor flavor = questFlavor.getIfAvailable();
                    if (flavor != null) {
                        flavor.rewrite(fresh); // companion voice; failures keep catalog copy
                    }
                }
            } catch (Exception e) {
                log.warn("Quest generation failed for user {} on {}", user.getId(), today, e);
            }
        });
        log.info("Quest generate run for {}: {} quest(s) created", today, generatedCount.get());
    }

    @Scheduled(cron = "${mezo.quest.finalize-cron}")
    public void runFinalize() {
        LocalDate today = LocalDate.now();
        AtomicInteger finalizedCount = new AtomicInteger();
        userFanOut.forEachActiveUser("Quest finalize", user -> {
            try {
                List<DailyQuestEntity> stale = repository.findByCreatedByAndStatusAndQuestDateBefore(
                        user.getId(), DailyQuestEntity.STATUS_OFFERED, today);
                questService.evaluateAndFinalize(stale, today);
                finalizedCount.addAndGet(stale.size());
            } catch (Exception e) {
                log.warn("Quest finalize failed for user {} on {}", user.getId(), today, e);
            }
        });
        log.info("Quest finalize run for {}: {} quest(s) closed", today, finalizedCount.get());
    }
}

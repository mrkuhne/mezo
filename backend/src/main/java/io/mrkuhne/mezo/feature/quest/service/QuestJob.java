package io.mrkuhne.mezo.feature.quest.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.quest.config.QuestProperties;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
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
            if (!repository.existsByCreatedByAndQuestDateGreaterThanEqual(
                    user.getId(), today.minusDays(properties.cronPresenceDays()))) {
                return; // spec L1: no quests in the presence window ⇒ no generation, no flavor LLM call
            }
            if (repository.findByCreatedByAndQuestDateOrderBySlotAsc(user.getId(), today).isEmpty()) {
                List<DailyQuestEntity> fresh = selector.generate(user.getId(), today);
                generatedCount.addAndGet(fresh.size());
                QuestFlavor flavor = questFlavor.getIfAvailable();
                if (flavor != null) {
                    flavor.rewrite(fresh); // companion voice; failures keep catalog copy
                }
            }
        });
        log.info("Quest generate run for {}: {} quest(s) created", today, generatedCount.get());
    }

    @Scheduled(cron = "${mezo.quest.finalize-cron}")
    public void runFinalize() {
        LocalDate today = LocalDate.now();
        AtomicInteger finalizedCount = new AtomicInteger();
        userFanOut.forEachActiveUser("Quest finalize", user -> {
            List<DailyQuestEntity> stale = repository.findByCreatedByAndStatusAndQuestDateBefore(
                    user.getId(), DailyQuestEntity.STATUS_OFFERED, today);
            questService.evaluateAndFinalize(stale, today);
            finalizedCount.addAndGet(stale.size());
        });
        log.info("Quest finalize run for {}: {} quest(s) closed", today, finalizedCount.get());
    }
}

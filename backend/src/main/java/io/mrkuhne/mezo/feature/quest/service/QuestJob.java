package io.mrkuhne.mezo.feature.quest.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
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

    private final AppUserRepository appUserRepository;
    private final DailyQuestRepository repository;
    private final QuestSelector selector;
    private final QuestService questService;
    private final org.springframework.beans.factory.ObjectProvider<QuestFlavor> questFlavor;

    @Scheduled(cron = "${mezo.quest.generate-cron}")
    public void runGenerate() {
        LocalDate today = LocalDate.now();
        int generated = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                if (repository.findByCreatedByAndQuestDateOrderBySlotAsc(user.getId(), today).isEmpty()) {
                    List<DailyQuestEntity> fresh = selector.generate(user.getId(), today);
                    generated += fresh.size();
                    QuestFlavor flavor = questFlavor.getIfAvailable();
                    if (flavor != null) {
                        flavor.rewrite(fresh); // companion voice; failures keep catalog copy
                    }
                }
            } catch (Exception e) {
                log.warn("Quest generation failed for user {} on {}", user.getId(), today, e);
            }
        }
        log.info("Quest generate run for {}: {} quest(s) created", today, generated);
    }

    @Scheduled(cron = "${mezo.quest.finalize-cron}")
    public void runFinalize() {
        LocalDate today = LocalDate.now();
        int finalized = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                List<DailyQuestEntity> stale = repository.findByCreatedByAndStatusAndQuestDateBefore(
                    user.getId(), DailyQuestEntity.STATUS_OFFERED, today);
                questService.evaluateAndFinalize(stale, today);
                finalized += stale.size();
            } catch (Exception e) {
                log.warn("Quest finalize failed for user {} on {}", user.getId(), today, e);
            }
        }
        log.info("Quest finalize run for {}: {} quest(s) closed", today, finalized);
    }
}

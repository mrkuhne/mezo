package io.mrkuhne.mezo.feature.quest.service;

import io.mrkuhne.mezo.feature.companion.TodayQuestSource;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Quest side of the companion context snapshot's today-quest count — see {@link TodayQuestSource}.
 * Deliberately a plain repository read, NOT {@link QuestService#getDay} (which lazily generates
 * today's rows and awards XP on evaluation — write-transactional; the snapshot renders on every
 * chat turn, so a read firing writes every turn would be wrong).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.QUEST_SWITCH, havingValue = "true")
public class TodayQuestAdapter implements TodayQuestSource {

    private final DailyQuestRepository repository;

    @Override
    public Stats todayStats(UUID createdBy, LocalDate date) {
        List<DailyQuestEntity> rows = repository.findByCreatedByAndQuestDateOrderBySlotAsc(createdBy, date)
                .stream().filter(q -> !DailyQuestEntity.STATUS_REROLLED.equals(q.getStatus())).toList();
        long completed = rows.stream().filter(q -> DailyQuestEntity.STATUS_COMPLETED.equals(q.getStatus())).count();
        return new Stats((int) completed, rows.size());
    }
}

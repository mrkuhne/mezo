package io.mrkuhne.mezo.feature.quest.service;

import io.mrkuhne.mezo.feature.progression.QuestLedgerSource;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Quest side of the discipline trait — see {@link QuestLedgerSource}. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.QUEST_SWITCH, havingValue = "true")
public class QuestLedgerAdapter implements QuestLedgerSource {

    private final DailyQuestRepository repository;

    @Override
    public Stats closedQuestStats(UUID createdBy, LocalDate from, LocalDate to) {
        return new Stats(
            repository.countByCreatedByAndStatusAndQuestDateBetween(
                createdBy, DailyQuestEntity.STATUS_COMPLETED, from, to),
            repository.countByCreatedByAndStatusAndQuestDateBetween(
                createdBy, DailyQuestEntity.STATUS_EXPIRED, from, to));
    }
}

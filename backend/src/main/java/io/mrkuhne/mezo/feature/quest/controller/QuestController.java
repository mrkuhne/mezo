package io.mrkuhne.mezo.feature.quest.controller;

import io.mrkuhne.mezo.api.controller.QuestApi;
import io.mrkuhne.mezo.api.dto.QuestDayResponse;
import io.mrkuhne.mezo.api.dto.QuestResponse;
import io.mrkuhne.mezo.feature.quest.service.QuestService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.QUEST_SWITCH, havingValue = "true")
public class QuestController implements QuestApi {

    private final QuestService questService;
    private final CurrentUserId currentUserId;

    @Override
    public QuestDayResponse getQuestDay(LocalDate date) {
        return questService.getDay(currentUserId.get(), date);
    }

    @Override
    public QuestResponse rerollQuest(UUID id) {
        return questService.reroll(currentUserId.get(), id);
    }
}

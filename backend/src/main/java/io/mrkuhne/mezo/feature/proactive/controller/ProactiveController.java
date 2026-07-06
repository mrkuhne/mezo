package io.mrkuhne.mezo.feature.proactive.controller;

import io.mrkuhne.mezo.api.controller.ProactiveApi;
import io.mrkuhne.mezo.api.dto.BriefingResponse;
import io.mrkuhne.mezo.api.dto.MemoirResponse;
import io.mrkuhne.mezo.api.dto.WeeklySuggestionResponse;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveBriefingService;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveMemoirService;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveWeeklySuggestionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ProactiveController implements ProactiveApi {

    private final ProactiveBriefingService briefingService;
    private final ProactiveWeeklySuggestionService weeklySuggestionService;
    private final ProactiveMemoirService memoirService;
    private final CurrentUserId currentUserId;

    @Override
    public BriefingResponse getBriefing(LocalDate date) {
        return briefingService.getBriefing(currentUserId.get(), date);
    }

    @Override
    public WeeklySuggestionResponse getWeeklySuggestion(LocalDate date) {
        return weeklySuggestionService.getWeeklySuggestion(currentUserId.get(), date);
    }

    @Override
    public MemoirResponse getMemoir() {
        return memoirService.getMemoir(currentUserId.get());
    }
}

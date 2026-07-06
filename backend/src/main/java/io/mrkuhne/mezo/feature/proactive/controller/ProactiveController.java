package io.mrkuhne.mezo.feature.proactive.controller;

import io.mrkuhne.mezo.api.controller.ProactiveApi;
import io.mrkuhne.mezo.api.dto.BriefingResponse;
import io.mrkuhne.mezo.api.dto.WeeklySuggestionResponse;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveBriefingService;
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
    private final CurrentUserId currentUserId;

    @Override
    public BriefingResponse getBriefing(LocalDate date) {
        return briefingService.getBriefing(currentUserId.get(), date);
    }

    // TODO(mezo-h4wp.3, Task 2): replace this stub with the real weekly-suggestion read.
    // Task 1 only ships the contract + table + plumbing; the stub keeps the build green.
    @Override
    public WeeklySuggestionResponse getWeeklySuggestion(LocalDate date) {
        throw new UnsupportedOperationException("Weekly suggestion read arrives in proactive W1 Task 2");
    }
}

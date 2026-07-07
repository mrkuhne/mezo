package io.mrkuhne.mezo.feature.proactive.controller;

import io.mrkuhne.mezo.api.controller.ProactiveApi;
import io.mrkuhne.mezo.api.dto.BriefingResponse;
import io.mrkuhne.mezo.api.dto.ExperimentDecisionRequest;
import io.mrkuhne.mezo.api.dto.ExperimentResponse;
import io.mrkuhne.mezo.api.dto.HeartbeatNoteResponse;
import io.mrkuhne.mezo.api.dto.MemoirResponse;
import io.mrkuhne.mezo.api.dto.PredictionResponse;
import io.mrkuhne.mezo.api.dto.WeeklySuggestionResponse;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveBriefingService;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveExperimentService;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveHeartbeatService;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveMemoirService;
import io.mrkuhne.mezo.feature.proactive.service.ProactivePredictionService;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveWeeklySuggestionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
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
    private final ProactiveHeartbeatService heartbeatService;
    private final ProactivePredictionService predictionService;
    private final ProactiveExperimentService experimentService;
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

    @Override
    public HeartbeatNoteResponse getHeartbeat(LocalDate date) {
        return heartbeatService.getHeartbeat(currentUserId.get(), date);
    }

    @Override
    public List<PredictionResponse> getPredictions() {
        return predictionService.getPredictions(currentUserId.get());
    }

    @Override
    public List<ExperimentResponse> getExperiments() {
        return experimentService.getExperiments(currentUserId.get());
    }

    @Override
    public List<ExperimentResponse> proposeExperiments() {
        return experimentService.propose(currentUserId.get());
    }

    @Override
    public ExperimentResponse decideExperiment(UUID id, ExperimentDecisionRequest request) {
        return experimentService.decide(currentUserId.get(), id, request);
    }
}

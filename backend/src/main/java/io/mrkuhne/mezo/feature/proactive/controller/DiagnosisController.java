package io.mrkuhne.mezo.feature.proactive.controller;

import io.mrkuhne.mezo.api.controller.DiagnosisApi;
import io.mrkuhne.mezo.api.dto.DiagnosisGenerateRequest;
import io.mrkuhne.mezo.api.dto.DiagnosisResponse;
import io.mrkuhne.mezo.api.dto.ExperimentResponse;
import io.mrkuhne.mezo.feature.proactive.service.DiagnosisService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
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
public class DiagnosisController implements DiagnosisApi {

    private final DiagnosisService diagnosisService;
    private final CurrentUserId currentUserId;

    @Override
    public List<DiagnosisResponse> listDiagnoses(String phenomenon) {
        return diagnosisService.list(currentUserId.get(), phenomenon);
    }

    @Override
    public DiagnosisResponse getDiagnosis(UUID id) {
        return diagnosisService.get(currentUserId.get(), id);
    }

    @Override
    public DiagnosisResponse generateDiagnosis(DiagnosisGenerateRequest request) {
        return diagnosisService.generate(currentUserId.get(), request.getPhenomenon());
    }

    @Override
    public ExperimentResponse startDiagnosisExperiment(UUID id, Integer rank) {
        return diagnosisService.startExperiment(currentUserId.get(), id, rank);
    }
}

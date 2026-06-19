package io.mrkuhne.mezo.feature.biometrics.weight.controller;

import io.mrkuhne.mezo.api.controller.WeightApi;
import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.api.dto.WeightLogResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightLogService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated contract interface — mappings/validation come from {@link WeightApi}. */
@RestController
@RequiredArgsConstructor
public class WeightLogController implements WeightApi {

    private final WeightLogService service;
    private final CurrentUserId currentUserId;

    @Override
    public List<WeightLogResponse> listWeightLogs() {
        return service.list(currentUserId.get());
    }

    @Override
    public WeightLogResponse logWeight(LogWeightRequest logWeightRequest) {
        return service.log(currentUserId.get(), logWeightRequest);
    }

    @Override
    public WeightTrendResponse getWeightTrend() {
        // TODO Task 10 (mezo-g1u): replace with real EWMA weight-trend-service delegation
        throw new UnsupportedOperationException("G5 Task 10: mezo-g1u");
    }
}

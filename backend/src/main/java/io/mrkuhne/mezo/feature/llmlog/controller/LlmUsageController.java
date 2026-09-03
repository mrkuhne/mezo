package io.mrkuhne.mezo.feature.llmlog.controller;

import io.mrkuhne.mezo.api.controller.LlmUsageApi;
import io.mrkuhne.mezo.api.dto.LlmCallDetailResponse;
import io.mrkuhne.mezo.api.dto.LlmCallListResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageBreakdownResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageSummaryResponse;
import io.mrkuhne.mezo.feature.llmlog.service.LlmUsageService;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/**
 * /api/llm-usage surface (mezo-h3gb) — mappings come from the generated {@link LlmUsageApi}.
 *
 * <p>Deliberately NOT behind {@code mezo.feature.llm-log.enabled}: the switch governs whether calls
 * are RECORDED, while reading the history stays available either way — with logging off the table
 * simply stops growing and the summary reports honest zeros/nulls instead of a 404.
 *
 * <p>No {@code CurrentUserId} either: the rollup covers every row (see {@link LlmUsageService}).
 */
@RestController
@RequiredArgsConstructor
public class LlmUsageController implements LlmUsageApi {

    private final LlmUsageService service;

    @Override
    public LlmUsageSummaryResponse getLlmUsageSummary() {
        return service.summary();
    }

    @Override
    public LlmUsageBreakdownResponse getLlmUsageBreakdown(String period) {
        return service.breakdown(period);
    }

    @Override
    public LlmCallListResponse listLlmCalls(String period, String feature, String status,
                                            String callKind, UUID userId, Integer limit) {
        // userId filtering lands with the S3 admin drill-down (mezo-qw37.3, Task 4); the
        // parameter is accepted here now purely so this controller keeps compiling against
        // the contract Task 1 already generated.
        return service.listCalls(period, feature, status, callKind, limit);
    }

    @Override
    public LlmCallDetailResponse getLlmCall(UUID id) {
        return service.call(id);
    }
}

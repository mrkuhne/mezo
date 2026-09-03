package io.mrkuhne.mezo.feature.llmlog.controller;

import io.mrkuhne.mezo.api.controller.LlmUsageApi;
import io.mrkuhne.mezo.api.dto.LlmCallDetailResponse;
import io.mrkuhne.mezo.api.dto.LlmCallListResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageBreakdownResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageSummaryResponse;
import io.mrkuhne.mezo.feature.auth.service.CurrentUser;
import io.mrkuhne.mezo.feature.llmlog.service.LlmUsageService;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/**
 * /api/llm-usage surface (mezo-h3gb) — mappings come from the generated {@link LlmUsageApi}.
 *
 * <p>Deliberately NOT behind {@code mezo.feature.llm-log.enabled}: the switch governs whether calls
 * are RECORDED, while reading the history stays available either way.
 *
 * <p>OWNER-only since mezo-qw37.3: the log holds every account's prompts and responses, so the
 * rollup and the payloads are an admin view, gated per method by {@link CurrentUser#requireOwner()}.
 */
@RestController
@RequiredArgsConstructor
public class LlmUsageController implements LlmUsageApi {

    private final LlmUsageService service;
    private final CurrentUser currentUser;

    @Override
    public LlmUsageSummaryResponse getLlmUsageSummary() {
        currentUser.requireOwner();
        return service.summary();
    }

    @Override
    public LlmUsageBreakdownResponse getLlmUsageBreakdown(String period) {
        currentUser.requireOwner();
        return service.breakdown(period);
    }

    @Override
    public LlmCallListResponse listLlmCalls(String period, String feature, String status,
                                            String callKind, UUID userId, Integer limit) {
        currentUser.requireOwner();
        return service.listCalls(period, feature, status, callKind, userId, limit);
    }

    @Override
    public LlmCallDetailResponse getLlmCall(UUID id) {
        currentUser.requireOwner();
        return service.call(id);
    }
}

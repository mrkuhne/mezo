package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminFeatureBoardResponse;
import io.mrkuhne.mezo.api.dto.AdminFeatureDetailResponse;
import io.mrkuhne.mezo.api.dto.AdminFeatureFunnel;
import io.mrkuhne.mezo.api.dto.AdminFeatureReliability;
import io.mrkuhne.mezo.api.dto.AdminFeedbackSummaryResponse;
import io.mrkuhne.mezo.feature.admin.config.AdminProperties;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Funkciók scorecard, detail and feedback-summary aggregation (mezo-l096.1..4). This is the
 * Task 1 skeleton only: every method compiles and answers an empty/null-filled response —
 * the real aggregation (usage, feedback, cost, reliability queries) lands in Tasks 2-4.
 */
@Service
@RequiredArgsConstructor
public class AdminFeatureService {

    private final AdminProperties properties;

    /** {@code GET /api/admin/features} — feature scorecard (mezo-l096.3). Skeleton: empty row
     *  set regardless of {@code period}. */
    public AdminFeatureBoardResponse board(String period) {
        return new AdminFeatureBoardResponse()
                .period(period)
                .rows(List.of());
    }

    /** {@code GET /api/admin/features/{key}} — one feature's detail (mezo-l096.4). Skeleton:
     *  null-filled response regardless of {@code key}/{@code period} — the unknown-key 404 is
     *  wired in Task 4 alongside the real lookup. */
    public AdminFeatureDetailResponse detail(String key, String period) {
        return new AdminFeatureDetailResponse()
                .key(key)
                .usageByWeek(List.of())
                .funnel(new AdminFeatureFunnel()
                        .tried(0)
                        .repeated(0)
                        .habitual(0)
                        .triedUsers(List.of()))
                .feedbackTrend(null)
                .downReasons(null)
                .reliability(new AdminFeatureReliability()
                        .errorPct(null)
                        .p90LatencyMs(null)
                        .p50LatencyMs(null)
                        .topErrors(List.of()))
                .costByModel(List.of())
                .topUsers(List.of());
    }

    /** {@code GET /api/admin/feedback/summary} — per-feature feedback + recall totals
     *  (mezo-l096.4). Skeleton: empty features, null recall regardless of {@code period}. */
    public AdminFeedbackSummaryResponse feedbackSummary(String period) {
        return new AdminFeedbackSummaryResponse()
                .period(period)
                .features(List.of())
                .recall(null);
    }
}

package io.mrkuhne.mezo.feature.admin.controller;

import io.mrkuhne.mezo.api.controller.AdminInsightsApi;
import io.mrkuhne.mezo.api.dto.AdminCostMatrixResponse;
import io.mrkuhne.mezo.api.dto.AdminFeatureUsageResponse;
import io.mrkuhne.mezo.api.dto.AdminOverviewResponse;
import io.mrkuhne.mezo.api.dto.AdminUserDetailResponse;
import io.mrkuhne.mezo.api.dto.AdminUserInsightResponse;
import io.mrkuhne.mezo.feature.admin.service.AdminOverviewService;
import io.mrkuhne.mezo.feature.admin.service.AdminUserService;
import io.mrkuhne.mezo.feature.auth.service.CurrentUser;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/**
 * OWNER-only admin insights (mezo-d5iy). Disabled by default; see
 * {@link FeaturesConfiguration#ADMIN_INSIGHTS_SWITCH}. {@code requireOwner()} is the first
 * statement of every method and runs outside any transaction on purpose.
 *
 * <p>The generated {@link AdminInsightsApi} has no {@code default} method bodies, so every
 * operation must be implemented to compile. {@link #getAdminOverview()} (mezo-d5iy.3) and
 * {@link #listAdminUserInsights(String, String, String)} (mezo-d5iy.4) are real; the remaining
 * three return an empty response and are filled in by their own tasks, each driven by its own IT.
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ADMIN_INSIGHTS_SWITCH, havingValue = "true")
public class AdminInsightsController implements AdminInsightsApi {

    private final AdminOverviewService overviewService;
    private final AdminUserService userService;
    private final CurrentUser currentUser;

    @Override
    public AdminOverviewResponse getAdminOverview() {
        currentUser.requireOwner();
        return overviewService.overview();
    }

    @Override
    public List<AdminUserInsightResponse> listAdminUserInsights(String q, String sort, String dir) {
        currentUser.requireOwner();
        return userService.list(q, sort, dir);
    }

    // TODO(mezo-d5iy.4): implemented in a later task
    @Override
    public AdminUserDetailResponse getAdminUserInsight(UUID id) {
        currentUser.requireOwner();
        return new AdminUserDetailResponse();
    }

    // TODO(mezo-d5iy.5): implemented in a later task
    @Override
    public AdminFeatureUsageResponse getAdminFeatureUsage(String period) {
        currentUser.requireOwner();
        return new AdminFeatureUsageResponse();
    }

    // TODO(mezo-d5iy.6): implemented in a later task
    @Override
    public AdminCostMatrixResponse getAdminCostMatrix(String period) {
        currentUser.requireOwner();
        return new AdminCostMatrixResponse();
    }
}

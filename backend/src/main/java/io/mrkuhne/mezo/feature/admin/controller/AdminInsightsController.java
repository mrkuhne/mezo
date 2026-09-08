package io.mrkuhne.mezo.feature.admin.controller;

import io.mrkuhne.mezo.api.controller.AdminInsightsApi;
import io.mrkuhne.mezo.api.dto.AdminCostMatrixResponse;
import io.mrkuhne.mezo.api.dto.AdminFeatureUsageResponse;
import io.mrkuhne.mezo.api.dto.AdminOverviewResponse;
import io.mrkuhne.mezo.api.dto.AdminScreenUsageResponse;
import io.mrkuhne.mezo.api.dto.AdminUserDetailResponse;
import io.mrkuhne.mezo.api.dto.AdminUserInsightResponse;
import io.mrkuhne.mezo.feature.admin.service.AdminOverviewService;
import io.mrkuhne.mezo.feature.admin.service.AdminUsageService;
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
 * operation must be implemented to compile. {@link #getAdminOverview()} (mezo-d5iy.3),
 * {@link #listAdminUserInsights(String, String, String)} (mezo-d5iy.4),
 * {@link #getAdminUserInsight(UUID)} (mezo-d5iy.5), {@link #getAdminFeatureUsage(String)} and
 * {@link #getAdminCostMatrix(String)} (both mezo-d5iy.6) are all real.
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ADMIN_INSIGHTS_SWITCH, havingValue = "true")
public class AdminInsightsController implements AdminInsightsApi {

    private final AdminOverviewService overviewService;
    private final AdminUserService userService;
    private final AdminUsageService usageService;
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

    @Override
    public AdminUserDetailResponse getAdminUserInsight(UUID id) {
        currentUser.requireOwner();
        return userService.detail(id);
    }

    @Override
    public AdminFeatureUsageResponse getAdminFeatureUsage(String period) {
        currentUser.requireOwner();
        return usageService.featureUsage(period);
    }

    @Override
    public AdminCostMatrixResponse getAdminCostMatrix(String period) {
        currentUser.requireOwner();
        return usageService.costMatrix(period);
    }

    /**
     * The screen-usage panel (mezo-o5cz). Sits on the ADMIN_INSIGHTS switch like every other
     * operation here, NOT on the screen-telemetry one: with telemetry off the log is empty and
     * this answers an honest zero-row 200, rather than a 404 the admin UI would have to
     * special-case.
     */
    @Override
    public AdminScreenUsageResponse getAdminScreenUsage(String period) {
        currentUser.requireOwner();
        return usageService.screenUsage(period);
    }
}

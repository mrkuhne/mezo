package io.mrkuhne.mezo.feature.admin.controller;

import io.mrkuhne.mezo.api.controller.AdminDataApi;
import io.mrkuhne.mezo.api.dto.AdminRowPageResponse;
import io.mrkuhne.mezo.api.dto.AdminTableListResponse;
import io.mrkuhne.mezo.api.dto.AdminViewDescriptor;
import io.mrkuhne.mezo.feature.admin.service.AdminDataBrowserService;
import io.mrkuhne.mezo.feature.auth.service.CurrentUser;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/**
 * OWNER-only generic row browser (mezo-d5iy.7). Disabled by default; see
 * {@link FeaturesConfiguration#ADMIN_INSIGHTS_SWITCH} — the same switch as {@link
 * AdminInsightsController}. {@code requireOwner()} is the first statement of every method and
 * runs outside any transaction on purpose, exactly as in {@link AdminInsightsController}.
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ADMIN_INSIGHTS_SWITCH, havingValue = "true")
public class AdminDataController implements AdminDataApi {

    private final AdminDataBrowserService service;
    private final CurrentUser currentUser;

    @Override
    public AdminTableListResponse listAdminTables() {
        currentUser.requireOwner();
        return service.tables();
    }

    @Override
    public List<AdminViewDescriptor> listAdminViews() {
        currentUser.requireOwner();
        return service.views();
    }

    @Override
    public AdminRowPageResponse getAdminTableRows(String table, UUID userId, Integer page, Integer size,
            String sort, String dir, Boolean includeDeleted) {
        currentUser.requireOwner();
        return service.rows(table, userId, page, size, sort, dir, includeDeleted);
    }
}

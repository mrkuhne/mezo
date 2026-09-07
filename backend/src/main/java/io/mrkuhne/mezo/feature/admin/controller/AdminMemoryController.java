package io.mrkuhne.mezo.feature.admin.controller;

import io.mrkuhne.mezo.api.controller.AdminMemoryApi;
import io.mrkuhne.mezo.api.dto.AdminMemoryReplayRequest;
import io.mrkuhne.mezo.api.dto.AdminMemoryRunDetailResponse;
import io.mrkuhne.mezo.api.dto.AdminMemoryRunPageResponse;
import io.mrkuhne.mezo.feature.admin.service.AdminMemoryService;
import io.mrkuhne.mezo.feature.auth.service.CurrentUser;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/**
 * OWNER-only RAG memory explorer (mezo-4qyt). Disabled by default; see
 * {@link FeaturesConfiguration#ADMIN_MEMORY_SWITCH}. {@code requireOwner()} is the literal first
 * statement of every method and runs OUTSIDE any transaction on purpose — it issues a
 * {@code touchLastSeen} UPDATE, so it must never sit inside a {@code readOnly} transaction.
 *
 * <p>The generated {@link AdminMemoryApi} has no {@code default} method bodies, so every operation
 * must be implemented to compile.
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ADMIN_MEMORY_SWITCH, havingValue = "true")
public class AdminMemoryController implements AdminMemoryApi {

    private final AdminMemoryService service;
    private final CurrentUser currentUser;

    @Override
    public AdminMemoryRunPageResponse listAdminMemoryRuns(UUID userId, Integer page, Integer size) {
        currentUser.requireOwner();
        return service.runs(userId, page, size);
    }

    @Override
    public AdminMemoryRunDetailResponse getAdminMemoryRun(UUID userId, UUID runId) {
        currentUser.requireOwner();
        return service.run(userId, runId);
    }

    @Override
    public AdminMemoryRunDetailResponse replayAdminMemory(UUID userId, AdminMemoryReplayRequest request) {
        currentUser.requireOwner();
        return service.replay(userId, request);
    }
}

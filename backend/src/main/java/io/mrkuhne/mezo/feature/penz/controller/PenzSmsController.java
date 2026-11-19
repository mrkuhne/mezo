package io.mrkuhne.mezo.feature.penz.controller;

import io.mrkuhne.mezo.api.controller.PenzSmsApi;
import io.mrkuhne.mezo.api.dto.PenzSmsIngestRequest;
import io.mrkuhne.mezo.api.dto.PenzSmsIngestResponse;
import io.mrkuhne.mezo.api.dto.PenzSmsKeyCreateRequest;
import io.mrkuhne.mezo.api.dto.PenzSmsKeyCreatedResponse;
import io.mrkuhne.mezo.api.dto.PenzSmsKeyResponse;
import io.mrkuhne.mezo.feature.penz.service.PenzSmsIngestService;
import io.mrkuhne.mezo.feature.penz.service.PenzSmsKeyService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/**
 * /api/penz/sms (Boop Pénz L4, mezo-r36n9.102) — thin delegation. The ingest is reached only through the API-key
 * filter chain ({@code PenzSmsSecurityConfig}), whose principal is the key's owner, so {@link CurrentUserId}
 * resolves exactly as for a JWT; the key endpoints ride the normal JWT chain.
 */
@RestController
@RequiredArgsConstructor
public class PenzSmsController implements PenzSmsApi {

    private final PenzSmsIngestService ingest;
    private final PenzSmsKeyService keys;
    private final CurrentUserId currentUserId;

    @Override
    public PenzSmsIngestResponse ingestPenzSms(PenzSmsIngestRequest request) {
        return ingest.ingest(currentUserId.get(), request);
    }

    @Override
    public List<PenzSmsKeyResponse> listPenzSmsKeys() {
        return keys.list(currentUserId.get());
    }

    @Override
    public PenzSmsKeyCreatedResponse createPenzSmsKey(PenzSmsKeyCreateRequest request) {
        return keys.create(currentUserId.get(), request.getName());
    }

    @Override
    public void revokePenzSmsKey(UUID id) {
        keys.revoke(currentUserId.get(), id);
    }
}

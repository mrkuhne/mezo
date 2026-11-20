package io.mrkuhne.mezo.feature.penz.controller;

import io.mrkuhne.mezo.api.controller.PenzNewsApi;
import io.mrkuhne.mezo.api.dto.PenzDigestResponse;
import io.mrkuhne.mezo.feature.penz.service.PenzDigestService;
import io.mrkuhne.mezo.feature.penz.service.PenzNewsRunner;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** The Pénz news digest (Boop Pénz L6, mezo-r36n9.104, tag PenzNews) — thin delegation, owner from the principal. */
@RestController
@RequiredArgsConstructor
public class PenzNewsController implements PenzNewsApi {

    private final PenzDigestService digests;
    private final PenzNewsRunner runner;
    private final CurrentUserId currentUserId;

    @Override
    public PenzDigestResponse getPenzDigest(LocalDate date) {
        return digests.get(currentUserId.get(), date);
    }

    @Override
    public void refreshPenzDigest() {
        runner.requestRefresh(currentUserId.get());
    }
}

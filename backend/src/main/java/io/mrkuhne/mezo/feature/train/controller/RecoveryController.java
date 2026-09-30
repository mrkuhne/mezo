package io.mrkuhne.mezo.feature.train.controller;

import io.mrkuhne.mezo.api.controller.TrainRecoveryApi;
import io.mrkuhne.mezo.api.dto.RecoveryCheckInRequest;
import io.mrkuhne.mezo.api.dto.RecoveryReleaseRequest;
import io.mrkuhne.mezo.api.dto.RecoveryState;
import io.mrkuhne.mezo.api.dto.RecoveryUpsertRequest;
import io.mrkuhne.mezo.feature.train.service.RecoveryReturnService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Kihagyás S2 "kímélő mód" (mezo-q4xt2.2) — mappings come from {@link TrainRecoveryApi}. */
@RestController
@RequiredArgsConstructor
public class RecoveryController implements TrainRecoveryApi {

    private final RecoveryReturnService recoveryReturnService;
    private final CurrentUserId currentUserId;

    @Override
    public RecoveryState getRecovery() {
        return recoveryReturnService.state(currentUserId.get());
    }

    @Override
    public RecoveryState upsertRecovery(RecoveryUpsertRequest recoveryUpsertRequest) {
        return recoveryReturnService.upsert(currentUserId.get(), recoveryUpsertRequest);
    }

    @Override
    public void deleteRecovery() {
        recoveryReturnService.discard(currentUserId.get());
    }

    @Override
    public RecoveryState recoveryCheckIn(RecoveryCheckInRequest recoveryCheckInRequest) {
        return recoveryReturnService.checkIn(currentUserId.get(), recoveryCheckInRequest.getAnswer());
    }

    @Override
    public RecoveryState recoveryUndoBetter() {
        return recoveryReturnService.undoBetter(currentUserId.get());
    }

    @Override
    public RecoveryState releaseRecoveryDay(LocalDate date, RecoveryReleaseRequest recoveryReleaseRequest) {
        boolean lighten = recoveryReleaseRequest == null || !Boolean.FALSE.equals(recoveryReleaseRequest.getLighten());
        return recoveryReturnService.release(currentUserId.get(), date, lighten);
    }

    @Override
    public RecoveryState unreleaseRecoveryDay(LocalDate date) {
        return recoveryReturnService.unrelease(currentUserId.get(), date);
    }

    @Override
    public RecoveryState waiveComeback() {
        return recoveryReturnService.waiveComeback(currentUserId.get());
    }
}

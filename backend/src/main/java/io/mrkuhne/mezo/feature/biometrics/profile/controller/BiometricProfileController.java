package io.mrkuhne.mezo.feature.biometrics.profile.controller;

import io.mrkuhne.mezo.api.controller.BiometricProfileApi;
import io.mrkuhne.mezo.api.dto.BiometricProfileResponse;
import io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest;
import io.mrkuhne.mezo.feature.biometrics.profile.service.BiometricProfileService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated {@link BiometricProfileApi}; mappings/validation come from the interface. */
@RestController
@RequiredArgsConstructor
public class BiometricProfileController implements BiometricProfileApi {

    private final BiometricProfileService service;
    private final CurrentUserId currentUserId;

    @Override
    public BiometricProfileResponse getBiometricProfile() {
        return service.getProfile(currentUserId.get());
    }

    @Override
    public BiometricProfileResponse upsertBiometricProfile(BiometricProfileUpsertRequest biometricProfileUpsertRequest) {
        return service.upsertProfile(currentUserId.get(), biometricProfileUpsertRequest);
    }
}

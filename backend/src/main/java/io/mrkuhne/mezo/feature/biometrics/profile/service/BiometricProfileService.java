package io.mrkuhne.mezo.feature.biometrics.profile.service;

import io.mrkuhne.mezo.api.dto.BiometricProfileResponse;
import io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.mapper.BiometricProfileMapper;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single-row-per-owner biometric profile. {@link #getProfile} 404s when the owner has no profile;
 * {@link #upsertProfile} find-or-creates by {@code createdBy} and overwrites the fields, so it is
 * one row per owner (insert once, update thereafter) — backed by
 * {@code uq_biometric_profile_created_by}.
 */
@Service
@RequiredArgsConstructor
public class BiometricProfileService {

    private final BiometricProfileRepository repository;
    private final BiometricProfileMapper mapper;

    public BiometricProfileResponse getProfile(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
            .map(mapper::toResponse)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    @Transactional
    public BiometricProfileResponse upsertProfile(UUID userId, BiometricProfileUpsertRequest req) {
        BiometricProfileEntity e = repository.findByCreatedByAndDeletedFalse(userId)
            .orElseGet(() -> {
                BiometricProfileEntity x = new BiometricProfileEntity();
                x.setCreatedBy(userId); // server-side ownership — never from the client
                return x;
            });
        e.setSex(req.getSex());
        e.setHeightCm(req.getHeightCm());
        e.setBirthDate(req.getBirthDate());
        e.setBodyFatPct(req.getBodyFatPct());
        return mapper.toResponse(repository.save(e));
    }
}

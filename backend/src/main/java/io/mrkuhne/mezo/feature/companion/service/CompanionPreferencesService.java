package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.CompanionPreferencesRequest;
import io.mrkuhne.mezo.api.dto.CompanionPreferencesResponse;
import io.mrkuhne.mezo.feature.companion.repository.CompanionPreferencesRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CompanionPreferencesService {
    private final CompanionPreferencesRepository repository;

    public CompanionPreferencesResponse get(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
                .map(row -> new CompanionPreferencesResponse(row.getAboutMe(), row.getCustomInstructions(), row.getUseLearnedProfile()))
                .orElseGet(() -> new CompanionPreferencesResponse("", "", true));
    }

    @Transactional
    public CompanionPreferencesResponse update(UUID userId, CompanionPreferencesRequest request) {
        repository.upsert(userId, request.getAboutMe(), request.getCustomInstructions(), request.getUseLearnedProfile());
        return new CompanionPreferencesResponse(request.getAboutMe(), request.getCustomInstructions(), request.getUseLearnedProfile());
    }
}

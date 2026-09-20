package io.mrkuhne.mezo.feature.companion.controller;

import io.mrkuhne.mezo.api.controller.CompanionPreferencesApi;
import io.mrkuhne.mezo.api.dto.CompanionPreferencesRequest;
import io.mrkuhne.mezo.api.dto.CompanionPreferencesResponse;
import io.mrkuhne.mezo.api.dto.CompanionPersonalContextResponse;
import io.mrkuhne.mezo.feature.companion.service.CompanionPreferencesService;
import io.mrkuhne.mezo.feature.companion.service.PersonalContextAssembler;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class CompanionPreferencesController implements CompanionPreferencesApi {
    private final CurrentUserId currentUserId;
    private final CompanionPreferencesService preferences;
    private final PersonalContextAssembler context;

    @Override public CompanionPreferencesResponse getCompanionPreferences() {
        return preferences.get(currentUserId.get());
    }
    @Override public CompanionPreferencesResponse updateCompanionPreferences(CompanionPreferencesRequest request) {
        return preferences.update(currentUserId.get(), request);
    }
    @Override public CompanionPersonalContextResponse getCompanionPersonalContext() {
        return context.assemble(currentUserId.get(), LocalDate.now());
    }
}

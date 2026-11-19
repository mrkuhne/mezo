package io.mrkuhne.mezo.feature.pantry.controller;

import io.mrkuhne.mezo.api.controller.PantryQuickAddApi;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryQuickAddRequest;
import io.mrkuhne.mezo.feature.pantry.service.PantryQuickAddService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** The one-tap „+ Kamrába" (mezo-r36n9.63). Switch off => this bean is gone (the route 404s). */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_QUICK_ADD_SWITCH, havingValue = "true")
public class PantryQuickAddController implements PantryQuickAddApi {

    private final PantryQuickAddService service;
    private final CurrentUserId currentUserId;

    @Override
    public PantryItemResponse quickAddPantryItem(PantryQuickAddRequest pantryQuickAddRequest) {
        return service.quickAdd(currentUserId.get(), pantryQuickAddRequest.getName());
    }
}

package io.mrkuhne.mezo.feature.pantry.controller;

import io.mrkuhne.mezo.api.controller.PantryImportApi;
import io.mrkuhne.mezo.api.dto.PantryImportRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryLookupResponse;
import io.mrkuhne.mezo.feature.pantry.service.PantryImportService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/**
 * Implements the generated {@link PantryImportApi} (Fuel P6, mezo-bka). The whole import feature
 * appears/disappears with {@code mezo.feature.pantry-import.enabled} (off -> 404).
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_IMPORT_SWITCH, havingValue = "true")
public class PantryImportController implements PantryImportApi {

    private final PantryImportService service;
    private final CurrentUserId currentUserId;

    @Override
    public PantryLookupResponse lookupPantryItem(String q) {
        return service.lookup(q);
    }

    @Override
    public PantryItemResponse importPantryItem(PantryImportRequest pantryImportRequest) {
        return service.importItem(currentUserId.get(), pantryImportRequest);
    }
}

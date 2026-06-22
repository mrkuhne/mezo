package io.mrkuhne.mezo.feature.pantry.controller;

import io.mrkuhne.mezo.api.controller.PantryApi;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.feature.pantry.service.PantryService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated {@link PantryApi}; mappings/status/validation come from the interface. */
@RestController
@RequiredArgsConstructor
public class PantryController implements PantryApi {

    private final PantryService service;
    private final CurrentUserId currentUserId;

    @Override
    public PantryResponse getPantry() {
        return service.getPantry(currentUserId.get());
    }

    @Override
    public PantryItemResponse createPantryItem(PantryItemRequest pantryItemRequest) {
        return service.createItem(currentUserId.get(), pantryItemRequest);
    }

    @Override
    public PantryItemResponse updatePantryItem(UUID id, PantryItemRequest pantryItemRequest) {
        return service.updateItem(currentUserId.get(), id, pantryItemRequest);
    }

    @Override
    public void deletePantryItem(UUID id) {
        service.deleteItem(currentUserId.get(), id);
    }
}

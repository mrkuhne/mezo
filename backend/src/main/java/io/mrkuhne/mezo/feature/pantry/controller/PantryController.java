package io.mrkuhne.mezo.feature.pantry.controller;

import io.mrkuhne.mezo.api.controller.PantryApi;
import io.mrkuhne.mezo.api.dto.PantryCatalogEntry;
import io.mrkuhne.mezo.api.dto.PantryFromCatalogRequest;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.feature.auth.service.CurrentUser;
import io.mrkuhne.mezo.feature.pantry.service.PantryCatalogService;
import io.mrkuhne.mezo.feature.pantry.service.PantryService;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated {@link PantryApi}; mappings/status/validation come from the interface. */
@RestController
@RequiredArgsConstructor
public class PantryController implements PantryApi {

    private final PantryService service;
    private final PantryCatalogService catalogService;
    /** S1: the ENTITY (not just the id) — the S4 catalog edit gate needs the caller's role. */
    private final CurrentUser currentUser;

    @Override
    public PantryResponse getPantry() {
        return service.getPantry(currentUser.get());
    }

    @Override
    public PantryItemResponse createPantryItem(PantryItemRequest pantryItemRequest) {
        return service.createItem(currentUser.id(), pantryItemRequest);
    }

    @Override
    public PantryItemResponse updatePantryItem(UUID id, PantryItemRequest pantryItemRequest) {
        return service.updateItem(currentUser.get(), id, pantryItemRequest);
    }

    @Override
    public void deletePantryItem(UUID id) {
        service.deleteItem(currentUser.id(), id);
    }

    @Override
    public List<PantryCatalogEntry> searchPantryCatalog(String q, String kind) {
        currentUser.id(); // per-request account check before the global (non-owner-scoped) read
        return catalogService.search(q, kind);
    }

    @Override
    public PantryItemResponse addPantryItemFromCatalog(PantryFromCatalogRequest pantryFromCatalogRequest) {
        return service.addFromCatalog(currentUser.id(), pantryFromCatalogRequest.getCatalogId());
    }
}

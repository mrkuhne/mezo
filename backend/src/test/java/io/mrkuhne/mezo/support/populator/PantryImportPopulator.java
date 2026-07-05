package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.pantry.entity.PantryImportEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryImportRepository;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the PantryImport feed aggregate (Fuel P6, mezo-bka). */
@TestComponent
@RequiredArgsConstructor
public class PantryImportPopulator {

    private final PantryImportRepository repository;

    /** A synced single-item OpenFoodFacts feed row imported now. */
    public PantryImportEntity createImport(UUID owner, String itemName) {
        PantryImportEntity e = new PantryImportEntity();
        e.setCreatedBy(owner);
        e.setSource("openfoodfacts");
        e.setItemName(itemName);
        e.setItemCount(1);
        e.setStatus("synced");
        e.setImportedAt(Instant.now());
        return repository.saveAndFlush(e);
    }
}

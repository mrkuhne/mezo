package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The demodata catalog seeder fills the owner's pantry once, idempotently, with preserved nutrients. */
class PantryCatalogLoaderIT extends ApiIntegrationTest {

    private static final int CATALOG_SIZE = 146;

    @Autowired private PantryCatalogLoader loader;
    @Autowired private PantryItemRepository repository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testRun_shouldSeedOwnerPantryWithPreservedNutrients_whenEmpty() {
        UUID owner = ownerId();
        // ResetDatabase wiped pantry_item in @BeforeEach, so the owner starts empty here.
        assertThat(repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner)).isEmpty();

        loader.run();

        var items = repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner);
        assertThat(items).hasSize(CATALOG_SIZE);

        PantryItemEntity bulgur = items.stream()
            .filter(i -> i.getName().equals("Bulgur Raw Kifli")).findFirst().orElseThrow();
        assertThat(bulgur.getKind()).isEqualTo("food");
        assertThat(bulgur.getCategory()).isEqualTo("grains");
        assertThat(bulgur.getSource()).isEqualTo("kifli.hu");
        assertThat(bulgur.getFiberG()).isEqualByComparingTo(new BigDecimal("13"));

        // The richer enums are exercised by real rows persisting through the new DB CHECKs.
        assertThat(items).anyMatch(i -> "lidl".equals(i.getSource()));
        assertThat(items).anyMatch(i -> "supplement".equals(i.getCategory()) && "supplement".equals(i.getKind()));
        assertThat(items).anyMatch(i -> i.getSaltG() != null);
    }

    @Test
    void testRun_shouldBeIdempotent_whenAlreadySeeded() {
        UUID owner = ownerId();
        loader.run();
        int afterFirst = repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner).size();

        loader.run(); // owner non-empty now → no-op

        assertThat(repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner)).hasSize(afterFirst);
        assertThat(afterFirst).isEqualTo(CATALOG_SIZE);
    }
}

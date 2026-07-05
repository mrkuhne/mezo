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

    private static final int CATALOG_SIZE = 147;

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

        // NOVA classes ship with the catalog since mezo-32ko: only the 2 non-food rows stay null.
        assertThat(bulgur.getNova()).isEqualTo((short) 1);
        assertThat(items.stream().filter(i -> i.getNova() == null))
            .extracting(PantryItemEntity::getName)
            .containsExactlyInAnyOrder("Jenny Kaja", "Szilvia Törlőkendő");
        assertThat(items).anyMatch(i -> i.getNova() != null && i.getNova() == 4); // ultra-processed present
    }

    @Test
    void testRun_shouldBackfillNovaOnly_whenPantryAlreadySeededWithoutNova() {
        UUID owner = ownerId();
        loader.run();
        var items = repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner);
        // Simulate the pre-32ko live state: catalog rows exist but carry no NOVA — plus one
        // user-curated row whose hand-set nova must survive, and one renamed row left alone.
        PantryItemEntity bulgur = items.stream().filter(i -> i.getName().equals("Bulgur Raw Kifli")).findFirst().orElseThrow();
        PantryItemEntity honey = items.stream().filter(i -> i.getName().equals("Honey")).findFirst().orElseThrow();
        items.forEach(i -> { i.setNova(null); repository.save(i); });
        honey.setNova((short) 4); // user's own (wrong but deliberate) classification
        repository.saveAndFlush(honey);

        loader.run(); // pantry non-empty → seeds nothing, backfills nova

        var after = repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner);
        assertThat(after).hasSize(CATALOG_SIZE); // no new rows
        assertThat(repository.findByIdAndCreatedByAndDeletedFalse(bulgur.getId(), owner).orElseThrow()
            .getNova()).isEqualTo((short) 1);          // null -> catalog value
        assertThat(repository.findByIdAndCreatedByAndDeletedFalse(honey.getId(), owner).orElseThrow()
            .getNova()).isEqualTo((short) 4);          // hand-set value untouched
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

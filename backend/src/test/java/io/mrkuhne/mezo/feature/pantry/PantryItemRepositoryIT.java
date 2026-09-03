package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Limit;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class PantryItemRepositoryIT extends AbstractIntegrationTest {

    @Autowired private PantryItemRepository repository;
    @Autowired private PantryCatalogRepository catalogRepository;
    @Autowired private PantryItemPopulator populator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testFindByOwner_shouldReturnFoodWithCatalogAndJsonbMicros_whenPersisted() {
        UUID owner = databasePopulator.populateUser("repo-a@test.local");
        populator.createFood(owner, "Csirkemell", LocalDate.now().plusDays(3));

        List<PantryItemEntity> items = repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner);

        assertThat(items).hasSize(1);
        PantryCatalogEntity c = items.getFirst().getCatalog();
        assertThat(c.getName()).isEqualTo("Csirkemell");
        assertThat(c.getBrand()).isEqualTo("Bonafarm");
        assertThat(c.getMicros()).extracting("name").containsExactly("B6");
        assertThat(c.getCreatedBy()).isEqualTo(owner); // populator rows are user-authored, never master
        assertThat(items.getFirst().getStockQty()).isEqualByComparingTo("400"); // state stays on the item
    }

    @Test
    void testCreateFood_shouldShareOneCatalogRow_whenTwoUsersHoldTheSameFood() {
        UUID a = databasePopulator.populateUser("repo-a@test.local");
        UUID b = databasePopulator.populateUser("repo-b@test.local");
        PantryItemEntity mine = populator.createFood(a, "Túró", LocalDate.now().plusDays(3));
        PantryItemEntity theirs = populator.createFood(b, "túró", LocalDate.now().plusDays(3)); // natural key is case-insensitive

        assertThat(theirs.getId()).isNotEqualTo(mine.getId());
        assertThat(theirs.getCatalog().getId()).isEqualTo(mine.getCatalog().getId());
        assertThat(catalogRepository.findByNaturalKey("TÚRÓ", "bonafarm")).isPresent();
        assertThat(repository.findByCreatedByAndCatalog_IdAndDeletedFalse(b, mine.getCatalog().getId()))
            .contains(theirs);
    }

    @Test
    void testFindByOwner_shouldHideRow_whenSoftDeleted() {
        UUID owner = databasePopulator.populateUser("repo-a@test.local");
        PantryItemEntity e = populator.createFood(owner, "Túró", LocalDate.now().plusDays(3));
        repository.delete(e); // @SQLDelete -> is_deleted = true on pantry_item only
        repository.flush();
        assertThat(repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner)).isEmpty();
        assertThat(catalogRepository.findById(e.getCatalog().getId())).isPresent(); // the definition survives
    }

    @Test
    void testSearch_shouldMatchNameOrBrandCaseInsensitively_andFilterByKind() {
        UUID owner = databasePopulator.populateUser("repo-a@test.local");
        populator.createFood(owner, "Zabpehely", LocalDate.now().plusDays(3));   // brand Bonafarm
        populator.createSupplement(owner, "Kreatin");                             // brand MyProtein

        assertThat(catalogRepository.searchAll("%zab%", Limit.of(50))).extracting(PantryCatalogEntity::getName)
            .containsExactly("Zabpehely");
        assertThat(catalogRepository.searchAll("%myprot%", Limit.of(50))).extracting(PantryCatalogEntity::getName)
            .containsExactly("Kreatin");
        assertThat(catalogRepository.searchByKind("%%", "supplement", Limit.of(50)))
            .extracting(PantryCatalogEntity::getName).contains("Kreatin").doesNotContain("Zabpehely");
    }
}

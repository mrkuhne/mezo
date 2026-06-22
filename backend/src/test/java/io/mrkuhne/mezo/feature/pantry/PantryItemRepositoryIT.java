package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class PantryItemRepositoryIT extends AbstractIntegrationTest {

    @Autowired private PantryItemRepository repository;
    @Autowired private PantryItemPopulator populator;
    @Autowired private DatabasePopulator databasePopulator;

    // created_by has an FK to app_user(id) — owners MUST be real users (populateUser),
    // never UUID.randomUUID() (that would violate the FK on saveAndFlush).
    @Test
    void testFindByOwner_shouldReturnFoodWithJsonbMicros_whenPersisted() {
        UUID owner = databasePopulator.populateUser("owner@test.local");
        populator.createFood(owner, "Csirkemell", LocalDate.of(2026, 5, 25));

        var items = repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner);

        assertThat(items).hasSize(1);
        PantryItemEntity e = items.get(0);
        assertThat(e.getKind()).isEqualTo("food");
        assertThat(e.getNova()).isEqualTo((short) 1);
        assertThat(e.getMicros()).singleElement()
            .satisfies(m -> { assertThat(m.name()).isEqualTo("B6"); assertThat(m.pct()).isEqualTo(92); });
    }

    @Test
    void testFindByOwner_shouldHideRow_whenSoftDeleted() {
        UUID owner = databasePopulator.populateUser("owner@test.local");
        PantryItemEntity e = populator.createSupplement(owner, "Kreatin");
        repository.delete(e); // @SQLDelete soft-deletes

        assertThat(repository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner)).isEmpty();
    }
}

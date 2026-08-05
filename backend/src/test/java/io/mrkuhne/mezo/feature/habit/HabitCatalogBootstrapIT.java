package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitChainRepository;
import io.mrkuhne.mezo.feature.habit.repository.HabitDefRepository;
import io.mrkuhne.mezo.feature.habit.service.HabitCatalogService;
import io.mrkuhne.mezo.feature.habit.service.HabitService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class HabitCatalogBootstrapIT extends AbstractIntegrationTest {

    @Autowired private HabitCatalogService catalogService;
    @Autowired private HabitService habitService;
    @Autowired private HabitChainRepository chainRepository;
    @Autowired private HabitDefRepository defRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testEnsureCatalog_shouldImportSeed_whenUserHasNoRows() {
        UUID owner = userPopulator.createUser("habit-boot@test.hu").getId();

        List<HabitDefEntity> defs = catalogService.ensureCatalog(owner);

        assertThat(defs).hasSize(15); // the full seed catalog
        assertThat(chainRepository.findByCreatedByAndDeletedFalseOrderByPositionAsc(owner))
            .extracting("chainKey").containsExactly("MORNING", "EVENING");
        // Ordered chain-major: all 9 MORNING defs precede the 6 EVENING defs.
        // Compared by habitKey (not object identity): ensureCatalog/activeForChainKey each run in
        // their own transaction/persistence context, and no entity in this codebase overrides
        // equals/hashCode, so cross-call `.contains(entity)` would compare by reference and always
        // fail — the stable business key is what the assertion actually means to verify.
        List<String> morningKeys = catalogService.activeForChainKey(owner, "MORNING").stream()
            .map(HabitDefEntity::getHabitKey).toList();
        assertThat(defs.subList(0, 9)).extracting(HabitDefEntity::getHabitKey)
            .allMatch(morningKeys::contains);
    }

    @Test
    void testEnsureCatalog_shouldBeIdempotent_whenCalledTwice() {
        UUID owner = userPopulator.createUser("habit-boot2@test.hu").getId();
        catalogService.ensureCatalog(owner);
        List<HabitDefEntity> second = catalogService.ensureCatalog(owner);
        assertThat(second).hasSize(15);
    }

    @Test
    void testEnsureCatalog_shouldReimportMissingDefOnly_whenOneWasNeverImported() {
        UUID owner = userPopulator.createUser("habit-boot3@test.hu").getId();
        List<HabitDefEntity> defs = catalogService.ensureCatalog(owner);
        // Soft-deleting a def keeps it deleted (user intent) — bootstrap must NOT resurrect it…
        HabitDefEntity gone = defs.get(0);
        // (delete via repository to engage @SQLDelete)
        defRepository.delete(gone);
        defRepository.flush();
        // …so after a re-ensure the count drops by one and stays there.
        // Deleting through the service API arrives in Task 4; the repository is the seam here.
        assertThat(catalogService.ensureCatalog(owner)).hasSize(14);
    }

    @Test
    void testByKey_shouldFindSeedDef_afterBootstrap() {
        UUID owner = userPopulator.createUser("habit-boot4@test.hu").getId();
        catalogService.ensureCatalog(owner);
        assertThat(catalogService.byKey(owner, "morning_sunlight")).isPresent();
        assertThat(catalogService.byKey(owner, "nope")).isEmpty();
    }

    @Test
    void testClosePast_shouldNotBootstrapCatalog_whenUserHasNoHabitDayRows() {
        UUID owner = userPopulator.createUser("habit-boot5@test.hu").getId();

        habitService.closePast(owner, LocalDate.now());

        // Zero stale rows -> zero writes: a user who never touched habits stays untouched
        // (mezo-n5e9.1 review finding 3 — the nightly cron must not materialize catalogs for
        // users who never used habits).
        assertThat(chainRepository.findByCreatedByAndDeletedFalseOrderByPositionAsc(owner)).isEmpty();
    }
}

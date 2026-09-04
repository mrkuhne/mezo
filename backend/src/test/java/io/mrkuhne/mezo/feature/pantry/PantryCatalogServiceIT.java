package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.pantry.service.PantryCatalogService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryCatalogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * The seams HTTP cannot reach: soft-deleted-row revival, ensureItem idempotency, the natural-key
 * insert race, and the edit gate's role arm.
 *
 * <p>NOT {@code @Transactional}: {@code findOrCreate} inserts in a REQUIRES_NEW transaction, which
 * cannot see an owner row still uncommitted in a surrounding test transaction (created_by has an FK
 * to app_user). {@code ResetDatabase} cleans up instead — it deletes user-authored catalog rows and
 * leaves the loader's master content alone.
 */
class PantryCatalogServiceIT extends AbstractIntegrationTest {

    @Autowired private PantryCatalogService service;
    @Autowired private PantryCatalogRepository catalogRepository;
    @Autowired private PantryItemRepository itemRepository;
    @Autowired private PantryCatalogPopulator catalogPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private UserPopulator userPopulator;

    private static PantryCatalogEntity candidate(String name, String brand) {
        PantryCatalogEntity c = new PantryCatalogEntity();
        c.setKind("food");
        c.setName(name);
        c.setBrand(brand);
        c.setSource("manual");
        return c;
    }

    @Test
    void testFindOrCreate_shouldReviveSoftDeletedRow_whenNaturalKeyMatches() {
        UUID user = databasePopulator.populateUser("cat-a@test.local");
        PantryCatalogEntity dead = catalogPopulator.createFoodDefinition(user, "Kefir", null);
        dead.setDeleted(true);
        catalogRepository.saveAndFlush(dead);

        PantryCatalogEntity got = service.findOrCreate(user, candidate("kefir", ""));

        assertThat(got.getId()).isEqualTo(dead.getId());
        assertThat(got.isDeleted()).isFalse();
        assertThat(catalogRepository.findAll()).filteredOn(c -> "Kefir".equalsIgnoreCase(c.getName())).hasSize(1);
    }

    @Test
    void testFindOrCreate_shouldStampTheAuthor_whenTheDefinitionIsNew() {
        UUID user = databasePopulator.populateUser("cat-a@test.local");

        PantryCatalogEntity created = service.findOrCreate(user, candidate("Zabkorpa ", "  Naturbit "));

        // created_by MUST be the author: a null author is loader MASTER content.
        assertThat(created.getCreatedBy()).isEqualTo(user);
        assertThat(created.isMaster()).isFalse();
        // and the natural key is stored trimmed on both halves
        assertThat(created.getName()).isEqualTo("Zabkorpa");
        assertThat(created.getBrand()).isEqualTo("Naturbit");
        assertThat(service.findOrCreate(user, candidate("zabkorpa", "naturbit")).getId()).isEqualTo(created.getId());
    }

    @Test
    void testEnsureItem_shouldReturnTheSameLiveRow_andRejectDeletedCatalog() {
        UUID user = databasePopulator.populateUser("cat-a@test.local");
        PantryCatalogEntity def = catalogPopulator.createFoodDefinition(user, "Zabpehely", null);

        PantryItemEntity first = service.ensureItem(user, def.getId());
        PantryItemEntity second = service.ensureItem(user, def.getId());
        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(itemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(user)).hasSize(1);

        def.setDeleted(true);
        catalogRepository.saveAndFlush(def);
        itemRepository.delete(first); // soft-delete: @SQLDelete on pantry_item
        assertThatThrownBy(() -> service.ensureItem(user, def.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                .isEqualTo(HttpStatus.NOT_FOUND));
        // the catalog row survives the refusal — never hard-deleted, never cascaded
        assertThat(catalogRepository.findById(def.getId())).isPresent();
    }

    @Test
    void testEditable_shouldAllowOwnerAndAuthorOnly() {
        UUID authorId = databasePopulator.populateUser("cat-author@test.local");
        UUID strangerId = databasePopulator.populateUser("cat-stranger@test.local");
        AppUserEntity author = appUserRepository.findById(authorId).orElseThrow();
        AppUserEntity stranger = appUserRepository.findById(strangerId).orElseThrow();
        // Own OWNER row rather than the demodata seed: this IT runs without the demodata profile,
        // so OwnerSeedData has not necessarily run against this database.
        AppUserEntity owner = userPopulator.createUser("cat-owner@test.local");
        owner.setRole(AppUserEntity.UserRole.OWNER);
        owner = userPopulator.save(owner);

        PantryCatalogEntity authored = catalogPopulator.createFoodDefinition(authorId, "Mandulapehely", null);
        // In-memory master stand-in: a persisted created_by-null row would survive ResetDatabase
        // (which spares loader master content) and inflate PantryCatalogLoaderIT's master count.
        PantryCatalogEntity master = candidate("Kölesliszt Teszt", null);

        assertThat(service.editable(author, authored)).isTrue();
        assertThat(service.editable(stranger, authored)).isFalse();
        assertThat(service.editable(owner, authored)).isTrue();
        assertThat(service.editable(author, master)).isFalse();   // master is OWNER-only
        assertThat(service.editable(owner, master)).isTrue();

        assertThatThrownBy(() -> service.requireEditable(stranger, authored))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus())
                .isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void testSharedFromName_shouldBeNullForMasterAndOwnRows() {
        UUID authorId = databasePopulator.populateUser("cat-author@test.local");
        UUID readerId = databasePopulator.populateUser("cat-reader@test.local");
        PantryCatalogEntity authored = catalogPopulator.createFoodDefinition(authorId, "Mandulapehely", null);

        var names = service.authorNames(List.of(authored));

        assertThat(service.sharedFromName(authorId, authored, names)).isNull(); // own row
        // UserPopulator.createUser names the account after its EMAIL (the OwnerSeedData owner is the
        // one that carries ownerProperties.ownerName()) — assert against the source actually used.
        assertThat(service.sharedFromName(readerId, authored, names)).isEqualTo("cat-author@test.local");
        assertThat(service.sharedFromName(readerId, candidate("Kölesliszt Teszt", null), names)).isNull(); // master
    }

    /**
     * Fix round 1 Important 4 (1/2): an editable caller — here, the row's own AUTHOR — gets their
     * NULL fields backfilled, but a value the row already carries (kcal, curated by the populator)
     * is never overwritten.
     */
    @Test
    void testFindOrCreate_shouldBackfillOnlyNullFields_whenCallerIsTheAuthor() {
        UUID author = databasePopulator.populateUser("cat-merge-author@test.local");
        PantryCatalogEntity existing = catalogPopulator.createFoodDefinition(author, "Rozskenyér Teszt", "Sarki");
        assertThat(existing.getKcal()).isNotNull();   // curated by the populator
        assertThat(existing.getFiberG()).isNull();    // never set by the populator — the gap to fill

        PantryCatalogEntity attempt = candidate("rozskenyér teszt", "sarki");
        attempt.setKcal(new BigDecimal("999"));       // must NOT overwrite the curated 110
        attempt.setFiberG(new BigDecimal("5.5"));      // must fill the NULL gap

        PantryCatalogEntity got = service.findOrCreate(author, attempt);

        assertThat(got.getId()).isEqualTo(existing.getId());
        assertThat(got.getKcal()).isEqualByComparingTo(existing.getKcal());
        assertThat(got.getFiberG()).isEqualByComparingTo("5.5");
        // persisted, not just held in the returned managed instance
        assertThat(catalogRepository.findById(existing.getId()).orElseThrow().getFiberG())
            .isEqualByComparingTo("5.5");
    }

    /**
     * Fix round 1 Important 4 (2/2) + Important 2: a non-author caller — even the OWNER, whose
     * {@code editable()} arm would otherwise say yes — must leave the row byte-identical. The merge
     * is narrower than the edit gate on purpose: it is an unreviewed SIDE EFFECT, not an explicit
     * user-initiated edit.
     */
    @Test
    void testFindOrCreate_shouldLeaveRowByteIdentical_whenCallerIsOwnerButNotAuthor() {
        UUID author = databasePopulator.populateUser("cat-merge-author2@test.local");
        AppUserEntity owner = userPopulator.createUser("cat-merge-owner@test.local");
        owner.setRole(AppUserEntity.UserRole.OWNER);
        owner = userPopulator.save(owner);
        PantryCatalogEntity existing = catalogPopulator.createFoodDefinition(author, "Kölesgolyó Teszt", null);
        assertThat(existing.getFiberG()).isNull();

        PantryCatalogEntity attempt = candidate("kölesgolyó teszt", "");
        attempt.setKcal(new BigDecimal("999"));
        attempt.setFiberG(new BigDecimal("5.5"));

        PantryCatalogEntity got = service.findOrCreate(owner.getId(), attempt);

        assertThat(got.getId()).isEqualTo(existing.getId());
        assertThat(got.getKcal()).isEqualByComparingTo(existing.getKcal()); // unchanged
        assertThat(got.getFiberG()).isNull();                              // NOT filled — OWNER is not the author
        assertThat(catalogRepository.findById(existing.getId()).orElseThrow().getFiberG()).isNull();
    }

    @Test
    void testFindOrCreate_shouldBindToWinner_whenTwoUsersCreateTheSameKeyConcurrently() throws Exception {
        UUID a = databasePopulator.populateUser("cat-a@test.local");
        UUID b = databasePopulator.populateUser("cat-b@test.local");
        ExecutorService pool = Executors.newFixedThreadPool(2);
        Future<PantryCatalogEntity> fa = pool.submit(() -> service.findOrCreate(a, candidate("Lencse", "Lidl")));
        Future<PantryCatalogEntity> fb = pool.submit(() -> service.findOrCreate(b, candidate("lencse", "LIDL")));
        PantryCatalogEntity ra = fa.get();
        PantryCatalogEntity rb = fb.get();
        pool.shutdown();

        assertThat(ra.getId()).isEqualTo(rb.getId());
        assertThat(catalogRepository.findAll()).filteredOn(c -> "Lencse".equalsIgnoreCase(c.getName())).hasSize(1);
    }
}

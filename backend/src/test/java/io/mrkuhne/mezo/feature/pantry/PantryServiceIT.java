package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.pantry.service.PantryService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * NOT {@code @Transactional} since S4 (mezo-qw37.4): {@code PantryCatalogService.findOrCreate}
 * inserts the shared definition in a REQUIRES_NEW transaction, and {@code pantry_catalog.created_by}
 * has an FK to {@code app_user} — an owner row still uncommitted in a surrounding test transaction
 * would be invisible to that inner transaction and the insert would fail. {@code ResetDatabase}
 * (@BeforeEach in the base class) does the cleanup instead.
 */
class PantryServiceIT extends AbstractIntegrationTest {

    @Autowired private PantryService service;
    @Autowired private PantryItemPopulator populator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private AppUserRepository appUserRepository;

    // created_by has an FK to app_user(id) — owners MUST be real users (populateUser),
    // never UUID.randomUUID().
    private UUID owner;
    private UUID other;

    @BeforeEach
    void setUpOwners() {
        owner = databasePopulator.populateUser("a@test.local");
        other = databasePopulator.populateUser("b@test.local");
    }

    /** The edit gate needs the ROLE, so the service takes the account, not just its id. */
    private AppUserEntity user(UUID id) {
        return appUserRepository.findById(id).orElseThrow();
    }

    private PantryItemRequest foodReq() {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName("Túró");
        r.setUnit("g");
        r.setKcal(java.math.BigDecimal.valueOf(130));
        return r;
    }

    @Test
    void testGetPantry_shouldSplitByKind_whenMixedItems() {
        populator.createFood(owner, "Csirkemell", LocalDate.of(2026, 5, 25));
        populator.createSupplement(owner, "Kreatin");

        var resp = service.getPantry(user(owner));

        assertThat(resp.getIngredients()).extracting("name").containsExactly("Csirkemell");
        assertThat(resp.getStash()).extracting("name").containsExactly("Kreatin");
        assertThat(resp.getStash().get(0).getType().getValue()).isEqualTo("supplement");
    }

    @Test
    void testCreateItem_shouldPersistOwnedFood_whenValid() {
        var created = service.createItem(owner, foodReq());

        assertThat(created.getId()).isNotNull();
        assertThat(service.getPantry(user(owner)).getIngredients()).hasSize(1);
    }

    @Test
    void testCreateItem_shouldReject_whenFoodMissingKcal() {
        PantryItemRequest r = foodReq();
        r.setKcal(null);

        assertThatThrownBy(() -> service.createItem(owner, r))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testUpdateItem_shouldReturn404_whenForeignRow() {
        var mine = service.createItem(owner, foodReq());

        assertThatThrownBy(() -> service.updateItem(user(other), mine.getId(), foodReq()))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testDeleteItem_shouldSoftHide_whenOwned() {
        var mine = service.createItem(owner, foodReq());

        service.deleteItem(owner, mine.getId());

        assertThat(service.getPantry(user(owner)).getIngredients()).isEmpty();
    }

    @Test
    void testGetPantry_shouldIsolateOwners_whenTwoUsers() {
        populator.createFood(owner, "Csirkemell", LocalDate.of(2026, 5, 25));

        assertThat(service.getPantry(user(other)).getIngredients()).isEmpty();
    }

    @Test
    void testGetPantry_shouldDeriveStimulantType_whenStimItem() {
        PantryItemRequest req = new PantryItemRequest();
        req.setKind(PantryItemRequest.KindEnum.STIM);
        req.setName("Koffein");
        req.setDose("6g");

        service.createItem(owner, req);

        var stash = service.getPantry(user(owner)).getStash();
        assertThat(stash).hasSize(1);
        assertThat(stash.get(0).getType().getValue()).isEqualTo("stimulant");
    }

    @Test
    void testGetPantry_shouldDeriveMedicationType_whenMedItem() {
        PantryItemRequest req = new PantryItemRequest();
        req.setKind(PantryItemRequest.KindEnum.MED);
        req.setName("D-vitamin");
        req.setDose("2000 IU");

        service.createItem(owner, req);

        var stash = service.getPantry(user(owner)).getStash();
        assertThat(stash).hasSize(1);
        assertThat(stash.get(0).getType().getValue()).isEqualTo("medication");
    }

    @Test
    void testCreateItem_shouldReject_whenSupplementMissingBothDoseAndPer() {
        // A supplement with NO quantity basis at all (no dose, no per) is still invalid.
        PantryItemRequest req = new PantryItemRequest();
        req.setKind(PantryItemRequest.KindEnum.SUPPLEMENT);
        req.setName("Kreatin");

        assertThatThrownBy(() -> service.createItem(owner, req))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testCreateItem_shouldAllowGramBasedSupplement_whenPerButNoDose() {
        // Protein powder etc. are gram-based (per/unit), no discrete dose (mezo-1za9 + mezo-2567).
        var created = service.createItem(owner, gramSupplementReq());

        assertThat(created.getId()).isNotNull();
        var stash = service.getPantry(user(owner)).getStash();
        assertThat(stash).hasSize(1);
        assertThat(stash.get(0).getPer()).isEqualByComparingTo(java.math.BigDecimal.valueOf(25));
    }

    @Test
    void testUpdateItem_shouldPersistPer_whenGramBasedSupplementRebased() {
        // Repro of the reported "supplement ADAG 25→100 reverts" bug: the dose requirement
        // rejected the (dose-less) update with 400, so `per` never changed.
        UUID id = service.createItem(owner, gramSupplementReq()).getId();

        PantryItemRequest rebase = new PantryItemRequest();
        rebase.setKind(PantryItemRequest.KindEnum.SUPPLEMENT);
        rebase.setName("Kollagén Teszt Protein");
        rebase.setPer(java.math.BigDecimal.valueOf(100));
        rebase.setUnit("g");

        service.updateItem(user(owner), id, rebase);

        var supp = service.getPantry(user(owner)).getStash().get(0);
        assertThat(supp.getPer()).isEqualByComparingTo(java.math.BigDecimal.valueOf(100));
    }

    private PantryItemRequest gramSupplementReq() {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.SUPPLEMENT);
        r.setName("Kollagén Teszt Protein");
        r.setPer(java.math.BigDecimal.valueOf(25));
        r.setUnit("g");
        return r; // no dose — gram-based supplement
    }

    @Test
    void testUpdateItem_shouldPreserveRichFields_whenRequestOmitsThem() {
        // a rich food row (brand, micros, NOVA, stock + expiry) as a scrape/import would land
        LocalDate expiry = LocalDate.of(2026, 8, 1);
        UUID id = populator.createFood(owner, "Csirkemell", expiry).getId();

        // the real FE edit payload is sparse — it carries only the editable basics and omits
        // micros/nova/brand/category/stock; null must mean "leave unchanged", not "clear"
        PantryItemRequest sparse = new PantryItemRequest();
        sparse.setKind(PantryItemRequest.KindEnum.FOOD);
        sparse.setName("Csirke filé");
        sparse.setUnit("g");
        sparse.setKcal(java.math.BigDecimal.valueOf(165));

        service.updateItem(user(owner), id, sparse);

        var ing = service.getPantry(user(owner)).getIngredients().get(0);
        // preserved — a full-replace PUT would null these:
        assertThat(ing.getBrand()).isEqualTo("Bonafarm");
        assertThat(ing.getMicros()).extracting("name").containsExactly("B6");
        assertThat(ing.getStock()).isNotNull();
        assertThat(ing.getStock().getExpires()).isEqualTo(expiry.toString());
        // explicitly-sent fields still applied — the merge is not a no-op:
        assertThat(ing.getName()).isEqualTo("Csirke filé");
        assertThat(ing.getMacros().getKcal()).isEqualByComparingTo(java.math.BigDecimal.valueOf(165));
    }
}

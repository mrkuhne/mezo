package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.service.PantryCatalogService;
import io.mrkuhne.mezo.feature.pantry.service.PantryService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PantryCatalogPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
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
    @Autowired private PantryCatalogService catalogService;
    @Autowired private PantryCatalogPopulator catalogPopulator;
    @Autowired private PantryCatalogRepository catalogRepository;
    @Autowired private UserPopulator userPopulator;

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
    void testUpdateItem_shouldAllowStateOnlyEdit_whenStoredDefinitionNameHasSurroundingWhitespace() {
        // A LEGACY definition: the pre-split mapper never trimmed and the split migration copies
        // `name` verbatim, so untrimmed stored names are genuinely reachable in production data.
        PantryCatalogEntity legacy = catalogPopulator.createFoodDefinition(owner, "Túró ", null);
        UUID shelfRow = catalogService.ensureItem(other, legacy.getId()).getId();

        // `other` is NOT the author. The edit sheet echoes the DISPLAYED (trimmed) name back and
        // changes only a STATE field — that must never be read as a definition edit.
        PantryItemRequest stateOnly = new PantryItemRequest();
        stateOnly.setKind(PantryItemRequest.KindEnum.FOOD);
        stateOnly.setName("Túró");
        stateOnly.setUnit("g");
        stateOnly.setKcal(java.math.BigDecimal.valueOf(110));
        stateOnly.setPrice(1290);

        service.updateItem(user(other), shelfRow, stateOnly);

        var ing = service.getPantry(user(other)).getIngredients().getFirst();
        assertThat(ing.getPrice()).isEqualByComparingTo(java.math.BigDecimal.valueOf(1290));
        assertThat(ing.getName()).isEqualTo("Túró "); // the shared definition is untouched
    }

    /**
     * A shared food definition whose macros are NULL (creatable today: a blank macro input is sent
     * as no value at all) is read back with kcal/protein/carbs/fat ZERO-FILLED by
     * {@code PantryMapper.toIngredientResponse}. The edit sheet used to echo those zeros back on
     * every save, so {@code definitionDiffers} saw 0-vs-null and a pure PRICE edit became a
     * definition edit — a 403 for a non-author. The sheet now sends the state half only, and the
     * service no longer demands the definition fields back on such a PATCH (mezo-qw37.4, I-1).
     */
    @Test
    void testUpdateItem_shouldAllowPriceOnlyEdit_whenSharedFoodDefinitionHasNullMacros() {
        PantryCatalogEntity shared = nullMacroFoodDefinition(owner, "Olívaolaj Teszt");
        UUID shelfRow = catalogService.ensureItem(other, shared.getId()).getId();

        service.updateItem(user(other), shelfRow, priceOnlyReq("Olívaolaj Teszt", 2490));

        var ing = service.getPantry(user(other)).getIngredients().getFirst();
        assertThat(ing.getPrice()).isEqualByComparingTo(java.math.BigDecimal.valueOf(2490));
        assertSharedMacrosStillNull(shared.getId());
    }

    /**
     * The other half of the same bug: an OWNER PASSES the edit gate, so the echoed zeros used to be
     * written straight onto the shared definition as an unasked-for side effect of a price edit —
     * silently degrading what every other user sees. A price-only PATCH must leave the shared row
     * untouched even for the one role allowed to edit it.
     */
    @Test
    void testUpdateItem_shouldLeaveSharedDefinitionUntouched_whenOwnerEditsPriceOnly() {
        AppUserEntity ownerRole = userPopulator.createUser("s4-price-owner@test.local");
        ownerRole.setRole(AppUserEntity.UserRole.OWNER);
        ownerRole = userPopulator.save(ownerRole);
        PantryCatalogEntity shared = nullMacroFoodDefinition(other, "Lenmagolaj Teszt");
        UUID shelfRow = catalogService.ensureItem(ownerRole.getId(), shared.getId()).getId();

        service.updateItem(ownerRole, shelfRow, priceOnlyReq("Lenmagolaj Teszt", 3190));

        var ing = service.getPantry(ownerRole).getIngredients().getFirst();
        assertThat(ing.getPrice()).isEqualByComparingTo(java.math.BigDecimal.valueOf(3190));
        assertSharedMacrosStillNull(shared.getId());
    }

    /**
     * A draft is an UNREVIEWED import candidate (mezo-qooi). The author actually editing its facts
     * is exactly the "I checked this" gesture the manual-review badge asks for, so it promotes the
     * row to verified — the only exit a draft has, since there is no separate confirm endpoint.
     */
    @Test
    void testUpdateItem_shouldPromoteDraftToVerified_whenTheAuthorEditsTheDefinition() {
        PantryCatalogEntity draft = catalogPopulator.createFoodDefinition(owner, "Draftos Étel", null);
        draft.setStatus(PantryCatalogEntity.STATUS_DRAFT);
        catalogRepository.saveAndFlush(draft);
        UUID shelfRow = catalogService.ensureItem(owner, draft.getId()).getId();

        PantryItemRequest kcalEdit = foodReq();
        kcalEdit.setName("Draftos Étel");
        kcalEdit.setKcal(java.math.BigDecimal.valueOf(321));
        service.updateItem(user(owner), shelfRow, kcalEdit);

        assertThat(catalogRepository.findById(draft.getId()).orElseThrow().getStatus())
            .isEqualTo(PantryCatalogEntity.STATUS_VERIFIED);
    }

    /** A pure price edit is NOT a review of the definition's facts, so the draft must stay a draft. */
    @Test
    void testUpdateItem_shouldLeaveDraft_whenOnlyStateFieldsChange() {
        PantryCatalogEntity draft = catalogPopulator.createFoodDefinition(owner, "Maradjon Draft", null);
        draft.setStatus(PantryCatalogEntity.STATUS_DRAFT);
        catalogRepository.saveAndFlush(draft);
        UUID shelfRow = catalogService.ensureItem(owner, draft.getId()).getId();

        service.updateItem(user(owner), shelfRow, priceOnlyReq("Maradjon Draft", 1490));

        assertThat(catalogRepository.findById(draft.getId()).orElseThrow().getStatus())
            .isEqualTo(PantryCatalogEntity.STATUS_DRAFT);
    }

    /** kcal present, protein/carbs/fat NULL — the shape the zero-fill fabricates values for. */
    private PantryCatalogEntity nullMacroFoodDefinition(UUID author, String name) {
        PantryCatalogEntity c = new PantryCatalogEntity();
        c.setCreatedBy(author);
        c.setKind("food");
        c.setName(name);
        c.setSource("manual");
        c.setServingAmount(java.math.BigDecimal.valueOf(100));
        c.setServingUnit("g");
        c.setKcal(java.math.BigDecimal.valueOf(884));
        return catalogRepository.saveAndFlush(c);
    }

    /** What the fixed edit sheet sends for a price-only save: the contract-required identity + state. */
    private PantryItemRequest priceOnlyReq(String name, int price) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName(name);
        r.setPrice(price);
        return r;
    }

    private void assertSharedMacrosStillNull(UUID catalogId) {
        PantryCatalogEntity after = catalogRepository.findById(catalogId).orElseThrow();
        assertThat(after.getProteinG()).isNull();
        assertThat(after.getCarbsG()).isNull();
        assertThat(after.getFatG()).isNull();
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

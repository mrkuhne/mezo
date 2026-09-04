package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.pantry.service.PantryCatalogService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

class PantryApiIT extends ApiIntegrationTest {

    @Autowired private PantryItemPopulator populator;
    @Autowired private PantryCatalogRepository catalogRepository;
    @Autowired private PantryItemRepository itemRepository;
    @Autowired private PantryCatalogService catalogService;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private PantryItemRequest foodReq() {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName("Túró");
        r.setUnit("g");
        r.setKcal(BigDecimal.valueOf(130));
        return r;
    }

    private PantryItemRequest supplementReq() {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.SUPPLEMENT);
        r.setName("Kollagén Teszt Protein");
        r.setDose("20g"); // supplement's required field
        r.setPer(BigDecimal.valueOf(100));
        r.setUnit("g");
        r.setKcal(BigDecimal.valueOf(360));
        r.setProteinG(BigDecimal.valueOf(90));
        r.setPrice(20490);
        return r;
    }

    @Test
    void testCreateThenGet_shouldReturnSupplementInStashWithMacrosAndPrice_whenAuthed() {
        HttpHeaders auth = ownerAuthHeaders();

        postForBody("/api/pantry", supplementReq(), auth, HttpStatus.CREATED, PantryItemResponse.class);
        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);

        var supp = pantry.getStash().stream()
            .filter(s -> "Kollagén Teszt Protein".equals(s.getName())).findFirst().orElseThrow();
        assertThat(supp.getMacros()).isNotNull();
        assertThat(supp.getMacros().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(360));
        assertThat(supp.getMacros().getP()).isEqualByComparingTo(BigDecimal.valueOf(90));
        assertThat(supp.getPrice()).isEqualByComparingTo(BigDecimal.valueOf(20490));
    }

    @Test
    void testCreateThenGet_shouldReturnFoodInIngredients_whenAuthed() {
        HttpHeaders auth = ownerAuthHeaders();

        postForBody("/api/pantry", foodReq(), auth, HttpStatus.CREATED, PantryItemResponse.class);
        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);

        assertThat(pantry.getIngredients()).extracting("name").contains("Túró");
        // P6 (mezo-bka): the response always carries the feed + suggestion arrays (honest-empty)
        assertThat(pantry.getImports()).isNotNull();
        assertThat(pantry.getSuggestions()).isNotNull();
        // S4 (mezo-qw37.4): every shelf row names its shared definition, and the seeded account is
        // the OWNER, so the definition fields are unlocked for it.
        var turo = pantry.getIngredients().stream()
            .filter(i -> "Túró".equals(i.getName())).findFirst().orElseThrow();
        assertThat(turo.getCatalogId()).isNotNull();
        assertThat(turo.getCatalogEditable()).isTrue();
        assertThat(turo.getSharedFrom()).isNull();
    }

    @Test
    void testCreate_shouldReturn400FieldError_whenFoodMissingKcal() {
        HttpHeaders auth = ownerAuthHeaders();
        PantryItemRequest bad = foodReq();
        bad.setKcal(null);

        String body = exchangeForBody(
            org.springframework.http.HttpMethod.POST, "/api/pantry", bad, auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "kcal", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testUpdate_shouldReturn404_whenUnknownId() {
        HttpHeaders auth = ownerAuthHeaders();

        exchangeForBody(org.springframework.http.HttpMethod.PUT, "/api/pantry/" + UUID.randomUUID(),
            foodReq(), auth, HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testDelete_shouldReturn204ThenHide_whenOwned() {
        HttpHeaders auth = ownerAuthHeaders();
        PantryItemResponse created = postForBody("/api/pantry", foodReq(), auth, HttpStatus.CREATED, PantryItemResponse.class);

        deleteAndExpect("/api/pantry/" + created.getId(), auth, HttpStatus.NO_CONTENT);

        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);
        assertThat(pantry.getIngredients()).extracting("id").doesNotContain(created.getId());
    }

    @Test
    void testGetPantry_shouldReportFoodKind_forAFoodRowCategorisedAsSupplement() {
        HttpHeaders auth = ownerAuthHeaders();
        // 'supplement' is a LEGAL category on a food row (the add sheet offers it) — the kind and
        // the category are independent axes, and the client must not conflate them (mezo-4orh).
        PantryItemRequest req = foodReq();
        req.setName("Kollagén por");
        req.setCategory(PantryItemRequest.CategoryEnum.SUPPLEMENT);

        postForBody("/api/pantry", req, auth, HttpStatus.CREATED, PantryItemResponse.class);
        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);

        var kollagen = pantry.getIngredients().stream()
            .filter(i -> "Kollagén por".equals(i.getName())).findFirst().orElseThrow();
        assertThat(kollagen.getKind().getValue()).isEqualTo("food");
        assertThat(kollagen.getCategory()).isEqualTo("supplement");
    }

    @Test
    void testGetPantry_shouldReportNullMacros_whenTheDefinitionHasNone() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();

        PantryItemEntity item = populator.createFood(owner, "Ismeretlen alapanyag", LocalDate.now().plusDays(9));
        PantryCatalogEntity c = item.getCatalog();
        c.setKcal(null);
        c.setProteinG(null);
        c.setCarbsG(BigDecimal.ZERO); // a REAL, entered zero — must survive as 0, not become null
        c.setFatG(null);
        catalogRepository.saveAndFlush(c);

        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);

        var ismeretlen = pantry.getIngredients().stream()
            .filter(i -> "Ismeretlen alapanyag".equals(i.getName())).findFirst().orElseThrow();
        assertThat(ismeretlen.getMacros().getKcal()).isNull();
        assertThat(ismeretlen.getMacros().getP()).isNull();
        assertThat(ismeretlen.getMacros().getC()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(ismeretlen.getMacros().getF()).isNull();
    }

    // ==== Honest nulls (mezo-xaq5): the read model must not fabricate "" / 0 for a value the
    // definition simply does not carry — a fabricated "" echoed back by any client reads as a
    // definition CHANGE in PantryMapper#definitionDiffers (403 for a non-author, silent shared-row
    // rewrite for the author); a fabricated 0 is indistinguishable from a genuinely free item. ====

    @Test
    void testGetPantry_shouldReportNullCategoryAndPkgAndPrice_insteadOfFabricatedDefaults() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();

        PantryItemEntity item = populator.createFood(owner, "Névtelen alapanyag", LocalDate.now().plusDays(4));
        PantryCatalogEntity c = item.getCatalog();
        c.setCategory(null);
        c.setBrand(null);
        c.setPackageLabel(null);
        catalogRepository.saveAndFlush(c);
        item.setPriceHuf(null);
        item.setPriceUnit(null);
        itemRepository.saveAndFlush(item);

        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);

        var ing = pantry.getIngredients().stream()
            .filter(i -> "Névtelen alapanyag".equals(i.getName())).findFirst().orElseThrow();
        assertThat(ing.getCategory()).isNull();
        assertThat(ing.getBrand()).isNull();
        assertThat(ing.getPkg()).isNull();
        assertThat(ing.getPrice()).isNull();
        assertThat(ing.getPriceUnit()).isNull();
    }

    @Test
    void testGetPantry_shouldKeepARealZeroPrice_distinctFromNoPrice() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();

        PantryItemEntity item = populator.createFood(owner, "Ingyenes minta", LocalDate.now().plusDays(4));
        item.setPriceHuf(0);
        item.setPriceUnit("/db");
        itemRepository.saveAndFlush(item);

        // A genuinely free item is 0, not "no data" — the whole point of the honest null.
        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);

        var ing = pantry.getIngredients().stream()
            .filter(i -> "Ingyenes minta".equals(i.getName())).findFirst().orElseThrow();
        assertThat(ing.getPrice()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void testGetPantry_shouldReportNullCategoryAndFormOnTheStash_insteadOfEmptyStrings() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();

        PantryItemEntity item = populator.createSupplement(owner, "Névtelen kapszula");
        PantryCatalogEntity c = item.getCatalog();
        c.setCategory(null);
        c.setForm(null);
        c.setBrand(null);
        catalogRepository.saveAndFlush(c);

        PantryResponse pantry = getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class);

        var supp = pantry.getStash().stream()
            .filter(s -> "Névtelen kapszula".equals(s.getName())).findFirst().orElseThrow();
        assertThat(supp.getCategory()).isNull();
        assertThat(supp.getForm()).isNull();
        assertThat(supp.getBrand()).isNull();
    }

    /**
     * The worst of the definition-echo family: a fabricated "" for {@code category} is not even a
     * LEGAL enum value, so a client echoing it back on a state-only edit either fails Jackson enum
     * deserialization (400) or — if the field is simply omitted, as a fixed client now would —
     * exercises {@code definitionDiffers} as a true no-op. Either way, a bystander editing only
     * their own price on a row whose shared definition carries no category must succeed.
     */
    @Test
    void testUpdateItem_shouldAllowAPureStateEdit_onARowWhoseCategoryIsNull() {
        RegisteredUser author = registerUser("Kategória Szerző");
        RegisteredUser bystander = registerUser("Kategória Mellékszereplő");
        PantryItemEntity authored = populator.createFood(author.id(), "Kategória nélküli", LocalDate.now().plusDays(6));
        PantryCatalogEntity c = authored.getCatalog();
        c.setCategory(null);
        catalogRepository.saveAndFlush(c);
        PantryItemEntity theirs = catalogService.ensureItem(bystander.id(), c.getId());

        HttpHeaders auth = bystander.headers();
        auth.setContentType(MediaType.APPLICATION_JSON); // for the raw-JSON body below

        // The bystander edits ONLY their own price/priceUnit — a state-only PATCH-shaped PUT that
        // carries no category at all, exactly what the fixed edit sheet now sends for a definition
        // it was handed as null.
        String body = """
            {"kind":"food","name":"Kategória nélküli","price":1290,"priceUnit":"/kg"}
            """;

        exchangeForBody(HttpMethod.PUT, "/api/pantry/" + theirs.getId(), body, auth, HttpStatus.OK, String.class);

        assertThat(catalogRepository.findById(c.getId()).orElseThrow().getCategory()).isNull();
    }
}

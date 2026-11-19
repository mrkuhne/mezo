package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.IngredientResponse;
import io.mrkuhne.mezo.api.dto.MealBreakdown;
import io.mrkuhne.mezo.api.dto.MealScoreDimension;
import io.mrkuhne.mezo.api.dto.PantryBreakdownResponse;
import io.mrkuhne.mezo.api.dto.PantryCatalogEntry;
import io.mrkuhne.mezo.api.dto.PantryItemRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryQuickAddRequest;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * A pantry food's own score, HTTP-level (mezo-r36n9.63): the list rows carry the total, and the two
 * breakdown reads — by shelf item id and by catalog id — return the same envelope the recipe
 * breakdown uses. {@code companion-fake} only so the quick-add can produce an estimated food.
 */
@ActiveProfiles("companion-fake")
class PantryFoodScoreApiIT extends ApiIntegrationTest {

    /** Rolled oats, every fact known, NOVA 1. */
    private PantryItemResponse createOats(HttpHeaders auth) {
        PantryItemRequest r = food("Zabpehely", "100", "g", "372");
        r.setProteinG(new BigDecimal("13.5"));
        r.setCarbsG(new BigDecimal("58.7"));
        r.setFatG(new BigDecimal("7"));
        r.setFiberG(new BigDecimal("10"));
        r.setSugarG(new BigDecimal("1.2"));
        r.setSaltG(new BigDecimal("0.02"));
        r.setSaturatedFatG(new BigDecimal("1.3"));
        r.setNova(1);
        r.setCategory(PantryItemRequest.CategoryEnum.GRAINS);
        return postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class);
    }

    private static PantryItemRequest food(String name, String per, String unit, String kcal) {
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName(name);
        r.setPer(new BigDecimal(per));
        r.setUnit(unit);
        r.setKcal(new BigDecimal(kcal));
        return r;
    }

    private IngredientResponse shelfRow(HttpHeaders auth, UUID itemId) {
        return getForBody("/api/pantry", auth, HttpStatus.OK, PantryResponse.class).getIngredients().stream()
            .filter(i -> i.getId().equals(itemId)).findFirst().orElseThrow();
    }

    private MealBreakdown itemBreakdown(HttpHeaders auth, UUID itemId) {
        return getForBody("/api/pantry/" + itemId + "/breakdown", auth, HttpStatus.OK, PantryBreakdownResponse.class)
            .getBreakdown();
    }

    private MealBreakdown catalogBreakdown(HttpHeaders auth, UUID catalogId) {
        return getForBody("/api/pantry/catalog/" + catalogId + "/breakdown", auth, HttpStatus.OK,
            PantryBreakdownResponse.class).getBreakdown();
    }

    private static MealScoreDimension dim(MealBreakdown b, String id) {
        return b.getDimensions().stream().filter(d -> d.getId().equals(id)).findFirst().orElseThrow();
    }

    @Test
    void testGetPantryItemBreakdown_shouldReturnTheFiveFoodDimensions() {
        HttpHeaders auth = ownerAuthHeaders();
        PantryItemResponse oats = createOats(auth);

        MealBreakdown b = itemBreakdown(auth, oats.getId());

        assertThat(b.getDimensions()).extracting(MealScoreDimension::getId)
            .containsExactly("micro", "who", "fat_quality", "nova", "energy_density");
        assertThat(b.getDimensions()).allSatisfy(d -> {
            assertThat(d.getWeight().doubleValue()).isPositive();
            assertThat(d.getLabel()).isNotBlank();
            assertThat(d.getDetail()).isNotBlank();
        });
        assertThat(b.getValue().doubleValue()).isBetween(0.0, 1.0);
        assertThat(b.getConfidence()).isEqualByComparingTo("1");
        assertThat(b.getSummary()).isNull(); // deterministic: no prose
        assertThat(b.getImprove()).isEmpty();
        assertThat(b.getTools()).isNotEmpty();
        // The list row carries the same total, so a list needs no extra call.
        assertThat(shelfRow(auth, oats.getId()).getScore()).isEqualByComparingTo(b.getValue());
    }

    @Test
    void testGetPantryCatalogBreakdown_shouldMatchTheShelfReadAndTheSearchRow() {
        HttpHeaders anna = registerUser("Anna").headers();
        HttpHeaders bela = registerUser("Béla").headers();
        PantryItemResponse oats = createOats(anna);

        MealBreakdown byItem = itemBreakdown(anna, oats.getId());
        MealBreakdown byCatalog = catalogBreakdown(bela, oats.getCatalogId()); // not on Béla's shelf: the catalog read

        assertThat(byCatalog.getValue()).isEqualByComparingTo(byItem.getValue());
        assertThat(byCatalog.getDimensions()).extracting(MealScoreDimension::getId)
            .containsExactly("micro", "who", "fat_quality", "nova", "energy_density");
        List<PantryCatalogEntry> hits = getForList("/api/pantry/catalog?q=zabpehely", bela, HttpStatus.OK,
            PantryCatalogEntry.class);
        assertThat(hits).hasSize(1);
        assertThat(hits.get(0).getScore()).isEqualByComparingTo(byItem.getValue());
    }

    @Test
    void testPantryScore_shouldDegradeMissingFactsAndStayNullWhenNothingIsComputable() {
        HttpHeaders auth = ownerAuthHeaders();
        // kcal only, measured in grams: energy density is the one thing that can be said.
        UUID bare = postForBody("/api/pantry", food("Rizs", "100", "g", "130"), auth, HttpStatus.CREATED,
            PantryItemResponse.class).getId();
        // kcal only, counted in pieces: nothing can be said.
        UUID blind = postForBody("/api/pantry", food("Tojás", "1", "db", "78"), auth, HttpStatus.CREATED,
            PantryItemResponse.class).getId();

        MealBreakdown b = itemBreakdown(auth, bare);

        assertThat(dim(b, "energy_density").getWeight()).isEqualByComparingTo("1");
        for (String id : List.of("micro", "who", "fat_quality", "nova")) {
            assertThat(dim(b, id).getWeight()).as(id).isEqualByComparingTo("0"); // no data — not a zero score
        }
        assertThat(shelfRow(auth, bare).getScore()).isEqualByComparingTo(b.getValue());
        assertThat(itemBreakdown(auth, blind)).isNull();
        assertThat(shelfRow(auth, blind).getScore()).isNull(); // never a fabricated number
    }

    @Test
    void testPantryScore_shouldScoreAnEstimatedFoodWithoutNova() {
        HttpHeaders anna = registerUser("Anna").headers();
        HttpHeaders bela = registerUser("Béla").headers();
        PantryQuickAddRequest req = new PantryQuickAddRequest();
        req.setName("kurkuma");
        PantryItemResponse estimate = postForBody("/api/pantry/items/quick-add", req, anna, HttpStatus.OK,
            PantryItemResponse.class);

        MealBreakdown b = itemBreakdown(anna, estimate.getId());

        assertThat(dim(b, "nova").getWeight()).isEqualByComparingTo("0"); // never guessed, so not judged
        assertThat(dim(b, "micro").getWeight().doubleValue()).isPositive();
        assertThat(dim(b, "energy_density").getWeight().doubleValue()).isPositive();
        IngredientResponse row = shelfRow(anna, estimate.getId());
        assertThat(row.getEstimated()).isTrue();
        assertThat(row.getScore()).isEqualByComparingTo(b.getValue());
        // Her own unreviewed food: she may read it by catalog id, a stranger gets the usual 404.
        assertThat(catalogBreakdown(anna, estimate.getCatalogId()).getValue()).isEqualByComparingTo(b.getValue());
        getForBody("/api/pantry/catalog/" + estimate.getCatalogId() + "/breakdown", bela, HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testGetPantryItemBreakdown_shouldBeNullForASupplement() {
        HttpHeaders auth = ownerAuthHeaders();
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.SUPPLEMENT);
        r.setName("Kreatin");
        r.setDose("5 g");
        PantryItemResponse supplement = postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class);

        assertThat(itemBreakdown(auth, supplement.getId())).isNull();
        assertThat(catalogBreakdown(auth, supplement.getCatalogId())).isNull();
        assertThat(getForList("/api/pantry/catalog?q=kreatin", auth, HttpStatus.OK, PantryCatalogEntry.class)
            .get(0).getScore()).isNull();
    }

    @Test
    void testBreakdown_shouldAnswer404ForForeignOrUnknownAnd401WithoutToken() {
        HttpHeaders anna = registerUser("Anna").headers();
        HttpHeaders bela = registerUser("Béla").headers();
        PantryItemResponse oats = createOats(anna);

        // Somebody else's SHELF row is not readable (the shared definition is, by its catalog id).
        getForBody("/api/pantry/" + oats.getId() + "/breakdown", bela, HttpStatus.NOT_FOUND, String.class);
        getForBody("/api/pantry/" + UUID.randomUUID() + "/breakdown", anna, HttpStatus.NOT_FOUND, String.class);
        getForBody("/api/pantry/catalog/" + UUID.randomUUID() + "/breakdown", anna, HttpStatus.NOT_FOUND, String.class);
        getForBody("/api/pantry/" + oats.getId() + "/breakdown", new HttpHeaders(), HttpStatus.UNAUTHORIZED, String.class);
        getForBody("/api/pantry/catalog/" + oats.getCatalogId() + "/breakdown", new HttpHeaders(),
            HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void testPantryScore_shouldFollowAFactsEdit() {
        HttpHeaders auth = ownerAuthHeaders();
        PantryItemResponse oats = createOats(auth);
        BigDecimal before = shelfRow(auth, oats.getId()).getScore();

        PantryItemRequest edit = new PantryItemRequest();
        edit.setKind(PantryItemRequest.KindEnum.FOOD);
        edit.setName("Zabpehely");
        edit.setNova(4);
        putForBody("/api/pantry/" + oats.getId(), edit, auth, HttpStatus.OK, PantryItemResponse.class);

        // Nothing is stored: the score is read from the definition as it is now.
        assertThat(shelfRow(auth, oats.getId()).getScore()).isLessThan(before);
    }
}

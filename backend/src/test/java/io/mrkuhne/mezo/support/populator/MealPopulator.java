package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for the Meal aggregate — persists via {@code saveAndFlush} so the DB CHECKs
 * (incl. the polymorphic {@code ck_meal_item_arm} exactly-one-of) + the cascade fire. Two builders,
 * one per polymorphic arm. The line's {@code setMeal} back-reference is set explicitly (the child
 * owns the FK + @NotNull on {@code meal} fires at flush) — same requirement as {@code RecipePopulator}.
 */
@TestComponent
@RequiredArgsConstructor
public class MealPopulator {

    private final MealRepository repository;
    private final PantryItemRepository pantryItemRepository;
    private final PantryCatalogRepository pantryCatalogRepository;

    /** A lunch meal with one recipe-arm line referencing the given (real, persisted) recipe. */
    public MealEntity createRecipeMeal(UUID owner, RecipeEntity recipe) {
        MealEntity meal = newMeal(owner, "lunch", "Ebéd");
        MealItemEntity line = baseLine(meal, owner, 0, new BigDecimal("2"), "adag");
        line.setSource("recipe");
        line.setRecipeId(recipe.getId());
        line.setSnapshotName(recipe.getName());
        line.setSnapshotPer(BigDecimal.ONE);
        line.setSnapshotBasisUnit("adag");
        line.setSnapshotKcal(new BigDecimal("520"));
        line.setSnapshotProteinG(new BigDecimal("38.0"));
        line.setSnapshotCarbsG(new BigDecimal("45.0"));
        line.setSnapshotFatG(new BigDecimal("18.0"));
        line.setSnapshotNova((short) 1);
        meal.getItems().add(line);
        return repository.saveAndFlush(meal);
    }

    /** A breakfast meal with one pantry-arm line referencing the given (real, persisted) pantry item. */
    public MealEntity createPantryMeal(UUID owner, PantryItemEntity pantryItem) {
        MealEntity meal = newMeal(owner, "breakfast", "Reggeli");
        MealItemEntity line = baseLine(meal, owner, 0, new BigDecimal("150"), "g");
        line.setSource("pantry");
        line.setPantryItemId(pantryItem.getId());
        line.setSnapshotName(pantryItem.getCatalog().getName());
        line.setSnapshotPer(new BigDecimal("100"));
        line.setSnapshotBasisUnit("g");
        line.setSnapshotKcal(new BigDecimal("110"));
        line.setSnapshotProteinG(new BigDecimal("23.0"));
        line.setSnapshotCarbsG(BigDecimal.ZERO);
        line.setSnapshotFatG(new BigDecimal("1.5"));
        line.setSnapshotNova((short) 1);
        meal.getItems().add(line);
        return repository.saveAndFlush(meal);
    }

    /** Same breakfast pantry meal, logged on an explicit date — day-rollup/snapshot tests. */
    public MealEntity createPantryMeal(UUID owner, PantryItemEntity pantryItem, LocalDate mealDate) {
        MealEntity meal = createPantryMeal(owner, pantryItem);
        meal.setMealDate(mealDate);
        return repository.saveAndFlush(meal);
    }

    /** Breakfast pantry meal with an explicit loggedAt instant (kitchen-close tests). */
    public MealEntity createPantryMeal(UUID owner, PantryItemEntity pantryItem, LocalDate mealDate,
        Instant loggedAt) {
        MealEntity meal = createPantryMeal(owner, pantryItem, mealDate);
        meal.setLoggedAt(loggedAt);
        return repository.saveAndFlush(meal);
    }

    /**
     * Pantry-backed meal that ALREADY carries a deterministic score envelope — the meal-coach
     * fixture (mezo-mr4n). The coach only narrates already-scored meals, and its prose sockets
     * (summary/tagline/improve) start empty exactly as the scorer leaves them. {@code title} is
     * also where an IT plants the {@code [fake-meal-coach:…]} sentinel, since the name reaches
     * the prompt.
     *
     * <p>A verzióbélyeg szándékosan null: ez a fixture a pre-jcpt.1 envelope-alakot mintázza
     * (mezo-jcpt.2).
     */
    public MealEntity createScoredMeal(UUID owner, PantryItemEntity pantryItem, LocalDate mealDate,
        String title, Instant loggedAt) {
        MealEntity meal = createPantryMeal(owner, pantryItem, mealDate, loggedAt);
        meal.setTitle(title);
        meal.setScore(new BigDecimal("0.62"));
        meal.setBreakdown(new MealBreakdownJson(new BigDecimal("0.62"), new BigDecimal("0.80"),
            null, null,
            List.of(new MealBreakdownJson.Dimension("macro", "Kcal & makró", new BigDecimal("0.22"),
                new BigDecimal("0.50"), "P/C/F 17/71/11 vs 27/47/26", null, null, null, null, null,
                null)),
            List.of(), List.of(new MealBreakdownJson.ToolRow("compute", "score(deterministic)")),
            null));
        return repository.saveAndFlush(meal);
    }

    /**
     * Pre-mezo-jcpt.1 alakú envelope: a súlyok NEM renormalizáltak (egyetlen élő dimenzió 0.22
     * súllyal, miközben a {@code value} már el volt osztva a súlyösszeggel), a verzióbélyeg
     * hiányzik, és a próza-fészkek KI VANNAK töltve — pontosan az az állapot, amit a mezo-jcpt.2
     * backfillnek gyógyítania kell (a Σ(w·score)=0.11 széttart a 0.62-es fejléctől, és a próza
     * olyan számokról beszél, amiket az újrapontozás elmozdít).
     */
    public MealEntity createStaleScoredMeal(UUID owner, PantryItemEntity pantryItem,
        LocalDate mealDate, String title, Instant loggedAt) {
        MealEntity meal = createScoredMeal(owner, pantryItem, mealDate, title, loggedAt);
        MealBreakdownJson stale = meal.getBreakdown();
        meal.setBreakdown(new MealBreakdownJson(stale.value(), stale.confidence(),
            "Kiegyensúlyozott reggeli.", "Jó start",
            List.of(new MealBreakdownJson.Dimension("macro", "Kcal & makró", new BigDecimal("0.22"),
                new BigDecimal("0.50"), "P/C/F 17/71/11 vs 27/47/26", null, null, null, null, null,
                "A fehérje aránya elmarad a céltól.")),
            List.of(new MealBreakdownJson.ImproveRow("Tegyél mellé egy tojást.", "+8")),
            stale.tools(), null));
        return repository.saveAndFlush(meal);
    }

    /** Ugyanaz az étkezés, de MÁR a jelenlegi formula-generáció bélyegével — a backfill nem nyúlhat hozzá. */
    public MealEntity createCurrentScoredMeal(UUID owner, PantryItemEntity pantryItem,
        LocalDate mealDate, String title, Instant loggedAt) {
        MealEntity meal = createScoredMeal(owner, pantryItem, mealDate, title, loggedAt);
        MealBreakdownJson b = meal.getBreakdown();
        meal.setBreakdown(new MealBreakdownJson(b.value(), b.confidence(), b.summary(), b.tagline(),
            b.dimensions(), b.improve(), b.tools(), MealScoringService.FORMULA_VERSION));
        return repository.saveAndFlush(meal);
    }

    /**
     * A meal on an explicit date with N pantry-arm lines, each carrying its own macro/NOVA
     * snapshot — the Karakter round-2 read-layer fixture (mezo-1gim.15) needs multi-line days with
     * distinct NOVA classes, which the single-line {@code createPantryMeal} builders can't express.
     * Each line gets its own throwaway {@code PantryItemEntity} persisted first — {@code
     * pantry_item_id} carries an {@code ON DELETE RESTRICT} FK, so (unlike {@code recipeId} on the
     * other arm in this populator) a random UUID is rejected at flush.
     */
    public MealEntity createMealWithItems(UUID owner, LocalDate mealDate, String slot, List<Line> lines) {
        MealEntity meal = newMeal(owner, slot, slot);
        meal.setMealDate(mealDate);
        int order = 0;
        for (Line line : lines) {
            // Find-or-create by natural key (S4, mezo-qw37.4) — same idiom as PantryCatalogPopulator.
            // pantry_catalog is a GLOBAL table (uq_pantry_catalog_natural on lower(name)+lower(brand))
            // that outlives ResetDatabase's per-user reset, so a blind insert-always here collides the
            // moment two lines (in this test or another) reuse the same fixture name.
            PantryCatalogEntity catalog = pantryCatalogRepository.findByNaturalKey(line.name(), null)
                .orElseGet(() -> {
                    PantryCatalogEntity c = new PantryCatalogEntity();
                    c.setCreatedBy(owner);
                    c.setKind("food");
                    c.setName(line.name());
                    c.setSource("manual");
                    c.setCategory("meat");
                    c.setServingAmount(BigDecimal.ONE);
                    c.setServingUnit("adag");
                    c.setKcal(new BigDecimal(line.kcal()));
                    c.setProteinG(new BigDecimal(line.proteinG()));
                    c.setCarbsG(new BigDecimal(line.carbsG()));
                    c.setFatG(new BigDecimal(line.fatG()));
                    c.setNova(line.nova());
                    return pantryCatalogRepository.saveAndFlush(c);
                });

            // Same find-or-create idiom for the owner's live item row (uq_pantry_item_created_by_catalog_id,
            // S4) — see PantryItemPopulator.itemFor: at most one live pantry_item per (owner, catalog).
            PantryCatalogEntity finalCatalog = catalog;
            PantryItemEntity pantryItem = pantryItemRepository
                .findByCreatedByAndCatalog_IdAndDeletedFalse(owner, catalog.getId())
                .orElseGet(() -> {
                    PantryItemEntity e = new PantryItemEntity();
                    e.setCreatedBy(owner);
                    e.setCatalog(finalCatalog);
                    return pantryItemRepository.saveAndFlush(e);
                });

            MealItemEntity item = baseLine(meal, owner, order++, BigDecimal.ONE, "adag");
            item.setSource("pantry");
            item.setPantryItemId(pantryItem.getId());
            item.setSnapshotName(line.name());
            item.setSnapshotPer(BigDecimal.ONE);
            item.setSnapshotBasisUnit("adag");
            item.setSnapshotKcal(new BigDecimal(line.kcal()));
            item.setSnapshotProteinG(new BigDecimal(line.proteinG()));
            item.setSnapshotCarbsG(new BigDecimal(line.carbsG()));
            item.setSnapshotFatG(new BigDecimal(line.fatG()));
            item.setSnapshotNova(line.nova());
            meal.getItems().add(item);
        }
        return repository.saveAndFlush(meal);
    }

    /** One item line for {@link #createMealWithItems}: name + macro strings + NOVA class. */
    public record Line(String name, String kcal, String proteinG, String carbsG, String fatG, short nova) {
    }

    private MealEntity newMeal(UUID owner, String slot, String title) {
        MealEntity meal = new MealEntity();
        meal.setCreatedBy(owner);
        Instant loggedAt = Instant.parse("2026-06-24T11:30:00Z");
        meal.setLoggedAt(loggedAt);
        meal.setMealDate(LocalDate.ofInstant(loggedAt, ZoneOffset.UTC));
        meal.setSlot(slot);
        meal.setTitle(title);
        return meal;
    }

    // Bidirectional @OneToMany(mappedBy="meal"): the child owns the FK, so the back-reference must
    // be set explicitly (adding to meal.getItems() does not populate it, and @NotNull on `meal`
    // fires at flush before Hibernate would link the cascade) — same as RecipePopulator.
    private MealItemEntity baseLine(
        MealEntity meal, UUID owner, int order, BigDecimal amount, String unit) {
        MealItemEntity line = new MealItemEntity();
        line.setMeal(meal);
        line.setCreatedBy(owner);
        line.setLineOrder(order);
        line.setAmount(amount);
        line.setUnit(unit);
        return line;
    }
}

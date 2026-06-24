package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.RecipeMacros;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.mapper.MealMapper;
import io.mrkuhne.mezo.feature.meal.repository.MealItemRepository;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapper;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owner-scoped meal logging over the {@code meal} → {@code meal_item} aggregate (mirrors
 * {@link io.mrkuhne.mezo.feature.recipe.service.RecipeService}). A logged item is POLYMORPHIC:
 * it references a recipe OR a pantry item ({@code source} discriminator + exactly-one-of arm).
 * Each item captures a per-basis macro snapshot at write time so the line stays renderable after
 * the source is soft-deleted, identical in rationale to {@code recipe_ingredient}.
 *
 * <p>Contribution formula (identical to the recipe mapper + the FE mock):
 * {@code factor = amount / snapshotPer}; {@code contribution.X = round(snapshot.X × factor)}
 * whole-number HALF_UP; {@code meal.macros = Σ line contributions}.
 *
 * <p>{@code breakdown} (the meal score envelope) stays NULL in v1 — pending-sparkle on the FE.
 */
@Service
@RequiredArgsConstructor
public class MealService {

    private final MealRepository repository;
    private final MealItemRepository mealItemRepository;
    private final RecipeRepository recipeRepository;
    private final PantryItemRepository pantryItemRepository;
    private final RecipeMapper recipeMapper; // reused for the recipe whole-macro rollup
    private final MealMapper mapper;
    private final FuelDayService fuelDayService;

    @Transactional
    public MealResponse create(UUID userId, MealRequest req) {
        MealEntity meal = new MealEntity();
        meal.setCreatedBy(userId); // server-side ownership — never from the client
        applyHeader(meal, req);
        rebuildItems(userId, meal, req.getItems());
        return mapper.toResponse(repository.save(meal)); // cascade=ALL persists the items
    }

    @Transactional
    public void update(UUID userId, UUID id, MealRequest req) {
        MealEntity meal = requireOwned(userId, id);
        applyHeader(meal, req);
        rebuildItems(userId, meal, req.getItems()); // dirty-checked; flush on tx commit
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        MealEntity meal = requireOwned(userId, id);
        // @SQLDelete soft-deletes the meal but does NOT cascade to @OneToMany children on a
        // soft-delete (UPDATE, not DELETE) — so bulk-soft-delete the items explicitly first.
        mealItemRepository.softDeleteByMealId(meal.getId());
        repository.delete(meal); // @SQLDelete -> is_deleted = true
    }

    /** Thin delegation so the controller depends on {@code MealService} only (cf. recipe slice). */
    @Transactional(readOnly = true)
    public FuelDayResponse getDay(UUID userId, LocalDate date) {
        return fuelDayService.getDay(userId, date);
    }

    /**
     * Header fields, with the server-side date write-path: {@code logged_at} defaults to now when
     * the request omits it, and {@code meal_date} is always derived from {@code logged_at}'s date
     * part (cf. CheckInService's server-side date handling). Both stored in UTC.
     */
    private void applyHeader(MealEntity meal, MealRequest req) {
        OffsetDateTime loggedAt = req.getLoggedAt() == null
            ? OffsetDateTime.now(ZoneOffset.UTC) : req.getLoggedAt();
        meal.setLoggedAt(loggedAt.toInstant());
        meal.setMealDate(loggedAt.toLocalDate());
        meal.setSlot(req.getSlot());
        meal.setTitle(req.getTitle());
        // breakdown stays NULL (Phase-3 score envelope).
    }

    /** Full-replace the item collection from the request, in array order. */
    private void rebuildItems(UUID userId, MealEntity meal, List<MealItemRequest> itemReqs) {
        meal.getItems().clear(); // orphanRemoval deletes any previously attached items
        for (int i = 0; i < itemReqs.size(); i++) {
            meal.getItems().add(buildItem(userId, meal, itemReqs.get(i), i));
        }
    }

    /**
     * Branch by {@code source}: recipe-arm snapshots the recipe's per-serving macros (whole rollup
     * ÷ servings, basis "adag", per 1); pantry-arm snapshots the live PantryItem per-basis (exactly
     * like {@code recipe_ingredient}). Missing/foreign/deleted source -> 400 on "items".
     */
    private MealItemEntity buildItem(UUID userId, MealEntity meal, MealItemRequest req, int index) {
        MealItemEntity item = new MealItemEntity();
        item.setCreatedBy(userId); // owned child — server-side, never from the client
        item.setMeal(meal); // bidirectional back-ref REQUIRED (proven in mezo-lns)
        item.setLineOrder(index);
        item.setSource(req.getSource());
        item.setAmount(req.getAmount());
        item.setUnit(req.getUnit());

        if ("recipe".equals(req.getSource())) {
            RecipeEntity recipe = resolveRecipe(userId, req.getRecipeId());
            item.setRecipeId(recipe.getId());
            RecipeMacros whole = recipeMapper.toResponse(recipe).getMacros(); // reuse the recipe rollup
            BigDecimal servings = BigDecimal.valueOf(
                recipe.getServings() == null || recipe.getServings() < 1 ? 1 : recipe.getServings());
            item.setSnapshotName(recipe.getName());
            item.setSnapshotPer(BigDecimal.ONE);     // 1 adag basis
            item.setSnapshotBasisUnit("adag");
            item.setSnapshotKcal(perServing(whole.getKcal(), servings));
            item.setSnapshotProteinG(perServing(whole.getP(), servings));
            item.setSnapshotCarbsG(perServing(whole.getC(), servings));
            item.setSnapshotFatG(perServing(whole.getF(), servings));
            item.setSnapshotNova(recipe.getNovaDominant());
        } else if ("pantry".equals(req.getSource())) {
            PantryItemEntity p = resolvePantry(userId, req.getPantryItemId());
            item.setPantryItemId(p.getId());
            item.setSnapshotName(p.getName());
            item.setSnapshotPer(orDefault(p.getServingAmount(), BigDecimal.ONE));
            item.setSnapshotBasisUnit(p.getServingUnit() == null ? "unit" : p.getServingUnit());
            item.setSnapshotKcal(orDefault(p.getKcal(), BigDecimal.ZERO));
            item.setSnapshotProteinG(orDefault(p.getProteinG(), BigDecimal.ZERO));
            item.setSnapshotCarbsG(orDefault(p.getCarbsG(), BigDecimal.ZERO));
            item.setSnapshotFatG(orDefault(p.getFatG(), BigDecimal.ZERO));
            item.setSnapshotNova(p.getNova());
        } else {
            throw invalidItems(); // unknown source — the contract pattern should have caught it
        }
        return item;
    }

    /** Owner-scoped, not-deleted recipe lookup; missing/foreign/deleted are indistinguishable 400s. */
    private RecipeEntity resolveRecipe(UUID userId, UUID recipeId) {
        if (recipeId == null) {
            throw invalidItems();
        }
        return recipeRepository.findByIdAndCreatedByAndDeletedFalse(recipeId, userId)
            .orElseThrow(this::invalidItems);
    }

    /** Owner-scoped, not-deleted pantry-item lookup; missing/foreign/deleted are indistinguishable 400s. */
    private PantryItemEntity resolvePantry(UUID userId, UUID pantryItemId) {
        if (pantryItemId == null) {
            throw invalidItems();
        }
        return pantryItemRepository.findByIdAndCreatedByAndDeletedFalse(pantryItemId, userId)
            .orElseThrow(this::invalidItems);
    }

    /** Ownership gate: missing and foreign rows are indistinguishable (404). */
    private MealEntity requireOwned(UUID userId, UUID id) {
        return repository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    private SystemRuntimeErrorException invalidItems() {
        return new SystemRuntimeErrorException(
            SystemMessage.field("VALIDATION_INVALID_VALUE", "items").build(), HttpStatus.BAD_REQUEST);
    }

    /** per-serving snapshot = whole-recipe macro ÷ servings, whole-number HALF_UP. */
    private static BigDecimal perServing(BigDecimal whole, BigDecimal servings) {
        BigDecimal v = whole == null ? BigDecimal.ZERO : whole;
        return v.divide(servings, 0, RoundingMode.HALF_UP);
    }

    private static BigDecimal orDefault(BigDecimal value, BigDecimal fallback) {
        return value == null ? fallback : value;
    }
}

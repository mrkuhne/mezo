package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.RecipeLogResponse;
import io.mrkuhne.mezo.api.dto.RecipeMacros;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.mapper.MealMapper;
import io.mrkuhne.mezo.feature.meal.repository.MealItemRepository;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService.ScoredLine;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
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
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
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
 * <p>{@code score} + {@code breakdown} (the meal score envelope) are computed at write by the
 * deterministic {@link MealScoringService} (mezo-yta) — pre-scoring rows stay NULL (FE sparkle).
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
    private final MealScoringService scoringService;

    @Transactional
    public MealResponse create(UUID userId, MealRequest req) {
        MealEntity meal = new MealEntity();
        meal.setCreatedBy(userId); // server-side ownership — never from the client
        OffsetDateTime loggedAt = applyHeader(meal, req);
        rebuildItems(userId, meal, req.getItems());
        applyScore(userId, meal, loggedAt);
        return mapper.toResponse(repository.save(meal)); // cascade=ALL persists the items
    }

    @Transactional
    public void update(UUID userId, UUID id, MealRequest req) {
        MealEntity meal = requireOwned(userId, id);
        OffsetDateTime loggedAt = applyHeader(meal, req);
        rebuildItems(userId, meal, req.getItems()); // dirty-checked; flush on tx commit
        applyScore(userId, meal, loggedAt); // re-scored like the snapshots are re-captured
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
    public FuelDayResponse getDay(UUID userId, LocalDate date) {
        return fuelDayService.getDay(userId, date);
    }

    /**
     * Cross-feature read for {@code GET /api/recipe/{id}/logs}: the recipe's logged meal-items,
     * newest meal first, each projected to its per-line contribution (snapshot × amount/snapshotPer,
     * whole-number HALF_UP — the same formula as the meal/recipe mapper).
     */
    // Annotated by exception: walks item.getMeal() (LAZY) with open-in-view false (spring_patterns.md).
    @Transactional(readOnly = true)
    public List<RecipeLogResponse> recipeLogs(UUID userId, UUID recipeId) {
        return mealItemRepository
            .findByRecipeIdAndCreatedByAndDeletedFalseOrderByMeal_LoggedAtDesc(recipeId, userId).stream()
            .map(item -> {
                BigDecimal per = item.getSnapshotPer() == null || item.getSnapshotPer().signum() == 0
                    ? BigDecimal.ONE : item.getSnapshotPer();
                BigDecimal factor = item.getAmount().divide(per, 6, RoundingMode.HALF_UP);
                return RecipeLogResponse.builder()
                    .mealId(item.getMeal().getId())
                    .slot(item.getMeal().getSlot())
                    .score(item.getMeal().getScore()) // null for pre-scoring rows (FE sparkle)
                    .loggedAt(item.getMeal().getLoggedAt().atOffset(ZoneOffset.UTC))
                    .kcal(scaled(item.getSnapshotKcal(), factor))
                    .p(scaled(item.getSnapshotProteinG(), factor))
                    .c(scaled(item.getSnapshotCarbsG(), factor))
                    .f(scaled(item.getSnapshotFatG(), factor))
                    .build();
            })
            .toList();
    }

    /** Per-line contribution scalar: snapshot × factor, whole-number HALF_UP (cf. RecipeMapper). */
    private static BigDecimal scaled(BigDecimal base, BigDecimal factor) {
        BigDecimal v = base == null ? BigDecimal.ZERO : base;
        return v.multiply(factor).setScale(0, RoundingMode.HALF_UP);
    }

    /**
     * Header fields, with the server-side date write-path: {@code logged_at} defaults to now when
     * the request omits it, and {@code meal_date} is always derived from {@code logged_at}'s date
     * part (cf. CheckInService's server-side date handling). Both stored in UTC.
     *
     * @return the offset-bearing request instant — its LOCAL wall-clock time feeds the scoring
     *     context (timing fit), which the UTC-converted {@code Instant} could not reproduce.
     */
    private OffsetDateTime applyHeader(MealEntity meal, MealRequest req) {
        OffsetDateTime loggedAt = req.getLoggedAt() == null
            ? OffsetDateTime.now(ZoneOffset.UTC) : req.getLoggedAt();
        meal.setLoggedAt(loggedAt.toInstant());
        meal.setMealDate(loggedAt.toLocalDate());
        meal.setSlot(req.getSlot());
        meal.setTitle(req.getTitle());
        return loggedAt;
    }

    /**
     * Deterministic score at write (mezo-yta, ADR 0006): builds one {@link ScoredLine} per item —
     * contribution via the SAME amount/snapshotPer formula as the mapper, nutrition-quality facts
     * resolved from the LIVE sources (the envelope freezes them: it is the micro snapshot) — and
     * sets {@code score} + {@code breakdown} atomically.
     */
    private void applyScore(UUID userId, MealEntity meal, OffsetDateTime loggedAt) {
        List<ScoredLine> lines = meal.getItems().stream()
            .map(item -> toScoredLine(userId, item))
            .toList();
        MealBreakdownJson breakdown =
            scoringService.scoreMeal(meal.getSlot(), lines, loggedAt.toLocalTime());
        meal.setBreakdown(breakdown);
        meal.setScore(breakdown.value());
    }

    private ScoredLine toScoredLine(UUID userId, MealItemEntity item) {
        BigDecimal per = item.getSnapshotPer() == null || item.getSnapshotPer().signum() == 0
            ? BigDecimal.ONE : item.getSnapshotPer();
        BigDecimal factor = item.getAmount().divide(per, 6, RoundingMode.HALF_UP);
        Facts facts = "pantry".equals(item.getSource())
            ? pantryFacts(userId, item.getPantryItemId(), factor)
            : recipeFacts(userId, item.getRecipeId(), item.getAmount());
        String amountLabel = item.getAmount().stripTrailingZeros().toPlainString() + item.getUnit();
        return new ScoredLine(
            item.getSnapshotName(), amountLabel,
            scaled(item.getSnapshotKcal(), factor), scaled(item.getSnapshotProteinG(), factor),
            scaled(item.getSnapshotCarbsG(), factor), scaled(item.getSnapshotFatG(), factor),
            item.getSnapshotNova(),
            facts.fiber(), facts.sugar(), facts.salt(), facts.satFat(), facts.present());
    }

    /** Nutrition-quality facts of one line, already scaled to the logged amount. */
    private record Facts(BigDecimal fiber, BigDecimal sugar, BigDecimal salt, BigDecimal satFat,
                         boolean present) {

        static final Facts NONE = new Facts(null, null, null, null, false);
    }

    /** Pantry arm: the live item's per-basis facts × the line factor (missing/deleted → none). */
    private Facts pantryFacts(UUID userId, UUID pantryItemId, BigDecimal factor) {
        return pantryItemRepository.findByIdAndCreatedByAndDeletedFalse(pantryItemId, userId)
            .map(p -> {
                if (p.getFiberG() == null && p.getSugarG() == null && p.getSaltG() == null
                    && p.getSaturatedFatG() == null) {
                    return Facts.NONE;
                }
                return new Facts(scaleFact(p.getFiberG(), factor), scaleFact(p.getSugarG(), factor),
                    scaleFact(p.getSaltG(), factor), scaleFact(p.getSaturatedFatG(), factor), true);
            })
            .orElse(Facts.NONE);
    }

    /**
     * Recipe arm: Σ over the recipe's ingredient lines against their LIVE pantry rows
     * (fact × lineAmount/liveServing), ÷ recipe servings × logged adag. Ingredients whose pantry
     * row is gone or fact-less simply don't contribute — coverage stays honest.
     */
    private Facts recipeFacts(UUID userId, UUID recipeId, BigDecimal servingsLogged) {
        RecipeEntity recipe = recipeRepository
            .findByIdAndCreatedByAndDeletedFalse(recipeId, userId).orElse(null);
        if (recipe == null || recipe.getLines().isEmpty()) {
            return Facts.NONE;
        }
        // ids come from the OWNED recipe's lines; @SQLRestriction filters soft-deleted rows
        Map<UUID, PantryItemEntity> byId = pantryItemRepository
            .findAllById(recipe.getLines().stream()
                .map(RecipeIngredientEntity::getPantryItemId).toList())
            .stream().collect(Collectors.toMap(PantryItemEntity::getId, Function.identity()));
        BigDecimal fiber = BigDecimal.ZERO;
        BigDecimal sugar = BigDecimal.ZERO;
        BigDecimal salt = BigDecimal.ZERO;
        BigDecimal satFat = BigDecimal.ZERO;
        boolean any = false;
        for (RecipeIngredientEntity line : recipe.getLines()) {
            PantryItemEntity p = byId.get(line.getPantryItemId());
            if (p == null || (p.getFiberG() == null && p.getSugarG() == null && p.getSaltG() == null
                && p.getSaturatedFatG() == null)) {
                continue;
            }
            any = true;
            BigDecimal livePer = orDefault(p.getServingAmount(), BigDecimal.ONE);
            BigDecimal factor = line.getAmount().divide(
                livePer.signum() == 0 ? BigDecimal.ONE : livePer, 6, RoundingMode.HALF_UP);
            fiber = addFact(fiber, p.getFiberG(), factor);
            sugar = addFact(sugar, p.getSugarG(), factor);
            salt = addFact(salt, p.getSaltG(), factor);
            satFat = addFact(satFat, p.getSaturatedFatG(), factor);
        }
        if (!any) {
            return Facts.NONE;
        }
        BigDecimal servings = BigDecimal.valueOf(
            recipe.getServings() == null || recipe.getServings() < 1 ? 1 : recipe.getServings());
        BigDecimal mult = servingsLogged.divide(servings, 6, RoundingMode.HALF_UP);
        return new Facts(fiber.multiply(mult), sugar.multiply(mult), salt.multiply(mult),
            satFat.multiply(mult), true);
    }

    private static BigDecimal scaleFact(BigDecimal v, BigDecimal factor) {
        return v == null ? null : v.multiply(factor);
    }

    private static BigDecimal addFact(BigDecimal acc, BigDecimal v, BigDecimal factor) {
        return v == null ? acc : acc.add(v.multiply(factor));
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

    /**
     * per-serving snapshot = whole-recipe macro ÷ servings, kept at FULL PRECISION (scale 6, mirroring
     * the contribution {@code factor} scale). Rounding happens exactly once downstream at the
     * contribution boundary ({@link #scaled}) — rounding here too would double-round the recipe arm
     * (e.g. 297÷2=148.5→149, ×2→298 instead of the correct 297), diverging from the FE single-round
     * and the already-exact pantry arm (mezo-8xy). The {@code snapshot_kcal} column is bare numeric, so
     * the fractional value persists losslessly.
     */
    private static BigDecimal perServing(BigDecimal whole, BigDecimal servings) {
        BigDecimal v = whole == null ? BigDecimal.ZERO : whole;
        return v.divide(servings, 6, RoundingMode.HALF_UP);
    }

    private static BigDecimal orDefault(BigDecimal value, BigDecimal fallback) {
        return value == null ? fallback : value;
    }
}

package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MealIngredientOverrideRequest;
import io.mrkuhne.mezo.api.dto.MealItemRequest;
import io.mrkuhne.mezo.api.dto.MealProvenance;
import io.mrkuhne.mezo.api.dto.MealRequest;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.Nutrients;
import io.mrkuhne.mezo.api.dto.RecipeLogResponse;
import io.mrkuhne.mezo.api.dto.RecipeMacros;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemRecipeOverrideJson;
import io.mrkuhne.mezo.feature.meal.entity.MealProvenanceJson;
import io.mrkuhne.mezo.feature.meal.mapper.MealMapper;
import io.mrkuhne.mezo.feature.meal.repository.MealItemRepository;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.service.DailyTargets;
import io.mrkuhne.mezo.feature.nutrition.service.MealRole;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
    private final io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService workoutWindowQueryService;
    private final io.mrkuhne.mezo.feature.nutrition.config.MealScoringProperties scoringProperties;

    @Transactional
    public MealResponse create(UUID userId, MealRequest req) {
        MealEntity meal = new MealEntity();
        meal.setCreatedBy(userId); // server-side ownership — never from the client
        OffsetDateTime loggedAt = applyHeader(meal, req);
        meal.setProvenance(toProvenance(req.getProvenance())); // AI confirm path; NULL for manual rows
        rebuildItems(userId, meal, req.getItems());
        applyScore(userId, meal, loggedAt);
        return mapper.toResponse(repository.save(meal)); // cascade=ALL persists the items
    }

    @Transactional
    public void update(UUID userId, UUID id, MealRequest req) {
        MealEntity meal = requireOwned(userId, id);
        OffsetDateTime loggedAt = applyHeader(meal, req);
        meal.setProvenance(toProvenance(req.getProvenance())); // re-captured like the snapshots
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
     * from the item's OWN FROZEN snapshot (mezo-m6uv), scaled by that same factor — and sets
     * {@code score} + {@code breakdown} atomically. There is now exactly ONE route to those four
     * numbers: the write-time freeze. NOVA is likewise frozen; only {@code category} (plant
     * diversity) is still read live off the pantry row.
     *
     * <p>The rubric's macro targets are the goal-aware {@link DailyTargets} (mezo-3g5w): the
     * active goal's prescribed day when one covers {@code meal.mealDate}, else the config
     * fallback — the SAME resolution the FuelDay MacroHero reads, so the score and the hero never
     * judge the day against different numbers.
     */
    private void applyScore(UUID userId, MealEntity meal, OffsetDateTime loggedAt) {
        List<ScoredLine> lines = meal.getItems().stream()
            .map(item -> toScoredLine(userId, item))
            .toList();
        List<MealScoringService.WorkoutWindow> windows = workoutWindowQueryService
            .windowsFor(userId, meal.getMealDate()).stream()
            .map(w -> new MealScoringService.WorkoutWindow(w.start(), w.end(), w.done()))
            .toList();
        MealRole role = MealScoringService.classifyRole(loggedAt.toLocalTime(), windows,
            scoringProperties.preLeadMin(), scoringProperties.postTrailMin());
        DailyTargets base = fuelDayService.dailyTargets(userId, meal.getMealDate());
        MealBreakdownJson breakdown =
            scoringService.scoreMeal(meal.getSlot(), lines, loggedAt.toLocalTime(), role, base);
        meal.setBreakdown(breakdown);
        meal.setScore(breakdown.value());
    }

    private ScoredLine toScoredLine(UUID userId, MealItemEntity item) {
        BigDecimal per = item.getSnapshotPer() == null || item.getSnapshotPer().signum() == 0
            ? BigDecimal.ONE : item.getSnapshotPer();
        BigDecimal factor = item.getAmount().divide(per, 6, RoundingMode.HALF_UP);
        // Frozen facts (mezo-m6uv): the item's OWN snapshot, scaled by the same factor as the
        // macros. A pantry row that drifted after the log can no longer rewrite this meal's score.
        boolean hasFacts = item.getSnapshotFiberG() != null || item.getSnapshotSugarG() != null
            || item.getSnapshotSaltG() != null || item.getSnapshotSaturatedFatG() != null;
        // `category` is a plant-diversity input, not a nutrition fact — it stays a live pantry read
        // (freezing it belongs with the NOVA sibling, mezo-4tzf). A recipe line is a composite:
        // honest null, exactly as before.
        String category = "pantry".equals(item.getSource())
            ? pantryCategory(userId, item.getPantryItemId()) : null;
        String amountLabel = item.getAmount().stripTrailingZeros().toPlainString() + item.getUnit();
        return new ScoredLine(
            item.getSnapshotName(), amountLabel,
            scaled(item.getSnapshotKcal(), factor), scaled(item.getSnapshotProteinG(), factor),
            scaled(item.getSnapshotCarbsG(), factor), scaled(item.getSnapshotFatG(), factor),
            item.getSnapshotNova(),
            scaleFact(item.getSnapshotFiberG(), factor), scaleFact(item.getSnapshotSugarG(), factor),
            scaleFact(item.getSnapshotSaltG(), factor),
            scaleFact(item.getSnapshotSaturatedFatG(), factor),
            hasFacts, category, gramAmount(item.getAmount(), item.getUnit()));
    }

    /** The live pantry category of a pantry-arm line (plant-diversity input); null when the row is gone. */
    private String pantryCategory(UUID userId, UUID pantryItemId) {
        return pantryItemRepository.findByIdAndCreatedByAndDeletedFalse(pantryItemId, userId)
            .map(PantryItemEntity::getCategory)
            .orElse(null);
    }

    /** Line amount in grams for mass units (ml≈g); null for discrete units (db etc.). */
    private static BigDecimal gramAmount(BigDecimal amount, String unit) {
        if (amount == null || unit == null) {
            return null;
        }
        return switch (unit.trim().toLowerCase()) {
            case "g", "ml" -> amount;
            case "kg", "l" -> amount.multiply(BigDecimal.valueOf(1000));
            default -> null;
        };
    }

    private static BigDecimal scaleFact(BigDecimal v, BigDecimal factor) {
        return v == null ? null : v.multiply(factor);
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

        // ingredientOverrides is a recipe-arm concept only — never silently ignored on another arm
        if (!"recipe".equals(req.getSource())
            && req.getIngredientOverrides() != null && !req.getIngredientOverrides().isEmpty()) {
            throw invalidItems();
        }

        if ("recipe".equals(req.getSource())) {
            RecipeEntity recipe = resolveRecipe(userId, req.getRecipeId());
            item.setRecipeId(recipe.getId());
            Map<Integer, BigDecimal> overrides = resolveOverrides(recipe, req);
            item.setRecipeOverrides(toOverrideEnvelope(recipe, overrides));
            // the frozen snapshot is computed from the OVERRIDDEN set; an empty map reproduces the
            // stored rollup exactly, so an un-overridden log stays bit-identical
            RecipeMacros whole = recipeMapper.rollupWithOverrides(recipe, overrides);
            BigDecimal servings = BigDecimal.valueOf(
                recipe.getServings() == null || recipe.getServings() < 1 ? 1 : recipe.getServings());
            item.setSnapshotName(recipe.getName());
            item.setSnapshotPer(BigDecimal.ONE);     // 1 adag basis
            item.setSnapshotBasisUnit("adag");
            item.setSnapshotKcal(perServing(whole.getKcal(), servings));
            item.setSnapshotProteinG(perServing(whole.getP(), servings));
            item.setSnapshotCarbsG(perServing(whole.getC(), servings));
            item.setSnapshotFatG(perServing(whole.getF(), servings));
            // The nutrient facts follow the SAME frozen-from-the-overridden-set rule as the macros
            // (mezo-m6uv): an empty override map reproduces the stored rollup exactly.
            Nutrients wholeNutrients = recipeMapper.rollupNutrientsWithOverrides(recipe, overrides);
            item.setSnapshotFiberG(perServingGram(wholeNutrients.getFiberG(), servings));
            item.setSnapshotSugarG(perServingGram(wholeNutrients.getSugarG(), servings));
            item.setSnapshotSaltG(perServingGram(wholeNutrients.getSaltG(), servings));
            item.setSnapshotSaturatedFatG(perServingGram(wholeNutrients.getSaturatedFatG(), servings));
            // Only a line dropped to 0 changes WHICH ingredients went in, so only then can the
            // dominant NOVA move. A non-zero amount change leaves the ingredient set — and with it
            // the recipe's frozen novaDominant — intact; recomputing there would swap a frozen value
            // for a live pantry read on an unrelated edit, and a since-deleted pantry row would
            // silently lower the meal's NOVA. Fully freezing this needs recipe_ingredient.snapshot_nova.
            boolean anyLineDropped = overrides.values().stream().anyMatch(a -> a.signum() == 0);
            item.setSnapshotNova(anyLineDropped
                ? dominantNova(recipe, overrides) : recipe.getNovaDominant());
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
            item.setSnapshotFiberG(p.getFiberG());
            item.setSnapshotSugarG(p.getSugarG());
            item.setSnapshotSaltG(p.getSaltG());
            item.setSnapshotSaturatedFatG(p.getSaturatedFatG());
            item.setSnapshotNova(p.getNova());
        } else if ("estimate".equals(req.getSource())) {
            // AI/manual estimate arm: NO recipe/pantry FK — the request carries its own verbatim
            // per-basis snapshot (name + basis + full macro set), persisted as-is (no live source).
            if (req.getRecipeId() != null || req.getPantryItemId() != null) {
                throw invalidItems();
            }
            if (req.getName() == null || req.getName().isBlank()
                || req.getPer() == null || req.getPer().signum() <= 0
                || req.getBasisUnit() == null || req.getBasisUnit().isBlank()
                || req.getKcal() == null || req.getProteinG() == null
                || req.getCarbsG() == null || req.getFatG() == null) {
                throw invalidItems();
            }
            item.setSnapshotName(req.getName());
            item.setSnapshotPer(req.getPer());
            item.setSnapshotBasisUnit(req.getBasisUnit());
            item.setSnapshotKcal(req.getKcal());
            item.setSnapshotProteinG(req.getProteinG());
            item.setSnapshotCarbsG(req.getCarbsG());
            item.setSnapshotFatG(req.getFatG());
            item.setSnapshotNova(req.getNova() == null ? null : req.getNova().shortValue());
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

    /**
     * Request overrides → {@code lineOrder → amount}, fully validated (mezo-ormb). {@code lineOrder}
     * is the key; {@code pantryItemId} is a CONSISTENCY CHECK — {@code recipe_ingredient} has no
     * unique {@code (recipe_id, pantry_item_id)}, so a recipe may list the same item twice, and a
     * reorder between the client's read and this write would otherwise land on the wrong line.
     * Every anomaly is a 400 on "items"; nothing is silently skipped.
     */
    private Map<Integer, BigDecimal> resolveOverrides(RecipeEntity recipe, MealItemRequest req) {
        List<MealIngredientOverrideRequest> reqs = req.getIngredientOverrides();
        if (reqs == null || reqs.isEmpty()) {
            return Map.of();
        }
        Map<Integer, RecipeIngredientEntity> byOrder = recipe.getLines().stream()
            .collect(Collectors.toMap(RecipeIngredientEntity::getLineOrder, Function.identity()));
        Map<Integer, BigDecimal> resolved = new LinkedHashMap<>();
        for (MealIngredientOverrideRequest o : reqs) {
            // a null ELEMENT slips past @Valid (the cascade validates non-null elements only) —
            // without this guard it would NPE into a 500 instead of the contract's 400
            if (o == null || o.getLineOrder() == null || o.getAmount() == null
                || o.getAmount().signum() < 0) {
                throw invalidItems();
            }
            RecipeIngredientEntity line = byOrder.get(o.getLineOrder());
            if (line == null || !line.getPantryItemId().equals(o.getPantryItemId())) {
                throw invalidItems(); // unknown line, or a different ingredient sits there now
            }
            if (resolved.put(o.getLineOrder(), o.getAmount()) != null) {
                throw invalidItems(); // the same line overridden twice
            }
        }
        return resolved;
    }

    /**
     * The persisted envelope: ONLY the changed lines, self-describing (snapshot name + unit +
     * the recipe's original amount) so the log renders without resolving the live recipe.
     * Empty → NULL, never {@code []}, so an un-overridden row keeps its exact current shape.
     */
    private static List<MealItemRecipeOverrideJson> toOverrideEnvelope(
            RecipeEntity recipe, Map<Integer, BigDecimal> overrides) {
        if (overrides.isEmpty()) {
            return null;
        }
        return recipe.getLines().stream()
            .filter(l -> overrides.containsKey(l.getLineOrder()))
            .map(l -> new MealItemRecipeOverrideJson(l.getLineOrder(), l.getPantryItemId(),
                l.getSnapshotName(), l.getUnit(), l.getAmount(), overrides.get(l.getLineOrder())))
            .toList();
    }

    /**
     * Dominant NOVA over the lines that ACTUALLY went in (effective amount &gt; 0), read from the live
     * pantry rows. The recipe's stored {@code novaDominant} would still claim a zeroed-out
     * highest-NOVA ingredient, freezing a NOVA the meal never contained.
     */
    private Short dominantNova(RecipeEntity recipe, Map<Integer, BigDecimal> overrides) {
        // ids come from the OWNED recipe's lines; @SQLRestriction filters soft-deleted rows
        List<UUID> ids = recipe.getLines().stream()
            .filter(l -> overrides.getOrDefault(l.getLineOrder(), l.getAmount()).signum() > 0)
            .map(RecipeIngredientEntity::getPantryItemId)
            .toList();
        if (ids.isEmpty()) {
            return null;
        }
        return pantryItemRepository.findAllById(ids).stream()
            .map(PantryItemEntity::getNova)
            .filter(Objects::nonNull)
            .max(Short::compareTo)
            .orElse(null);
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

    /** Request provenance dto → typed jsonb envelope; absent provenance stays NULL (manual/legacy row). */
    private static MealProvenanceJson toProvenance(MealProvenance dto) {
        if (dto == null) {
            return null;
        }
        return new MealProvenanceJson(dto.getOrigin(), dto.getModel(), dto.getConfidence(), dto.getRawText());
    }

    /**
     * per-serving snapshot = whole-recipe macro ÷ servings, kept at FULL PRECISION (scale 6, mirroring
     * the contribution {@code factor} scale). Rounding happens exactly once downstream at the
     * contribution boundary ({@link #scaled}) — rounding here too would double-round the recipe arm
     * (e.g. 297÷2=148.5→149, ×2→298 instead of the correct 297), diverging from the FE single-round
     * and the already-exact pantry arm (mezo-8xy). The {@code snapshot_kcal} column is bare numeric, so
     * the fractional value persists losslessly.
     */
    // Package-private so MealAiDraftService's recipe arm reuses the exact per-serving rollup (mezo-78rn).
    static BigDecimal perServing(BigDecimal whole, BigDecimal servings) {
        BigDecimal v = whole == null ? BigDecimal.ZERO : whole;
        return v.divide(servings, 6, RoundingMode.HALF_UP);
    }

    /**
     * Per-serving grams at THREE decimals — the nutrient sibling of {@link #perServing}. Three, not
     * one: the whole-recipe rollup this divides is already a per-line rounded sum
     * ({@code RecipeMapper.scaledGram}), so a second 1-decimal quantum here would compound the first
     * (a 20 g line of a 0.4 g/100 g source in a 2-serving recipe is truly 0.04 g/adag, which double
     * 1-decimal rounding inflates to 0.1 g — 2.5×, and it is salt, the number this feature exists to
     * show). Grams are stored and summed at three decimals; rounding to one decimal is a DISPLAY
     * concern the frontend formatter owns. Matches the migrations' {@code round(…, 3)} backfill.
     * Null stays null so a fact-less recipe does not turn into a fake 0 g (mezo-m6uv).
     */
    private static BigDecimal perServingGram(BigDecimal whole, BigDecimal servings) {
        return whole == null ? null : whole.divide(servings, 3, RoundingMode.HALF_UP);
    }

    private static BigDecimal orDefault(BigDecimal value, BigDecimal fallback) {
        return value == null ? fallback : value;
    }
}

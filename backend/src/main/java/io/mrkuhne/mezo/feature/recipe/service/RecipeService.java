package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
import io.mrkuhne.mezo.api.dto.RecipeListResponse;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService.ScoredLine;
import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapper;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeIngredientRepository;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;
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

@Service
@RequiredArgsConstructor
public class RecipeService {

    private final RecipeRepository repository;
    private final PantryItemRepository pantryItemRepository;
    private final RecipeMapper mapper;
    private final RecipeIngredientRepository recipeIngredientRepository;
    private final MealScoringService scoringService;

    @Transactional
    public RecipeResponse create(UUID userId, RecipeRequest req) {
        RecipeEntity recipe = new RecipeEntity();
        recipe.setCreatedBy(userId); // server-side ownership — never from the client
        mapper.applyScalars(recipe, req);
        rebuildLines(userId, recipe, req.getIngredients());
        RecipeEntity saved = repository.save(recipe); // cascade=ALL persists the lines
        return withFit(saved, mapper.toResponse(saved), pantryByIdFor(List.of(saved)));
    }

    // Reads stay annotated by exception: the mapper walks the recipe's LAZY lines and
    // open-in-view is false, so an open session is required (spring_patterns.md).
    @Transactional(readOnly = true)
    public RecipeResponse get(UUID userId, UUID id) {
        RecipeEntity recipe = requireOwned(userId, id);
        return withFit(recipe, mapper.toResponse(recipe), pantryByIdFor(List.of(recipe)));
    }

    @Transactional(readOnly = true)
    public RecipeListResponse list(UUID userId) {
        List<RecipeEntity> entities =
            repository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId);
        Map<UUID, PantryItemEntity> pantryById = pantryByIdFor(entities); // ONE batch fetch
        List<RecipeResponse> recipes = entities.stream()
            .map(e -> withFit(e, mapper.toResponse(e), pantryById))
            .toList();
        return RecipeListResponse.builder().recipes(recipes).build();
    }

    /**
     * Deterministic mezo-fit at READ time (mezo-yta, spec §2 D5): computed fresh on every read so
     * ALL recipes light up retroactively and a pantry edit is reflected immediately — nothing is
     * persisted ({@code recipe.fit_score} stays reserved for the P8 calibrated fit). Per-serving
     * profile scored on macro+micro+NOVA (no logged time/slot → no context dimension).
     */
    private RecipeResponse withFit(RecipeEntity e, RecipeResponse resp,
                                   Map<UUID, PantryItemEntity> pantryById) {
        resp.getMezoFit().setScore(scoringService.recipeFit(fitLines(e, pantryById)));
        return resp;
    }

    /** One batch pantry fetch for the fit pass; ids come from OWNED recipes' lines.
     *  Package-private since mezo-bw3y: RecipeBreakdownService reuses the exact fit inputs. */
    Map<UUID, PantryItemEntity> pantryByIdFor(Collection<RecipeEntity> recipes) {
        List<UUID> ids = recipes.stream()
            .flatMap(r -> r.getLines().stream().map(RecipeIngredientEntity::getPantryItemId))
            .distinct()
            .toList();
        return ids.isEmpty() ? Map.of() : pantryItemRepository.findAllById(ids).stream()
            .collect(Collectors.toMap(PantryItemEntity::getId, Function.identity()));
    }

    /**
     * Per-serving {@link ScoredLine}s: macros from the frozen line snapshots (÷ servings, same
     * formula as the mapper's contribution), NOVA + nutrition-quality facts from the LIVE pantry
     * rows (a gone/fact-less source just lowers coverage — honest degrade, never fabricated).
     * Package-private since mezo-bw3y: RecipeBreakdownService scores the same lines.
     */
    List<ScoredLine> fitLines(RecipeEntity e, Map<UUID, PantryItemEntity> pantryById) {
        BigDecimal servings = BigDecimal.valueOf(
            e.getServings() == null || e.getServings() < 1 ? 1 : e.getServings());
        return e.getLines().stream().map(line -> {
            BigDecimal per = line.getSnapshotPer() == null || line.getSnapshotPer().signum() == 0
                ? BigDecimal.ONE : line.getSnapshotPer();
            BigDecimal factor = line.getAmount()
                .divide(per, 6, RoundingMode.HALF_UP)
                .divide(servings, 6, RoundingMode.HALF_UP);
            PantryItemEntity p = pantryById.get(line.getPantryItemId());
            boolean hasFacts = p != null && (p.getFiberG() != null || p.getSugarG() != null
                || p.getSaltG() != null || p.getSaturatedFatG() != null);
            BigDecimal factFactor = p == null ? BigDecimal.ZERO
                : line.getAmount().divide(
                    p.getServingAmount() == null || p.getServingAmount().signum() == 0
                        ? BigDecimal.ONE : p.getServingAmount(), 6, RoundingMode.HALF_UP)
                    .divide(servings, 6, RoundingMode.HALF_UP);
            return new ScoredLine(
                line.getSnapshotName(),
                line.getAmount().stripTrailingZeros().toPlainString() + line.getUnit(),
                mul(line.getSnapshotKcal(), factor), mul(line.getSnapshotProteinG(), factor),
                mul(line.getSnapshotCarbsG(), factor), mul(line.getSnapshotFatG(), factor),
                p == null ? null : p.getNova(),
                hasFacts ? mulOrNull(p.getFiberG(), factFactor) : null,
                hasFacts ? mulOrNull(p.getSugarG(), factFactor) : null,
                hasFacts ? mulOrNull(p.getSaltG(), factFactor) : null,
                hasFacts ? mulOrNull(p.getSaturatedFatG(), factFactor) : null,
                hasFacts);
        }).toList();
    }

    private static BigDecimal mul(BigDecimal v, BigDecimal factor) {
        return v == null ? BigDecimal.ZERO : v.multiply(factor);
    }

    private static BigDecimal mulOrNull(BigDecimal v, BigDecimal factor) {
        return v == null ? null : v.multiply(factor);
    }

    /**
     * Full-replace of the aggregate: the editor always sends the COMPLETE recipe (all header fields +
     * all lines), so we overwrite the header and rebuild the line collection (orphanRemoval deletes the
     * lines no longer present). This is INTENTIONAL full-replace, NOT the lossy partial-input bug
     * mezo-dh6 flags for Pantry. Snapshots are re-resolved against the live pantry on every save.
     */
    @Transactional
    public void update(UUID userId, UUID id, RecipeRequest req) {
        RecipeEntity recipe = requireOwned(userId, id);
        mapper.applyScalars(recipe, req);
        rebuildLines(userId, recipe, req.getIngredients()); // dirty-checked; flush on tx commit
        recipe.setBreakdown(null); // template-breakdown cache invalidated on edit (mezo-bw3y D5 —
        recipe.setFitsFor(null);   // catches renames the numeric staleness compare can't see)
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        RecipeEntity recipe = requireOwned(userId, id);
        // @SQLDelete soft-deletes the recipe, but does NOT cascade to @OneToMany children on a
        // soft-delete (UPDATE, not DELETE) — so bulk-soft-delete the lines explicitly.
        recipeIngredientRepository.softDeleteByRecipeId(recipe.getId());
        repository.delete(recipe); // @SQLDelete -> is_deleted = true
    }

    /**
     * Full-replace the line collection from the request, in array order. Each line resolves its
     * pantry item owner-scoped &amp; not-deleted (missing/foreign/deleted -> 400) and captures a
     * per-basis snapshot, then nova_dominant is re-derived from the live PantryItem NOVAs.
     */
    private void rebuildLines(UUID userId, RecipeEntity recipe, List<RecipeIngredientRequest> lineReqs) {
        recipe.getLines().clear(); // orphanRemoval deletes any previously attached lines
        for (int i = 0; i < lineReqs.size(); i++) {
            RecipeIngredientEntity line = buildLine(userId, recipe, lineReqs.get(i), i);
            recipe.getLines().add(line);
        }
        recipe.setNovaDominant(deriveNovaDominant(userId, lineReqs));
    }

    /** Resolves the pantry item owner-scoped, captures the per-basis snapshot, sets created_by + line_order. */
    private RecipeIngredientEntity buildLine(
            UUID userId, RecipeEntity recipe, RecipeIngredientRequest req, int index) {
        PantryItemEntity item = resolvePantryItem(userId, req.getPantryItemId());
        RecipeIngredientEntity line = new RecipeIngredientEntity();
        line.setCreatedBy(userId); // owned child — set server-side, never from the client
        line.setRecipe(recipe);
        line.setPantryItemId(item.getId());
        line.setAmount(req.getAmount());
        line.setUnit(req.getUnit());
        line.setNote(req.getNote());
        line.setLineOrder(index);
        // Snapshot = the pantry item's per-basis macros at compose time (stable basis for contribution).
        line.setSnapshotName(item.getName());
        line.setSnapshotPer(orDefault(item.getServingAmount(), BigDecimal.ONE));
        line.setSnapshotBasisUnit(item.getServingUnit() == null ? "unit" : item.getServingUnit());
        line.setSnapshotKcal(orDefault(item.getKcal(), BigDecimal.ZERO));
        line.setSnapshotProteinG(orDefault(item.getProteinG(), BigDecimal.ZERO));
        line.setSnapshotCarbsG(orDefault(item.getCarbsG(), BigDecimal.ZERO));
        line.setSnapshotFatG(orDefault(item.getFatG(), BigDecimal.ZERO));
        return line;
    }

    /** Owner-scoped, not-deleted lookup; missing/foreign/deleted are indistinguishable 400s. */
    private PantryItemEntity resolvePantryItem(UUID userId, UUID pantryItemId) {
        if (pantryItemId == null) {
            throw invalidIngredients();
        }
        return pantryItemRepository.findByIdAndCreatedByAndDeletedFalse(pantryItemId, userId)
            .orElseThrow(this::invalidIngredients);
    }

    /** Dominant NOVA = the max source NOVA across the resolved lines; null when no line carries one. */
    private Short deriveNovaDominant(UUID userId, List<RecipeIngredientRequest> lineReqs) {
        return lineReqs.stream()
            .map(l -> resolvePantryItem(userId, l.getPantryItemId()).getNova())
            .filter(Objects::nonNull)
            .max(Short::compareTo)
            .orElse(null);
    }

    private SystemRuntimeErrorException invalidIngredients() {
        return new SystemRuntimeErrorException(
            SystemMessage.field("VALIDATION_INVALID_VALUE", "ingredients").build(), HttpStatus.BAD_REQUEST);
    }

    private static BigDecimal orDefault(BigDecimal value, BigDecimal fallback) {
        return value == null ? fallback : value;
    }

    /** Ownership gate: missing and foreign rows are indistinguishable (404). */
    private RecipeEntity requireOwned(UUID userId, UUID id) {
        return repository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}

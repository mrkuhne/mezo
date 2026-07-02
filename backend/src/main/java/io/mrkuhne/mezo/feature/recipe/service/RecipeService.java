package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.api.dto.RecipeIngredientRequest;
import io.mrkuhne.mezo.api.dto.RecipeListResponse;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapper;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeIngredientRepository;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
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

    @Transactional
    public RecipeResponse create(UUID userId, RecipeRequest req) {
        RecipeEntity recipe = new RecipeEntity();
        recipe.setCreatedBy(userId); // server-side ownership — never from the client
        mapper.applyScalars(recipe, req);
        rebuildLines(userId, recipe, req.getIngredients());
        return mapper.toResponse(repository.save(recipe)); // cascade=ALL persists the lines
    }

    // Reads stay annotated by exception: the mapper walks the recipe's LAZY lines and
    // open-in-view is false, so an open session is required (spring_patterns.md).
    @Transactional(readOnly = true)
    public RecipeResponse get(UUID userId, UUID id) {
        return mapper.toResponse(requireOwned(userId, id));
    }

    @Transactional(readOnly = true)
    public RecipeListResponse list(UUID userId) {
        List<RecipeResponse> recipes = repository
            .findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId).stream()
            .map(mapper::toResponse)
            .toList();
        return RecipeListResponse.builder().recipes(recipes).build();
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

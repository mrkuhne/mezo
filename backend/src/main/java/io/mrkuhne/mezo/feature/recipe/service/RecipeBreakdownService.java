package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.api.dto.RecipeBreakdownResponse;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.mapper.BreakdownDtoMapper;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lazy cache-or-generate template breakdown (mezo-bw3y, spec D2/D5): the deterministic envelope is
 * recomputed on every read (cheap pure math); the persisted copy is served only while its numbers
 * still match the fresh run (pantry drift ⇒ regenerate; a recipe edit nulls the cache in
 * {@link RecipeService#update}). Only prose-enriched envelopes are persisted — a prose-less pass
 * (flag off / companion off / LLM failure) is returned unpersisted, so prose self-heals on a later
 * read once the LLM is available again.
 *
 * <p>One read-write transaction spans the whole call incl. the LLM roundtrip — the
 * {@code MealAiDraftService} precedent: single-user app, holding one pooled connection across the
 * LLM call is accepted; the lazy {@code recipe.lines} stay resolvable and the cache persist rides
 * dirty-checking at commit.
 */
@Service
@RequiredArgsConstructor
public class RecipeBreakdownService {

    private final RecipeRepository repository;
    private final RecipeService recipeService;
    private final MealScoringService scoringService;
    private final ObjectProvider<RecipeBreakdownProseService> prose;

    @Transactional
    public RecipeBreakdownResponse getOrGenerate(UUID userId, UUID id) {
        RecipeEntity recipe = repository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));

        MealBreakdownJson fresh = scoringService.recipeTemplateBreakdown(
            recipeService.fitLines(recipe, recipeService.pantryByIdFor(List.of(recipe))));
        if (fresh == null) { // no kcal — pending-sparkle territory, nothing to explain
            return response(null, List.of());
        }
        if (matches(recipe.getBreakdown(), fresh)) {
            return response(recipe.getBreakdown(),
                recipe.getFitsFor() == null ? List.of() : recipe.getFitsFor());
        }

        RecipeBreakdownProseService svc = prose.getIfAvailable();
        RecipeBreakdownProseService.Enriched enriched = svc == null ? null : svc.enrich(recipe, fresh);
        if (enriched == null) {
            return response(fresh, List.of()); // deterministic, unpersisted (spec D5/D6)
        }
        recipe.setBreakdown(enriched.envelope()); // dirty-checked; flush on tx commit
        recipe.setFitsFor(enriched.fitsFor());
        return response(enriched.envelope(), enriched.fitsFor());
    }

    /** Cache valid iff the persisted numbers equal the freshly computed ones (value + per-dim). */
    private boolean matches(MealBreakdownJson stored, MealBreakdownJson fresh) {
        if (stored == null || stored.value() == null || fresh.value() == null
            || stored.value().compareTo(fresh.value()) != 0
            || stored.dimensions() == null
            || stored.dimensions().size() != fresh.dimensions().size()) {
            return false;
        }
        for (int i = 0; i < fresh.dimensions().size(); i++) {
            MealBreakdownJson.Dimension s = stored.dimensions().get(i);
            MealBreakdownJson.Dimension f = fresh.dimensions().get(i);
            if (!Objects.equals(s.id(), f.id())
                || s.score() == null || s.weight() == null
                || s.score().compareTo(f.score()) != 0
                || s.weight().compareTo(f.weight()) != 0) {
                return false;
            }
        }
        return true;
    }

    private RecipeBreakdownResponse response(MealBreakdownJson envelope, List<String> fitsFor) {
        return RecipeBreakdownResponse.builder()
            .breakdown(envelope == null ? null : BreakdownDtoMapper.toDto(envelope))
            .fitsFor(fitsFor)
            .build();
    }
}

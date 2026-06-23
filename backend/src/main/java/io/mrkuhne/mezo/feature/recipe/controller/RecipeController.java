package io.mrkuhne.mezo.feature.recipe.controller;

import io.mrkuhne.mezo.api.controller.RecipeApi;
import io.mrkuhne.mezo.api.dto.RecipeListResponse;
import io.mrkuhne.mezo.api.dto.RecipeRequest;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.feature.recipe.service.RecipeService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated {@link RecipeApi}; mappings/status/validation come from the interface. */
@RestController
@RequiredArgsConstructor
public class RecipeController implements RecipeApi {

    private final RecipeService service;
    private final CurrentUserId currentUserId;

    @Override
    public RecipeListResponse listRecipes() {
        return service.list(currentUserId.get());
    }

    @Override
    public RecipeResponse getRecipe(UUID id) {
        return service.get(currentUserId.get(), id);
    }

    @Override
    public RecipeResponse createRecipe(RecipeRequest recipeRequest) {
        return service.create(currentUserId.get(), recipeRequest);
    }

    @Override
    public void updateRecipe(UUID id, RecipeRequest recipeRequest) {
        service.update(currentUserId.get(), id, recipeRequest);
    }

    @Override
    public void deleteRecipe(UUID id) {
        service.delete(currentUserId.get(), id);
    }
}

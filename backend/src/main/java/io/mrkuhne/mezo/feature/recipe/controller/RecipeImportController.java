package io.mrkuhne.mezo.feature.recipe.controller;

import io.mrkuhne.mezo.api.controller.RecipeImportApi;
import io.mrkuhne.mezo.api.dto.RecipeImportResponse;
import io.mrkuhne.mezo.api.dto.RecipeImportTextRequest;
import io.mrkuhne.mezo.api.dto.RecipeImportUrlRequest;
import io.mrkuhne.mezo.feature.recipe.service.RecipeImportService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Recipe import endpoints (Boop B4). Switch off => this bean is gone (the routes 404). */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.RECIPE_IMPORT_SWITCH, havingValue = "true")
public class RecipeImportController implements RecipeImportApi {

    private final RecipeImportService service;
    private final CurrentUserId currentUserId;

    @Override
    public RecipeImportResponse importRecipeFromUrl(RecipeImportUrlRequest req) {
        return wrap(service.fromUrl(currentUserId.get(), req.getUrl()));
    }

    @Override
    public RecipeImportResponse importRecipeFromText(RecipeImportTextRequest req) {
        return wrap(service.fromText(currentUserId.get(), req.getText()));
    }

    @Override
    public RecipeImportResponse importRecipeFromPhoto(MultipartFile photo) {
        return wrap(service.fromPhoto(currentUserId.get(), photo));
    }

    private static RecipeImportResponse wrap(io.mrkuhne.mezo.api.dto.RecipeImportDraft draft) {
        RecipeImportResponse resp = new RecipeImportResponse();
        resp.setResult(draft);
        return resp;
    }
}

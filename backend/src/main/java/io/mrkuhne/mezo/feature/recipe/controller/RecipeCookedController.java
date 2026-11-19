package io.mrkuhne.mezo.feature.recipe.controller;

import io.mrkuhne.mezo.api.controller.RecipeCookedApi;
import io.mrkuhne.mezo.api.dto.RecipeImportResponse;
import io.mrkuhne.mezo.feature.recipe.service.RecipeCookedService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** „Ezt főztem" (mezo-r36n9.63). Switch off => this bean is gone and the operation is not served. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.RECIPE_COOKED_SWITCH, havingValue = "true")
public class RecipeCookedController implements RecipeCookedApi {

    private final RecipeCookedService service;
    private final CurrentUserId currentUserId;

    @Override
    public RecipeImportResponse cookedRecipe(String text, List<MultipartFile> photos) {
        RecipeImportResponse resp = new RecipeImportResponse();
        resp.setResult(service.fromCapture(currentUserId.get(), text, photos));
        return resp;
    }
}

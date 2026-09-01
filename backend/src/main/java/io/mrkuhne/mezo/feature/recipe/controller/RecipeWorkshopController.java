package io.mrkuhne.mezo.feature.recipe.controller;

import io.mrkuhne.mezo.api.controller.RecipeWorkshopApi;
import io.mrkuhne.mezo.api.dto.WorkshopTurnRequest;
import io.mrkuhne.mezo.api.dto.WorkshopTurnResponse;
import io.mrkuhne.mezo.feature.recipe.service.RecipeWorkshopService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** Receptműhely turn endpoint (mezo-92pb). Switch off ⇒ this bean is gone (route 404/405s). */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.RECIPE_WORKSHOP_SWITCH, havingValue = "true")
public class RecipeWorkshopController implements RecipeWorkshopApi {

    private final RecipeWorkshopService service;
    private final CurrentUserId currentUserId;

    @Override
    public WorkshopTurnResponse workshopTurn(WorkshopTurnRequest workshopTurnRequest) {
        return service.turn(currentUserId.get(), workshopTurnRequest);
    }
}

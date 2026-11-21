package io.mrkuhne.mezo.feature.season.controller;

import io.mrkuhne.mezo.api.controller.SeasonApi;
import io.mrkuhne.mezo.api.dto.SeasonAdherenceResponse;
import io.mrkuhne.mezo.api.dto.SeasonMenuAlternative;
import io.mrkuhne.mezo.api.dto.SeasonMenuChoice;
import io.mrkuhne.mezo.api.dto.SeasonMenuGenerate;
import io.mrkuhne.mezo.api.dto.SeasonMenuWeek;
import io.mrkuhne.mezo.api.dto.SeasonRecipeIds;
import io.mrkuhne.mezo.api.dto.SeasonRecipeOption;
import io.mrkuhne.mezo.api.dto.SeasonStaples;
import io.mrkuhne.mezo.api.dto.ShoppingItem;
import io.mrkuhne.mezo.api.dto.ShoppingItemCheck;
import io.mrkuhne.mezo.api.dto.ShoppingListResponse;
import io.mrkuhne.mezo.api.dto.ShoppingListSummary;
import io.mrkuhne.mezo.api.dto.ShoppingStapleToggle;
import io.mrkuhne.mezo.api.dto.SeasonApply;
import io.mrkuhne.mezo.api.dto.SeasonDraft;
import io.mrkuhne.mezo.api.dto.SeasonOverview;
import io.mrkuhne.mezo.api.dto.SeasonPreview;
import io.mrkuhne.mezo.api.dto.SeasonResponse;
import io.mrkuhne.mezo.api.dto.SeasonRules;
import io.mrkuhne.mezo.feature.season.service.SeasonApiService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Boop B6 Évad (mezo-r36n9.16) — thin delegation; ownership from the principal. */
@RestController
@RequiredArgsConstructor
public class SeasonController implements SeasonApi {

    private final SeasonApiService service;
    private final CurrentUserId currentUserId;

    @Override
    public List<SeasonResponse> listSeasons() {
        return service.list(currentUserId.get());
    }

    @Override
    public SeasonDraft getFirstSeasonDraft() {
        return service.firstDraft(currentUserId.get());
    }

    @Override
    public SeasonPreview previewSeasonDraft(SeasonDraft seasonDraft) {
        return service.previewDraft(currentUserId.get(), seasonDraft);
    }

    @Override
    public SeasonResponse createSeason(SeasonDraft seasonDraft) {
        return service.create(currentUserId.get(), seasonDraft);
    }

    @Override
    public SeasonResponse activateSeason(UUID id) {
        return service.activate(currentUserId.get(), id);
    }

    @Override
    public SeasonResponse closeSeason(UUID id) {
        return service.close(currentUserId.get(), id);
    }

    @Override
    public SeasonPreview previewSeason(UUID id, SeasonDraft seasonDraft) {
        return service.preview(currentUserId.get(), id, seasonDraft);
    }

    @Override
    public SeasonResponse applySeason(UUID id, SeasonApply seasonApply) {
        return service.apply(currentUserId.get(), id, seasonApply);
    }

    @Override
    public SeasonAdherenceResponse getAdherence(LocalDate from, LocalDate to) {
        return service.adherence(currentUserId.get(), from, to);
    }

    @Override
    public SeasonOverview getSeasonOverview() {
        return service.overview(currentUserId.get());
    }

    @Override
    public SeasonResponse putSeasonRules(UUID id, SeasonRules seasonRules) {
        return service.putRules(currentUserId.get(), id, seasonRules);
    }

    // --- S3: weekly menu, allowed recipes, shopping list, staples ---

    @Override
    public SeasonMenuWeek getMenuWeek(LocalDate weekStart) {
        return service.menuWeek(currentUserId.get(), weekStart);
    }

    @Override
    public SeasonMenuWeek generateMenuWeek(SeasonMenuGenerate body) {
        return service.generateMenu(currentUserId.get(), body.getWeekStart());
    }

    @Override
    public SeasonMenuWeek approveMenuWeek(UUID id) {
        return service.approveMenu(currentUserId.get(), id);
    }

    @Override
    public SeasonMenuWeek swapMenuMeal(UUID id, SeasonMenuChoice body) {
        return service.swapMenuMeal(currentUserId.get(), id, body.getRecipeId());
    }

    @Override
    public List<SeasonMenuAlternative> listMenuAlternatives(UUID id) {
        return service.menuAlternatives(currentUserId.get(), id);
    }

    @Override
    public List<SeasonRecipeOption> listSeasonRecipes() {
        return service.recipes(currentUserId.get());
    }

    @Override
    public SeasonResponse putSeasonRecipes(UUID id, SeasonRecipeIds body) {
        return service.putRecipes(currentUserId.get(), id, body.getRecipeIds());
    }

    @Override
    public ShoppingListResponse getShoppingList(LocalDate weekStart) {
        return service.shoppingList(currentUserId.get(), weekStart);
    }

    @Override
    public List<ShoppingListSummary> listShoppingLists() {
        return service.shoppingLists(currentUserId.get());
    }

    @Override
    public ShoppingItem checkShoppingItem(UUID id, ShoppingItemCheck body) {
        return service.checkShoppingItem(currentUserId.get(), id, body.getChecked());
    }

    @Override
    public ShoppingListResponse toggleShoppingStaple(UUID id, ShoppingStapleToggle body) {
        return service.toggleStaple(currentUserId.get(), id, body.getName(), body.getOn());
    }

    @Override
    public SeasonStaples listStaples() {
        return service.staples(currentUserId.get());
    }

    @Override
    public SeasonStaples putStaples(SeasonStaples body) {
        return service.putStaples(currentUserId.get(), body.getNames());
    }
}

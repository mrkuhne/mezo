package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.api.dto.SeasonAdherenceResponse;
import io.mrkuhne.mezo.api.dto.SeasonExperiment;
import io.mrkuhne.mezo.api.dto.SeasonExperimentCreate;
import io.mrkuhne.mezo.api.dto.SeasonExperimentMark;
import io.mrkuhne.mezo.api.dto.SeasonExperiments;
import io.mrkuhne.mezo.api.dto.SeasonMenuAlternative;
import io.mrkuhne.mezo.api.dto.SeasonMenuWeek;
import io.mrkuhne.mezo.api.dto.SeasonRecipeOption;
import io.mrkuhne.mezo.api.dto.SeasonStaples;
import io.mrkuhne.mezo.api.dto.ShoppingItem;
import io.mrkuhne.mezo.api.dto.ShoppingListResponse;
import io.mrkuhne.mezo.api.dto.ShoppingListSummary;
import io.mrkuhne.mezo.api.dto.SeasonApply;
import io.mrkuhne.mezo.api.dto.SeasonDraft;
import io.mrkuhne.mezo.api.dto.SeasonOverview;
import io.mrkuhne.mezo.api.dto.SeasonPreview;
import io.mrkuhne.mezo.api.dto.SeasonResponse;
import io.mrkuhne.mezo.api.dto.SeasonRules;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.mapper.SeasonMapper;
import io.mrkuhne.mezo.feature.season.port.SeasonGoalPort;
import io.mrkuhne.mezo.feature.season.port.SeasonTrainPort;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Contract-shaped façade over the season services: DTO ↔ domain, and the response's live draft + block. */
@Service
@RequiredArgsConstructor
public class SeasonApiService {

    private final SeasonService seasonService;
    private final SeasonPreviewService previewService;
    private final SeasonOverviewService overviewService;
    private final FirstSeasonAssembler firstSeasonAssembler;
    private final SeasonGoalPort goalPort;
    private final SeasonTrainPort trainPort;
    private final SeasonMapper mapper;
    private final AdherenceService adherenceService;
    private final MenuService menuService;
    private final ShoppingListService shoppingListService;
    private final SeasonRecipeService recipeService;
    private final ExperimentService experimentService;

    @Transactional(readOnly = true)
    public List<SeasonResponse> list(UUID owner) {
        return seasonService.list(owner).stream().map(s -> response(owner, s)).toList();
    }

    @Transactional(readOnly = true)
    public SeasonDraft firstDraft(UUID owner) {
        return mapper.toDto(firstSeasonAssembler.draft(owner));
    }

    public SeasonPreview previewDraft(UUID owner, SeasonDraft draft) {
        return mapper.toDto(previewService.previewDraft(owner, mapper.fromDto(draft)));
    }

    public SeasonPreview preview(UUID owner, UUID id, SeasonDraft draft) {
        return mapper.toDto(previewService.preview(owner, id, mapper.fromDto(draft)));
    }

    @Transactional
    public SeasonResponse create(UUID owner, SeasonDraft draft) {
        return response(owner, seasonService.create(owner, mapper.fromDto(draft)));
    }

    @Transactional
    public SeasonResponse activate(UUID owner, UUID id) {
        return response(owner, seasonService.activate(owner, id));
    }

    @Transactional
    public SeasonResponse apply(UUID owner, UUID id, SeasonApply apply) {
        return response(owner, seasonService.apply(owner, id, mapper.fromDto(apply.getDraft()), apply.getFingerprint()));
    }

    @Transactional
    public SeasonResponse close(UUID owner, UUID id) {
        return response(owner, seasonService.close(owner, id));
    }

    @Transactional
    public SeasonResponse putRules(UUID owner, UUID id, SeasonRules r) {
        return response(owner, seasonService.putRules(owner, id, r.getProcessedFoodMaxNova(), r.getDeloadMaintain(),
            r.getUseLearnedExpenditure(), r.getProposeExperiments(), r.getMenuDay(), r.getMenuTime()));
    }

    public SeasonAdherenceResponse adherence(UUID owner, LocalDate from, LocalDate to) {
        return mapper.toDto(adherenceService.range(owner, from, to));
    }

    public SeasonOverview overview(UUID owner) {
        return overviewService.overview(owner);
    }

    public SeasonMenuWeek menuWeek(UUID owner, LocalDate weekStart) {
        return menuService.get(owner, weekStart);
    }

    public SeasonMenuWeek generateMenu(UUID owner, LocalDate weekStart) {
        return menuService.generate(owner, weekStart);
    }

    public SeasonMenuWeek approveMenu(UUID owner, UUID weekId) {
        return menuService.approve(owner, weekId);
    }

    public SeasonMenuWeek swapMenuMeal(UUID owner, UUID mealId, UUID recipeId) {
        return menuService.swap(owner, mealId, recipeId);
    }

    public List<SeasonMenuAlternative> menuAlternatives(UUID owner, UUID mealId) {
        return menuService.alternatives(owner, mealId);
    }

    public List<SeasonRecipeOption> recipes(UUID owner) {
        return recipeService.options(owner);
    }

    @Transactional
    public SeasonResponse putRecipes(UUID owner, UUID id, List<UUID> recipeIds) {
        return response(owner, seasonService.putRecipes(owner, id, recipeIds, recipeService.hisRecipeIds(owner)));
    }

    public ShoppingListResponse shoppingList(UUID owner, LocalDate weekStart) {
        return shoppingListService.get(owner, weekStart);
    }

    public List<ShoppingListSummary> shoppingLists(UUID owner) {
        return shoppingListService.lists(owner);
    }

    public ShoppingItem checkShoppingItem(UUID owner, UUID itemId, Boolean checked) {
        return shoppingListService.check(owner, itemId, Boolean.TRUE.equals(checked));
    }

    public ShoppingListResponse toggleStaple(UUID owner, UUID listId, String name, Boolean on) {
        return shoppingListService.toggleStaple(owner, listId, name, Boolean.TRUE.equals(on));
    }

    public SeasonStaples staples(UUID owner) {
        return shoppingListService.staples(owner);
    }

    public SeasonStaples putStaples(UUID owner, List<String> names) {
        return shoppingListService.putStaples(owner, names);
    }

    // --- S4: experiments (today = the server's local day, like the other season ops) ---

    public SeasonExperiments experiments(UUID owner) {
        return mapper.toDto(experimentService.list(owner, LocalDate.now()));
    }

    public SeasonExperiment createExperiment(UUID owner, SeasonExperimentCreate body) {
        return mapper.toDto(experimentService.create(owner, body.getTitle(),
            body.getSubjectKind() == null ? null : body.getSubjectKind().getValue(), body.getSubjectRef(),
            body.getLengthDays(), LocalDate.now()));
    }

    public SeasonExperiment startExperiment(UUID owner, UUID id) {
        return mapper.toDto(experimentService.start(owner, id, LocalDate.now()));
    }

    public SeasonExperiment markExperimentDay(UUID owner, UUID id, SeasonExperimentMark body) {
        return mapper.toDto(experimentService.markDay(owner, id, body.getDate(), Boolean.TRUE.equals(body.getDone()),
            LocalDate.now()));
    }

    public SeasonExperiment dismissExperiment(UUID owner, UUID id) {
        return mapper.toDto(experimentService.dismiss(owner, id, LocalDate.now()));
    }

    public SeasonExperiment keepExperiment(UUID owner, UUID id) {
        return mapper.toDto(experimentService.keep(owner, id, LocalDate.now()));
    }

    private SeasonResponse response(UUID owner, SeasonEntity s) {
        List<UUID> linked = goalPort.linkedMesocycles(owner, s.getGoalId());
        UUID block = linked.isEmpty() ? null : linked.get(linked.size() - 1);
        if (block != null && trainPort.mesocycle(owner, block).isEmpty()) {
            block = null;
        }
        return mapper.toResponse(s, previewService.currentDraft(owner, s), block);
    }
}

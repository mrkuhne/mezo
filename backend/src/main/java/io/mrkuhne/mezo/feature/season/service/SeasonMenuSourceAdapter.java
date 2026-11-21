package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.meal.service.dayplan.DayPlanService;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityProfile;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityService;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.RecipeCandidate;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.feature.season.port.SeasonMenuSourcePort;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@link SeasonMenuSourcePort} over the Étel day plan ({@link DayPlanService#skeleton} — the very windows and budgets
 * the room serves), the recipes and the pantry catalog. Season-side adapter (see {@link SeasonGoalAdapter}).
 */
@Component
@RequiredArgsConstructor
public class SeasonMenuSourceAdapter implements SeasonMenuSourcePort {

    private final DayPlanService dayPlans;
    private final SensitivityService sensitivities;
    private final RecipeRepository recipes;
    private final PantryItemRepository pantryItems;

    @Override
    @Transactional(readOnly = true)
    public List<DayFrame> frames(UUID owner, LocalDate from, LocalDate to) {
        List<DayFrame> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            DayPlanService.Skeleton sk = dayPlans.skeleton(owner, d);
            boolean gym = sk.sessions().stream().anyMatch(s -> !"sport".equals(s.kind()));
            WorkoutWindowQueryService.Window sport = sk.sessions().stream()
                .filter(s -> "sport".equals(s.kind())).findFirst().orElse(null);
            List<FrameWindow> windows = sk.windows().stream()
                .map(w -> new FrameWindow(w.slot(), w.ordinal(), w.label(), w.budget(), w.atMin()))
                .toList();
            out.add(new DayFrame(d, gym, sport != null, sport == null ? null : sport.label(),
                sport == null ? null : sport.start().getHour() * 60 + sport.start().getMinute(), windows));
        }
        return out;
    }

    @Override
    public List<RecipeCandidate> recipes(UUID owner) {
        return dayPlans.recipeCandidates(owner);
    }

    @Override
    public SensitivityProfile profile(UUID owner) {
        return sensitivities.profile(owner);
    }

    @Override
    @Transactional(readOnly = true)
    public List<IngredientLine> ingredients(UUID owner, Collection<UUID> recipeIds) {
        Set<UUID> wanted = new HashSet<>(recipeIds);
        List<RecipeEntity> mine = recipes.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(owner).stream()
            .filter(r -> wanted.contains(r.getId()))
            .toList();
        Set<UUID> itemIds = mine.stream().flatMap(r -> r.getLines().stream())
            .map(RecipeIngredientEntity::getPantryItemId).collect(Collectors.toSet());
        Map<UUID, PantryItemEntity> items = itemIds.isEmpty() ? Map.of()
            : pantryItems.findAllWithCatalogByIdIn(itemIds).stream()
                .collect(Collectors.toMap(PantryItemEntity::getId, Function.identity()));
        List<IngredientLine> out = new ArrayList<>();
        for (RecipeEntity r : mine) {
            int servings = r.getServings() == null || r.getServings() < 1 ? 1 : r.getServings();
            for (RecipeIngredientEntity l : r.getLines()) {
                PantryItemEntity item = items.get(l.getPantryItemId());
                UUID catalogId = item == null || item.getCatalog() == null ? null : item.getCatalog().getId();
                String name = item != null && item.getCatalog() != null && item.getCatalog().getName() != null
                    ? item.getCatalog().getName() : l.getSnapshotName();
                String category = item == null || item.getCatalog() == null ? null : item.getCatalog().getCategory();
                out.add(new IngredientLine(r.getId(), r.getName(), servings, catalogId, name, l.getAmount(), l.getUnit(),
                    category));
            }
        }
        return out;
    }
}

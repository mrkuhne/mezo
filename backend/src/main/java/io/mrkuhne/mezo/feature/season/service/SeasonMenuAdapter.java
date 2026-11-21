package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.meal.port.SeasonMenuPort;
import io.mrkuhne.mezo.feature.season.entity.SeasonAllowedRecipeEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonMenuWeekEntity;
import io.mrkuhne.mezo.feature.season.repository.SeasonAllowedRecipeRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonMenuMealRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonMenuWeekRepository;
import io.mrkuhne.mezo.feature.season.repository.SeasonRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** {@link SeasonMenuPort} (meal-owned) over the active season's allowed recipes and its approved menu weeks. */
@Component
@RequiredArgsConstructor
public class SeasonMenuAdapter implements SeasonMenuPort {

    private final SeasonRepository seasons;
    private final SeasonAllowedRecipeRepository allowed;
    private final SeasonMenuWeekRepository weeks;
    private final SeasonMenuMealRepository meals;

    @Override
    @Transactional(readOnly = true)
    public Set<UUID> allowedRecipes(UUID owner) {
        return seasons.findActive(owner)
            .map(s -> allowed.findBySeasonId(s.getId()).stream()
                .map(SeasonAllowedRecipeEntity::getRecipeId).collect(Collectors.toUnmodifiableSet()))
            .orElse(Set.of());
    }

    @Override
    @Transactional(readOnly = true)
    public List<MenuMeal> approvedMeals(UUID owner, LocalDate date) {
        UUID active = seasons.findActive(owner).map(s -> s.getId()).orElse(null);
        if (active == null) {
            return List.of(); // a closed season's menu no longer drives the day
        }
        LocalDate monday = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return weeks.findByCreatedByAndWeekStart(owner, monday)
            .filter(SeasonMenuWeekEntity::approved)
            .filter(w -> active.equals(w.getSeasonId()))
            .map(w -> meals.findByWeekIdAndMealDate(w.getId(), date).stream()
                .map(m -> new MenuMeal(m.getSlot(), m.getOrdinal(), m.getRecipeId(), m.getName(), m.getKcal(),
                    m.getProteinG(), m.getBudgetKcal() == null ? m.getKcal() : m.getBudgetKcal()))
                .toList())
            .orElse(List.of());
    }
}

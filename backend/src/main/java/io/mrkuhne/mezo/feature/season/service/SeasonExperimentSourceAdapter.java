package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.fuel.entity.ProtocolItemEntity;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolItemRepository;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealItemRepository;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.season.port.SeasonExperimentSourcePort;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * {@link SeasonExperimentSourcePort} over the stack (fuel), the meal log and the journal — season-side like the
 * other season adapters ({@link SeasonGoalAdapter}). Local days are the Boop zone's ({@code mezo.wearable.zone}).
 */
@Component
@RequiredArgsConstructor
public class SeasonExperimentSourceAdapter implements SeasonExperimentSourcePort {

    private final ProtocolItemRepository protocolItemRepository;
    private final PantryItemRepository pantryItemRepository;
    private final MealItemRepository mealItemRepository;
    private final MealRepository mealRepository;
    private final JournalEntryRepository journalEntryRepository;
    private final WearableProperties wearableProperties;

    @Override
    public List<NewSupplement> newSupplements(UUID owner, LocalDate since) {
        ZoneId zone = ZoneId.of(wearableProperties.zone());
        var from = since.atStartOfDay(zone).toInstant();
        List<UUID> ids = protocolItemRepository.findNewInStackSince(owner, from);
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<UUID, LocalDate> added = new HashMap<>();
        for (ProtocolItemEntity i : protocolItemRepository.findByCreatedByAndDeletedFalseAndCreatedAtGreaterThanEqual(owner, from)) {
            if (i.getCreatedAt() != null && ids.contains(i.getPantryItemId())) {
                LocalDate d = i.getCreatedAt().atZone(zone).toLocalDate();
                added.merge(i.getPantryItemId(), d, (a, b) -> a.isBefore(b) ? a : b);
            }
        }
        List<NewSupplement> out = new ArrayList<>();
        for (PantryItemEntity p : pantryItemRepository.findAllWithCatalogByIdIn(ids)) {
            if (owner.equals(p.getCreatedBy()) && p.getCatalog() != null && added.containsKey(p.getId())) {
                out.add(new NewSupplement(p.getId(), p.getCatalog().getName(), added.get(p.getId())));
            }
        }
        return out;
    }

    @Override
    public List<RepeatedFood> repeatedFirstFoods(UUID owner, LocalDate firstFrom, LocalDate to) {
        Set<UUID> recipes = new HashSet<>(mealItemRepository.findRecipesFirstEatenSince(owner, firstFrom));
        Set<UUID> foods = new HashSet<>(mealItemRepository.findPantryFoodsFirstEatenSince(owner, firstFrom));
        if (recipes.isEmpty() && foods.isEmpty()) {
            return List.of();
        }
        Map<UUID, TreeSet<LocalDate>> days = new HashMap<>();
        Map<UUID, String> names = new HashMap<>();
        for (MealEntity m : mealRepository.findWithItemsBetween(owner, firstFrom, to)) {
            for (MealItemEntity i : m.getItems()) {
                // A pantry line carrying a recipe id is an ingredient of a recipe logged ingredient by
                // ingredient (mezo-r36n9.181): it counts for the recipe, under the recipe's name.
                boolean asRecipe = recipes.contains(i.getRecipeId());
                UUID ref = asRecipe ? i.getRecipeId()
                    : "pantry".equals(i.getSource()) && i.getRecipeId() == null && foods.contains(i.getPantryItemId())
                        ? i.getPantryItemId() : null;
                if (ref != null) {
                    days.computeIfAbsent(ref, k -> new TreeSet<>()).add(m.getMealDate());
                    String name = asRecipe && i.getRecipeSnapshotName() != null ? i.getRecipeSnapshotName() : i.getSnapshotName();
                    if (name != null && !name.isBlank()) {
                        names.putIfAbsent(ref, name.strip());
                    }
                }
            }
        }
        List<RepeatedFood> out = new ArrayList<>();
        days.forEach((ref, ds) -> {
            LocalDate first = ds.first();
            LocalDate again = ds.higher(first);
            if (again != null && !again.isAfter(first.plusDays(REPEAT_WITHIN_DAYS)) && names.containsKey(ref)) {
                out.add(new RepeatedFood(recipes.contains(ref) ? "recipe" : "food", ref, names.get(ref), first, again));
            }
        });
        return out;
    }

    @Override
    public List<JournalLine> journalLines(UUID owner, LocalDate from, LocalDate to) {
        return journalEntryRepository.findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
                owner, from, to).stream()
            .filter(j -> j.getText() != null)
            .map(j -> new JournalLine(j.getOccurredOn(), j.getText()))
            .toList();
    }
}

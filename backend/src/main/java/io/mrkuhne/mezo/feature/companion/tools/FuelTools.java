package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.ProtocolResponse;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.fuel.entity.SupplementIntakeEntity;
import io.mrkuhne.mezo.feature.fuel.repository.SupplementIntakeRepository;
import io.mrkuhne.mezo.feature.fuel.service.ProtocolService;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.recipe.service.RecipeService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** V0.5 read tools over the fuel/meal features (day rollups + supplement-protocol adherence),
 *  plus {@code get_recipes} (mezo-xixu) over the sibling recipe feature. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FuelTools {

    /** Recipe-filter keywords that stand in for the boolean {@code starred} flag (mezo-xixu):
     *  there is no literal substring to match against a boolean, so a fixed keyword set is
     *  matched bidirectionally against the (partial) user filter. */
    private static final List<String> STARRED_KEYWORDS = List.of("csillagos", "csillagozott", "kedvenc", "starred");

    private final FuelDayService fuelDayService;
    private final ProtocolService protocolService;
    private final SupplementIntakeRepository supplementIntakeRepository;
    private final RecipeService recipeService;
    private final CompanionProperties properties;

    @Tool(name = "get_recent_meals", description = "Napi étkezés-összesítők az elmúlt napokra: kcal és "
            + "fehérje a célhoz képest, étkezésszám, ételek. Kérdés étkezésről, kalóriáról, fehérjebevitelről.")
    public String getRecentMeals(
            @ToolParam(required = false, description = "Hány napra visszamenőleg (alapértelmezés 7).") Integer days,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate today = LocalDate.now();
        StringBuilder b = new StringBuilder("Napi étkezés-összesítők (utolsó ").append(d).append(" nap):");
        int daysWithMeals = 0;
        for (int i = d - 1; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            FuelDayResponse day = fuelDayService.getDay(userId, date);
            MacroSet c = day.getConsumed();
            MacroSet t = day.getTargets();
            b.append('\n').append(date).append(": ")
                    .append(ToolText.num(c.getKcal())).append('/').append(ToolText.num(t.getKcal()))
                    .append(" kcal, F ").append(ToolText.num(c.getP())).append('/').append(ToolText.num(t.getP()))
                    .append(" g; ").append(day.getMeals().size()).append(" étkezés");
            if (!day.getMeals().isEmpty()) {
                b.append(" (").append(day.getMeals().stream()
                        .map(MealResponse::getTitle).limit(3).collect(Collectors.joining(", ")));
                if (day.getMeals().size() > 3) {
                    b.append(", …");
                }
                b.append(')');
                daysWithMeals++;
                if (daysWithMeals <= 5) {
                    ToolContexts.audit(toolContext).addRef("FuelDay", date.toString());
                }
            }
        }
        return b.toString();
    }

    @Tool(name = "get_protocol_adherence", description = "Étrendkiegészítő-protokoll követése az elmúlt "
            + "napokra: naponta hány elem lett bevéve az aktív protokollból. Kérdés kiegészítőkről, protokollról.")
    public String getProtocolAdherence(
            @ToolParam(required = false, description = "Hány napra visszamenőleg (alapértelmezés 7).") Integer days,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        ProtocolResponse active = protocolService.getView(userId).getActive();
        if (active == null) {
            return "Protokoll-követés: nincs aktív protokoll";
        }
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(d - 1L);
        Set<UUID> protocolItems = new HashSet<>(active.getSelectedPantryItemIds());
        // v0.5 simplification: adherence vs the CURRENT active protocol across the whole window
        Map<LocalDate, Set<UUID>> takenByDay = supplementIntakeRepository
                .findByCreatedByAndDeletedFalseAndTakenDateGreaterThanEqualOrderByTakenDateAscTakenAtAsc(userId, from)
                .stream()
                .collect(Collectors.groupingBy(SupplementIntakeEntity::getTakenDate,
                        Collectors.mapping(SupplementIntakeEntity::getPantryItemId, Collectors.toSet())));
        StringBuilder b = new StringBuilder("Protokoll-követés (utolsó ").append(d).append(" nap): aktív protokoll v")
                .append(active.getVersion()).append(", ").append(protocolItems.size()).append(" elem");
        int takenTotal = 0;
        for (int i = d - 1; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            long taken = takenByDay.getOrDefault(date, Set.of()).stream().filter(protocolItems::contains).count();
            takenTotal += (int) taken;
            b.append('\n').append(date).append(": ").append(taken).append('/').append(protocolItems.size());
        }
        int expectedTotal = protocolItems.size() * d;
        if (expectedTotal > 0) {
            b.append("\nÖsszesen: ").append(takenTotal).append('/').append(expectedTotal)
                    .append(" (").append(Math.round(takenTotal * 100.0 / expectedTotal)).append("%)");
        }
        ToolContexts.audit(toolContext).addRef("Protocol", "v" + active.getVersion());
        return b.toString();
    }

    @Tool(name = "get_recipes", description = "A user receptjei: név, makrók, illeszkedés-pontszám, "
            + "összetevők. Használd, amikor a user receptet keres, mit főzzön/egyen kérdez, vagy egy "
            + "konkrét recept részleteire kíváncsi.")
    public String getRecipes(
            @ToolParam(required = false, description = "Szűrés étkezés/kategória/tag/csillagozott/"
                    + "illeszkedés szerint (részleges egyezés) — üresen az összes receptet listázza.")
            String filter,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        List<RecipeResponse> recipes = recipeService.list(userId).getRecipes(); // READ-ONLY (@Transactional(readOnly=true))
        if (recipes.isEmpty()) {
            return "Receptek: " + ToolText.NO_DATA;
        }
        if (filter == null || filter.isBlank()) {
            return renderRecipeList(recipes.stream().limit(5).toList(), toolContext);
        }
        String needle = filter.trim().toLowerCase();
        List<RecipeResponse> matches = recipes.stream().filter(r -> matchesRecipeFilter(r, needle)).toList();
        if (matches.isEmpty()) {
            return "Receptek — \"" + filter + "\": " + ToolText.NO_DATA;
        }
        // A single strong match earns the full detail (incl. ingredients); several matches fall
        // back to the same compact list rendering as the no-filter case (capped at 5 refs).
        if (matches.size() == 1) {
            return renderRecipeDetail(matches.get(0), toolContext);
        }
        return renderRecipeList(matches.stream().limit(5).toList(), toolContext);
    }

    /** Compact per-recipe line: name (category): kcal/protein + fit score (null-guarded — no "pending" score renders). */
    private String renderRecipeList(List<RecipeResponse> recipes, ToolContext toolContext) {
        StringBuilder b = new StringBuilder("Receptek:");
        for (RecipeResponse r : recipes) {
            b.append('\n').append(r.getName());
            if (r.getCategory() != null) {
                b.append(" (").append(r.getCategory()).append(')');
            }
            b.append(": ").append(ToolText.num(r.getMacros().getKcal())).append(" kcal, ")
                    .append(ToolText.num(r.getMacros().getP())).append(" g fehérje");
            BigDecimal fit = r.getMezoFit() == null ? null : r.getMezoFit().getScore();
            if (fit != null) {
                b.append(", illeszkedés ").append(ToolText.num(fit));
            }
            ToolContexts.audit(toolContext).addRef("Recipe", r.getName());
        }
        return b.toString();
    }

    /** Full detail for a single strong filter match: all 4 macros + fit score + the ingredient lines. */
    private String renderRecipeDetail(RecipeResponse r, ToolContext toolContext) {
        StringBuilder b = new StringBuilder(r.getName());
        if (r.getCategory() != null) {
            b.append(" (").append(r.getCategory()).append(')');
        }
        b.append(": ").append(ToolText.num(r.getMacros().getKcal())).append(" kcal, ")
                .append(ToolText.num(r.getMacros().getP())).append(" g fehérje, ")
                .append(ToolText.num(r.getMacros().getC())).append(" g szénhidrát, ")
                .append(ToolText.num(r.getMacros().getF())).append(" g zsír");
        BigDecimal fit = r.getMezoFit() == null ? null : r.getMezoFit().getScore();
        if (fit != null) {
            b.append("; illeszkedés ").append(ToolText.num(fit));
        }
        if (r.getIngredients() != null && !r.getIngredients().isEmpty()) {
            b.append("\nÖsszetevők: ").append(r.getIngredients().stream()
                    .map(i -> i.getName() + " " + ToolText.num(i.getAmount()) + i.getUnit())
                    .collect(Collectors.joining(", ")));
        }
        ToolContexts.audit(toolContext).addRef("Recipe", r.getName());
        return b.toString();
    }

    /** slot/category/tag/starred/fitsFor substring match (case-insensitive) — NOT the recipe name (spec §R1). */
    private static boolean matchesRecipeFilter(RecipeResponse r, String needle) {
        if (containsIgnoreCase(r.getSlot(), needle) || containsIgnoreCase(r.getCategory(), needle)) {
            return true;
        }
        if (r.getTags() != null && r.getTags().stream().anyMatch(t -> containsIgnoreCase(t, needle))) {
            return true;
        }
        if (Boolean.TRUE.equals(r.getStarred())
                && STARRED_KEYWORDS.stream().anyMatch(k -> k.contains(needle) || needle.contains(k))) {
            return true;
        }
        return r.getMezoFit() != null && r.getMezoFit().getFitsFor() != null
                && r.getMezoFit().getFitsFor().stream().anyMatch(f -> containsIgnoreCase(f, needle));
    }

    private static boolean containsIgnoreCase(String value, String needle) {
        return value != null && value.toLowerCase().contains(needle);
    }
}

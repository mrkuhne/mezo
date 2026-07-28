package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.FuelDayRollup;
import io.mrkuhne.mezo.api.dto.FuelWeekResponse;
import io.mrkuhne.mezo.api.dto.IngredientResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.PantryResponse;
import io.mrkuhne.mezo.api.dto.PantryStock;
import io.mrkuhne.mezo.api.dto.ProtocolResponse;
import io.mrkuhne.mezo.api.dto.RecipeResponse;
import io.mrkuhne.mezo.api.dto.SupplementStashResponse;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.fuel.entity.SupplementIntakeEntity;
import io.mrkuhne.mezo.feature.fuel.repository.SupplementIntakeRepository;
import io.mrkuhne.mezo.feature.fuel.service.ProtocolService;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.meal.service.WaterLogService;
import io.mrkuhne.mezo.feature.pantry.service.PantryService;
import io.mrkuhne.mezo.feature.recipe.service.RecipeService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** V0.5 read tools over the fuel/meal features (day/week rollups + supplement-protocol adherence),
 *  plus {@code get_recipes} and {@code get_pantry} (mezo-xixu) over the sibling recipe/pantry features. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FuelTools {

    /** Recipe-filter keywords that stand in for the boolean {@code starred} flag (mezo-xixu):
     *  there is no literal substring to match against a boolean, so a fixed keyword set is
     *  matched bidirectionally against the (partial) user filter. */
    private static final List<String> STARRED_KEYWORDS = List.of("csillagos", "csillagozott", "kedvenc", "starred");

    /** get_fuel_log's supported range values; anything else (incl. null) falls back to "day". */
    private static final List<String> FUEL_LOG_RANGES = List.of("day", "week");

    private final FuelDayService fuelDayService;
    private final WaterLogService waterLogService;
    private final ProtocolService protocolService;
    private final SupplementIntakeRepository supplementIntakeRepository;
    private final RecipeService recipeService;
    private final PantryService pantryService;
    private final CompanionProperties properties;

    @Tool(name = "get_fuel_log", description = "Napi vagy heti étkezés-összesítő: kcal és fehérje a célhoz "
            + "képest. range=day — napi bontású összesítők visszamenőleg N napra (a megadott dátumig): "
            + "soronként kcal/fehérje a célhoz képest, az adott nap étkezésszáma és (legfeljebb 3) "
            + "étkezés-cím; víz a célhoz képest csak az utolsó (megadott) napra. range=week — a hét "
            + "(hétfő–vasárnap, a megadott dátumot tartalmazó ISO-hét) napi bontásban: soronként "
            + "kcal/fehérje/víz a célhoz képest, étkezésszám és cím nélkül. Szénhidrátot és zsírt nem "
            + "tartalmaz. Használd, amikor a user a napi/heti kalória-, fehérje- vagy víz-bevitelről "
            + "kérdez, vagy (range=day esetén) az étkezéseiről. range: day (alapértelmezés), week.")
    public String getFuelLog(
            @ToolParam(required = false, description = "day|week (alapértelmezés: day).") String range,
            @ToolParam(required = false, description = "ISO dátum (ÉÉÉÉ-HH-NN) — az irányadó nap "
                    + "(range=day: az ablak utolsó napja) vagy az irányadó hét egy napja (range=week); "
                    + "alapértelmezés a mai nap.") String date,
            @ToolParam(required = false, description = "range=day esetén hány napra visszamenőleg "
                    + "(alapértelmezés 7).") Integer days,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        LocalDate anchor = parseDate(date, LocalDate.now());
        if ("week".equals(normalizeRange(range))) {
            return renderFuelWeek(userId, anchor, toolContext);
        }
        return renderFuelDay(userId, anchor, days, toolContext);
    }

    private static String normalizeRange(String range) {
        if (range == null) {
            return "day";
        }
        String r = range.trim().toLowerCase();
        return FUEL_LOG_RANGES.contains(r) ? r : "day";
    }

    /** An unparsable/missing date param falls back to the given default rather than failing the whole call
     *  (the {@code TrainTools.getTrainingPlan} precedent). */
    private static LocalDate parseDate(String date, LocalDate fallback) {
        if (date == null || date.isBlank()) {
            return fallback;
        }
        try {
            return LocalDate.parse(date.trim());
        } catch (DateTimeParseException e) {
            return fallback;
        }
    }

    /** range=day (default): the old {@code get_recent_meals} N-day rollup, ending at {@code anchor} —
     *  per-day kcal/protein vs targets + meal count/titles (≤3), plus a water line for {@code anchor}
     *  itself via {@link WaterLogService#sumForDay} (targets reused from the loop's last iteration —
     *  same config-driven values for every day, no extra {@code FuelDayService} call needed). */
    private String renderFuelDay(UUID userId, LocalDate anchor, Integer days, ToolContext toolContext) {
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        StringBuilder b = new StringBuilder("Napi étkezés-összesítők (utolsó ").append(d).append(" nap):");
        int daysWithMeals = 0;
        MacroSet lastTargets = null;
        for (int i = d - 1; i >= 0; i--) {
            LocalDate date = anchor.minusDays(i);
            FuelDayResponse day = fuelDayService.getDay(userId, date);
            MacroSet c = day.getConsumed();
            MacroSet t = day.getTargets();
            lastTargets = t;
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
        int water = waterLogService.sumForDay(userId, anchor);
        b.append("\nVíz (").append(anchor).append("): ").append(water).append('/')
                .append(ToolText.num(lastTargets.getWater())).append(" ml");
        return b.toString();
    }

    /** range=week: the ISO week (Monday-start, same anchoring as the FE's {@code mondayIso}) containing
     *  {@code anchor}, over {@link FuelDayService#getWeek} — per-day kcal/protein/water vs targets; each
     *  {@link FuelDayRollup} already carries water in its {@code consumed}/{@code targets} MacroSet (Σ the
     *  day's water log via {@code FuelDayService}'s own {@code WaterLogService} collaborator), so no extra
     *  water call is needed here. */
    private String renderFuelWeek(UUID userId, LocalDate anchor, ToolContext toolContext) {
        LocalDate weekStart = anchor.with(DayOfWeek.MONDAY);
        FuelWeekResponse week = fuelDayService.getWeek(userId, weekStart);
        StringBuilder b = new StringBuilder("Heti étkezés-összesítő (")
                .append(weekStart).append(" – ").append(weekStart.plusDays(6)).append("):");
        int refCount = 0;
        for (FuelDayRollup day : week.getDays()) {
            MacroSet c = day.getConsumed();
            MacroSet t = day.getTargets();
            b.append('\n').append(day.getDate()).append(": ")
                    .append(ToolText.num(c.getKcal())).append('/').append(ToolText.num(t.getKcal()))
                    .append(" kcal, F ").append(ToolText.num(c.getP())).append('/').append(ToolText.num(t.getP()))
                    .append(" g, víz ").append(ToolText.num(c.getWater())).append('/')
                    .append(ToolText.num(t.getWater())).append(" ml");
            if (refCount < 5) {
                ToolContexts.audit(toolContext).addRef("FuelDay", day.getDate().toString());
                refCount++;
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

    @Tool(name = "get_pantry", description = "A kamra készlete: mi van otthon, mennyi, meddig jó. Használd, "
            + "amikor a user azt kérdezi mije van otthon, miből tud főzni, vagy mit kell pótolni. kind: food, "
            + "supplement, stim, med (alapértelmezés: az összes).")
    public String getPantry(
            @ToolParam(required = false, description = "food|supplement|stim|med (alapértelmezés: az összes).")
            String kind,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        PantryResponse pantry = pantryService.getPantry(userId); // READ-ONLY (no writes in its body)
        String k = kind == null || kind.isBlank() ? null : kind.trim().toLowerCase();
        List<PantryLine> lines = new ArrayList<>();
        if (k == null || "food".equals(k)) {
            pantry.getIngredients().forEach(i -> lines.add(new PantryLine(i.getName(), renderIngredientStock(i))));
        }
        if (k == null || "supplement".equals(k) || "stim".equals(k) || "med".equals(k)) {
            String wantedType = k == null ? null : stashTypeForKind(k);
            pantry.getStash().stream()
                    .filter(s -> wantedType == null || wantedType.equals(s.getType().getValue()))
                    .forEach(s -> lines.add(new PantryLine(s.getName(), renderStashStock(s))));
        }
        if (lines.isEmpty()) {
            return "Kamra: " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder("Kamra:");
        for (PantryLine line : lines.stream().limit(5).toList()) {
            b.append('\n').append(line.text());
            ToolContexts.audit(toolContext).addRef("Pantry", line.name());
        }
        return b.toString();
    }

    /** name + null-guarded qty/unit/expiry — {@code stock} is only present when {@code stockQty} is set
     *  ({@link io.mrkuhne.mezo.feature.pantry.mapper.PantryMapper#toStock}), and expiry is optional within it. */
    private static String renderIngredientStock(IngredientResponse i) {
        StringBuilder b = new StringBuilder(i.getName());
        PantryStock stock = i.getStock();
        if (stock != null) {
            b.append(": ").append(ToolText.num(stock.getQty()));
            if (stock.getUnit() != null && !stock.getUnit().isBlank()) {
                b.append(' ').append(stock.getUnit());
            }
            if (stock.getExpires() != null) {
                b.append(", lejár ").append(stock.getExpires());
            }
        }
        return b.toString();
    }

    /** name + null-guarded qty/unit — supplement/stim/med stash rows carry no expiry in the contract (mezo-xixu). */
    private static String renderStashStock(SupplementStashResponse s) {
        StringBuilder b = new StringBuilder(s.getName());
        if (s.getStock() != null) {
            b.append(": ").append(ToolText.num(s.getStock()));
            if (s.getStockUnit() != null) {
                b.append(' ').append(s.getStockUnit());
            }
        }
        return b.toString();
    }

    /** {@code kind} (entity/tool vocabulary) -> {@code SupplementStashResponse.type} value (contract vocabulary),
     *  mirroring {@code PantryMapper#typeFromKind}. */
    private static String stashTypeForKind(String kind) {
        return switch (kind) {
            case "stim" -> "stimulant";
            case "med" -> "medication";
            default -> "supplement";
        };
    }

    /** One rendered pantry row, paired with its ref id (item name) for the audit trail. */
    private record PantryLine(String name, String text) {
    }
}

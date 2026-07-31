package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.FuelDayRollup;
import io.mrkuhne.mezo.api.dto.FuelWeekResponse;
import io.mrkuhne.mezo.api.dto.IngredientResponse;
import io.mrkuhne.mezo.api.dto.IntakeResponse;
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
import io.mrkuhne.mezo.feature.fuel.service.IntakeService;
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
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** V0.5 read tools over the fuel/meal features (day/week rollups + the scoped {@code get_protocol}:
 *  adherence/intake/supplements, mezo-xixu), plus {@code get_recipes} and {@code get_pantry}
 *  (mezo-xixu) over the sibling recipe/pantry features. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FuelTools {

    /** Recipe-filter keywords that stand in for the boolean {@code starred} flag (mezo-xixu):
     *  there is no literal substring to match against a boolean, so a fixed keyword set answers
     *  for it — matched as a WHOLE search token (mezo-sxe), never as a substring in either
     *  direction. Keep these accent-free: they are compared against folded tokens. */
    private static final List<String> STARRED_KEYWORDS = List.of("csillagos", "csillagozott", "kedvenc", "starred");

    /** get_fuel_log's supported range values; anything else (incl. null) falls back to "day". */
    private static final List<String> FUEL_LOG_RANGES = List.of("day", "week");

    /** get_protocol's supported scope values; anything else (incl. null) falls back to "adherence". */
    private static final List<String> PROTOCOL_SCOPES = List.of("adherence", "intake", "supplements");

    private final FuelDayService fuelDayService;
    private final WaterLogService waterLogService;
    private final ProtocolService protocolService;
    private final SupplementIntakeRepository supplementIntakeRepository;
    private final IntakeService intakeService;
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

    @Tool(name = "get_protocol", description = "Az étrendkiegészítő-protokoll nézetei. scope=adherence — "
            + "napi bontású követés az elmúlt N napra: naponta hány elem lett bevéve az aktív protokollból, "
            + "plusz az ablak összesítése (bevett/elvárt, %). scope=intake — a mai nap bevett kiegészítői "
            + "(tétel neve, ismert dózissal); nincs protokollhoz kötve. scope=supplements — az aktív "
            + "protokoll tételeinek listája (nevek). Használd, amikor a user az étrendkiegészítő-"
            + "protokolljáról, bevételéről vagy a supplementjeiről kérdez. scope: adherence "
            + "(alapértelmezés), intake, supplements.")
    public String getProtocol(
            @ToolParam(required = false, description = "adherence|intake|supplements (alapértelmezés: adherence).")
            String scope,
            @ToolParam(required = false, description = "scope=adherence esetén hány napra visszamenőleg "
                    + "(alapértelmezés 7); más scope esetén nincs hatása.") Integer days,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        String s = normalizeProtocolScope(scope);
        if ("intake".equals(s)) {
            return renderProtocolIntake(userId, toolContext);
        }
        if ("supplements".equals(s)) {
            return renderProtocolSupplements(userId, toolContext);
        }
        return renderProtocolAdherence(userId, days, toolContext);
    }

    private static String normalizeProtocolScope(String scope) {
        if (scope == null) {
            return "adherence";
        }
        String s = scope.trim().toLowerCase();
        return PROTOCOL_SCOPES.contains(s) ? s : "adherence";
    }

    /** scope=adherence (default) — the original get_protocol_adherence body, unchanged: per-day
     *  taken/expected coverage of the CURRENT active protocol across the window (v0.5 simplification —
     *  protocol-version time-travel is v1+ material), plus the window total (%). */
    private String renderProtocolAdherence(UUID userId, Integer days, ToolContext toolContext) {
        ProtocolResponse active = protocolService.getView(userId).getActive();
        if (active == null) {
            return "Protokoll-követés: nincs aktív protokoll";
        }
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(d - 1L);
        Set<UUID> protocolItems = new HashSet<>(active.getSelectedPantryItemIds());
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

    /** scope=intake (mezo-xixu) — today's raw supplement-intake ledger over {@link IntakeService#listForDay}:
     *  independent of any active protocol (a taken item need not belong to it), so the {@code Protocol}
     *  ref is only added when one happens to be active (kept as the tool's one ref kind — no new kind
     *  introduced). Item names resolved via the pantry stash (intakes are never {@code kind=food} —
     *  {@link IntakeService#logIntake} rejects that), capped at 5 lines like the sibling {@code get_pantry}. */
    private String renderProtocolIntake(UUID userId, ToolContext toolContext) {
        LocalDate today = LocalDate.now();
        List<IntakeResponse> intakes = intakeService.listForDay(userId, today).getIntakes();
        if (intakes.isEmpty()) {
            return "Mai bevétel (" + today + "): " + ToolText.NO_DATA;
        }
        Map<UUID, String> names = pantryStashNames(userId);
        StringBuilder b = new StringBuilder("Mai bevétel (").append(today).append("): ")
                .append(intakes.size()).append(" tétel");
        for (IntakeResponse intake : intakes.stream().limit(5).toList()) {
            b.append('\n').append(names.getOrDefault(intake.getPantryItemId(), "ismeretlen tétel"));
            if (intake.getDose() != null && !intake.getDose().isBlank()) {
                b.append(": ").append(intake.getDose());
            }
        }
        ProtocolResponse active = protocolService.getView(userId).getActive();
        if (active != null) {
            ToolContexts.audit(toolContext).addRef("Protocol", "v" + active.getVersion());
        }
        return b.toString();
    }

    /** scope=supplements (mezo-xixu) — the active protocol's item names (from {@code selectedPantryItemIds},
     *  already itemOrder-sorted by {@link ProtocolService#getView}), capped at 5 like the other list tools. */
    private String renderProtocolSupplements(UUID userId, ToolContext toolContext) {
        ProtocolResponse active = protocolService.getView(userId).getActive();
        if (active == null) {
            return "Protokoll szupplementjei: nincs aktív protokoll";
        }
        List<UUID> ids = active.getSelectedPantryItemIds();
        Map<UUID, String> names = pantryStashNames(userId);
        StringBuilder b = new StringBuilder("Protokoll szupplementjei (v").append(active.getVersion())
                .append("): ").append(ids.size()).append(" elem");
        for (UUID id : ids.stream().limit(5).toList()) {
            b.append('\n').append(names.getOrDefault(id, "ismeretlen tétel"));
        }
        ToolContexts.audit(toolContext).addRef("Protocol", "v" + active.getVersion());
        return b.toString();
    }

    /** pantryItemId -> name over the owner's non-food stash (supplement/stim/med) — the shared lookup
     *  for scope=intake/supplements, both of which only ever reference non-food items. */
    private Map<UUID, String> pantryStashNames(UUID userId) {
        return pantryService.getPantry(userId).getStash().stream()
                .collect(Collectors.toMap(SupplementStashResponse::getId, SupplementStashResponse::getName));
    }

    @Tool(name = "get_recipes", description = "A user receptjei: név, makrók, illeszkedés-pontszám, "
            + "összetevők. Használd, amikor a user receptet keres, mit főzzön/egyen kérdez, vagy egy "
            + "konkrét recept részleteire kíváncsi — a szűrő a recept NEVÉRE és összetevőire is "
            + "illeszkedik, nem kell szó szerint pontosan megadni.")
    public String getRecipes(
            @ToolParam(required = false, description = "Szabad szöveges keresés: recept neve, "
                    + "összetevő, étkezés/kategória/tag/csillagozott/illeszkedés (szavanként, "
                    + "sorrendtől és ékezetektől függetlenül) — üresen az összes receptet listázza.")
            String filter,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        List<RecipeResponse> recipes = recipeService.list(userId).getRecipes(); // READ-ONLY (@Transactional(readOnly=true))
        if (recipes.isEmpty()) {
            return "Receptek: " + ToolText.NO_DATA;
        }
        List<String> tokens = filter == null ? List.of() : ToolText.searchTokens(filter);
        if (tokens.isEmpty()) {
            return renderRecipeList(recipes.stream().limit(5).toList(), toolContext);
        }
        RankResult ranked = rankRecipes(recipes, tokens);
        List<ScoredRecipe> winners = ranked.winners();
        if (winners.isEmpty()) {
            return "Receptek — \"" + filter + "\": " + ToolText.NO_DATA;
        }
        // Partial fallback (mezo-280 Finding 2): the winners hit only SOME of the filter's tokens
        // — an honest in-band marker so the model can never present a partial hit as the exact
        // thing the user asked for (the same spirit as the "never fabricate a number" prompt rule).
        String header = ranked.partial() ? "Receptek — \"" + filter + "\" (részleges egyezés):" : null;
        // The BEST match earns the full detail (incl. ingredients) — a clear winner is what the
        // user asked for by name; a tie falls back to the compact list rendering (capped at 5).
        // Either way, when other recipes also matched, name them (mezo-280 Finding 1): the
        // name>ingredient weighting makes "one point ahead" the COMMON case, so a clear winner
        // must never silently hide a recipe the model doesn't otherwise know exists.
        if (winners.size() == 1 || winners.get(0).score() > winners.get(1).score()) {
            String detail = renderRecipeDetailWithRunnerUps(winners, toolContext);
            return header == null ? detail : header + "\n" + detail;
        }
        if (header == null) {
            return renderRecipeList(winners.stream().limit(5).map(ScoredRecipe::recipe).toList(), toolContext);
        }
        StringBuilder b = new StringBuilder(header);
        appendRecipeLines(b, winners.stream().limit(5).map(ScoredRecipe::recipe).toList(), toolContext);
        return b.toString();
    }

    /** One recipe with its relevance score for the current filter (highest first). */
    private record ScoredRecipe(RecipeResponse recipe, int score) {}

    /**
     * {@code rankRecipes}' verdict (mezo-280): the score-sorted winners, plus whether they came
     * from the partial fallback ({@code complete} was empty) — Finding 2's honest in-band marker
     * needs to know this BEFORE rendering, not just which recipes won.
     */
    private record RankResult(List<ScoredRecipe> winners, boolean partial) {}

    /**
     * Ranks recipes against the folded filter tokens (mezo-sxe). Recipes matching EVERY token win
     * outright — "smoothie collagen" must not surface every unrelated smoothie; only when nothing
     * matches all tokens do partial matches (score > 0) stand in, so a noisy filter still answers
     * instead of falling through to "nincs adat".
     */
    private static RankResult rankRecipes(List<RecipeResponse> recipes, List<String> tokens) {
        List<ScoredRecipe> all = new ArrayList<>();
        List<ScoredRecipe> complete = new ArrayList<>();
        for (RecipeResponse r : recipes) {
            int score = 0;
            int hits = 0;
            for (String token : tokens) {
                int weight = tokenWeight(r, token);
                if (weight > 0) {
                    hits++;
                    score += weight;
                }
            }
            if (hits == 0) {
                continue;
            }
            ScoredRecipe scored = new ScoredRecipe(r, score);
            all.add(scored);
            if (hits == tokens.size()) {
                complete.add(scored);
            }
        }
        boolean partial = complete.isEmpty() && !all.isEmpty();
        List<ScoredRecipe> winners = (complete.isEmpty() ? all : complete).stream()
                .sorted(Comparator.comparingInt(ScoredRecipe::score).reversed()
                        .thenComparing(s -> s.recipe().getName()))
                .toList();
        return new RankResult(winners, partial);
    }

    /**
     * How strongly ONE token hits ONE recipe, 0 when it does not. The name outranks the
     * ingredients, which outrank the classification axes — asking for a recipe BY NAME is the
     * most specific intent, and before mezo-sxe it was the one axis the filter ignored entirely.
     */
    private static int tokenWeight(RecipeResponse r, String token) {
        if (ToolText.containsFolded(r.getName(), token)) {
            return 4;
        }
        if (r.getIngredients() != null
                && r.getIngredients().stream().anyMatch(i -> ToolText.containsFolded(i.getName(), token))) {
            return 3;
        }
        if (ToolText.containsFolded(r.getSlot(), token) || ToolText.containsFolded(r.getCategory(), token)
                || ToolText.containsFolded(r.getRole(), token)) {
            return 2;
        }
        if (r.getTags() != null && r.getTags().stream().anyMatch(t -> ToolText.containsFolded(t, token))) {
            return 2;
        }
        if (r.getMezoFit() != null && r.getMezoFit().getFitsFor() != null
                && r.getMezoFit().getFitsFor().stream().anyMatch(f -> ToolText.containsFolded(f, token))) {
            return 2;
        }
        // There is no literal substring to match against a boolean, so the starred flag answers to
        // a fixed keyword set — matched as a WHOLE token. It used to match bidirectionally
        // (keyword.contains(needle)), which made "cs" or "a" return every starred recipe.
        return Boolean.TRUE.equals(r.getStarred()) && STARRED_KEYWORDS.contains(token) ? 2 : 0;
    }

    /** Compact per-recipe line: name (category): kcal/protein + fit score (null-guarded — no "pending" score renders). */
    private String renderRecipeList(List<RecipeResponse> recipes, ToolContext toolContext) {
        StringBuilder b = new StringBuilder("Receptek:");
        appendRecipeLines(b, recipes, toolContext);
        return b.toString();
    }

    /** The per-recipe lines shared by {@link #renderRecipeList} and the partial-match list branch
     *  (mezo-280 Finding 2) — the latter supplies its own "Receptek — ... (részleges egyezés):"
     *  header, so it appends lines onto that instead of duplicating the plain "Receptek:" one. */
    private void appendRecipeLines(StringBuilder b, List<RecipeResponse> recipes, ToolContext toolContext) {
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
    }

    /** Full detail for the best scorer, plus a compact tail naming the runner-ups (mezo-280
     *  Finding 1): the name>ingredient weighting makes "top scorer one point ahead" the COMMON
     *  case, not the rare one, so a clear winner must not silently hide the other recipes that
     *  also matched. Capped at 4 (the list render is already capped at 5). */
    private String renderRecipeDetailWithRunnerUps(List<ScoredRecipe> winners, ToolContext toolContext) {
        StringBuilder b = new StringBuilder(renderRecipeDetail(winners.get(0).recipe(), toolContext));
        List<ScoredRecipe> runnerUps = winners.stream().skip(1).limit(4).toList();
        if (!runnerUps.isEmpty()) {
            b.append("\nTovábbi találatok: ").append(runnerUps.stream()
                    .map(s -> s.recipe().getName())
                    .collect(Collectors.joining(", ")));
            for (ScoredRecipe s : runnerUps) {
                ToolContexts.audit(toolContext).addRef("Recipe", s.recipe().getName());
            }
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

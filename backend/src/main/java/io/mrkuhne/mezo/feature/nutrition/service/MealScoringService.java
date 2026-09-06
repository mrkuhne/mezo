package io.mrkuhne.mezo.feature.nutrition.service;

import io.mrkuhne.mezo.feature.nutrition.config.MealScoringProperties;
import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.ContextRow;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.Dimension;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.MacroDetail;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.MicroRow;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.NovaDetail;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.NovaItemRow;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.NovaStackRow;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.TimingDetail;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.ToolRow;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * The deterministic meal-score engine (mezo-yta, ADR 0006): pure math over already-resolved
 * {@link ScoredLine} carriers + config — no repository access, fully unit-testable. Formulas:
 * docs/superpowers/specs/2026-07-05-fuel-p7-meal-scoring-design.md §3.
 *
 * <p>The 8-dimension weighted model (mezo-7797): Macro · Rost · WHO · Zsírminőség · NOVA ·
 * Növényi diverzitás · Energia-sűrűség · Context/Portion. {@link #scoreMeal} emits the meal
 * surface (all except portion, incl. slot/timing context); {@link #recipeTemplateBreakdown}
 * emits the template surface (all except context — portion replaces it), weights renormalized.
 *
 * <p>Honesty rules: a dimension with zero input coverage degrades to {@code weight 0, score 0}
 * with a "Nincs adat" detail (the total renormalizes); {@code summary}/{@code improve} stay
 * null/empty (P8 prose); a profile with no kcal at all yields NO fit score (null), never a
 * fabricated neutral.
 */
@Service
@RequiredArgsConstructor
public class MealScoringService {

    /**
     * A determinisztikus formula generációja. **Bumpold**, valahányszor egy változás a MÁR TÁROLT
     * envelope-ok számait elmozdítaná — ez az egyetlen jel, amiből a mezo-jcpt.2 backfill runner
     * tudja, melyik sort kell újrapontozni. A `1` az első bélyegzett generáció: a súly-
     * renormalizálás (`d51ec268b`) + a makró kcal-szignifikancia-skálázás (`01b194ac7`) UTÁNI
     * állapot. A bélyeg nélküli (`null`) envelope-ok az azok ELŐTTI, javítandó generáció.
     *
     * <p>`2` (mezo-1f7b): a PER-TÉNY lefedettség. Addig egyetlen `hasMicroFacts` OR-boolean
     * fedte le mind a négy tápanyag-tényt, ezért egy CSAK rostot hordozó tétel teljes
     * lefedettséget hazudott a telített zsírra is — a hiányzó satFat 0 g-ként összegződött, és a
     * Zsírminőség rendre 100 pontot adott (a kamra-katalógus 147 sorából 2-ben van satFat).
     * Mostantól minden lefedettség-kapuzott dimenzió a SAJÁT tényét nézi, és a saját FEDETT
     * energiáján belül mér (a nevező a fedett kcal, nem a teljes) — a nem látott rész a
     * `coverage`-ben jelenik meg, nem hígított számként.
     *
     * <p>`3` (mezo-mxmh): a bélyeg NEM csak akkor mozdul, ha a SZÁMOK mennek el. Az S1 egy új
     * mezőt (`coverage`) és rövidebb `detail` mondatokat hozott — a tárolt envelope-ok számai
     * változatlanok, de a szövegük elavult, a mezőjük pedig `null`, tehát a jelvény a MEGLÉVŐ
     * étkezéseken sosem jelenne meg. Egy csak-új-írásokra ható megjelenítés nem javítás.
     * Emellett az energia-sűrűség kapott egy minimális tömeg-küszöböt, ami már számot is mozdít.
     *
     * <p>`4` (mezo-jcpt.19): a context dimenzió nap-tudatos lett. A statikus slot-arány
     * (`napi_cél × slot_arány`) helyett a MARADÉK keret a még hátralévő slotok között felosztva —
     * a régi képlet nem tudta, evett-e a felhasználó aznap, ezért egy egész napi koplalás utáni
     * nagy étkezés kcal-komponensét nullázta. A névleges pályán a két képlet azonos, tehát a
     * történelmi „szabályos" napok pontszáma nem mozdul. Mivel a mezo-mxmh kör PÁRHUZAMOSAN, a
     * `3`-as bélyeg alatt futott a fő ágon, ez a generáció a KÖVETKEZŐ bélyeget veszi fel — a
     * backfill runner minden `4` ALATTI envelope-ot újrapontoz, tehát a 2-es és 3-as sorok egy
     * menetben gyógyulnak.
     */
    public static final int FORMULA_VERSION = 4;

    private final MealScoringProperties props;
    private final NutritionTargetsProperties targets;

    /**
     * One meal/recipe line with its contribution + nutrition-quality facts ALREADY SCALED to the
     * line's amount (the caller owns the amount/per scaling — same formula as the macro snapshot).
     * A quality fact is {@code null} exactly when the SOURCE carried no value — never 0 — and each
     * coverage-gated dimension reads its OWN fact ({@code fiberG} → micro, {@code sugarG}/
     * {@code saltG} → who, {@code saturatedFatG} → fat quality), because they are populated
     * independently (mezo-1f7b). {@code category} feeds plant-diversity (null on estimate lines);
     * {@code amountG} feeds energy-density (null for discrete units).
     */
    public record ScoredLine(
        String name,
        String amountLabel,
        BigDecimal kcal, BigDecimal p, BigDecimal c, BigDecimal f,
        Short nova,
        BigDecimal fiberG, BigDecimal sugarG, BigDecimal saltG, BigDecimal saturatedFatG,
        String category,      // pantry category (plant-diversity input); null on estimate lines
        BigDecimal amountG    // line amount in grams (g/ml≈g); null for discrete units
    ) {
    }

    /**
     * A workout on the meal's date, reduced to what role-classification needs (mezo-ta8p):
     * the schedule-slot start, the derived end, and whether it was actually done that day
     * (gates the POST_WORKOUT recovery bonus). Owned by the scorer like {@link ScoredLine} so the
     * nutrition slice never depends on the train slice — {@code MealService} maps train windows in.
     */
    public record WorkoutWindow(LocalTime start, LocalTime end, boolean done) {
    }

    /** The role-sensitive tunables a rubric overlay swaps (mezo-ta8p/mezo-uavr). */
    private record Rubric(int p, int c, int f, MealScoringProperties.WhoRefs who,
                          MealScoringProperties.NovaGroupScores nova) {
    }

    /**
     * The rubric a role scores under. STANDARD = the base targets/who/nova (identity overlay);
     * PRE/POST_WORKOUT take their fully-specified bundle from {@code mezo.fuel.scoring.roles}.
     * ONE helper for both the logged-meal and the recipe-template surface, so the two can never
     * drift apart (mezo-uavr).
     */
    private Rubric rubricFor(MealRole role, DailyTargets base) {
        if (role == MealRole.PRE_WORKOUT || role == MealRole.POST_WORKOUT) {
            MealScoringProperties.RoleRubric r =
                role == MealRole.PRE_WORKOUT ? props.roles().pre() : props.roles().post();
            return new Rubric(r.p(), r.c(), r.f(), r.who(), r.nova());
        }
        return new Rubric(base.p(), base.c(), base.f(), props.who(), props.nova());
    }

    /** Backward-compatible entry: scores with no training context (STANDARD rubric). */
    public MealBreakdownJson scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime) {
        return scoreMeal(slot, lines, localTime, MealRole.STANDARD);
    }

    /** Config-fallback entry: scores against the static mezo.nutrition targets. */
    public MealBreakdownJson scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime,
                                       MealRole role) {
        return scoreMeal(slot, lines, localTime, role, DailyTargets.fromConfig(targets));
    }

    /**
     * Scores against the RESOLVED day targets (mezo-3g5w): the goal's prescription segment when
     * one covers the meal's date, else the config fallback — the caller resolves, the scorer
     * stays pure. The role rubric (PRE/POST absolute macro bundles) is unaffected; {@code base}
     * replaces every former {@code mezo.nutrition} read: the STANDARD macro targets and all
     * day-share denominators (kcalShareOfDay, slot kcal budgets, slot protein references).
     *
     * <p>Napi kontextus nélküli belépő (mezo-jcpt.19): a NÉVLEGES pályát feltételezi
     * ({@link DayContext#unknown()}), ami bitre a v2 rubrika. A produkciós írásút mindig a
     * 6-argumentumos alakot hívja.
     */
    public MealBreakdownJson scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime,
                                       MealRole role, DailyTargets base) {
        return scoreMeal(slot, lines, localTime, role, base, DayContext.unknown());
    }

    /**
     * Nap-tudatos pontozás (mezo-jcpt.19): a context dimenzió az étkezés kcal-ját és fehérjéjét a
     * MARADÉK napi kerethez méri, a még hátralévő slotok között felosztva — a statikus slot-arány
     * helyett, ami nem tudta, hogy a felhasználó aznap evett-e egyáltalán. A többi hét dimenzió
     * érintetlen: az energiasűrűség és a makró-arányok nem napi mennyiségek.
     *
     * <p>Confidence is weight-RENORMALIZED over the live dimensions (÷ the live weight sum,
     * consistent with {@code value}) — a degraded dimension carries weight 0 and drops out of
     * both. This differs from the old un-normalized {@code Σ(configWeight·coverage)}: it
     * INTENTIONALLY reads higher for a degraded meal (the reading is "confidence across the
     * dimensions we could actually score", not "of the full weight budget").
     */
    public MealBreakdownJson scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime,
                                       MealRole role, DailyTargets base, DayContext day) {
        double kcal = sum(lines, ScoredLine::kcal);

        Rubric rubric = rubricFor(role, base);
        int tp = rubric.p();
        int tc = rubric.c();
        int tf = rubric.f();
        MealScoringProperties.WhoRefs who = rubric.who();
        MealScoringProperties.NovaGroupScores nova = rubric.nova();

        List<Dim> dims = Stream.of(
            macroDim(lines, kcal, tp, tc, tf, base, role), microDim(lines, kcal, base), whoDim(lines, kcal, who, base),
            fatQualityDim(lines, kcal), novaDim(lines, kcal, nova), plantDiversityDim(lines, kcal),
            energyDensityDim(lines, kcal), contextDim(slot, lines, kcal, localTime, role, base, day))
            .map(Dim::coverageWeighted).toList();

        double weightSum = dims.stream().mapToDouble(d -> d.effectiveWeight).sum();
        double value = weightSum == 0 ? 0
            : dims.stream().mapToDouble(d -> d.effectiveWeight * d.score).sum() / weightSum;
        double confidence = weightSum == 0 ? 0
            : dims.stream().mapToDouble(d -> d.effectiveWeight * d.coverage).sum() / weightSum;

        List<Dimension> jsonDims = weightSum == 0
            ? dims.stream().map(Dim::toJson).toList()
            : dims.stream().map(d -> d.renormalized(weightSum).toJson()).toList();
        return new MealBreakdownJson(round2(value), round2(confidence), null, null,
            jsonDims, List.of(),
            tools(slot, lines, dims, localTime, base), FORMULA_VERSION);
    }

    /**
     * Deterministic recipe fit over the per-serving profile: the template surface (all except
     * context — portion replaces it), weights renormalized. Returns {@code null} when the profile
     * carries no kcal at all — pending badge, never a fabricated number.
     *
     * <p>Since mezo-bw3y a thin delegate of {@link #recipeTemplateBreakdown}, so the fit badge and
     * the template-breakdown envelope can never disagree. {@code slot} (nullable) budgets the
     * portion dimension; a slot-less recipe falls back to the configured default share.
     */
    public BigDecimal recipeFit(String slot, List<ScoredLine> perServingLines) {
        return recipeFit(slot, perServingLines, MealRole.STANDARD);
    }

    /**
     * The template fit under an explicit {@link MealRole} (mezo-uavr) — the recipe's OWN declared
     * role, not a logged-meal classification. A thin delegate of
     * {@link #recipeTemplateBreakdown(String, List, MealRole)}, so the badge and the envelope can
     * never disagree.
     */
    public BigDecimal recipeFit(String slot, List<ScoredLine> perServingLines, MealRole role) {
        MealBreakdownJson breakdown = recipeTemplateBreakdown(slot, perServingLines, role);
        return breakdown == null ? null : breakdown.value();
    }

    /**
     * Full template envelope for a recipe (mezo-bw3y): the SAME dimensions the fit scores (weights
     * renormalized over the present ones, so the UI's {@code × súly = pt} rows sum to the total
     * honestly). The template surface is the meal surface minus context plus portion — a template
     * has no logged time/slot, so timing/context is evaluated on the meal side, while portion
     * scores the per-serving kcal against the slot budget. {@code summary}/{@code improve} stay
     * null/empty here — the AI prose layer merges over them (RecipeBreakdownProseService).
     * Null exactly when the profile carries no kcal / no scorable dimension.
     */
    public MealBreakdownJson recipeTemplateBreakdown(String slot, List<ScoredLine> perServingLines) {
        return recipeTemplateBreakdown(slot, perServingLines, MealRole.STANDARD);
    }

    /**
     * The template envelope under an explicit {@link MealRole} (mezo-uavr): the role selects the
     * SAME rubric overlay {@link #scoreMeal} uses ({@link #rubricFor}) — macro targets, WHO sugar
     * limit, NOVA class scores — so a pre/post-workout recipe is judged as fuel, not penalized for
     * being fast carbs. STANDARD is the identity overlay: byte-for-byte the pre-role score.
     *
     * <p>{@code portionDim(slot, kcal)} stays role-INDEPENDENT (spec §4): the per-serving kcal vs
     * the slot budget is a property of the portion, not of the training context.
     */
    public MealBreakdownJson recipeTemplateBreakdown(String slot, List<ScoredLine> perServingLines,
                                                    MealRole role) {
        double kcal = sum(perServingLines, ScoredLine::kcal);
        if (kcal <= 0) {
            return null;
        }
        DailyTargets base = DailyTargets.fromConfig(targets);
        Rubric rubric = rubricFor(role, base);
        List<Dim> live = Stream.of(
            macroDim(perServingLines, kcal, rubric.p(), rubric.c(), rubric.f(), base, role),
            microDim(perServingLines, kcal, base), whoDim(perServingLines, kcal, rubric.who(), base),
            fatQualityDim(perServingLines, kcal),
            novaDim(perServingLines, kcal, rubric.nova()), plantDiversityDim(perServingLines, kcal),
            energyDensityDim(perServingLines, kcal), portionDim(slot, kcal, base))
            .map(Dim::coverageWeighted).toList();
        double weightSum = live.stream().mapToDouble(d -> d.effectiveWeight).sum();
        if (weightSum == 0) {
            return null;
        }
        double value = live.stream().mapToDouble(d -> d.effectiveWeight * d.score).sum() / weightSum;
        double confidence = live.stream().mapToDouble(d -> d.effectiveWeight * d.coverage).sum() / weightSum;

        List<Dimension> dims = new ArrayList<>();
        for (Dim d : live) {
            dims.add(d.renormalized(weightSum).toJson());
        }

        List<ToolRow> tools = new ArrayList<>();
        tools.add(new ToolRow("read", "recipe.line_snapshots(n=" + perServingLines.size() + ")"));
        tools.add(new ToolRow("compute", "macroFit(config)"));
        tools.add(new ToolRow("compute", "guidelineFit(who, fat_quality)"));
        tools.add(new ToolRow("compute", "templateFit(weights_renormalized)"));

        return new MealBreakdownJson(round2(value), round2(confidence), null, null, dims, List.of(),
            tools, FORMULA_VERSION);
    }

    /**
     * Classifies a logged meal's training role (mezo-ta8p). PRE_WORKOUT when the meal falls in
     * {@code [start - preLeadMin, start)} of any workout (plan-based; looks forward). POST_WORKOUT
     * when it falls in {@code [end, end + postTrailMin]} of a workout that was actually DONE.
     * Multiple qualifying workouts: the nearest by time; a done-post and an upcoming-pre tie
     * resolves to POST_WORKOUT (recovery is the more time-critical need). Otherwise STANDARD.
     */
    public static MealRole classifyRole(LocalTime t, List<WorkoutWindow> workouts,
                                        int preLeadMin, int postTrailMin) {
        MealRole best = MealRole.STANDARD;
        double bestDistance = Double.MAX_VALUE;
        int tMin = t.getHour() * 60 + t.getMinute();
        for (WorkoutWindow w : workouts) {
            int start = w.start().getHour() * 60 + w.start().getMinute();
            int end = w.end().getHour() * 60 + w.end().getMinute();
            if (w.done() && tMin >= end && tMin <= end + postTrailMin) {
                double d = tMin - end;
                if (best != MealRole.POST_WORKOUT || d < bestDistance) { // post always beats a pre tie
                    best = MealRole.POST_WORKOUT;
                    bestDistance = d;
                }
            } else if (tMin >= start - preLeadMin && tMin < start) {
                double d = start - tMin;
                if (best == MealRole.STANDARD && d < bestDistance) { // never override a POST_WORKOUT
                    best = MealRole.PRE_WORKOUT;
                    bestDistance = d;
                }
            }
        }
        return best;
    }

    // --- Macro (.30): kcal-share fit vs the mezo.nutrition targets -----------------------------

    private Dim macroDim(List<ScoredLine> lines, double kcal, int targetP, int targetC, int targetF,
                        DailyTargets base, MealRole role) {
        double p = sum(lines, ScoredLine::p);
        double c = sum(lines, ScoredLine::c);
        double f = sum(lines, ScoredLine::f);
        double macroKcal = p * 4 + c * 4 + f * 9;
        if (kcal <= 0 || macroKcal <= 0) {
            return Dim.degraded("macro", "Kcal & makró arány", props.weights().macro(),
                "Nincs makró-adat a tételekhez.");
        }
        double sp = p * 4 / macroKcal;
        double sc = c * 4 / macroKcal;
        double sf = f * 9 / macroKcal;
        double targetMacroKcal = targetP * 4 + targetC * 4 + targetF * 9;
        double tp = targetP * 4 / targetMacroKcal;
        double tc = targetC * 4 / targetMacroKcal;
        double tf = targetF * 9 / targetMacroKcal;
        // Protein SURPLUS is discounted (0.0 = forgiven — fitness-app policy, mezo-8ms6); a protein
        // deficit and any carb/fat deviation count in full. Factor 1.0 restores total variation.
        double proteinDeviation = sp > tp
            ? (sp - tp) * props.macroProteinSurplusPenalty() : tp - sp;
        double deviation = (proteinDeviation + Math.abs(sc - tc) + Math.abs(sf - tf)) / 2;
        double kcalShare = kcal / base.kcal();
        // A meal's kcal-share of the day gates how much its ratio deviation counts (mezo-jcpt.1):
        // at/above the ref-share it's full weight, below it the penalty scales down linearly — a
        // tiny snack's off-ratio can no longer tank the whole macro dimension.
        double significance = Math.min(1.0, kcalShare / props.macroSignificanceRefShare());
        double score = Math.max(0, 1 - deviation * props.macroDeviationSlope() * significance);

        // A cél EREDETE saját mező, nem a mondat farka (mezo-mxmh): az összecsukott kártya két
        // sorra vágja a `detail`-t, és az 1. körben pont a provenance — az egész átírás értelme —
        // esett a vágás alá. A mondat most rövid és teljes; az eredet a kinyitott panelben áll.
        String origin = String.format(
            "%s · %d g fehérje / %d g szénhidrát / %d g zsír egy %d kcal-s napra",
            targetOrigin(base, role), targetP, targetC, targetF, base.kcal());
        MacroDetail detail = new MacroDetail(
            round0(sp * 100), round0(sc * 100), round0(sf * 100),
            "~" + Math.round(tp * 100) + "%", "~" + Math.round(tc * 100) + "%", "~" + Math.round(tf * 100) + "%",
            round1(kcalShare * 100),
            origin,
            null); // P8 prose
        // Rövid, de teljes: a lényeg (mit néz — kcal-arányt, nem grammot — és mihez képest) elfér
        // a kártya két sorában. Az eredet és a napi részesedés a panelben (mezo-mxmh).
        String text = String.format(
            "Az energia %d%% fehérje · %d%% szénhidrát · %d%% zsír — a cél %d/%d/%d%%.",
            Math.round(sp * 100), Math.round(sc * 100), Math.round(sf * 100),
            Math.round(tp * 100), Math.round(tc * 100), Math.round(tf * 100));
        return new Dim("macro", "Kcal & makró arány", props.weights().macro(), score, 1.0, text,
            detail, null, null, null, null);
    }

    /**
     * Honnan jön a makró-cél, egy tagmondatban — a cél SOSEM „csak úgy annyi" (mezo-1f7b).
     * A rubrika (edzés előtt/után) felülírja a napi arányokat, különben a nap forrása dönt:
     * az aktív cél előírt szegmense ({@code "goal"}) vagy a statikus alapbeállítás.
     */
    private static String targetOrigin(DailyTargets base, MealRole role) {
        if (role == MealRole.PRE_WORKOUT) {
            return "az edzés előtti rubrika (gyors szénhidrát-hangsúly)";
        }
        if (role == MealRole.POST_WORKOUT) {
            return "az edzés utáni regenerációs rubrika";
        }
        return "goal".equals(base.source())
            ? "az aktív célod napi előírása"
            : "az alapértelmezett napi keret (nincs aktív cél-előírás erre a napra)";
    }

    // --- Micro (.10): fiber target (sugar/salt/satFat redistributed to who/fat-quality) ---------

    /**
     * The kcal a fact is actually KNOWN over (mezo-1f7b). Every coverage-gated dimension measures
     * inside this energy — the meal's unseen part shows up as {@code coverage}, never as a diluted
     * (falsely flattering) number.
     */
    private static double coveredKcal(List<ScoredLine> lines,
                                      java.util.function.Function<ScoredLine, BigDecimal> fact) {
        return lines.stream().filter(l -> fact.apply(l) != null)
            .mapToDouble(l -> dbl(l.kcal())).sum();
    }

    private Dim microDim(List<ScoredLine> lines, double kcal, DailyTargets base) {
        double seen = coveredKcal(lines, ScoredLine::fiberG);
        double coverage = kcal > 0 ? seen / kcal : 0;
        if (kcal <= 0 || coverage == 0) {
            return Dim.degraded("micro", "Rost & mikro", props.weights().micro(),
                "Nincs rost-adat a tételekhez.");
        }
        // The allotment follows the SEEN energy, not the whole meal: half a meal's fiber must not
        // be judged against the whole meal's fiber budget.
        double kcalShare = seen / base.kcal();
        double fiber = sum(lines, ScoredLine::fiberG);
        double fiberRatio = fiber / (props.micro().fiberG() * kcalShare);
        double score = Math.min(1, fiberRatio);
        List<MicroRow> rows = List.of(
            new MicroRow("Rost", grams(fiber), pct(fiberRatio), fiberStatus(fiberRatio)));
        String text = String.format("Rost %s a(z) %s allotmenthez (%d%%).",
            grams(fiber), grams(props.micro().fiberG() * kcalShare), pct(fiberRatio));
        return new Dim("micro", "Rost & mikro", props.weights().micro(), score, coverage, text,
            null, rows, null, null, null);
    }

    // --- WHO (.14): free-sugar energy-share + salt allotment (mezo-7797) -----------------------

    private Dim whoDim(List<ScoredLine> lines, double kcal, MealScoringProperties.WhoRefs who,
                      DailyTargets base) {
        // Sugar and salt are populated INDEPENDENTLY on a source row, so each carries its own
        // coverage; a meal that only knows its salt is scored on salt alone, not on a fabricated
        // "0 g sugar" (mezo-1f7b).
        double sugarKcal = coveredKcal(lines, ScoredLine::sugarG);
        double saltKcal = coveredKcal(lines, ScoredLine::saltG);
        double sugarCov = kcal > 0 ? sugarKcal / kcal : 0;
        double saltCov = kcal > 0 ? saltKcal / kcal : 0;
        if (kcal <= 0 || (sugarCov == 0 && saltCov == 0)) {
            return Dim.degraded("who", "Ajánlások · WHO", props.weights().who(),
                "Nincs cukor/só-adat a tételekhez.");
        }
        double sugar = sum(lines, ScoredLine::sugarG);
        double salt = sum(lines, ScoredLine::saltG);
        double sugarShare = sugarCov > 0 ? sugar * 4 / sugarKcal : 0;
        double saltBudget = who.saltLimitG() * (saltKcal / base.kcal());
        double sugarRatio = sugarShare / who.sugarEnergyShareLimit();
        double saltRatio = saltBudget > 0 ? salt / saltBudget : 0;
        List<Double> subs = new ArrayList<>();
        if (sugarCov > 0) {
            subs.add(limitSub(sugarRatio));
        }
        if (saltCov > 0) {
            subs.add(limitSub(saltRatio));
        }
        double score = subs.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double coverage = (sugarCov + saltCov) / 2;
        List<ContextRow> rows = List.of(
            new ContextRow("Cukor", sugarCov > 0
                ? String.format("%.0f E%% / %.0f E%% limit", sugarShare * 100,
                    who.sugarEnergyShareLimit() * 100)
                : "nincs adat"),
            new ContextRow("Só", saltCov > 0
                ? String.format("%s / %s keret", grams(salt), grams(saltBudget))
                : "nincs adat"));
        String text = String.format("%s · %s",
            sugarCov > 0
                ? String.format("Cukor az energia %.0f%%-a (WHO ≤%.0f%%)", sugarShare * 100,
                    who.sugarEnergyShareLimit() * 100)
                : "Cukor: nincs adat",
            saltCov > 0 ? String.format("só a keret %d%%-án", pct(saltRatio)) : "só: nincs adat");
        return new Dim("who", "Ajánlások · WHO", props.weights().who(), score, coverage, text,
            null, null, null, rows, null);
    }

    // --- Fat quality (.10): satFat energy-share + saturated share of total fat -----------------

    /**
     * Reads ONLY {@code saturatedFatG} for its coverage (mezo-1f7b). Before this, the dimension
     * shared one OR-ed "has any nutrient fact" flag with micro/who: a bread line carrying fiber
     * made the whole meal count as covered, the absent saturated fat summed as 0 g, and every such
     * meal scored a perfect 100 — the failure the user reported on a tojás/avokádó/bacon log.
     * Both the energy and the total-fat denominators are now the SEEN lines' own.
     */
    private Dim fatQualityDim(List<ScoredLine> lines, double kcal) {
        List<ScoredLine> seenLines = lines.stream().filter(l -> l.saturatedFatG() != null).toList();
        double seen = seenLines.stream().mapToDouble(l -> dbl(l.kcal())).sum();
        double coverage = kcal > 0 ? seen / kcal : 0;
        double fat = sum(seenLines, ScoredLine::f);
        if (kcal <= 0 || coverage == 0 || fat <= 0) {
            return Dim.degraded("fat_quality", "Zsírminőség", props.weights().fatQuality(),
                "Nincs telítettzsír-adat a tételekhez.");
        }
        double satFat = sum(seenLines, ScoredLine::saturatedFatG);
        double satShare = Math.min(1, satFat / fat);
        double satEnergyShare = satFat * 9 / seen;
        double score = (limitSub(satEnergyShare / props.fatQuality().satFatEnergyShareLimit())
            + limitSub(satShare / props.fatQuality().satFatShareRef())) / 2;
        List<ContextRow> rows = List.of(
            new ContextRow("Telített zsír", grams(satFat)),
            new ContextRow("Telített E%", String.format(Locale.ROOT, "%.1f%% / %.0f%% limit",
                satEnergyShare * 100, props.fatQuality().satFatEnergyShareLimit() * 100)),
            new ContextRow("Telített/összzsír", String.format("%.0f%% (ref. %.0f%%)",
                satShare * 100, props.fatQuality().satFatShareRef() * 100)));
        // Locale.ROOT: a fractional %f otherwise renders "66,0" on a hu_HU JVM and "66.0" on the
        // server's default — the same stored envelope must not read differently per host.
        String text = String.format(Locale.ROOT,
            "Telített zsír %s — az energia %.1f%%-a · az összzsír %.0f%%-a.",
            grams(satFat), satEnergyShare * 100, satShare * 100);
        return new Dim("fat_quality", "Zsírminőség", props.weights().fatQuality(), score, coverage,
            text, null, null, null, rows, null);
    }

    // --- Plant diversity (.08): distinct plant categories ---------------------------------------

    private Dim plantDiversityDim(List<ScoredLine> lines, double kcal) {
        List<ScoredLine> categorized = lines.stream().filter(l -> l.category() != null).toList();
        double coveredKcal = categorized.stream().mapToDouble(l -> dbl(l.kcal())).sum();
        double coverage = kcal > 0 ? coveredKcal / kcal : 0;
        if (kcal <= 0 || coverage == 0) {
            return Dim.degraded("plant_diversity", "Növényi diverzitás",
                props.weights().plantDiversity(), "Nincs kategória-adat a tételekhez.");
        }
        List<String> plants = categorized.stream().map(ScoredLine::category).distinct()
            .filter(props.plantDiversity().plantCategories()::contains).sorted().toList();
        double score = Math.min(1, (double) plants.size() / props.plantDiversity().targetCategories());
        List<ContextRow> rows = new ArrayList<>();
        rows.add(new ContextRow("Növényi kategóriák", plants.isEmpty() ? "—" : String.join(" · ", plants)));
        rows.add(new ContextRow("Összesen", plants.size() + " / " + props.plantDiversity().targetCategories() + " cél"));
        String text = String.format("%d különböző növényi kategória a %d-s célhoz.",
            plants.size(), props.plantDiversity().targetCategories());
        return new Dim("plant_diversity", "Növényi diverzitás", props.weights().plantDiversity(),
            score, coverage, text, null, null, null, rows, null);
    }

    // --- Energy density (.06): kcal/100g over gram-mass lines -----------------------------------

    private Dim energyDensityDim(List<ScoredLine> lines, double kcal) {
        List<ScoredLine> gramLines = lines.stream()
            .filter(l -> l.amountG() != null && l.amountG().signum() > 0).toList();
        double gramKcal = gramLines.stream().mapToDouble(l -> dbl(l.kcal())).sum();
        double grams = gramLines.stream().mapToDouble(l -> l.amountG().doubleValue()).sum();
        double coverage = kcal > 0 ? gramKcal / kcal : 0;
        if (kcal <= 0 || grams <= 0 || coverage == 0) {
            return Dim.degraded("energy_density", "Energia-sűrűség", props.weights().energyDensity(),
                "Nincs gramm-alapú mennyiség a tételekhez.");
        }
        // kcal/100g a TELÍTŐDÉST méri — mennyi energiát hoz egy adagnyi étel tömege —, és ennek
        // csak étkezés-méretű tömegen van értelme. Egy 30 g-os fehérjepor 390 kcal/100g-mal
        // 0,04 pontot kapott, holott az a 30 g egy ~300 ml-es italként kerül a gyomorba: a por
        // száraz tömege nem az a mennyiség, amiről a dimenzió állítást tesz (mezo-mxmh).
        if (grams < props.energyDensity().minMassG()) {
            return Dim.degraded("energy_density", "Energia-sűrűség", props.weights().energyDensity(),
                String.format(Locale.ROOT,
                    "Csak %.0f g gramm-alapú tétel — %.0f g alatt a kcal/100g nem telítődést mér.",
                    grams, props.energyDensity().minMassG()));
        }
        double density = gramKcal / grams * 100;
        double good = props.energyDensity().goodKcalPer100g();
        double bad = props.energyDensity().badKcalPer100g();
        double score = density <= good ? 1 : density >= bad ? 0 : (bad - density) / (bad - good);
        List<ContextRow> rows = List.of(
            new ContextRow("Sűrűség", String.format("%.0f kcal/100g", density)),
            new ContextRow("Mért tömeg", String.format("%.0f g · %.0f kcal", grams, gramKcal)),
            new ContextRow("Lefedettség", pct(coverage) + "% gramm-alapú"));
        // Csak a GRAMM-alapú tételeken mérhető: a darabos (db/adag) tételek se a tömegbe, se a
        // kcal-ba nem számítanak — ezért mondja ki a mondat, mennyi a mért rész (mezo-1f7b).
        String text = String.format(
            "%.0f g étel %.0f kcal-t hoz — %.0f kcal/100g (%.0f alatt teljes pont, %.0f felett nulla).",
            grams, gramKcal, density, good, bad);
        return new Dim("energy_density", "Energia-sűrűség", props.weights().energyDensity(),
            score, coverage, text, null, null, null, rows, null);
    }

    // --- Portion (.12, template only): per-serving kcal vs the slot budget ----------------------

    private Dim portionDim(String slot, double kcal, DailyTargets base) {
        double share = slot == null ? props.portion().defaultShare() : props.slotShares().of(slot);
        double budget = base.kcal() * share;
        double rel = kcal / budget;
        double deviation = Math.max(0, Math.abs(rel - 1) - props.slotShareTolerance());
        double score = Math.max(0, 1 - deviation);
        List<ContextRow> rows = List.of(
            new ContextRow("Adag kcal", String.format("%.0f kcal", kcal)),
            new ContextRow("Slot-büdzsé", String.format("%.0f kcal (%s %.0f%%)",
                budget, slot == null ? "alap" : slotLabel(slot), share * 100)));
        String text = String.format("Egy adag a %s büdzsé %d%%-a.",
            slot == null ? "alapértelmezett" : slotLabel(slot), (int) Math.round(rel * 100));
        return new Dim("portion", "Adag-arány", props.weights().portion(), score, 1.0, text,
            null, null, null, rows, null);
    }

    /** Limit subscore: 1.0 while inside the allotment, then linear to 0 at 2× the allotment. */
    private static double limitSub(double ratio) {
        return ratio <= 1 ? 1 : Math.max(0, 2 - ratio);
    }

    private static String fiberStatus(double ratio) {
        return ratio >= 0.8 ? "good" : ratio >= 0.5 ? "ok" : "low";
    }

    // --- NOVA (.18): kcal-weighted processing-class distribution -------------------------------

    private Dim novaDim(List<ScoredLine> lines, double kcal, MealScoringProperties.NovaGroupScores nova) {
        List<ScoredLine> covered = lines.stream().filter(l -> l.nova() != null).toList();
        double coveredKcal = covered.stream().mapToDouble(l -> dbl(l.kcal())).sum();
        double coverage = kcal > 0 ? coveredKcal / kcal : 0;
        if (kcal <= 0 || coveredKcal <= 0) {
            return Dim.degraded("nova", "Feldolgozottság · NOVA", props.weights().nova(),
                "Nincs NOVA-adat a tételekhez.");
        }
        double[] groupKcal = new double[5];
        for (ScoredLine l : covered) {
            groupKcal[Math.min(4, Math.max(1, l.nova()))] += dbl(l.kcal());
        }
        double score = 0;
        int dominant = 1;
        List<NovaStackRow> stack = new ArrayList<>(4);
        for (int g = 1; g <= 4; g++) {
            double share = groupKcal[g] / coveredKcal;
            score += share * nova.of(g);
            if (groupKcal[g] > groupKcal[dominant]) {
                dominant = g;
            }
            final int group = g;
            String label = groupKcal[g] == 0 ? "—" : covered.stream()
                .filter(l -> l.nova() == group).map(ScoredLine::name)
                .collect(Collectors.joining(" · "));
            stack.add(new NovaStackRow(g, (int) Math.round(share * 100), label));
        }
        List<NovaItemRow> items = covered.stream()
            .map(l -> new NovaItemRow(l.name() + " " + l.amountLabel(), l.nova().intValue(), l.nova() == 4))
            .toList();
        String text = String.format("Domináns NOVA %d · a kalóriák %d%%-a NOVA 1–2 forrásból.",
            dominant, (int) Math.round((groupKcal[1] + groupKcal[2]) / coveredKcal * 100));
        return new Dim("nova", "Feldolgozottság · NOVA", props.weights().nova(), score, coverage, text,
            null, null, new NovaDetail(dominant, stack, items), null, null);
    }

    // --- Context (.12): deterministic slot/timing fit -------------------------------------------

    private Dim contextDim(String slot, List<ScoredLine> lines, double kcal, LocalTime localTime,
                           MealRole role, DailyTargets base, DayContext day) {
        double slotShare = props.slotShares().of(slot);
        double timingSub = timingSub(slot, localTime);
        double kcalRef = expectedRef(base.kcal(), day.known() ? day.kcalBefore().doubleValue() : 0,
            slot, slotShare, localTime, day.known());
        double proteinRef = expectedRef(base.p(), day.known() ? day.pBefore().doubleValue() : 0,
            slot, slotShare, localTime, day.known());

        double rel = kcal / kcalRef;
        double shareDev = Math.max(0, Math.abs(rel - 1) - props.slotShareTolerance());
        double shareSub = Math.max(0, 1 - shareDev);
        double protein = sum(lines, ScoredLine::p);
        double proteinSub = Math.min(1, protein / proteinRef);

        double score = (timingSub + shareSub + proteinSub) / 3;
        List<ContextRow> rows = new ArrayList<>();
        if (role != MealRole.STANDARD) {
            rows.add(new ContextRow("Szerep", roleLabel(role)));
        }
        rows.add(new ContextRow("Időzítés", String.format("%s · %s", localTime.format(HHMM), timingSub >= 1
            ? slotLabel(slot) + " ablakban" : "a " + slotLabel(slot) + " ablakon kívül")));
        rows.add(new ContextRow("Adag vs keret", String.format("%d kcal / ~%d kcal %s",
            Math.round(kcal), Math.round(kcalRef),
            day.known() ? "a maradék keretből" : "névleges slot-keret")));
        rows.add(new ContextRow("Fehérje", String.format("%d g / %d g slot-cél",
            Math.round(protein), Math.round(proteinRef))));
        String text = String.format("Időzítés %.0f%% · kcal-keret %.0f%% · fehérje %.0f%%.",
            timingSub * 100, shareSub * 100, proteinSub * 100);
        MealScoringProperties.SlotWindows w = props.slotWindows();
        int[] window = windowOf(w, slot);
        TimingDetail timing = new TimingDetail(
            localTime.format(HHMM),
            hourOrNull(window == null ? null : window[0]),
            hourOrNull(window == null ? null : window[1]),
            slotLabel(slot));
        return new Dim("context", "Időzítés & kontextus", props.weights().context(), score, 1.0, text,
            null, null, null, rows, timing);
    }

    /** A négy pontozott slot — a hátralévő-arány nevezőjének tartománya. */
    private static final List<String> SLOTS = List.of("breakfast", "lunch", "dinner", "snack");

    /**
     * Egy tápanyag viszonyítási kerete ehhez az étkezéshez. Ismeretlen nap esetén a NÉVLEGES pálya
     * ({@code napi cél × slot-arány} — a v2 képlet); ismert nap esetén a MARADÉK keret a még
     * hátralévő slotok között felosztva, soha nem a konfigurált padló alatt.
     */
    private double expectedRef(double dayTarget, double consumedBefore, String slot,
                               double slotShare, LocalTime t, boolean known) {
        if (!known) {
            return dayTarget * slotShare;
        }
        double remaining = Math.max(0, dayTarget - consumedBefore);
        double floor = dayTarget * slotShare * props.minExpectedSlotShareFactor();
        return Math.max(remaining * slotShare / remainingSlotShare(slot, t), floor);
    }

    /**
     * A még HÁTRALÉVŐ slotok arányösszege — ez osztja fel a maradék keretet. Az étkezés SAJÁT
     * slotja mindig hátravan (egy 22:30-kor logolt vacsora továbbra is a vacsora kerete), a
     * snacknek pedig nincs ablaka, tehát az is mindig. Így az eredmény sosem 0.
     *
     * <p>Ismert korlát: a snack a nevezőben AKKOR IS mindig hátralévőnek számít, ha már megette a
     * felhasználó — a kcal-ja viszont már benne van a {@code consumedBefore}-ban. Emiatt a §4.3
     * nulla-regresszió invariáns nem pontosan igaz, ha a névleges pályán VAN elfogyasztott snack:
     * pl. reggeli .25 + ebéd .35 + snack .10 elfogyasztva egy 19:00-s vacsora előtt →
     * {@code remaining = 0.30·T}, {@code remainingSlotShare = dinner .30 + snack .10 = 0.40}, tehát
     * {@code expected = 0.30·T × 0.30/0.40 = 0.225·T} — egy pontosan a saját .30 részét evő vacsora
     * {@code rel = 0.30·T / 0.225·T ≈ 1.33}-at kap az elvárt 1.0 helyett. Ez ma még belefér a
     * {@code slotShareTolerance}-ba (0.4), de csak ~0.07 tartalékkal — egy jövőbeli szigorítás ezt
     * regresszióvá tenné. Szándékosan NEM javítva ebben a körben (dokumentált, ismert korlát).
     */
    private double remainingSlotShare(String slot, LocalTime t) {
        MealScoringProperties.SlotShares shares = props.slotShares();
        double sum = 0;
        for (String candidate : SLOTS) {
            if (candidate.equals(slot) || !windowPassed(candidate, t)) {
                sum += shares.of(candidate);
            }
        }
        return sum;
    }

    /** Egy slot ablaka lejárt, ha az óra a záró órája UTÁN jár; a snacknek nincs ablaka. */
    private boolean windowPassed(String slot, LocalTime t) {
        int[] window = windowOf(props.slotWindows(), slot);
        return window != null && t.getHour() + t.getMinute() / 60.0 > window[1];
    }

    private static final DateTimeFormatter HHMM = DateTimeFormatter.ofPattern("HH:mm").withLocale(Locale.ROOT);

    /** In-window 1.0; outside: linear to 0 at 3h distance. A snack fits at any hour. */
    private double timingSub(String slot, LocalTime t) {
        MealScoringProperties.SlotWindows w = props.slotWindows();
        int[] window = windowOf(w, slot);
        if (window == null) {
            return 1.0;
        }
        double hour = t.getHour() + t.getMinute() / 60.0;
        double distance = hour < window[0] ? window[0] - hour : hour > window[1] ? hour - window[1] : 0;
        return Math.max(0, 1 - distance / 3);
    }

    /** The slot→window mapping SHARED by {@link #timingSub} and the {@code contextDim} timing
     *  detail (mezo-jcpt.3) — one source of truth, so the drawn strip can never disagree with the
     *  score. {@code null} for a snack (fits any hour) and any other unrecognized-but-non-null
     *  slot; a {@code null} slot is NOT handled by the {@code switch} and throws {@link
     *  NullPointerException}, same as the inline switch this helper replaced. */
    private static int[] windowOf(MealScoringProperties.SlotWindows w, String slot) {
        return switch (slot) {
            case "breakfast" -> new int[] {w.breakfastFrom(), w.breakfastTo()};
            case "lunch" -> new int[] {w.lunchFrom(), w.lunchTo()};
            case "dinner" -> new int[] {w.dinnerFrom(), w.dinnerTo()};
            default -> null;
        };
    }

    private static String hourOrNull(Integer h) {
        return h == null ? null : String.format(Locale.ROOT, "%02d:00", h);
    }

    private static String slotLabel(String slot) {
        return switch (slot) {
            case "breakfast" -> "reggeli";
            case "lunch" -> "ebéd";
            case "dinner" -> "vacsora";
            default -> "snack";
        };
    }

    private static String roleLabel(MealRole role) {
        return switch (role) {
            case PRE_WORKOUT -> "Pre-workout üzemanyag-ablak";
            case POST_WORKOUT -> "Post-workout regeneráció";
            case STANDARD -> "Általános";
        };
    }

    // --- Provenance ------------------------------------------------------------------------------

    /** Honest deterministic tool transparency — what the scorer actually read/computed. */
    private List<ToolRow> tools(String slot, List<ScoredLine> lines, List<Dim> dims, LocalTime t,
                                DailyTargets base) {
        long factLines = lines.stream()
            .filter(l -> l.fiberG() != null || l.sugarG() != null || l.saltG() != null
                || l.saturatedFatG() != null)
            .count();
        double microCoverage = dims.stream().filter(d -> d.id().equals("micro")).findFirst()
            .map(Dim::coverage).orElse(0.0);
        double novaCoverage = dims.stream().filter(d -> d.id().equals("nova")).findFirst()
            .map(Dim::coverage).orElse(0.0);
        List<ToolRow> tools = new ArrayList<>();
        tools.add(new ToolRow("read", "meal_item.snapshots(n=" + lines.size() + ")"));
        if (microCoverage > 0) {
            tools.add(new ToolRow("read",
                "pantry.nutrition_facts(" + factLines + "/" + lines.size() + " tétel)"));
        }
        tools.add(new ToolRow("compute", "macroFit(" + base.source() + ")"));
        tools.add(new ToolRow("compute", "guidelineFit(who, fat_quality)"));
        if (novaCoverage > 0) {
            tools.add(new ToolRow("compute", "novaDistribution(kcal_weighted)"));
        }
        tools.add(new ToolRow("compute", "contextFit(slot=" + slot + ", t=" + t + ")"));
        return tools;
    }

    // --- Internal carrier + numeric helpers -------------------------------------------------------

    /** Computed dimension before rounding: keeps the unrounded score for the weighted total. */
    private record Dim(String id, String label, double effectiveWeight, double score,
                       double coverage, String detail, MacroDetail macro, List<MicroRow> micros,
                       NovaDetail nova, List<ContextRow> context, TimingDetail timing) {

        static Dim degraded(String id, String label, double configWeight, String detail) {
            // configWeight intentionally unused: a no-coverage dimension carries weight 0 (honest),
            // the total renormalizes over the rest, and confidence drops via coverage 0.
            return new Dim(id, label, 0, 0, 0, detail, null, null, null, null, null);
        }

        /**
         * A dimension gets as much say as it can SEE (mezo-mxmh): its config weight scaled by
         * coverage, before the renormalization spreads the remainder over the rest. A dimension
         * that knows a quarter of the meal used to speak with the same authority as one that knew
         * all of it — a live envelope claimed a 38.4% saturated-fat share off 30% of the food, at
         * full weight. Continuous on purpose: a threshold ("degrade below 50%") puts a cliff
         * between two near-identical meals, and today's "coverage 0 → weight 0" rule is just this
         * function's endpoint. Applied exactly ONCE, at the two list-building sites — never inside
         * the record's constructor, which {@link #renormalized} also calls.
         */
        Dim coverageWeighted() {
            return new Dim(id, label, effectiveWeight * coverage, score, coverage, detail,
                macro, micros, nova, context, timing);
        }

        /** The same dimension with its weight renormalized over the present dimensions (mezo-bw3y). */
        Dim renormalized(double weightSum) {
            return new Dim(id, label, effectiveWeight / weightSum, score, coverage, detail,
                macro, micros, nova, context, timing);
        }

        Dimension toJson() {
            return new Dimension(id, label, round2(effectiveWeight), round2(score), round2(coverage), detail,
                macro, micros, nova, context, timing, null);
        }
    }

    private static double sum(List<ScoredLine> lines, java.util.function.Function<ScoredLine, BigDecimal> get) {
        return lines.stream().mapToDouble(l -> dbl(get.apply(l))).sum();
    }

    private static double dbl(BigDecimal v) {
        return v == null ? 0 : v.doubleValue();
    }

    private static BigDecimal round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal round1(double v) {
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP);
    }

    private static BigDecimal round0(double v) {
        return BigDecimal.valueOf(v).setScale(0, RoundingMode.HALF_UP);
    }

    private static int pct(double ratio) {
        return (int) Math.round(ratio * 100);
    }

    private static String grams(double v) {
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP)
            .stripTrailingZeros().toPlainString() + " g";
    }
}

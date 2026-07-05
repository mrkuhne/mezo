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
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.ToolRow;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * The deterministic meal-score engine (mezo-yta, ADR 0006): pure math over already-resolved
 * {@link ScoredLine} carriers + config — no repository access, fully unit-testable. Formulas:
 * docs/superpowers/specs/2026-07-05-fuel-p7-meal-scoring-design.md §3.
 *
 * <p>Two entry points share the dimension computations: {@link #scoreMeal} emits the full
 * persisted envelope (4 dimensions incl. slot/timing context); {@link #recipeFit} scores a
 * recipe's per-serving profile on macro+micro+NOVA only, weights renormalized.
 *
 * <p>Honesty rules: a dimension with zero input coverage degrades to {@code weight 0, score 0}
 * with a "Nincs adat" detail (the total renormalizes); {@code summary}/{@code improve} stay
 * null/empty (P8 prose); a profile with no kcal at all yields NO fit score (null), never a
 * fabricated neutral.
 */
@Service
@RequiredArgsConstructor
public class MealScoringService {

    private final MealScoringProperties props;
    private final NutritionTargetsProperties targets;

    /**
     * One meal/recipe line with its contribution + nutrition-quality facts ALREADY SCALED to the
     * line's amount (the caller owns the amount/per scaling — same formula as the macro snapshot).
     * {@code hasMicroFacts} marks whether the source carried any of the four quality facts
     * (drives the micro dimension's coverage → confidence).
     */
    public record ScoredLine(
        String name,
        String amountLabel,
        BigDecimal kcal, BigDecimal p, BigDecimal c, BigDecimal f,
        Short nova,
        BigDecimal fiberG, BigDecimal sugarG, BigDecimal saltG, BigDecimal saturatedFatG,
        boolean hasMicroFacts
    ) {
    }

    /** Scores a logged meal; {@code localTime} is the request's offset-local wall-clock time. */
    public MealBreakdownJson scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime) {
        double kcal = sum(lines, ScoredLine::kcal);

        Dim macro = macroDim(lines, kcal);
        Dim micro = microDim(lines, kcal);
        Dim nova = novaDim(lines, kcal);
        Dim context = contextDim(slot, lines, kcal, localTime);
        List<Dim> dims = List.of(macro, micro, nova, context);

        double weightSum = dims.stream().mapToDouble(d -> d.effectiveWeight).sum();
        double value = weightSum == 0 ? 0
            : dims.stream().mapToDouble(d -> d.effectiveWeight * d.score).sum() / weightSum;
        double confidence = props.weights().macro() * macro.coverage
            + props.weights().micro() * micro.coverage
            + props.weights().nova() * nova.coverage
            + props.weights().context() * context.coverage;

        return new MealBreakdownJson(
            round2(value),
            round2(confidence),
            null,      // P8 prose
            dims.stream().map(Dim::toJson).toList(),
            List.of(), // P8 prose
            tools(slot, lines, micro, nova, localTime));
    }

    /**
     * Deterministic recipe fit over the per-serving profile: macro+micro+NOVA, weights
     * renormalized (no logged time/slot → no context dimension). Returns {@code null} when the
     * profile carries no kcal at all — pending badge, never a fabricated number.
     */
    public BigDecimal recipeFit(List<ScoredLine> perServingLines) {
        double kcal = sum(perServingLines, ScoredLine::kcal);
        if (kcal <= 0) {
            return null;
        }
        List<Dim> dims = List.of(
            macroDim(perServingLines, kcal),
            microDim(perServingLines, kcal),
            novaDim(perServingLines, kcal));
        double weightSum = dims.stream().mapToDouble(d -> d.effectiveWeight).sum();
        if (weightSum == 0) {
            return null;
        }
        return round2(dims.stream().mapToDouble(d -> d.effectiveWeight * d.score).sum() / weightSum);
    }

    // --- Macro (.30): kcal-share fit vs the mezo.nutrition targets -----------------------------

    private Dim macroDim(List<ScoredLine> lines, double kcal) {
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
        double targetMacroKcal = targets.p() * 4 + targets.c() * 4 + targets.f() * 9;
        double tp = targets.p() * 4 / targetMacroKcal;
        double tc = targets.c() * 4 / targetMacroKcal;
        double tf = targets.f() * 9 / targetMacroKcal;
        double deviation = (Math.abs(sp - tp) + Math.abs(sc - tc) + Math.abs(sf - tf)) / 2;
        double score = Math.max(0, 1 - deviation * props.macroDeviationSlope());
        double kcalShare = kcal / targets.kcal();

        MacroDetail detail = new MacroDetail(
            round0(sp * 100), round0(sc * 100), round0(sf * 100),
            "~" + Math.round(tp * 100) + "%", "~" + Math.round(tc * 100) + "%", "~" + Math.round(tf * 100) + "%",
            round1(kcalShare * 100),
            null); // P8 prose
        String text = String.format("P/C/F arány %d/%d/%d%% a %d/%d/%d%% célhoz képest.",
            Math.round(sp * 100), Math.round(sc * 100), Math.round(sf * 100),
            Math.round(tp * 100), Math.round(tc * 100), Math.round(tf * 100));
        return new Dim("macro", "Kcal & makró arány", props.weights().macro(), score, 1.0, text,
            detail, null, null, null);
    }

    // --- Micro (.25): nutrition-quality (fiber target + sugar/salt/satFat limits) --------------

    private Dim microDim(List<ScoredLine> lines, double kcal) {
        double coveredKcal = lines.stream().filter(ScoredLine::hasMicroFacts)
            .mapToDouble(l -> dbl(l.kcal())).sum();
        double coverage = kcal > 0 ? coveredKcal / kcal : 0;
        if (kcal <= 0 || coverage == 0) {
            return Dim.degraded("micro", "Mikro–makro balance", props.weights().micro(),
                "Nincs tápanyag-adat (rost/cukor/só) a tételekhez.");
        }
        double kcalShare = kcal / targets.kcal();
        double fiber = sum(lines, ScoredLine::fiberG);
        double sugar = sum(lines, ScoredLine::sugarG);
        double salt = sum(lines, ScoredLine::saltG);
        double satFat = sum(lines, ScoredLine::saturatedFatG);

        double fiberRatio = fiber / (props.micro().fiberG() * kcalShare);
        double sugarRatio = sugar / (props.micro().sugarLimitG() * kcalShare);
        double saltRatio = salt / (props.micro().saltLimitG() * kcalShare);
        double satFatRatio = satFat / (props.micro().saturatedFatLimitG() * kcalShare);

        double score = (Math.min(1, fiberRatio) + limitSub(sugarRatio) + limitSub(saltRatio)
            + limitSub(satFatRatio)) / 4;
        List<MicroRow> rows = List.of(
            new MicroRow("Rost", grams(fiber), pct(fiberRatio), fiberStatus(fiberRatio)),
            new MicroRow("Cukor", grams(sugar), pct(sugarRatio), limitStatus(sugarRatio)),
            new MicroRow("Só", grams(salt), pct(saltRatio), limitStatus(saltRatio)),
            new MicroRow("Telített zsír", grams(satFat), pct(satFatRatio), limitStatus(satFatRatio)));
        String text = String.format("Rost %s a(z) %s allotmenthez; cukor/só/telített zsír a keret %d/%d/%d%%-án.",
            grams(fiber), grams(props.micro().fiberG() * kcalShare),
            pct(sugarRatio), pct(saltRatio), pct(satFatRatio));
        return new Dim("micro", "Mikro–makro balance", props.weights().micro(), score, coverage, text,
            null, rows, null, null);
    }

    /** Limit subscore: 1.0 while inside the allotment, then linear to 0 at 2× the allotment. */
    private static double limitSub(double ratio) {
        return ratio <= 1 ? 1 : Math.max(0, 2 - ratio);
    }

    private static String fiberStatus(double ratio) {
        return ratio >= 0.8 ? "good" : ratio >= 0.5 ? "ok" : "low";
    }

    private static String limitStatus(double ratio) {
        return ratio <= 1.0 ? "good" : ratio <= 1.5 ? "ok" : "low";
    }

    // --- NOVA (.25): kcal-weighted processing-class distribution -------------------------------

    private Dim novaDim(List<ScoredLine> lines, double kcal) {
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
            score += share * props.nova().of(g);
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
            null, null, new NovaDetail(dominant, stack, items), null);
    }

    // --- Context (.20): deterministic slot/timing fit -------------------------------------------

    private Dim contextDim(String slot, List<ScoredLine> lines, double kcal, LocalTime localTime) {
        double slotShare = props.slotShares().of(slot);
        double timingSub = timingSub(slot, localTime);
        double rel = kcal / (targets.kcal() * slotShare);
        double shareDev = Math.max(0, Math.abs(rel - 1) - props.slotShareTolerance());
        double shareSub = Math.max(0, 1 - shareDev);
        double proteinRef = targets.p() * slotShare;
        double protein = sum(lines, ScoredLine::p);
        double proteinSub = Math.min(1, protein / proteinRef);

        double score = (timingSub + shareSub + proteinSub) / 3;
        List<ContextRow> rows = List.of(
            new ContextRow("Időzítés", String.format("%s · %s", localTime, timingSub >= 1
                ? slotLabel(slot) + " ablakban" : "a " + slotLabel(slot) + " ablakon kívül")),
            new ContextRow("Slot-arány", String.format("%d%% vs ~%d%% cél",
                (int) Math.round(kcal / targets.kcal() * 100), (int) Math.round(slotShare * 100))),
            new ContextRow("Fehérje", String.format("%d g / %d g slot-cél",
                Math.round(protein), Math.round(proteinRef))));
        String text = String.format("Időzítés %.0f%% · kcal-keret %.0f%% · fehérje %.0f%%.",
            timingSub * 100, shareSub * 100, proteinSub * 100);
        return new Dim("context", "Időzítés & kontextus", props.weights().context(), score, 1.0, text,
            null, null, null, rows);
    }

    /** In-window 1.0; outside: linear to 0 at 3h distance. A snack fits at any hour. */
    private double timingSub(String slot, LocalTime t) {
        MealScoringProperties.SlotWindows w = props.slotWindows();
        int from;
        int to;
        switch (slot) {
            case "breakfast" -> { from = w.breakfastFrom(); to = w.breakfastTo(); }
            case "lunch" -> { from = w.lunchFrom(); to = w.lunchTo(); }
            case "dinner" -> { from = w.dinnerFrom(); to = w.dinnerTo(); }
            default -> { return 1.0; }
        }
        double hour = t.getHour() + t.getMinute() / 60.0;
        double distance = hour < from ? from - hour : hour > to ? hour - to : 0;
        return Math.max(0, 1 - distance / 3);
    }

    private static String slotLabel(String slot) {
        return switch (slot) {
            case "breakfast" -> "reggeli";
            case "lunch" -> "ebéd";
            case "dinner" -> "vacsora";
            default -> "snack";
        };
    }

    // --- Provenance ------------------------------------------------------------------------------

    /** Honest deterministic tool transparency — what the scorer actually read/computed. */
    private List<ToolRow> tools(String slot, List<ScoredLine> lines, Dim micro, Dim nova, LocalTime t) {
        long factLines = lines.stream().filter(ScoredLine::hasMicroFacts).count();
        List<ToolRow> tools = new ArrayList<>();
        tools.add(new ToolRow("read", "meal_item.snapshots(n=" + lines.size() + ")"));
        if (micro.coverage > 0) {
            tools.add(new ToolRow("read",
                "pantry.nutrition_facts(" + factLines + "/" + lines.size() + " tétel)"));
        }
        tools.add(new ToolRow("compute", "macroFit(mezo.nutrition)"));
        if (nova.coverage > 0) {
            tools.add(new ToolRow("compute", "novaDistribution(kcal_weighted)"));
        }
        tools.add(new ToolRow("compute", "contextFit(slot=" + slot + ", t=" + t + ")"));
        return tools;
    }

    // --- Internal carrier + numeric helpers -------------------------------------------------------

    /** Computed dimension before rounding: keeps the unrounded score for the weighted total. */
    private record Dim(String id, String label, double effectiveWeight, double score,
                       double coverage, String detail, MacroDetail macro, List<MicroRow> micros,
                       NovaDetail nova, List<ContextRow> context) {

        static Dim degraded(String id, String label, double configWeight, String detail) {
            // configWeight intentionally unused: a no-coverage dimension carries weight 0 (honest),
            // the total renormalizes over the rest, and confidence drops via coverage 0.
            return new Dim(id, label, 0, 0, 0, detail, null, null, null, null);
        }

        Dimension toJson() {
            return new Dimension(id, label, round2(effectiveWeight), round2(score), detail,
                macro, micros, nova, context);
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

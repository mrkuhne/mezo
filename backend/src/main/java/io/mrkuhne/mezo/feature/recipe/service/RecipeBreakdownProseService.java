package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.Dimension;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.ImproveRow;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.ToolRow;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * LLM prose layer over the deterministic template envelope (mezo-bw3y, spec D1/D6): ONE cheap-tier
 * call turns the computed numbers into Hungarian summary / per-dimension detail / improve[] /
 * fitsFor[]. The numbers are NEVER the LLM's — prose only. Any failure (companion off, LLM throw,
 * unparseable answer, blank summary) returns null and the caller serves the deterministic envelope —
 * degraded honesty, never a 5xx (this differs from scrape/ai-draft, whose whole feature IS the LLM,
 * hence their 502/503 codes).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.RECIPE_AI_SCORE_SWITCH, havingValue = "true")
public class RecipeBreakdownProseService {

    private static final String SYSTEM_PROMPT = """
        You evaluate ONE saved recipe TEMPLATE against the owner's daily nutrition targets.
        You get the recipe and the DETERMINISTIC dimension scores already computed by the engine.
        Answer with ONE JSON object and nothing else, exactly these keys:
        {"summary":string,"fitsFor":[string],
         "details":{"macro":string,"micro":string,"nova":string},
         "improve":[{"text":string,"impact":string}]}
        Rules:
        - Write Hungarian, tegeződve, tömören.
        - summary: 2-3 mondat — a recept sablon-szintű olvasata (mire jó, hogyan illik a célokhoz).
        - details.*: 1-2 mondat dimenziónként; a megadott számok MAGYARÁZATA — soha ne mondj
          ellent nekik és ne találj ki új számokat.
        - fitsFor: 1-3 rövid címke, mikor/mire illik a recept (pl. "Post-workout · este").
        - improve: 0-3 konkrét javaslat; impact = rövid kvalitatív tag (pl. "+rost", "-NOVA4").
        - A kontextus (időzítés) sablon szinten nem értékelhető — arról ne írj javaslatot.
        """;

    /** LLM answer contract — permissive Strings; a malformed answer degrades, never errors. */
    record ExtractedDetails(String macro, String micro, String nova) {
    }

    record ExtractedImprove(String text, String impact) {
    }

    record ExtractedProse(String summary, List<String> fitsFor, ExtractedDetails details,
                          List<ExtractedImprove> improve) {
    }

    /** A successful enrichment: the prose-merged envelope + the (capped) fitsFor labels. */
    public record Enriched(MealBreakdownJson envelope, List<String> fitsFor) {
    }

    private final ObjectProvider<RecipeBreakdownLlm> llm;
    private final ObjectMapper objectMapper;

    /** Prose-merged envelope + fitsFor, or null when enrichment is unavailable/failed (caller degrades). */
    public Enriched enrich(RecipeEntity recipe, MealBreakdownJson det) {
        RecipeBreakdownLlm port = llm.getIfAvailable();
        if (port == null) {
            return null; // companion off — deterministic envelope is served un-enriched
        }
        try {
            String answer = port.complete(SYSTEM_PROMPT, userMessage(recipe, det));
            String json = answer.substring(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
            ExtractedProse prose = objectMapper.readValue(json, ExtractedProse.class);
            if (prose.summary() == null || prose.summary().isBlank()) {
                log.warn("Recipe breakdown prose: blank summary for {} — degrading", recipe.getId());
                return null;
            }
            return new Enriched(merge(det, prose), fitsFor(prose));
        } catch (Exception e) {
            log.warn("Recipe breakdown prose failed for {} — serving deterministic envelope",
                recipe.getId(), e);
            return null;
        }
    }

    private static List<String> fitsFor(ExtractedProse prose) {
        return prose.fitsFor() == null ? List.of() : prose.fitsFor().stream()
            .filter(s -> s != null && !s.isBlank()).limit(3).toList();
    }

    private String userMessage(RecipeEntity recipe, MealBreakdownJson det) {
        StringBuilder sb = new StringBuilder();
        sb.append("RECEPT: ").append(recipe.getName())
          .append(" | slot: ").append(recipe.getSlot() == null ? "-" : recipe.getSlot())
          .append(" | adag: ").append(recipe.getServings()).append('\n');
        sb.append("HOZZÁVALÓK (1 adagra vetítve pontozva):\n");
        recipe.getLines().forEach(l -> sb.append("- ").append(l.getSnapshotName())
            .append(' ').append(l.getAmount().stripTrailingZeros().toPlainString())
            .append(l.getUnit()).append('\n'));
        sb.append("DETERMINISZTIKUS BONTÁS (0-1 skála, súlyozott):\n");
        for (Dimension d : det.dimensions()) {
            sb.append("- ").append(d.id()).append(" (").append(d.label()).append("): score ")
              .append(d.score()).append(", súly ").append(d.weight())
              .append(" — ").append(d.detail()).append('\n');
        }
        sb.append("VÉGSŐ ÉRTÉK: ").append(det.value())
          .append(" | megbízhatóság: ").append(det.confidence()).append('\n');
        return sb.toString();
    }

    /** Numbers untouched; prose replaces summary + the three live details + improve; llm tool row. */
    private static MealBreakdownJson merge(MealBreakdownJson det, ExtractedProse prose) {
        List<Dimension> dims = det.dimensions().stream().map(d -> {
            String text = switch (d.id()) {
                case "macro" -> prose.details() == null ? null : prose.details().macro();
                case "micro" -> prose.details() == null ? null : prose.details().micro();
                case "nova" -> prose.details() == null ? null : prose.details().nova();
                default -> null;
            };
            return text == null || text.isBlank() ? d
                : new Dimension(d.id(), d.label(), d.weight(), d.score(), text,
                    d.macro(), d.micros(), d.nova(), d.context());
        }).toList();
        List<ImproveRow> improve = prose.improve() == null ? List.<ImproveRow>of() : prose.improve().stream()
            .filter(i -> i.text() != null && !i.text().isBlank())
            .limit(3)
            .map(i -> new ImproveRow(i.text(), i.impact() == null ? "" : i.impact()))
            .toList();
        List<ToolRow> tools = new ArrayList<>(det.tools());
        tools.add(new ToolRow("compute", "llm:sablon-olvasat"));
        return new MealBreakdownJson(det.value(), det.confidence(), prose.summary(), dims,
            improve, tools);
    }
}

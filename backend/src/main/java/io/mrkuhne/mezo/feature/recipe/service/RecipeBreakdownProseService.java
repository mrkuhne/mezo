package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.Dimension;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.ImproveRow;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.ToolRow;
import io.mrkuhne.mezo.feature.nutrition.service.MealRole;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
         "details":{"macro":string,"micro":string,"who":string,"fat_quality":string,"nova":string,"plant_diversity":string,"energy_density":string,"portion":string},
         "improve":[{"text":string,"impact":string}]}
        DIMENZIÓK (a details.<id> kulcsai — mit magyarázz dimenziónként):
        - macro: Kcal & makró arány — a P/C/F energia-arány a napi célhoz képest. A fehérje-TÖBBLETET
          a pontozás szándékosan nem bünteti (fitness-fókusz) — többlet-fehérjét sose ródd fel
          hibaként; csak fehérjehiányt és szénhidrát/zsír-eltérést magyarázz.
        - micro: Rost & mikro — a rost a napi keret arányában.
        - who: Ajánlások · WHO — cukor az energia %-ában (≤10% cél) és só-keret; magyarázd, mely hozzávaló viszi a cukrot/sót.
        - fat_quality: Zsírminőség — telített zsír energia-aránya (≤10%) és a telített/összzsír arány; nevezd meg a fő zsírforrásokat.
        - nova: Feldolgozottság · NOVA — a kalóriák feldolgozottsági eloszlása; nevezd meg az ultra-feldolgozott tételeket.
        - plant_diversity: Növényi diverzitás — hány különböző növényi kategória van a receptben (cél: 3+); javasolj konkrét bővítést.
        - energy_density: Energia-sűrűség — kcal/100g; alacsonyabb = laktatóbb; jelezd, ha db-alapú tétel miatt részleges a lefedettség.
        - portion: Adag-arány — egy adag kcal a slot-büdzséhez képest; jelezd, ha az adag túl nagy/kicsi a slothoz.
        Rules:
        - Write Hungarian, tegeződve, tömören.
        - summary: 2-3 mondat — a recept sablon-szintű olvasata (mire jó, hogyan illik a célokhoz).
        - details.*: 1-2 mondat dimenziónként; a megadott számok MAGYARÁZATA — soha ne mondj
          ellent nekik és ne találj ki új számokat. Degradált (nincs adat) dimenzióról ne írj.
        - fitsFor: 1-3 rövid címke, mikor/mire illik a recept (pl. "Post-workout · este").
        - improve: 0-3 konkrét javaslat; impact = rövid kvalitatív tag (pl. "+rost", "-NOVA4").
        - Az időzítés sablon szinten nem értékelhető — arról ne írj javaslatot.
        - A SZEREP sor megmondja, milyen rubrikával pontozott a motor. Ha edzés előtti/utáni
          szerep van megadva, a gyors szénhidrát és a magasabb cukor SZÁNDÉKOS — sose írd hibának.
          A szerep ÁTHANGOLJA a rubrikát, nem jutalom: a szerephez rosszul illő recept így
          ALACSONYABB pontot kap — ilyenkor a számokat kövesd, ne a szerepet dicsérd.
        """;

    /** LLM answer contract — permissive shapes; a malformed answer degrades, never errors. */
    record ExtractedImprove(String text, String impact) {
    }

    /**
     * {@code details} is keyed by dimension id (macro, micro, who, fat_quality, nova,
     * plant_diversity, energy_density, portion) — a Map, so any new dimension id narrates without a
     * schema edit and the snake_case ids need no {@code @JsonProperty} plumbing.
     */
    record ExtractedProse(String summary, List<String> fitsFor, Map<String, String> details,
                          List<ExtractedImprove> improve) {
    }

    /** A successful enrichment: the prose-merged envelope + the (capped) fitsFor labels. */
    public record Enriched(MealBreakdownJson envelope, List<String> fitsFor) {
    }

    private final ObjectProvider<RecipeBreakdownLlm> llm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;

    /** Prose-merged envelope + fitsFor, or null when enrichment is unavailable/failed (caller degrades). */
    public Enriched enrich(RecipeEntity recipe, MealBreakdownJson det) {
        RecipeBreakdownLlm port = llm.getIfAvailable();
        if (port == null) {
            return null; // companion off — deterministic envelope is served un-enriched
        }
        try {
            String answer = llmCallContextHolder.runWith(
                new LlmCallContext("recipe_breakdown", "prose", "recipe", recipe.getId()),
                () -> port.complete(SYSTEM_PROMPT, userMessage(recipe, det)));
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

    /** package-private for the prompt-assembly unit test */
    String userMessage(RecipeEntity recipe, MealBreakdownJson det) {
        StringBuilder sb = new StringBuilder();
        sb.append("RECEPT: ").append(recipe.getName())
          .append(" | slot: ").append(recipe.getSlot() == null ? "-" : recipe.getSlot())
          .append(" | adag: ").append(recipe.getServings()).append('\n');
        // The numbers below were already scored under this role (mezo-uavr): the role RETARGETS the
        // rubric, it does not add a bonus — the copy must stop the prose from calling deliberate
        // fuel a mistake WITHOUT implying that a training role by itself makes the recipe good.
        sb.append(switch (recipe.getRole() == null ? MealRole.STANDARD : recipe.getRole()) {
            case PRE_WORKOUT -> "SZEREP: edzés előtti üzemanyag. A gyors szénhidrát és a cukor "
                + "itt CÉL, nem hiba — a pontozás már ezzel a szénhidrát-dús rubrikával számolt. "
                + "Ne ródd fel a cukrot vagy a feldolgozottságot; azt magyarázd, mennyire jó "
                + "üzemanyag ehhez a szerephez (a fehérje/zsír-dominancia itt gyengébb "
                + "illeszkedés).\n";
            case POST_WORKOUT -> "SZEREP: edzés utáni regeneráció. A fehérje + gyors szénhidrát "
                + "itt CÉL (glikogén-pótlás) — a pontozás már ezzel a rubrikával számolt. A "
                + "magasabb cukrot ne ródd fel hibaként; azt magyarázd, mennyire szolgálja a "
                + "regenerációt.\n";
            case STANDARD -> "SZEREP: általános étkezés — a standard (WHO-igazodó) rubrika szerint "
                + "pontozva.\n";
        });
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

    /** Numbers untouched; prose replaces summary + the per-dimension details + improve; llm tool row. */
    private static MealBreakdownJson merge(MealBreakdownJson det, ExtractedProse prose) {
        Map<String, String> details = prose.details() == null ? Map.of() : prose.details();
        List<Dimension> dims = det.dimensions().stream().map(d -> {
            String text = details.get(d.id()); // keyed by dimension id — narrates all 8
            return text == null || text.isBlank() ? d
                : new Dimension(d.id(), d.label(), d.weight(), d.score(), text,
                    d.macro(), d.micros(), d.nova(), d.context(), d.note());
        }).toList();
        List<ImproveRow> improve = prose.improve() == null ? List.<ImproveRow>of() : prose.improve().stream()
            .filter(i -> i.text() != null && !i.text().isBlank())
            .limit(3)
            .map(i -> new ImproveRow(i.text(), i.impact() == null ? "" : i.impact()))
            .toList();
        List<ToolRow> tools = new ArrayList<>(det.tools());
        tools.add(new ToolRow("compute", "llm:sablon-olvasat"));
        // tagline stays null: it is the logged-meal card's cut (mezo-mr4n); a recipe has no card row.
        return new MealBreakdownJson(det.value(), det.confidence(), prose.summary(), null, dims,
            improve, tools, det.formulaVersion());
    }
}

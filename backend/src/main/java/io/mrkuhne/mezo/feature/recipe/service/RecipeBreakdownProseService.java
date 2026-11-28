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
import io.mrkuhne.mezo.techcore.message.UserMessages;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

    static final String SYSTEM_PROMPT = """
        You evaluate ONE saved recipe TEMPLATE against the owner's daily nutrition targets.
        You get the recipe and the DETERMINISTIC dimension scores already computed by the engine.
        Answer with ONE JSON object and nothing else, exactly these keys:
        {"tagline":string,"summary":string,"fitsFor":[string],
         "details":{"macro":string,"micro":string,"who":string,"fat_quality":string,"nova":string,"plant_diversity":string,"energy_density":string,"portion":string},
         "improve":[{"text":string,"impact":string,"dimension":string}]}
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
        - Boop hangján írsz: barátságos, konkrét, ÉTEL-SPECIFIKUS. Nevezd meg a HOZZÁVALÓK sorból
          a valódi hozzávalókat — a "FORRÁSOK" sorok megmondják, melyik hozzávaló mennyit hoz.
        - TILOS kezdések (sem a summary, sem a details elején): „Ez egy", „Ez a recept", „Ez a sablon",
          „A recept". Ne kategória-címkével kezdj, hanem a legbeszédesebb ténnyel.
        - Számot CSAK a bemenetből idézz (a FORRÁSOK, a bontás és a hozzávalók számai) — soha ne
          számolj ki és ne találj ki újat, és ne hivatkozz napi célokra, amiket nem kaptál meg.
        - tagline: EGY mondat, legfeljebb 70 karakter — a recept fő erőssége és a leggyengébb
          pontja (pl. "Fehérjében erős reggeli, a só húzza le."). Nincs benne szám.
        - summary: 2-3 mondat — mire jó ez az étel, mi viszi a pontszámát fel és le, hozzávalókkal.
        - details.*: 3-4 mondat dimenziónként; a megadott számok MAGYARÁZATA — melyik hozzávaló
          áll a szám mögött, és miért ennyi. Soha ne mondj ellent a számoknak. Degradált (nincs adat)
          dimenzióról ne írj.
        - fitsFor: 1-3 rövid címke, mikor/mire illik a recept (pl. "Post-workout · este").
        - improve: 0-3 konkrét csere vagy kiegészítés MENNYISÉGGEL és a hozzávaló nevével (pl.
          "Cseréld a feta felét túróra."); impact = rövid kvalitatív tag (pl. "+rost", "-só");
          dimension = annak a dimenziónak az id-je (a details kulcsai közül), amelyiken javít.
        - Az időzítés sablon szinten nem értékelhető — arról ne írj javaslatot.
        - A SZEREP sor megmondja, milyen rubrikával pontozott a motor. Ha edzés előtti/utáni
          szerep van megadva, a gyors szénhidrát és a magasabb cukor SZÁNDÉKOS — sose írd hibának.
          A szerep ÁTHANGOLJA a rubrikát, nem jutalom: a szerephez rosszul illő recept így
          ALACSONYABB pontot kap — ilyenkor a számokat kövesd, ne a szerepet dicsérd.
        """;

    /** For an English account: the one line that demands Hungarian is reduced to the tone, so it
     *  cannot fight the appended output-language directive (mezo-n4wf5.5). Hungarian accounts
     *  keep {@link #SYSTEM_PROMPT} byte for byte. */
    static final String SYSTEM_PROMPT_NEUTRAL =
        SYSTEM_PROMPT.replace("- Write Hungarian, tegeződve, tömören.", "- Tegeződve, tömören.");

    /** LLM answer contract — permissive shapes; a malformed answer degrades, never errors. */
    record ExtractedImprove(String text, String impact, String dimension) {
    }

    /**
     * {@code details} is keyed by dimension id (macro, micro, who, fat_quality, nova,
     * plant_diversity, energy_density, portion) — a Map, so any new dimension id narrates without a
     * schema edit and the snake_case ids need no {@code @JsonProperty} plumbing.
     */
    record ExtractedProse(String summary, String tagline, List<String> fitsFor, Map<String, String> details,
                          List<ExtractedImprove> improve) {
    }

    /** The prompt generation stamped on every enriched envelope; bump it whenever the prompt changes
     *  so {@code RecipeBreakdownService.matches()} re-narrates old cached prose lazily (mezo-r36n9.199).
     *  1 = the pre-stamp prompt (stored as null), 2 = tagline + food-specific details + improve.dimension. */
    public static final int PROSE_VERSION = 2;

    /** A successful enrichment: the prose-merged envelope + the (capped) fitsFor labels. */
    public record Enriched(MealBreakdownJson envelope, List<String> fitsFor) {
    }

    private final ObjectProvider<RecipeBreakdownLlm> llm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;
    private final UserMessages messages;

    /** The two prompt halves of one prose call, built while the recipe (and its lazy lines) is
     *  still attached — the slow model call itself then runs outside any transaction (mezo-r36n9.219). */
    public record Prompt(String system, String user) {
    }

    /** True when there is a model to ask (the companion is on) — otherwise no prose will ever come. */
    public boolean available() {
        return llm.getIfAvailable() != null;
    }

    /** Prose-merged envelope + fitsFor, or null when enrichment is unavailable/failed (caller degrades). */
    public Enriched enrich(RecipeEntity recipe, MealBreakdownJson det) {
        Prompt prompt = prepare(recipe, det);
        return prompt == null ? null : complete(recipe.getId(), prompt, det);
    }

    /** The prompt for {@code recipe}, or null when the companion is off (no model to ask). Reads the
     *  lazy {@code recipe.lines}, so call it inside a transaction; resolves the account language on
     *  the calling thread (bind the actor first on a pool thread). */
    public Prompt prepare(RecipeEntity recipe, MealBreakdownJson det) {
        if (llm.getIfAvailable() == null) {
            return null; // companion off — deterministic envelope is served un-enriched
        }
        String systemPrompt = "hu".equals(messages.language()) ? SYSTEM_PROMPT : SYSTEM_PROMPT_NEUTRAL;
        return new Prompt(systemPrompt, userMessage(recipe, det));
    }

    /** The model call + parse + merge — slow (prose v2 measured ~110 s), touches no entity, so it
     *  runs with no transaction open. Null on any failure (the caller degrades). */
    public Enriched complete(UUID recipeId, Prompt prompt, MealBreakdownJson det) {
        RecipeBreakdownLlm port = llm.getIfAvailable();
        if (port == null) {
            return null;
        }
        try {
            String answer = llmCallContextHolder.runWith(
                new LlmCallContext("recipe_breakdown", "prose", "recipe", recipeId),
                () -> port.complete(prompt.system(), prompt.user()));
            String json = answer.substring(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
            ExtractedProse prose = objectMapper.readValue(json, ExtractedProse.class);
            if (prose.summary() == null || prose.summary().isBlank()) {
                log.warn("Recipe breakdown prose: blank summary for {} — degrading", recipeId);
                return null;
            }
            return new Enriched(merge(det, prose), fitsFor(prose));
        } catch (Exception e) {
            log.warn("Recipe breakdown prose failed for {} — serving deterministic envelope", recipeId, e);
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
        for (Dimension d : det.dimensions()) {
            if (d.contributors() == null || d.contributors().isEmpty()) {
                continue;
            }
            sb.append("FORRÁSOK ").append(d.id()).append(':');
            String sep = " ";
            for (MealBreakdownJson.Contributor c : d.contributors()) {
                sb.append(sep).append(c.name()).append(' ')
                  .append(c.amount().stripTrailingZeros().toPlainString()).append(' ').append(c.unit())
                  .append(nutrientLabel(c.nutrient()))
                  .append(" (").append(c.share().movePointRight(2).setScale(0, java.math.RoundingMode.HALF_UP))
                  .append("%)");
                sep = ", ";
            }
            sb.append('\n');
        }
        sb.append("VÉGSŐ ÉRTÉK: ").append(det.value())
          .append(" | megbízhatóság: ").append(det.confidence()).append('\n');
        return sb.toString();
    }

    private static String nutrientLabel(String nutrient) {
        return switch (nutrient) {
            case "salt" -> " só";
            case "sugar" -> " cukor";
            case "saturated_fat" -> " telített zsír";
            case "fiber" -> " rost";
            default -> "";
        };
    }

    /** Numbers untouched; prose replaces summary + tagline + the per-dimension details + improve;
     *  llm tool row; stamped with {@link #PROSE_VERSION}. Package-private for the unit test. */
    static MealBreakdownJson merge(MealBreakdownJson det, ExtractedProse prose) {
        Map<String, String> details = prose.details() == null ? Map.of() : prose.details();
        List<Dimension> dims = det.dimensions().stream().map(d -> {
            String text = details.get(d.id()); // keyed by dimension id — narrates all 8
            return text == null || text.isBlank() ? d : d.withDetail(text);
        }).toList();
        // a tip may only lift a live dimension: a degraded one (weight 0) has no numbers to point at
        java.util.Set<String> ids = det.dimensions().stream()
            .filter(d -> d.weight() != null && d.weight().signum() > 0).map(Dimension::id)
            .collect(java.util.stream.Collectors.toSet());
        List<ImproveRow> improve = prose.improve() == null ? List.<ImproveRow>of() : prose.improve().stream()
            .filter(i -> i.text() != null && !i.text().isBlank())
            .limit(3)
            .map(i -> new ImproveRow(i.text(), i.impact() == null ? "" : i.impact(),
                i.dimension() != null && ids.contains(i.dimension()) ? i.dimension() : null))
            .toList();
        List<ToolRow> tools = new ArrayList<>(det.tools());
        tools.add(new ToolRow("compute", "llm:sablon-olvasat"));
        String tagline = prose.tagline() == null || prose.tagline().isBlank() ? null : prose.tagline().strip();
        return new MealBreakdownJson(det.value(), det.confidence(), prose.summary(), tagline, dims,
            improve, tools, det.formulaVersion(), det.glucose(), PROSE_VERSION);
    }
}

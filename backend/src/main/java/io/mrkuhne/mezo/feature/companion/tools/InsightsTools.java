package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.PatternResponse;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/** Confirmed-pattern overview, with explicit source reads for proactive records. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class InsightsTools {

    /** get_insights' supported scope values; anything else (incl. null) falls back to "patterns". */
    private static final List<String> INSIGHT_SCOPES = List.of("patterns", "predictions", "experiments");

    /** Pure read (gated on the SAME COMPANION_SWITCH as this bean) — the pattern inbox list. */
    private final PatternService patternService;

    @Tool(name = "get_insights", description = "Amit a rendszer ÉSZREVETT rólad. Használd, amikor a "
            + "user azt kérdezi 'mit vettél észre rólam', mik a mintáim/összefüggéseim, vagy mit "
            + "jósolsz. scope=patterns (alapértelmezés, jelenleg az egyetlen élő scope) — a "
            + "MEGERŐSÍTETT statisztikai/AI minták listája: cím, mechanizmus (irány/erősség, ha "
            + "van), bizonyíték (r/n/p, ha van). scope=predictions és scope=experiments "
            + "a teljes forrás lekérdezésére irányít: read_personal_records(source=prediction|experiment). "
            + "A többi státuszú minta: read_personal_records(source=pattern). "
            + "scope: patterns (alapértelmezés), predictions, experiments.")
    public String getInsights(
            @ToolParam(required = false, description = "patterns (alapértelmezés, egyetlen élő "
                    + "scope); predictions|experiments — a teljes forrás olvasására irányít.")
            String scope,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        String s = normalizeScope(scope);
        return switch (s) {
            case "predictions" -> "Előrejelzések: a rögzített előrejelzéseket kérd le: "
                    + "read_personal_records(source=prediction). Ez nem generál új előrejelzést.";
            case "experiments" -> "Kísérletek: a rögzített kísérleteket kérd le: "
                    + "read_personal_records(source=experiment). Ez nem indít új kísérletet.";
            default -> renderPatterns(userId, toolContext);
        };
    }

    private static String normalizeScope(String scope) {
        if (scope == null) {
            return "patterns";
        }
        String s = scope.trim().toLowerCase();
        return INSIGHT_SCOPES.contains(s) ? s : "patterns";
    }

    /**
     * scope=patterns: {@link PatternService#list} filtered to {@link PatternEntity#STATUS_CONFIRMED}
     * (the service itself returns every status — proposed/monitoring/confirmed/rejected — since its
     * other caller is the full L2 inbox view; this tool narrows to the standing, user-judged rows).
     * All confirmed rows, newest-detected first ({@code PatternService#list}'s own
     * ordering). Each line renders the title (the statement), the deterministic Hungarian mechanism
     * prose when present (carries direction/strength, e.g. "Közepes erősségű negatív együttjárás"),
     * and the evidence chips when present (r/n/p) — never a fabricated direction/strength when the
     * backing row has none (V3.2 hypothesis rows may lack r/n/p).
     */
    private String renderPatterns(UUID userId, ToolContext toolContext) {
        List<PatternResponse> confirmed = patternService.list(userId).stream()
                .filter(p -> PatternEntity.STATUS_CONFIRMED.equals(p.getStatus()))
                .toList();
        if (confirmed.isEmpty()) {
            return "Minták: " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder("Minták (megerősített):");
        for (PatternResponse p : confirmed) {
            b.append('\n').append(p.getTitle());
            if (p.getMechanism() != null && !p.getMechanism().isBlank()) {
                b.append(" — ").append(p.getMechanism());
            }
            if (p.getEvidence() != null && !p.getEvidence().isEmpty()) {
                b.append(" (").append(String.join(", ", p.getEvidence())).append(")");
            }
            ToolContexts.audit(toolContext).addRef("Insight", p.getTitle());
        }
        return b + ToolText.detailHint("pattern");
    }
}

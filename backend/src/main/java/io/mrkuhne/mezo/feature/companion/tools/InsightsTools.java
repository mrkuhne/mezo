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

/**
 * The "Minták" read tool (mezo-xixu) — the system's detected patterns/predictions/experiments, the
 * feature this whole tool-expansion effort started from. Only {@code scope=patterns} is live:
 *
 * <p><b>scope=patterns</b> — {@link PatternService#list} (a plain
 * {@code PatternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc} read mapped
 * through {@code CompanionMapper}, verified read-only — no lazy write) filtered down to
 * {@link PatternEntity#STATUS_CONFIRMED} rows: these are the STANDING judgements Daniel has
 * already confirmed (spec §8), as opposed to the {@code proposed}/{@code monitoring} inbox (a
 * separate L2 decision surface, not this read tool's job). {@link PatternService} is gated on the
 * SAME {@code COMPANION_SWITCH} as this bean, so it is injected directly ({@code final}, no
 * {@code ObjectProvider}) — if {@code InsightsTools} exists at all, {@code PatternService} does
 * too. Both live in the {@code companion} feature slice, so this import adds no new package-cycle
 * edge ({@code ArchitectureTest#feature_slices_are_cycle_free} slices per top-level feature).
 *
 * <p><b>scope=predictions / scope=experiments — deliberately DEFERRED, not composed.</b> Their
 * backing reads, {@code ProactivePredictionService#getPredictions} and
 * {@code ProactiveExperimentService#getExperiments}, both live a package over in
 * {@code feature.proactive.service} and BOTH lazily generate on a miss inside a
 * {@code @Transactional} method (the "weekly-suggestion"/"first proposal" idiom — call
 * {@code PredictionGenerator.generate}/{@code ExperimentProposalGenerator.propose} when the
 * current week/open-set is empty) — a WRITE on what would otherwise be a read tool, the same
 * violation {@link PracticeTools}'s javadoc calls out for
 * {@code ProactiveChallengeService#getChallenges}. On top of that, {@code feature.proactive}
 * already depends on {@code feature.companion} (its generators call {@code CompanionLlm}), so a
 * direct {@code companion.tools → proactive.service} import would ALSO close a brand-new 2-slice
 * cycle that {@code ArchitectureTest#feature_slices_are_cycle_free} (a {@code FreezingArchRule})
 * would fail on. Resolving this cleanly needs a companion-owned read port mirroring
 * {@link io.mrkuhne.mezo.feature.companion.TodayQuestSource} PLUS a genuinely side-effect-free
 * read method on the proactive side (neither exists today) — out of scope for this tool;
 * DONE_WITH_CONCERNS. Both scopes render an honest "még nem elérhető" rather than faking data or
 * silently degrading to "nincs adat" (which would look like a real absence, not a missing
 * capability).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class InsightsTools {

    /** get_insights' supported scope values; anything else (incl. null) falls back to "patterns". */
    private static final List<String> INSIGHT_SCOPES = List.of("patterns", "predictions", "experiments");

    /** Rendered/audited confirmed patterns per call — token budget by construction (the
     *  TrainTools/FuelTools/GrowthTools precedent). */
    private static final int PATTERN_LIMIT = 5;

    /** Pure read (gated on the SAME COMPANION_SWITCH as this bean) — the pattern inbox list. */
    private final PatternService patternService;

    @Tool(name = "get_insights", description = "Amit a rendszer ÉSZREVETT rólad. Használd, amikor a "
            + "user azt kérdezi 'mit vettél észre rólam', mik a mintáim/összefüggéseim, vagy mit "
            + "jósolsz. scope=patterns (alapértelmezés, jelenleg az egyetlen élő scope) — a "
            + "MEGERŐSÍTETT statisztikai/AI minták listája: cím, mechanizmus (irány/erősség, ha "
            + "van), bizonyíték (r/n/p, ha van). scope=predictions és scope=experiments még nem "
            + "elérhetők ezen a tool-on. scope: patterns (alapértelmezés), predictions, experiments.")
    public String getInsights(
            @ToolParam(required = false, description = "patterns (alapértelmezés, egyetlen élő "
                    + "scope); predictions|experiments — még nem elérhető.")
            String scope,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        String s = normalizeScope(scope);
        return switch (s) {
            case "predictions" -> "Előrejelzések: még nem elérhető";
            case "experiments" -> "Kísérletek: még nem elérhető";
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
     * Capped at {@link #PATTERN_LIMIT}, newest-detected first ({@code PatternService#list}'s own
     * ordering). Each line renders the title (the statement), the deterministic Hungarian mechanism
     * prose when present (carries direction/strength, e.g. "Közepes erősségű negatív együttjárás"),
     * and the evidence chips when present (r/n/p) — never a fabricated direction/strength when the
     * backing row has none (V3.2 hypothesis rows may lack r/n/p).
     */
    private String renderPatterns(UUID userId, ToolContext toolContext) {
        List<PatternResponse> confirmed = patternService.list(userId).stream()
                .filter(p -> PatternEntity.STATUS_CONFIRMED.equals(p.getStatus()))
                .limit(PATTERN_LIMIT)
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
        return b.toString();
    }
}

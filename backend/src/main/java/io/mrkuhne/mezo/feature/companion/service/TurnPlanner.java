package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * The strong model decides WHAT to fetch — by SAYING it, never by calling a tool (spec §6.2 /
 * P1+P2): the planning call carries no tool schemas, so provider-side reasoning is legal, and
 * the catalogue travels as prompt text rendered from the live registry. Machine-facing prompt:
 * no PromptPersona, ASCII-Hungarian, marker-prefixed for the fake's dispatch.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
@RequiredArgsConstructor
public class TurnPlanner {

    /** Public so FakeCompanionLlm can dispatch on the prompt prefix. */
    public static final String PROMPT_MARKER = "TERV-FELADAT.";

    static final String PROMPT = PROMPT_MARKER + """
         Te a felhasznalo szemelyes egeszseg-tarsanak ADATTERVEZOJE vagy. NEM valaszolsz a kerdesre:
        kizarolag azt mondod meg, mely lekerdezesek kellenek a megvalaszolasahoz.
        A hasznalhato lekerdezesek neve, leirasa es parameterei a lenti katalogusban vannak.
        Valaszolj KIZAROLAG ezzel a JSON objektummal, magyarazat nelkul:
        {"needsData":true|false,"steps":[{"tool":"<nev>","args":{...},"why":"<fel mondat magyarul>"}]}
        Szabalyok: csak katalogusbeli nevet hasznalj; csak a katalogusban felsorolt parametereket add at;
        ha a kerdeshez nem kell a felhasznalo sajat adata, needsData=false es ures steps;
        legfeljebb 15 lepes; ugyanazt a lekerdezest ne ismeteld.

        """;

    static final String REPAIR_PREFIX = "[JAVÍTÁS] Az előző terved hibás volt (";
    static final String REPAIR_SUFFIX = "). Adj érvényes tervet ugyanerre a kérdésre, kizárólag a katalógus eszközeivel.";

    private final CompanionLlm companionLlm;
    private final TurnPlanParser parser;
    private final PlanValidator validator;
    private final ToolCatalogue catalogue;
    private final CompanionToolRegistry toolRegistry;
    private final CompanionProperties properties;

    /**
     * Empty = no usable plan after the repair budget — the caller falls back to the legacy
     * tool-loop path (spec §8). Present with zero steps = the planner ruled no data is needed.
     */
    public Optional<ValidatedPlan> plan(List<CompanionLlm.Turn> history, String userMessage, LocalDate today) {
        // Stable half: prompt + catalogue (identical across turns => cacheable prefix).
        String system = PROMPT + catalogue.render();
        String turnContext = "\n\nMa: " + today + "\n";
        // Definitions only — no call ever goes through these callbacks here.
        List<ToolCallback> callbacks = toolRegistry.callbacks(toolRegistry.newTurnAudit());

        String message = userMessage;
        int attempts = properties.turn().planner().repairAttempts();
        for (int round = 0; round <= attempts; round++) {
            String raw = companionLlm.completeSmart(system, turnContext, history, message);
            Optional<TurnPlan> parsed = parser.parse(raw);
            if (parsed.isPresent()) {
                TurnPlan turnPlan = parsed.get();
                if (!turnPlan.needsData() || turnPlan.steps().isEmpty()) {
                    return Optional.of(new ValidatedPlan(List.of(), List.of()));
                }
                ValidatedPlan validated = validator.validate(turnPlan, callbacks);
                if (!validated.isEmpty()) {
                    // Partially rejected plans run as-is; the rejections travel for provenance.
                    return Optional.of(validated);
                }
                message = userMessage + "\n\n" + REPAIR_PREFIX
                    + String.join("; ", validated.rejections()) + REPAIR_SUFFIX;
            } else {
                message = userMessage + "\n\n" + REPAIR_PREFIX
                    + "nem volt értelmezhető JSON" + REPAIR_SUFFIX;
            }
        }
        log.warn("Turn planner produced no usable plan after {} repair attempt(s)", attempts);
        return Optional.empty();
    }
}

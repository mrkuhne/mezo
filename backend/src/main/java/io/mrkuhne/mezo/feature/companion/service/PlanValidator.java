package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * "The model phrases, code decides" — the registry, not the planner, is the authority on what
 * may run ({@code TestPlanValidator} precedent). Pure and side-effect free: never invokes a
 * callback, never throws on model garbage.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
@RequiredArgsConstructor
public class PlanValidator {

    private final ObjectMapper objectMapper;
    private final CompanionProperties properties;

    public ValidatedPlan validate(TurnPlan plan, List<ToolCallback> callbacks) {
        Map<String, Set<String>> knownParams = schemaParams(callbacks);
        int budget = properties.tools().maxCallsPerTurn();
        List<TurnPlan.PlanStep> accepted = new ArrayList<>();
        List<String> rejections = new ArrayList<>();
        for (TurnPlan.PlanStep step : plan.steps()) {
            if (accepted.size() >= budget) {
                rejections.add(step.tool() + ": a lépéskeret (" + budget + ") betelt");
                continue;
            }
            Set<String> known = knownParams.get(step.tool());
            if (known == null) {
                rejections.add(step.tool() + ": ismeretlen eszköz");
                continue;
            }
            List<String> unknown = step.args().keySet().stream()
                .filter(key -> !known.contains(key))
                .toList();
            if (!unknown.isEmpty()) {
                rejections.add(step.tool() + ": ismeretlen paraméter " + unknown);
                continue;
            }
            accepted.add(step);
        }
        return new ValidatedPlan(List.copyOf(accepted), List.copyOf(rejections));
    }

    private Map<String, Set<String>> schemaParams(List<ToolCallback> callbacks) {
        Map<String, Set<String>> params = new HashMap<>();
        for (ToolCallback callback : callbacks) {
            Set<String> names = new HashSet<>();
            try {
                JsonNode properties = objectMapper
                    .readTree(callback.getToolDefinition().inputSchema()).path("properties");
                properties.properties().forEach(entry -> names.add(entry.getKey()));
            } catch (Exception e) {
                // Generated schema failing to parse is a bug elsewhere; an empty param set means
                // only arg-less steps for this tool pass, which is the safe direction.
                log.warn("Tool schema unparseable for {}", callback.getToolDefinition().name(), e);
            }
            params.put(callback.getToolDefinition().name(), names);
        }
        return params;
    }
}

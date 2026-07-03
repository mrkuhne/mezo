package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.support.ToolCallbacks;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The V0.5 tool registry — the ONLY place companion tools are assembled (IDENT-2: everything in
 * here is a read over our own features; the ArchUnit rule companion_tools_are_internal_sphere_only
 * guards the boundary structurally). Every callback is wrapped in RecordingToolCallback so the
 * per-turn audit + budget can never be bypassed.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class CompanionToolRegistry {

    private final TrainTools trainTools;
    private final BiometricsTools biometricsTools;
    private final FuelTools fuelTools;
    private final GoalTools goalTools;
    private final MedicationTools medicationTools;
    private final CompanionProperties properties;

    public ToolCallAudit newTurnAudit() {
        return new ToolCallAudit(
                properties.tools().maxCallsPerTurn(), properties.tools().maxRefsPerTurn());
    }

    public List<ToolCallback> callbacks(ToolCallAudit audit) {
        return Arrays.stream(
                        ToolCallbacks.from(trainTools, biometricsTools, fuelTools, goalTools, medicationTools))
                .<ToolCallback>map(cb -> new RecordingToolCallback(cb, audit))
                .toList();
    }

    public Map<String, Object> toolContext(UUID userId, ToolCallAudit audit) {
        return Map.of(ToolContexts.USER_ID, userId, ToolContexts.AUDIT, audit);
    }
}

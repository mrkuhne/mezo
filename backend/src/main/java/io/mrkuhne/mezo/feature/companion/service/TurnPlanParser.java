package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Parses the planner LLM's reply into a {@link TurnPlan}. House idiom for LLM JSON: the
 * first-'{'-to-last-'}' substring is the fence stripper ({@code TurnVerdictCheck} precedent).
 * Empty result means the reply is unusable — the CALLER decides between a repair lap and the
 * legacy fallback (spec §8); the parser never throws.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
@RequiredArgsConstructor
public class TurnPlanParser {

    private final ObjectMapper objectMapper;

    public Optional<TurnPlan> parse(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return Optional.empty();
        }
        try {
            TurnPlan plan = objectMapper.readValue(raw.substring(start, end + 1), TurnPlan.class);
            return Optional.of(normalize(plan));
        } catch (Exception e) {
            log.warn("Turn plan unparseable: {}", raw, e);
            return Optional.empty();
        }
    }

    /** Jackson leaves omitted fields null; downstream code must never see a null list/map/why. */
    private static TurnPlan normalize(TurnPlan plan) {
        List<TurnPlan.PlanStep> steps = plan.steps() == null ? List.of() : plan.steps().stream()
            .filter(step -> step != null && step.tool() != null && !step.tool().isBlank())
            .map(step -> new TurnPlan.PlanStep(
                step.tool(),
                step.args() == null ? Map.of() : step.args(),
                step.why() == null ? "" : step.why()))
            .toList();
        return new TurnPlan(plan.needsData(), steps);
    }
}

package io.mrkuhne.mezo.feature.fuel.service;

import io.mrkuhne.mezo.feature.fuel.entity.StackZone;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Zone assignment for stack occurrences (mezo-vx9v): rule table → pantry timing hint → LLM
 * fallback → 'breakfast' fallback. The LLM step needs no manual flag read: {@link
 * StackPlacementLlm}'s only implementation ({@code StackPlacementLlmAdapter}, companion slice) is
 * gated at the bean boundary on BOTH {@code STACK_PLACEMENT_LLM_SWITCH} and {@code
 * COMPANION_SWITCH} (configuration_conventions.md forbids {@code Environment}/{@code @Value}
 * reads in business code) — with either switch off the {@link ObjectProvider} below is simply
 * empty, exactly the {@code RecipeBreakdownService}/{@code ObjectProvider<RecipeBreakdownProseService>}
 * precedent.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PlacementEngine {

    public record Placement(String slotKey, String source, String reasonHu, String restDayFallback) {}

    static final String FALLBACK_ZONE = "breakfast";
    static final String FALLBACK_REASON = "Bizonytalan besorolás — helyezd át, ha máskor szeded.";

    /** First word of the system prompt — FakeCompanionLlm mirrors it (literal, no import back;
     *  companion already depends on fuel one-way via StackPlacementLlmAdapter — mirroring the
     *  marker as a literal, like every other cross-feature marker in FakeCompanionLlm, keeps that
     *  test double consistent and self-healing: a drifted mirror falls through to the generic
     *  echo, which is unparseable, so PlacementEngineLlmIT fails loudly instead of silently). */
    public static final String SYSTEM_PROMPT_MARKER = "KAMRA-ELHELYEZES-FELADAT";

    private static final String SYSTEM_PROMPT = SYSTEM_PROMPT_MARKER + """
        : You classify a dietary supplement into ONE daily intake zone.
        Answer with STRICT JSON only: {"slotKey":"<zone>","reasonHu":"<one Hungarian sentence>"}
        Allowed slotKey values: wake, breakfast, pre_workout, post_workout, lunch, dinner, evening, bedtime.
        The reason must be one short Hungarian sentence explaining why that zone is optimal.""";

    private final ObjectProvider<StackPlacementLlm> llm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;

    public Placement place(PantryItemEntity item) {
        String name = item.getCatalog().getName() == null ? "" : item.getCatalog().getName().toLowerCase();
        for (PlacementRules.Rule rule : PlacementRules.RULES) {
            if (rule.needles().stream().anyMatch(name::contains)) {
                return new Placement(rule.slotKey(), "rule", rule.reasonHu(), rule.restDayFallback());
            }
        }
        String timingZone = PlacementRules.zoneForTiming(item.getTiming());
        if (timingZone != null) {
            return new Placement(timingZone, "rule",
                "A Kamra-item ajánlott időzítése alapján.", null);
        }
        return llmPlacement(item).orElseGet(
            () -> new Placement(FALLBACK_ZONE, "fallback", FALLBACK_REASON, null));
    }

    /** Rule-table daily-total hint for the item panel (not persisted — derived per read). */
    public String dailyTotalHint(String itemName) {
        String name = itemName == null ? "" : itemName.toLowerCase();
        return PlacementRules.RULES.stream()
            .filter(r -> r.needles().stream().anyMatch(name::contains))
            .map(PlacementRules.Rule::dailyTotalHintHu)
            .filter(h -> h != null)
            .findFirst().orElse(null);
    }

    private Optional<Placement> llmPlacement(PantryItemEntity item) {
        StackPlacementLlm port = llm.getIfAvailable();
        if (port == null) {
            return Optional.empty(); // stack-placement-llm off, companion off, or no adapter bean
        }
        try {
            String raw = llmCallContextHolder.runWith(
                new LlmCallContext("stack_placement", "place", null, null),
                () -> port.complete(SYSTEM_PROMPT, item.getCatalog().getName()));
            String json = raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
            JsonNode node = objectMapper.readTree(json);
            String slotKey = node.path("slotKey").asString();
            StackZone.fromKey(slotKey); // validates — throws on junk
            String reason = node.path("reasonHu").asString(FALLBACK_REASON);
            return Optional.of(new Placement(slotKey, "llm", reason, null));
        } catch (Exception e) {
            log.warn("Stack placement LLM fallback failed for '{}': {}", item.getCatalog().getName(), e.getMessage());
            return Optional.empty();
        }
    }
}

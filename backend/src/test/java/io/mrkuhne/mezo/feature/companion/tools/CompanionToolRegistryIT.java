package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class CompanionToolRegistryIT extends AbstractIntegrationTest {

    @Autowired private CompanionToolRegistry registry;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testCallbacks_shouldExposeTheV05BatchPlusRecall_allWrapped() {
        List<ToolCallback> callbacks = registry.callbacks(registry.newTurnAudit());
        assertThat(callbacks).allSatisfy(cb -> assertThat(cb).isInstanceOf(RecordingToolCallback.class));
        assertThat(callbacks).extracting(cb -> cb.getToolDefinition().name())
                .containsExactlyInAnyOrder(
                        "get_training_log", "get_training_plan", "get_exercise_records", "get_weight_trend", "get_weight_log",
                        "get_fuel_log", "get_recovery", "get_protocol", "get_goal",
                        "get_medication", "find_similar_past_days", "compare_periods", "get_recipes", "get_pantry", "get_growth",
                        "get_daily_practice", "get_insights", "get_life_goals");
    }

    @Test
    void testToolContext_shouldCarryUserIdAndAudit_whenBuiltForTurn() {
        UUID owner = userPopulator.createUser().getId();
        ToolCallAudit audit = registry.newTurnAudit();
        Map<String, Object> ctx = registry.toolContext(owner, audit);
        assertThat(ctx).containsEntry(ToolContexts.USER_ID, owner)
                .containsEntry(ToolContexts.AUDIT, audit);
    }

    @Test
    void testGetRecoverySchema_shouldExposeDateFromTo_andMaxThreeGuidance_whenV06DetailParams() {
        List<ToolCallback> callbacks = registry.callbacks(registry.newTurnAudit());
        String schema = callbacks.stream()
                .filter(cb -> cb.getToolDefinition().name().equals("get_recovery"))
                .findFirst().orElseThrow()
                .getToolDefinition().inputSchema();

        assertThat(schema).contains("\"date\"").contains("\"from\"").contains("\"to\"");
        assertThat(schema).contains("array");
        assertThat(schema).contains("YYYY-MM-DD");
    }

    @Test
    void testGetRecoveryDescription_shouldCarryDetailFieldsAndTriggerClause_whenV06DetailParams() {
        List<ToolCallback> callbacks = registry.callbacks(registry.newTurnAudit());
        String description = callbacks.stream()
                .filter(cb -> cb.getToolDefinition().name().equals("get_recovery"))
                .findFirst().orElseThrow()
                .getToolDefinition().description();

        assertThat(description)
                .contains("részletes")
                .contains("konkrét nap")
                .contains("hypnogram");
    }
}

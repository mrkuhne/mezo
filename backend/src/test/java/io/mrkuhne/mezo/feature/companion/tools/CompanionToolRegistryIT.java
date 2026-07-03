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
                        "get_recent_workouts", "get_sport_sessions", "get_weight_trend", "get_recent_meals",
                        "get_sleep", "get_protocol_adherence", "get_goal_progress", "get_reta_cycle",
                        "find_similar_past_days");
    }

    @Test
    void testToolContext_shouldCarryUserIdAndAudit_whenBuiltForTurn() {
        UUID owner = userPopulator.createUser().getId();
        ToolCallAudit audit = registry.newTurnAudit();
        Map<String, Object> ctx = registry.toolContext(owner, audit);
        assertThat(ctx).containsEntry(ToolContexts.USER_ID, owner)
                .containsEntry(ToolContexts.AUDIT, audit);
    }
}

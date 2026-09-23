package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.feature.companion.tools.RecordingToolCallback;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class FeedReadToolsIT extends AbstractIntegrationTest {
    @Autowired private CompanionToolRegistry registry;
    @Autowired private DatabasePopulator users;
    @Autowired private CompanionMessagePopulator messages;

    @Test
    void testCallbacks_shouldReadOnlyOwnedHistoryAndEnforceBudget_whenInvoked() {
        var user = users.populateUser("feed-tools@test.local");
        var other = users.populateUser("feed-tools-other@test.local");
        var own = messages.createMessage(user, LocalDate.now(), "weight", "Mérés", List.of("MY_HISTORY"));
        var foreign = messages.createMessage(other, LocalDate.now(), "weight", "Mérés", List.of("FOREIGN_HISTORY"));
        var audit = new ToolCallAudit(6, 12);
        var callbacks = registry.feedCallbacks(audit);
        assertThat(callbacks).extracting(c -> c.getToolDefinition().name())
                .contains("read_personal_records", "search_personal_memory", "get_weight_log")
                .doesNotContain("get_conversation_history");
        var read = callbacks.stream().filter(c -> c.getToolDefinition().name().equals("read_personal_records")).findFirst().orElseThrow();
        var ctx = new ToolContext(registry.toolContext(user, audit));
        assertThat(read.call("{\"source\":\"companion_message\",\"id\":\"" + own.getId() + "\"}", ctx)).contains("MY_HISTORY");
        assertThat(read.call("{\"source\":\"companion_message\",\"id\":\"" + foreign.getId() + "\"}", ctx)).doesNotContain("FOREIGN_HISTORY");
        for (int i = 0; i < 4; i++) read.call("{\"source\":\"weight_log\"}", ctx);
        assertThat(read.call("{\"source\":\"weight_log\"}", ctx)).isEqualTo(RecordingToolCallback.BUDGET_EXHAUSTED);
        assertThat(audit.callCount()).isEqualTo(6);
    }
}

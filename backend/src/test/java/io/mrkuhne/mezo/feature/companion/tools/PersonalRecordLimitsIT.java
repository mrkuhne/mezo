package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.repository.PersonalRecordSource;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.companion.conversation.result-max-chars=500",
        "mezo.companion.turn.answerer.outcome-max-chars-per-result=500"
})
@Transactional
class PersonalRecordLimitsIT extends AbstractIntegrationTest {
    @Autowired private CompanionToolRegistry registry;
    @Autowired private DatabasePopulator users;
    @Autowired private JournalPopulator journals;
    private final ObjectMapper json = new ObjectMapper();

    private JsonNode call(UUID user, String name, Map<String, Object> args) {
        var audit = registry.newTurnAudit();
        var callback = registry.conversationCallbacks(audit).stream()
                .filter(c -> c.getToolDefinition().name().equals(name)).findFirst().orElseThrow();
        String result = callback.call(json.writeValueAsString(args), new ToolContext(registry.toolContext(user, audit)));
        assertThat(result.length()).isLessThanOrEqualTo(500);
        return json.readTree(result);
    }

    @Test
    void testSources_shouldRemainDiscoverable_whenSmallestSupportedBudget() {
        UUID user = users.populateUser("records-catalogue-small@test.local");
        var found = new java.util.HashSet<String>();
        int offset = 0;
        for (int i = 0; i < 100; i++) {
            var page = call(user, "list_personal_sources", Map.of("domain", "all", "offset", offset));
            page.path("sources").forEach(s -> assertThat(found.add(s.asText())).isTrue());
            if (page.path("nextOffset").isNull()) break;
            int next = page.path("nextOffset").asInt();
            assertThat(next).isGreaterThan(offset);
            offset = next;
        }
        assertThat(found).containsExactlyInAnyOrderElementsOf(PersonalRecordSource.ALL.stream().map(PersonalRecordSource::name).toList());
    }

    @Test
    void testRead_shouldMakeProgress_whenRecordHasEscapedUnicodeAndSmallBudget() {
        UUID user = users.populateUser("records-content-small@test.local");
        String text = "🍀 idézet \"x\"\\\n".repeat(10);
        var entry = journals.createEntry(user, LocalDate.now(), text, "quickinput");
        StringBuilder joined = new StringBuilder();
        int offset = 0;
        for (int i = 0; i < 100; i++) {
            var page = call(user, "read_personal_records", Map.of("source", "journal_entry",
                    "id", entry.getId().toString(), "contentOffset", offset));
            assertThat(page.has("error")).isFalse();
            var row = page.path("records").get(0);
            joined.append(row.path("content").asText());
            if (row.path("nextContentOffset").isNull()) break;
            int next = row.path("nextContentOffset").asInt();
            assertThat(next).isGreaterThan(offset);
            offset = next;
        }
        assertThat(json.readTree(joined.toString()).path("text").asText()).isEqualTo(text);
    }
}

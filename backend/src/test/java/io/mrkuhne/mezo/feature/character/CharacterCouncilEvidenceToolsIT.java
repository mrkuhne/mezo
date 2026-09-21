package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;

import io.mrkuhne.mezo.feature.character.config.CharacterCouncilDebateProperties;
import io.mrkuhne.mezo.feature.character.service.CharacterCouncilEvidenceTools;
import io.mrkuhne.mezo.feature.companion.tools.RecordingToolCallback;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@ActiveProfiles("companion-fake")
@Transactional
class CharacterCouncilEvidenceToolsIT extends AbstractIntegrationTest {
    @Autowired private CharacterCouncilEvidenceTools tools;
    @Autowired private CharacterCouncilDebateProperties properties;
    @Autowired private DatabasePopulator users;
    @Autowired private JournalPopulator journals;

    @Test
    void testRead_shouldFilterForeignSources_whenCouncilHasNoChatSession() {
        var owner = users.populateUser("council-evidence@test.local");
        var other = users.populateUser("council-other@test.local");
        journals.createEntry(owner, LocalDate.now(), "Owner council evidence", "quickinput");
        journals.createEntry(other, LocalDate.now(), "Foreign council secret", "quickinput");
        var session = tools.open(owner);
        assertThat(session.callbacks()).extracting(callback -> callback.getToolDefinition().name())
                .containsExactlyInAnyOrder("list_personal_sources", "read_personal_records", "compare_council_periods");
        var read = session.callbacks().stream()
                .filter(callback -> callback.getToolDefinition().name().equals("read_personal_records"))
                .findFirst().orElseThrow();
        String result = read.call("{\"source\":\"journal_entry\"}", new ToolContext(session.context()));
        assertThat(result).contains("Owner council evidence").doesNotContain("Foreign council secret");
        assertThat(session.audit().toolOutcomes()).singleElement()
                .satisfies(outcome -> assertThat(outcome.result()).isEqualTo(result));
    }

    @Test
    void testRead_shouldStopAtSharedBudget_whenMultipleToolsUseSameSession() {
        var session = tools.open(users.populateUser("council-budget@test.local"));
        var context = new ToolContext(session.context());
        for (int i = 0; i < properties.maxToolCalls(); i++) {
            session.callbacks().getFirst().call("{}", context);
        }
        assertThatThrownBy(() -> session.callbacks().getLast().call("{}", context))
                .isInstanceOf(SystemRuntimeErrorException.class);
        assertThat(session.audit().callCount()).isEqualTo(properties.maxToolCalls());
    }

    @Test
    void testSuccessfulToolNames_shouldExcludeFailedRead_whenSourceIsUnknown() {
        var session = tools.open(users.populateUser("council-invalid@test.local"));
        var read = session.callbacks().stream()
                .filter(callback -> callback.getToolDefinition().name().equals("read_personal_records"))
                .findFirst().orElseThrow();
        read.call("{\"source\":\"not_a_source\"}", new ToolContext(session.context()));
        assertThat(session.successfulToolNames(0)).isEmpty();
    }
}

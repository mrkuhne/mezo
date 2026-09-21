package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.CharacterCouncilEvidenceTools;
import io.mrkuhne.mezo.feature.character.service.ClaimProposal;
import io.mrkuhne.mezo.feature.character.service.KonziliumVerdictRound;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@ActiveProfiles("companion-fake")
@Transactional
class CharacterCouncilVerdictEvidenceIT extends AbstractIntegrationTest {
    @Autowired private KonziliumVerdictRound verdict;
    @Autowired private CharacterCouncilEvidenceTools tools;
    @Autowired private DatabasePopulator users;
    @Autowired private JournalPopulator journals;
    @Autowired private FakeCompanionLlm model;

    @Test
    void testVerdict_shouldGiveChairActualSourceRead_whenSkepticUsesTool() {
        var owner = users.populateUser("council-verdict@test.local");
        journals.createEntry(owner, LocalDate.now(), "Actual original journal evidence", "quickinput");
        var session = tools.open(owner);
        var proposal = new ClaimProposal("pszichologus", "NEW", "mental", null,
                "Naplóbeli önbeszámoló. [fake-tool:read_personal_records {\"source\":\"journal_entry\"}]",
                new BigDecimal("0.50"), false, "A forrást ellenőrizni kell.");
        var result = verdict.run(owner, LocalDate.now(), List.of(proposal), List.of(), session);
        assertThat(result.chairParsed()).isTrue();
        assertThat(session.successfulToolNames(0)).containsExactly("read_personal_records");
        assertThat(model.lastUserMessage()).contains("Actual original journal evidence");
    }
}

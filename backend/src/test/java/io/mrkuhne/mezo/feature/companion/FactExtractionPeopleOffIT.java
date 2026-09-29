package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.service.FactExtractionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * mezo-d6ivw.13: the person-first drop only applies when the person memory exists — with
 * PEOPLE_SWITCH off nothing else would keep a named-person fact, so it stays a proposal.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.people.enabled=false")
class FactExtractionPeopleOffIT extends AbstractIntegrationTest {

    @Autowired private FactExtractionService factExtractionService;
    @Autowired private LearnedFactRepository learnedFactRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private PersonPopulator personPopulator;

    @Test
    void testExtractFromTurn_shouldKeepCandidateNamingAPerson_whenPeopleIsOff() {
        UUID userId = databasePopulator.populateUser("extract-people-off@test.local");
        personPopulator.createPerson(userId, "Barbi");
        String content = "mesélek [fake-facts:[" +
                "{\"fact\":\"Barbival egyre közelebb kerülünk egymáshoz\",\"category\":\"life\"}]]";

        int persisted = factExtractionService.extractFromTurn(userId, null, content, "értem");

        assertThat(persisted).isEqualTo(1);
        assertThat(learnedFactRepository
                .findByCreatedByAndUserDecisionIsNullAndDeletedFalseOrderByCreatedAtDesc(userId))
                .extracting(LearnedFactEntity::getCandidateText)
                .containsExactly("Barbival egyre közelebb kerülünk egymáshoz");
    }
}

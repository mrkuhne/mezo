package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.repository.PersonFactRepository;
import io.mrkuhne.mezo.feature.companion.service.PersonFactExtractionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * S3 (mezo-d6ivw.3): a post-turn személy-tény kinyerő a fake LLM ellen — a
 * {@code [fake-person-facts:<json>]} sentinel a forduló szövegében determinisztikus választ ad,
 * így a feloldás/földelés/dedupe kód LLM-mentesen tesztelhető.
 */
@ActiveProfiles("companion-fake")
class PersonFactExtractionServiceIT extends AbstractIntegrationTest {

    @Autowired private PersonFactExtractionService extractionService;
    @Autowired private PersonFactRepository personFactRepository;
    @Autowired private PersonPopulator personPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private List<PersonFactEntity> factsOf(UUID userId, UUID personId) {
        return personFactRepository
                .findByCreatedByAndPersonIdAndDeletedFalseOrderByCreatedAtDesc(userId, personId);
    }

    @Test
    void testExtractFromTurn_shouldPersistFact_forKnownActivePerson() {
        UUID userId = databasePopulator.populateUser("pfx-happy@test.local");
        PersonEntity anna = personPopulator.createPerson(userId, "Anna");
        UUID messageId = UUID.randomUUID();
        String content = "Annáról mesélek [fake-person-facts:["
                + "{\"name\":\"Anna\",\"kind\":\"preference\",\"fact\":\"Nem szereti a meglepetéseket\",\"confidence\":\"high\"}]]";

        int persisted = extractionService.extractFromTurn(userId, messageId, content, "értem");

        assertThat(persisted).isEqualTo(1);
        List<PersonFactEntity> facts = factsOf(userId, anna.getId());
        assertThat(facts).hasSize(1);
        assertThat(facts.getFirst().getFactText()).isEqualTo("Nem szereti a meglepetéseket");
        assertThat(facts.getFirst().getConfidence()).isEqualTo("high");
        assertThat(facts.getFirst().getSourceRefKind()).isEqualTo("chat_turn");
        assertThat(facts.getFirst().getSourceRefId()).isEqualTo(messageId.toString());
    }

    @Test
    void testExtractFromTurn_shouldResolveAlias_caseInsensitively() {
        UUID userId = databasePopulator.populateUser("pfx-alias@test.local");
        // PersonPopulator alias: "Marcika"
        PersonEntity marci = personPopulator.createPerson(userId, "Marci");
        String content = "[fake-person-facts:["
                + "{\"name\":\"marcika\",\"kind\":\"shared_activity\",\"fact\":\"Heti röpi együtt\",\"confidence\":\"medium\"}]]";

        int persisted = extractionService.extractFromTurn(userId, UUID.randomUUID(), content, "ok");

        assertThat(persisted).isEqualTo(1);
        assertThat(factsOf(userId, marci.getId())).hasSize(1);
    }

    @Test
    void testExtractFromTurn_shouldDropUnknownAndAmbiguousNames() {
        UUID userId = databasePopulator.populateUser("pfx-unknown@test.local");
        PersonEntity anna1 = personPopulator.createPerson(userId, "Panni");
        PersonEntity anna2 = personPopulator.createPerson(userId, "Panni", "friend", "neutral");
        String content = "[fake-person-facts:["
                + "{\"name\":\"Sosemhallott Név\",\"kind\":\"preference\",\"fact\":\"Valami\",\"confidence\":\"low\"},"
                + "{\"name\":\"Panni\",\"kind\":\"preference\",\"fact\":\"Kétértelmű\",\"confidence\":\"high\"}]]";

        int persisted = extractionService.extractFromTurn(userId, UUID.randomUUID(), content, "ok");

        assertThat(persisted).isZero();
        assertThat(factsOf(userId, anna1.getId())).isEmpty();
        assertThat(factsOf(userId, anna2.getId())).isEmpty();
    }

    @Test
    void testExtractFromTurn_shouldIgnoreCandidatePersons() {
        UUID userId = databasePopulator.populateUser("pfx-candidate@test.local");
        PersonEntity candidate = personPopulator.createCandidate(userId, "Jelölt Juli", "jegyzet");
        String content = "[fake-person-facts:["
                + "{\"name\":\"Jelölt Juli\",\"kind\":\"preference\",\"fact\":\"Szereti a kávét\",\"confidence\":\"high\"}]]";

        int persisted = extractionService.extractFromTurn(userId, UUID.randomUUID(), content, "ok");

        assertThat(persisted).isZero();
        assertThat(factsOf(userId, candidate.getId())).isEmpty();
    }

    @Test
    void testExtractFromTurn_shouldSurviveGarbageAnswer() {
        UUID userId = databasePopulator.populateUser("pfx-garbage@test.local");
        personPopulator.createPerson(userId, "Anna");
        String content = "[fake-person-facts:nem-json]";

        int persisted = extractionService.extractFromTurn(userId, UUID.randomUUID(), content, "ok");

        assertThat(persisted).isZero();
    }
}

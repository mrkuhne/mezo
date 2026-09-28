package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.repository.PersonFactRepository;
import io.mrkuhne.mezo.feature.companion.service.PersonFactExtractionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
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
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private AiMessagePopulator messagePopulator;
    @Autowired private AiMessageRepository messageRepository;

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
    void testExtractFromTurn_shouldSaveNothing_whenTheMessageIsExtractionBlocked() {
        // S8 (mezo-d6ivw.12): the turn was forgotten while the LLM call ran — the gate drops it
        UUID userId = databasePopulator.populateUser("pfx-blocked@test.local");
        PersonEntity anna = personPopulator.createPerson(userId, "Anna");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        AiMessageEntity message = messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "Annáról");
        message.setExtractionBlocked(true);
        messageRepository.saveAndFlush(message);
        String content = "[fake-person-facts:["
                + "{\"name\":\"Anna\",\"kind\":\"preference\",\"fact\":\"Késve érkező tény\",\"confidence\":\"high\"}]]";

        int persisted = extractionService.extractFromTurn(userId, message.getId(), content, "értem");

        assertThat(persisted).isZero();
        assertThat(factsOf(userId, anna.getId())).isEmpty();
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

    /** S8 eval fixture — the 09-26 shape, PARAPHRASED (never real text): an emotional retelling
     *  that still states stable relationship facts. The fake returns what a working extractor
     *  should; the IT pins resolution (TextFold: "Dori" → Dóri) and that ≥ 1 fact lands. The prompt
     *  loosening itself is checked by the manual prod call after deploy (Task 16). */
    @Test
    void testExtractFromTurn_shouldKeepStableFactsFromAnEmotionalRetelling_andFoldNames() {
        UUID userId = databasePopulator.populateUser("pfx-s8-eval@test.local");
        PersonEntity dori = personPopulator.createPerson(userId, "Dóri");
        personPopulator.createPerson(userId, "Bence");
        String retelling = """
                Megnyertük ma a strandröpi-tornát Dórival és Bencével, tavasz óta Dóri a párom a
                pályán. Aztán mindenki hazament, én meg itt ülök egyedül, furcsa ez a csend.
                Bence mondta, hogy jövőre szívesen játszana velünk.
                [fake-person-facts:[{"name":"Dori","kind":"relationship_state","fact":"tavasz óta a strandröpi-párod","confidence":"high"},{"name":"BENCE","kind":"shared_activity","fact":"jövőre is együtt játszanátok","confidence":"medium"}]]""";

        int persisted = extractionService.extractFromTurn(userId, UUID.randomUUID(), retelling, "Gratulálok!");

        assertThat(persisted).isGreaterThanOrEqualTo(1);
        assertThat(factsOf(userId, dori.getId())).extracting(PersonFactEntity::getFactText)
                .containsExactly("tavasz óta a strandröpi-párod");
    }

    @Test
    void testExtractionPrompt_shouldCountStableStatesAndRecurringPatterns_insideEmotionalTalk() {
        String prompt = PersonFactExtractionService.EXTRACTION_PROMPT;
        assertThat(prompt).contains("ismétlődő minta").contains("érzelmes")
                .doesNotContain("bizonytalan egyezésnél hagyd ki");
    }
}

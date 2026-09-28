package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FactDecisionRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.ChatMemoryItem;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryForgetVetoEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryForgetVetoRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.repository.PersonFactRepository;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/** S8 (mezo-d6ivw.12): forget the latest learning turn, the three forget routes, widen, preview. */
@Transactional
@ActiveProfiles("companion-fake")
class ChatForgetServiceIT extends AbstractIntegrationTest {

    @Autowired private ChatForgetService chatForgetService;
    @Autowired private FactCandidateService factCandidateService;
    @Autowired private PersonFactService personFactService;
    @Autowired private PersonFactRepository personFactRepository;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private MemoryForgetVetoRepository vetoRepository;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private FactExtractionService factExtractionService;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private AiMessagePopulator messages;
    @Autowired private LearnedFactPopulator candidates;
    @Autowired private PersonPopulator persons;
    @Autowired private DatabasePopulator databasePopulator;

    private record Fixture(UUID userId, AiConversationEntity conversation, AiMessageEntity turn1,
                           AiMessageEntity turn2, AiMessageEntity turn3, PersonEntity anna) {}

    /** turn1: Dóri fact + an owner proposal later ACCEPTED; turn2: Anna fact + an undecided
     *  proposal; turn3: nothing learned (the "most recent" row is not the target). */
    private Fixture fixture(String email) {
        UUID userId = databasePopulator.populateUser(email);
        AiConversationEntity conversation = conversations.conversation(userId);
        AiMessageEntity turn1 = messages.message(conversation, AiMessageEntity.ROLE_USER, "Dórival nyertünk");
        AiMessageEntity turn2 = messages.message(conversation, AiMessageEntity.ROLE_USER, "Annával rég beszéltem");
        AiMessageEntity turn3 = messages.message(conversation, AiMessageEntity.ROLE_USER, "és most?");
        PersonEntity dori = persons.createPerson(userId, "Dóri");
        PersonEntity anna = persons.createPerson(userId, "Anna");
        personFactService.capture(userId, PersonFactEntity.SOURCE_CHAT_TURN, turn1.getId().toString(), List.of(
                new PersonFactService.PersonFactCapture(dori.getId(), PersonFactEntity.KIND_RELATIONSHIP_STATE,
                        "a strandröpi-párod", "high")));
        LearnedFactEntity accepted = candidates.candidate(userId, "Egy nagy nap után nehéz egyedül.", "life", turn1.getId());
        factCandidateService.decide(userId, accepted.getId(), FactDecisionRequest.builder()
                .decision(FactDecisionRequest.DecisionEnum.ACCEPT).build());
        personFactService.capture(userId, PersonFactEntity.SOURCE_CHAT_TURN, turn2.getId().toString(), List.of(
                new PersonFactService.PersonFactCapture(anna.getId(), PersonFactEntity.KIND_PREFERENCE,
                        "régi csapattársad", "medium")));
        candidates.candidate(userId, "Szeretnék újra csapatban játszani.", "life", turn2.getId());
        return new Fixture(userId, conversation, turn1, turn2, turn3, anna);
    }

    @Test
    void testForgetLatest_shouldForgetOnlyTheMostRecentLearningTurn_andVetoIt() {
        Fixture f = fixture("s8-forget-latest@test.local");

        List<ChatMemoryItem> forgotten = chatForgetService.forgetLatest(f.userId(), f.conversation().getId());

        assertThat(forgotten).extracting(ChatMemoryItem::text)
                .containsExactlyInAnyOrder("régi csapattársad", "Szeretnék újra csapatban játszani.");
        assertThat(personFactRepository.findByCreatedByAndPersonIdAndDeletedFalseOrderByCreatedAtDesc(
                f.userId(), f.anna().getId())).allMatch(p -> !p.isActive());
        assertThat(vetoRepository.existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(f.userId(),
                MemoryForgetVetoEntity.DOMAIN_FACT_TEXT,
                MemoryForgetVetoEntity.factTextVetoKey("Szeretnék újra csapatban játszani."))).isTrue();
        // turn1 untouched: its person fact and its accepted fact are still live
        assertThat(chatForgetService.preview(f.userId(), f.conversation().getId())).extracting(ChatMemoryItem::text)
                .containsExactlyInAnyOrder("a strandröpi-párod", "Egy nagy nap után nehéz egyedül.");
        // race marker: the target AND the immediately preceding user row are blocked
        assertThat(messageRepository.findById(f.turn2().getId()).orElseThrow().isExtractionBlocked()).isTrue();
        assertThat(messageRepository.findById(f.turn3().getId()).orElseThrow().isExtractionBlocked()).isTrue();
        assertThat(messageRepository.findById(f.turn1().getId()).orElseThrow().isExtractionBlocked()).isFalse();
    }

    @Test
    void testForgetLatest_shouldReturnEmpty_whenNothingWasLearned() {
        UUID userId = databasePopulator.populateUser("s8-forget-empty@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);
        messages.message(conversation, AiMessageEntity.ROLE_USER, "szia");

        assertThat(chatForgetService.forgetLatest(userId, conversation.getId())).isEmpty();
    }

    @Test
    void testForgetAll_shouldForgetEveryTurn_incl_anAcceptedFact_andAppendToTheTrigger() {
        Fixture f = fixture("s8-forget-all@test.local");
        AiMessageEntity trigger = messages.message(f.conversation(), AiMessageEntity.ROLE_USER, "ezt ne jegyezd meg");
        UUID acceptedFactId = chatForgetService.preview(f.userId(), f.conversation().getId()).stream()
                .filter(i -> ChatMemoryItem.KIND_KNOWLEDGE_FACT.equals(i.kind())).findFirst().orElseThrow().refId();

        List<ChatMemoryItem> forgotten = chatForgetService.forgetAll(f.userId(), f.conversation().getId(), trigger.getId());

        assertThat(forgotten).hasSize(4);
        assertThat(chatForgetService.preview(f.userId(), f.conversation().getId())).isEmpty();
        assertThat(knowledgeFactRepository.findByIdAndCreatedByAndDeletedFalse(acceptedFactId, f.userId())).isEmpty();
        assertThat(messageRepository.findById(trigger.getId()).orElseThrow().getForgottenMemories().items()).hasSize(4);
    }

    @Test
    void testExtraction_shouldDropItsCandidates_whenTheTurnWasForgottenMeanwhile() {
        Fixture f = fixture("s8-forget-race@test.local");
        chatForgetService.forgetLatest(f.userId(), f.conversation().getId());

        int persisted = factExtractionService.extractFromTurn(f.userId(), f.turn3().getId(),
                "[fake-facts:[{\"fact\":\"késve érkező tény\",\"category\":\"life\",\"owner\":\"mezo\"}]]", "ok");

        assertThat(persisted).isZero();
    }
}

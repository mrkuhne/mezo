package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.TurnMemoryResponse;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** S8 (mezo-d6ivw.12): one turn's memory — person facts, live proposals, owner-scoped. */
@Transactional
class TurnMemoryServiceIT extends AbstractIntegrationTest {

    @Autowired private TurnMemoryService turnMemoryService;
    @Autowired private PersonFactService personFactService;
    @Autowired private AboutMeService aboutMeService;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private AiMessagePopulator messages;
    @Autowired private LearnedFactPopulator candidates;
    @Autowired private PersonPopulator persons;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testTurnMemory_shouldComposeLearnedAndLiveProposals_forOneUserMessage() {
        UUID userId = databasePopulator.populateUser("s8-turnmem@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);
        AiMessageEntity turn = messages.message(conversation, AiMessageEntity.ROLE_USER, "Dórival nyertünk");
        AiMessageEntity other = messages.message(conversation, AiMessageEntity.ROLE_USER, "másik kör");
        PersonEntity dori = persons.createPerson(userId, "Dóri");
        personFactService.capture(userId, PersonFactEntity.SOURCE_CHAT_TURN, turn.getId().toString(),
                List.of(new PersonFactService.PersonFactCapture(dori.getId(),
                        PersonFactEntity.KIND_RELATIONSHIP_STATE, "tavasz óta a strandröpi-párod", "high")));
        candidates.candidate(userId, "Nagy közös élmény után nehéz az egyedüllét.", "life", turn.getId());
        LearnedFactEntity rejected = candidates.candidate(userId, "elutasított", "life", turn.getId());
        rejected.setUserDecision(LearnedFactEntity.DECISION_REJECT);
        candidates.candidate(userId, "másik kör javaslata", "life", other.getId());

        TurnMemoryResponse memory = turnMemoryService.turnMemory(userId, conversation.getId(), turn.getId());

        assertThat(memory.getLearned()).singleElement().satisfies(f -> {
            assertThat(f.getPersonName()).isEqualTo("Dóri");
            assertThat(f.getText()).isEqualTo("tavasz óta a strandröpi-párod");
        });
        assertThat(memory.getProposed()).extracting(c -> c.getCandidateText())
                .containsExactly("Nagy közös élmény után nehéz az egyedüllét.");
        assertThat(memory.getForgotten()).isEmpty();
        assertThat(memory.getForgetRequest()).isFalse();
    }

    @Test
    void testTurnMemory_shouldCarryTheAboutMeCopy_onlyOnTheClaimedPersonFact() {
        UUID userId = databasePopulator.populateUser("s8-turnmem-aboutme@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);
        AiMessageEntity turn = messages.message(conversation, AiMessageEntity.ROLE_USER, "Dórival jól vagyunk");
        PersonEntity dori = persons.createPerson(userId, "Dóri");
        List<PersonFactEntity> saved = personFactService.capture(userId, PersonFactEntity.SOURCE_CHAT_TURN,
                turn.getId().toString(), List.of(
                        new PersonFactService.PersonFactCapture(dori.getId(), PersonFactEntity.KIND_RELATIONSHIP_STATE,
                                "Dórival egyre komfortosabbak vagyunk.", "high"),
                        new PersonFactService.PersonFactCapture(dori.getId(), PersonFactEntity.KIND_PREFERENCE,
                                "Dóri mellett nem kell megjátszanom magam.", "high")));
        UUID copy = aboutMeService.add(userId, saved.getFirst().getId());

        TurnMemoryResponse memory = turnMemoryService.turnMemory(userId, conversation.getId(), turn.getId());

        assertThat(memory.getLearned()).hasSize(2);
        assertThat(memory.getLearned()).filteredOn(f -> f.getId().equals(saved.getFirst().getId()))
                .singleElement().satisfies(f -> assertThat(f.getAboutMeFactId()).isEqualTo(copy));
        assertThat(memory.getLearned()).filteredOn(f -> f.getId().equals(saved.get(1).getId()))
                .singleElement().satisfies(f -> assertThat(f.getAboutMeFactId()).isNull());
    }

    @Test
    void testTurnMemory_shouldFlagAForgetRequest_evenWhenNothingWasForgotten() {
        UUID userId = databasePopulator.populateUser("s8-turnmem-forget@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);
        AiMessageEntity forget = messages.message(conversation, AiMessageEntity.ROLE_USER, "Az Annásat inkább ne jegyezd meg.");

        TurnMemoryResponse memory = turnMemoryService.turnMemory(userId, conversation.getId(), forget.getId());

        assertThat(memory.getForgetRequest()).isTrue();
        assertThat(memory.getForgotten()).isEmpty();
    }

    @Test
    void testTurnMemory_shouldReturn404_forAForeignConversationOrAnAssistantRow() {
        UUID owner = databasePopulator.populateUser("s8-turnmem-owner@test.local");
        UUID stranger = databasePopulator.populateUser("s8-turnmem-stranger@test.local");
        AiConversationEntity conversation = conversations.conversation(owner);
        AiMessageEntity turn = messages.message(conversation, AiMessageEntity.ROLE_USER, "szia");
        AiMessageEntity answer = messages.message(conversation, AiMessageEntity.ROLE_ASSISTANT, "szia!");

        assertThatThrownBy(() -> turnMemoryService.turnMemory(stranger, conversation.getId(), turn.getId()))
                .isInstanceOf(SystemRuntimeErrorException.class);
        assertThatThrownBy(() -> turnMemoryService.turnMemory(owner, conversation.getId(), answer.getId()))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }
}

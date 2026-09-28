package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.feature.people.entity.PersonFactEntity;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
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
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/** S8 (mezo-d6ivw.12): a forget request inside a real chat turn — prompt, envelope, no-extract. */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.conversation.enabled=true")
class ChatForgetTurnIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private PersonFactService personFactService;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private AiMessagePopulator messages;
    @Autowired private PersonPopulator persons;
    @Autowired private DatabasePopulator databasePopulator;

    private SendMessageRequest request(String text) {
        return SendMessageRequest.builder().content(text).build();
    }

    @Test
    void testSendMessage_shouldForgetTellTheModelAndRecordTheEnvelope_whenAskedNotToRemember() {
        UUID userId = databasePopulator.populateUser("s8-forget-turn@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);
        AiMessageEntity earlier = messages.message(conversation, AiMessageEntity.ROLE_USER, "Anna régi csapattársam");
        PersonEntity anna = persons.createPerson(userId, "Anna");
        personFactService.capture(userId, PersonFactEntity.SOURCE_CHAT_TURN, earlier.getId().toString(), List.of(
                new PersonFactService.PersonFactCapture(anna.getId(), PersonFactEntity.KIND_PREFERENCE,
                        "régi csapattársad", "medium")));

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("Ezt ne jegyezd meg."));

        assertThat(answer.getContent()).contains("[Elfelejtve]").contains("Anna: régi csapattársad");
        AiMessageEntity forgetRow = messageRepository.findById(answer.getTurnUserMessageId()).orElseThrow();
        assertThat(forgetRow.isExtractionBlocked()).isTrue();
        assertThat(forgetRow.getForgottenMemories().items()).singleElement()
                .satisfies(i -> assertThat(i.text()).isEqualTo("régi csapattársad"));
    }

    @Test
    void testSendMessage_shouldSayNothingToForget_whenNothingWasLearned() {
        UUID userId = databasePopulator.populateUser("s8-forget-nothing@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("felejtsd el"));

        assertThat(answer.getContent()).contains("[Elfelejtve]").contains("nem volt mit elfelejteni");
        assertThat(messageRepository.findById(answer.getTurnUserMessageId()).orElseThrow().getForgottenMemories()).isNull();
    }

    @Test
    void testSendMessage_shouldNotForget_forANegativePhrase() {
        UUID userId = databasePopulator.populateUser("s8-forget-negative@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                request("Felejtsd el a tervet, csináljunk újat."));

        // S8 (mezo-d6ivw.12) Task 8: the stable voice now mentions [Elfelejtve] by name as an
        // instruction — anchor on the block's own "\n\n" prefix (ChatMemoryBlocks.forgetBlock) to
        // tell that mention apart from the actual (absent) block.
        assertThat(answer.getContent()).doesNotContain("\n\n[Elfelejtve]");
        assertThat(messageRepository.findById(answer.getTurnUserMessageId()).orElseThrow().isExtractionBlocked()).isFalse();
    }
}

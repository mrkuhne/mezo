package io.mrkuhne.mezo.feature.companion.service;

import static java.util.concurrent.TimeUnit.MILLISECONDS;
import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.auth.service.LearningPauseService;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;

/**
 * "Most ne tanulj" in a real chat turn (mezo-rrjxe): a turn SAID during a pause is flagged on
 * {@link ChatTurnCompleted} and none of the four post-turn learners (fact extraction, person-fact
 * extraction, turn embedding, mention detection) leaves a row — while the very next turn after
 * resume learns again. Not {@code @Transactional}: the listeners are AFTER_COMMIT.
 */
@RecordApplicationEvents
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.companion.extraction.enabled=true",
        "mezo.companion.embedding.embed-chat-turns=true"
})
class LearningPauseChatIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private LearningPauseService learningPause;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private PersonPopulator persons;
    @Autowired private CompanionToolRegistry toolRegistry;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ApplicationEvents events;

    private static SendMessageRequest request(String text) {
        return SendMessageRequest.builder().content(text).build();
    }

    private int count(String table, UUID user) {
        return jdbc.queryForObject("select count(*) from " + table + " where created_by = ?", Integer.class, user);
    }

    private int embeddingsOf(UUID assistantMessageId) {
        return jdbc.queryForObject("select count(*) from memory_embedding where ref_id = ?", Integer.class,
                assistantMessageId);
    }

    @Test
    void testChatTurn_shouldLearnNothing_whenSaidDuringAPause_andLearnAgainAfterResume() {
        UUID user = databasePopulator.populateUser("pause-chat@test.local");
        persons.createPerson(user, "Ádám");
        AiConversationEntity conversation = conversations.conversation(user);

        learningPause.start(user, "open");
        MessageResponse paused = chatService.sendMessage(user, conversation.getId(),
                request("Ádám ma sokat segített, és megtudtam, hogy laktózérzékeny vagyok."));
        learningPause.end(user);
        MessageResponse resumed = chatService.sendMessage(user, conversation.getId(),
                request("Ádám holnap is jön edzeni."));

        // the control turn proves the listeners are alive in this context …
        await().atMost(10, SECONDS).untilAsserted(() -> {
            assertThat(embeddingsOf(resumed.getId())).isEqualTo(1);
            assertThat(jdbc.queryForObject("select count(*) from mention where created_by = ? and source_ref_id = ?",
                    Integer.class, user, resumed.getTurnUserMessageId())).isEqualTo(1);
        });
        // … and the paused turn never leaves a trace, however long we wait
        await().during(1500, MILLISECONDS).atMost(5, SECONDS).untilAsserted(() -> {
            assertThat(embeddingsOf(paused.getId())).isZero();
            assertThat(jdbc.queryForObject("select count(*) from mention where created_by = ? and source_ref_id = ?",
                    Integer.class, user, paused.getTurnUserMessageId())).isZero();
            assertThat(jdbc.queryForObject("select count(*) from learned_fact where created_by = ? and derived_from_message_id = ?",
                    Integer.class, user, paused.getTurnUserMessageId())).isZero();
            assertThat(jdbc.queryForObject("select count(*) from person_fact where created_by = ? and source_ref_id = ?",
                    Integer.class, user, paused.getTurnUserMessageId().toString())).isZero();
        });

        assertThat(events.stream(ChatTurnCompleted.class)).extracting(ChatTurnCompleted::learningPaused)
                .containsExactly(true, false);
    }

    /** The STREAMED path publishes from completeTurn: judged by when the user SAID it, so a turn
     *  sent during a pause stays paused even though the answer lands after resume. */
    @Test
    void testStreamedTurn_shouldStayPaused_whenResumedBeforeTheAnswerLanded() {
        UUID user = databasePopulator.populateUser("pause-chat-stream@test.local");
        AiConversationEntity conversation = conversations.conversation(user);

        learningPause.start(user, "open");
        ChatService.PreparedTurn turn = chatService.prepareTurn(user, conversation.getId(),
                request("Ezt csak most mondom el."));
        learningPause.end(user);
        chatService.completeTurn(user, conversation.getId(), turn.userMessageId(), turn.userContent(),
                "Értem.", toolRegistry.newTurnAudit(), null, null, false, turn.recalled());

        assertThat(events.stream(ChatTurnCompleted.class)).singleElement()
                .satisfies(e -> assertThat(e.learningPaused()).isTrue());
        assertThat(count("learning_pause", user)).isEqualTo(1);
    }
}

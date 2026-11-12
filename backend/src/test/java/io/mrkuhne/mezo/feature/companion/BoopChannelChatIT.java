package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.CreateConversationRequest;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.feature.companion.service.ConversationService;
import io.mrkuhne.mezo.feature.companion.service.OwnerToday;
import io.mrkuhne.mezo.feature.wearable.entity.DailyMetricEntity;
import io.mrkuhne.mezo.feature.wearable.repository.DailyMetricRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.CreatedAtBackdater;
import io.mrkuhne.mezo.support.populator.DailyMetricPopulator;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * Boop B3 (mezo-r36n9.13, spec §7.6): a {@code channel = boop} conversation carries the deterministic "Ma"
 * block on every turn, sees only today's turns as history and speaks as Boop; a web conversation is
 * unchanged. Runs the shipped conversation-first path ({@code mezo.companion.conversation.enabled=true}).
 */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.conversation.enabled=true")
@Import(BoopChannelChatIT.OwnerClockConfig.class)
class BoopChannelChatIT extends AbstractIntegrationTest {

    /** The application clock; the system clock unless a test pins it. */
    static final class MutableClock extends Clock {
        private volatile Clock delegate = Clock.systemUTC();

        void set(Instant instant) { delegate = Clock.fixed(instant, ZoneOffset.UTC); }
        void reset() { delegate = Clock.systemUTC(); }
        @Override public ZoneId getZone() { return delegate.getZone(); }
        @Override public Clock withZone(ZoneId zone) { return delegate.withZone(zone); }
        @Override public Instant instant() { return delegate.instant(); }
    }

    @TestConfiguration
    static class OwnerClockConfig {
        @Bean
        MutableClock boopChannelTestClock() {
            return new MutableClock();
        }
    }

    private static final String BLOCK_HEADER = "[Ma — Boop látja]";

    @Autowired private ChatService chatService;
    @Autowired private ConversationService conversationService;
    @Autowired private AiConversationRepository conversationRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private AiMessagePopulator messagePopulator;
    @Autowired private CreatedAtBackdater backdater;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private DailyMetricPopulator metricPopulator;
    @Autowired private DailyMetricRepository metrics;
    @Autowired private OwnerToday ownerToday;
    @Autowired private MutableClock clock;

    @AfterEach
    void resetClock() {
        clock.reset();
    }

    // gear-audited: conversation-first deliberately does not classify individual messages.
    private static SendMessageRequest request(String text) {
        return SendMessageRequest.builder().content(text).build();
    }

    private UUID boopConversation(UUID user) {
        ConversationResponse created = conversationService.create(user,
            CreateConversationRequest.builder().channel(CreateConversationRequest.ChannelEnum.BOOP).build());
        return created.getId();
    }

    @Test
    void boopChannelPushesDayBlockEveryTurn() {
        UUID user = databasePopulator.populateUser("boop-chat-block@test.local");
        DailyMetricEntity today = metricPopulator.createDay(user, ownerToday.today(), 4210, 55);
        today.setHrvMs(BigDecimal.valueOf(41));
        metrics.saveAndFlush(today);
        UUID conversation = boopConversation(user);

        assertThat(conversationRepository.findById(conversation)).get()
            .extracting(AiConversationEntity::getChannel).isEqualTo("boop");

        MessageResponse first = chatService.sendMessage(user, conversation, request("Hogy alakul a napom?"));
        MessageResponse second = chatService.sendMessage(user, conversation, request("És a délutánom?"));

        for (MessageResponse answer : java.util.List.of(first, second)) {
            assertThat(answer.getContent())
                .contains(BLOCK_HEADER + " " + ownerToday.today())
                .contains("Lépés ma eddig: 4 210")
                .contains("Te vagy Boop")
                .contains("nevezd meg a forrását");
        }
        // the planner gets the same block: it is part of the volatile context the turn plans on
        var turn = chatService.prepareTurn(user, conversation, request("Mennyit egyek a röpi előtt?"));
        assertThat(turn.turnContext()).contains(BLOCK_HEADER);
        assertThat(turn.systemPrompt()).contains("Te vagy Boop").doesNotContainIgnoringCase("mezo");
    }

    @Test
    void boopChannelHistoryOnlyToday() {
        UUID user = databasePopulator.populateUser("boop-chat-history@test.local");
        UUID conversationId = boopConversation(user);
        AiConversationEntity conversation = conversationRepository.findById(conversationId).orElseThrow();
        Instant yesterday = ownerToday.today().atStartOfDay(ownerToday.zone()).toInstant().minusSeconds(3600);
        AiMessageEntity oldQuestion = messagePopulator.message(conversation, "user", "TEGNAPI-KERDES");
        AiMessageEntity oldAnswer = messagePopulator.message(conversation, "assistant", "TEGNAPI-VALASZ");
        backdater.backdate("ai_message", oldQuestion.getId(), yesterday.minusSeconds(60));
        backdater.backdate("ai_message", oldAnswer.getId(), yesterday);
        conversation = conversationRepository.findById(conversationId).orElseThrow();
        messagePopulator.message(conversation, "user", "MAI-KERDES");
        messagePopulator.message(conversation, "assistant", "MAI-VALASZ");

        MessageResponse answer = chatService.sendMessage(user, conversationId, request("És most?"));

        assertThat(answer.getContent()).contains("MAI-KERDES").contains("MAI-VALASZ")
            .doesNotContain("TEGNAPI-KERDES").doesNotContain("TEGNAPI-VALASZ");
    }

    @Test
    void webChannelUnchanged() {
        UUID user = databasePopulator.populateUser("boop-chat-web@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(user);
        AiMessageEntity old = messagePopulator.message(conversation, "user", "TEGNAPI-KERDES");
        backdater.backdate("ai_message", old.getId(),
            ownerToday.today().atStartOfDay(ownerToday.zone()).toInstant().minusSeconds(3600));
        UUID created = conversationService.create(user, null).getId();

        MessageResponse answer = chatService.sendMessage(user, conversation.getId(), request("És most?"));

        assertThat(conversationRepository.findById(created)).get()
            .extracting(AiConversationEntity::getChannel).isEqualTo("web");
        assertThat(answer.getContent()).contains("TEGNAPI-KERDES").contains("Te vagy a mezo")
            .doesNotContain(BLOCK_HEADER).doesNotContain("Te vagy Boop");
    }

    @Test
    void boopConversationTitledWithDate() {
        UUID user = databasePopulator.populateUser("boop-chat-title@test.local");
        clock.set(Instant.parse("2026-11-12T10:00:00Z"));
        UUID conversation = boopConversation(user);

        chatService.sendMessage(user, conversation, request("Hogy alakul a napom?"));

        // one conversation per day: named after the day, never retitled by its first question
        assertThat(conversationRepository.findById(conversation)).get()
            .extracting(AiConversationEntity::getTitle).isEqualTo("2026. november 12.");
    }

    @Test
    void ownerZoneDecidesToday() {
        UUID user = databasePopulator.populateUser("boop-chat-zone@test.local");
        UUID conversation = boopConversation(user);
        // 23:30 UTC on the 12th is already 00:30 on the 13th in Budapest — the owner's day decides
        clock.set(Instant.parse("2026-11-12T23:30:00Z"));

        MessageResponse answer = chatService.sendMessage(user, conversation, request("Hogy alakul a napom?"));

        assertThat(answer.getContent()).contains(BLOCK_HEADER + " 2026-11-13").contains("Ma: 2026-11-13")
            .doesNotContain(BLOCK_HEADER + " 2026-11-12");
    }
}

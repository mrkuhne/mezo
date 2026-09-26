package io.mrkuhne.mezo.feature.character.chat;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import io.mrkuhne.mezo.feature.character.repository.TeamChatLineRepository;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaisedEvent;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.service.LlmActorResolver;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Final review I1 (mezo-a9bo7.25): the team chat listener runs {@code @Async} off the raising
 * thread, which carries no security context — so before the fix the voice call's
 * {@code llm_log.created_by} booked against nobody and {@code TeamChatBudget} (a per-owner sum)
 * never saw the spend the monthly cap is about.
 *
 * <p>The actor is asserted where {@code EventPublishingLlmCallRecorder} reads it — at call time,
 * on the thread that reaches the port ({@code LlmActorPropagationIT}'s method): under
 * {@code companion-fake} the fake adapter never reaches the recorder, so a literal
 * {@code llm_log} row cannot be produced here; the (actor, feature) pair captured below is exactly
 * what the recorder would write into {@code created_by} / {@code feature}. The second case pins
 * the cap on the listener path end to end.
 */
@ActiveProfiles("companion-fake")
@Import(TeamChatListenerActorIT.CapturingConfiguration.class)
class TeamChatListenerActorIT extends AbstractIntegrationTest {

    /** The fake, plus the recorder's two inputs read on the calling thread. */
    static class ActorCapturingFake extends FakeCompanionLlm {

        private final LlmActorResolver actorResolver;
        private final LlmCallContextHolder contextHolder;
        final AtomicReference<UUID> actor = new AtomicReference<>();
        final AtomicReference<String> feature = new AtomicReference<>();

        ActorCapturingFake(LlmActorResolver actorResolver, LlmCallContextHolder contextHolder) {
            this.actorResolver = actorResolver;
            this.contextHolder = contextHolder;
        }

        @Override
        public String complete(String systemPrompt, List<Turn> history, String userMessage,
                List<ToolCallback> tools, Map<String, Object> toolContext) {
            if (systemPrompt.startsWith(FakeCompanionLlm.TEAM_CHAT_MARKER_MIRROR)) {
                actor.set(actorResolver.currentActor());
                feature.set(contextHolder.get().feature());
            }
            return super.complete(systemPrompt, history, userMessage, tools, toolContext);
        }
    }

    @TestConfiguration
    static class CapturingConfiguration {

        @Bean
        @Primary
        ActorCapturingFake actorCapturingFake(LlmActorResolver actorResolver, LlmCallContextHolder contextHolder) {
            return new ActorCapturingFake(actorResolver, contextHolder);
        }
    }

    @Autowired private ActorCapturingFake llm;
    @Autowired private TeamChatLineRepository lines;
    @Autowired private UserPopulator userPopulator;
    @Autowired private FlagLogPopulator flagLogPopulator;
    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private ApplicationEventPublisher publisher;
    @Autowired private TransactionTemplate tx;

    @BeforeEach
    void reset() {
        llm.actor.set(null);
        llm.feature.set(null);
    }

    private UUID raiseSleepDebt() {
        UUID owner = userPopulator.createUser().getId();
        flagLogPopulator.raise(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_WRITE,
                FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(7.5, 7, 7, 5.0, 6.5, Map.of())));
        tx.executeWithoutResult(s -> publisher.publishEvent(
                new FlagRaisedEvent(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_WRITE)));
        return owner;
    }

    private List<TeamChatLineEntity> linesOf(UUID owner) {
        return lines.findByCreatedByAndOccurredAtBetweenAndDeletedFalseOrderByOccurredAtAsc(
                owner, Instant.now().minus(1, ChronoUnit.DAYS), Instant.now().plus(1, ChronoUnit.DAYS));
    }

    @Test
    void listenerVoiceCall_isBookedAgainstTheOwner_underTheTeamChatFeature() {
        UUID owner = raiseSleepDebt();

        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(linesOf(owner)).isNotEmpty());

        assertThat(llm.actor.get()).isEqualTo(owner);
        assertThat(llm.feature.get()).isEqualTo("team_chat");
        assertThat(linesOf(owner).getFirst().getVoiced()).isTrue();
    }

    @Test
    void listenerPath_atTheMonthlyCap_keepsTheTemplateLine() {
        UUID owner = userPopulator.createUser().getId();
        llmLogPopulator.log(owner, CallKind.CHAT, "team_chat", "gemini-2.5-flash", 100, 20,
                null, new BigDecimal("1.00"));
        flagLogPopulator.raise(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_WRITE,
                FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(7.5, 7, 7, 5.0, 6.5, Map.of())));
        tx.executeWithoutResult(s -> publisher.publishEvent(
                new FlagRaisedEvent(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_WRITE)));

        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(linesOf(owner)).isNotEmpty());

        assertThat(linesOf(owner)).singleElement().satisfies(l -> assertThat(l.getVoiced()).isFalse());
        assertThat(llm.actor.get()).isNull(); // the cap refused before any model call
    }
}

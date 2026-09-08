package io.mrkuhne.mezo.feature.llmlog.context;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalInput;
import io.mrkuhne.mezo.feature.companion.memory.dto.ScoreBreakdown;
import io.mrkuhne.mezo.feature.companion.memory.service.LlmMemoryReranker;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryCandidateFusion;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryCandidateFusion.FusedCandidate;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextRenderer;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextSelector;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryQueryPreparer;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryRetrievalAuditWriter;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryRetriever;
import io.mrkuhne.mezo.feature.llmlog.service.LlmActorResolver;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import reactor.core.publisher.Flux;

/**
 * mezo-ozri.7: the memory platform submits its LLM work to {@code applicationTaskExecutor}, which
 * propagates no security context — so before this slice the audit rows of a rerank or an embed made
 * FOR an authenticated user booked against nobody, and the per-user USD cap (mezo-ozri.6) could not
 * see that traffic.
 *
 * <p>The assertion is made where {@code EventPublishingLlmCallRecorder} makes it: by calling
 * {@link LlmActorResolver#currentActor()} on the very thread that reaches the port, at call time.
 * An end-to-end "one llm_log_history row" assertion is impossible under {@code companion-fake} —
 * the fake adapter never reaches the recorder; that mapping is {@code LlmLogWriterIT}'s job. Same
 * reasoning as the sibling {@link LlmCallContextTaggingIT}.
 *
 * <p>No test transaction, for the same reason {@code MemoryContextServiceIT} has none: the
 * retriever pool's connections must see committed fixtures.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.feature.knowledge-graph.enabled=true"
})
@Import(LlmActorPropagationIT.ActorCapturingConfiguration.class)
class LlmActorPropagationIT extends AbstractIntegrationTest {

    /** Reads the actor DURING the call, exactly where the live recorder reads it. */
    static class ActorCapturingCompanionLlm implements CompanionLlm {

        private final LlmActorResolver actorResolver;
        private final AtomicReference<UUID> capturedActor = new AtomicReference<>();
        private volatile String answer = "[]";

        ActorCapturingCompanionLlm(LlmActorResolver actorResolver) {
            this.actorResolver = actorResolver;
        }

        UUID capturedActor() {
            return capturedActor.get();
        }

        void answerWith(String answer) {
            this.answer = answer;
        }

        void reset() {
            capturedActor.set(null);
        }

        @Override
        public String complete(String systemPrompt, List<CompanionLlm.Turn> history, String userMessage,
            List<ToolCallback> tools, Map<String, Object> toolContext) {
            capturedActor.set(actorResolver.currentActor());
            return answer;
        }

        @Override
        public Flux<String> stream(String systemPrompt, List<CompanionLlm.Turn> history, String userMessage,
            List<ToolCallback> tools, Map<String, Object> toolContext) {
            capturedActor.set(actorResolver.currentActor());
            return Flux.just(answer);
        }

        @Override
        public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
            capturedActor.set(actorResolver.currentActor());
            return answer;
        }

        @Override
        public String complete(String systemPrompt, String userMessage, InlineAudio audio) {
            capturedActor.set(actorResolver.currentActor());
            return answer;
        }
    }

    @TestConfiguration
    static class ActorCapturingConfiguration {

        @Bean
        @Primary
        ActorCapturingCompanionLlm actorCapturingCompanionLlm(LlmActorResolver actorResolver) {
            return new ActorCapturingCompanionLlm(actorResolver);
        }
    }

    @Autowired private ActorCapturingCompanionLlm actorCapturingCompanionLlm;
    @Autowired private LlmMemoryReranker llmMemoryReranker;
    @Autowired private LlmActorResolver llmActorResolver;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private MemoryQueryPreparer queryPreparer;
    @Autowired private MemoryCandidateFusion fusion;
    @Autowired private MemoryContextSelector selector;
    @Autowired private MemoryContextRenderer renderer;
    @Autowired private MemoryRetrievalAuditWriter auditWriter;
    @Autowired private MemoryPlatformProperties properties;
    @Autowired private LlmCallContextHolder llmCallContextHolder;
    @Autowired @Qualifier("applicationTaskExecutor") private AsyncTaskExecutor taskExecutor;

    @BeforeEach
    void resetCapture() {
        actorCapturingCompanionLlm.reset();
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private static void authenticateAs(UUID principalId) {
        Jwt jwt = Jwt.withTokenValue("test-token")
            .header("alg", "none")
            .subject(principalId.toString())
            .issuedAt(Instant.now().minusSeconds(60))
            .expiresAt(Instant.now().plusSeconds(60))
            .build();
        SecurityContextHolder.getContext()
            .setAuthentication(new JwtAuthenticationToken(jwt, List.of()));
    }

    @Test
    void testRerank_shouldBookTheCallAgainstTheRequestUser_whenTheRerankRunsOnAPooledThread() {
        UUID user = databasePopulator.populateUser("llm-actor-rerank@test.local");
        authenticateAs(user);
        FusedCandidate first = fusedCandidate(UUID.randomUUID());
        FusedCandidate second = fusedCandidate(UUID.randomUUID());
        actorCapturingCompanionLlm.answerWith(
            "[\"%s\",\"%s\"]".formatted(second.candidate().stableId(), first.candidate().stableId()));

        llmMemoryReranker.rerank(List.of(first, second));

        assertThat(actorCapturingCompanionLlm.capturedActor()).isEqualTo(user);
    }

    @Test
    void testRetrieve_shouldRunEveryRetrieverAsTheRequestUser_whenTheTasksRunOnPooledThreads() {
        // Hop 2: a retriever's embed call is the highest-volume LLM traffic the memory platform
        // makes, and it happens on the pool thread — the probe reads the actor exactly where the
        // embedding adapter's recorder would.
        UUID user = databasePopulator.populateUser("llm-actor-retriever@test.local");
        authenticateAs(user);
        AtomicReference<UUID> seenInRetriever = new AtomicReference<>();
        MemoryContextService probedService = new MemoryContextService(
                queryPreparer, Map.of("dense", actorProbeRetriever("dense", seenInRetriever)),
                fusion, selector, renderer, llmMemoryReranker, auditWriter, properties,
                llmCallContextHolder, taskExecutor);

        probedService.retrieve(new MemoryRequest(user, ConsumerPolicy.CHAT_AMBIENT,
                "Mi történt Boglárkával?", List.of(), LocalDate.of(2026, 9, 8), 1200,
                UUID.randomUUID(), false));

        assertThat(seenInRetriever.get()).isEqualTo(user);
    }

    private static MemoryRetriever actorProbeRetriever(String name, AtomicReference<UUID> sink) {
        return new MemoryRetriever() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public List<MemoryCandidate> retrieve(RetrievalInput input) {
                sink.set(io.mrkuhne.mezo.techcore.security.LlmActorContext.capture());
                return List.of();
            }
        };
    }

    private static FusedCandidate fusedCandidate(UUID stableId) {
        MemoryCandidate candidate = new MemoryCandidate("dense", "memory_item", stableId, stableId, stableId,
                "journal_entry", "Napló", "tartalom", LocalDate.of(2026, 9, 1), 0.9,
                false, false, 0.5, null, null);
        return new FusedCandidate(candidate, new ScoreBreakdown(0.5, 0, 0, 0, 0, 0, 0.5), Map.of("dense", 1));
    }
}

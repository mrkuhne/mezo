package io.mrkuhne.mezo.feature.companion.llm;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import reactor.core.scheduler.Schedulers;

/** Real provider adapter + HTTP boundary + PostgreSQL audit, no external provider call. */
@TestPropertySource(properties = {"mezo.feature.companion.enabled=true", "mezo.companion.llm.provider=openai"})
class StreamActorAttributionIT extends AbstractIntegrationTest {
    static final WireMockServer server = new WireMockServer(wireMockConfig().dynamicPort());
    static { server.start(); }
    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.ai.openai.base-url", () -> server.baseUrl() + "/v1");
    }
    @AfterAll static void stop() { server.stop(); }
    @Autowired CompanionLlm llm;
    @Autowired DatabasePopulator users;
    @Autowired LlmLogRepository logs;

    private void stubStream() {
        server.stubFor(post(urlPathEqualTo("/v1/chat/completions")).willReturn(aResponse()
                .withHeader("Content-Type", "text/event-stream")
                .withBody("data: {\"id\":\"test\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"gpt-5.6-terra\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"Szia\"},\"finish_reason\":null}]}\n\n"
                        + "data: {\"id\":\"test\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"gpt-5.6-terra\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":2,\"total_tokens\":12}}\n\n"
                        + "data: [DONE]\n\n")));
    }

    @Test
    void testStream_shouldPersistCapturedOwner_whenCompletionRunsOnProviderThread() {
        stubStream();
        var owner = users.populateUser("stream-actor@test.local");
        var stream = LlmActorContext.runAsCaptured(owner,
                () -> llm.streamSmart("Magyarul válaszolj", "", List.of(), "Szia"));
        assertThat(stream.subscribeOn(Schedulers.boundedElastic()).collectList().block(Duration.ofSeconds(20)))
                .contains("Szia");
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            assertThat(logs.findAll()).hasSize(1);
            assertThat(logs.findAll().getFirst().getCreatedBy()).isEqualTo(owner);
        });
        assertThat(LlmActorContext.capture()).isNull();
    }
    @Test
    void testStream_shouldKeepOwnersSeparate_whenTwoStreamsSubscribeOnOtherThreads() {
        stubStream();
        var first = users.populateUser("stream-first@test.local");
        var second = users.populateUser("stream-second@test.local");
        var a = LlmActorContext.runAsCaptured(first, () -> llm.streamSmart("Válaszolj", "", List.of(), "első"));
        var b = LlmActorContext.runAsCaptured(second, () -> llm.streamSmart("Válaszolj", "", List.of(), "második"));
        reactor.core.publisher.Flux.merge(a.subscribeOn(Schedulers.boundedElastic()), b.subscribeOn(Schedulers.boundedElastic()))
                .collectList().block(Duration.ofSeconds(20));
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                assertThat(logs.findAll()).extracting(row -> row.getCreatedBy()).containsExactlyInAnyOrder(first, second));
        assertThat(LlmActorContext.capture()).isNull();
    }

    @Test
    void testStream_shouldPersistCapturedOwner_whenSubscriberCancelsAfterFirstChunk() {
        stubStream();
        var owner = users.populateUser("stream-cancel@test.local");
        var stream = LlmActorContext.runAsCaptured(owner, () -> llm.streamSmart("Válaszolj", "", List.of(), "Szia"));
        stream.subscribeOn(Schedulers.boundedElastic()).take(1).collectList().block(Duration.ofSeconds(20));
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            assertThat(logs.findAll()).hasSize(1);
            assertThat(logs.findAll().getFirst().getCreatedBy()).isEqualTo(owner);
            assertThat(logs.findAll().getFirst().getStatus().name()).isEqualTo("CANCELLED");
        });
    }

    @Test
    void testStream_shouldPersistCapturedOwner_whenProviderReturnsError() {
        server.stubFor(post(urlPathEqualTo("/v1/chat/completions")).willReturn(aResponse()
                .withStatus(400).withHeader("Content-Type", "application/json")
                .withBody("{\"error\":{\"message\":\"invalid test request\",\"type\":\"invalid_request_error\"}}")));
        var owner = users.populateUser("stream-error@test.local");
        var stream = LlmActorContext.runAsCaptured(owner, () -> llm.streamSmart("Válaszolj", "", List.of(), "Szia"));
        assertThatThrownBy(() -> stream.subscribeOn(Schedulers.boundedElastic()).collectList().block(Duration.ofSeconds(20)))
                .isInstanceOf(RuntimeException.class);
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            assertThat(logs.findAll()).hasSize(1);
            assertThat(logs.findAll().getFirst().getCreatedBy()).isEqualTo(owner);
            assertThat(logs.findAll().getFirst().getStatus().name()).isEqualTo("ERROR");
        });
    }

}

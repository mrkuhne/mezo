package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.llm.GeminiUsageExtractor.UsageInfo;
import org.springframework.ai.chat.client.ChatClientRequest;
import org.springframework.ai.chat.client.ChatClientResponse;
import org.springframework.ai.chat.client.advisor.api.CallAdvisor;
import org.springframework.ai.chat.client.advisor.api.CallAdvisorChain;
import org.springframework.ai.chat.client.advisor.api.StreamAdvisor;
import org.springframework.ai.chat.client.advisor.api.StreamAdvisorChain;
import reactor.core.publisher.Flux;

/**
 * The per-round observer of the tool-execution loop (mezo-58ig). Ordered BETWEEN Spring AI's
 * {@code ToolCallingAdvisor} (whose loop re-enters everything below it once per round) and the
 * terminal {@code ChatModelCallAdvisor}, so it sees each round's OWN response — the last place the
 * Google-native usage block (thoughts/cached) still exists per round — and adds it into the
 * {@link GeminiRoundUsage} tally the adapter planted in the request context.
 *
 * <p>Stateless and shared across clients: all per-call state lives in the tally, so rounds may
 * report from any thread (the streamed loop runs on Reactor schedulers). A request without a tally
 * (not one of ours) passes through untouched. On the stream path only usage-bearing chunks count —
 * Gemini closes each round with one usage-only chunk, so chunk-counting equals round-counting.
 */
final class GeminiRoundUsageAdvisor implements CallAdvisor, StreamAdvisor {

    /**
     * Strictly between ToolCallingAdvisor.DEFAULT_ORDER (Integer.MIN_VALUE + 300, the loop) and
     * ChatModelCallAdvisor (Integer.MAX_VALUE, the model call) — inside the loop, around the model.
     */
    private static final int ORDER = 0;

    private final GeminiUsageExtractor geminiUsageExtractor;

    GeminiRoundUsageAdvisor(GeminiUsageExtractor geminiUsageExtractor) {
        this.geminiUsageExtractor = geminiUsageExtractor;
    }

    @Override
    public ChatClientResponse adviseCall(ChatClientRequest request, CallAdvisorChain chain) {
        ChatClientResponse response = chain.nextCall(request);
        tally(request, response);
        return response;
    }

    @Override
    public Flux<ChatClientResponse> adviseStream(ChatClientRequest request, StreamAdvisorChain chain) {
        return chain.nextStream(request).doOnNext(response -> tally(request, response));
    }

    private void tally(ChatClientRequest request, ChatClientResponse response) {
        if (!(request.context().get(GeminiRoundUsage.CONTEXT_KEY) instanceof GeminiRoundUsage tally)) {
            return;
        }
        // The extractor's all-zero guard makes a usage-less chunk/round a null — never counted.
        UsageInfo usage = geminiUsageExtractor.extract(response == null ? null : response.chatResponse());
        tally.addRound(usage.tokens());
    }

    @Override
    public String getName() {
        return getClass().getSimpleName();
    }

    @Override
    public int getOrder() {
        return ORDER;
    }
}

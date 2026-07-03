package io.mrkuhne.mezo.feature.companion;

import org.springframework.ai.tool.ToolCallback;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

/**
 * The single seam between the companion and any LLM (ADR 0008). Everything above this
 * interface is deterministic and provider-agnostic; everything below it is one adapter
 * ({@code GeminiCompanionLlm} for real traffic, {@code FakeCompanionLlm} under the
 * {@code companion-fake} profile so integration tests never touch the network).
 *
 * <p>V0.5 shape — system prompt + user message + registered tools. ToolCallback/ToolContext are
 * spring-ai-core types (shared by every provider starter), NOT provider types; the tool-execution
 * loop runs inside the adapter (Spring AI), so callers only see the final text. The two-string
 * default overloads remain for tool-less calls (hello smoke, future pipelines).
 */
public interface CompanionLlm {

    /** One-shot completion on the cheap chat tier, with the turn's tools registered. */
    String complete(String systemPrompt, String userMessage,
                    List<ToolCallback> tools, Map<String, Object> toolContext);

    /** Streamed completion (token/chunk deltas) on the cheap chat tier, with tools registered. */
    Flux<String> stream(String systemPrompt, String userMessage,
                        List<ToolCallback> tools, Map<String, Object> toolContext);

    default String complete(String systemPrompt, String userMessage) {
        return complete(systemPrompt, userMessage, List.of(), Map.of());
    }

    default Flux<String> stream(String systemPrompt, String userMessage) {
        return stream(systemPrompt, userMessage, List.of(), Map.of());
    }
}

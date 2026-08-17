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

    /** Ki beszélt egy korábbi körben — a port provider-független szerepfogalma. */
    enum Role { USER, ASSISTANT }

    /** Egy lezárt korábbi üzenet. A history ezekből áll, legrégebbitől a legújabbig. */
    record Turn(Role role, String content) {}

    /**
     * One-shot completion on the cheap chat tier, with the turn's tools registered and the
     * conversation so far as REAL prior messages (mezo-q71s) — not a transcript inside the
     * system prompt. The 4-arg overload below stays for the one-shot pipeline callers.
     */
    String complete(String systemPrompt, List<Turn> history, String userMessage,
                    List<ToolCallback> tools, Map<String, Object> toolContext);

    /** Streamed twin of {@link #complete(String, List, String, List, Map)}. */
    Flux<String> stream(String systemPrompt, List<Turn> history, String userMessage,
                        List<ToolCallback> tools, Map<String, Object> toolContext);

    /** History-less completion — every one-shot pipeline (meal, recipe, pantry, sleep, …) rides this. */
    default String complete(String systemPrompt, String userMessage,
                            List<ToolCallback> tools, Map<String, Object> toolContext) {
        return complete(systemPrompt, List.of(), userMessage, tools, toolContext);
    }

    /** History-less stream. */
    default Flux<String> stream(String systemPrompt, String userMessage,
                                List<ToolCallback> tools, Map<String, Object> toolContext) {
        return stream(systemPrompt, List.of(), userMessage, tools, toolContext);
    }

    default String complete(String systemPrompt, String userMessage) {
        return complete(systemPrompt, userMessage, List.of(), Map.of());
    }

    /** An ephemeral inline image for a multimodal call — bytes live only for the call. */
    record InlineImage(byte[] bytes, String mimeType) {}

    /**
     * One-shot completion on the cheap tier with ephemeral inline image(s) (vision). Nothing is
     * stored. mezo-d8tr (pantry photo import) is the first multi-image consumer; single-image
     * callers (meal-AI, mezo-78rn) ride the delegating default below.
     */
    String complete(String systemPrompt, String userMessage, List<InlineImage> images);

    /** Single-image convenience — delegates to the list overload. */
    default String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType) {
        return complete(systemPrompt, userMessage, List.of(new InlineImage(imageBytes, mimeType)));
    }

    /** An ephemeral inline audio clip for a multimodal call — bytes live only for the call. */
    record InlineAudio(byte[] bytes, String mimeType) {}

    /**
     * One-shot completion on the cheap tier with an ephemeral inline audio clip (mezo-at8x.4 —
     * chat voice input). Nothing is stored. Same contract as the vision overload: the bytes
     * never leave the call, and the answer is plain text.
     */
    String complete(String systemPrompt, String userMessage, InlineAudio audio);

    /**
     * One-shot completion on the SMART tier (V3.2 — the heavy weekly pipelines; ADR 0008 model
     * tiers). Defaults to the cheap tier so the fake (and any adapter without a smart model)
     * keeps a single deterministic dispatch path.
     */
    default String completeSmart(String systemPrompt, String userMessage) {
        return complete(systemPrompt, userMessage);
    }

    default Flux<String> stream(String systemPrompt, String userMessage) {
        return stream(systemPrompt, userMessage, List.of(), Map.of());
    }
}

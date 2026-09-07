package io.mrkuhne.mezo.feature.companion.config;

/**
 * Which LLM vendor serves a chat call (mezo-ozri.2). Two providers run side by side by design
 * (spec §P1): OpenAI for text reasoning and tool use, Google for embedding, audio and the fallback.
 *
 * <p>This is the vocabulary of {@code mezo.companion.llm.provider} (which adapter answers a chat
 * turn) and of {@code mezo.companion.llm.per-call-kind} (the per-CallKind exceptions to it — audio
 * and vision, which have no GPT-5.6 route at all).
 */
public enum LlmProvider {

    /** google-genai: the chat fallback, the ONLY audio route, and the embedding provider. */
    GEMINI,

    /** openai: the GPT-5.6 chat tiers. */
    OPENAI
}

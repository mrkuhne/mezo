package io.mrkuhne.mezo.feature.llmlog.service;

/**
 * The ONE seam the LLM adapters know about (mezo-2zyu). Call sites always have a recorder injected;
 * whether that recorder does anything is decided by the {@code mezo.feature.llm-log.enabled} switch
 * at wiring time ({@link EventPublishingLlmCallRecorder} vs {@link NoOpLlmCallRecorder}), so no
 * adapter ever needs an if-check — and audit logging can never break a user call by being on.
 */
public interface LlmCallRecorder {

    /** Fire-and-forget: the caller must never wait on, or fail because of, the audit write. */
    void record(LlmCallRecord record);
}

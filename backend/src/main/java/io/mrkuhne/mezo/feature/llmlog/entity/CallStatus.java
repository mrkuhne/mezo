package io.mrkuhne.mezo.feature.llmlog.entity;

/**
 * Outcome of a logged LLM call. Mirrors {@code ck_llm_log_history_status} — the DB CHECK is the
 * authority, so adding a value here requires a migration.
 */
public enum CallStatus {

    /** The provider answered; usage/cost columns are meaningful. */
    SUCCESS,

    /** The call failed; error_code/error_class carry the reason and the usage columns stay null. */
    ERROR,

    /**
     * A streamed call whose subscriber disconnected mid-stream (mezo-1rz9): the provider was neither
     * done nor failing — the client walked away. The partial answer is recorded; the usage columns
     * are usually null because Gemini's usage block rides the final chunk, which never arrived —
     * the provider still billed the tokens generated up to the cancel.
     */
    CANCELLED
}

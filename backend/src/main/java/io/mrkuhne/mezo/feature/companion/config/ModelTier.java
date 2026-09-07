package io.mrkuhne.mezo.feature.companion.config;

/**
 * Which of a provider's two model tiers a call belongs to (mezo-ozri.4). The tier is decided by the
 * CALL PATH — {@code completeSmart} is the smart tier, everything else the cheap one — and is what
 * the router falls back to when no override matches, plus the key of the per-tier reasoning effort.
 */
public enum ModelTier {

    /** The cheap/fast tier: every conversational turn, vision, transcribe, structured output. */
    CHEAP,

    /** The smart tier: the 19 {@code completeSmart} call sites (weekly/quarterly review, critique). */
    SMART
}

package io.mrkuhne.mezo.feature.companion.service;

/**
 * How much thinking one chat turn earns (spec 2026-09-16 §5). The gear does NOT decide WHO plans —
 * the smart model always does — only the reasoning effort and whether a replan lap is allowed.
 */
public enum TurnGear {

    /** Needs none of the user's data: no plan, no retrieval, one tool-free smart call. */
    CHAT,

    /** A straightforward lookup ("how much did I sleep on Tuesday"): plan at low effort. */
    LOOKUP,

    /** An open question ("why am I tired lately"): plan at high effort, replan lap allowed. */
    ANALYSIS
}

package io.mrkuhne.mezo.feature.companion.memory.dto;

/** Whether a turn needs personal memory and short-history query resolution. */
public enum QueryMode {
    NO_MEMORY_NEEDED,
    SELF_CONTAINED,
    CONTEXT_DEPENDENT
}

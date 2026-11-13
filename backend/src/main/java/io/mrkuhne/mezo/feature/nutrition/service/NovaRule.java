package io.mrkuhne.mezo.feature.nutrition.service;

/** The processing-level rule: behaves like AVOID for any food above {@code maxLevel} (NOVA 1..4). */
public record NovaRule(boolean enabled, int maxLevel) {

    public static final int DEFAULT_MAX_LEVEL = 2;

    public static NovaRule defaults() {
        return new NovaRule(true, DEFAULT_MAX_LEVEL);
    }
}

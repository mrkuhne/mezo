package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

/**
 * Where one window stands against the clock and the log. Fixed-plan semantics (mezo-1oy5): windows
 * sit at their anchored times, {@code now} only classifies them. {@code SKIPPED} outranks every
 * clock state — a skipped window is never "missed" and never carries a suggestion.
 */
public enum WindowState {
    DONE, NOW, PENDING, MISSED, SKIPPED
}

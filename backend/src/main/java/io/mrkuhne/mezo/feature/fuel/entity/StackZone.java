package io.mrkuhne.mezo.feature.fuel.entity;

import java.util.Arrays;

/** Canonical stack zones (mezo-vx9v). Keys are the FE↔BE contract strings — order is the
 *  daily render order. Times are NEVER stored — the FE projects zone→time from live anchors. */
public enum StackZone {
    WAKE("wake"), BREAKFAST("breakfast"), PRE_WORKOUT("pre_workout"), POST_WORKOUT("post_workout"),
    LUNCH("lunch"), DINNER("dinner"), EVENING("evening"), BEDTIME("bedtime");

    private final String key;
    StackZone(String key) { this.key = key; }
    public String key() { return key; }
    public int order() { return ordinal(); }

    public static StackZone fromKey(String key) {
        return Arrays.stream(values()).filter(z -> z.key.equals(key)).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Unknown stack zone: " + key));
    }
}

package io.mrkuhne.mezo.feature.fuel.entity;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.Arrays;
import org.springframework.http.HttpStatus;

/** Canonical stack zones (mezo-vx9v). Keys are the FE↔BE contract strings — order is the
 *  daily render order. Times are NEVER stored — the FE projects zone→time from live anchors. */
public enum StackZone {
    WAKE("wake"), BREAKFAST("breakfast"), PRE_WORKOUT("pre_workout"), POST_WORKOUT("post_workout"),
    LUNCH("lunch"), DINNER("dinner"), EVENING("evening"), BEDTIME("bedtime");

    private final String key;
    StackZone(String key) { this.key = key; }
    public String key() { return key; }
    public int order() { return ordinal(); }

    /**
     * Resolves a zone by its wire key. Throws {@link SystemRuntimeErrorException} (400,
     * {@code VALIDATION_INVALID_VALUE} — the house pattern, error_handling.md; never a raw
     * {@code IllegalArgumentException}) on anything unrecognized. Callers feeding in untrusted
     * input (e.g. an LLM-emitted {@code slotKey}) MUST validate/catch around this call
     * themselves — this method never degrades silently, it always throws on a miss.
     */
    public static StackZone fromKey(String key) {
        return Arrays.stream(values()).filter(z -> z.key.equals(key)).findFirst()
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "slotKey").build(), HttpStatus.BAD_REQUEST));
    }
}

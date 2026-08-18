package io.mrkuhne.mezo.feature.notification.domain;

import java.util.Arrays;
import java.util.Optional;

/**
 * The 12 AI-brain notification kinds (bd mezo-gzhp, spec 2026-08-18 §2) — the single source of
 * truth for kind key, push family (slice F3 maps it to a {@link NotificationCategory}), and the
 * deeplink base. {@code familyKey} is null ONLY for {@code memoir_ready}: the existing
 * {@code memoir} push category already pushes that event — a second category would double-notify.
 * Pattern-detail kinds interpolate {@code {pairKey}} into the deeplink at emit time.
 */
public enum AppNotificationKind {

    PATTERN_INBOX("pattern_inbox", "pattern", "/insights/patterns/"),
    PATTERN_SIGNAL("pattern_signal", "pattern", "/insights/patterns/"),
    HYPOTHESIS_NEW("hypothesis_new", "pattern", "/insights"),
    FACT_CANDIDATE("fact_candidate", "knowledge", "/insights/knowledge"),
    FACT_REINFORCED("fact_reinforced", "knowledge", "/insights/knowledge"),
    MEMOIR_READY("memoir_ready", null, "/insights/memoir"),
    PREDICTION_NEW("prediction_new", "prediction", "/insights/predictions"),
    PREDICTION_OUTCOME("prediction_outcome", "prediction", "/insights/predictions"),
    EXPERIMENT_PROPOSED("experiment_proposed", "experiment", "/insights/experiments"),
    EXPERIMENT_CLOSED("experiment_closed", "experiment", "/insights/experiments"),
    CHALLENGE_EVENT("challenge_event", "challenge", "/train"),
    MEMORY_NOTE("memory_note", "memory", "/insights/memoria");

    private final String key;
    private final String familyKey;
    private final String deeplink;

    AppNotificationKind(String key, String familyKey, String deeplink) {
        this.key = key;
        this.familyKey = familyKey;
        this.deeplink = deeplink;
    }

    /** The stable wire key persisted in {@code app_notification.kind}. */
    public String key() {
        return key;
    }

    /** The push category key this kind rides in slice F3 — null = no feed-driven push. */
    public String familyKey() {
        return familyKey;
    }

    /** The deeplink base; the two pattern kinds append the pairKey at emit time. */
    public String deeplink() {
        return deeplink;
    }

    public static Optional<AppNotificationKind> fromKey(String key) {
        return Arrays.stream(values()).filter(k -> k.key.equals(key)).findFirst();
    }
}

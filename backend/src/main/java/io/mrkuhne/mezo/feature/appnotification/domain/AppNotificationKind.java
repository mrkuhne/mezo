package io.mrkuhne.mezo.feature.appnotification.domain;

import java.util.Arrays;
import java.util.Optional;

/**
 * The AI-brain notification kinds (bd mezo-gzhp, spec 2026-08-18 §2; {@code weekly_review_ready}
 * added mezo-p2tr; {@code life_goal_plan} added mezo-iizd.7; {@code goal_suggestion} added
 * mezo-ricj.4) — the single source of truth for
 * kind key, push family (slice F3 maps it to a {@link NotificationCategory}), and the deeplink
 * base. {@code familyKey} is null for feed-only kinds and for events an existing push category
 * already covers; this prevents double notification. Pattern-detail kinds interpolate
 * {@code {pairKey}} into the deeplink at emit time.
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
    MEMORY_NOTE("memory_note", "memory", "/insights/memoria"),
    /** mezo-p2tr: familyKey null like {@code memoir_ready} — the Task 7 push category reads this
     *  row itself, so a second family here would double-notify. */
    WEEKLY_REVIEW_READY("weekly_review_ready", null, "/me/week"),
    /** mezo-iizd.7: a ha–akkor terv megszólalása. familyKey null (feed-only, spec D-3) — a
     *  {@code /me/goals} bázis mellé az emitter a konkrét cél id-jét teszi. */
    LIFE_GOAL_PLAN("life_goal_plan", null, "/me/goals"),
    /** mezo-ricj.4: feed-only; the concrete suggestion id is appended after commit. */
    GOAL_SUGGESTION("goal_suggestion", null, "/me/goals/weight/suggestions"),
    /* ── mezo-0cbh: the four kinds the last week's features were missing. ALL feed-only
     *  (familyKey null) BY REQUEST — these are things to find when you next open the app, not
     *  things worth a phone buzz. Each rides a decision queue or a rare, earned moment. */
    /** The nightly extraction pass proposed unknown names as candidates — a queue that waits for
     *  an accept/reject, and until now only the Emberek hub tile ever said so. */
    PERSON_CANDIDATE("person_candidate", null, "/me/people/jeloltek"),
    /** An undecided graph candidate: LIFE_EVENT from the nightly pass, SEASON from the quarterly
     *  deep read. Two producers, one kind — the {@code challenge_event} precedent. */
    GRAPH_CANDIDATE("graph_candidate", null, "/mezo/knowledge"),
    /** A habit crossed the automaticity threshold. The deeplink base takes the habit key at emit
     *  time (the pattern kinds' idiom); once-ever per habit, enforced by the dedup key. */
    HABIT_FORMATION("habit_formation", null, "/me/rutin/szokas"),
    /** The monthly deep-read konzílium wrote a new portrait — the {@code memoir_ready} /
     *  {@code weekly_review_ready} shape: "something about you is finished". */
    CHARACTER_PORTRAIT("character_portrait", null, "/me/karakter");

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

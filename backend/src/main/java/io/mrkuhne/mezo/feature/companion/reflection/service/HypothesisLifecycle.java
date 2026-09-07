package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.reflection.config.ReflectionProperties;
import io.mrkuhne.mezo.feature.companion.service.PatternGate;
import java.util.Set;

/**
 * Reflexió S2 (bd mezo-eq85.2, spec 2026-09-06 §4.3): the pattern lifecycle as PURE arithmetic —
 * no Spring, no DB, no LLM ({@code PearsonCorrelation}/{@code PatternGate} precedent). Every
 * transition the nightly pass may make is decided here, and {@code belief} is computed here, so
 * neither can ever come out of a language model: Gemini phrases, code decides.
 *
 * <p>The state machine:
 * <pre>
 *   proposed ──strong hit──▶ monitoring ──hit streak + a positive user reply──▶ confirmed (frozen)
 *      │                          │
 *      └──────miss streak / two negative replies──────▶ refuted (terminal)
 *      └──────no data &gt; dormantAfterDays──────────────▶ dormant ──any data──▶ proposed
 * </pre>
 * {@code confirmed} and {@code rejected} are the USER's verdicts: the engine reads them and stops.
 */
public final class HypothesisLifecycle {

    /** {@code NONE} = the row stays where it is; nothing but an evidence event is written. */
    public record Decision(String newStatus, String eventKind) {
        public static final Decision NONE = new Decision(null, null);
    }

    /** How many negative user replies it takes to refute a hypothesis outright. Public since S4:
     *  the chip reply applies the SAME rule the moment the user says it, so the row does not wait
     *  a night to reflect a verdict the user already gave. One threshold, one meaning. */
    public static final int NEGATIVE_REPLIES_TO_REFUTE = 2;

    /** Chip/notice answers that count FOR a hypothesis, and the ones that count against it. S4
     *  moved them here (from {@code HypothesisEvaluationService}) because the nightly pass and the
     *  chip reply must never disagree about what the user's answer meant. */
    public static final Set<String> POSITIVE_CHOICES = Set.of("watch", "confirm");
    public static final Set<String> NEGATIVE_CHOICES = Set.of("reject");

    private HypothesisLifecycle() {
    }

    /**
     * @param status          the row's current status
     * @param verdict         tonight's gate verdict
     * @param hit             tonight's evidence confirmed the plan's prediction (LIVE + strong + right sign)
     * @param hitStreak       consecutive confirming evidence nights, tonight included
     * @param missStreak      consecutive contradicting evidence nights, tonight included
     * @param positiveReplies user replies asking to watch/confirm this pattern
     * @param negativeReplies user replies rejecting it
     * @param daysWithoutData days since the last evidence night that saw any data
     */
    public static Decision decide(String status, PatternGate.Verdict verdict, boolean hit,
                                  int hitStreak, int missStreak, int positiveReplies,
                                  int negativeReplies, long daysWithoutData,
                                  ReflectionProperties.Lifecycle cfg) {
        // The user's own verdict outranks every statistic — this branch is the whole reason the
        // engine is allowed to move rows at all (spec §4.3: it never overrides a judged row).
        if (PatternEntity.isUserFrozen(status)) {
            return Decision.NONE;
        }
        if (negativeReplies >= NEGATIVE_REPLIES_TO_REFUTE) {
            return new Decision(PatternEntity.STATUS_REFUTED, PatternEventEntity.KIND_REFUTED);
        }
        if (PatternEntity.STATUS_DORMANT.equals(status)) {
            // any data at all revives it — back to the start of the ladder, not to where it was
            return verdict == PatternGate.Verdict.NO_DATA
                    ? Decision.NONE
                    : new Decision(PatternEntity.STATUS_PROPOSED, PatternEventEntity.KIND_MONITORING);
        }
        if (verdict == PatternGate.Verdict.NO_DATA && daysWithoutData > cfg.dormantAfterDays()) {
            return new Decision(PatternEntity.STATUS_DORMANT, PatternEventEntity.KIND_DORMANT);
        }
        if (verdict != PatternGate.Verdict.LIVE) {
            return Decision.NONE; // too few days / degenerate — not evidence either way
        }
        if (missStreak >= cfg.refuteStreak()) {
            return new Decision(PatternEntity.STATUS_REFUTED, PatternEventEntity.KIND_REFUTED);
        }
        if (PatternEntity.STATUS_PROPOSED.equals(status) && hit) {
            return new Decision(PatternEntity.STATUS_MONITORING, PatternEventEntity.KIND_MONITORING);
        }
        // Confirming is a JOINT act: the statistics alone never promote a hypothesis to durable
        // knowledge — the user has to have said something positive about it at least once.
        if (PatternEntity.STATUS_MONITORING.equals(status) && hitStreak >= cfg.confirmStreak()
                && positiveReplies >= 1) {
            return new Decision(PatternEntity.STATUS_CONFIRMED, PatternEventEntity.KIND_CONFIRMED);
        }
        return Decision.NONE;
    }

    /**
     * 0.5·gate + 0.3·replies + 0.2·streak; every term in [0,1]. The three weights DEFINE what
     * belief means (spec §4.3), so they are code constants, not config — a tunable would let the
     * number silently change meaning between two rows.
     */
    public static double belief(Double r, Double p, int positive, int negative, int hits, int misses,
                                ReflectionProperties.Lifecycle cfg) {
        double gate = 0.0;
        if (r != null && p != null) {
            double strength = Math.min(1.0, Math.abs(r) / (2 * cfg.strongR()));
            double significance = p <= cfg.strongP()
                    ? 1.0
                    : Math.max(0.0, 1.0 - (p - cfg.strongP()) / (1.0 - cfg.strongP()));
            gate = 0.5 * strength + 0.5 * significance;
        }
        // the +1 denominators keep a single data point from reading as certainty
        double user = (positive + negative) == 0
                ? 0.0
                : Math.max(0.0, (double) (positive - negative) / (positive + negative + 1));
        double streak = (hits + misses) == 0 ? 0.0 : (double) hits / (hits + misses + 1);
        return Math.clamp(0.5 * gate + 0.3 * user + 0.2 * streak, 0.0, 1.0);
    }
}

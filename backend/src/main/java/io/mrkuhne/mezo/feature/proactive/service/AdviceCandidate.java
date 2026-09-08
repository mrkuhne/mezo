package io.mrkuhne.mezo.feature.proactive.service;

import java.util.List;

/**
 * What a detection hands {@code AdviceCardService} (S4, bd mezo-d58h.4, spec §5). The
 * {@code CompanionMessageEnvelope} idiom: one record, nullable identity fields, exactly one of
 * {@code interventionKey} / {@code setupKey} set.
 *
 * @param adviceKey       the SEVERITY key — the flag key or setup-check key {@link AdvicePriority}
 *                        ranks. Never null.
 * @param interventionKey the intervention-library ENTRY key on a flag-sourced candidate (the
 *                        per-entry cooldown, the {@code intervention:<key>} effectiveness rollup
 *                        and {@code AnchorResolver}'s push channel gate all read this); null on a
 *                        setup-sourced one.
 * @param setupKey        the setup-check key on a setup-sourced candidate; null on a flag-sourced one.
 * @param eyebrow         the card's eyebrow — the source's own ("Mezo · észrevétel" /
 *                        "Mezo · beállítás"), so the two tiers stay visually distinct.
 * @param facts           deterministic, rule-provided evidence lines; may be empty (honest absence).
 * @param suggestions     config-provided suggestion texts; at least one. Always the model's
 *                        GROUNDING ({@link AdviceProseGenerator}); they reach the card's own
 *                        display only when {@code verbatim} is true (mezo-wtl0).
 * @param fallbackProse   the exact text that would have shipped pre-S4 — used verbatim whenever the
 *                        LLM fails, answers blank, or invents a number.
 * @param verbatim        true when the card's body must be {@code fallbackProse} EXACTLY — the
 *                        once-ever questions (round 2 S5, bd mezo-d58h.7.5, spec 2026-09-05 §c).
 *                        The advice prompt orders the model to write coaching advice and forbids
 *                        numerals; a QUESTION run through it comes back as advice with the 👍/👎
 *                        answer key dissolved out of it. False for every flag- and setup-sourced
 *                        candidate: those ARE advice, and their wording is the model's job.
 *                        Doubles as the DISPLAY discriminator for {@code suggestions} above
 *                        (mezo-wtl0) — a generated body already carries them.
 */
public record AdviceCandidate(String adviceKey, String interventionKey, String setupKey,
                              String eyebrow, List<String> facts, List<String> suggestions,
                              String fallbackProse, boolean verbatim) {

    /** A flag-sourced candidate: the library entry key rides along for cooldown/rollup/push. */
    public static AdviceCandidate fromFlag(String flagKey, String interventionKey, String eyebrow,
                                           List<String> facts, List<String> suggestions,
                                           String fallbackProse) {
        return new AdviceCandidate(flagKey, interventionKey, null, eyebrow, facts, suggestions,
            fallbackProse, false);
    }

    /** A setup-sourced candidate: no library entry, so no push anchor and no per-entry rollup. */
    public static AdviceCandidate fromSetupCheck(String checkKey, String eyebrow,
                                                 List<String> suggestions, String fallbackProse) {
        return new AdviceCandidate(checkKey, null, checkKey, eyebrow, List.of(), suggestions,
            fallbackProse, false);
    }

    /** A once-ever QUESTION (round 2 S5, bd mezo-d58h.7.5): setup-tier identity — it rides the
     *  same {@code setupKey} envelope slot, which is what the once-ever dedupe reads — plus its
     *  own evidence list, the two one-tap answers as suggestions, and a body the LLM never
     *  touches. */
    public static AdviceCandidate fromQuestion(String questionKey, String eyebrow,
                                               List<String> facts, List<String> answers,
                                               String questionText) {
        return new AdviceCandidate(questionKey, null, questionKey, eyebrow, facts, answers,
            questionText, true);
    }
}

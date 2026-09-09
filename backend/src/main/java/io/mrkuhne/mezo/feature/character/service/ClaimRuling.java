package io.mrkuhne.mezo.feature.character.service;

import java.math.BigDecimal;

/**
 * The Integrátor's final verdict on one {@link ClaimProposal} from a weekly konzílium round
 * (Karakter spec §6 step 2, mezo-1gim.5). {@code ruledConfidence} is the new/insert confidence
 * when {@code accepted} — clamped to {@code [0.30, 0.90]} by {@link KonziliumVerdictRound} — and
 * is informational only when rejected (never applied). {@link ClaimLifecycle#apply} is the pure
 * persistence half that turns an accepted ruling into a row change.
 *
 * <p>{@code dissent} marks a ruling that contradicts the Szkeptikus's verdict, and {@code note}
 * the integration ground the chair found ({@code DUPLICATE}, {@code CONTRADICTS},
 * {@code NOT_FOR_DOSSIER}, {@code REHOME}) — the two fields that let a surface show only what the
 * chair ADDED instead of paraphrasing the Szkeptikus (mezo-lghn). {@code suggestedDimensionKey}
 * accompanies {@code REHOME} and is advisory only: nothing moves a claim between dimensions.
 */
public record ClaimRuling(ClaimProposal proposal, boolean accepted, BigDecimal ruledConfidence, String reason,
                          boolean dissent, String note, String suggestedDimensionKey) {

    /** The pre-mezo-lghn four-argument form: no dissent, no integration note. Keeps every
     *  construction site that is not the chair's own ruling unchanged. */
    public ClaimRuling(ClaimProposal proposal, boolean accepted, BigDecimal ruledConfidence, String reason) {
        this(proposal, accepted, ruledConfidence, reason, false, null, null);
    }
}

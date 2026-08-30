package io.mrkuhne.mezo.feature.character.service;

import java.math.BigDecimal;

/**
 * The Integrátor's final verdict on one {@link ClaimProposal} from a weekly konzílium round
 * (Karakter spec §6 step 2, mezo-1gim.5). {@code ruledConfidence} is the new/insert confidence
 * when {@code accepted} — clamped to {@code [0.30, 0.90]} by {@link KonziliumVerdictRound} — and
 * is informational only when rejected (never applied). {@link ClaimLifecycle#apply} is the pure
 * persistence half that turns an accepted ruling into a row change.
 */
public record ClaimRuling(ClaimProposal proposal, boolean accepted, BigDecimal ruledConfidence, String reason) {
}

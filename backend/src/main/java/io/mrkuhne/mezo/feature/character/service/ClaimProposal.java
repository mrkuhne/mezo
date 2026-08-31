package io.mrkuhne.mezo.feature.character.service;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One expert's proposed claim change from a weekly konzílium round (Karakter spec §6 step 1,
 * mezo-1gim.5): a candidate the round groups by expert, grounded in that expert's observations
 * for the week. {@code kind} is one of {@code NEW}, {@code UP}, {@code DOWN}, {@code RETIRE};
 * {@code claimId} is non-null for {@code UP}/{@code DOWN}/{@code RETIRE} and null for
 * {@code NEW}; {@code dimensionKey} is non-null for {@code NEW}.
 */
public record ClaimProposal(String expertKey, String kind, String dimensionKey, UUID claimId, String text,
                            BigDecimal confidence, boolean sensitive, String rationale) {
}

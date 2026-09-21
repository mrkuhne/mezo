package io.mrkuhne.mezo.feature.character.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * One expert's proposed claim change from a weekly konzílium round (Karakter spec §6 step 1,
 * mezo-1gim.5): a candidate the round groups by expert, grounded in that expert's observations
 * for the week. {@code kind} is one of {@code NEW}, {@code UP}, {@code DOWN}, {@code RETIRE}, {@code REVISE}, {@code MOVE};
 * {@code claimId} is non-null for {@code UP}/{@code DOWN}/{@code RETIRE} and null for
 * {@code NEW}; {@code dimensionKey} is non-null for {@code NEW} and {@code MOVE}.
 */
public record ClaimProposal(String expertKey, String kind, String dimensionKey, UUID claimId, String text,
                            BigDecimal confidence, boolean sensitive, String rationale,
                            LocalDate observedFrom, LocalDate observedTo, LocalDate validFrom, LocalDate validTo) {
    public ClaimProposal(String expertKey, String kind, String dimensionKey, UUID claimId, String text,
                         BigDecimal confidence, boolean sensitive, String rationale) {
        this(expertKey, kind, dimensionKey, claimId, text, confidence, sensitive, rationale, null, null, null, null);
    }

    public boolean hasValidPeriods() {
        return ordered(observedFrom, observedTo) && ordered(validFrom, validTo);
    }

    private static boolean ordered(LocalDate from, LocalDate to) {
        return from == null || to == null || !from.isAfter(to);
    }
}

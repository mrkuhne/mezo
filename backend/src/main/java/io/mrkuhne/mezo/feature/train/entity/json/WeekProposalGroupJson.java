package io.mrkuhne.mezo.feature.train.entity.json;

import java.util.List;

/**
 * What one trained counting muscle group did in a weekly volume proposal (S3): its tier and band,
 * its weekly sets as found ({@code setsBefore}) and after the week's decision ({@code setsAfter}),
 * and the contract reason codes behind it — the decider's, plus {@code deload_restore},
 * {@code stalled} and {@code no_slot} under the same conditions the audit text uses. {@code tier}
 * is the contract's lower-case {@code emphasize|grow|maintain}; the band is null only for a group
 * without a landmark entry. The line count is not stored: readers count the lines.
 */
public record WeekProposalGroupJson(
    String muscle,
    String tier,
    Integer bandLow,
    Integer bandHigh,
    boolean sportAdjusted,
    int setsBefore,
    int setsAfter,
    List<String> reasons) {}

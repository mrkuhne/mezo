package io.mrkuhne.mezo.feature.capacity.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * One proposal before it is stored (Boop B7 K3, mezo-r36n9.17): the main kind ({@code AdjustmentKind} name; a later
 * bedtime with its linked morning shift is {@code SHIFT_BEDTIME}), the steps accepted or declined together, the facts
 * the generator read off the week (names, dates, clock times — never an engine figure, those come from
 * {@link CrossEffectCalculator}) and the expected relief the generator ranks by.
 */
public record ProposalDraft(String kind, List<AdjustmentDraft> bundle, Map<String, Object> facts, double relief) {

    /** Every day the bundle changes, in order. */
    public List<LocalDate> touchedDays() {
        return bundle.stream()
            .flatMap(d -> AdjustmentPayload.parse(d.kind(), d.payload()).touchedDays().stream())
            .distinct().sorted().toList();
    }
}

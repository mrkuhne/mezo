package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;

/**
 * The mutation-set action keys (S5, bd mezo-d58h.5, spec 2026-09-03 §6) — string constants, not an
 * enum, for the same reason {@code FlagKey} is: they live in jsonb and in a contract enum, and a
 * Java enum would tempt a {@code valueOf} that throws on an old row's retired key.
 *
 * <p>{@link #ALL} exists so the dispatch layer and its tests can enumerate the set without
 * hand-copying it — the epic's recurring defect is an enumeration nobody re-derives. Adding a key
 * here means: this list, the {@code AdviceMutationPort} implementation that serves it, the contract
 * enum on the apply request, and the FE union. {@code AdviceApplyServiceIT} asserts every key in
 * {@link #ALL} resolves to a port, so a forgotten adapter fails a test rather than a user's tap.
 */
public final class AdviceActionKey {

    /** Lower tomorrow's gym targets by one working set per exercise (min 1). */
    public static final String LIGHTEN_TOMORROW = "lighten_tomorrow";
    /** Hide one dated occurrence of a recurring sport slot. */
    public static final String SKIP_SPORT_SLOT = "skip_sport_slot";
    /** Move the sleep goal's anchor time by ±N minutes. */
    public static final String SHIFT_SLEEP_ANCHOR = "shift_sleep_anchor";

    public static final List<String> ALL =
        List.of(LIGHTEN_TOMORROW, SKIP_SPORT_SLOT, SHIFT_SLEEP_ANCHOR);

    private AdviceActionKey() {
    }
}

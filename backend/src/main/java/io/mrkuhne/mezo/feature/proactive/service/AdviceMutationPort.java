package io.mrkuhne.mezo.feature.proactive.service;

import java.util.Map;
import java.util.UUID;

/**
 * One advice-card action's effect (S5, bd mezo-d58h.5, spec §6). The seam exists so
 * {@link AdviceApplyService} dispatches without importing {@code feature.train} or
 * {@code feature.biometrics} for each new mutation: adapters live beside it in
 * {@code feature.proactive}, and only they cross the slice boundary (a direction that already
 * exists — the reverse would be a new cycle).
 *
 * <p>Implementations MUST be idempotent on their own terms: {@link AdviceApplyService} already
 * refuses a second apply of the same action on the same card, but a rule may offer the same action
 * on a later day's card, and applying it twice must not double the effect.
 */
public interface AdviceMutationPort {

    /** The {@code AdviceActionKey} this port serves. Exactly one port per key. */
    String actionKey();

    /** Applies the effect. Params come from the card's own rule-provided action; validate them
     *  here — a client can call the endpoint with any card the rule wrote, so treat the values as
     *  bounded input, not as trusted. */
    void apply(UUID userId, Map<String, Object> params);
}

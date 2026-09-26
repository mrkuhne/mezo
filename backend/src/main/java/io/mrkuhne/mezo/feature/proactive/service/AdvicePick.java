package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import java.util.List;

/**
 * The library-selection SEAM (Task 4, bd mezo-a9bo7.21): what {@link InterventionService#pick}
 * hands back once a flag raise has picked its best-eligible intervention-library entry, before
 * anything decides what to DO with it. {@code InterventionService.deliverForFlag} turns one into a
 * {@code companion_message} advice card; the csapatfal team-chat line generator (Act III) reuses
 * the exact same selection instead of re-implementing the library filter, the per-entry cooldown
 * and the effectiveness weighting a second time.
 *
 * @param flagKey  the flag the entry was picked for (the severity/adviceKey identity).
 * @param entryKey the intervention-library ENTRY key — cooldown, effectiveness rollup and push
 *                 channel gate all key off this.
 * @param textHu   the library entry's own Hungarian text — both the model's grounding and the
 *                 template fallback (see {@code InterventionService.deliverForFlag}'s javadoc).
 * @param facts    deterministic, rule-provided evidence lines rendered from the raise's own frozen
 *                 payload ({@link io.mrkuhne.mezo.feature.companion.flags.service.FlagFactRenderer});
 *                 may be empty (honest absence, never a placeholder).
 * @param payload  the raise's own frozen payload envelope, or null when the raise carried none.
 */
public record AdvicePick(String flagKey, String entryKey, String textHu, List<String> facts,
                          FlagPayloadEnvelope payload) {
}

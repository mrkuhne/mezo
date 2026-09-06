package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.flags.service.AdviceRankPort;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** Supplies {@link AdviceRankPort} from {@link AdvicePriority} — the observer's only route to the
 *  severity table (spec 2026-09-05 §5). */
@Service
@ConditionalOnProperty(name = FeaturesConfiguration.PROACTIVE_SWITCH, havingValue = "true")
public class AdviceRankAdapter implements AdviceRankPort {

    @Override
    public int rankOf(String flagKey) {
        return AdvicePriority.rankOf(flagKey);
    }
}

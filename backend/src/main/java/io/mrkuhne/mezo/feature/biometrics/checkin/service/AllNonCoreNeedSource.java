package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Default {@link CheckInNeedSource} (mezo-ck2): every non-core item is wanted, so a need draw
 * asks the thinnest series overall. Narrower sources (hypotheses, pattern pairs, detectors) add
 * to this union later; until then the chooser still balances the rotating series.
 */
@Component
public class AllNonCoreNeedSource implements CheckInNeedSource {

    private static final Set<CheckInItem> NON_CORE = Arrays.stream(CheckInItem.values())
        .filter(i -> !i.core())
        .collect(Collectors.toUnmodifiableSet());

    @Override
    public Set<CheckInItem> wantedItems(UUID userId) {
        return NON_CORE;
    }
}

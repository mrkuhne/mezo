package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Fallback {@link CheckInNeedSource} (mezo-ck2): every non-core item is wanted with the generic
 * "why", so a need draw asks the thinnest series overall. Consulted only when no specific source
 * (hypotheses, pattern pairs, detectors) waits on anything.
 */
@Component
public class AllNonCoreNeedSource implements CheckInNeedSource {

    private static final List<Need> NON_CORE = Arrays.stream(CheckInItem.values())
        .filter(i -> !i.core())
        .map(i -> new Need(i, null))
        .toList();

    @Override
    public List<Need> needs(UUID userId) {
        return NON_CORE;
    }

    @Override
    public boolean fallback() {
        return true;
    }
}

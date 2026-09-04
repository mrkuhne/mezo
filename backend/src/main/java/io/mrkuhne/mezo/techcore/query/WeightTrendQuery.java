package io.mrkuhne.mezo.techcore.query;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import java.util.UUID;

/** Read-only cross-feature query seam for the owner's derived weight trend. */
public interface WeightTrendQuery {

    WeightTrendResponse computeTrend(UUID userId);
}

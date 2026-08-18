package io.mrkuhne.mezo.feature.needs.mapper;

import io.mrkuhne.mezo.api.dto.NeedsCloseResponse;
import io.mrkuhne.mezo.api.dto.NeedsSummaryResponse;
import io.mrkuhne.mezo.feature.needs.entity.NeedsDayEntity;
import org.springframework.stereotype.Component;

@Component
public class NeedsMapper {

    public NeedsCloseResponse toCloseResponse(NeedsDayEntity e) {
        return NeedsCloseResponse.builder()
            .date(e.getNeedsDate())
            .xpAwarded(e.getXpAwarded())
            .greenCount(e.getGreenCount())
            .allGreen(e.isAllGreen())
            .streakDays(e.getStreakDays())
            .build();
    }

    public NeedsSummaryResponse toSummaryResponse(NeedsDayEntity latest) {
        if (latest == null) {
            return NeedsSummaryResponse.builder().streakDays(0).build();
        }
        return NeedsSummaryResponse.builder()
            .streakDays(latest.getStreakDays())
            .lastCloseDate(latest.getNeedsDate())
            .lastAllGreen(latest.isAllGreen())
            .build();
    }
}

package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.PainRegion;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.train.service.DayCheckInPort;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Biometrics-side adapter for train's {@link DayCheckInPort} (Check-in 2.0 readiness, mezo-ck2 —
 * see the port's javadoc). Owner-scoped read of one day's check-ins; soft-deleted rows are
 * filtered by the entity's {@code @SQLRestriction}.
 */
@Component
@RequiredArgsConstructor
public class TrainDayCheckInAdapter implements DayCheckInPort {

    private final CheckInRepository checkInRepository;

    @Override
    public List<DayCheckIn> checkIns(UUID userId, LocalDate date) {
        return checkInRepository.findByCreatedByAndDateOrderBySlotTime(userId, date).stream()
            .map(TrainDayCheckInAdapter::toDayCheckIn)
            .toList();
    }

    private static DayCheckIn toDayCheckIn(CheckInEntity c) {
        List<String> regions = c.getPainRegions() == null
            ? List.of()
            : c.getPainRegions().stream().map(PainRegion::name).toList();
        return new DayCheckIn(c.getSlotTime(), c.getRested(), c.getSoreness(), c.getMotivation(),
            c.getPain(), regions, c.getPainIntensity());
    }
}

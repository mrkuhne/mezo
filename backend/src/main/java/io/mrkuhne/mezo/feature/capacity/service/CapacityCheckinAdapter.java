package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCheckinPort;
import io.mrkuhne.mezo.feature.dayclose.entity.DayCloseEntity;
import io.mrkuhne.mezo.feature.dayclose.repository.DayCloseRepository;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** {@link CapacityCheckinPort} over the check-in and day-close rows (latest answered check-in of the day wins). */
@Component
@RequiredArgsConstructor
public class CapacityCheckinAdapter implements CapacityCheckinPort {

    private static final String DONE = "done";

    private final CheckInRepository checkIns;
    private final DayCloseRepository dayCloses;

    @Override
    public Map<LocalDate, DayFeel> feel(UUID owner, LocalDate from, LocalDate to) {
        Map<LocalDate, List<CheckInEntity>> byDay = checkIns
            .findByCreatedByAndDeletedFalseAndDateBetween(owner, from, to).stream()
            .filter(c -> DONE.equals(c.getState()))
            .collect(Collectors.groupingBy(CheckInEntity::getDate));
        Map<LocalDate, DayCloseEntity> closes = dayCloses.findByCreatedByAndCloseDateBetween(owner, from, to).stream()
            .collect(Collectors.toMap(DayCloseEntity::getCloseDate, Function.identity(), (a, b) -> a));
        Set<LocalDate> days = new HashSet<>(byDay.keySet());
        days.addAll(closes.keySet());
        Map<LocalDate, DayFeel> out = new TreeMap<>();
        for (LocalDate d : days) {
            List<CheckInEntity> rows = byDay.getOrDefault(d, List.of()).stream()
                .sorted(Comparator.comparing(CheckInEntity::getSlotTime).reversed()).toList();
            Integer energy = rows.stream().map(CheckInEntity::getEnergy).filter(e -> e != null).findFirst().orElse(null);
            Integer mental = rows.stream().map(CheckInEntity::getMental).filter(e -> e != null).findFirst().orElse(null);
            DayCloseEntity close = closes.get(d);
            out.put(d, new DayFeel(energy, mental, close == null ? null : close.getDayRating(),
                close == null ? null : close.getEveningEnergy(), !rows.isEmpty(), close != null));
        }
        return out;
    }
}

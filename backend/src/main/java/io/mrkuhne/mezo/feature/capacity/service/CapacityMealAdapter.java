package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.feature.capacity.port.CapacityMealPort;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** {@link CapacityMealPort} over {@link FuelDayService#getDay}: the very numbers the Étel room shows. */
@Component
@RequiredArgsConstructor
public class CapacityMealAdapter implements CapacityMealPort {

    private final FuelDayService fuelDays;

    @Override
    public FuelDay fuelDay(UUID owner, LocalDate date) {
        FuelDayResponse r = fuelDays.getDay(owner, date);
        BigDecimal kcal = r.getConsumed() == null ? null : r.getConsumed().getKcal();
        Integer logged = kcal != null && kcal.signum() > 0 ? round(kcal) : null;
        return new FuelDay(date, logged, r.getTargets() == null ? 0 : round(r.getTargets().getKcal()));
    }

    private static int round(BigDecimal v) {
        return v == null ? 0 : v.setScale(0, RoundingMode.HALF_UP).intValue();
    }
}

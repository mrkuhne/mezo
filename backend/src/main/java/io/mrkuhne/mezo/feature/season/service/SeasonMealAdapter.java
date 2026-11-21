package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.api.dto.FuelDayRollup;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.season.port.SeasonMealPort;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * {@link SeasonMealPort} over {@link FuelDayService#getWeek} — the very read the Étel Hét tab renders, so a day's
 * target, consumed kcal and kímélő mark are the same numbers on both surfaces (parity; season-side adapter, see
 * {@link SeasonGoalAdapter}).
 */
@Component
@RequiredArgsConstructor
public class SeasonMealAdapter implements SeasonMealPort {

    private final FuelDayService fuelDayService;

    @Override
    public List<FoodDay> foodDays(UUID owner, LocalDate from, LocalDate to) {
        List<FoodDay> out = new ArrayList<>();
        for (LocalDate start = from; !start.isAfter(to); start = start.plusDays(7)) {
            for (FuelDayRollup r : fuelDayService.getWeek(owner, start).getDays()) {
                if (!r.getDate().isAfter(to)) {
                    out.add(day(r));
                }
            }
        }
        return out;
    }

    private static FoodDay day(FuelDayRollup r) {
        BigDecimal kcal = r.getConsumed() == null ? null : r.getConsumed().getKcal();
        boolean logged = kcal != null && kcal.signum() > 0;
        return new FoodDay(r.getDate(),
            logged ? round(kcal) : null,
            round(r.getTargets().getKcal()),
            logged ? round(r.getConsumed().getP()) : null,
            round(r.getTargets().getP()),
            r.getFuelMode() != null);
    }

    private static int round(BigDecimal v) {
        return v == null ? 0 : v.setScale(0, RoundingMode.HALF_UP).intValue();
    }
}

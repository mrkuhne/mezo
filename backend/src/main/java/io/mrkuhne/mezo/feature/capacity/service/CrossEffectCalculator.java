package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import io.mrkuhne.mezo.feature.capacity.port.CapacityMealPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityMealPort.FuelDay;
import io.mrkuhne.mezo.feature.capacity.port.CapacitySeasonPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityTrainPort;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.MoveSessionDay;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShiftBedtime;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShortenSession;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.SkipSession;
import io.mrkuhne.mezo.feature.capacity.service.Effects.DayEffect;
import io.mrkuhne.mezo.feature.capacity.service.Effects.RestEffect;
import io.mrkuhne.mezo.feature.capacity.service.Effects.SleepEffect;
import io.mrkuhne.mezo.feature.capacity.service.Effects.WeekTotals;
import io.mrkuhne.mezo.feature.capacity.service.WeekPicture.PlannedSession;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Runs a proposal's draft bundle through the real engines (Boop B7 K3, mezo-r36n9.17, spec §5.5): the load model on
 * the draft week ({@link DraftWeek}), the fuel day service's expected extra per day ({@link CapacityMealPort}), the
 * per-session expected kcal of the very model that preview uses ({@link CapacityTrainPort#plannedGymKcal}), the
 * {@code SleepNeedRule} need and the bedtime in effect ({@link WeekPicture.Sleep}), and the season's target date
 * ({@link CapacitySeasonPort}, read — a week-level change never moves it). Every number on a proposal card comes from
 * here. Read-only and model-free.
 */
@Service
public class CrossEffectCalculator {

    private final WeekPictureService pictures;
    private final CapacityMealPort meal;
    private final CapacityTrainPort train;
    private final CapacitySeasonPort season;
    private final CapacityProperties props;

    public CrossEffectCalculator(WeekPictureService pictures, CapacityMealPort meal, CapacityTrainPort train,
                                 CapacitySeasonPort season, CapacityProperties props) {
        this.pictures = pictures;
        this.meal = meal;
        this.train = train;
        this.season = season;
        this.props = props;
    }

    /** The effects of {@code d} on the week of its first touched day. */
    public Effects effects(UUID owner, ProposalDraft d) {
        LocalDate first = d.touchedDays().get(0);
        return effects(owner, pictures.picture(owner, first.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))),
            d);
    }

    /** The effects of {@code d} on an already read week (one read for all of a week's drafts). */
    public Effects effects(UUID owner, WeekPicture w, ProposalDraft d) {
        return effects(owner, w, d, fuelWeek(owner, w));
    }

    /** The fuel side of the week, read once: day → the fuel day service's numbers. */
    public Map<LocalDate, FuelDay> fuelWeek(UUID owner, WeekPicture w) {
        Map<LocalDate, FuelDay> out = new LinkedHashMap<>();
        for (LocalDate day = w.monday(); !day.isAfter(w.sunday()); day = day.plusDays(1)) {
            out.put(day, meal.fuelDay(owner, day));
        }
        return out;
    }

    public Effects effects(UUID owner, WeekPicture w, ProposalDraft d, Map<LocalDate, FuelDay> fuel) {
        DraftWeek.Result load = DraftWeek.apply(w, d.bundle(), props);

        Map<LocalDate, Integer> kcalDelta = new HashMap<>();
        Integer sessionKcal = null;
        SleepEffect sleep = null;
        for (AdjustmentDraft step : d.bundle()) {
            AdjustmentPayload p = AdjustmentPayload.parse(step.kind(), step.payload());
            switch (p) {
                case MoveSessionDay m -> {
                    Optional<PlannedSession> s = DraftWeek.session(w, m.fromDate(), m.templateSessionId());
                    if (s.isPresent()) {
                        int x = train.plannedGymKcal(owner, m.fromDate(), s.get().minutes());
                        sessionKcal = x;
                        kcalDelta.merge(m.fromDate(), -x, Integer::sum);
                        kcalDelta.merge(m.toDate(), x, Integer::sum);
                    }
                }
                case ShortenSession x -> {
                    Optional<PlannedSession> s = DraftWeek.session(w, x.date(), null);
                    if (s.isPresent()) {
                        int before = train.plannedGymKcal(owner, x.date(), s.get().minutes());
                        int after = train.plannedGymKcal(owner, x.date(), x.minutes());
                        sessionKcal = before;
                        kcalDelta.merge(x.date(), after - before, Integer::sum);
                    }
                }
                case SkipSession x -> {
                    Optional<PlannedSession> s = DraftWeek.session(w, x.date(), null);
                    if (s.isPresent()) {
                        int before = train.plannedGymKcal(owner, x.date(), s.get().minutes());
                        sessionKcal = before;
                        kcalDelta.merge(x.date(), -before, Integer::sum);
                    }
                }
                case ShiftBedtime b -> sleep = new SleepEffect(b.night(), w.sleep().bedtimes().get(b.night()),
                    b.bedtime(), w.sleep().needMin());
                default -> { }
            }
        }

        List<DayEffect> days = new ArrayList<>();
        for (DraftWeek.DayLoad l : load.days()) {
            FuelDay f = fuel.get(l.date());
            Integer before = f == null ? null : f.pendingMovementKcal();
            Integer after = expectedAfter(f, kcalDelta.getOrDefault(l.date(), 0));
            days.add(new DayEffect(l.date(), l.verdictBefore(), l.verdictAfter(), l.ratioBefore(), l.ratioAfter(),
                before, after));
        }
        List<RestEffect> rest = load.rest().stream()
            .map(r -> new RestEffect(r.sportDate(), r.label(), r.before(), r.after())).toList();

        Integer weekKcal = weekKcal(fuel);
        int deltaSum = kcalDelta.values().stream().mapToInt(Integer::intValue).sum();
        Double sleepHours = Math.round(7 * w.sleep().needMin() / 60.0 * 10) / 10.0;
        WeekTotals before = new WeekTotals(load.sessionsBefore(), weekKcal, sleepHours);
        // A later bedtime always comes with the morning shift that keeps the full need, so the planned sleep stays.
        WeekTotals after = new WeekTotals(load.sessionsAfter(), weekKcal == null ? null : weekKcal + deltaSum,
            sleepHours);
        return new Effects(List.copyOf(days), rest, sleep, before, after, season.targetDate(owner).orElse(null),
            sessionKcal);
    }

    /** The day's expected extra after the bundle; a day without an energy equation stays unknown. */
    private static Integer expectedAfter(FuelDay f, int delta) {
        if (f == null) {
            return null;
        }
        if (f.pendingMovementKcal() == null && delta <= 0) {
            return f.pendingMovementKcal();
        }
        return Math.max(0, (f.pendingMovementKcal() == null ? 0 : f.pendingMovementKcal()) + delta);
    }

    /** Σ the served targets plus the expected extras of the week; null when any day is unknown. */
    private static Integer weekKcal(Map<LocalDate, FuelDay> fuel) {
        int sum = 0;
        for (FuelDay f : fuel.values()) {
            if (f == null || f.targetKcal() <= 0) {
                return null;
            }
            sum += f.targetKcal() + (f.pendingMovementKcal() == null ? 0 : f.pendingMovementKcal());
        }
        return sum;
    }
}

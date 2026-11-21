package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import io.mrkuhne.mezo.feature.capacity.entity.CapacityProposalEntity;
import io.mrkuhne.mezo.feature.capacity.port.CapacitySeasonPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacitySeasonPort.SeasonFrame;
import io.mrkuhne.mezo.feature.capacity.port.CapacityTrainPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacityTrainPort.Session;
import io.mrkuhne.mezo.feature.capacity.repository.CapacityProposalRepository;
import io.mrkuhne.mezo.feature.capacity.service.CapacityDayService.DayRead;
import io.mrkuhne.mezo.feature.capacity.service.DemandCalculator.TimedDemand;
import io.mrkuhne.mezo.feature.capacity.service.SeasonLoadModel.DayRecovery;
import io.mrkuhne.mezo.feature.capacity.service.SeasonLoadModel.WeekIn;
import io.mrkuhne.mezo.feature.capacity.service.SeasonLoadModel.WeekOut;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * The Évad page's "Teher és pihenés" read (Boop B7 K2, mezo-r36n9.17): the weekly load against the recovery the body
 * offered, across the active season. Week 1 is the season's start week (Monday-Sunday, owner zone). Every lived day
 * (up to today) of a started week is read through {@link CapacityDayService#history} (stored or rule scores only,
 * never a model call); the current week counts only its lived days, so what is still ahead never makes it red. A week
 * that starts after today carries the training load of the planned sessions only. The overloaded-day count looks at
 * the 4 weeks before today whatever the season's age.
 *
 * <p>Cost: one batched history read from {@code min(season start Monday, today - 28)} to today (the day service's own
 * ~8 range reads) plus one yesterday-fuel read per day in it, and one planned-sessions read for the rest of the
 * season.
 */
@Service
@RequiredArgsConstructor
public class SeasonLoadService {

    static final int OVERLOAD_WINDOW_DAYS = 28;
    static final String VERDICT_OVERLOADED = "túl sok";

    /** The stored read model; {@code load}/{@code recovery} are null when unknown. */
    public record SeasonLoad(List<WeekOut> weeks, int nowWeek, int overloadedDays4w, int moves, int movesGood,
                             String headline) {
    }

    private final CapacitySeasonPort seasons;
    private final CapacityDayService days;
    private final CapacityTrainPort train;
    private final CapacityProposalRepository proposals;
    private final CapacityProperties props;
    private final WearableProperties wearable;
    private final ObjectProvider<Clock> clock;

    public SeasonLoad read(UUID owner) {
        SeasonFrame season = seasons.active(owner).orElseThrow(() -> new SystemRuntimeErrorException(
            SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        ZoneId zone = ZoneId.of(wearable.zone());
        LocalDate today = LocalDate.now(clock.getIfAvailable(Clock::systemUTC).withZone(zone));
        LocalDate startMonday = season.startDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        int weekCount = season.weeks();
        int nowWeek = (int) Math.max(1, Math.min(weekCount, ChronoUnit.WEEKS.between(startMonday, today) + 1));

        // started weeks: weekStart <= today; the rest are planned
        int started = 0;
        for (int w = 1; w <= weekCount; w++) {
            if (!startMonday.plusWeeks(w - 1).isAfter(today)) {
                started = w;
            }
        }
        // one batched read covers the lived season days and the overload window before today
        LocalDate overloadFrom = today.minusDays(OVERLOAD_WINDOW_DAYS);
        LocalDate readFrom = started > 0 && startMonday.isBefore(overloadFrom) ? startMonday : overloadFrom;
        Map<LocalDate, DayRead> read = new HashMap<>();
        days.history(owner, readFrom, today).forEach(r -> read.put(r.day().date(), r));
        LocalDate plannedFrom = startMonday.plusWeeks(started);
        Map<LocalDate, List<Session>> planned = started < weekCount
            ? train.sessions(owner, plannedFrom, startMonday.plusWeeks(weekCount).minusDays(1)) : Map.of();

        List<WeekIn> in = new ArrayList<>();
        for (int w = 1; w <= weekCount; w++) {
            LocalDate monday = startMonday.plusWeeks(w - 1);
            if (w <= started) {
                double load = 0;
                List<DayRecovery> rec = new ArrayList<>();
                for (int i = 0; i < 7 && !monday.plusDays(i).isAfter(today); i++) { // lived days only
                    DayRead r = read.get(monday.plusDays(i));
                    load += r.day().demand().units();
                    rec.add(new DayRecovery(r.sleepMin(), r.needMin(), r.restingHr(), r.rhrBaseline(), r.base()));
                }
                in.add(new WeekIn(w, load, SeasonLoadModel.weekRecovery(rec), false, false));
            } else {
                in.add(new WeekIn(w, plannedLoad(planned, monday, zone), null, true, true));
            }
        }
        List<WeekOut> weeks = SeasonLoadModel.weeks(in);

        int overloaded = 0;
        for (LocalDate d = overloadFrom; d.isBefore(today); d = d.plusDays(1)) {
            DayRead r = read.get(d);
            if (r != null && VERDICT_OVERLOADED.equals(r.day().verdict())) {
                overloaded++;
            }
        }
        List<CapacityProposalEntity> accepted = proposals.findByCreatedByAndStatusAndDeletedFalse(owner, "accepted");
        int good = (int) accepted.stream()
            .filter(p -> p.getOutcome() != null && Boolean.TRUE.equals(p.getOutcome().get("good"))).count();
        return new SeasonLoad(weeks, nowWeek, overloaded, accepted.size(), good,
            SeasonLoadModel.headline(weeks, nowWeek));
    }

    /** The planned sessions of a week as training demand only (no calendar, no sleep). */
    private double plannedLoad(Map<LocalDate, List<Session>> planned, LocalDate monday, ZoneId zone) {
        double sum = 0;
        for (int i = 0; i < 7; i++) {
            LocalDate d = monday.plusDays(i);
            List<TimedDemand> items = new ArrayList<>();
            for (Session s : planned.getOrDefault(d, List.of())) {
                items.add(DemandCalculator.training(d.atTime(s.start()).atZone(zone).toInstant(), s.durationMin(),
                    CapacityDayService.heavyLabel(s.label()), null, null, s.label() == null ? s.kind() : s.label()));
            }
            sum += DemandCalculator.day(items, props, zone, d).units();
        }
        return sum;
    }
}

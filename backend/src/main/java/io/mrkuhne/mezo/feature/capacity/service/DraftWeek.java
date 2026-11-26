package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.MoveSessionDay;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShortenSession;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.SkipSession;
import io.mrkuhne.mezo.feature.capacity.service.DemandCalculator.DemandItem;
import io.mrkuhne.mezo.feature.capacity.service.WeekPicture.PlannedSession;
import io.mrkuhne.mezo.feature.capacity.service.WeekPicture.SportSlot;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

/**
 * Applies a proposal's draft bundle to a {@link WeekPicture} with the load model (Boop B7 K3, mezo-r36n9.17) — pure.
 * A session leaving a day takes exactly its demand item's units with it; a session arriving is priced by
 * {@link DemandCalculator#training} on its new day; a shortened session is re-priced at its new length. The day's
 * capacity stays as the load model computed it, so verdict before → after is the same ratio rule
 * ({@link Verdicts}) on the changed demand. Time-only, sleep, meal and calendar steps leave the demand as it is.
 * Training items never take part in the meeting sequence factor or the gap credit, so the arithmetic is exact.
 */
public final class DraftWeek {

    private DraftWeek() {
    }

    /** One touched day: the load ratio and the verdict word before and after the bundle. */
    public record DayLoad(LocalDate date, double ratioBefore, String verdictBefore, double ratioAfter,
                          String verdictAfter) {
    }

    /** A sport slot whose rest days before it (consecutive days with no gym session) change. */
    public record Rest(LocalDate sportDate, String label, int before, int after) {
    }

    /** Every touched day of the week, the changed rest counts and the week's gym sessions before / after. */
    public record Result(List<DayLoad> days, List<Rest> rest, int sessionsBefore, int sessionsAfter) {

        public Optional<DayLoad> day(LocalDate date) {
            return days.stream().filter(d -> d.date().equals(date)).findFirst();
        }
    }

    public static Result apply(WeekPicture w, List<AdjustmentDraft> bundle, CapacityProperties p) {
        Map<LocalDate, Double> delta = new HashMap<>();
        Map<LocalDate, Integer> gym = new HashMap<>();
        for (PlannedSession s : w.sessions()) {
            gym.merge(s.date(), 1, Integer::sum);
        }
        Map<LocalDate, Integer> gymBefore = Map.copyOf(gym);
        Set<LocalDate> touched = new TreeSet<>();
        for (AdjustmentDraft d : bundle) {
            AdjustmentPayload step = AdjustmentPayload.parse(d.kind(), d.payload());
            touched.addAll(step.touchedDays());
            switch (step) {
                case MoveSessionDay m -> session(w, m.fromDate(), m.templateSessionId()).ifPresent(s -> {
                    delta.merge(m.fromDate(), -itemUnits(w, s, p), Double::sum);
                    delta.merge(m.toDate(), trainingUnits(w, s, m.toDate(), s.minutes(), p), Double::sum);
                    gym.merge(m.fromDate(), -1, Integer::sum);
                    gym.merge(m.toDate(), 1, Integer::sum);
                });
                case ShortenSession x -> session(w, x.date(), null).ifPresent(s -> delta.merge(x.date(),
                    trainingUnits(w, s, x.date(), x.minutes(), p) - itemUnits(w, s, p), Double::sum));
                case SkipSession x -> session(w, x.date(), null).ifPresent(s -> {
                    delta.merge(x.date(), -itemUnits(w, s, p), Double::sum);
                    gym.merge(x.date(), -1, Integer::sum);
                });
                default -> { }
            }
        }
        List<DayLoad> days = new ArrayList<>();
        for (LocalDate date : touched) {
            w.day(date).ifPresent(day -> {
                double cap = day.capacity().units();
                double after = cap > 0 ? Math.max(0, day.demand().units() + delta.getOrDefault(date, 0.0)) / cap : 0;
                days.add(new DayLoad(date, day.ratio(), day.verdict(), after, Verdicts.word(after, p)));
            });
        }
        List<Rest> rest = new ArrayList<>();
        for (SportSlot slot : w.sport()) {
            int before = restDays(slot.date(), gymBefore, w.monday());
            int after = restDays(slot.date(), gym, w.monday());
            if (before != after) {
                rest.add(new Rest(slot.date(), slot.label(), before, after));
            }
        }
        return new Result(List.copyOf(days), List.copyOf(rest), count(gymBefore), count(gym));
    }

    /** Consecutive days right before {@code sportDate} (within the week) with no gym session. */
    static int restDays(LocalDate sportDate, Map<LocalDate, Integer> gym, LocalDate monday) {
        int n = 0;
        for (LocalDate d = sportDate.minusDays(1); !d.isBefore(monday); d = d.minusDays(1)) {
            if (gym.getOrDefault(d, 0) > 0) {
                break;
            }
            n++;
        }
        return n;
    }

    /** The day's still-planned session (the move's template first). */
    static Optional<PlannedSession> session(WeekPicture w, LocalDate date, UUID templateId) {
        List<PlannedSession> on = w.sessionsOn(date).stream().filter(s -> !s.done()).toList();
        return on.stream().filter(s -> templateId != null && templateId.equals(s.templateId())).findFirst()
            .or(() -> on.stream().findFirst());
    }

    /** The units the session's demand item carries on its day (priced afresh when the item is not found). */
    static double itemUnits(WeekPicture w, PlannedSession s, CapacityProperties p) {
        Instant start = s.date().atTime(s.start()).atZone(w.zone()).toInstant();
        return w.day(s.date()).flatMap(day -> day.demand().items().stream()
                .filter(i -> "training".equals(i.kind()) && start.equals(i.start()))
                .map(DemandItem::units)
                .findFirst())
            .orElseGet(() -> trainingUnits(w, s, s.date(), s.minutes(), p));
    }

    /** The load model's units of the session on {@code date} at {@code minutes}. */
    static double trainingUnits(WeekPicture w, PlannedSession s, LocalDate date, int minutes, CapacityProperties p) {
        Instant start = date.atTime(s.start()).atZone(w.zone()).toInstant();
        return DemandCalculator.day(List.of(DemandCalculator.training(start, minutes, s.heavy(), null, null,
            Objects.requireNonNullElse(s.label(), "gym"))), p, w.zone(), date).units();
    }

    private static int count(Map<LocalDate, Integer> gym) {
        return gym.values().stream().mapToInt(i -> Math.max(0, i)).sum();
    }
}

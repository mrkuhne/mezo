package io.mrkuhne.mezo.feature.train.service.sport;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * The numbers of the Sport area's load, body and shoulder views from plain facts (Boop Sport S2, mezo-r36n9.202).
 * Pure and deterministic — the golden test pins a fixture week. Rules: {@link SportLoadRule} (load),
 * {@link SportMuscleTable} (sport heat); gym heat = the session's load split over its muscles by share of done
 * working sets. Each layer's level is its value ÷ the layer's top muscle; {@code together} = (gym + sport) ÷ the top
 * combined muscle — one scale, so the three views of the phone's body map never disagree.
 */
public final class SportMath {

    private SportMath() {
    }

    /** One done working set: its muscle token and the RIR it counts with (logged, else the exercise's target). */
    public record GymSet(String muscle, Integer rir) {
    }

    /** One done gym session. */
    public record GymSession(LocalDate date, int minutes, List<GymSet> sets) {
    }

    /** One logged sport session. */
    public record SportSession(LocalDate date, String sport, BigDecimal rpe, Integer intensity, Integer durationMin,
                               Integer shoulderStrain) {
    }

    /** One muscle's heat. */
    public record MuscleHeat(String muscle, int gymLoad, int sportLoad, double gym, double sport, double together) {
    }

    /** One week's load. */
    public record LoadWeek(LocalDate weekStart, int sportLoad, int gymLoad, int sportSessions, int gymSessions,
                           int sportUnknown, int gymUnknown) {
    }

    public static Integer gymLoad(GymSession s) {
        return SportLoadRule.gym(SportLoadRule.gymSessionRpe(s.sets().stream().map(GymSet::rir).toList()),
            s.minutes());
    }

    public static Integer sportLoad(SportSession s) {
        return SportLoadRule.sport(s.rpe(), s.intensity(), s.durationMin());
    }

    /** The week's load from its sessions (callers pass only that week's). */
    public static LoadWeek loadWeek(LocalDate weekStart, List<GymSession> gym, List<SportSession> sport) {
        int gymLoad = 0;
        int gymUnknown = 0;
        for (GymSession g : gym) {
            Integer l = gymLoad(g);
            if (l == null) {
                gymUnknown++;
            } else {
                gymLoad += l;
            }
        }
        int sportLoad = 0;
        int sportUnknown = 0;
        for (SportSession s : sport) {
            Integer l = sportLoad(s);
            if (l == null) {
                sportUnknown++;
            } else {
                sportLoad += l;
            }
        }
        return new LoadWeek(weekStart, sportLoad, gymLoad, sport.size(), gym.size(), sportUnknown, gymUnknown);
    }

    /** Per-muscle heat, hottest together first (ties: muscle name). */
    public static List<MuscleHeat> body(List<GymSession> gym, List<SportSession> sport) {
        Map<String, double[]> acc = new TreeMap<>(); // muscle → [gym, sport]
        for (GymSession g : gym) {
            Integer load = gymLoad(g);
            List<GymSet> placed = g.sets().stream().filter(s -> s.muscle() != null && !s.muscle().isBlank()).toList();
            if (load == null || placed.isEmpty()) {
                continue;
            }
            double perSet = (double) load / placed.size();
            placed.forEach(s -> acc.computeIfAbsent(s.muscle(), k -> new double[2])[0] += perSet);
        }
        for (SportSession s : sport) {
            Integer load = sportLoad(s);
            if (load == null) {
                continue;
            }
            SportMuscleTable.weights(s.sport())
                .forEach((muscle, w) -> acc.computeIfAbsent(muscle, k -> new double[2])[1] += w * load);
        }
        double topGym = acc.values().stream().mapToDouble(v -> v[0]).max().orElse(0);
        double topSport = acc.values().stream().mapToDouble(v -> v[1]).max().orElse(0);
        double topBoth = acc.values().stream().mapToDouble(v -> v[0] + v[1]).max().orElse(0);
        List<MuscleHeat> out = new ArrayList<>();
        acc.forEach((muscle, v) -> out.add(new MuscleHeat(muscle, (int) Math.round(v[0]), (int) Math.round(v[1]),
            level(v[0], topGym), level(v[1], topSport), level(v[0] + v[1], topBoth))));
        out.sort(Comparator.comparingDouble(MuscleHeat::together).reversed().thenComparing(MuscleHeat::muscle));
        return out;
    }

    /** Sport sessions that add no heat: unknown load or a kind with no muscle row. */
    public static int sportWithoutHeat(List<SportSession> sport) {
        return (int) sport.stream()
            .filter(s -> sportLoad(s) == null || SportMuscleTable.weights(s.sport()).isEmpty())
            .count();
    }

    /** The average shoulder strain of the sessions that carry one, one decimal; {@code null} when none does. */
    public static BigDecimal shoulderAverage(List<SportSession> sport) {
        List<Integer> v = sport.stream().map(SportSession::shoulderStrain).filter(x -> x != null).toList();
        if (v.isEmpty()) {
            return null;
        }
        int sum = v.stream().mapToInt(Integer::intValue).sum();
        return BigDecimal.valueOf(sum).divide(BigDecimal.valueOf(v.size()), 1, RoundingMode.HALF_UP);
    }

    private static double level(double value, double top) {
        if (top <= 0 || value <= 0) {
            return 0;
        }
        return BigDecimal.valueOf(Math.min(1.0, value / top)).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}

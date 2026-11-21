package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import java.util.ArrayList;
import java.util.List;

/** The pure "what can he carry today" model (Boop B7 K1). A missing input adds no factor, never a guess. */
public final class CapacityCalculator {

    private CapacityCalculator() {
    }

    public record CapacityInputs(double baseUnits, Integer sleepMin, Integer sleepNeedMin, Integer restingHr,
                                 Double rhrBaseline, Double hrv, Double hrvBaseline, double yesterdayUnits,
                                 Boolean underAteYesterday, boolean recovery, Integer checkinEnergy,
                                 Integer checkinMental) {
    }

    /** effect: -1 lowers the capacity, +1 raises it, 0 neutral. */
    public record Factor(String key, String label, String valueText, int effect, double multiplier) {
    }

    public record Capacity(double units, List<Factor> factors) {
    }

    public static Capacity today(CapacityInputs in, CapacityProperties p) {
        List<Factor> factors = new ArrayList<>();
        sleep(in, factors);
        rhr(in, factors);
        hrv(in, factors);
        yesterday(in, factors);
        if (in.underAteYesterday() != null) {
            boolean under = in.underAteYesterday();
            factors.add(new Factor("fuel", "Tankolás",
                    under ? "Tegnap kevesebbet ettél a tervnél" : "Tegnap rendben volt az evés",
                    under ? -1 : 0, under ? 0.93 : 1.0));
        }
        if (in.recovery()) {
            factors.add(new Factor("recovery", "Kímélő mód", "Pihenőnap-állapot van érvényben", -1, 0.6));
        }
        checkin(in, factors);
        double units = in.baseUnits() * p.headroom();
        for (Factor f : factors) {
            units *= f.multiplier();
        }
        return new Capacity(units, List.copyOf(factors));
    }

    private static void sleep(CapacityInputs in, List<Factor> out) {
        if (in.sleepMin() == null || in.sleepNeedMin() == null) {
            return;
        }
        int slept = in.sleepMin();
        int diff = in.sleepNeedMin() - slept;
        String time = (slept / 60) + " ó " + String.format("%02d", slept % 60) + " p";
        if (diff >= 45) {
            out.add(new Factor("sleep", "Alvás", time + " · " + diff + " perccel kevesebb a szokásosnál", -1,
                    diff >= 90 ? 0.75 : 0.85));
        } else {
            out.add(new Factor("sleep", "Alvás", time + " · a szokásos körül", 0, 1.0));
        }
    }

    private static void rhr(CapacityInputs in, List<Factor> out) {
        if (in.restingHr() == null || in.rhrBaseline() == null) {
            return;
        }
        double diff = in.restingHr() - in.rhrBaseline();
        long rounded = Math.round(diff);
        if (diff >= 3) {
            out.add(new Factor("rhr", "Nyugalmi pulzus",
                    in.restingHr() + " · " + rounded + " ütéssel magasabb a szokásosnál", -1,
                    diff >= 6 ? 0.85 : 0.93));
        } else {
            out.add(new Factor("rhr", "Nyugalmi pulzus", in.restingHr() + " · a szokásos körül", 0, 1.0));
        }
    }

    private static void hrv(CapacityInputs in, List<Factor> out) {
        if (in.hrv() == null || in.hrvBaseline() == null) {
            return;
        }
        long shown = Math.round(in.hrv());
        if (in.hrv() < 0.8 * in.hrvBaseline()) {
            out.add(new Factor("hrv", "HRV", shown + " ms · a szokásos alatt", -1, 0.9));
        } else {
            out.add(new Factor("hrv", "HRV", shown + " ms · a szokásos körül", 0, 1.0));
        }
    }

    private static void yesterday(CapacityInputs in, List<Factor> out) {
        if (in.baseUnits() <= 0 || in.yesterdayUnits() <= 0) {
            return;
        }
        if (in.yesterdayUnits() > 1.3 * in.baseUnits()) {
            out.add(new Factor("yesterday", "Tegnapi nap", "Tegnap a szokásosnál sokkal terheltebb volt", -1, 0.9));
        } else {
            out.add(new Factor("yesterday", "Tegnapi nap", "Tegnap nem volt rendkívüli", 0, 1.0));
        }
    }

    private static void checkin(CapacityInputs in, List<Factor> out) {
        Integer e = in.checkinEnergy();
        if (e == null) {
            return;
        }
        if (e <= 3) {
            out.add(new Factor("checkin", "Reggeli érzés", "Az energiád " + e + "/10", -1, 0.85));
        } else if (e >= 8) {
            out.add(new Factor("checkin", "Reggeli érzés", "Az energiád " + e + "/10", 1, 1.05));
        } else {
            out.add(new Factor("checkin", "Reggeli érzés", "Az energiád " + e + "/10", 0, 1.0));
        }
    }
}
